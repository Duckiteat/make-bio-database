// 도장 등록부 정책 (PLAN-116 G3 · DEC-0078) — 모드마다 낼 수 있는 도장 종류만 · 승인 도장은 누구도 지우거나 바꾸지 못함 · CI 구역 점검에서 실제 커밋으로
//   도장은 합성(O9…) — 실제 등록부는 읽지 않는다. 모드표는 지금 것에 stamps 를 더한 사본(임시 저장소 안)만 쓴다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import * as Z from '../rebuild/ci-zone.mjs';

const ATT = createRequire(import.meta.url)('../judicial/attestation.js');
const ROOT = new URL('..', import.meta.url).pathname;
const st = (claim, sense, extra = {}) => ({ subject: { sense, field: claim === 'accept' ? 'accept' : 'xref', ns: claim === 'accept' ? 'evidence' : 'ChEBI', value: sense }, claim, issued_at: '2026-01-01', ...extra });
const REG = { format: 'attestations', stamps: [st('verified', 'D900001'), st('trend', 'D900002'), st('accept', 'O900001', { by: 'integrator', reason: 'x' })] };
const plus = (...s) => ({ ...REG, stamps: [...REG.stamps, ...s] });
const AUTHOR = ['verified', 'trend'], INSPECT = ['accept'];

test('① 판정: author 는 승인 도장을 낼 수 없고 inspect 는 신원 · 추세 도장을 낼 수 없다', () => {
  const forged = st('accept', 'O900002', { by: 'integrator', reason: '위조' });
  assert.equal(ATT.registryPolicy(REG, plus(forged), AUTHOR).length, 1, 'author 의 승인 도장 = 위반');
  assert.equal(ATT.registryPolicy(REG, plus(forged), INSPECT).length, 0, 'inspect 의 승인 도장 = 통과');
  assert.equal(ATT.registryPolicy(REG, plus(st('trend', 'D900003')), INSPECT).length, 1, 'inspect 의 추세 도장 = 위반 (DEC-0078 — 추세는 author 만)');
  assert.equal(ATT.registryPolicy(REG, plus(st('verified', 'D900003')), AUTHOR).length, 0);
});

test('② 판정: 승인 도장은 어느 모드도 지우거나 바꾸지 못함 — 모드표에 정책이 없어도', () => {
  const del = { ...REG, stamps: REG.stamps.filter((s) => s.claim !== 'accept') };
  for (const kinds of [AUTHOR, INSPECT, null]) assert.ok(ATT.registryPolicy(REG, del, kinds).some((v) => /승인 도장은 추가만/.test(v.msg)), String(kinds));
  const edited = { ...REG, stamps: REG.stamps.map((s) => (s.claim === 'accept' ? { ...s, reason: '고침' } : s)) };
  assert.ok(ATT.registryPolicy(REG, edited, INSPECT).length, '승인 도장 이유 고치기 = 위반 (철회는 revoked 도장을 새로)');
  assert.equal(ATT.registryPolicy(REG, plus(st('accept', 'O900001', { by: 'integrator', reason: '철회', verdict: 'revoked' })), INSPECT).length, 0, '철회 도장 덧붙이기는 됨');
});

test('③ 판정: 서기의 갈아 끼우기(같은 주체 · 같은 종류)는 됨 — 그냥 지우기와 남의 종류 지우기는 위반', () => {
  const swap = { ...REG, stamps: REG.stamps.map((s) => (s.claim === 'verified' ? { ...s, issued_at: '2026-02-01' } : s)) };
  assert.equal(ATT.registryPolicy(REG, swap, AUTHOR).length, 0);
  const gone = { ...REG, stamps: REG.stamps.filter((s) => s.claim !== 'verified') };
  assert.ok(ATT.registryPolicy(REG, gone, AUTHOR).some((v) => /갈아 끼울 때만/.test(v.msg)));
  assert.ok(ATT.registryPolicy(REG, gone, INSPECT).some((v) => /밖/.test(v.msg)), 'inspect 가 신원 도장을 지움');
  assert.equal(ATT.registryPolicy(REG, REG, []).length, 0, '그대로면 어느 모드든 통과');
});

const open = (mode) => JSON.stringify({ at: '2026-01-01T00:00:00Z', t: 'open', mode, role: null, prev: null }) + '\n';
function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'rp-')), g = (...a) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd: dir, encoding: 'utf8' });
  const put = (p, t) => { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), t); };
  const commit = (m) => { g('add', '-A'); g('commit', '-qm', m); return g('rev-parse', 'HEAD').trim(); };
  const M = JSON.parse(readFileSync(join(ROOT, 'rebuild/rules/modes.json'), 'utf8'));
  M.gate.modes.author.stamps = AUTHOR; M.gate.modes.inspect.stamps = INSPECT; // DEC-0078 의 정책을 단 사본
  g('init', '-q', '-b', 'main'); put('rebuild/rules/modes.json', JSON.stringify(M, null, 2)); put('attestations/registry.json', JSON.stringify(REG, null, 2));
  return { dir, put, commit, base: commit('base') };
}

