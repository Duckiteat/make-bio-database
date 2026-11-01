// 관찰 기록 (형식 v10, 4단계 ①) — docs/design/observation-port.md. 실측값은 "무엇을 쟀는가"로, 한 번 들어오면 바뀌지 않는다.
//   ① 계약 모양 ② 관문 의미 검사(불확도·SI 단위·보정 재계산·합성 거부) ③ 실측 상수 = 관찰의 파생값(from·lumped·용도 분리)
//   ④ 변경 불가(바꿈·지움 거부, 철회 표시만) ⑤ 무손실(정규화 멱등, 형식 변환이 관찰 밖을 바꾸지 않음)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const DefDB = req('../core.js'), J = req('../judicial/judicial.js'), LEG = req('../legislative/legislative.js'), C = req('../judicial/contract.js'), OP = req('../compiler/obs_operator.js');
const BASE = DefDB.normalize(JSON.parse(readFileSync(new URL('../data/db.json', import.meta.url), 'utf8')));
const P = (o) => Object.assign({ format: 'definition-db-patch', version: 10, why: '시험', recorded_at: '2026-10-15T00:00:00.000Z' }, o);
const run = (db, patch) => { const res = LEG.merge(db, P(patch)); return { res, g: J.gate(db, res) }; };
const msgs = (g) => [...g.errors, ...g.warnings].map((e) => `${e.where}: ${e.msg}`).join('\n');
const passes = (patch, db = BASE) => { const r = run(db, patch); assert.ok(r.g.ok, '통과해야 함:\n' + msgs(r.g)); return r.res.db; };
const rejectedFor = (patch, re, db = BASE) => { const { g } = run(db, patch); assert.equal(g.ok, false, '거부되어야 함'); assert.ok([...g.errors, ...g.warnings].some((e) => re.test(e.msg)), `기대한 사유(${re})가 없음:\n` + msgs(g)); };

const BUNDLE = 'D000030|plasma_membrane', RULE = 'D000086/rule/basal_turnover';
const FIX = { level: 'computed', tool: 'test fixture' }; // 시험 기록 — 출처를 지어내지 않으려고 computed
const amount = (o) => Object.assign({ id: 'O+1', observable: { kind: 'amount', target: BUNDLE }, value: 1200, unit: 'molecule', uncertainty: { kind: 'measurement', model: 'normal', sd: 60 }, replicates: 3, condition: { species: '9606' }, use: 'validation', evidence: FIX, reported: { value: '1200', unit: 'molecule', sd: '60' } }, o);
const halfLife = (o) => Object.assign({ id: 'O+1', observable: { kind: 'kinetic_constant', target: RULE, param: 'half_life' }, value: 1800, unit: 's', uncertainty: { kind: 'measurement', model: 'lognormal', sd: 0.2 }, replicates: 4, condition: { species: '9606', temperature_K: 310.15 }, use: 'estimation', evidence: FIX, reported: { value: '30', unit: 'min' } }, o);
const withKin = (kin) => ({ id: 'D000086', rule: BASE.senses.D000086.rule.map((r) => (r.id === 'basal_turnover' ? { ...r, kinetics: kin } : r)) });

test('① 계약: 합성 예시는 모양을 지키고, 값만 있는 관찰은 모양에서 거부', () => {
  const ex = JSON.parse(readFileSync(new URL('../examples/observations/effector-reach-time-hypothetical.json', import.meta.url), 'utf8'));
  assert.ok(C.checkObservation(ex).ok, JSON.stringify(C.checkObservation(ex).violations));
  const bare = C.checkObservation({ observable: { kind: 'amount', target: BUNDLE }, value: 1, unit: 'molecule' });
  assert.equal(bare.ok, false);
  assert.ok(bare.violations.some((v) => /uncertainty/.test(v.msg)));
});

