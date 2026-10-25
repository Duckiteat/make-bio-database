// 가 스키마 구조 필드 (build-plan 16A · 설계 dictionary-and-translation §10)
//   ① 정규화가 구조 필드를 보존하고(없으면 직렬화 불변), requirement.text(R2)는 그대로
//   ② 재검토 후보: at 이후 대상·막힌 하류에 새 관찰·값이 기록되면 '다시 볼 한계' — 그 전·철회·해결된 한계·manual 은 아님
//   ③ 재검토 후보는 병합 관문(detectGaps)을 막지 않는다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
const M = req('../model.js'), J = req('../judicial/judicial.js');
const RAW = JSON.parse(readFileSync(new URL('../data/db.json', import.meta.url), 'utf8'));
const clone = (x) => JSON.parse(JSON.stringify(x));

test('① 정규화가 구조 필드를 보존 — 없으면 그대로', () => {
  const db = M.normalize(clone(RAW));
  assert.equal(JSON.stringify(M.normalize(clone(RAW)).limitations), JSON.stringify(db.limitations), '구조 필드 없는 한계는 바뀌지 않음');
  const r = clone(RAW), id = Object.keys(r.limitations)[0];
  Object.assign(r.limitations[id], { symptom: { wall_time_s: 60, species_n: 42 }, downstream_blocked: ['D000212'], resolution_trigger: 'observation_added', at: '2026-10-16T00:00:00Z', prohibited_bypasses: ['다른 종 값을 사람 값으로'] });
  const l = M.normalize(r).limitations[id];
  assert.deepEqual(l.symptom, { wall_time_s: 60, species_n: 42 });
  assert.deepEqual(l.downstream_blocked, ['D000212']);
  assert.equal(l.resolution_trigger, 'observation_added');
  assert.deepEqual(l.prohibited_bypasses, ['다른 종 값을 사람 값으로']);
  assert.equal(l.requirement.text, RAW.limitations[id].requirement.text || RAW.limitations[id].requirement, 'R2 서술은 그대로');
  assert.equal(J.validate(M.normalize(r)).errors.length, J.validate(db).errors.length, '올바른 구조 필드는 새 오류 없음');
});

test('② 재검토 후보 — at 이후 대상·하류에 새 관찰·값', () => {
  const base = clone(RAW);
  const lid = Object.entries(base.limitations).find(([, l]) => l.target === 'D000148')[0];
  Object.assign(base.limitations[lid], { resolution_trigger: 'value_recorded', at: '2026-10-01T00:00:00Z', downstream_blocked: ['D000149/rule/condense'] });
  const db = M.normalize(base);
  const hit = J.reviewCandidates(db).find((x) => x.limitation === lid);
  assert.ok(hit && hit.hits.length > 0, '시트르산 생성효소 값(2026-10-16 기록)이 at 이후 → 다시 볼 한계');
  // at 을 미래로 → 후보 아님
  const later = clone(base); later.limitations[lid].at = '2099-01-01T00:00:00Z';
  assert.ok(!J.reviewCandidates(M.normalize(later)).some((x) => x.limitation === lid), 'at 이후 기록이 없으면 후보 아님');
  // manual → 후보 아님
  const man = clone(base); man.limitations[lid].resolution_trigger = 'manual';
  assert.ok(!J.reviewCandidates(M.normalize(man)).some((x) => x.limitation === lid));
  // 관찰 조건: 기록 시각 있는 관찰만, 철회 제외
  const ob = clone(RAW), oid = Object.keys(ob.observations).find((k) => ob.observations[k].recorded_at && ob.observations[k].observable && ob.observations[k].observable.target);
  const tgt = ob.observations[oid].observable.target.split('|')[0].split('/')[0];
  const lid2 = Object.keys(ob.limitations)[0];
  Object.assign(ob.limitations[lid2], { resolution_trigger: 'observation_added', at: '2000-01-01T00:00:00Z', downstream_blocked: [tgt] });
  assert.ok(J.reviewCandidates(M.normalize(ob)).some((x) => x.limitation === lid2 && x.hits.includes(oid)), '하류를 재는 새 관찰');
  ob.observations[oid].retracted = { at: '2026-10-23T00:00:00Z', note: '시험' };
  assert.ok(!(J.reviewCandidates(M.normalize(ob)).find((x) => x.limitation === lid2) || { hits: [] }).hits.includes(oid), '철회된 관찰은 세지 않음');
});

test('③ 재검토 후보는 병합 관문을 막지 않는다', () => {
  const base = clone(RAW), lid = Object.keys(base.limitations)[0];
  Object.assign(base.limitations[lid], { resolution_trigger: 'value_recorded', at: '2000-01-01T00:00:00Z' });
  assert.equal(J.detectGaps(M.normalize(base)).length, J.detectGaps(M.normalize(clone(RAW))).length, 'detectGaps 는 재검토와 섞이지 않음');
});
