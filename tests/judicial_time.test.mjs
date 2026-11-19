// 사법부 시간 · 짝 판정 (PLAN-095) — 해부 2호 §2 · 충분도 판정 A4 · B4
//   ① 독립 시계: 기록 시각을 정수 산술(f64 → 정확한 2 진 유리수, BigInt)로 다시 센 격자와 대조 — 어색한 격자(Δ = 1/3 · 7 s · 짧은 마지막 구간)에서 통과,
//      끝을 넘긴 기록 · 누적 덧셈 시계 · 빠진 기록은 거부, 판결된 보기의 감사와 무결성 증명서에도 들어감
//   ② 벽시계: 같은 두 변형의 비교 판정이 실행 시간(ms)에 흔들리지 않음 — 비용은 결정론적 적분 일(받아들인 + 거부된 단계)
//   ③ 같은 시각 허용치는 관찰 격자 Δ 가 아니라 시각을 찾은 정밀도 — Δ 를 바꿔도 같은 결과, Δ 보다 작은 진짜 차이는 결과가 바뀐 것으로
//   ④ 마지막 짧은 구간 안의 신호 변경 실행에서 무결성 증명서 오탐 없음 (구간 시작 = 앞 기록 시각, T − Δ 가 아님)
//   ⑤ 공통 난수 짝 판정: 짝이 아니면 거부 · 같은 변형이면 차이 없음 · 5 % 효과를 짝 20 궤적으로 보이고(독립 두 표본은 못 봄) · 영 가설(같은 모형의 다른 표기)에서 거짓 양성이 α 수준
import SCN from '../scenarios.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const C = req('../core.js'), F = req('../engine/fate_engine.js'), ORCH = req('../orchestrator.js'), IRB = req('../compiler/ir_builder.js');
const V = req('../judicial/verifier.js'), FA = req('../judicial/fate_audit.js'), PR = req('../judicial/process_report.js'), CMP = req('../judicial/compare.js'), SA = req('../judicial/stoch_audit.js'), ST = req('../judicial/stats.js');
const ROOT = new URL('..', import.meta.url);
const BASE = C.normalize(JSON.parse(readFileSync(new URL('data/db.json', ROOT), 'utf8')));
const MO = SCN.read(new URL('examples/scenarios/fate-mixed-optimal-hypothetical.json', ROOT));
const BD = SCN.read(new URL('examples/scenarios/stochastic-birth-death-hypothetical.json', ROOT));
const IL12 = SCN.read(new URL('examples/scenarios/fate-effector-il12-hypothetical.json', ROOT));
const STATE = 'D000174', B = 'D000165|nucleoplasm', NA = 6.02214076e23;
const clone = (x) => JSON.parse(JSON.stringify(x));
const sc = (base, over) => Object.assign(clone(base), over);
const judged = (s, engine) => { const ir = IRB.buildFateIR(BASE, STATE, s); return FA.judgeFate(BASE, F.simulateFate(BASE, STATE, { scenario: s, ir, engine: engine || 'js', commitment: false }), { scenario: s, ir }); };

// ===== ① 독립 시계 =====
test('① 시계: 어색한 격자 · 짧은 마지막 구간에서 기록 시각 = 정수로 다시 센 격자 (JS · Rust) · 감사와 증명서에 들어감', () => {
  for (const [t_end, dt_slow] of [[3600, 60], [3630, 60], [1000, 1 / 3], [7200, 7]]) {
    for (const engine of ['js', 'rust']) {
      const r = judged(sc(MO, { t_end, dt_slow }), engine);
      assert.ok(r.clock && r.clock.ok, `${engine} t_end ${t_end} Δ ${dt_slow}: ${JSON.stringify(r.clock)}`);
      assert.equal(r.clock.expected, Math.ceil((t_end - 1e-9) / dt_slow), '격자 수');
      assert.ok(!r.audit.some((a) => a.rule === 'RULE-0535'), '시계 감사 없음');
      const chk = PR.processReport(r, { scenario: sc(MO, { t_end, dt_slow }) }).checks.find((c) => /^시계/.test(c.name));
      assert.ok(chk && chk.ok, '증명서의 시계 줄');
    }
  }
});

