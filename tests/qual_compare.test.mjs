// 정성 모의 판정 (build-plan 8) — judicial/qual_compare.js · orchestrator.observeQualitative
//   ① 판정 단위: 방향(결정론 분해능 · 앙상블 z) · 효과 없음은 앙상블에서 δ 필요(M1) · 유무 · 단조 · 순서(우연 1/m!) · 교란 검사 실패 = 무효 · 결론은 등록 규약의 검증 세트만
//   ② 우연 기준선: 포아송 이항 P(K ≥ k) 를 손으로 아는 경우와 대조 · 경험적 우연 확률(같은 실행의 다른 읽을 거리)
//   ③ 조정자 결정론: 합성 규칙을 막으면 그 산물이 줄어듦 (교란 차이 검사 통과 · 분해능 = 수치 오차 + 분자 1 개)
//   ④ 조정자 앙상블: 출생–사멸(해석해) — 합성 절반이면 평균이 절반 E(t)/2 만큼 줄어듦, 거의 0 인 교란은 δ 로 효과 없음을 보임
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const QC = req('../judicial/qual_compare.js'), S = req('../judicial/stats.js'), C = req('../core.js'), IRB = req('../compiler/ir_builder.js'), ORCH = req('../orchestrator.js');
const ROOT = new URL('..', import.meta.url), json = (p) => JSON.parse(readFileSync(new URL(p, ROOT), 'utf8'));
const DB = C.normalize(json('data/db.json'));
const Q = (expect, extra) => Object.assign({ kind: 'qualitative', readout: { kind: 'amount', target: 'X|c' }, expect, condition: { species: '9606' } }, extra || {});
const judge = (o, x, y, extra) => QC.judgeQualitative(Object.assign({ o, control: x, perturbed: y, resolution: 1, quantum: 1 }, extra || {}));

test('① 방향: 결정론은 분해능, 앙상블은 z 검정 — 못 보이면 불일치가 아니라 보이지 못함', () => {
  assert.equal(judge(Q('decrease'), { values: [100] }, { values: [90] }).outcome, 'match');
  assert.equal(judge(Q('increase'), { values: [100] }, { values: [90] }).outcome, 'mismatch');
  assert.equal(judge(Q('decrease'), { values: [100] }, { values: [99.5] }).observed, 'no_change', '분자 1 개보다 작은 차이는 방향이 없음');
  assert.equal(judge(Q('no_change'), { values: [100] }, { values: [99.5] }).outcome, 'match');
  const a = Array.from({ length: 30 }, (_, i) => 100 + (i % 5)), b = a.map((v) => v - 10), c = a.map((v, i) => v + (i % 2 ? 0.5 : -0.5));
  assert.equal(judge(Q('decrease'), { values: a }, { values: b }).outcome, 'match');
  const ns = judge(Q('increase'), { values: a }, { values: c });
  assert.equal(ns.outcome, 'not_shown'); assert.equal(ns.detail.mode, 'ensemble');
  // 효과 없음: 앙상블은 δ 없으면 보이지 못함, δ 가 있으면 TOST
  assert.equal(judge(Q('no_change'), { values: a }, { values: c }).outcome, 'not_shown');
  const eq = judge(Q('no_change'), { values: a }, { values: c }, { equivalence: { delta: 2 } });
  assert.equal(eq.outcome, 'match'); assert.ok(eq.detail.tost_p < S.ALPHA);
});

