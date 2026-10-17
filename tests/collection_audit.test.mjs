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
