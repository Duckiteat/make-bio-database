// 감독 장부의 승인 증거 판정 (PLAN-102 · PLAN-117) — 순수 판정 · 계산된 상태 · 임시 git 저장소에서 사실 모으기 (머지 · 스쿼시) · GitHub 사실(병합한 계정 · 승인 리뷰)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import * as AP from '../judicial/supervise_approval.js';
import * as SV from '../rebuild/supervise.mjs';

const T = { 'a.md': 'b1', 'gone.md': null };
const C = (sha, time, blobs) => ({ sha, time, blobs });
const H = ['Duckiteat'];
// GitHub 사실 (CI 가 모으는 모양) — PR #26 처럼: 봇이 열고 사람이 머리 커밋을 승인 · 사람이 병합
const F = (o = {}) => ({ pr: 26, author: 'daduteria', merged_by: 'Duckiteat', head: 'h1', reviews: [{ user: 'Duckiteat', state: 'APPROVED', commit_id: 'h1' }], ...o });

test('① 판정: 대상 없음 · 병합 전(가장 가까운 커밋) · HEAD 가 아니라 처음 나타난 커밋', () => {
  assert.equal(AP.judge({ target: {}, commits: [] }).status, 'empty');
  const nm = AP.judge({ target: T, commits: [C('1111111aaa', '2026-11-21T00:00:00Z', { 'a.md': 'b0', 'gone.md': 'g' })] });
  assert.equal(nm.status, 'not_merged'); assert.match(nm.reasons[0], /0\/2 파일이 같음/);
  const two = AP.judge({ target: T, commits: [C('2222222bbb', '2026-11-21T00:00:00Z', { 'a.md': 'b1' }), C('3333333ccc', '2026-11-21T01:00:00Z', { 'a.md': 'b1' })], facts: { '2222222bbb': F() }, humans: H });
  assert.equal(two.status, 'approved'); assert.equal(two.commit, '2222222bbb', '처음 나타난 커밋');
  // 지운 파일은 main 에도 없어야 같다
  assert.equal(AP.judge({ target: T, commits: [C('4444444ddd', '2026-11-21T00:00:00Z', { 'a.md': 'b1', 'gone.md': 'g' })] }).status, 'not_merged');
});