test('② 관문: 올바른 관찰은 통과(O 번호 배정), 합성·불확도 없음·SI 아님·보정 불일치는 거부', () => {
  const n0 = Object.keys(BASE.observations).length, o0 = BASE.meta.next.O;
  const db = passes({ observations: [amount()] });
  assert.equal(Object.keys(db.observations).length, n0 + 1);
  assert.equal(db.meta.next.O, o0 + 1);
  rejectedFor({ observations: [amount({ hypothetical: true })] }, /합성\(hypothetical\) 관찰은 데이터베이스에 넣지 않음/);
  rejectedFor({ observations: [amount({ uncertainty: { kind: 'measurement', model: 'normal' } })] }, /uncertainty\.sd/);
  rejectedFor({ observations: [amount({ uncertainty: { model: 'normal', sd: 1 } })] }, /불확도 유형/);
  rejectedFor({ observations: [amount({ unit: 'nM' })] }, /SI 정준 단위는 'molecule'/);
  rejectedFor({ observations: [halfLife({ unit: 'min' })] }, /SI 정준 단위는 's'/);
  rejectedFor({ observations: [amount({ uncertainty: { kind: 'biological', model: 'poisson', sd: 0 }, observable: { kind: 'concentration', target: BUNDLE }, unit: 'M', value: 1e-6 })] }, /poisson 은\(는\) amount 에만/);
  rejectedFor({ observations: [amount({ replicates: 0 })] }, /반복 수/);
  rejectedFor({ observations: [amount({ condition: {} })] }, /종\(condition\.species\)/);
  rejectedFor({ observations: [amount({ use: 'both' })] }, /용도/);
  rejectedFor({ observations: [amount({ evidence: { level: 'asserted' } })] }, /관찰 근거는 curated/);
  rejectedFor({ observations: [amount({ observable: { kind: 'amount', target: 'D000030|cytosol' } })] }, /박힌 분자|있을 수 없음/);
  // 보정: 값은 읽은 값에서 다시 계산되어야 한다
  passes({ observations: [amount({ calibration: { kind: 'linear', a: 2, b: 0 }, raw: 600 })] });
  rejectedFor({ observations: [amount({ calibration: { kind: 'linear', a: 2, b: 0 }, raw: 500 })] }, /보정 결과 1000/);
  rejectedFor({ observations: [amount({ calibration: { kind: 'table', points: [[0, 0], [100, 1000]] }, raw: 600 })] }, /보정 범위 밖/);
  passes({ observations: [amount({ calibration: { kind: 'table', points: [[0, 0], [500, 1000], [1000, 1400]] }, raw: 750 })] });
  assert.equal(OP.calibrate({ kind: 'table', points: [[0, 0], [500, 1000], [1000, 1400]] }, 750), 1200);
  assert.equal(OP.hash({ kind: 'linear', a: 2, b: 0 }), OP.hash({ b: 0, a: 2, kind: 'linear' }), '보정 해시는 정준 JSON');
});

test('③ 실측 상수 = 관찰의 파생값: from 이 같은 규칙·칸·값을 가리켜야 하고, 검증용 관찰은 추정에 못 씀', () => {
  passes({ observations: [halfLife()], senses: [withKin({ law: 'mass_action', half_life: 1800, from: [{ param: 'half_life', obs: 'O+1' }], evidence: FIX })] });
  rejectedFor({ observations: [halfLife()], senses: [withKin({ law: 'mass_action', half_life: 1700, from: [{ param: 'half_life', obs: 'O+1' }], evidence: FIX })] }, /관찰 값 1800 와 다름/);
  rejectedFor({ observations: [halfLife({ use: 'validation' })], senses: [withKin({ law: 'mass_action', half_life: 1800, from: [{ param: 'half_life', obs: 'O+1' }], evidence: FIX })] }, /상수 추정에 쓸 수 없음/);
  rejectedFor({ observations: [amount({ use: 'estimation' })], senses: [withKin({ law: 'mass_action', half_life: 1200, from: [{ param: 'half_life', obs: 'O+1' }], evidence: FIX })] }, /잰 것이 아님/);
  // 문헌(curated) 상수는 관찰 기록 없이 들어올 수 없다 (출처 문자열은 거부 시험 안에서만 — 병합되지 않음)
  rejectedFor({ senses: [withKin({ law: 'mass_action', half_life: 1800, evidence: { level: 'curated', sources: [{ db: 'DOI', id: '10.0000/fixture', citation: 'fixture, 0000' }] } })] }, /관찰 기록\(kinetics\.from\)이 없음/);
  // 묶은 상수: 원 관찰 참조 필수, 값 대조 없음
  rejectedFor({ senses: [withKin({ law: 'mass_action', half_life: 1800, lumped: true, evidence: FIX })] }, /묶은 상수\(lumped\)에는 원 관찰 참조/);
  passes({ observations: [amount({ use: 'estimation' })], senses: [withKin({ law: 'mass_action', half_life: 900, lumped: true, from: [{ param: 'half_life', obs: 'O+1' }], evidence: FIX })] });
});

