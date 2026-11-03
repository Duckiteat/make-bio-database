// 기질 축 (docs/design/substrate-axis.md) — 값의 열쇠에 기질(정의항 번호)을 둔다.
//   ① 패치 입구: kinetics.by_substrate 로 기질별 Km 이 값 층에 들어가고, 평면 Km 은 첫 기질의 값을 투영한다 (엔진은 평면 칸만 읽음)
//   ② 첫 기질의 값이 없으면 평면 Km 을 비운다 — 다른 기질의 숫자를 대신 쓰지 않는다
//   ③ 보기 → 값 → 보기 왕복이 멱등: 보기를 그대로 되돌려 보내도 새 값이 생기지 않는다
//   ④ 사법부: 기질은 허용 속성에만 · 단계의 minor 아닌 입력만 · 기질 있는 값과 없는 값을 섞지 않음 · 관찰의 기질과 값의 기질이 같아야
//   ⑤ 관찰: observable.substrate 도 같은 규약
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const M = req('../model.js'), J = req('../judicial/judicial.js'), LEG = req('../legislative/legislative.js');
const RAW = JSON.parse(readFileSync(new URL('../data/db.json', import.meta.url), 'utf8')), BASE = M.normalize(RAW);
const T1 = '2026-11-03T00:00:00.000Z';
const P = (o) => Object.assign({ format: 'definition-db-patch', version: 12, why: '기질 축 시험' }, o);

// 시트르산 생성효소 규칙: 단계 입력이 아세틸-CoA(첫 기질) · 옥살로아세트산 — 데이터에서 읽는다 (번호를 박지 않고 구조로 고름)
const REF = 'D000149/rule/condense', SID = 'D000149';
const step = Object.values(BASE.steps).find((s) => s.rule === REF);
const [S1, S2] = step.inputs.filter((p) => !p.minor).map((p) => p.b.split('|')[0]);
const ruleOf = (db) => db.senses[SID].rule.find((r) => `${SID}/rule/${r.id}` === REF);
const patchWith = (kin) => P({ recorded_at: T1, senses: [{ id: SID, rule: [{ ...ruleOf(BASE), kinetics: kin }] }] });
// 평면 Km · from 을 떼고 기질별로 싣는다
const base = (() => { const { Km, from, by_substrate, ...rest } = ruleOf(BASE).kinetics; return { ...rest, from: (from || []).filter((f) => f.param !== 'Km') }; })(); // Km 의 근거만 뗀다 (kcat 의 근거는 유지)
const O1 = ruleOf(BASE).kinetics.from.find((f) => f.param === 'Km').obs; // 첫 기질(아세틸-CoA)의 Km 관찰

test('① 패치 입구: 기질별 Km 이 값 층에 들어가고 평면 Km 은 첫 기질의 값 · 기존 평면 값은 철회', () => {
  assert.ok(S1 && S2 && S1 !== S2, '단계 입력에 기질이 둘');
  const km1 = ruleOf(BASE).kinetics.Km;
  const r = LEG.merge(BASE, patchWith({ ...base, by_substrate: { [S1]: { Km: km1, from: [O1] }, [S2]: { Km: 3.6e-6, from: ['O000007'] } } }));
  assert.deepEqual(r.report.errors, []);
  const k = ruleOf(r.db).kinetics;
  assert.equal(k.Km, km1, '평면 Km = 첫 기질의 값 (엔진이 읽는 숫자 그대로)');
  assert.deepEqual(Object.keys(k.by_substrate).sort(), [S1, S2].sort());
  assert.equal(k.by_substrate[S2].Km, 3.6e-6);
  const cur = [...M.currentValues(r.db).get(REF)].map(([, v]) => v).filter((v) => v.property === 'Km');
  assert.deepEqual(cur.map((v) => v.substrate).sort(), [S1, S2].sort(), '현재 Km 값은 기질 둘 — 기질 없는 값은 없음');
  assert.ok(r.report.values.retracted.length >= 1, '기질 없던 옛 Km 은 철회');
  assert.deepEqual(J.validate(r.db).errors, []);
});

test('② 첫 기질의 값이 없으면 평면 Km 을 비운다 — 다른 기질의 숫자를 대신 쓰지 않는다', () => {
  const r = LEG.merge(BASE, patchWith({ ...base, by_substrate: { [S2]: { Km: 3.6e-6, from: ['O000007'] } } }));
  assert.deepEqual(r.report.errors, []);
  const k = ruleOf(r.db).kinetics;
  assert.equal(k.Km, undefined, '둘째 기질의 3.6 µM 이 첫 기질 자리에 가지 않음');
  assert.equal(k.by_substrate[S2].Km, 3.6e-6);
});

