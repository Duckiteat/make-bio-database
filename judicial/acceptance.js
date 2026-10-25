// 사법부 — 인정 (Acceptance, build-plan 72): 인정은 기록 하나가 아니라 (기록, 용도) 순서쌍이다.
//   인정 = 축 조건(S·D·T, reliability.items 의 계산값) ∧ 관계 조건(종 · 추정에 쓰지 않음) ∧ (높은 용도는) 승인 도장.
//   용도 다섯 — describe 서술 · compare 비교 · estimate 추정 · evidence 검증 근거 · standard 기준 (라벨은 vocab.acceptanceUses).
//   서술·비교·추정은 계산만으로, 검증 근거·기준은 승인 도장(claim 'accept')이 있어야 한다. 승인은 축 조건을 넘지 못한다 —
//   축이 내려가면 도장이 있어도 '인정 재검토 필요'(review) 다. 관찰의 use 는 신청이지 인정이 아니다.
//   등급 6칸은 자동 인정의 상한으로 읽힌다: anchor·parameter → 추정 · bounded → 추정(조건부) · legacy → 비교 · reference → 서술(S3D2 는 비교까지) · blocked → 없음.
// 이 파일은 계산·검증만 한다. 승인 도장을 등록부에 쓰는 것은 입법 서기(legislative/clerk.mjs)뿐이다.
'use strict';
const M = require('../model.js');
const REL = require('./reliability.js');
const ATT = require('./attestation.js');

const ISSUER = 'judicial/acceptance.js';
const { USES, accept } = REL; // 용도별 판정은 reliability 하나 — 관문(constantVerdict)과 같은 함수 (build-plan 74)
const HIGH = Object.keys(USES).filter((u) => USES[u].approval);
const APPROVERS = ['human', 'integrator']; // 승인할 수 있는 역할 (2026-10-25 결정: 통합 에이전트도 — 사람은 나중에 철회할 수 있다)

// 추정에 쓰인 관찰: use 가 estimation 이거나, 어떤 값(속도 상수·정의항 obs)의 from 이 가리킴
function estimatedObservations(db) {
  const out = new Set(Object.entries(db.observations || {}).filter(([, o]) => o.use === 'estimation').map(([id]) => id));
  for (const s of Object.values(db.senses)) {
    for (const r of s.rule || []) for (const f of [].concat((r.kinetics || {}).from || [])) out.add(f);
    for (const o of s.obs || []) if (o.from) out.add(o.from);
  }
  return out;
}

const subjectOf = (id, use) => ({ sense: id, field: 'accept', ns: use, value: id });
const keyOf = (id, use) => ATT.subjectKey(subjectOf(id, use));

// 승인 도장: { subject, claim 'accept', verdict 'approved'|'revoked', by, reason, issuer, issued_at, digest }
function issue({ id, use, by, reason, date, verdict }) {
  const st = { subject: subjectOf(id, use), claim: 'accept', verdict: verdict || 'approved', by, reason, issuer: { module: ISSUER }, issued_at: date };
  st.digest = ATT.digestOf(st);
  return st;
}
// 도장 검증: 형식 · digest · 역할 · 높은 용도 · 이유 · (승인이면) 지금 축·관계 조건을 넘는가. 승인이 축 조건을 넘을 수 없다
function verifyAcceptStamp(st, db, opt) {
  opt = opt || {};
  const key = st && st.subject ? ATT.subjectKey(st.subject) : '?', reasons = [];
  if (!st || st.claim !== 'accept' || !st.subject || st.subject.field !== 'accept') return { ok: false, reasons: ['형식이 아님'], key };
  if (ATT.digestOf(st) !== st.digest) reasons.push('digest 불일치 — 도장이 발급 뒤 바뀜(변조)');
  if (!HIGH.includes(st.subject.ns)) reasons.push(`승인이 필요한 용도가 아님 '${st.subject.ns}' — ${HIGH.join(' | ')}`);
  if (!APPROVERS.includes(st.by)) reasons.push(`승인 역할 '${st.by}' — ${APPROVERS.join(' | ')} 만`);
  if (!['approved', 'revoked'].includes(st.verdict)) reasons.push(`판정 '${st.verdict}' — approved | revoked`);
  if (!String(st.reason || '').trim()) reasons.push('이유가 없음 — 승인·철회는 이유를 적는다');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(st.issued_at || ''))) reasons.push('발급일 형식이 아님 (YYYY-MM-DD)');
  // 승인의 주체는 관찰 기록(O…)만 — 검증 근거는 관찰이고, 기준(standard)은 I 축 전까지 어떤 기록도 닿지 못한다
  if (!/^O\d{6}$/.test(String(st.subject.sense)) || st.subject.value !== st.subject.sense) reasons.push(`승인 주체는 관찰 번호(O…) — '${st.subject.sense}'`);
  const base = opt.base || M.normalize(db);
  if (!reasons.length && !base.observations[st.subject.sense]) return { ok: false, stale: true, reasons: ['주체가 데이터에 없음 — 지난 도장'], key };
  // 발급 검사(opt.ctx 가 있을 때): 승인은 지금 축·관계 조건을 넘는 것에만
  if (!reasons.length && st.verdict === 'approved' && opt.ctx) {
    if (!opt.row) reasons.push('관찰의 신뢰 지표 행이 없음');
    else { const a = accept(opt.row, st.subject.ns, { ...opt.ctx, approvals: new Map() }); if (a.status === 'rejected') reasons.push(`승인은 축·관계 조건을 넘지 못한다: ${a.reasons.join(' · ')}`); }
  }
  return { ok: !reasons.length, reasons, key };
}