test('④ 변경 불가: 관찰은 바꾸거나 지울 수 없고, 철회 표시만 더할 수 있음', () => {
  const db = passes({ observations: [amount()] });
  const NEW = Object.keys(db.observations).find((k) => !BASE.observations[k]); // 이 패치가 받은 번호 (저장소에 이미 기록이 있다)
  rejectedFor({ observations: [{ id: NEW, value: 1300 }] }, /관찰 기록은 바꿀 수 없음/, db);
  rejectedFor({ remove: [NEW] }, /관찰 기록은 지울 수 없음/, db);
  const retract = { id: NEW, retracted: { note: '보정 곡선 오류', evidence: FIX } };
  const db2 = passes({ observations: [retract] }, db);
  assert.equal(db2.observations[NEW].value, 1200, '철회해도 값은 그대로');
  rejectedFor({ observations: [{ id: NEW, retracted: { note: '다른 사유', evidence: FIX } }] }, /철회 표시는 바꾸거나 지울 수 없음/, db2);
  // 사법부는 병합 결과를 직접 바꾼 경우도 잡는다 (입법부 우회)
  const tampered = JSON.parse(JSON.stringify(db)); tampered.observations[NEW].value = 1;
  assert.ok(J.observationImmutability(db, DefDB.normalize(tampered)).length === 1);
  // 철회된 관찰은 상수의 출처가 될 수 없다
  const db3 = passes({ observations: [halfLife()] });
  const NEW3 = Object.keys(db3.observations).find((k) => !BASE.observations[k]);
  const db4 = passes({ observations: [{ id: NEW3, retracted: { note: '시험', evidence: FIX } }] }, db3);
  rejectedFor({ senses: [withKin({ law: 'mass_action', half_life: 1800, from: [{ param: 'half_life', obs: NEW3 }], evidence: FIX })] }, /철회된 관찰/, db4);
});

test('⑤ 무손실: 정규화 멱등, 저장소는 v12, 관찰 밖 필드는 형식 변환에서 그대로', () => {
  const db = passes({ observations: [amount({ calibration: { kind: 'linear', a: 2, b: 0 }, raw: 600, condition: { species: '9606', time_s: 60, states: [BUNDLE] }, provenance: { sha256: 'a'.repeat(64) } })] });
  const once = JSON.stringify(DefDB.normalize(db)), twice = JSON.stringify(DefDB.normalize(JSON.parse(once)));
  assert.equal(once, twice, '관찰 기록은 정규화를 거쳐도 비트 단위로 같아야 함');
  const raw = JSON.parse(readFileSync(new URL('../data/db.json', import.meta.url), 'utf8'));
  assert.equal(raw.version, 12);
  for (const [oid, o] of Object.entries(raw.observations)) assert.ok(C.checkObservation(o).ok, `${oid} 계약 위반: ` + JSON.stringify(C.checkObservation(o).violations));
  assert.equal(JSON.stringify(DefDB.normalize(raw)), JSON.stringify(raw), '저장소는 이미 정규형 (변환이 바꾼 것 없음)');
});

