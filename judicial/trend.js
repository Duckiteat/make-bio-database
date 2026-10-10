// 사법부 — 추세 점검 (Trend Check). 신뢰 지표(judicial/reliability.js)의 **시간 축**.
//
// 왜: S(출처)와 D(성질)만으로는 "그때 맞았다" 까지만 말할 수 있다. 등급 `anchor`(기준값)는 "지금도 합의와 같다" 를 요구한다.
// 어떻게: 웹 검색 결과를 상태로 저장하지 않는다 — 재현되지 않기 때문이다. 대신 **같은 확인을 더 새 원본에 다시 돌린다**:
//   ① 점검 대상: 유효한 신원 도장이 있는 주체(외부 ID·지문) — 도장이 없으면 추세를 물을 값이 아니다.
//   ② 합의 수신함(data/fetched/consensus/)에 원본을 다시 받는다. 신원 수신함(data/fetched/)은 도장의 증거이므로 덮지 않는다.
//   ③ 판정: 그 새 원본으로 신원 확인을 다시 돌려 같은 결론이 나오면 `match`, 결론이나 값이 달라지면 `mismatch`, 원본이 없으면 `unchecked`.
//   ④ 기록: 날짜가 박힌 도장(claim 'trend') — 주체·판정·증거 파일 sha256·점검일·발급 모듈 코드 sha256. 재검증은 digest + 증거 sha256 + 같은 판정 재실행.
// 도장은 영구하지 않다: 점검일이 합의 창(vocab consensus.window_days)보다 오래되면 다시 `unchecked` 가 되어 anchor 가 내려간다.
// `mismatch` 는 값을 지우라는 뜻이 아니다 — 등급이 `legacy`(지난값)로 내려가고 `Consensus_Gap` 한계로 등록한다 (지난값은 비교에 쓴다).
// 이 파일은 판정만 한다: 받기·쓰기 없음(받기·등록부 쓰기는 입법 서기 legislative/clerk.mjs).
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const M = require('../model.js');
const ID = require('./identity.js');
const ATT = require('./attestation.js');
const V = M.VOCAB;

const CONSENSUS = 'data/fetched/consensus';
const ISSUER = 'judicial/trend.js';
const VERDICTS = { match: '합의와 같음', mismatch: '합의와 다름 — 지난값', unchecked: '점검하지 않음' };
const sha = (x) => crypto.createHash('sha256').update(x).digest('hex');
const codeSha = () => sha(fs.readFileSync(path.join(__dirname, 'trend.js')));
const day = (s) => Math.floor(Date.parse(s + (/T/.test(s) ? '' : 'T00:00:00Z')) / 86400000);
const windowDays = () => V.consensus.window_days;

// 점검 대상: 유효한 신원 도장(claim 'verified')의 주체. 도장 없는 값은 S 가 이미 낮으므로 추세를 물을 자리가 아니다.
function subjects(db, registry, opt) {
  opt = opt || {};
  const only = opt.only ? new Set(opt.only) : null, out = [];
  for (const st of (registry || ATT.emptyRegistry()).stamps) {
    if (st.claim !== 'verified') continue;
    if (only && !only.has(ATT.subjectKey(st.subject))) continue;
    const v = ATT.verifyStamp(st, db, opt);
    if (!v.ok) continue;
    out.push({ key: v.key, subject: st.subject, kind: st.evidence.kind, task: st.evidence.key, identityEvidence: st.evidence, issued_at: st.issued_at });
  }
  return out;
}

// 같은 확인을 다시 돌리기 위한 사본: verified 를 asserted 로 되돌려 보강 고리가 과제를 내게 한다 (데이터는 고치지 않는다 — 사본)
function resetDB(db) {
  const d = M.normalize(JSON.parse(JSON.stringify(M.normalize(db))));
  for (const s of Object.values(d.senses)) for (const x of s.xrefs) if (x.status === 'verified') x.status = 'asserted';
  return d;
}

// ② 받을 과제 (합의 수신함) — 받기는 입법 서기가 한다
function plan(db, opt) {
  opt = opt || {};
  const dir = opt.dir || CONSENSUS, want = new Set(subjects(db, opt.registry, opt).map((s) => `${s.kind}|${s.task}`));
  return ID.plan(resetDB(db), { dir }).filter((t) => want.has(`${t.kind}|${t.key}`) || t.kind === 'rhea_usage' || t.kind === 'chebi_entity');
}