test('① 유무 · 단조 · 순서 · 무효 · 결론 조건', () => {
  assert.equal(judge(Q('present'), { values: [3] }, null).outcome, 'match');
  assert.equal(judge(Q('present'), { values: [0.4] }, null).observed, 'absent', '분자 1 개 미만은 없음');
  assert.equal(judge(Q('absent', { readout: { kind: 'event_time', target: 'CS' } }), { values: [Infinity] }, null).outcome, 'match');
  assert.ok(Math.abs(judge(Q('present'), { values: Array(20).fill(5) }, null).detail.p / 0.5 ** 20 - 1) < 1e-12, '앙상블 유무는 이항 (반반이 우연)');
  const ser = (v) => ({ series: { t: v.map((_, i) => i), v } });
  assert.equal(judge(Q('monotone_increase'), ser([0, 5, 5.5, 9, 20]), null).outcome, 'match', '분해능 안의 흔들림은 단조를 깨지 않음');
  assert.equal(judge(Q('monotone_increase'), ser([0, 5, 2, 9, 20]), null).observed, 'non_monotone');
  assert.equal(judge(Q('monotone_increase'), ser([20, 9, 3]), null).outcome, 'mismatch');
  const ord = Q({ order: ['A', 'B', 'C'] }, { readout: { kind: 'event_time' } });
  assert.equal(QC.chanceOf(ord), 1 / 6);
  assert.equal(judge(ord, { events: [[10, 20, 30]] }, null).outcome, 'match');
  assert.equal(judge(ord, { events: [[10, 30, 20]] }, null).outcome, 'mismatch');
  assert.equal(judge(ord, { events: [[10, 20, Infinity]] }, null).outcome, 'mismatch', '닿지 못한 사건은 순서를 이루지 못함');
  const ens = judge(ord, { events: Array.from({ length: 12 }, (_, i) => (i < 9 ? [1, 3, 5] : [5, 3, 1])) }, null);
  assert.equal(ens.outcome, 'match'); assert.equal(ens.detail.k, 9); assert.ok(Math.abs(ens.detail.p - (1 - S.betaI(12 - 8, 9, 5 / 6))) < 1e-12);
  assert.equal(judge(Q('decrease'), { values: [100] }, { values: [90] }, { perturbationAudit: { ok: false, problems: ['꾸민 배율'] } }).outcome, 'invalid');
  assert.equal(judge(Q('decrease'), { values: [100] }, null).outcome, 'invalid', '대조 비교에 교란군이 없음');
  // 결론: 등록 규약 + 검증 세트의 관찰만
  const pv = { declared: true, ok: true, problems: [], validation: ['O000009'] };
  assert.equal(judge(Q('decrease'), { values: [100] }, { values: [90] }, { protocol: pv, observationId: 'O000009' }).conclusive, true);
  assert.equal(judge(Q('decrease'), { values: [100] }, { values: [90] }, { protocol: pv, observationId: 'O000001' }).conclusive, false);
  assert.match(judge(Q('decrease'), { values: [100] }, { values: [90] }).requirement, /탐색 실행/);
});

test('② 우연 기준선: 포아송 이항 P(K ≥ k)', () => {
  const r = (outcome, chance) => ({ outcome, chance });
  assert.equal(QC.chanceBaseline([r('match', 0.5), r('match', 0.5), r('match', 0.5)]).p_at_least, 1 / 8);
  const b = QC.chanceBaseline([r('match', 1 / 3), r('match', 0.5), r('not_shown', 0.5), r('invalid', 0.5)]);
  assert.ok(Math.abs(b.p_at_least - 1 / 6) < 1e-15); assert.equal(b.n, 2); assert.equal(b.not_judged, 2);
  assert.ok(Math.abs(QC.chanceBaseline([r('match', 1 / 3), r('mismatch', 0.5)]).p_at_least - (1 - (2 / 3) * 0.5)) < 1e-15);
  assert.equal(QC.chanceBaseline([r('not_shown', 0.5)]).p_at_least, null);
  assert.equal(QC.chanceBaseline([r('match', 0.5), r('match', 0.5), r('match', 0.5)]).units, 3, '출처 없는 주장은 각자 한 단위');
});

test('② 증거 독립 (M3·L4): 같은 실험·출처는 한 단위로 묶고 비독립 표시', () => {
  const r = (id, outcome, chance, extra) => Object.assign({ id, outcome, chance }, extra || {});
  // 같은 experiment 두 건 → 1 단위 (모두 맞아야 맞음, chance = 최댓값 0.5)
  const b = QC.chanceBaseline([r('O1', 'match', 1 / 3, { experiment: 'E1' }), r('O2', 'match', 0.5, { experiment: 'E1' }), r('O3', 'match', 0.5, { experiment: 'E2' })]);
  assert.equal(b.n, 3); assert.equal(b.units, 2, '세 건이 두 실험이라 두 단위');
  assert.equal(b.k, 2);
  assert.ok(Math.abs(b.p_at_least - 0.5 * 0.5) < 1e-15, '두 단위 다 맞힐 확률 = 0.5·0.5');
  assert.equal(b.non_independent.length, 1); assert.deepEqual(b.non_independent[0].ids, ['O1', 'O2']);
  // 같은 출처(DOI) 두 건도 한 단위, 한 건이 틀리면 단위는 틀림
  const c = QC.chanceBaseline([r('O4', 'match', 0.5, { source: { db: 'DOI', id: '10.1/x' } }), r('O5', 'mismatch', 0.5, { source: { db: 'DOI', id: '10.1/x' } })]);
  assert.equal(c.units, 1); assert.equal(c.k, 0, '묶음 안 한 건이 틀리면 단위는 맞음 아님');
});