test('① 시계 거부: 끝을 넘긴 기록 · 누적 덧셈 시계 · 빠진 기록 — 엔진이 그렇게 세면 ENGINE_DEFECT', () => {
  const r = F.simulateFate(BASE, STATE, { scenario: sc(MO, { t_end: 1000, dt_slow: 1 / 3 }), engine: 'js', commitment: false }), T = Array.from(r.process.times);
  const withTimes = (times) => ({ ...r, process: { ...r.process, times } });
  // 옛 결함 K3: 마지막 기록을 격자 K·Δ 에 (t_end 를 넘음)
  const over = sc(MO, { t_end: 3630, dt_slow: 60 }), ro = F.simulateFate(BASE, STATE, { scenario: over, engine: 'js', commitment: false });
  const vOver = V.verifyClock({ ...ro, process: { ...ro.process, times: Array.from(ro.process.times).map((t, i, a) => (i === a.length - 1 ? 3660 : t)) } });
  assert.ok(!vOver.ok && vOver.problems.some((p) => /t_end/.test(p)), JSON.stringify(vOver));
  // 누적 덧셈 시계 (t += Δ) — Δ = 1/3 에서 반올림이 쌓여 정확한 격자에서 2 ulp 넘게 벗어난다
  let acc = 0; const summed = T.map((t, i) => (i === T.length - 1 ? t : (acc += 1 / 3)));
  const vSum = V.verifyClock(withTimes(summed));
  assert.ok(!vSum.ok && vSum.problems.some((p) => /ulp/.test(p)), `누적 덧셈을 잡아야 함: ${JSON.stringify(vSum)}`);
  // 빠진 기록
  assert.ok(!V.verifyClock(withTimes(T.slice(1))).ok, '빠진 기록');
  // 판결된 보기: 시계가 틀린 원자료 → RULE-0535 ENGINE_DEFECT
  const ir = IRB.buildFateIR(BASE, STATE, over), raw = F.simulateFate(BASE, STATE, { scenario: over, ir, engine: 'js', commitment: false });
  raw.process.times[raw.process.times.length - 1] = 3660;
  const j = FA.judgeFate(BASE, raw, { scenario: over, ir });
  assert.ok(j.audit.some((a) => a.rule === 'RULE-0535' && a.fault === 'ENGINE_DEFECT'), '시계 감사');
});

// ===== ② · ③ 비교 검토 =====
const fast = (s) => sc(s, { t_end: 3 * 3600, commitment: { horizon: 3 * 3600, coarse: 3600 } });
let RAW = null;
const raws = () => RAW || (RAW = { a: ORCH.runVariant(BASE, STATE, fast(IL12), { refHours: 0.5 }), b: ORCH.runVariant(BASE, STATE, fast(IL12), { refHours: 0.5 }), c: ORCH.runVariant(BASE, STATE, fast(sc(IL12, { dt_slow: IL12.dt_slow / 2 })), { refHours: 0.5 }) });

test('② 벽시계: 같은 두 변형의 판정은 실행 시간이 10 배 · 1/10 로 흔들려도 같다 (비용 = 적분 일)', () => {
  const { a, b } = raws(), base = CMP.compare(BASE, BASE, a, b);
  assert.equal(base.verdict, 'Neutral', base.why);
  for (const [fa, fb] of [[10, 1], [1, 10], [0.1, 1], [1, 0.1]]) {
    const r = CMP.compare(BASE, BASE, { ...a, ms: a.ms * fa }, { ...b, ms: b.ms * fb });
    assert.equal(r.verdict, base.verdict, `ms ×${fa} · ×${fb}: ${r.why}`);
  }
  assert.equal(base.dWork, 0, '같은 입력이면 적분 일이 같다');
  assert.match(CMP.compareText(base), /진단 — 판정 밖/);
});

test('③ 같은 시각: Δ 를 반으로 줄여도 결과가 같고, Δ 보다 작은(5 s) 도달 시각 차는 결과가 바뀐 것', () => {
  const { a, c } = raws(), r = CMP.compare(BASE, BASE, a, c);
  assert.ok(!r.outcomeChanged, `Δ ${a.run.dt} → ${c.run.dt}: ${r.why}`);
  const s = Object.keys(a.run.firstReach).find((k) => k !== STATE && a.run.firstReach[k] > 0);
  assert.ok(s, '도달한 상태가 있어야 시험이 의미 있음');
  const moved = { ...a, run: { ...a.run, firstReach: { ...a.run.firstReach, [s]: a.run.firstReach[s] + 5 } } };
  assert.ok(5 < a.run.dt, '차이가 Δ 보다 작음');
  assert.ok(CMP.compare(BASE, BASE, a, moved).outcomeChanged, 'Δ 보다 작은 진짜 차이를 덮지 않음');
  const tol = CMP.timeTol(CMP.variant(BASE, a), CMP.variant(BASE, a));
  assert.ok(tol.reach(a.run.firstReach[s]) < 1, `도달 허용치 ${tol.reach(a.run.firstReach[s])} s — 시각을 찾은 정밀도 수준`);
});

// ===== ④ 짧은 마지막 구간의 신호 =====
test('④ 마지막 짧은 구간(3600 → 3630 s) 앞의 신호 변경(3590 s) 실행에서 증명서 오탐 없음', () => {
  const s = sc(MO, { t_end: 3630, dt_slow: 60 }), k = Object.keys(s.signals)[0];
  s.signals[k] = [...s.signals[k], { t: 3590, n: 0 }];
  const r = judged(s), rep = PR.processReport(r, { scenario: s });
  const sig = rep.checks.find((c) => /^신호 = 선언된 일정/.test(c.name));
  assert.ok(sig.ok, sig.detail);
  assert.ok(rep.checks.find((c) => /^시계/.test(c.name)).ok);
});

