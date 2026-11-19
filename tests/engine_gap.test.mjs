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
