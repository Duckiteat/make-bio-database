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
  assert.equal(e.cs, 'S3.unconfirmed'); assert.equal(e.cd, 'D3.curated');
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
  assert.match(t, /S3\.unconfirmed/);
  assert.match(t, /이유 미정 \d+ \(기준 \d+ · 정책 \d+\)/);
  assert.match(REL.gradeText(rows), /## 기준과 이유/);
});

// 2026-10-24 결정: S3 을 확인된 것·확인 안 된 것으로 가르고, 원고·철회는 확인되면 바로 내림 · 근거 없이 적은 값은 D2 — 등급은 그대로
test('⑤ 출처 논문 상태: 학술지 확인 → S3.confirmed · 기록 없음 → S3.unconfirmed · 원고뿐 → S2 · 철회 → S0', () => {
  const ev = { level: 'curated', sources: [{ db: 'PMID', id: '9' }] };
  const at = (lit) => REL.scoreEvidence(ev, { evidenceShas: [], literature: lit });
  assert.deepEqual([at({ 'PMID:9': { kind: 'journal', retracted: false } }).cs, at({}).cs], ['S3.confirmed', 'S3.unconfirmed']);
  assert.deepEqual([at({ 'PMID:9': { kind: 'preprint', retracted: false } }).s, at({ 'PMID:9': { kind: 'preprint' } }).cs], [2, 'S2.preprint']);
  assert.deepEqual([at({ 'PMID:9': { kind: 'journal', retracted: true } }).s, at({ 'PMID:9': { kind: 'journal', retracted: true } }).cs], [0, 'S0.retracted']);
  const o = { provenance: { source: { db: 'PMID', id: '9' } }, uncertainty: { sd: 1 }, replicates: 3 };
  assert.equal(REL.scoreObservation(o, { literature: { 'PMID:9': { kind: 'journal', retracted: true } } }).s, 0, '철회 논문의 관찰은 S0');
});

test('⑥ 근거 없이 적은 값은 D2 — 등급은 reference 그대로 · 수신함 실물로 학술지 확인이 붙는다', () => {
  const a = REL.scoreEvidence({ level: 'asserted' }, { evidenceShas: [] });
  assert.deepEqual([a.s, a.d, a.cd, REL.gradeOf(a.s, a.d, 'unchecked')], [2, 2, 'D2.asserted', 'reference']);
  const lit = req('../inbox.js').literatureStatus(new URL('../data', import.meta.url).pathname);
  assert.deepEqual(lit['PMID:7664836'], { kind: 'journal', retracted: false }, 'Allsopp 1995 — 수신함 초록이 학술지 기록');
  const withLit = REL.items(db, { attestations: v.keys, stale: v.stale, stamps: reg.stamps, literature: lit });
  assert.ok(withLit.some((r) => r.cs === 'S3.confirmed'));
  const g = (rs) => JSON.stringify(REL.summary(rs).byGrade);
  assert.equal(g(withLit), g(rows), '확인을 붙여도 지금 등급 분포는 그대로');
});

test('⑦ 출처는 sources 칸의 식별자로만 — 문장 속 "DOI" 글자로는 S3 이 아니다 · 옮긴 뒤 추론 규칙에 문장만 DOI 인 것이 없다', () => {
  assert.equal(REL.scoreEvidence({ level: 'abstracted', basis: 'Kagan 2006 — DOI/PMID 는 이번 세션에서 확인하지 못함' }, { evidenceShas: [] }).s, 2);
  assert.equal(REL.scoreEvidence({ level: 'abstracted', basis: 'x', sources: [{ db: 'PMID', id: '15149599' }] }, { evidenceShas: [], literature: { 'PMID:15149599': { kind: 'journal', retracted: false } } }).cs, 'S3.confirmed');
  const left = [];
  for (const [sid, d] of Object.entries(db.senses)) for (const r of d.rule || []) { const ev = r.evidence || {}; if (ev.level === 'abstracted' && !(ev.sources || []).length && /10\.\d{4,9}\/|PMID[: ]*\d/.test(ev.basis || '')) left.push(`${sid}/rule/${r.id}`); }
  assert.deepEqual(left, [], '식별자가 문장에만 있는 추론 규칙');
});
