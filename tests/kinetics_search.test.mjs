// 검색 계층 (PLAN-078) — mcp/kinetics_search.mjs 순수 함수. 네트워크 없음.
//   ① 질의는 도구가 짠다: 동의어 확장 · 사람 고정 · 연산자·따옴표 주입 거부 ② 응답 해석: 접근 상태는 필드 그대로, 없으면 unknown
//   ③ UniProt 속도 상수: 줄마다 근거 PMID · kcat 은 문장 그대로(숫자를 뽑지 않음) · 근거가 PubMed 가 아니면 PMID 없음
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as KS from '../mcp/kinetics_search.mjs';

test('① 문헌 질의: 효소·EC·파라미터 동의어·사람 — 주입과 다른 종은 거부', () => {
  const q = KS.buildLiteratureQuery({ enzyme: 'malate dehydrogenase', ec: '1.1.1.37', param: 'kcat' });
  assert.match(q, /"malate dehydrogenase" OR "EC 1\.1\.1\.37"/);
  assert.match(q, /"turnover number"/);
  assert.match(q, /"Homo sapiens"/);
  for (const bad of ['x" OR 1=1', 'a AND b', 'a:b', '']) assert.throws(() => KS.buildLiteratureQuery({ enzyme: bad }), /형식이 아님|연산자|필요함/);
  assert.throws(() => KS.buildLiteratureQuery({ ec: '1.1' }), /형식이 아님/);
  assert.throws(() => KS.buildLiteratureQuery({ enzyme: 'x', param: 'nope' }), /param/);
  assert.throws(() => KS.buildLiteratureQuery({ enzyme: 'x', taxon: 10090 }), /사람 9606 만/);
  assert.throws(() => KS.buildLiteratureQuery({ param: 'km' }), /필요함/);
  assert.match(KS.literatureUrl(q, 9999), /pageSize=100/);
});

test('② 검색 응답: 학술지(MED) 기록만 · 접근 상태는 응답 필드 그대로, 없으면 unknown', () => {
  const { hitCount, hits } = KS.parseLiterature({ hitCount: 9, resultList: { result: [
    { source: 'MED', pmid: '1', pmcid: 'PMC1', title: 'a', pubYear: '2020', isOpenAccess: 'Y', inPMC: 'Y' },
    { source: 'MED', pmid: '2', title: 'b', isOpenAccess: 'N', inPMC: 'Y' },
    { source: 'MED', pmid: '3', title: 'c', isOpenAccess: 'N', inPMC: 'N' },
    { source: 'MED', pmid: '4', title: 'd' },
    { source: 'PPR', id: 'PPR1', title: 'preprint' },
    { source: 'MED', pmid: 'x; rm', title: 'bad' }] } });
  assert.equal(hitCount, 9);
  assert.deepEqual(hits.map((h) => [h.pmid, h.access]), [['1', 'open'], ['2', 'free_read'], ['3', 'paywalled'], ['4', 'unknown']]);
  assert.deepEqual(KS.parseLiterature({}), { hitCount: 0, hits: [] });
});

test('③ UniProt 속도 상수: 줄마다 근거 PMID · kcat 문장 그대로 · PubMed 아닌 근거는 PMID 없음', () => {
  const ev = [{ source: 'PubMed', id: '111' }, { source: 'PubMed', id: '111' }, { source: 'Other', id: '9' }];
  const rows = KS.parseUniprotKinetics({ results: [{ primaryAccession: 'P1', genes: [{ geneName: { value: 'G1' } }], comments: [
    { commentType: 'FUNCTION' },
    { commentType: 'BIOPHYSICOCHEMICAL PROPERTIES', kineticParameters: {
      michaelisConstants: [{ constant: 0.2, unit: 'mM', substrate: 'fumarate', evidences: ev }, { constant: 5, unit: 'uM', substrate: 'x', evidences: [{ source: 'Other', id: '9' }] }],
      maximumVelocities: [{ velocity: 3, unit: 'umol/min/mg', enzyme: 'enzyme with y', evidences: ev }],
      note: { texts: [{ value: 'kcat is 4.5 min(-1) for z', evidences: ev }, { value: 'unrelated', evidences: ev }] } } }] }] });
  assert.deepEqual(rows.map((r) => [r.kind, r.pmids.join(',')]), [['km', '111'], ['km', ''], ['vmax', '111'], ['kcat_note', '111']]);
  assert.equal(rows[0].taxon, 9606);
  assert.equal(rows[3].text, 'kcat is 4.5 min(-1) for z');
  assert.equal(rows[3].value, undefined, 'kcat 숫자를 우리가 뽑지 않는다');
});

test('④ UniProt 주소: 사람·검토됨 고정 · 형식 검사', () => {
  assert.match(decodeURIComponent(KS.uniprotKineticsUrl({ ec: '1.1.1.37' })), /reviewed:true AND organism_id:9606 AND ec:1\.1\.1\.37/);
  assert.match(KS.uniprotKineticsUrl({ accession: 'P40926' }), /accession%3AP40926/);
  for (const bad of [{ ec: 'x' }, { accession: 'zz' }, { gene: 'a b' }, {}]) assert.throws(() => KS.uniprotKineticsUrl(bad), /형식이 아님|필요함/);
});
