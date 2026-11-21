// 감독 장부의 승인 증거 판정 (PLAN-102) — 순수 판정 · 계산된 상태 · 임시 git 저장소에서 사실 모으기 (머지 · 스쿼시 · 설정 막음 · 영수증)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import * as AP from '../judicial/supervise_approval.js';
import * as SV from '../rebuild/supervise.mjs';

const T = { 'a.md': 'b1', 'gone.md': null };
const C = (sha, time, blobs, denyMerge = true) => ({ sha, time, blobs, denyMerge });

test('① 판정: 대상 없음 · 병합 전(가장 가까운 커밋) · HEAD 가 아니라 처음 나타난 커밋', () => {
  assert.equal(AP.judge({ target: {}, commits: [] }).status, 'empty');
  const nm = AP.judge({ target: T, commits: [C('1111111aaa', '2026-11-21T00:00:00Z', { 'a.md': 'b0', 'gone.md': 'g' })] });
  assert.equal(nm.status, 'not_merged'); assert.match(nm.reasons[0], /0\/2 파일이 같음/);
  const two = AP.judge({ target: T, commits: [C('2222222bbb', '2026-11-21T00:00:00Z', { 'a.md': 'b1' }), C('3333333ccc', '2026-11-21T01:00:00Z', { 'a.md': 'b1' })] });
  assert.equal(two.status, 'approved'); assert.equal(two.commit, '2222222bbb', '처음 나타난 커밋');
  // 지운 파일은 main 에도 없어야 같다
  assert.equal(AP.judge({ target: T, commits: [C('4444444ddd', '2026-11-21T00:00:00Z', { 'a.md': 'b1', 'gone.md': 'g' })] }).status, 'not_merged');
});

test('② 판정: 설정 막음이 없으면 "병합 확인 · 사람 보장 없음" (DEC-0068 · PLAN-113 전)', () => {
  const v = AP.judge({ target: T, commits: [C('5555555eee', '2026-11-21T00:00:00Z', { 'a.md': 'b1' }, false)] });
  assert.equal(v.status, 'merged_unguarded'); assert.match(v.reasons.join(' '), /deny 에 mcp__github__merge_pull_request 없음/);
});

test('③ 판정: 영수증의 AI 병합 호출이 병합 커밋 시각 근처면 사람 승인 아님 · 멀면 무관', () => {
  const commits = [C('6666666fff', '2026-11-02T20:02:41Z', { 'a.md': 'b1' })];
  const near = AP.judge({ target: T, commits, aiMerges: [{ at: '2026-11-02T20:02:42.757Z', receipt: '2026-11-02-c26eef5a-878' }] });
  assert.equal(near.status, 'merged_ai', 'PR #10 처럼 1 초 차이');
  const far = AP.judge({ target: T, commits, aiMerges: [{ at: '2026-11-01T10:00:00Z', receipt: 'x' }] });
  assert.equal(far.status, 'approved');
});

test('④ 계산된 상태: 넘기기 전 · 승인 대기 · 반영 중 · 완료 · 막힘은 그대로', () => {
  const sup = (runs, extra = {}) => ({ state: 'running', active: null, steps: ['author', 'inspect', 'baseline'], runs, ...extra });
  const h = (run, mode) => ({ run, mode, result: 'handed_off' });
  const ok = { status: 'approved', text: AP.STATUS.approved, commit: 'c' };
  assert.equal(AP.derive(sup([h('S/r1', 'author')]), ok).state, 'running');
  assert.equal(AP.derive(sup([h('S/r1', 'author'), h('S/r2', 'inspect')]), { status: 'not_merged', text: 'x' }).state, 'awaiting_approval');
  assert.equal(AP.derive(sup([h('S/r1', 'author'), h('S/r2', 'inspect')]), { status: 'merged_unguarded', text: 'x' }).state, 'awaiting_approval', '사람 보장이 없으면 승인 아님');
  assert.equal(AP.derive(sup([h('S/r1', 'author'), h('S/r2', 'inspect')]), ok).state, 'applying');
  assert.equal(AP.derive(sup([h('S/r1', 'author'), h('S/r2', 'inspect'), h('S/r3', 'baseline')]), ok, { 'S/r3': false }).state, 'applying', 'baseline 이 승인 커밋 위가 아님');
  assert.equal(AP.derive(sup([h('S/r1', 'author'), h('S/r2', 'inspect'), h('S/r3', 'baseline')]), ok, { 'S/r3': true }).state, 'completed');
  assert.equal(AP.derive(sup([], { state: 'blocked' }), ok).state, 'blocked');
});

