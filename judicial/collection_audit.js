'use strict';
// 사법부 — 수집(collection) 작업 검증 (설계 docs/design/work-verification.md · build-plan 작업 검증 노트)
//
// 읽기 전용·순수: 핸드오프 항목(JSONL 파싱 결과 배열) + db 를 받아 판정만 낸다. 파일 쓰기·엔진·입법 호출 없음.
// 원칙: 작업자 자기선언을 완료로 인정하지 않는다 — 완료는 이 판정기가 정한다.
//   자동으로 확인 가능한 조건만 PASS. 내용 진실(인용이 원문에 있나·DOI 해석·관련성)은 자동 불가 →
//   REVIEW_REQUIRED 로 통합가/사람에게 넘긴다(엔진 형식으로 다 막는 척하지 않기).
// 지금 자동으로 되는 것: 구조·필드 완전성 · "검색/못찾음/접근불가/읽음/값있음" 구별 · 출처 형식 ·
//   근거 없는 값 거부 · 상태-내용 불일치 거부 · 재사용 대상의 db 존재·철회 확인(결정론 재-도출).
//
// 항목(entry) 계약:
//   { target?, outcome, value?, unit?, species?, cell?, time?, uncertainty?, use?,
//     source?: {db,id}, quote?, verified?: bool, reuse?: {ref}, note? }
//   outcome ∈ not_searched|not_found|unreadable|read_no_value|read_value|ambiguous|reused

const STATUSES = Object.freeze(['PASS', 'INCOMPLETE', 'BLOCKED', 'REJECTED', 'REVIEW_REQUIRED']);
const OUTCOMES = Object.freeze(['not_searched', 'not_found', 'unreadable', 'read_no_value', 'read_value', 'ambiguous', 'reused']);
const USES = Object.freeze(['estimation', 'validation']);
const NO_VALUE_OUTCOMES = Object.freeze(['not_searched', 'not_found', 'unreadable', 'read_no_value']);

function findRec(db, ref) {
  if (typeof ref !== 'string') return null;
  if (/^O/.test(ref)) return (db.observations || {})[ref] || null;
  if (/^D/.test(ref)) return (db.senses || {})[ref] || null;
  return null;
}

// 한 항목 판정 — issues: { sev: 'reject'|'incomplete'|'review', msg }
function auditEntry(db, e, i) {
  const issues = [];
  const id = e && e.id ? String(e.id) : `#${i + 1}`;
  const push = (sev, msg) => issues.push({ sev, msg });
  if (!e || typeof e !== 'object') { return { id, outcome: null, issues: [{ sev: 'incomplete', msg: '항목이 객체가 아님' }] }; }

  if (!OUTCOMES.includes(e.outcome)) push('incomplete', `outcome 미선언/어휘 밖 (${OUTCOMES.join('|')})`);
  if (e.use != null && !USES.includes(e.use)) push('incomplete', `use 어휘 밖 (${USES.join('|')})`);

  const hasValue = e.value != null && e.value !== '';
  const src = e.source || {};
  const hasSrc = !!(src.db && src.id);

  // 값 주장엔 출처 + 원문 인용 필수 (꼼수 #3 검토 안 함·#5 없는 인용·#8 미확인을 사실처럼)
  if (e.outcome === 'read_value' || hasValue) {
    if (!hasValue) push('incomplete', 'read_value 인데 값(value) 없음');
    if (!hasSrc) push('reject', '값을 주장하는데 출처(source.db+id) 없음 — 근거 없는 값');
    if (!e.quote) push('reject', '값을 주장하는데 원문 인용(quote) 없음');
  }
  // 출처 형식만 (해석·원문 대조는 통합가, 자동 불가)
  if (hasSrc) {
    if (src.db === 'DOI' && !/\S\/\S/.test(String(src.id))) push('reject', `DOI 형식 아님: ${src.id}`);
    if (src.db === 'PMID' && !/^\d+$/.test(String(src.id))) push('reject', `PMID 형식 아님: ${src.id}`);
  }
  // 상태-내용 구별: 값 없다고 선언한 outcome 에 값이 있으면 모순 (조사 안함 vs 못찾음 vs 접근불가 혼동 방지)
  if (NO_VALUE_OUTCOMES.includes(e.outcome) && hasValue) push('reject', `${e.outcome} 인데 값이 있음 — 상태와 내용 불일치`);

  // 값 후보는 통합가 1차 출처 재확인 전까지 자동 PASS 금지 (꼼수 #13)
  if (hasValue && e.verified !== true) push('review', '값 후보 — 1차 출처 재확인 필요(통합가)');

  // 재사용 (꼼수 #12): 기존 db 대상의 존재·철회를 결정론으로 재-도출
  if (e.outcome === 'reused' || e.reuse) {
    const ref = (e.reuse && e.reuse.ref) || e.ref;
    if (!ref) push('incomplete', 'reused 인데 재사용 대상(reuse.ref) 없음');
    else {
      const rec = findRec(db, ref);
      if (!rec) push('reject', `재사용 대상 ${ref} 가 db 에 없음 — 무효 재사용`);
      else if (rec.retracted) push('reject', `재사용 대상 ${ref} 는 철회됨 — 무효 재사용`);
    }
  }
  return { id, outcome: e.outcome || null, issues };
}

// 전체 판정 — 작업자가 적어 둔 상태 선언은 무시하고 여기서 다시 정한다.
function auditCollection(db, entries, opt = {}) {
  const list = Array.isArray(entries) ? entries : [];
  const rows = list.map((e, i) => auditEntry(db, e, i));
  const all = rows.flatMap((r) => r.issues.map((x) => ({ ...x, id: r.id })));
  const has = (sev) => all.some((x) => x.sev === sev);

  let verdict;
  if (!list.length) verdict = 'INCOMPLETE';
  else if (has('reject')) verdict = 'REJECTED';
  else if (has('incomplete')) verdict = 'INCOMPLETE';
  else if (rows.every((r) => r.outcome === 'unreadable')) verdict = 'BLOCKED';
  else if (has('review')) verdict = 'REVIEW_REQUIRED';
  else verdict = 'PASS';

  return { verdict, n: list.length, rows, issues: all };
}

function auditText(res) {
  const out = [`수집 검증: ${res.verdict} (항목 ${res.n})`];
  if (res.verdict === 'PASS') out.push('  자동 확인 조건 충족 — 과학적 진실·승인은 아님.');
  if (res.verdict === 'REVIEW_REQUIRED') out.push('  구조는 통과, 값 후보는 통합가 1차 출처 재확인 필요.');
  for (const r of res.rows) {
    if (!r.issues.length) continue;
    out.push(`  [${r.id}] ${r.outcome || '?'}`);
    for (const x of r.issues) out.push(`    · (${x.sev}) ${x.msg}`);
  }
  return out.join('\n');
}

module.exports = { STATUSES, OUTCOMES, USES, auditEntry, auditCollection, auditText };
