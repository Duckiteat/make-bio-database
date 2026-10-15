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
const amount = (o) => Object.assign({ id: 'O+1', observable: { kind: 'amount', target: BUNDLE }, value: 1200, unit: 'molecule', uncertainty: { kind: 'measurement', model: 'normal', sd: 60 }, replicates: 3, condition: { species: '9606' }, use: 'validation', evidence: FIX }, o);
const halfLife = (o) => Object.assign({ id: 'O+1', observable: { kind: 'kinetic_constant', target: RULE, param: 'half_life' }, value: 1800, unit: 's', uncertainty: { kind: 'measurement', model: 'lognormal', sd: 0.2 }, replicates: 4, condition: { species: '9606', temperature_K: 310.15 }, use: 'estimation', evidence: FIX }, o);
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
