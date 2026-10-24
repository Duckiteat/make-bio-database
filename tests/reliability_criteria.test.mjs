// 신뢰 지표의 기준 표 (judicial/reliability.js CRITERIA, build-plan 71·73) — 기준마다 조건과 이유가 분리되어 있고, 점수와 어긋나지 않는다
//   ① 모든 항목이 S·D·T 기준 번호를 달고, 번호는 표에 있다 ② 번호의 단계 = 실제 점수 (갈래와 표가 어긋나면 실패)
//   ③ 기준마다 이유(why) 또는 이유 미정(open) — 둘 다 없으면 실패 ④ 이유 미정 목록이 출력에 드러난다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
const REL = req('../judicial/reliability.js'), ATT = req('../judicial/attestation.js');
const ROOT = new URL('..', import.meta.url).pathname;
const db = req('../data/db.json'), reg = ATT.readRegistry(ROOT), v = ATT.validStamps(db, reg, { root: ROOT, reverify: false });
const rows = REL.items(db, { attestations: v.keys, stale: v.stale, stamps: reg.stamps });

test('① 모든 항목이 기준 번호(S·D·T)를 달고, 번호는 기준 표에 있다', () => {
  assert.ok(rows.length > 600);
  for (const r of rows) for (const c of [r.cs, r.cd, r.ct]) assert.ok(REL.CRITERIA[c], `${r.what} ${r.target}: 기준 번호 '${c}' 가 표에 없음`);
});

test('② 기준 번호의 단계가 실제 점수와 같다 — 점수 갈래와 기준 표가 어긋나지 않는다', () => {
  for (const r of rows) {
    assert.equal(REL.CRITERIA[r.cs].level, r.s, `${r.what} ${r.target}: S${r.s} 인데 기준 ${r.cs}`);
    assert.equal(REL.CRITERIA[r.cd].level, r.d, `${r.what} ${r.target}: D${r.d} 인데 기준 ${r.cd}`);
    assert.equal(REL.CRITERIA[r.ct].level, r.trend || 'unchecked');
  }
  const e = REL.scoreEvidence({ level: 'curated', sources: [{ db: 'PMID', id: '1' }] }, { evidenceShas: [] });
  assert.equal(e.cs, 'S3.doi'); assert.equal(e.cd, 'D3.curated');
  assert.equal(REL.scoreObservation({ retracted: { note: 'x' }, provenance: { source: { db: 'PMID', id: '1' } } }).cs, 'S0.void');
});

test('③ 기준마다 이유가 있거나, 이유 미정이 무엇인지 적혀 있다 (이유를 지어내지 않는다)', () => {
  for (const [id, c] of Object.entries(REL.CRITERIA)) {
    assert.ok(['S', 'D', 'T'].includes(c.axis) && c.when, id);
    assert.ok((c.why && c.why.trim()) || (c.open && c.open.trim()), `${id}: 이유도 이유 미정도 없음`);
  }
  for (const g of REL.ORDER) assert.ok(REL.GRADE_WHY[g] && REL.GRADE_WHY[g].why, `등급 ${g} 의 이유`);
});

test('④ 출력에 기준·이유·이유 미정 수가 드러난다', () => {
  const t = REL.criteriaText(rows);
  assert.match(t, /이유 미정:\*\* DOI 는 심사 전 원고/);
  assert.match(t, /이유 미정 \d+ \(기준 \d+ · 정책 \d+\)/);
  assert.match(REL.gradeText(rows), /## 기준과 이유/);
});
