// 혼성 확률 층 (4단계 ④) — engine/fate_engine.js (stochastic) · engine/rng.js · judicial/stoch_audit.js · orchestrator 앙상블
//   ① 해석해: 출생–사멸 계의 시각 t 분포 = Binomial(N₀, e^{−γt}) ⊛ Poisson(λ(1 − e^{−γt})) — 정확 SSA 영역·τ-도약 영역 모두 (χ²·이산 AD)
//   ② 정확 SSA 대 τ-도약 두 표본 (같은 계, 방식만 강제) ③ 결정론 극한: Ω 를 키우면 평균이 결정론으로
//   ④ 재현·정수 발화·원장 (사법부 감사) ⑤ 결정론 경로 불변 (stochastic 이 없으면 확률 원자료 없음) ⑥ 구간 안 승격 (폭주 방지)·완충 저장소 고갈
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const C = req('../core.js'), F = req('../engine/fate_engine.js'), S = req('../judicial/stats.js'), SA = req('../judicial/stoch_audit.js'), ORCH = req('../orchestrator.js'), RNG = req('../engine/rng.js');
const ROOT = new URL('..', import.meta.url);
const BASE = C.normalize(JSON.parse(readFileSync(new URL('data/db.json', ROOT), 'utf8')));
const BD = JSON.parse(readFileSync(new URL('examples/scenarios/stochastic-birth-death-hypothetical.json', ROOT), 'utf8'));
const B = 'D000165|nucleoplasm', HL = 3600, G = Math.LN2 / HL, NAV = 6.02214076e23 * 1e-13;
const bd = (lam, N0, extra) => { const sc = JSON.parse(JSON.stringify(BD)); sc.amounts[B] = N0; sc.kinetics['D000165/rule/synthesis'].k = (lam * G) / NAV; return Object.assign(sc, extra || {}); };
const finals = (raws) => raws.map((r) => r.final.N[B]);
// 정확한 분포 pmf
function exactPmf(lam, N0, t, K) {
  const p = Math.exp(-G * t), mu = lam * (1 - p), lnC = (n, k) => S.lnGamma(n + 1) - S.lnGamma(k + 1) - S.lnGamma(n - k + 1);
  const pmf = new Array(K + 1).fill(0);
  for (let a = 0; a <= N0; a++) { const ba = N0 ? Math.exp(lnC(N0, a) + a * Math.log(p) + (N0 - a) * Math.log(1 - p)) : 1; if (ba < 1e-300) continue; for (let b = 0; a + b <= K; b++) pmf[a + b] += ba * Math.exp(-mu + b * Math.log(mu) - S.lnGamma(b + 1)); }
  return pmf;
}
const counts = (xs, K) => { const c = new Array(K + 1).fill(0); for (const x of xs) c[Math.min(K, x)]++; return c; };

test('① 해석해: 출생–사멸 — 정확 SSA 영역(λ 50, N₀ 0)·τ-도약 영역(λ 2000, N₀ 1000)', () => {
  for (const [lam, N0, n, want] of [[50, 0, 200, 'ssa'], [2000, 1000, 160, 'leap']]) {
    const raws = ORCH.runEnsemble(BASE, 'D000174', bd(lam, N0), n, { commitment: false });
    assert.ok(raws.every((r) => r.stochastic.rules.some((x) => x.ref === 'D000165/rule/synthesis' && x.mode === want)), `${want} 영역이어야 함`);
    const xs = finals(raws); assert.ok(xs.every(Number.isInteger), '정수 상태');
    assert.deepEqual(Object.keys(raws[0].firstReach), [], '문턱이 없으면 어느 상태에도 도달하지 않음');
    const K = Math.max(...xs) + 60, pmf = exactPmf(lam, N0, BD.t_end, K), c = counts(xs, K);
    const chi = S.chi2GOF(c, pmf), ad = S.adDiscrete(c, pmf, { boot: 300 });
    assert.ok(chi.p > 0.01 && ad.p > 0.01, `${want}: χ² p ${chi.p}, AD p ${ad.p}`);
  }
});

test('② 방식 비교: 정확 SSA 대 τ-도약 (같은 계, 결합점으로 방식 강제) — 같은 분포', () => {
  const allSsa = bd(150, 100, { stochastic: { seed: 3, ssa_max: 1e9, ode_min: 1e12, fast: 1e12 } });
  const allLeap = bd(150, 100, { stochastic: { seed: 4, ssa_max: 0, ode_min: 1e12, fast: 1e12 } });
  const a = ORCH.runEnsemble(BASE, 'D000174', allSsa, 120, { commitment: false }), b = ORCH.runEnsemble(BASE, 'D000174', allLeap, 120, { commitment: false });
  assert.ok(a[0].stochastic.rules.every((x) => !x.ref.startsWith('D000165') || x.mode === 'ssa') && b[0].stochastic.rules.every((x) => !x.ref.startsWith('D000165') || x.mode === 'leap'));
  const v = SA.compareMethods(a, b, [B], { perm: 300 });
  assert.ok(v.ok, `방식 비교 실패: ${JSON.stringify(v.tests.map((t) => t.p))}`);
});