// 임시 git 저장소 — main 에서 갈라진 작업 브랜치 → main 에 스쿼시로 들어감 (커밋 모양이 달라도 바이트로 찾는다)
function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'sva-'));
  const g = (...a) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', ...a], { cwd: dir, encoding: 'utf8' }).trim();
  const w = (p, t) => { mkdirSync(join(dir, p, '..'), { recursive: true }); writeFileSync(join(dir, p), t); };
  g('init', '-q', '-b', 'main');
  w('a.md', 'v0\n'); w('.claude/settings.json', JSON.stringify({ permissions: { deny: ['Read(.env)'] } })); g('add', '-A'); g('commit', '-q', '-m', 'base');
  const base = g('rev-parse', 'HEAD');
  g('checkout', '-q', '-b', 'work'); w('a.md', 'v1\n'); w('b.md', 'new\n'); g('add', '-A'); g('commit', '-q', '-m', 'work');
  const tip = g('rev-parse', 'HEAD');
  g('checkout', '-q', 'main');
  return { dir, g, w, base, tip };
}
const supOf = (r) => ({ id: 'SUP-0001', state: 'running', active: null, steps: ['author', 'inspect'], runs: [
  { run: 'SUP-0001/r1', mode: 'author', result: 'handed_off', base: r.base, outputs: { commits: [r.tip] } },
  { run: 'SUP-0001/r2', mode: 'inspect', result: 'handed_off', base: r.tip, outputs: { commits: [r.tip] } }] });

test('⑤ 사실 모으기: 병합 전 → 스쿼시로 main 에 들어가면 병합 확인, 설정 막음 없으면 사람 보장 없음', () => {
  const r = repo();
  try {
    assert.equal(SV.evidence(supOf(r), r.dir).verdict.status, 'not_merged');
    assert.equal(SV.evidence(supOf(r), r.dir).derived.state, 'awaiting_approval');
    r.w('a.md', 'v1\n'); r.w('b.md', 'new\n'); r.g('add', '-A'); r.g('commit', '-q', '-m', 'squash of work');
    const e = SV.evidence(supOf(r), r.dir);
    assert.equal(e.verdict.status, 'merged_unguarded'); assert.equal(e.files, 2); assert.equal(e.derived.state, 'awaiting_approval');
  } finally { rmSync(r.dir, { recursive: true, force: true }); }
});

test('⑥ 사실 모으기: 설정에 PR 병합 막음이 든 뒤의 병합은 승인 · 그 뒤 바뀌어도 처음 나타난 커밋', () => {
  const r = repo();
  try {
    r.w('.claude/settings.json', JSON.stringify({ permissions: { deny: ['Read(.env)', AP.MERGE_TOOL] } })); r.g('add', '-A'); r.g('commit', '-q', '-m', 'PLAN-113');
    r.g('merge', '-q', '--no-ff', '-m', 'merge work', 'work');
    const at = r.g('rev-parse', 'HEAD');
    r.w('a.md', 'v2 later\n'); r.g('add', '-A'); r.g('commit', '-q', '-m', 'later change');
    const e = SV.evidence(supOf(r), r.dir);
    assert.equal(e.verdict.status, 'approved'); assert.equal(e.verdict.commit, at); assert.equal(e.derived.state, 'completed', 'baseline 단계가 없는 상위 작업');
  } finally { rmSync(r.dir, { recursive: true, force: true }); }
});

test('⑦ 사실 모으기: main 의 영수증에 그 시각의 AI 병합 호출이 있으면 사람 승인 아님', () => {
  const r = repo();
  try {
    r.w('.claude/settings.json', JSON.stringify({ permissions: { deny: [AP.MERGE_TOOL] } })); r.g('add', '-A'); r.g('commit', '-q', '-m', 'deny');
    r.g('merge', '-q', '--no-ff', '-m', 'merge work', 'work');
    const t = r.g('show', '-s', '--format=%cI', 'HEAD');
    r.w('workspace/receipts/2026-11-21-x.jsonl', JSON.stringify({ at: new Date(Date.parse(t) + 1000).toISOString(), t: 'tool', tool: AP.MERGE_TOOL }) + '\n'); r.g('add', '-A'); r.g('commit', '-q', '-m', 'receipt');
    assert.equal(SV.evidence(supOf(r), r.dir).verdict.status, 'merged_ai');
  } finally { rmSync(r.dir, { recursive: true, force: true }); }
});