test('⑥ 관측 커버리지 지도 (48): 예측 가능한 측정량마다 검증 관찰, 정량 검증 0 = 사각', () => {
  const cov = J.coverageMap(BASE);
  assert.equal(cov.length, 6, 'obs_operator 가 내는 6 종류');
  assert.ok(cov.every((r) => typeof r.quant === 'number' && typeof r.qual === 'number' && typeof r.blind === 'boolean'));
  assert.ok(cov.find((r) => r.kind === 'ratio').blind, 'ratio 는 정량 검증 관찰이 없어 사각');
  assert.equal(cov.find((r) => r.kind === 'ratio').blind, cov.find((r) => r.kind === 'ratio').quant === 0);
  assert.match(J.coverageMapText(BASE), /관측 커버리지/);
});

// RULE-0090 · DEC-0035: 미보고 불확도의 출처 칸 — 해상도로 채운 sd 는 표시하고, 표시는 검사된다 (없으면 reported — 옛 기록 호환)
test('⑦ 불확도 출처: resolution 은 정규·sd > 0 에만 · 모르는 출처는 거부 · 출처 없는 옛 기록은 그대로 통과', () => {
  passes({ observations: [amount({ uncertainty: { kind: 'combined', model: 'normal', sd: 10, basis: 'resolution' }, reported: { value: '1.20e3', unit: 'molecule' } })] });
  passes({ observations: [amount({ uncertainty: { kind: 'measurement', model: 'normal', sd: 60, basis: 'reported' } })] });
  rejectedFor({ observations: [amount({ uncertainty: { kind: 'combined', model: 'normal', sd: 10, basis: 'guess' } })] }, /불확도 출처 'guess'/);
  rejectedFor({ observations: [halfLife({ uncertainty: { kind: 'measurement', model: 'lognormal', sd: 0.2, basis: 'resolution' } })] }, /잡음 모형 normal 에만/);
  rejectedFor({ observations: [amount({ uncertainty: { kind: 'combined', model: 'normal', sd: 0, basis: 'resolution' } })] }, /0 보다 커야/);
  assert.equal(C.checkObservation({ ...amount({ uncertainty: { kind: 'combined', model: 'normal', sd: 1, basis: 'nope' } }) }).ok, false, '계약 모양도 출처 값을 본다');
});

test('측정법이 붙은 관찰 (RULE-0524 · DEC-0045): 관문은 등록된 측정법만 · 장부를 못 받으면 경고로 막음', () => {
  const reg = new Map([['syn_counting', { key: 'syn_counting', rung: 'cellular', produces: ['amount'] }]]);
  const g = (o, opt) => J.gate(BASE, LEG.merge(BASE, P({ observations: [amount(o)] })), opt);
  const ok = g({ assay: 'syn_counting', replicate_type: 'biological' }, { assays: reg });
  assert.ok(ok.ok, msgs(ok));
  const bad = g({ assay: 'nowhere_assay' }, { assays: reg });
  assert.equal(bad.ok, false); assert.match(msgs(bad), /미등록 측정법 'nowhere_assay'/);
  const blind = g({ assay: 'syn_counting' }, {});
  assert.equal(blind.ok, false, '장부를 받지 않은 관문은 통과시키지 않음'); assert.match(msgs(blind), /측정법 장부를 받지 않아 확인하지 못함/);
});

