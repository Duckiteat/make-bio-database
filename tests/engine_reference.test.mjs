// 엔진 정답 시험 + 변형 관계 시험 (PLAN-088) — 관문 D(PLAN-030)의 바탕
//   정답 시험: 이산 확률 모형 시험 모음(DSMTS v3.1, Evans · Gillespie · Wilkinson 2008)의 해석해 평균·분산과 대조 — 판정 기준도 DSMTS 의 것:
//     시각마다 Z = √n(X̄ − μ)/σ ∈ [−3, 3] · Y = √(n/2)(S²/σ² − 1) ∈ [−5, 5]. 운명 엔진이 지금 나타낼 수 있는 모형만 —
//     002(이입–사멸: 0차 합성 + 1차 분해). 001(자기 촉매 출생)·003(이량화 — 같은 분자 둘의 결합)·004–005 는 그런 규칙이 자료에 없거나
//     성향 근사(같은 분자 2차는 N² 대 N(N−1))라 대조하지 않는다 — 한계 L000072 ① 에 있음.
//   변형 관계 시험: 정답 없이 단위 · 척도 처리 버그를 잡는다 — 비선형 · 다구획 · 완충 · 신호 · 힐 조절이 다 있는 시나리오에서
//     ① 단위 바꿈(fL → pL) ② 시간 척도(속도 상수 ×α, 시간 ÷α) ③ 부피 척도(Ω — 농도 불변) ④ 반응 나누기(k → f·k + (1−f)·k).
//     2 의 거듭제곱 배율은 IEEE 에서 정확하므로 ②·③ 은 비트까지 같아야 한다 — 어긋나면 어딘가 척도 처리가 새고 있다는 뜻.
import SCN from '../scenarios.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const C = req('../core.js'), F = req('../engine/fate_engine.js'), ORCH = req('../orchestrator.js');
const ROOT = new URL('..', import.meta.url);
const BASE = C.normalize(JSON.parse(readFileSync(new URL('data/db.json', ROOT), 'utf8')));
const BD = SCN.read(new URL('examples/scenarios/stochastic-birth-death-hypothetical.json', ROOT));
const MO = SCN.read(new URL('examples/scenarios/fate-mixed-optimal-hypothetical.json', ROOT));
const B = 'D000165|nucleoplasm', NA = 6.02214076e23, STATE = 'D000174';
const clone = (x) => JSON.parse(JSON.stringify(x));
const run = (sc, db) => F.simulateFate(db || BASE, STATE, { scenario: sc, engine: 'js', commitment: false });
const same = (a, b) => JSON.stringify(a.series) === JSON.stringify(b.series);
// 묶음·시각마다 상대 차의 최댓값 (분모는 max(|a|, |b|, 1 분자))
const relMax = (a, b, f = 1) => {
  let w = 0;
  for (let i = 0; i < a.series.length; i++) for (let j = 0; j < a.keys.length; j++) {
    const u = a.series[i][j], v = b.series[i][j] / f, d = Math.abs(u - v) / Math.max(Math.abs(u), Math.abs(v), 1);
    if (d > w) w = d;
  }
  return w;
};

// ===== 정답 시험: DSMTS-002-01 이입–사멸 (k1 = 1 분자/s, k2 = 0.1 s⁻¹, X0 = 0, t = 1..50 s) =====
//   해석해: X(t) ~ Poisson(μ(t)), μ(t) = (k1/k2)(1 − e^{−k2 t}) — 평균 = 분산 = μ(t)
const K1 = 1, K2 = 0.1, T_END = 50;
const dsmts002 = (stochastic) => {
  const sc = clone(BD);
  sc.volumes = { nucleoplasm: { value: 1, unit: 'fL' } };
  sc.amounts[B] = 0;
  sc.kinetics['D000165/rule/synthesis'].k = K1 / (NA * 1e-15); // 0차: k·N_A·V = k1 분자/s
  sc.kinetics['D000165/rule/turnover'].half_life = Math.LN2 / K2;
  return Object.assign(sc, { t_end: T_END, dt_slow: 1, stochastic });
};
const moments = (raws) => {
  const ki = raws[0].keys.indexOf(B);
  return raws[0].trajectory.map((p, i) => {
    const xs = raws.map((r) => r.series[i][ki]), n = xs.length, m = xs.reduce((a, b) => a + b, 0) / n;
    return { t: p.t, n, xs, m, v: xs.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1), mu: (K1 / K2) * (1 - Math.exp(-K2 * p.t)) };
  });
};

