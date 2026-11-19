// 확률 층 성향 — 같은 분자 차수 (PLAN-096, 해부 1호 E5 · 충분도 판정 B6)
//   2A → B 의 정확한 성향은 c·N(N−1) (쌍의 수 N(N−1)/2 × 2) 이고, 결정론 속도식 k·[A]² 를 분자 수로 그대로 세면 c·N² 다 — 분자가 적으면 차이가 크다.
//   ① 정답: 순수 이량화 2A → B (N₀ 20) 앙상블이 화학 주 방정식(CME, 균일화로 푼 정확한 분포)의 N(N−1) 해와 맞고 N² 해와는 다르다 (JS · Rust)
//   ② JS = Rust 비트 (같은 seed · 궤적) — 보정은 두 엔진에서 같은 순서의 산술
//   ③ 결정론 경로는 그대로: 보정은 이산(SSA · 도약) 규칙에만 — 같은 IR 의 결정론 실행은 ff 가 있어도 없어도 비트 같음
//   ④ 컴파일러: ff 는 정수 n ≥ 2 인 질량 작용 반응물에만 (포화 · 미카엘리스–멘텐 · 분해는 없음), 없으면 칸이 없어 IR 해시가 그대로
import SCN from '../scenarios.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const C = req('../core.js'), F = req('../engine/fate_engine.js'), ORCH = req('../orchestrator.js'), IRB = req('../compiler/ir_builder.js'), FA = req('../judicial/fate_audit.js');
const ROOT = new URL('..', import.meta.url);
const RAW = JSON.parse(readFileSync(new URL('data/db.json', ROOT), 'utf8'));
const BD = SCN.read(new URL('examples/scenarios/stochastic-birth-death-hypothetical.json', ROOT));
const NA = 6.02214076e23, V = 1e-15, N0 = 20, CPAIR = 0.01, STATE = 'D000174', A = 'D000165|nucleoplasm', REF = 'D000165/rule/dimerize';
// 자료 사본에 시험용 규칙 2A → B (data/ 는 그대로)
const db = (() => { const d = JSON.parse(JSON.stringify(RAW)); d.senses.D000165.rule.push({ id: 'dimerize', type: 'supply', label: '시험용 2A → B', consumes: [{ ref: 'D000165', n: 2 }], produces: [{ ref: 'D000166', n: 1 }], where: ['nucleoplasm'], text: '시험용 이량화', evidence: { level: 'abstracted', basis: '시험' } }); return C.normalize(d); })();
const scenario = (stochastic) => ({ ...BD, volumes: { nucleoplasm: { value: 1, unit: 'fL' } }, amounts: { [A]: N0 }, extra_rules: [REF], t_end: 20, dt_slow: 1,
  kinetics: { [REF]: { law: 'mass_action', k: CPAIR * NA * V, order: 2, evidence: { level: 'predicted', confidence: 0 } } }, ...(stochastic ? { stochastic } : { stochastic: undefined }) });
const SSA = { seed: 5, ssa_max: 1e9, ode_min: 1e12, fast: 1e12 };
// CME: 순수 사멸 사슬 N → N − 2, 성향 a(N) — 균일화로 시각 t 의 분포
function cme(prop, t) {
  const st = []; for (let x = N0; x >= 0; x -= 2) st.push(x);
  const a = st.map(prop), L = Math.max(...a) * 1.05;
  let p = st.map((_, i) => (i ? 0 : 1)), out = st.map(() => 0), w = Math.exp(-L * t);
  for (let k = 0; k < 20000; k++) {
    out = out.map((o, i) => o + w * p[i]);
    const q = p.map((pi, i) => pi * (1 - a[i] / L)); for (let i = 0; i + 1 < st.length; i++) q[i + 1] += (p[i] * a[i]) / L;
    p = q; w *= (L * t) / (k + 1);
    if (k > L * t + 50 && w < 1e-18) break;
  }
  const m = st.reduce((s, x, i) => s + x * out[i], 0);
  return { mean: m, var: st.reduce((s, x, i) => s + out[i] * (x - m) ** 2, 0) };
}