// RULE-0525 (ASY-08): 원문 숫자 대조 — 정확한 유리수 환산(한 번 반올림)과 자리수가 하나라도 다르면 거부. 새 정량 관찰은 원문 숫자 없이 들이지 않는다
test('⑧ 원문 자리수: 환산값 · 자리수 · precision · 해상도 sd · 원문 sd 가 정확히 맞아야 하고, 없으면 관문이 거부', () => {
  const M = req('../model.js'), V = req('../vocab.js');
  // 정확한 도구: 십진·분수 해석, 마지막 자리, 한 번 반올림
  assert.deepEqual(M.exactQ('0.10'), [1n, 10n]); assert.deepEqual(M.exactQ('1/60'), [1n, 60n]); assert.deepEqual(M.exactQ('-2.5e-3'), [-1n, 400n]);
  assert.equal(M.exactQ('1,2'), null); assert.equal(M.exactQ('0x10'), null);
  assert.deepEqual(M.lastPlaceQ('26.70'), [1n, 100n]); assert.deepEqual(M.lastPlaceQ('3.6e-6'), [1n, 10000000n]); assert.deepEqual(M.lastPlaceQ('1200'), [1n, 1n]); assert.deepEqual(M.lastPlaceQ('1.20e3'), [10n, 1n]);
  assert.equal(M.qToF64([1n, 10n]), 0.1); assert.equal(M.qToF64([1n, 3n]), 1 / 3); assert.equal(M.qToF64([-7n, 2n]), -3.5);
  assert.equal(M.qToF64(M.qMul(M.exactQ('3.6'), M.exactQ('1e-6'))), 3.6e-6, '한 번 반올림 — 3.6 * 1e-6 의 두 번 반올림(3.5999999999999994e-6)이 아님');
  // 환산표는 하나: 실수 배율은 정확한 배율의 한 번 반올림
  for (const [kind, t] of Object.entries(V.unitExact)) for (const [u, q] of Object.entries(t)) assert.equal(V.unitFactors[kind][u], M.qToF64(M.exactQ(q)), `${kind} ${u}`);
  // 통과: 같은 단위 · 다른 단위(분 → 초) · 해상도 sd
  passes({ observations: [amount()] });
  passes({ observations: [halfLife()] });
  passes({ observations: [amount({ precision: 10, uncertainty: { kind: 'combined', model: 'normal', sd: 10, basis: 'resolution' }, reported: { value: '1.20e3', unit: 'molecule' } })] });
  // 거부: 가차없이 — 값 · 자리수 · 단위 · 문자열 · 원문 sd · 없음
  rejectedFor({ observations: [amount({ reported: { value: '1201', unit: 'molecule', sd: '60' } })] }, /정확한 환산 1201 과 다름/);
  rejectedFor({ observations: [halfLife({ reported: { value: '30.1', unit: 'min' } })] }, /정확한 환산 1806 과 다름/);
  rejectedFor({ observations: [amount({ precision: 1, reported: { value: '1.20e3', unit: 'molecule' } })] }, /precision 1 이 원문 '1\.20e3' 의 마지막 자리\(해상도 10/, BASE);
  rejectedFor({ observations: [amount({ precision: 100, reported: { value: '1200', unit: 'molecule' } })] }, /precision 100 이 원문 '1200' 의 마지막 자리\(해상도 1 /);
  rejectedFor({ observations: [amount({ uncertainty: { kind: 'combined', model: 'normal', sd: 10, basis: 'resolution' } })] }, /해상도로 채운 sd 10 가 원문 '1200' 의 마지막 자리\(1 /);
  rejectedFor({ observations: [amount({ reported: { value: '1200', unit: 'molecule', sd: '61' } })] }, /sd 60 이 원문 '± 61 molecule' 의 정확한 환산 61/);
  rejectedFor({ observations: [amount({ reported: { value: '1200', unit: 'min' } })] }, /같은 종류의 환산표/);
  rejectedFor({ observations: [amount({ reported: { value: 1200, unit: 'molecule' } })] }, /원문 그대로의 십진 문자열/);
  rejectedFor({ observations: [amount({ reported: undefined })] }, /새 정량 관찰에 원문 숫자\(reported/);
  assert.equal(J.validate(BASE).errors.filter((e) => e.rule === 'RULE-0525').length, 0, '옛 관찰은 경고(원문 숫자 없음)로만 — 자료 작업에서 채운다');
});