// ③ 판정
// 같은 (데이터, 합의 수신함, 날짜)면 같은 판정이다 — 도장마다 다시 돌리지 않도록 기억한다 (순수 함수의 메모, 상태 아님).
const MEMO = new Map();
function check(db, opt) {
  opt = Object.assign({ dir: CONSENSUS, today: new Date().toISOString().slice(0, 10) }, opt || {});
  const memoKey = `${opt.dir}|${opt.today}|${sha(JSON.stringify(db))}`;
  if (opt.memo !== false && MEMO.has(memoKey)) return MEMO.get(memoKey);
  const base = M.normalize(db), ix = M.index(base);
  const subs = subjects(base, opt.registry, opt);
  const done = (r) => { if (opt.memo !== false) MEMO.set(memoKey, r); return r; };
  if (!subs.length) return done({ rows: [], n: 0, byVerdict: {}, window: windowDays(), today: opt.today, tasks: [] });
  const reset = resetDB(base);
  const { rows: idRows, tasks } = ID.verifyIdentity(reset, { dir: opt.dir });
  const rows = [];
  for (const s of subs) {
    const r = idRows.find((x) => x.sense === s.subject.sense && x.kind === s.kind && x.key === s.task);
    const o = { key: s.key, sense: s.subject.sense, label: ix.label(s.subject.sense), field: s.subject.field, ns: s.subject.ns, value: s.subject.value, stamped_at: s.issued_at };
    if (!r || r.outcome === 'missing') rows.push({ ...o, verdict: 'unchecked', detail: `합의 수신함에 새 원본이 없음 (${path.join(opt.dir, ID.fileOf(s.kind, s.task))})` });
    else if (r.outcome !== 'verified') rows.push({ ...o, verdict: 'mismatch', detail: `새 원본으로 같은 확인을 다시 돌리니 ${r.outcome}: ${r.detail}`, evidence: r.file ? { kind: s.kind, key: s.task, file: path.relative(process.cwd(), r.file) || r.file, sha256: sha(fs.readFileSync(r.file, 'utf8')) } : undefined });
    else {
      // 확인은 다시 통과했다 — 이제 그 도장이 주장하는 값이 새 원본에서도 같은지
      const now = s.subject.field === 'xref' ? r.facts.id : s.subject.ns === 'SEQ_SHA256' ? r.facts.seqHash : r.facts.inchikey;
      const same = now && now === s.subject.value;
      const ver = r.facts.entryVersion || r.facts.sequenceVersion ? ` · 원본 판 ${r.facts.entryVersion || '?'}/${r.facts.sequenceVersion || '?'}` : '';
      rows.push({ ...o, verdict: same ? 'match' : 'mismatch', evidence: { kind: s.kind, key: s.task, file: r.evidence.file, sha256: r.evidence.sha256 },
        detail: same ? `새 원본에서도 ${s.subject.ns} ${String(s.subject.value).slice(0, 16)}${String(s.subject.value).length > 16 ? '…' : ''} — ${r.detail}${ver}` : `새 원본의 값 ${String(now).slice(0, 16)}… ≠ 저장된 값 ${String(s.subject.value).slice(0, 16)}…${ver}` });
    }
  }
  rows.sort((a, b) => a.key.localeCompare(b.key));
  const byVerdict = {};
  for (const r of rows) byVerdict[r.verdict] = (byVerdict[r.verdict] || 0) + 1;
  return done({ rows, n: rows.length, byVerdict, window: windowDays(), today: opt.today, tasks: tasks.filter((t) => !t.present) });
}

// ④ 도장 — 점검한 행(match·mismatch)마다. unchecked 는 기록할 사실이 없다.
function issue(rows, date) {
  const code = codeSha();
  return rows.filter((r) => r.verdict !== 'unchecked' && r.evidence).map((r) => {
    const st = { subject: { sense: r.sense, field: 'trend', ns: r.ns, value: r.value }, claim: 'trend', verdict: r.verdict,
      evidence: { kind: r.evidence.kind, key: r.evidence.key, file: r.evidence.file, sha256: r.evidence.sha256 },
      checks: r.detail, issuer: { module: ISSUER, code_sha256: code }, issued_at: date };
    st.digest = ATT.digestOf(st);
    return st;
  });
}

// 신뢰 지표가 읽는 추세 축: 주체 열쇠 → 'match' | 'mismatch'. 창을 넘긴 도장은 넣지 않는다 (= unchecked).
function verdicts(db, registry, opt) {
  opt = Object.assign({ today: new Date().toISOString().slice(0, 10) }, opt || {});
  const out = {}, expired = [], w = windowDays();
  for (const st of (registry || ATT.emptyRegistry()).stamps) {
    if (st.claim !== 'trend') continue;
    // 판정 재실행은 합의 수신함 한 번만 — 도장마다 다시 돌리지 않는다 (같은 폴더·같은 날이면 같은 결과)
    const v = verifyTrendStamp(st, db, { ...opt, registry });
    if (!v.ok) continue;
    const age = day(opt.today) - day(st.issued_at);
    // 추세 점검은 상하지 않는 사실이 아니다 — 창(일)을 넘기면 다시 '점검하지 않음' 이다
    if (age > w) { expired.push({ key: v.key, age }); continue; }
    out[`${st.subject.sense}|${st.subject.ns}:${st.subject.value}`] = st.verdict;
  }
  return { map: out, expired, window: w, today: opt.today };
}