test('정답 ① DSMTS-002-01 (이입–사멸) — 정확 SSA 로 강제하면 시각 1–50 s 모두 Z ∈ [−3, 3] · Y ∈ [−5, 5]', () => {
  // 결합점으로 두 규칙 모두 정확 SSA (기본 결합점은 성향 ≥ 1 s⁻¹ 인 합성을 결정론으로 — 아래 ②)
  const raws = ORCH.runEnsemble(BASE, STATE, dsmts002({ seed: 7, ssa_max: 1e9, ode_min: 1e12, fast: 1e12 }), 300, { commitment: false });
  assert.ok(!raws.error, raws.error);
  assert.ok(raws[0].stochastic.rules.filter((x) => x.ref.startsWith('D000165')).every((x) => x.mode === 'ssa'), '두 규칙 모두 SSA');
  const rows = moments(raws);
  assert.equal(rows.length, T_END, '관찰 격자 1 s');
  for (const r of rows) {
    assert.ok(r.xs.every(Number.isInteger), `t ${r.t}: 정수 상태`);
    const Z = (Math.sqrt(r.n) * (r.m - r.mu)) / Math.sqrt(r.mu), Y = Math.sqrt(r.n / 2) * (r.v / r.mu - 1);
    assert.ok(Math.abs(Z) <= 3, `t ${r.t}: 평균 ${r.m} 대 ${r.mu} — Z ${Z}`);
    assert.ok(Math.abs(Y) <= 5, `t ${r.t}: 분산 ${r.v} 대 ${r.mu} — Y ${Y}`);
  }
});

test('정답 ② DSMTS-002-01 을 기본 결합점으로 — 평균은 맞고 분산은 정상에서 ½ (한계 L000072 ②: 빠른 규칙의 요동을 평균으로)', () => {
  // 합성(성향 1 s⁻¹ ≥ sto_fast)이 결정론이 되면 요동은 사멸에서만 온다 — 선형 잡음 근사로 정상 분산 = μ/2.
  //   이 비가 ½ 에서 벗어나면 혼성 분할이 바뀐 것 — L000072 ② 의 서술을 고친다
  const raws = ORCH.runEnsemble(BASE, STATE, dsmts002({ seed: 7 }), 300, { commitment: false });
  assert.ok(!raws.error, raws.error);
  const syn = raws[0].stochastic.rules.find((x) => x.ref === 'D000165/rule/synthesis');
  assert.equal(syn.mode, 'ode', '기본 결합점에서 합성은 결정론');
  const rows = moments(raws);
  for (const r of rows) assert.ok(Math.abs((Math.sqrt(r.n) * (r.m - r.mu)) / Math.sqrt(r.mu)) <= 3, `t ${r.t}: 평균 ${r.m} 대 ${r.mu}`);
  const tail = rows.filter((r) => r.t >= 40), ratio = tail.reduce((a, r) => a + r.v / r.mu, 0) / tail.length;
  assert.ok(Math.abs(ratio - 0.5) < 0.12, `정상 분산/평균 ${ratio} (선형 잡음 근사 ½)`);
});

// ===== 변형 관계 시험 (결정론, 비선형 다구획 시나리오) =====
const A0 = run(MO);

test('변형 ① 단위 바꿈 — 부피를 fL 대신 pL 로 적어도 같은 궤적 (상대 1e-9)', () => {
  assert.ok(!A0.error, A0.error);
  const sc = clone(MO);
  for (const v of Object.values(sc.volumes)) { v.value /= 1000; v.unit = 'pL'; }
  const b = run(sc);
  // 비트 같음은 기대하지 않는다 — value/1000 이 f64 에서 한 번 더 반올림된다 (≤ 1 ulp 가 궤적에서 ~1e-12)
  assert.ok(relMax(A0, b) < 1e-9, `상대 차 ${relMax(A0, b)}`);
  assert.equal(JSON.stringify(Object.keys(b.firstReach)), JSON.stringify(Object.keys(A0.firstReach)), '같은 상태에 도달');
});

// 속도 상수 ×α · 시간 ÷α (힐 K · 농도 · 분자 수 그대로) — 같은 궤적을 α 배 빠르게. 적분기의 시간 결합점(h0 · h_min · event_tol)도 ÷α
const timeScale = (sc, a) => {
  const x = clone(sc);
  for (const k of Object.values(x.kinetics)) {
    for (const f of ['k', 'kcat', 'k_on', 'k_off']) if (k[f] != null) k[f] *= a;
    if (k.half_life != null) k.half_life /= a;
  }
  x.t_end /= a; x.dt_slow /= a;
  for (const list of Object.values(x.signals || {})) for (const e of list) e.t /= a;
  if (x.arrest_window) x.arrest_window /= a;
  if (x.commitment) { x.commitment.horizon /= a; x.commitment.coarse /= a; }
  x.integrator = Object.assign({}, x.integrator, { h0: 1 / a, h_min: 1e-6 / a });
  x.event_tol = 0.01 / a;
  return x;
};