test('① 2A → B: 앙상블이 CME 의 N(N−1) 해와 맞고 N² 해와는 다르다 (JS · Rust, 400 궤적)', () => {
  for (const engine of ['js', 'rust']) {
    const raws = ORCH.runEnsemble(db, STATE, scenario(SSA), 400, { commitment: false, engine });
    assert.ok(!raws.error, raws.error);
    assert.ok(raws[0].stochastic.rules.some((x) => x.ref === REF && x.mode === 'ssa'), 'SSA 로');
    const ki = raws[0].keys.indexOf(A);
    for (const t of [5, 10, 20]) {
      const xs = raws.map((r) => r.series[t - 1][ki]), n = xs.length, m = xs.reduce((a, b) => a + b, 0) / n;
      assert.ok(xs.every((x) => Number.isInteger(x) && x >= 0 && x % 2 === 0), '짝수 정수 (2 씩 줄어듦)');
      const ex = cme((x) => CPAIR * x * (x - 1), t), sq = cme((x) => CPAIR * x * x, t);
      const zEx = (m - ex.mean) / Math.sqrt(ex.var / n), zSq = (m - sq.mean) / Math.sqrt(sq.var / n);
      assert.ok(Math.abs(zEx) < 3, `${engine} t ${t}: 평균 ${m} 대 정확 ${ex.mean} (z ${zEx})`);
      if (t >= 10) assert.ok(Math.abs(zSq) > 4, `${engine} t ${t}: N² 해(${sq.mean})와 구별되어야 함 (z ${zSq})`);
    }
    // N = 1 에서 정확한 성향은 0 — 막힌 발화(솎아내기)가 없어야 함
    assert.ok(raws.every((r) => r.stochastic.ssaBlocked === 0), '막힌 발화 0');
  }
});

test('② JS = Rust 비트 — 같은 (seed, 궤적)의 2A → B 궤적 해시', () => {
  for (let tr = 0; tr < 5; tr++) {
    const [a, b] = ['js', 'rust'].map((engine) => F.simulateFate(db, STATE, { scenario: scenario(SSA), engine, commitment: false, trajectory: tr }));
    assert.equal(FA.trajectoryHash(a), FA.trajectoryHash(b), `궤적 ${tr}`);
  }
});

test('③ 결정론 경로는 그대로 — ff 를 지운 IR 과 비트 같음 (JS · Rust)', () => {
  const sc = scenario(null), ir = IRB.buildFateIR(db, STATE, sc);
  assert.ok(ir.rules.find((r) => r.ref === REF).ff, 'ff 가 있어야 시험이 의미 있음');
  const bare = JSON.parse(JSON.stringify(ir)); for (const r of bare.rules) delete r.ff;
  for (const engine of ['js', 'rust']) {
    const a = F.simulateFate(db, STATE, { scenario: sc, ir, engine, commitment: false }), b = F.simulateFate(db, STATE, { scenario: sc, ir: bare, engine, commitment: false });
    assert.equal(FA.trajectoryHash(a), FA.trajectoryHash(b), engine);
  }
});

test('④ 컴파일러: ff 는 정수 n ≥ 2 질량 작용 반응물에만 · 없으면 칸 없음', () => {
  const ir = IRB.buildFateIR(db, STATE, scenario(null));
  const r = ir.rules.find((x) => x.ref === REF);
  assert.deepEqual(r.ff, [[ir.keys.indexOf(A), 2]]);
  for (const x of ir.rules) if (x.ref !== REF) assert.ok(!('ff' in x), `${x.ref}: 같은 분자 차수 없음 → 칸 없음`);
  // 포화 반응물(n 2 이상이라도)은 c/(c+K) — 거듭제곱이 아니므로 ff 없음
  const MO = SCN.read(new URL('examples/scenarios/fate-mixed-optimal-hypothetical.json', ROOT)), irM = IRB.buildFateIR(C.normalize(RAW), STATE, MO);
  assert.ok(!irM.rules.find((x) => x.ref === 'D000170/rule/aerobic_glycolysis').ff, '포화 반응물');
});
