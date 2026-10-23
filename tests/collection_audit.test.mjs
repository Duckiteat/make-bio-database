// 수집 작업 검증 — 설계 docs/design/work-verification.md · judicial/collection_audit.js
//   꼼수를 실제로 거부/표시하는지. 이름만 추가·기준 완화 금지 — 각 테스트는 실제 판정을 확인한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
const CA = req('../judicial/collection_audit.js');
const db = req('../data/db.json'); // observations·senses 가 id 키 객체
const v = (entries) => CA.auditCollection(db, entries).verdict;

test('① 제대로 조사·값 없음 → PASS (못 찾음을 정직히 표시)', () => {
  assert.equal(v([{ target: 'D000101/rule/turnover', outcome: 'not_found', use: 'validation', note: '사람 값 공개 전문에 없음' }]), 'PASS');
});

test('② 값 후보(출처+인용) 미검증 → REVIEW_REQUIRED (자동 PASS 금지)', () => {
  assert.equal(v([{ outcome: 'read_value', value: 170, unit: 's^-1', source: { db: 'DOI', id: '10.1111/febs.14782' }, quote: 'kcat = 170 s-1', use: 'estimation' }]), 'REVIEW_REQUIRED');
});

test('③ 근거 없는 값 → REJECTED (꼼수: 미확인을 사실처럼)', () => {
  assert.equal(v([{ outcome: 'read_value', value: 12, unit: 'min' }]), 'REJECTED'); // 출처·인용 없음
  assert.equal(v([{ outcome: 'read_value', value: 12, unit: 'min', source: { db: 'DOI', id: '10.1/x' } }]), 'REJECTED'); // 인용 없음
});

test('④ 가짜/틀린 출처 형식 → REJECTED', () => {
  assert.equal(v([{ outcome: 'read_value', value: 1, source: { db: 'DOI', id: 'not-a-doi' }, quote: 'x' }]), 'REJECTED');
  assert.equal(v([{ outcome: 'read_value', value: 1, source: { db: 'PMID', id: 'abc' }, quote: 'x' }]), 'REJECTED');
});

test('⑤ 상태-내용 불일치 → REJECTED (못 찾음인데 값 있음)', () => {
  assert.equal(v([{ outcome: 'not_found', value: 99, source: { db: 'PMID', id: '1' }, quote: 'x' }]), 'REJECTED');
});

test('⑥ 재사용: db 에 없는 대상 → REJECTED · 있는 대상 → 통과', () => {
  assert.equal(v([{ outcome: 'reused', reuse: { ref: 'O999999' } }]), 'REJECTED'); // 없는 관찰
  // 실재 관찰(O000001) 재사용, 값 주장 아님 → 거부/미완 없음 → PASS
  assert.equal(v([{ outcome: 'reused', reuse: { ref: 'O000001' } }]), 'PASS');
});

test('⑦ outcome 누락·빈 입력 → INCOMPLETE', () => {
  assert.equal(v([{ target: 'D000101' }]), 'INCOMPLETE'); // outcome 누락, 값 없음 → incomplete만
  assert.equal(v([]), 'INCOMPLETE');
  assert.equal(v([{ outcome: 'read_no_value', target: 'D000101' }]), 'PASS'); // 읽었으나 값 없음, 정직
});

test('⑧ 출처 해석 확인(#4): 해석 안 됨 → REJECTED · 됨 → 통과', () => {
  const e = [{ outcome: 'read_value', value: 1, source: { db: 'DOI', id: '10.9/fake' }, quote: 'x', verified: true }];
  assert.equal(CA.auditCollection(db, e, { sourceChecks: { 'DOI:10.9/fake': 'notfound' } }).verdict, 'REJECTED');
  assert.equal(CA.auditCollection(db, e, { sourceChecks: { 'DOI:10.9/fake': 'resolves' } }).verdict, 'PASS'); // verified:true 라 review 없음
  assert.equal(CA.auditCollection(db, e, { sourceChecks: { 'DOI:10.9/fake': 'error' } }).verdict, 'REVIEW_REQUIRED'); // 확인 실패는 통합가로
});

