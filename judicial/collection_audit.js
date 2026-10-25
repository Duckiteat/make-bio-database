'use strict';
// 사법부 — 수집(collection) 작업 검증 (설계 docs/design/work-verification.md · build-plan 작업 검증 노트)
//
// 읽기 전용·순수: 핸드오프 항목(JSONL 파싱 결과 배열) + db 를 받아 판정만 낸다. 파일 쓰기·엔진·입법 호출 없음.
// 원칙: 작업자 자기선언을 완료로 인정하지 않는다 — 완료는 이 판정기가 정한다.
//   자동으로 확인 가능한 조건만 PASS. 내용 진실(인용이 원문에 있나·DOI 해석·관련성)은 자동 불가 →
//   REVIEW_REQUIRED 로 통합가/사람에게 넘긴다(엔진 형식으로 다 막는 척하지 않기).
// 지금 자동으로 되는 것: 인용–원문 대조(부르는 쪽이 수신함 원문을 넘길 때, build-plan 58) · 구조·필드 완전성 · "검색/못찾음/접근불가/읽음/값있음" 구별 · 출처 형식 ·
//   근거 없는 값 거부 · 상태-내용 불일치 거부 · 재사용 대상의 db 존재·철회 확인(결정론 재-도출).
//
// 항목(entry) 계약:
//   { target?, outcome, value?, unit?, species?, cell?, time?, uncertainty?, use?,
//     source?: {db,id}, pmcid?, quote?, transcribed?: bool(그림·표 전사), verified?: bool, reuse?: {ref}, note? }
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
//   opt.sourceChecks: { 'DOI:10.x/y': 'resolves'|'notfound'|'error' } — dbtool 이 HTTP 로 확인해 넘긴다(순수층은 판정만)
function auditEntry(db, e, i, opt = {}) {
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
    // 출처 해석(존재) 확인 — dbtool 이 HTTP 로 확인해 넘긴 결과. 존재 안 하면 가짜/오기(꼼수 #4), 확인 실패는 통합가로.
    const st = (opt.sourceChecks || {})[`${src.db}:${src.id}`];
    if (st === 'notfound') push('reject', `출처가 해석되지 않음 — 존재하지 않는 ${src.db}: ${src.id} (가짜/오기)`);
    else if (st === 'error') push('review', `출처 해석 확인 실패(네트워크·접근) — 통합가 재확인: ${src.db} ${src.id}`);
  }
  // 상태-내용 구별: 값 없다고 선언한 outcome 에 값이 있으면 모순 (조사 안함 vs 못찾음 vs 접근불가 혼동 방지)
  if (NO_VALUE_OUTCOMES.includes(e.outcome) && hasValue) push('reject', `${e.outcome} 인데 값이 있음 — 상태와 내용 불일치`);

  // 인용–원문 대조 (build-plan 58, work-verification #5): 부르는 쪽이 수신함 원문을 넘기면(opt.texts) 인용이 글자 그대로 있는지 본다.
  //   전문이 있는데 없으면 거부(없는 인용), 초록만 있고 거기 없으면 사람 확인(전문에 있을 수 있음), 원문이 없으면 사람 확인.
  if (e.quote && hasSrc && opt.texts) {
    const q = quoteCheck(e.quote, opt.texts[`${src.db}:${src.id}`], { transcribed: e.transcribed === true });
    if (q.sev) push(q.sev, q.msg);
  }
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

// 원문 정규화 — 태그·엔터티를 걷고 같은 글자로 맞춘다 (대조는 정규화한 글 안의 부분 문자열).
//   전문 XML 은 참고문헌 목록(<ref-list>)을 뺀다 — 남의 논문 제목이 인용과 맞아도 이 논문의 문장이 아니다.
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', minus: '-', ndash: '-', mdash: '-', times: '×', plusmn: '±', micro: 'µ' };
function normText(raw) {
  return String(raw || '')
    .replace(/<ref-list[\s\S]*?<\/ref-list>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m)
    .normalize('NFKC')
    .replace(/[\u2010-\u2015\u2212\uFE63\uFF0D]/g, '-')
    .replace(/[\u2018\u2019\u201B\u2032]/g, "'").replace(/[\u201C\u201D\u2033]/g, '"')
    .replace(/\s+/g, ' ').trim().toLowerCase();
}
// 인용 하나 대 원문 { abstract?, fulltext? } (부르는 쪽이 수신함에서 읽어 넘김) → { where, sev?, msg? }
function quoteCheck(quote, texts, opt = {}) {
  if (opt.transcribed) return { where: null, sev: 'review', msg: '그림·표 전사 값 — 글로 대조할 수 없음, 사람이 원본 그림을 확인' };
  const q = normText(quote);
  if (q.length < 12) return { where: null, sev: 'review', msg: `인용이 너무 짧아(${q.length}자) 대조가 뜻이 없음 — 문장 단위로` };
  const t = texts || {};
  if (t.fulltext && normText(t.fulltext).includes(q)) return { where: 'fulltext' };
  if (t.abstract && normText(t.abstract).includes(q)) return { where: 'abstract' };
  if (t.fulltext) return { where: null, sev: 'reject', msg: '인용이 원문에 없음 — 수신함의 초록·전문 어디에도 같은 문장이 없다(없는 인용·고쳐 쓴 인용)' };
  if (t.abstract) return { where: null, sev: 'review', msg: '인용이 초록에 없음 — 전문이 수신함에 없어 확인할 수 없음(공개 전문이면 fetch_fulltext, 아니면 사람)' };
  return { where: null, sev: 'review', msg: '원문이 수신함에 없음 — 인용을 대조할 수 없음(fetch_abstract·fetch_fulltext 먼저)' };
}