test('② 판정 (PLAN-117 끝나는 조건): 사실 파일이 없으면 승인 아님 · 봇 병합 → merged_ai · 사람 승인 없이 사람 병합 → unreviewed · 승인 뒤 커밋 추가 → 승인 아님 · 사람 승인 + 사람 병합 + 지문 일치 → approved', () => {
  const at = (facts) => AP.judge({ target: T, commits: [C('5555555eee', '2026-11-21T00:00:00Z', { 'a.md': 'b1' })], facts, humans: H });
  assert.equal(at(null).status, 'no_facts', '사실 파일 없음');
  assert.equal(at({}).status, 'no_facts', '그 커밋의 사실 없음');
  assert.equal(at({ '5555555eee': null }).status, 'no_pr', 'PR 없는 커밋(직접 push)');
  assert.equal(at({ '5555555eee': F({ merged_by: 'daduteria' }) }).status, 'merged_ai', '봇이 병합');
  assert.equal(at({ '5555555eee': F({ reviews: [] }) }).status, 'unreviewed', '사람 승인 없이 사람 병합');
  assert.equal(at({ '5555555eee': F({ head: 'h2' }) }).status, 'unreviewed', '승인 뒤 커밋 추가 — 승인은 옛 머리 h1');
  assert.equal(at({ '5555555eee': F({ reviews: [{ user: 'daduteria', state: 'APPROVED', commit_id: 'h1' }] }) }).status, 'unreviewed', '봇의 승인 리뷰는 세지 않음');
  assert.equal(at({ '5555555eee': F({ author: 'Duckiteat' }) }).status, 'unreviewed', 'PR 작성자 자신의 승인은 세지 않음');
  assert.equal(at({ '5555555eee': F({ reviews: [{ user: 'Duckiteat', state: 'COMMENTED', commit_id: 'h1' }] }) }).status, 'unreviewed', '승인이 아닌 리뷰');
  const ok = at({ '5555555eee': F() });
  assert.equal(ok.status, 'approved'); assert.match(ok.reasons.join(' '), /PR #26 — Duckiteat 가 병합 · Duckiteat 가 머리 커밋 h1 을 승인/);
  assert.equal(AP.judgeFacts(F(), []).status, 'merged_ai', '사람 계정 목록이 비면 아무도 사람이 아님');
});

test('③ 판정: 영수증의 AI 병합 호출은 보조 표시만 — 판정은 GitHub 사실이 정한다', () => {
  const commits = [C('6666666fff', '2026-11-02T20:02:41Z', { 'a.md': 'b1' })];
  const near = AP.judge({ target: T, commits, aiMerges: [{ at: '2026-11-02T20:02:42.757Z', receipt: '2026-11-02-c26eef5a-878' }], facts: { '6666666fff': F({ merged_by: 'daduteria' }) }, humans: H });
  assert.equal(near.status, 'merged_ai'); assert.match(near.reasons.join(' '), /보조\(판정에 안 씀\): 영수증 2026-11-02-c26eef5a-878/);
  const far = AP.judge({ target: T, commits, aiMerges: [{ at: '2026-11-01T10:00:00Z', receipt: 'x' }], facts: { '6666666fff': F() }, humans: H });
  assert.equal(far.status, 'approved'); assert.doesNotMatch(far.reasons.join(' '), /보조/);
});

test('④ 계산된 상태: 넘기기 전 · 승인 대기 · 반영 중 · 완료 · 막힘은 그대로', () => {
  const sup = (runs, extra = {}) => ({ state: 'running', active: null, steps: ['author', 'inspect', 'baseline'], runs, ...extra });
  const h = (run, mode) => ({ run, mode, result: 'handed_off' });
  const ok = { status: 'approved', text: AP.STATUS.approved, commit: 'c' };
  assert.equal(AP.derive(sup([h('S/r1', 'author')]), ok).state, 'running');
  assert.equal(AP.derive(sup([h('S/r1', 'author'), h('S/r2', 'inspect')]), { status: 'not_merged', text: 'x' }).state, 'awaiting_approval');
  for (const st of ['merged_ai', 'unreviewed', 'no_pr', 'no_facts']) assert.equal(AP.derive(sup([h('S/r1', 'author'), h('S/r2', 'inspect')]), { status: st, text: 'x' }).state, 'awaiting_approval', `${st} 는 승인 아님`);
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

test('⑤ 사실 모으기: 병합 전 → 스쿼시로 main 에 들어가면 병합 확인 · GitHub 사실이 없으면 승인 아님', () => {
  const r = repo();
  try {
    assert.equal(SV.evidence(supOf(r), r.dir).verdict.status, 'not_merged');
    assert.equal(SV.evidence(supOf(r), r.dir).derived.state, 'awaiting_approval');
    r.w('a.md', 'v1\n'); r.w('b.md', 'new\n'); r.g('add', '-A'); r.g('commit', '-q', '-m', 'squash of work');
    const e = SV.evidence(supOf(r), r.dir);
    assert.equal(e.verdict.status, 'no_facts'); assert.equal(e.files, 2); assert.equal(e.derived.state, 'awaiting_approval');
  } finally { rmSync(r.dir, { recursive: true, force: true }); }
});

test('⑥ 사실 모으기: 사람 승인 + 사람 병합 사실이 있는 병합 커밋은 승인 · 그 뒤 바뀌어도 처음 나타난 커밋', () => {
  const r = repo();
  try {
    r.g('merge', '-q', '--no-ff', '-m', 'merge work', 'work');
    const at = r.g('rev-parse', 'HEAD');
    r.w('a.md', 'v2 later\n'); r.g('add', '-A'); r.g('commit', '-q', '-m', 'later change');
    const e = SV.evidence(supOf(r), r.dir, { [at]: F() });
    assert.equal(e.verdict.status, 'approved'); assert.equal(e.verdict.commit, at); assert.equal(e.derived.state, 'completed', 'baseline 단계가 없는 상위 작업');
    assert.equal(SV.evidence(supOf(r), r.dir, { [at]: F({ merged_by: 'daduteria' }) }).verdict.status, 'merged_ai');
  } finally { rmSync(r.dir, { recursive: true, force: true }); }
});

test('⑦ CI 의 승인 판정 (verdicts): 이 push 의 PR 병합이 사람 승인이 아니면 종료 1 · PR 없는 push 는 0 · 상위 작업 줄', () => {
  const r = repo();
  try {
    r.g('merge', '-q', '--no-ff', '-m', 'merge work', 'work');
    const at = r.g('rev-parse', 'HEAD');
    const ok = SV.verdicts([supOf(r)], { [at]: F() }, [at], r.dir);
    assert.equal(ok.exit, 0); assert.match(ok.text, /\| 이 push \| [0-9a-f]{7} \| approved \|/); assert.match(ok.text, /\| SUP-0001 \| [0-9a-f]{7} \| approved \| 계산된 상태 completed \|/);
    assert.equal(SV.verdicts([], { [at]: F({ reviews: [] }) }, [at], r.dir).exit, 1, '사람 승인 없는 병합은 main 에서 빨개짐');
    assert.equal(SV.verdicts([], { [at]: F({ merged_by: 'daduteria' }) }, [at], r.dir).exit, 1);
    assert.equal(SV.verdicts([], { [at]: null }, [at], r.dir).exit, 0, 'PR 없는 push(사람의 직접 커밋)는 알리기만');
    assert.equal(SV.verdicts([], {}, [at], r.dir).exit, 0, '사실을 못 모은 커밋은 no_facts — 빨개지지 않고 보임');
  } finally { rmSync(r.dir, { recursive: true, force: true }); }
});
