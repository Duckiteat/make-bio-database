// 값 층 (형식 v12) — docs/design/format-v12.md · model.js(보기·asOf) · legislative foldValues · judicial validateValues·valueImmutability
//   ① 저장: db.json 에는 값 층만(정의항 obs·규칙 kinetics 수치 없음), 메모리 보기는 그대로 · 정규화 멱등
//   ② 병합: 값이 바뀌면 새 기록이 대체(supersedes), 빠지면 철회 — 이전 기록은 그대로 · 보기는 새 값
//   ③ 두 시간: asOf(그날) 은 그날까지 기록된 값만으로 보기를 다시 세운다
//   ④ 사법부: 값 기록 모양(분포·대체·기록 시각) · 값은 바꾸거나 지울 수 없다(관문)
//   ⑤ 형식 변환 재현: 기원 스냅숏(v10) → transform = 지금 db 의 값 층
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const M = req('../model.js'), J = req('../judicial/judicial.js'), LEG = req('../legislative/legislative.js');
const RAW = JSON.parse(readFileSync(new URL('../data/db.json', import.meta.url), 'utf8')), BASE = M.normalize(RAW);
const T1 = '2026-11-01T00:00:00.000Z', T2 = '2026-12-01T00:00:00.000Z';
// 서열 길이가 있는 정의항 하나 (데이터에서 고름 — 이름을 박지 않음)
const SID = Object.keys(BASE.senses).find((s) => BASE.senses[s].obs.some((o) => o.property === 'sequence_length' && !o.from));
const P = (o) => Object.assign({ format: 'definition-db-patch', version: 12, why: '값 층 시험' }, o);

test('① 저장은 값 층만, 메모리 보기는 그대로 · 정규화 멱등', () => {
  assert.equal(RAW.version, 12);
  assert.ok(Object.keys(RAW.values).length > 0);
  for (const d of Object.values(RAW.senses)) { assert.ok(!('obs' in d), '저장된 정의항에 obs 가 있음'); for (const r of d.rule || []) assert.ok(!('kinetics' in r), '저장된 규칙에 kinetics 수치가 있음'); }
  assert.ok(BASE.senses[SID].obs.length > 0, '보기가 있음');
  assert.ok(!Object.keys(BASE.senses[SID]).includes('obs'), '보기는 열거되지 않음');
  assert.equal(JSON.stringify(M.normalize(RAW)), JSON.stringify(RAW), '저장소는 정규형');
  const law = Object.values(BASE.senses).flatMap((d) => d.rule).find((r) => r.kinetic_law);
  assert.ok(law && law.kinetics && law.kinetics.law === law.kinetic_law.law, '규칙의 kinetics 보기 = 법칙 + 값');
});

