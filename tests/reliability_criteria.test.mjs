// 신뢰 지표의 기준 표 (judicial/reliability.js CRITERIA, build-plan 71·73) — 기준마다 조건과 이유가 분리되어 있고, 점수와 어긋나지 않는다
//   ① 모든 항목이 S·D·T 기준 번호를 달고, 번호는 표에 있다 ② 번호의 단계 = 실제 점수 (갈래와 표가 어긋나면 실패)
//   ③ 기준마다 이유(why) 또는 이유 미정(open) — 둘 다 없으면 실패 ④ 이유 미정 목록이 출력에 드러난다
//   ⑧ 이유마다 종류(basis, vocab.reasonBasis) — 결정이면 날짜 ⑨ 합의 창은 원천별(판 주기) — 창이 없는 원천은 만료
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

// 사용자 결정: S3 을 확인된 것·확인 안 된 것으로 가르고, 원고·철회는 확인되면 바로 내림 · 근거 없이 적은 값은 D2 — 등급은 그대로
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

// 사용자 결정: 이유를 종류로 가른다 (원칙·실증·외부 표준·운영·결정)
test('⑧ 기준·등급·정책의 이유마다 종류가 있다 — 종류는 어휘 안 · 결정이면 날짜 · 이유가 있으면 종류도 있다', () => {
  const RB = req('../model.js').VOCAB.reasonBasis;
  const all = [...Object.entries(REL.CRITERIA), ...Object.entries(REL.GRADE_WHY).map(([k, x]) => [`등급 ${k}`, x]), ...Object.entries(REL.POLICY).map(([k, x]) => [`정책 ${k}`, x])];
  for (const [id, x] of all) {
    assert.ok(Array.isArray(x.basis), `${id}: basis 없음`);
    for (const b of x.basis) assert.ok(RB[b], `${id}: 이유의 종류 '${b}' 가 vocab.reasonBasis 에 없음`);
    if (x.why) assert.ok(x.basis.length, `${id}: 이유는 있는데 종류가 없음`);
    if (x.basis.includes('decision')) assert.match(x.why || '', /\d{4}-\d{2}-\d{2} 결정/, `${id}: 결정이면 날짜`);
  }
  assert.ok(!REL.CRITERIA['D4.measured'].open && !REL.POLICY.default_min.open && !REL.CRITERIA['T.unchecked'].open, '2026-10-24 에 이유를 정한 셋');
  assert.match(REL.criteriaText(rows), /이유의 종류 \(vocab\.reasonBasis\): 원칙 \d+/);
});

