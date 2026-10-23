// 철회 전파 → 결론 (build-plan 13, 사용자 결정 A: 관문 차단 유지 + 라벨 전파)
//   ① 검증 세트 관찰이 철회되면 등록된 검증 보고서의 판정 수준 = 재검증 필요 (차단 아님), 다른 검증은 그대로
//   ② 철회 파생 그래프가 사전 등록 결론까지 잇는다
//   ③ 재검증은 무엇이 바뀌었나에 키잉: 메모만 다른 대체 = 같음, 값이 바뀌면·근거 철회면 재검증 필요
//   ④ 보고서에 실린 의존 블록은 왕복한다
import SCN from '../scenarios.js'; // 시나리오 읽기 — 가정 번호를 원장으로 푼다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
const M = req('../model.js'), J = req('../judicial/judicial.js'), ER = req('../judicial/evidence_report.js'), DEP = req('../judicial/dependency.js');
const ROOT = new URL('..', import.meta.url).pathname;
const RAW = JSON.parse(readFileSync(join(ROOT, 'data/db.json'), 'utf8'));
const clone = (x) => JSON.parse(JSON.stringify(x));
const sc = (f) => SCN.read(join(ROOT, 'examples/scenarios', f));
const prereg = readFileSync(join(ROOT, 'data/preregistrations.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const retract = (db, oid) => { const d = clone(db); d.observations[oid].retracted = { note: '시험 철회' }; return d; };

test('① 검증 세트 관찰 철회 → 등록된 결론은 재검증 필요 (라벨)', () => {
  const b2m = sc('mhc-i-b2m-validation-hypothetical.json'), tap = sc('mhc-i-tapasin-validation-hypothetical.json');
  assert.equal(ER.evidenceReport(RAW, b2m, { target: 'D000202', prereg }).judgment.key, 'validated_registered', '철회 전엔 검증');
  const db = retract(RAW, 'O000021');
  const rep = ER.evidenceReport(db, b2m, { target: 'D000202', prereg });
  assert.equal(rep.judgment.key, 'revalidation_required');
  assert.match(rep.judgment.why, /O000021/);
  assert.match(ER.evidenceReportMarkdown(rep), /⚠ 재검증 필요/);
  assert.equal(ER.evidenceReport(db, tap, { target: 'D000202', prereg }).judgment.key, 'validated_registered', '다른 검증 세트는 그대로');
});

test('② 철회 파생 그래프가 사전 등록 결론까지', () => {
  const scenarios = { 'mhc-i-b2m-validation-hypothetical.json': sc('mhc-i-b2m-validation-hypothetical.json'), 'tca-measured-kinetics-hypothetical.json': sc('tca-measured-kinetics-hypothetical.json') };
  const r = J.retractionImpact(RAW, { assume: ['O000021'], scenarios });
  const row = r.rows.find((x) => x.obs === 'O000021');
  assert.ok(row && row.conclusions.some((c) => c.file === 'mhc-i-b2m-validation-hypothetical.json'), '검증 결론이 blast-radius 에');
  assert.equal(row.values.length, 0, '값에 기대지 않는 정성 관찰');
  assert.match(J.retractionText(RAW, { assume: ['O000021'], scenarios }), /사전 등록 검증 결론 재검증 필요/);
  assert.ok(!J.retractionImpact(RAW, { assume: ['O000021'] }).rows.length, '시나리오를 안 넘기면 결론 행 없음(사법부는 파일을 읽지 않음)');
});

test('③ 재검증은 내용에 키잉 — 메모 대체는 같음, 값 변경·철회는 재검증', () => {
  const rep = ER.evidenceReport(RAW, sc('tca-measured-kinetics-hypothetical.json'), { target: 'D000148', prereg });
  const deps = rep.dependencies;
  assert.ok(deps.values.length && deps.observations.length);
  assert.equal(DEP.recheck(RAW, deps).revalidate, false, '같은 db 면 그대로');
  const v0 = deps.values[0], rec = RAW.values[v0.id];
  // 메모만 다른 대체 기록
  const noteOnly = clone(RAW); noteOnly.values.V999998 = { ...clone(rec), note: '오타 수정', supersedes: v0.id, recorded_at: '2026-10-23T00:00:00.000Z' };
  const r1 = DEP.recheck(noteOnly, deps);
  assert.equal(r1.revalidate, false, '메모(R2)만 고친 대체는 재검증 아님');
  assert.equal(r1.rows.find((x) => x.id === v0.id).status, 'same_content');
  // 값이 바뀐 대체
  const changed = clone(RAW); changed.values.V999998 = { ...clone(rec), value: { dist: 'point', mean: (rec.value.mean || 1) * 2 }, supersedes: v0.id, recorded_at: '2026-10-23T00:00:00.000Z' };
  const r2 = DEP.recheck(changed, deps);
  assert.ok(r2.revalidate && r2.bad.some((b) => b.id === v0.id && b.status === 'changed'));
  // 근거 관찰 철회
  const o0 = deps.observations[0].id, r3 = DEP.recheck(retract(RAW, o0), deps);
  assert.ok(r3.revalidate && r3.bad.some((b) => b.id === o0 && b.status === 'retracted'));
  assert.match(DEP.recheckText(r3, 'x'), /재검증 필요/);
});

test('④ 보고서의 의존 블록 왕복', () => {
  const rep = ER.evidenceReport(RAW, sc('tca-measured-kinetics-hypothetical.json'), { target: 'D000148', prereg });
  const md = ER.evidenceReportMarkdown(rep);
  assert.deepEqual(DEP.parseDepsBlock(md), rep.dependencies);
  assert.equal(DEP.parseDepsBlock('# 옛 보고서'), null);
});
