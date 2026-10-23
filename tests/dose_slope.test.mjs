// 용량 반응 기울기 (측정 유형 dose_slope · 교란 set_amount) — TASK-004 의 기울기 후보(Allsopp 1992)를 받을 그릇
//   ① set_amount 교란: 컴파일러가 시작량만 바꾸고, 사법부 재구성이 '교란 외에는 같음' 을 확인 · 잘못된 선언 거부
//   ② 관찰 검사: 용량 축 없음·값 하나·없는 규칙은 거부
//   ③ 연산자·조정자: 결정론 모델에서 분열 수의 초기 길이 기울기 ≈ 1/ΔL (L000116 — 이 측정은 지금 ΔL 을 다시 잴 뿐임을 숫자로)
//   ④ 추정용 관찰은 판정하지 않음 (순환 방지 — 기존 규칙이 새 측정 유형에도)
import SCN from '../scenarios.js'; // 시나리오 읽기 — 가정 번호를 원장으로 푼다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
const M = req('../model.js'), J = req('../judicial/judicial.js'), PT = req('../compiler/perturb.js'), PA = req('../judicial/perturb_audit.js'), ORCH = req('../orchestrator.js'), OP = req('../compiler/obs_operator.js');
const RAW = JSON.parse(readFileSync(new URL('../data/db.json', import.meta.url), 'utf8')), DB = M.normalize(RAW);
const SC = SCN.read(new URL('../examples/scenarios/telomere-hayflick-hypothetical.json', import.meta.url));
const TEL = 'D000204|nucleoplasm', DIV = 'D000205/rule/division_attrition';
const obs = (extra) => Object.assign({ observable: { kind: 'dose_slope', target: DIV, dose: { target: TEL, values: [1500, 1800, 2100] } }, value: 0.06, unit: '1', uncertainty: { kind: 'combined', model: 'normal', sd: 0.012 }, replicates: 1, use: 'validation', condition: { species: '9606' }, evidence: { level: 'curated', sources: [{ db: 'PMID', id: '1438199', citation: 'Allsopp et al., 1992' }] } }, extra || {});

test('① set_amount 교란 — 시작량만 바꾸고 사법부 재구성이 통과, 잘못된 선언은 거부', () => {
  const v = PT.perturbedIR(DB, 'D000210', SC, { type: 'dose_series', of: { type: 'set_amount', target: TEL }, doses: [1500, 2100] });
  assert.ok(!v.error, v.error);
  for (const x of v.variants) {
    assert.equal(x.scenario.amounts[TEL], x.record.perturbation.n);
    const a = PA.verifyPerturbation({ baseScenario: SC, baseIR: v.base, scenario: x.scenario, ir: x.ir, record: x.record });
    assert.ok(a.ok, (a.problems || []).join('; '));
  }
  assert.match(PT.perturb(DB, 'D000210', SC, { type: 'set_amount', target: TEL, n: -1 }).error, /n ≥ 0/);
  assert.match(PT.perturb(DB, 'D000210', SC, { type: 'set_amount', target: 'D000001|nucleoplasm', n: 5 }).error, /이 계에 없음/);
});

test('② 관찰 검사 — 용량 축 없음·값 하나·없는 규칙 거부', () => {
  const errs = (o) => { const d = JSON.parse(JSON.stringify(RAW)); d.observations.O999999 = o; return J.validate(M.normalize(d)).errors.filter((e) => e.where.startsWith('O999999')).map((e) => e.msg).join('\n'); };
  assert.equal(errs(obs()), '', '올바른 기울기 관찰은 통과');
  const noDose = obs(); delete noDose.observable.dose;
  assert.match(errs(noDose), /용량 축/);
  assert.match(errs(obs({ observable: { kind: 'dose_slope', target: DIV, dose: { target: TEL, values: [1800, 1800] } } })), /두 개 이상/);
  assert.match(errs(obs({ observable: { kind: 'dose_slope', target: 'D000205/rule/nope', dose: { target: TEL, values: [1, 2] } } })), /진행량을 읽을 규칙/);
});

test('③ 결정론 모델의 기울기 ≈ 1/ΔL — 동어반복을 숫자로 (L000116)', () => {
  const r = ORCH.observeFate(DB, obs(), 'D000210', SC, null, {});
  assert.ok(!r.error, r.error);
  assert.equal(r.dose_series.length, 3);
  assert.ok(r.dose_series[2].progress > r.dose_series[0].progress, '길수록 분열이 많다');
  const dl = DB.senses.D000205.rule.find((x) => x.id === 'division_attrition').consumes[0].n;
  assert.ok(Math.abs(r.A.mu - 1 / dl) / (1 / dl) < 0.02, `기울기 ${r.A.mu} 가 1/ΔL ${1 / dl} 와 2% 안 — 이 측정은 지금 ΔL 을 다시 잰다`);
  assert.ok(Number.isNaN(OP.doseSlope(obs(), [{ dose: 1, raw: { process: {} } }])), '진행량이 없으면 NaN (지어내지 않음)');
});

test('④ 추정용 기울기는 판정하지 않음 (순환 방지)', () => {
  const r = ORCH.observeFate(DB, obs({ use: 'estimation' }), 'D000210', SC, null, {});
  assert.match(r.error || '', /추정용 관찰은 판정하지 않음/);
});

test('⑤ 첫 장면 기원 — ΔL 은 숫자 출처 없음, 핵질 부피는 한계 경로로, 성장 인자 신호는 기원 없음', () => {
  const SO = req('../judicial/scene_origin.js'), v = SO.sceneOrigin(RAW, SC, { target: 'D000210' });
  assert.ok(!v.error, v.error);
  const row = (f, k) => v.rows.find((r) => r.field === f && r.key === k);
  assert.equal(row('stoichiometry', DIV).origin, 'abstracted', 'ΔL: db 에 있으나 숫자 출처 없음');
  assert.equal(row('volumes', 'nucleoplasm').origin, 'assumed', '핵질 부피: L000092 의 compartment_volume 경로');
  assert.ok(row('volumes', 'nucleoplasm').limitations.includes('L000092'));
  assert.equal(row('signals', 'D000209|extracellular').origin, 'unrecorded', '조절 한계는 신호 양의 기원이 아님');
  assert.equal(row('amounts', TEL).origin, 'assumed');
  const tca = SO.sceneOrigin(RAW, SCN.read(new URL('../examples/scenarios/tca-measured-kinetics-hypothetical.json', import.meta.url)), { target: 'D000148' });
  assert.ok(tca.count.measured >= 4, 'TCA 실측 kinetics 는 measured');
});