// 추세 도장 검증: digest · 증거 파일 sha256 · 같은 판정 재실행
function verifyTrendStamp(st, db, opt) {
  opt = Object.assign({ reverify: true, root: process.cwd() }, opt || {});
  const reasons = [], key = ATT.subjectKey(st.subject || {});
  if (!st || !st.subject || st.claim !== 'trend' || !VERDICTS[st.verdict]) return { ok: false, reasons: ['형식이 아님'], key };
  if (ATT.digestOf(st) !== st.digest) reasons.push('digest 불일치 — 도장이 발급 뒤 바뀜(변조)');
  if (opt.reverify && !reasons.length) {
    const file = path.resolve(opt.root, st.evidence.file);
    if (!fs.existsSync(file)) reasons.push(`증거 파일 없음 (${st.evidence.file})`);
    else if (sha(fs.readFileSync(file, 'utf8')) !== st.evidence.sha256) reasons.push('증거 파일 sha256 불일치');
    else {
      const rel = ID.fileOf(st.evidence.kind, st.evidence.key), dir = file.replace(/\.(json|fasta|txt|tsv)$/, '').slice(0, -rel.length - 1);
      const r = check(db, { dir, registry: opt.registry || ATT.readRegistry(opt.root), root: opt.root, today: opt.today });
      const row = r.rows.find((x) => x.sense === st.subject.sense && x.ns === st.subject.ns && x.value === st.subject.value);
      if (!row) return { ok: false, stale: true, reasons: ['주체가 데이터에 없음 — 지난 도장 (그 값이 데이터에서 빠졌음, 위조가 아님)'], key };
      if (row.verdict !== st.verdict) reasons.push(`재판정 ${row.verdict} ≠ 도장 ${st.verdict} (${row.detail})`);
    }
  }
  return { ok: !reasons.length, reasons, key };
}

// mismatch → Consensus_Gap 후보 (값을 지우지 않고 지난값으로 남긴다 — 왜 달라졌는지가 데이터다)
function gapCandidates(db, rows) {
  const base = M.normalize(db), covered = new Set();
  // 덮인 것은 Consensus_Gap 으로 등록된 대상만이다 — 다른 종류의 한계(속도·구조)가 같은 정의항에 있다고 합의 공백이 닫히지 않는다
  for (const l of Object.values(base.limitations)) if (l.type === 'Consensus_Gap') { covered.add(l.target); for (const n of l.requirement.needs) if (n.on) covered.add(n.on); }
  return rows.filter((r) => r.verdict === 'mismatch' && !covered.has(r.sense))
    .map((r) => ({ target: r.sense, type: 'Consensus_Gap', why: `${r.label}: ${r.ns} ${r.value} 가 합의와 다름 — ${r.detail}` }));
}

function text(r, opt) {
  opt = opt || {};
  const L = [`# 추세 점검 (Trend Check) — 주체 ${r.n}, 합의 창 ${r.window}일, 점검일 ${r.today}`, ''];
  L.push('추세 점검은 웹 검색 결과를 저장하지 않는다 — 더 새 원본을 합의 수신함에 받아 **같은 확인을 다시 돌린** 결과다. 창을 넘긴 도장은 다시 `unchecked` 이므로 `anchor` 는 영구하지 않다.', '');
  L.push('| 판정 | 뜻 | 수 |', '|---|---|---|');
  for (const k of ['match', 'mismatch', 'unchecked']) L.push(`| ${k} | ${VERDICTS[k]} | ${r.byVerdict[k] || 0} |`);
  const show = r.rows.filter((x) => opt.all || x.verdict !== 'unchecked');
  if (show.length) {
    L.push('', `## 점검한 주체 ${show.length}`, '', '| 정의항 | 주체 | 판정 | 근거 |', '|---|---|---|---|');
    for (const x of show.slice(0, opt.limit || 60)) L.push(`| ${x.sense} ${x.label} | ${x.field} ${x.ns} | ${x.verdict} | ${x.detail} |`);
    if (show.length > (opt.limit || 60)) L.push(`| … | 그 밖 ${show.length - (opt.limit || 60)} 개 | | |`);
  }
  if (r.tasks.length) {
    L.push('', `## 합의 수신함에 받을 원본 ${r.tasks.length}`, '', '받기는 입법 서기가 한다: `node dbtool.mjs trend --fetch`. 막히면 아래 주소의 응답을 그대로 저장 위치에 둔다.', '', '| 정의항 | 과제 | 주소 | 저장 위치 |', '|---|---|---|---|');
    for (const t of r.tasks.slice(0, 40)) L.push(`| ${t.sense} ${t.label} | ${t.why} | <${t.urls[0]}> | \`${t.file}.json\` |`);
  }
  return L.join('\n');
}

module.exports = { CONSENSUS, VERDICTS, subjects, resetDB, plan, check, issue, verdicts, verifyTrendStamp, gapCandidates, text, windowDays };