test('③ 왕복 멱등: 정규형이 안정이고 보기를 그대로 되돌려 보내도 새 값이 없다', () => {
  const r = LEG.merge(BASE, patchWith({ ...base, by_substrate: { [S1]: { Km: ruleOf(BASE).kinetics.Km, from: [O1] }, [S2]: { Km: 3.6e-6, from: ['O000007'] } } }));
  assert.equal(JSON.stringify(M.normalize(JSON.parse(JSON.stringify(r.db)))), JSON.stringify(r.db), '저장소는 정규형');
  const again = LEG.merge(r.db, patchWith({ ...ruleOf(r.db).kinetics }));
  assert.deepEqual(again.report.errors, []);
  assert.deepEqual([again.report.values.added, again.report.values.superseded, again.report.values.retracted], [[], [], []], '보기(평면 Km + by_substrate)를 되돌려도 값이 늘거나 바뀌지 않음');
});

test('④ 사법부: 속성 · 입력 · 섞임 · 관찰 기질', () => {
  const bad = (mut, re) => { const d = JSON.parse(JSON.stringify(RAW)); mut(d); const v = J.validate(M.normalize(d)); assert.ok(v.errors.some((e) => re.test(e.msg)), `${re}: ${v.errors.map((e) => e.msg).slice(0, 3).join(' / ')}`); };
  const add = (d, v) => { const id = `V${String(d.meta.next.V++).padStart(6, '0')}`; d.values[id] = { subject: REF, property: 'Km', value: { dist: 'point', mean: 1e-5 }, derivation: 'direct', recorded_at: T1, evidence: { level: 'curated', sources: [{ db: 'PMID', id: '1' }] }, from: ['O000007'], ...v }; return id; };
  // 허용 속성이 아님
  bad((d) => add(d, { property: 'kcat', substrate: S1, value: { dist: 'point', mean: 1 } }), /기질은 Km 속성에만/);
  // 이 규칙 단계의 입력이 아님 (다른 규칙의 기질)
  bad((d) => add(d, { substrate: 'D000138' }), /minor 아닌 입력에 없음/);
  // 기질 있는 값과 기질 없는 값이 섞임 — 기존 Km(기질 없음)이 현재 값인 채로 기질 있는 값을 더함
  bad((d) => add(d, { substrate: S2 }), /섞임/);
  // 관찰이 밝힌 기질과 값의 기질이 다름 — 기존 평면 값을 유지한 채 기질 있는 관찰을 근거로 달면 안 되므로 패치 입구로 시험
  const d2 = JSON.parse(JSON.stringify(RAW)); const o = JSON.parse(JSON.stringify(d2.observations.O000007)); o.observable.substrate = S1; d2.observations.O900000 = o; d2.meta.next.O = Math.max(d2.meta.next.O, 900001);
  const dbo = M.normalize(d2);
  const r = LEG.merge(dbo, patchWith({ ...base, by_substrate: { [S2]: { Km: 3.6e-6, from: ['O900000'] } } }));
  assert.deepEqual(r.report.errors, []);
  const ve = J.validate(r.db).errors;
  assert.ok(ve.some((e) => /관찰의 기질/.test(e.msg)), ve.map((e) => e.msg).join(' / '));
});

test('⑤ 관찰: observable.substrate 는 Km 에만 · 그 규칙의 minor 아닌 입력만', () => {
  const mk = (ob) => { const d = JSON.parse(JSON.stringify(RAW)); const o = JSON.parse(JSON.stringify(d.observations.O000007)); o.observable = { ...o.observable, ...ob }; d.observations.O900000 = o; d.meta.next.O = Math.max(d.meta.next.O, 900001); return J.validate(M.normalize(d)); };
  assert.ok(mk({ substrate: S2 }).errors.every((e) => !/기질/.test(e.msg)), '올바른 기질은 통과');
  assert.ok(mk({ substrate: 'D000138' }).errors.some((e) => /minor 아닌 입력에 없음/.test(e.msg)));
  assert.ok(mk({ param: 'kcat', substrate: S1 }).errors.some((e) => /기질\(observable.substrate\)은 Km 칸에만/.test(e.msg)));
});