test('② 병합: 바뀌면 대체, 빠지면 철회, 이전 기록은 그대로', () => {
  const before = BASE.senses[SID].obs, seq = before.find((o) => o.property === 'sequence_length');
  const changed = before.map((o) => (o === seq ? { ...o, note: '값 층 시험 — 메모만 바꿈' } : o));
  const r1 = LEG.merge(BASE, P({ recorded_at: T1, senses: [{ id: SID, obs: changed }] }));
  assert.deepEqual(r1.report.errors, []);
  assert.equal(r1.report.values.superseded.length, 1); assert.equal(r1.report.values.retracted.length, 0);
  const nid = r1.report.values.superseded[0], nv = r1.db.values[nid], old = r1.db.values[nv.supersedes];
  assert.equal(nv.recorded_at, T1); assert.equal(nv.note, '값 층 시험 — 메모만 바꿈');
  assert.deepEqual(old, BASE.values[nv.supersedes], '이전 기록은 바뀌지 않음');
  assert.ok(r1.db.senses[SID].obs.some((o) => o.note === '값 층 시험 — 메모만 바꿈'), '보기는 새 값');
  assert.ok(J.gate(BASE, r1, {}).ok, '관문 통과');
  // 빼면 철회 (출처 관찰이 없는 도구 계산 값)
  const r2 = LEG.merge(r1.db, P({ recorded_at: T2, senses: [{ id: SID, obs: before.filter((o) => o !== seq) }] }));
  assert.deepEqual(r2.report.values.retracted, [nid]);
  assert.equal(r2.db.values[nid].retracted.at, T2);
  assert.ok(!r2.db.senses[SID].obs.some((o) => o.property === 'sequence_length'));
  // ③ 두 시간: 그날 기준
  assert.equal(M.asOf(r2.db, '2026-10-20T00:00:00.000Z').senses[SID].obs.find((o) => o.property === 'sequence_length').note, seq.note, 'T1 이전 = 원래 값');
  assert.equal(M.asOf(r2.db, '2026-11-15T00:00:00.000Z').senses[SID].obs.find((o) => o.property === 'sequence_length').note, '값 층 시험 — 메모만 바꿈', 'T1–T2 = 바뀐 값');
  assert.ok(!M.asOf(r2.db, '2026-12-15T00:00:00.000Z').senses[SID].obs.some((o) => o.property === 'sequence_length'), 'T2 이후 = 철회됨');
  // 기록 시각 없이 값을 바꾸면 거부
  assert.ok(LEG.merge(BASE, P({ senses: [{ id: SID, obs: changed }] })).report.errors.some((e) => /recorded_at/.test(e.msg)));
  // 값 층 직접 쓰기 거부
  assert.ok(LEG.merge(BASE, P({ recorded_at: T1, values: {} })).report.errors.some((e) => /직접 쓰지 않는다/.test(e.msg)));
});

test('④ 사법부: 값 기록 모양 · 값은 바꾸거나 지울 수 없다', () => {
  const bad = (mut, re) => { const d = JSON.parse(JSON.stringify(RAW)); mut(d.values); const v = J.validate(M.normalize(d)); assert.ok(v.errors.some((e) => re.test(e.msg)), `${re}: ${v.errors.map((e) => e.msg).join(' · ')}`); };
  const id0 = Object.keys(RAW.values)[0];
  bad((v) => { v[id0].value.dist = 'guess'; }, /분포/);
  bad((v) => { delete v[id0].recorded_at; }, /recorded_at/);
  bad((v) => { v.V900000 = { ...v[id0], supersedes: 'V999999' }; }, /대체 대상 V999999 이 없음/);
  bad((v) => { v[id0].property = 'mood'; }, /어휘에 없음/);
  bad((v) => { v[id0].from = ['O999999']; }, /근거 관찰 O999999 이 없음/);
  // 불변: 병합 결과에서 이전 기록을 바꾸거나 지우면 관문이 잡는다
  const tamper = (mut) => { const after = M.normalize(JSON.parse(JSON.stringify(RAW))); mut(after.values); return J.valueImmutability(BASE, after); };
  assert.ok(tamper((v) => { v[id0].value.mean = 1; }).some((e) => /바꿀 수 없음/.test(e.msg)));
  assert.ok(tamper((v) => { delete v[id0]; }).some((e) => /지울 수 없음/.test(e.msg)));
  assert.deepEqual(tamper((v) => { v[id0].retracted = { note: '시험' }; }), [], '철회 표시를 더하는 것은 허용');
});

test('⑤ 형식 변환 재현: 기원 스냅숏(v10) → transform = 지금 db 의 값 층', () => {
  const MIG = req('../migrations/010-v10-to-v12-values.js');
  const genesis = JSON.parse(readFileSync(new URL('../data/log/genesis.json', import.meta.url), 'utf8'));
  const snap = JSON.parse(readFileSync(new URL('../data/log/genesis-db.json', import.meta.url), 'utf8'));
  const db = MIG.transform(snap, { recorded_at: genesis.at });
  assert.deepEqual(MIG.lossless(snap, db), [], '보기 무손실');
  // 값 기록은 바뀌지 않으므로(철회 표시만 더해짐), 변환이 만든 기록은 앞으로도 지금 db 에 그대로 있어야 한다
  const strip = (v) => { const { retracted, ...rest } = v; return M.canonJ(rest); };
  for (const [id, v] of Object.entries(db.values)) assert.equal(strip(v), RAW.values[id] && strip(RAW.values[id]), `${id} 가 변환 결과와 다름`);
});
