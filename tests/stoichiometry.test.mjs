// 화학량 보존 시험 (ASY-15) — 균형은 통과, 불균형은 거부 대상, 조성을 모르면 검사 불가로 수를 센다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { balanceOf, stoichiometryReport } from '../judicial/stoichiometry.js';

const COMP = { glc: { elements: { C: 6, H: 12, O: 6 } }, atp: { elements: { C: 10, H: 12, N: 5, O: 13, P: 3 }, charge: -4 }, adp: { elements: { C: 10, H: 12, N: 5, O: 10, P: 2 }, charge: -3 }, pi: { elements: { H: 1, O: 4, P: 1 }, charge: -2 }, h2o: { elements: { H: 2, O: 1 } }, h: { elements: { H: 1 }, charge: 1 }, o2: { elements: { O: 2 } }, co2: { elements: { C: 1, O: 2 } } };
const compOf = (id) => COMP[id] || null;

test('균형 반응은 통과 — 계수를 곱해 센다 (포도당 연소 · ATP 가수분해는 전하까지)', () => {
  assert.equal(balanceOf({ inputs: [{ id: 'glc' }, { id: 'o2', coef: 6 }], outputs: [{ id: 'co2', coef: 6 }, { id: 'h2o', coef: 6 }] }, compOf).kind, 'balanced');
  assert.equal(balanceOf({ inputs: [{ id: 'atp' }, { id: 'h2o' }], outputs: [{ id: 'adp' }, { id: 'pi' }, { id: 'h' }] }, compOf).kind, 'balanced', 'ATP + H2O → ADP + Pi + H+ (원자 · 전하)');
});

test('불균형은 거부 대상 — 무엇이 얼마나 모자란지 사유에 나온다', () => {
  const r = balanceOf({ inputs: [{ id: 'glc' }, { id: 'o2' }], outputs: [{ id: 'co2' }, { id: 'h2o' }] }, compOf);
  assert.equal(r.kind, 'unbalanced'); assert.ok(r.diff.C !== 0 && r.diff.O !== 0);
  const noCharge = balanceOf({ inputs: [{ id: 'atp' }, { id: 'h2o' }], outputs: [{ id: 'adp' }, { id: 'pi' }] }, compOf);
  assert.equal(noCharge.kind, 'unbalanced', '원자는 맞아도 전하가 어긋나면 불균형'); assert.deepEqual(Object.keys(noCharge.diff), ['H', '+'].filter((k) => noCharge.diff[k]));
});

test('검사 불가: 조성을 모르는 참여자 · 미량 참여자 · 이상한 계수 · 빈 반응 — 통과로 치지 않는다', () => {
  assert.equal(balanceOf({ inputs: [{ id: 'complexX' }, { id: 'h2o' }], outputs: [{ id: 'adp' }] }, compOf).kind, 'uncheckable');
  assert.match(balanceOf({ inputs: [{ id: 'glc' }], outputs: [{ id: 'h2o', minor: true }] }, compOf).why, /미량/);
  assert.equal(balanceOf({ inputs: [{ id: 'glc', coef: 0.5 }], outputs: [{ id: 'glc' }] }, compOf).kind, 'uncheckable');
  assert.equal(balanceOf({ inputs: [], outputs: [] }, compOf).kind, 'uncheckable');
});

test('보고: 균형 · 불균형 · 검사 불가 수가 모두 보이고, 불균형 사유 앞에 규칙 번호', () => {
  const rep = stoichiometryReport({
    ok: { inputs: [{ id: 'glc' }, { id: 'o2', coef: 6 }], outputs: [{ id: 'co2', coef: 6 }, { id: 'h2o', coef: 6 }] },
    bad: { inputs: [{ id: 'glc' }], outputs: [{ id: 'co2' }] },
    unk1: { inputs: [{ id: 'complexX' }], outputs: [{ id: 'h2o' }] },
    unk2: { inputs: [{ id: 'glc' }], outputs: [{ id: 'h2o', minor: true }] },
  }, compOf);
  assert.deepEqual({ total: rep.total, balanced: rep.balanced, uncheckable: rep.uncheckable, unbalanced: rep.unbalanced }, { total: 4, balanced: 1, uncheckable: 2, unbalanced: ['bad'] });
  assert.match(rep.notes[0], /^RULE-0531 bad 원자 · 전하가 맞지 않음: /);
});