test('③ 결정론 극한: Ω 1·4·16 — 앙상블 평균과 결정론 궤적의 상대 차가 줄어듦', () => {
  const v = ORCH.ensembleLimit(BASE, 'D000174', bd(20, 10, { t_end: 3600 }), [1, 4, 16], 40, [B]);
  assert.ok(v.decreasing, `줄지 않음: ${JSON.stringify(v.err)}`);
  assert.ok(v.slope < -0.3, `기울기 ${v.slope} (몬테카를로 오차면 ≈ −½)`);
});

test('④ 재현·정수 발화·원장: 같은 (seed, 궤적) → 같은 해시, 다른 궤적 → 다름, 사법부 감사 결함 없음', () => {
  const sc = bd(50, 20), [a] = ORCH.runEnsemble(BASE, 'D000174', sc, 1, { commitment: false }), [a2] = ORCH.runEnsemble(BASE, 'D000174', sc, 1, { commitment: false }), [b] = ORCH.runEnsemble(BASE, 'D000174', sc, 1, { commitment: false, first: 1 });
  assert.ok(SA.reproducible(a, a2).ok);
  assert.equal(SA.reproducible(a, b).ok, false);
  const v = SA.auditTrajectory(BASE, a, { scenario: sc });
  assert.ok(!v.error, v.error);
  assert.deepEqual(v.audit.filter((x) => x.fault === 'ENGINE_DEFECT' || x.fault === 'COMPILER_DEFECT'), []);
  assert.ok(v.verdict.mass.worst <= v.verdict.mass.tolerance && v.verdict.mass.replayWorst <= v.verdict.mass.tolerance, '원장·재생 1e-14');
  // 난수: 같은 (seed, 궤적) 은 같은 수열
  const r1 = RNG.create(5, 2), r2 = RNG.create(5, 2), r3 = RNG.create(5, 3);
  const s1 = Array.from({ length: 5 }, () => r1.uniform()); assert.deepEqual(Array.from({ length: 5 }, () => r2.uniform()), s1); assert.notDeepEqual(Array.from({ length: 5 }, () => r3.uniform()), s1);
});

test('⑤ 결정론 경로: stochastic 이 없으면 확률 원자료가 없고 결정 탐침이 돈다 · 확률 실행은 결정 탐침을 하지 않음', () => {
  const sc = JSON.parse(readFileSync(new URL('examples/scenarios/fate-effector-pulse-long-hypothetical.json', ROOT), 'utf8'));
  const d = F.simulateFate(BASE, 'D000174', { scenario: { ...sc, t_end: 3 * 3600 }, engine: 'js' });
  assert.ok(!('stochastic' in d));
  const s = F.simulateFate(BASE, 'D000174', { scenario: { ...sc, t_end: 3 * 3600, stochastic: { seed: 1 } }, engine: 'js' });
  assert.ok(s.stochastic && s.commitment.every((c) => c.skipped));
  assert.match(F.simulateFate(BASE, 'D000174', { scenario: { ...sc, stochastic: { seed: 1 } }, engine: 'rust' }).error, /JS 기준 구현만/);
});

test('⑥ 구간 안 승격: 0 에서 시작해 구간 안에서 빨라지는 이산 규칙이 결정론으로 올라감 (SSA 폭주 없음)', () => {
  const sc = JSON.parse(readFileSync(new URL('examples/scenarios/fate-mixed-optimal-hypothetical.json', ROOT), 'utf8'));
  const t0 = Date.now(), r = F.simulateFate(BASE, 'D000174', { scenario: { ...sc, t_end: 1800, stochastic: { seed: 2 } }, engine: 'js' });
  assert.ok(r.stochastic.switches >= 1, '전환이 있어야 함');
  assert.ok(Date.now() - t0 < 20000, `느림 ${Date.now() - t0} ms`);
  const modes = Object.fromEntries(r.stochastic.rules.map((x) => [x.ref, x.mode]));
  assert.equal(modes['D000168/rule/export'], 'ode', '젖산 배출은 구간 안에서 결정론으로');
  assert.equal(modes['D000165/rule/synthesis'], 'leap', '표지(수백–수천 분자)는 τ-도약');
  // 완충 저장소도 유한하다: 포도당 철회 — 완충 총량이 바닥난 뒤에도 발화가 음수를 만들지 않고 끝까지 돈다 (고갈 뒤 무한 거부 회귀)
  const g = JSON.parse(readFileSync(new URL('examples/scenarios/fate-effector-glucose-withheld-hypothetical.json', ROOT), 'utf8'));
  const t1 = Date.now(), rg = F.simulateFate(BASE, 'D000174', { scenario: { ...g, t_end: 6 * 3600, stochastic: { seed: 11 } }, engine: 'js' });
  assert.ok(Date.now() - t1 < 30000, `느림 ${Date.now() - t1} ms`);
  assert.ok(rg.events.some((e) => e.type === 'exhausted'), '고갈 사건');
  const v = SA.auditTrajectory(BASE, rg, { scenario: g });
  assert.deepEqual(v.audit.filter((x) => x.fault === 'ENGINE_DEFECT'), [], '음수·원장 결함 없음');
});
