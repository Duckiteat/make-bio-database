// 감독 장부 (PLAN-100 · docs/design/supervisor.md) — 접기의 결정성 · 금지 전이 · 중복 실행 · 승인 사건 거부 · 두 브랜치 합치기 · 서기
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import * as SV from '../rebuild/supervise.mjs';
import * as CLERK from '../legislative/clerk.mjs';

const R = { items: new Set(['PLAN-103']), decisions: new Set(['DEC-0066', 'DEC-0068']), transitions: new Set([8, 11, 12]), files: () => true };
const A = { tag: 'aaaa1111-aaa', mode: 'author', executor: 'claude-code', enforcement: { hooks: true, receipts: true } };
const I = { tag: 'bbbb2222-bbb', mode: 'inspect', executor: 'claude-code', enforcement: { hooks: true, receipts: true } };
const PROP = { plan_item: 'PLAN-103', purpose: 'cAMP 출처 보강 첫 순환', inputs: { transitions: [8], files: [], ids: ['D900050'] }, steps: ['author', 'inspect', 'baseline'], done_when: '출처 · 판정 · baseline', decision: 'DEC-0066', why: '첫 순환' };
let clock = 0;
const t = () => new Date(Date.UTC(2026, 10, 21, 0, 0, clock++)).toISOString();
// 사건을 차례로 받아들인다 — 하나라도 거부되면 실패
function run(steps) {
  const evs = [];
  for (const [ev, input, who] of steps) { const r = SV.admit(evs, ev, input, who, R, t()); assert.ok(r.event, `${ev}: ${(r.errors || []).join(' · ')}`); evs.push(r.event); }
  return evs;
}
const reject = (evs, ev, input, who, re) => { const r = SV.admit(evs, ev, input, who, R, t()); assert.ok(r.errors, `${ev} 가 받아들여짐`); assert.match(r.errors.join(' · '), re); };

test('① 한 바퀴: propose → author start → handoff → inspect start (다른 세션) — 상태와 실행 기록', () => {
  const evs = run([
    ['propose', PROP, A],
    ['start', { sup: 'SUP-0001', branch: 'ccr-x' }, A],
    ['handoff', { sup: 'SUP-0001', transition_seq: 11, verify: { finish: 'pass' }, outputs: { commits: ['abcdef1'] }, why: '출처 달기 끝' }, A],
    ['start', { sup: 'SUP-0001', branch: 'ccr-x' }, I],
  ].map(([ev, input, who]) => [ev, { why: '시험', ...input }, who]));
  const s = SV.fold(evs, R);
  assert.deepEqual(s.errors, []);
  const sup = s.sups[0];
  assert.equal(sup.id, 'SUP-0001'); assert.equal(sup.state, 'running'); assert.equal(sup.active, 'SUP-0001/r2');
  assert.deepEqual(sup.runs.map((r) => [r.run, r.mode, r.session, r.result]), [['SUP-0001/r1', 'author', A.tag, 'handed_off'], ['SUP-0001/r2', 'inspect', I.tag, 'running']]);
  assert.deepEqual(evs.map((e) => e.id), [`${A.tag}-1`, `${A.tag}-2`, `${A.tag}-3`, `${I.tag}-1`]);
  assert.deepEqual(sup.runs[0].enforcement, { hooks: true, receipts: true });
});

test('② 접기는 결정적 — 줄 순서를 섞어도 같은 상태 (두 브랜치를 합쳐 줄이 섞여도)', () => {
  const evs = run([['propose', PROP, A], ['start', { sup: 'SUP-0001', branch: 'b', why: 'x' }, A], ['block', { sup: 'SUP-0001', cause: 'DATA_GAP', why: '출처 없음' }, A]]);
  const a = JSON.stringify(SV.fold(evs, R)), b = JSON.stringify(SV.fold([evs[2], evs[0], evs[1]], R));
  assert.equal(a, b);
  assert.equal(SV.fold(evs, R).sups[0].state, 'blocked');
});

test('③ 승인 사건 · 모르는 사건 · 범위 칸 · 승인자 칸 · 누가 칸을 입력으로 — 모두 거부', () => {
  const evs = run([['propose', PROP, A]]);
  reject(evs, 'approve', { sup: 'SUP-0001', why: 'x' }, A, /승인 사건은 없다/);
  reject(evs, 'start', { sup: 'SUP-0001', branch: 'b', why: 'x', scope: ['**'] }, A, /받지 않는 칸 scope/);
  reject(evs, 'start', { sup: 'SUP-0001', branch: 'b', why: 'x', approved_by: 'human' }, A, /받지 않는 칸 approved_by/);
  reject(evs, 'start', { sup: 'SUP-0001', branch: 'b', why: 'x', enforcement: { hooks: true, receipts: true } }, A, /받지 않는 칸 enforcement/);
  reject(evs, 'start', { sup: 'SUP-0001', branch: 'b', why: 'x', by: { executor: 'human', session: 'x' } }, A, /받지 않는 칸 by/);
  // 장부에 직접 끼워 넣은 승인 줄도 검사가 잡는다
  const forged = { id: `${A.tag}-2`, at: t(), ev: 'approve', sup: 'SUP-0001', by: { executor: 'human', session: A.tag }, why: 'x' };
  assert.match(SV.check([...evs, forged], R).join(' · '), /모르는 사건 'approve'/);
});