test('변형 ② 시간 척도 — α = 2 · 1024 는 비트까지 같고, α = 3 은 상대 1e-9 · 도달 시각 ×α', () => {
  for (const a of [2, 1024]) {
    const b = run(timeScale(MO, a));
    assert.ok(same(A0, b), `α ${a}: 2 의 거듭제곱 척도인데 비트가 다름 (상대 ${relMax(A0, b)}) — 시간 척도 처리가 샘`);
    assert.equal(b.firstReach.D000175 * a, A0.firstReach.D000175, `α ${a}: 도달 시각`);
  }
  const b = run(timeScale(MO, 3));
  assert.ok(relMax(A0, b) < 1e-9, `α 3: 상대 차 ${relMax(A0, b)}`);
  assert.ok(Math.abs(b.firstReach.D000175 * 3 - A0.firstReach.D000175) < 1e-6, 'α 3: 도달 시각');
});

test('변형 ③ 부피 척도 Ω — 부피 · 분자 수 ×Ω 이면 농도 궤적 불변: Ω = 2 (절대 허용 오차도 ×Ω) 는 비트까지, Ω = 10 은 허용 오차를 조이면 수렴', () => {
  const s2 = ORCH.scaleScenario(MO, 2);
  s2.integrator = Object.assign({}, s2.integrator, { atol: 2 * 1e-2 }); // 분자 단위 결합점(atol)도 같은 척도로
  const b2 = run(s2);
  assert.ok(relMax(A0, b2, 2) === 0, `Ω 2: 비트가 다름 (상대 ${relMax(A0, b2, 2)}) — 부피 · 농도 환산이 샘`);
  // Ω = 10 (2 의 거듭제곱 아님 · atol 은 그대로): 차이는 수치 오차뿐이어야 한다 — 허용 오차를 조이면(refScenario) 줄어든다
  const s10 = ORCH.scaleScenario(MO, 10), d = relMax(A0, run(s10), 10), dRef = relMax(run(ORCH.refScenario(MO)), run(ORCH.refScenario(s10)), 10);
  assert.ok(d < 1e-5, `Ω 10: 상대 차 ${d}`);
  assert.ok(dRef < d / 10, `Ω 10: 허용 오차를 조이면 ${d} → ${dRef} 로 줄어야 함 (모형 차이가 아니라 수치 차이)`);
});

// 규칙 ref 를 둘로 — 같은 반응 · 같은 조절의 사본을 만들고 속도를 f : 1−f 로 나눈다 (자료 사본에서만, data/ 는 그대로)
const split = (ref, f) => {
  const [sid, , rid] = ref.split('/'), db = clone(BASE), sc = clone(MO), nid = `${rid}_split`, nref = `${sid}/rule/${nid}`;
  const rules = db.senses[sid].rule;
  rules.push(Object.assign(clone(rules.find((q) => q.id === rid)), { id: nid }));
  for (const [s2, se] of Object.entries(db.senses)) for (const m of [...(se.rule || [])]) {
    if (m.type !== 'modulation' || m.target !== ref) continue;
    se.rule.push(Object.assign(clone(m), { id: `${m.id}_split`, target: nref }));
    const mref = `${s2}/rule/${m.id}`;
    if (sc.kinetics[mref]) sc.kinetics[`${s2}/rule/${m.id}_split`] = clone(sc.kinetics[mref]);
  }
  const k = sc.kinetics[ref], k2 = clone(k);
  if (k.k != null) { k2.k = k.k * (1 - f); k.k *= f; } else { k2.half_life = k.half_life / (1 - f); k.half_life /= f; }
  sc.kinetics[nref] = k2;
  sc.extra_rules = [...(sc.extra_rules || []), nref];
  return { db: C.normalize(db), sc, nref };
};

test('변형 ④ 반응 나누기 — 0차 합성(조절 포함) · 1차 대사 규칙을 f : 1−f 두 규칙으로 나눠도 같은 궤적 (상대 1e-9)', () => {
  for (const ref of ['D000165/rule/synthesis', 'D000170/rule/aerobic_glycolysis', 'D000148/rule/lumped_oxidation']) {
    for (const f of [0.5, 0.3]) {
      const { db, sc, nref } = split(ref, f), b = run(sc, db);
      assert.ok(!b.error, b.error);
      assert.ok(b.rules.some((r) => r.ref === nref && r.active), `${nref} 이 켜져야 함`);
      assert.deepEqual(b.keys, A0.keys, '같은 묶음');
      assert.ok(relMax(A0, b) < 1e-9, `${ref} f ${f}: 상대 차 ${relMax(A0, b)}`);
      assert.ok(Math.abs(b.firstReach.D000175 - A0.firstReach.D000175) < 1e-6, `${ref} f ${f}: 도달 시각`);
    }
  }
});