// 전체 판정 — 작업자가 적어 둔 상태 선언은 무시하고 여기서 다시 정한다.
function auditCollection(db, entries, opt = {}) {
  const list = Array.isArray(entries) ? entries : [];
  const rows = list.map((e, i) => auditEntry(db, e, i, opt));
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

// 핸드오프 항목에서 확인할 출처 목록 (dbtool 이 HTTP 로 해석 확인할 대상)
function sourcesOf(entries) {
  const out = [];
  for (const e of (entries || [])) {
    const s = e && e.source;
    if (s && s.db && s.id) out.push({ db: s.db, id: String(s.id), key: `${s.db}:${s.id}` });
  }
  return out;
}

// 실행 기록(transcript) 파서 — best-effort. harness 내부 JSONL 형식이라 계약이 아니다: 알아보지 못하면 0 으로 둔다.
//   내 세션 서브에이전트에만 있다(외부에서 돌린 작업자 세션엔 없음). 실행 증거는 harness 가 찍은 것이지 작업자가 쓴 게 아니다.
const RUN_TOOLS = Object.freeze(['WebFetch', 'WebSearch', 'Read', 'Grep', 'Bash']);
function parseRunlog(text) {
  const uses = (String(text).match(/"type":"tool_use"/g) || []).length;
  const tools = {};
  for (const t of RUN_TOOLS) tools[t] = (String(text).match(new RegExp(`"name":"${t}"`, 'g')) || []).length;
  return { uses, tools, fetch: tools.WebFetch + tools.Read, search: tools.WebSearch };
}

// 주장 ↔ 실행 기록 교차 검사. 형식 미인식·false-negative 위험이 있어 reject 아닌 review 로 둔다(정직).
function crossCheckRun(entries, s) {
  const issues = [];
  const claimsRead = (entries || []).some((e) => e && (e.outcome === 'read_value' || (e.value != null && e.value !== '')));
  if (claimsRead && s.fetch === 0 && s.search === 0) issues.push({ sev: 'review', msg: '값/읽음 주장인데 실행 기록에 WebFetch·WebSearch·Read 가 0 — 실제 열람 여부 확인 필요(꼼수 #2)' });
  if (s.uses === 0) issues.push({ sev: 'review', msg: '실행 기록에 도구 호출 0 — transcript 가 비었거나 형식 미인식(검증 불가, 통과로 치지 않음)' });
  return issues;
}

// 받기 기록 검사 (build-plan 60): 사슬(seq·prev·root) + 성공한 받기의 파일이 지금도 같은 내용인가(sha256).
//   currentSha = { 파일(저장소 상대): 지금 sha256 | null(없음) } — 파일을 읽는 것은 부르는 쪽(사법부는 읽지 않음).
//   같은 파일을 다시 받으면 뒤 사건이 앞 사건을 대신한다(마지막 성공 사건이 기준).
const crypto = require('crypto');
const ATT = require('./attestation.js');
const FETCH_GENESIS = crypto.createHash('sha256').update('fetchlog\n').digest('hex');
function verifyFetchLog(events, currentSha) {
  const errors = []; let prev = FETCH_GENESIS; const last = new Map();
  (events || []).forEach((e, i) => {
    const { root, ...body } = e;
    if (e.seq !== i + 1) errors.push(`사건 ${i + 1}: seq ${e.seq} — 빠지거나 끼운 사건`);
    if (e.prev !== prev) errors.push(`사건 ${i + 1}: prev 가 직전 root 와 다름 — 사슬이 끊김`);
    if (root !== crypto.createHash('sha256').update(body.prev + '\n' + ATT.canon(body)).digest('hex')) errors.push(`사건 ${i + 1}: root 재계산 불일치 — 기록이 바뀜`);
    if (e.ok && e.file && e.sha256) last.set(e.file, e);
    prev = root;
  });
  for (const [file, e] of last) {
    const now = (currentSha || {})[file];
    if (now === null || now === undefined) errors.push(`${file}: 받기 기록에 있는데 파일이 없음 (사건 ${e.seq})`);
    else if (now !== e.sha256) errors.push(`${file}: 받은 뒤 내용이 바뀜 — 기록 ${e.sha256.slice(0, 12)}… · 지금 ${now.slice(0, 12)}… (사건 ${e.seq})`);
  }
  return { ok: !errors.length, errors, events: (events || []).length, files: last.size, head: prev };
}

module.exports = { STATUSES, OUTCOMES, USES, auditEntry, auditCollection, auditText, sourcesOf, parseRunlog, crossCheckRun, verifyFetchLog, FETCH_GENESIS, normText, quoteCheck };