// ===== ⑤ 공통 난수 짝 판정 =====
const bdK = (f, seed) => { const x = clone(BD); x.kinetics['D000165/rule/synthesis'].k *= f; x.stochastic = { ...x.stochastic, seed }; return x; };
const ens = (s, n, db) => ORCH.runEnsemble(db || BASE, STATE, s, n, { commitment: false });
const trueDiff = (f) => { // 출생–사멸 평균 = (k·N_A·V/γ)(1 − e^{−γt}) + N₀e^{−γt} — 합성 ×f 의 차
  const V = BD.volumes.nucleoplasm.value * 1e-15, g = Math.LN2 / BD.kinetics['D000165/rule/turnover'].half_life, lam = (BD.kinetics['D000165/rule/synthesis'].k * NA * V) / g;
  return (f - 1) * lam * (1 - Math.exp(-g * BD.t_end));
};

test('⑤ 짝 판정: 짝이 아니면 거부 · 같은 변형이면 차이 없음(p = 1)', () => {
  const a = ens(bdK(1, 11), 10), same = ens(bdK(1, 11), 10), other = ens(bdK(1, 12), 10);
  assert.match(SA.pairedCompare(a, other, [B]).error, /짝이 아님/);
  assert.match(SA.pairedCompare(a, same.slice(1), [B]).error, /같은 수/);
  const v = SA.pairedCompare(a, same, [B]);
  assert.ok(!v.error && !v.shown && v.tests[0].p === 1 && v.tests[0].diff === 0);
});

test('⑤ 검정력: 합성 5 % 효과 — 짝 20 궤적이 블록 8 개 중 7 개 이상에서 보이고 독립 두 표본은 2 개 이하 · 구간이 참 차를 덮음', () => {
  const f = 1.05, n = 20, d0 = trueDiff(f);
  let paired = 0, unpaired = 0, covered = 0, ratio = [];
  for (let blk = 0; blk < 8; blk++) {
    const seed = 100 + blk, a = ens(bdK(1, seed), n), b = ens(bdK(f, seed), n), u = ens(bdK(f, 1000 + blk), n);
    const v = SA.pairedCompare(a, b, [B]).tests[0];
    if (v.shown) paired++;
    if (v.ci[0] <= d0 && d0 <= v.ci[1]) covered++;
    ratio.push(v.varianceRatio);
    const xa = a.map((r) => r.final.N[B]), xu = u.map((r) => r.final.N[B]);
    const z = (ST.mean(xu) - ST.mean(xa)) / Math.sqrt(ST.variance(xa) / n + ST.variance(xu) / n);
    if (2 * ST.normSf(Math.abs(z)) < 0.05) unpaired++;
  }
  assert.ok(paired >= 7, `짝 판정 검출 ${paired}/8 (참 차 ${d0.toFixed(2)})`);
  assert.ok(unpaired <= 2, `독립 두 표본 검출 ${unpaired}/8 — 짝의 이득이 보여야 함`);
  assert.ok(covered >= 6, `95 % 구간이 참 차를 덮은 블록 ${covered}/8`);
  assert.ok(ST.mean(ratio) < 0.3, `분산 감소 var(d)/(var A + var B) 평균 ${ST.mean(ratio)}`);
});

test('⑤ 크기: 영 가설(합성 규칙을 0.5 : 0.5 두 규칙으로 — 같은 모형, 다른 난수 흐름)에서 거짓 양성 ≤ 2/10', () => {
  const db = clone(BASE), rules = db.senses.D000165.rule;
  rules.push(Object.assign(clone(rules.find((q) => q.id === 'synthesis')), { id: 'synthesis_split' }));
  const NDB = C.normalize(db);
  const split = (seed) => { const x = bdK(1, seed), k = x.kinetics['D000165/rule/synthesis']; x.kinetics['D000165/rule/synthesis_split'] = { ...clone(k), k: k.k / 2 }; k.k /= 2; x.extra_rules = ['D000165/rule/synthesis_split']; return x; };
  let fp = 0;
  for (let blk = 0; blk < 10; blk++) {
    const seed = 200 + blk, a = ens(bdK(1, seed), 20), b = ens(split(seed), 20, NDB);
    const v = SA.pairedCompare(a, b, [B]);
    assert.ok(!v.error, v.error);
    if (v.shown) fp++;
  }
  assert.ok(fp <= 2, `거짓 양성 ${fp}/10 (α 0.05 — 기대 0.5, P(≥3) ≈ 0.01)`);
});