test('⑨ 합의 창은 원천별 판 주기 — 같은 나이라도 원천마다 만료가 다르고, 창이 없는 원천은 만료', () => {
  const TRD = req('../judicial/trend.js'), C = req('../model.js').VOCAB.consensus.sources;
  assert.equal(TRD.sourceOf('uniprot_entry'), 'uniprot'); assert.equal(TRD.sourceOf('chebi_entity'), 'chebi'); assert.equal(TRD.sourceOf('nope'), null);
  for (const [k, x] of Object.entries(C)) assert.ok(Number.isInteger(x.days) && x.days > 0 && x.why && /^https:\/\//.test(x.ref) && x.basis.length, `원천 ${k}: 창·이유·출처`);
  const at = (today) => TRD.verdicts(db, reg, { root: ROOT, reverify: false, today });
  const stampDay = Date.parse('2026-10-10'), plus = (n) => new Date(stampDay + n * 86400000).toISOString().slice(0, 10);
  const src = (r) => [...new Set(r.expired.map((e) => e.source))].sort();
  assert.equal(at(plus(C.chebi.days)).expired.length, 0, '창 끝날까지는 유효');
  const mid = at(plus(C.chebi.days + 1));
  assert.deepEqual(src(mid), ['chebi'], 'ChEBI 창(31일)을 넘기면 ChEBI 도장만 만료');
  assert.ok(Object.keys(mid.map).length > 0, 'UniProt 도장은 아직 유효');
  assert.deepEqual(src(at(plus(C.uniprot.days + 1))), ['chebi', 'uniprot']);
  assert.equal(Object.keys(at(plus(C.uniprot.days + 1)).map).length, 0);
});

// 사용자 결정: 반복 수 1 의 '한 번·미보고·계산값' 을 가른다 — 문턱(≥1)은 그대로
test('⑩ 도구 추정값은 D2.estimate · 반복 수 미보고(null)는 받되 D3 · 비교는 1 회로 봄(보수적) · 반복 수를 빼면 거부', () => {
  const est = Object.values(db.observations).filter((o) => o.kind !== 'qualitative' && (o.evidence || {}).level === 'computed');
  assert.ok(est.length > 0 && est.every((o) => REL.scoreObservation(o, {}).cd === 'D2.estimate'), 'eQuilibrator 추정은 실측이 아니다');
  const base = JSON.parse(JSON.stringify(db.observations.O000004));
  assert.equal(REL.scoreObservation(base, {}).cd, 'D4.measured');
  const unrep = { ...base, replicates: null };
  assert.deepEqual([REL.scoreObservation(unrep, {}).cd, REL.scoreObservation(unrep, {}).d], ['D3.obs_bare', 3]);
  const J = req('../judicial/judicial.js'), M = req('../model.js');
  const ndb = M.normalize(db), ix = M.index(ndb);
  const errs = (o) => { const out = []; J.validateObservation(ndb, ix, 'O000999', M.normObservation(o), (rule, w, m) => out.push(m), () => {}); return out.join(' '); };
  assert.doesNotMatch(errs(unrep), /반복 수/, 'null(미보고)은 받는다');
  assert.match(errs({ ...base, replicates: undefined }), /반복 수/);
  assert.match(errs({ ...base, replicates: 0 }), /반복 수/);
  const OC = req('../judicial/obs_compare.js'), n = M.normObservation({ ...unrep, use: 'validation' }), one = M.normObservation({ ...base, replicates: 1, use: 'validation' });
  const a = OC.verdict(n, [n.value * 1.1]).A, b = OC.verdict(one, [one.value * 1.1]).A;
  assert.ok(a && Number.isFinite(a.se) && a.se === b.se, `미보고는 1 회와 같은 표준 오차 (${a && a.se} · ${b && b.se})`);
});

// PLAN-073: 문턱 = 축 조건 — 순번 비교와 다른 곳은 비교할 수 없는 쌍뿐 · 관문 문턱은 올리기만
test('⑪ 문턱은 축 조건: 모든 (S,D,T) 에서 순번 비교와 같고, 다른 곳은 bounded↔parameter 쌍뿐 · 등급은 제 문턱을 넘는다', () => {
  const diff = [];
  for (const s of [0, 2, 3, 4]) for (const d of [2, 3, 4]) for (const trend of ['match', 'mismatch', 'unchecked']) {
    const g = REL.gradeOf(s, d, trend), row = { s, d, trend };
    assert.ok(REL.meets(row, g), `S${s}D${d} ${trend} 은 제 등급 ${g} 의 문턱을 넘어야`);
    for (const min of REL.ORDER) {
      const old = REL.ORDER.indexOf(g) <= REL.ORDER.indexOf(min);
      if (REL.meets(row, min) !== old) diff.push(`${g}(S${s}D${d},${trend})→${min}`);
    }
  }
  assert.deepEqual([...new Set(diff.map((x) => x.replace(/\(.*\)/, '')))], ['parameter→bounded'], diff.join(' '));
  assert.ok(!REL.meets({ s: 3, d: 3 }, 'bounded') && !REL.meets({ s: 4, d: 2 }, 'parameter'), '비교할 수 없는 쌍은 서로의 문턱을 넘지 못한다');
  assert.ok(REL.meets({ s: 4, d: 4, trend: 'match' }, 'bounded') && REL.meets({ s: 4, d: 4, trend: 'match' }, 'parameter'));
  assert.throws(() => REL.meets({ grade: 'parameter' }, 'parameter'), /축 값/);
});

test('⑫ 관문 문턱은 올리기만: 기본보다 느슨하거나 비교할 수 없는 문턱은 거부 · 지금 데이터의 판정은 그대로', () => {
  assert.deepEqual(REL.ORDER.filter((g) => !REL.gateMinError(g)), ['anchor', 'parameter']);
  for (const g of ['bounded', 'legacy', 'reference', 'blocked']) assert.match(REL.gateMinError(g), /올리기만/);
  assert.match(REL.gateMinError('최고'), /모름/);
  const ir = { rules: [{ ref: 'D000001/rule/x', kind: 'mass_action', k: { src: 'data', k: 1, evidence: { level: 'asserted' } } }] };
  assert.match(REL.constantVerdict(ir, { min_grade: 'reference' }).error, /올리기만/, '내린 문턱으로 근거 없는 상수를 통과시키지 못한다');
  assert.equal(REL.constantVerdict(ir, {}).ok, false);
});