test('② 경험적 우연 확률: 같은 실행의 다른 읽을 거리에 같은 규칙 — 방향은 비율, 순서는 오름 사슬 / 순서쌍', () => {
  const c = (t, x, y) => ({ target: t, control: { values: [x] }, perturbed: { values: [y] }, resolution: 1, quantum: 1 });
  const e = QC.empiricalChance(Q('decrease'), [c('a', 100, 50), c('b', 100, 100), c('c', 100, 150), c('d', 100, 99.5)]);
  assert.equal(e.chance, 1 / 4); assert.equal(e.n, 4); assert.equal(e.source, 'empirical');
  // 순서: 시각 1·3·5 (분해능 1) 에서 m = 2 — 간격 > 1 인 오름 쌍 3 개 / 순서쌍 3·2 = 6
  const ord = Q({ order: ['A', 'B'] }, { readout: { kind: 'event_time' } });
  assert.equal(QC.empiricalChance(ord, [1, 3, 5].map((t, i) => ({ target: 'S' + i, events: [t], resolution: 1 }))).chance, 0.5);
  assert.equal(QC.empiricalChance(ord, [{ target: 'S', events: [1], resolution: 1 }]).chance, null, '후보가 m 개보다 적으면 균등 가정으로');
});

test('③ 조정자 결정론: 합성 규칙을 막으면 산물이 줄어듦 — 교란 차이 검사 통과, 분해능 = 수치 오차 + 분자 1 개', () => {
  const SRC = 'D000202', SC = json('examples/scenarios/mhc-dc-maturation-lps-hypothetical.json'), A = IRB.assemble(DB, SRC, SC);
  const R = A.rules.find((x) => x.k && x.kind !== 'degradation' && x.prods.length === 1 && !x.cons.length && !A.signals.includes(x.prods[0].b));
  const o = (expect) => Q(expect, { perturbation: { type: 'block', target: R.ref }, readout: { kind: 'amount', target: R.prods[0].b } });
  const r = ORCH.observeQualitative(DB, o('decrease'), SRC, SC);
  assert.ok(!r.error, r.error);
  assert.equal(r.outcome, 'match', JSON.stringify(r.detail)); assert.ok(r.perturbation_audit.ok);
  assert.equal(r.quantum, 1); assert.ok(r.detail.resolution >= 1 && r.numerical_error < 1, `수치 오차 ${r.numerical_error}`);
  assert.equal(r.conclusive, false, '규약 없는 실행은 탐색');
  assert.equal(r.chance_source, 'empirical'); assert.ok(r.chance_pool > 5 && r.chance >= 0 && r.chance <= 1); assert.equal(r.chance_uniform, 1 / 3);
  assert.equal(ORCH.observeQualitative(DB, o('increase'), SRC, SC).outcome, 'mismatch');
  // 42: 장치 해상도 — 측정이 못 가르는 차이는 방향으로 읽지 않는다 (수치 분해능 위로 바닥을 올림)
  const oBig = Q('decrease', { perturbation: { type: 'block', target: R.ref }, readout: { kind: 'amount', target: R.prods[0].b, instrument_resolution: 1e18 } });
  const rb = ORCH.observeQualitative(DB, oBig, SRC, SC);
  assert.ok(rb.detail.resolution >= 1e18, '장치 해상도가 분해능 바닥을 올림');
  assert.equal(rb.detail.observed, 'no_change', '장치가 못 가르는 차이는 방향 없음');
});

test('④ 조정자 앙상블: 출생–사멸 해석해 — 합성 절반이면 평균이 E(t)/2 줄어듦, 거의 0 인 교란은 δ 로 효과 없음', () => {
  const BD = json('examples/scenarios/stochastic-birth-death-hypothetical.json'), B = 'D000165|nucleoplasm', RU = 'D000165/rule/synthesis';
  const G = Math.LN2 / 3600, NAV = 6.02214076e23 * 1e-13, lam = (BD.kinetics[RU].k * NAV) / G, E = lam * (1 - Math.exp(-G * BD.t_end)) - 0; // N0 = 0
  const o = (expect, dose) => Q(expect, { perturbation: { type: 'inhibit', target: RU, Ki_M: 1e-6, dose_M: dose }, readout: { kind: 'amount', target: B } });
  const half = ORCH.observeQualitative(DB, o('decrease', 1e-6), 'D000174', BD, { n: 40 });
  assert.ok(!half.error, half.error);
  assert.equal(half.outcome, 'match');
  assert.ok(Math.abs(half.detail.d + E / 2) < 4 * half.detail.se, `차이 ${half.detail.d} · 해석 ${-E / 2} · se ${half.detail.se}`);
  const sc = Object.assign(JSON.parse(JSON.stringify(BD)), { protocol: { equivalence: [{ observable: { kind: 'amount', target: B }, delta: 5 }] } });
  const tiny = ORCH.observeQualitative(DB, o('no_change', 1e-9), 'D000174', sc, { n: 40 });
  assert.equal(tiny.outcome, 'match', JSON.stringify(tiny.detail)); assert.equal(tiny.conclusive, false, '규약이 불완전하면 결론 아님');
});