// 발급 검사(서기가 부름): 도장 자체 + 지금 축·관계 조건. itemsOpt = reliability.items 의 opt(도장·문헌 상태·추세)
function checkIssue(st, db, itemsOpt) {
  const t = table(db, { ...(itemsOpt || {}), registry: { stamps: [] } });
  const hit = st && st.subject ? t.rows.find((x) => x.row.what === 'observation' && x.row.sense === st.subject.sense) : null;
  return verifyAcceptStamp(st, db, { row: hit ? hit.row : null, ctx: t.ctx });
}

// 전체 표: 행마다 다섯 용도의 인정. opt = reliability.items 와 같은 것(attestations·stamps·literature·trend) + registry
function table(db, opt) {
  opt = opt || {};
  const base = M.normalize(db), rows = opt.rows || REL.items(db, opt);
  const ctx = { db: base, ref: String(M.VOCAB.defaultReferenceSpecies), estimated: estimatedObservations(base), approvals: new Map() };
  const bad = [];
  // 축 조건은 여기서 묻지 않는다 — 발급 때 서기가 막고, 그 뒤 축이 내려간 것은 accept 가 review 로 드러낸다(도장은 남김)
  for (const st of ((opt.registry || {}).stamps || []).filter((x) => x.claim === 'accept')) {
    const v = verifyAcceptStamp(st, db, { base });
    // 등록부 순서(같은 주체는 추가된 순서)대로 — 마지막 도장이 유효: 승인은 넣고 철회는 뺀다
    const k = `${st.subject.sense}|${st.subject.ns}`;
    if (v.ok && st.verdict === 'approved') ctx.approvals.set(k, st);
    else if (v.ok && st.verdict === 'revoked') ctx.approvals.delete(k);
    else if (!v.ok) bad.push({ key: v.key, reasons: v.reasons });
  }
  const out = rows.map((r) => ({ row: r, uses: Object.fromEntries(Object.keys(USES).map((u) => [u, accept(r, u, ctx)])) }));
  return { rows: out, invalid: bad, ctx };
}
// 자동 인정의 상한: 승인 없이 오를 수 있는 가장 높은 용도
const AUTO = ['estimate', 'compare', 'describe'];
const autoTop = (x) => AUTO.find((u) => x.uses[u].ok) || null;

// 결론은 가장 약한 근거를 따른다: 근거 관찰들 중 하나라도 검증 근거로 인정되지 않으면 그 결론은 인정 재검토 필요
function weakest(t, ids) {
  const by = new Map(t.rows.filter((x) => x.row.what === 'observation').map((x) => [x.row.sense, x.uses.evidence]));
  const missing = ids.filter((id) => !(by.get(id) || {}).ok).map((id) => ({ id, status: (by.get(id) || { status: 'rejected' }).status, reasons: (by.get(id) || { reasons: ['관찰이 없음'] }).reasons }));
  return { ok: !missing.length, missing };
}

function summary(t) {
  const n = {};
  for (const u of Object.keys(USES)) { n[u] = {}; for (const x of t.rows) { const s = x.uses[u].status; n[u][s] = (n[u][s] || 0) + 1; } }
  return n;
}
function text(t) {
  const UL = M.labelsOf(M.VOCAB.acceptanceUses), sm = summary(t), ST = ['accepted', 'conditional', 'needs_approval', 'review', 'rejected'];
  const L = [`# 인정 (Acceptance) — 기록 ${t.rows.length} × 용도 ${Object.keys(USES).length}`, '', '인정은 (기록, 용도) 순서쌍이다. 서술·비교·추정은 계산으로, 검증 근거·기준은 승인 도장이 있어야 한다. 승인은 축 조건을 넘지 못한다.', ''];
  L.push(`| 용도 | ${ST.join(' | ')} |`, `|---|${ST.map(() => '---').join('|')}|`);
  for (const u of Object.keys(USES)) L.push(`| ${u} ${UL[u]} | ${ST.map((s) => sm[u][s] || 0).join(' | ')} |`);
  const top = {}; for (const x of t.rows) { const k = autoTop(x) || '없음'; top[k] = (top[k] || 0) + 1; }
  L.push('', `자동 인정의 상한(승인 없이): ${['estimate', 'compare', 'describe', '없음'].map((k) => `${k === '없음' ? k : UL[k]} ${top[k] || 0}`).join(' · ')}`);
  const appr = t.rows.filter((x) => HIGH.some((u) => x.uses[u].approval));
  if (appr.length) {
    L.push('', '## 승인된 높은 용도', '', '| 기록 | 용도 | 상태 | 승인 | 이유 |', '|---|---|---|---|---|');
    for (const x of appr) for (const u of HIGH) if (x.uses[u].approval) L.push(`| ${x.row.sense} | ${UL[u]} | ${x.uses[u].status} | ${x.uses[u].approval.by} ${x.uses[u].approval.at} | ${x.uses[u].approval.reason}${x.uses[u].reasons.length ? ` · **재검토:** ${x.uses[u].reasons.join(' · ')}` : ''} |`);
  }
  if (t.invalid.length) { L.push('', `## 무효 승인 도장 ${t.invalid.length}`, ''); for (const b of t.invalid) L.push(`- ${b.key}: ${b.reasons.join(' · ')}`); }
  return L.join('\n');
}

module.exports = { ISSUER, USES, HIGH, APPROVERS, accept, issue, verifyAcceptStamp, checkIssue, table, weakest, summary, text, autoTop, keyOf, estimatedObservations };
