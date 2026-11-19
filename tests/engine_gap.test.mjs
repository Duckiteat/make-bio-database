// 두 엔진의 차이 (PLAN-055) — 속도 엔진(core.simulateRate) 대 운명 엔진, 같은 경로 · 같은 시나리오
//   ① LPS 시나리오 그대로: 차이는 모두 '시작량 기본값'(속도 엔진은 주지 않은 묶음을 세포 기본값 · 대사물 풀로, 운명 엔진은 0) — 설명 안 되는 차 없음
//   ② 시작량을 맞추면 공유 묶음 모두 허용 1e-4 안 (적분 방식의 차는 Δt 의존 · 허용 오차 수준) · 운명 엔진의 음수 거부 병리도 사라짐
//   ③ MHC: 남는 차는 속도 엔진의 '즉시' 단계(L000081)와 계의 경계(운명 엔진은 두 기전 경로를 한 계로)뿐
//   ④ 판정: 어느 원인에도 맞지 않는 차는 unexplained 로 — ok 가 거짓 (새 구멍을 사람에게)
import SCN from '../scenarios.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const C = req('../core.js'), ORCH = req('../orchestrator.js'), G = req('../judicial/engine_gap.js');
const ROOT = new URL('..', import.meta.url);
const BASE = C.normalize(JSON.parse(readFileSync(new URL('data/db.json', ROOT), 'utf8')));
const LPS = SCN.read(new URL('examples/scenarios/lps-tnf-validation-hypothetical.json', ROOT));
const MHC = SCN.read(new URL('examples/scenarios/mhc-dc-immature-baseline-hypothetical.json', ROOT));

test('① LPS 그대로 (2 s): 허용을 넘는 차는 모두 시작량 기본값 — ATP 등 대사물 풀 · TNF 유전자', () => {
  const v = ORCH.engineGap(BASE, 'D000102', 'D000212', LPS, { t_end: 2 });
  assert.ok(!v.error, v.error);
  assert.ok(v.shared >= 40, `공유 묶음 ${v.shared}`);
  assert.ok(v.ok && !v.causes.unexplained, JSON.stringify(v.causes));
  assert.ok(v.causes.start_default > 0 && Object.keys(v.causes).every((k) => k === 'start_default'), JSON.stringify(v.causes));
  const atp = v.rows.find((r) => r.bundle === 'D000032|cytosol');
  assert.ok(atp && atp.cause === 'start_default' && atp.start.fate === 0 && atp.start.rate > 0, '운명 엔진은 ATP 0 에서 시작');
});

test('② LPS 시작량 맞춤 (60 s): 공유 묶음 모두 허용 1e-4 안 · 차는 Δt 의존 · 허용 오차 수준 · 음수 거부 병리 없음', () => {
  const v = ORCH.engineGap(BASE, 'D000102', 'D000212', LPS, { t_end: 60, matchStart: true });
  assert.ok(!v.error, v.error);
  assert.equal(v.rows.filter((r) => r.cause).length, 0, JSON.stringify(v.rows.filter((r) => r.cause).slice(0, 3)));
  assert.ok(v.worstWithin < 1e-5, `최대 차 ${v.worstWithin}`);
  assert.ok(v.fateSteps < 200, `운명 엔진 단계 ${v.fateSteps} — 시작량을 주면 ATP 음수 거부가 되풀이되지 않음`);
});

test('③ MHC (120 s, 시작량 맞춤): 남는 차는 속도 엔진의 즉시 단계와 계의 경계뿐', () => {
  for (const p of ['D000177', 'D000178']) {
    const v = ORCH.engineGap(BASE, p, 'D000202', MHC, { t_end: 120, matchStart: true });
    assert.ok(!v.error, v.error);
    assert.ok(v.ok, `${p}: ${JSON.stringify(v.causes)}`);
    assert.ok(Object.keys(v.causes).every((k) => k === 'instant_step' || k === 'boundary'), `${p}: ${JSON.stringify(v.causes)}`);
    assert.ok(v.instantSteps.length > 0 && v.causes.instant_step > 0, `${p}: 즉시 단계`);
  }
});

test('④ 판정: 어느 원인에도 맞지 않는 차는 unexplained · ok 거짓 · 글 보고', () => {
  const b = 'D900001|cytosol';
  const raw = { rate: { final: { [b]: 100 }, approx: [] }, rateFine: { final: { [b]: 100 } }, fate: { keys: [b], final: { N: { [b]: 50 } }, process: { ruleInfo: [] } }, fateRef: { final: { N: { [b]: 50 } } }, rateStart: { [b]: 10 }, fateStart: { [b]: 10 }, pathway: 'D900002' };
  const v = G.engineGap({ steps: {} }, raw);
  assert.equal(v.rows[0].cause, 'unexplained');
  assert.equal(v.ok, false);
  assert.match(G.engineGapText(v, '시험'), /설명 안 됨 1/);
  // 시작량이 다르면 시작량 기본값으로
  const w = G.engineGap({ steps: {} }, { ...raw, fateStart: { [b]: 0 } });
  assert.equal(w.rows[0].cause, 'start_default');
});

// ===== 속도식 밖 반응물 막기 (DEC-0063) =====
const F = req('../engine/fate_engine.js'), IRB = req('../compiler/ir_builder.js'), FA = req('../judicial/fate_audit.js');
test('⑤ 막기: LPS 그대로(ATP 0) 운명 실행이 음수 거부를 되풀이하지 않음 — 1800 s 를 200 단계 안 · ATP 는 0 에서 멈춤 · JS = Rust 비트 · 감사 결함 없음', () => {
  const runs = ['js', 'rust'].map((engine) => F.simulateFate(BASE, 'D000212', { scenario: LPS, engine, commitment: false }));
  for (const r of runs) {
    assert.ok(r.integrator.steps < 200, `${r.engine}: 단계 ${r.integrator.steps} (막기 전에는 5 s 에 47 만)`);
    assert.ok(r.series.every((N) => N[r.keys.indexOf('D000032|cytosol')] >= 0), 'ATP 가 음수로 가지 않음');
  }
  assert.equal(FA.trajectoryHash(runs[0]), FA.trajectoryHash(runs[1]), 'JS = Rust');
  const v = ORCH.runFate(BASE, 'D000212', { scenario: LPS, commitment: false });
  assert.ok(!v.audit.some((a) => ['ENGINE_DEFECT', 'COMPILER_DEFECT'].includes(a.fault)), JSON.stringify(v.audit.slice(0, 2)));
  const ir = IRB.buildFateIR(BASE, 'D000212', LPS);
  assert.ok(ir.rules.filter((R) => R.mg).length >= 9 && ir.rules.filter((R) => R.mg).every((R) => R.kind === 'step'), '인산화 단계들에 mg');
});

test('⑥ 막기는 넉넉하면 정확히 ×1 — ATP 를 주면 mg 를 지운 IR 과 비트 같음 (JS · Rust)', () => {
  const sc = JSON.parse(JSON.stringify(LPS)); sc.amounts['D000032|cytosol'] = 1e8; sc.t_end = 600;
  const ir = IRB.buildFateIR(BASE, 'D000212', sc), bare = JSON.parse(JSON.stringify(ir)); for (const r of bare.rules) delete r.mg;
  for (const engine of ['js', 'rust']) {
    const a = F.simulateFate(BASE, 'D000212', { scenario: sc, ir, engine, commitment: false }), b = F.simulateFate(BASE, 'D000212', { scenario: sc, ir: bare, engine, commitment: false });
    assert.equal(FA.trajectoryHash(a), FA.trajectoryHash(b), engine);
  }
});