test('④ CI 구역 점검 (실제 커밋): author 선언으로 승인 도장을 더하면 종료 1 · inspect 선언이면 통과 · 정책 없는 판에서도 승인 도장 지우기는 거부', () => {
  const r = setup();
  try {
    const forged = st('accept', 'O900002', { by: 'integrator', reason: '위조' });
    r.put('workspace/receipts/a.jsonl', open('author')); r.put('attestations/registry.json', JSON.stringify(plus(forged), null, 2)); const bad = r.commit('author 가 승인 도장을 씀');
    let res = Z.zoneCheck(r.base, 'HEAD', r.dir);
    assert.equal(res.exit, 1); assert.equal(res.commits.find((x) => x.c === bad).status, 'violation');
    assert.match(res.lines.join('\n'), /도장 등록부 정책 밖/);
    const r2 = setup();
    try {
      r2.put('workspace/receipts/i.jsonl', open('inspect')); r2.put('attestations/registry.json', JSON.stringify(plus(forged), null, 2)); r2.commit('inspect 의 승인 도장');
      assert.equal(Z.zoneCheck(r2.base, 'HEAD', r2.dir).exit, 0);
      // 모드표에 stamps 가 없는 판 — 승인 도장 지우기만은 여전히 잡힌다
      const M = JSON.parse(readFileSync(join(r2.dir, 'rebuild/rules/modes.json'), 'utf8')); delete M.gate.modes.inspect.stamps; delete M.gate.modes.author.stamps;
      r2.put('rebuild/rules/modes.json', JSON.stringify(M, null, 2)); r2.put('workspace/receipts/h.jsonl', ''); const mid = r2.commit('정책 없는 판');
      r2.put('workspace/receipts/i2.jsonl', open('inspect')); r2.put('attestations/registry.json', JSON.stringify(REG, null, 2)); r2.commit('승인 도장 지움');
      const res2 = Z.zoneCheck(mid, 'HEAD', r2.dir);
      assert.equal(res2.exit, 1); assert.match(res2.lines.join('\n'), /승인 도장은 추가만/);
    } finally { rmSync(r2.dir, { recursive: true, force: true }); }
  } finally { rmSync(r.dir, { recursive: true, force: true }); }
});

test('⑤ 새 승인 도장의 승인자는 발급 검사와 같은 목록(integrator)만 — inspect 의 셸 by: human 위조 거부 · 정상 발급 · 옛 도장은 보지 않음 · CI 실제 커밋 (DEC-0083 · RULE-0546)', () => {
  const ACC = createRequire(import.meta.url)('../judicial/acceptance.js');
  assert.deepEqual(ACC.ISSUE_APPROVERS, ['integrator'], '발급 검사와 같은 목록을 쓴다');
  const human = st('accept', 'O900003', { by: 'human', reason: '위조', verdict: 'approved' });
  const integ = st('accept', 'O900003', { by: 'integrator', reason: '정상', verdict: 'approved' });
  assert.ok(ATT.registryPolicy(REG, plus(human), INSPECT).some((v) => v.rule === 'RULE-0546'), 'inspect 의 by: human = 거부');
  assert.ok(ATT.registryPolicy(REG, plus(human), null).some((v) => v.rule === 'RULE-0546'), '모드표에 정책이 없어도 거부');
  assert.equal(ATT.registryPolicy(REG, plus(integ), INSPECT).length, 0, 'integrator 의 정상 발급은 통과');
  const old = { ...REG, stamps: [...REG.stamps, st('accept', 'O900004', { by: 'human', reason: '옛 도장', verdict: 'approved' })] };
  assert.equal(ATT.registryPolicy(old, old, INSPECT).length, 0, '이미 있던 by: human 도장은 다시 판정하지 않음 (U2)');
  assert.equal(ATT.registryPolicy(old, { ...old, stamps: [...old.stamps, integ] }, INSPECT).length, 0, '옛 도장 곁에 새 정상 도장');
  const r = setup();
  try {
    r.put('workspace/receipts/i.jsonl', open('inspect')); r.put('attestations/registry.json', JSON.stringify(plus(human), null, 2)); r.commit('inspect 가 셸로 by human 승인 도장');
    const res = Z.zoneCheck(r.base, 'HEAD', r.dir);
    assert.equal(res.exit, 1); assert.match(res.lines.join('\n'), /승인자 'human'/);
  } finally { rmSync(r.dir, { recursive: true, force: true }); }
});