test('④ 금지 전이 — 중복 실행 · 진행 중 아닌 실행의 넘김 · 다른 세션이 넘김 · 모드 불일치 · 검사 미통과 넘김', () => {
  const evs = run([['propose', PROP, A], ['start', { sup: 'SUP-0001', branch: 'b', why: 'x' }, A]]);
  reject(evs, 'start', { sup: 'SUP-0001', branch: 'b', why: 'x' }, A, /중복 실행/);
  reject(evs, 'handoff', { sup: 'SUP-0001', transition_seq: 11, verify: { finish: 'pass' }, outputs: { commits: ['abcdef1'] }, why: 'x' }, I, /시작한 세션.*만/);
  reject(evs, 'handoff', { sup: 'SUP-0001', transition_seq: 11, verify: { finish: 'fail' }, outputs: { commits: ['abcdef1'] }, why: 'x' }, A, /verify\.finish/);
  reject(evs, 'handoff', { sup: 'SUP-0001', transition_seq: 99, verify: { finish: 'pass' }, outputs: { commits: ['abcdef1'] }, why: 'x' }, A, /전환 기록에 없음/);
  reject(evs, 'start', { sup: 'SUP-0002', mode: 'develop', branch: 'b', why: 'x' }, A, /열린 모드 'author' 와 다름/);
  reject(evs, 'cancel', { sup: 'SUP-0001', why: 'x' }, A, /결정 번호/);
});

test('⑤ 독립성 — author 를 한 세션(하위 에이전트 포함 같은 세션)은 inspect 를 못 함 · 재시도 한도', () => {
  const sameInspect = { ...I, tag: A.tag };
  const evs = run([['propose', PROP, A], ['start', { sup: 'SUP-0001', branch: 'b', why: 'x' }, A], ['handoff', { sup: 'SUP-0001', transition_seq: 11, verify: { finish: 'pass' }, outputs: { commits: ['abcdef1'] }, why: 'x' }, A]]);
  reject(evs, 'start', { sup: 'SUP-0001', branch: 'b', why: 'x' }, sameInspect, /독립 검토가 아님/);
  // 같은 모드 세 번 뒤 넷째는 거부 (처음 1 + 재시도 2)
  const steps = [['propose', PROP, A]];
  for (let k = 0; k < 3; k++) steps.push(['start', { sup: 'SUP-0001', branch: 'b', why: 'x', ...(k ? { decision: 'DEC-0066' } : {}) }, A], ['block', { sup: 'SUP-0001', cause: 'EXEC_FAILURE', why: '실패' }, A]);
  const evs2 = run(steps);
  reject(evs2, 'start', { sup: 'SUP-0001', branch: 'b', why: 'x', decision: 'DEC-0066' }, A, /재시도 한도/);
  // 막힌 뒤에는 결정 번호 없이 못 다시 시작
  reject(evs2.slice(0, 3), 'start', { sup: 'SUP-0001', branch: 'b', why: 'x' }, A, /사용자 결정 번호/);
});

test('⑥ 두 브랜치가 같은 상위 작업 번호를 만들면 검사가 잡고, 사건 번호는 겹치지 않는다', () => {
  const left = run([['propose', PROP, A]]);
  const right = run([['propose', { ...PROP, purpose: '다른 일' }, I]]);
  assert.equal(left[0].sup, 'SUP-0001'); assert.equal(right[0].sup, 'SUP-0001');
  assert.notEqual(left[0].id, right[0].id);
  assert.match(SV.check([...left, ...right], R).join(' · '), /SUP-0001 가 이미 있음 — 번호 겹침/);
});

test('⑦ 계획 장부 · 전환 기록 대조 — 없는 작업 · 없는 결정 · 차례 빠짐', () => {
  reject([], 'propose', { ...PROP, plan_item: 'PLAN-999' }, A, /계획 작업 'PLAN-999'/);
  reject([], 'propose', { ...PROP, decision: 'DEC-9999' }, A, /결정 'DEC-9999'/);
  reject([], 'propose', { ...PROP, steps: ['qa'] }, A, /steps/);
  const evs = run([['propose', PROP, A], ['start', { sup: 'SUP-0001', branch: 'b', why: 'x' }, A]]);
  assert.match(SV.check([evs[1]], R).join(' · '), /상위 작업 SUP-0001 가 없음|차례/);
  assert.match(SV.check([evs[0], { ...evs[1], id: `${A.tag}-5` }], R).join(' · '), /차례가 1…2 가 아님/);
});

test('⑧ 서기 — 한 줄짜리 사건만 끝에 붙인다', () => {
  const root = mkdtempSync(join(tmpdir(), 'sv-'));
  try {
    assert.throws(() => CLERK.appendSupervise(['a\nb'], root), /한 줄짜리/);
    assert.throws(() => CLERK.appendSupervise([], root), /한 줄짜리/);
    CLERK.appendSupervise(['{"x":1}'], root); CLERK.appendSupervise(['{"x":2}'], root);
    assert.equal(readFileSync(join(root, CLERK.SUPERVISE), 'utf8'), '{"x":1}\n{"x":2}\n');
    assert.deepEqual(SV.load(root).map((e) => e.x), [1, 2]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