test('⑨ 실행 기록 파서 + 교차 검사(#2)', () => {
  const tx = '{"type":"tool_use","name":"WebSearch"}\n{"type":"tool_use","name":"Read"}';
  const s = CA.parseRunlog(tx);
  assert.equal(s.uses, 2); assert.equal(s.tools.WebSearch, 1); assert.equal(s.fetch, 1);
  // 값 주장인데 실행 기록에 열람 0 → review 플래그
  const none = CA.parseRunlog('{"type":"assistant"}');
  const iss = CA.crossCheckRun([{ outcome: 'read_value', value: 1 }], none);
  assert.ok(iss.some((x) => x.sev === 'review' && /열람/.test(x.msg)), '열람 0 모순을 못 잡음');
});

// ── build-plan 58: 인용–원문 대조 (부르는 쪽이 수신함 원문을 넘길 때) ──
const ABS = 'Telomeres shorten with each division. Mean loss was 48&#x000b1;21 bp per doubling in fibroblasts.';
const FULL = '<article><body><p>Cells lost ~40 bp per popula- tion doubling under our conditions.</p></body><back><ref-list><ref>Smith J. Telomeres shorten fast in mice. 1990</ref></ref-list></back></article>';
const ent = (quote, extra) => ({ outcome: 'read_value', value: 40, unit: 'bp/PD', source: { db: 'PMID', id: '111' }, quote, use: 'estimation', ...(extra || {}) });
const qv = (quote, texts, extra) => CA.auditCollection(db, [ent(quote, extra)], { texts: { 'PMID:111': texts } });
const msgs = (r) => r.issues.map((x) => `${x.sev}:${x.msg}`).join('\n');

test('⑩ 인용–원문: 전문·초록에 있으면 대조 문제 없음 (엔터티·± 기호 정규화 포함)', () => {
  assert.doesNotMatch(msgs(qv('Cells lost ~40 bp per popula- tion doubling', { abstract: ABS, fulltext: FULL })), /인용이/);
  assert.doesNotMatch(msgs(qv('Mean loss was 48±21 bp per doubling', { abstract: ABS })), /인용이/);
  assert.equal(CA.quoteCheck('Mean loss was 48±21 bp per doubling', { abstract: ABS }).where, 'abstract');
});

test('⑪ 인용–원문: 전문이 있는데 없는 인용 → REJECTED · 참고문헌 목록의 남의 제목은 이 논문의 문장이 아니다', () => {
  assert.equal(qv('Cells lost ~45 bp per population doubling', { abstract: ABS, fulltext: FULL }).verdict, 'REJECTED', '숫자를 고쳐 쓴 인용');
  assert.equal(qv('Telomeres shorten fast in mice', { abstract: ABS, fulltext: FULL }).verdict, 'REJECTED', '참고문헌 제목');
});

test('⑫ 인용–원문: 초록만 있고 거기 없음·원문 없음·그림 전사·너무 짧은 인용 → 사람 확인 (거부 아님)', () => {
  assert.match(msgs(qv('Cells lost ~40 bp per population doubling', { abstract: ABS })), /review:인용이 초록에 없음/);
  assert.match(msgs(qv('Cells lost ~40 bp per population doubling', undefined)), /review:원문이 수신함에 없음/);
  assert.match(msgs(qv('m = 0.010 ± 0.002 MPD per bp', { abstract: ABS, fulltext: FULL }, { transcribed: true })), /review:그림·표 전사/);
  assert.match(msgs(qv('40 bp', { abstract: ABS, fulltext: FULL })), /review:인용이 너무 짧아/);
  assert.equal(CA.auditCollection(db, [ent('Cells lost ~45 bp per population doubling')]).issues.some((x) => /인용이/.test(x.msg)), false, '원문을 넘기지 않으면 대조하지 않는다(기존 판정 그대로)');
});

test('⑬ 수신함 실물: Henderson 1996 공개 전문(PMC2120915)에서 인용을 찾는다 · 초록 기록의 pmcid 로 전문을 잇는다', () => {
  const IN = req('../inbox.js'), e = { source: { db: 'PMID', id: '8698806' }, quote: 'The rate of telomere shortening in these cells is ~40 bp per popula- tion doubling' };
  const t = IN.textsFor([e], new URL('../data', import.meta.url).pathname)['PMID:8698806'];
  assert.ok(t.abstract && t.fulltext, '초록·전문 둘 다 수신함에');
  assert.equal(CA.quoteCheck(e.quote, t).where, 'fulltext');
});
