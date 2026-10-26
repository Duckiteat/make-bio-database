// 사법부 — 사전 봉인 (build-plan 16A · 설계 docs/design/dictionary-and-translation.md §3 "사전 자체가 데이터이고 관문이 지킨다")
//
// data/dictionary.jsonl 은 추가만 하는 사슬이다: 사건 = { seq, at, register, key, label_en, meaning_en, xref, since, revises?, prev } ·
//   root = sha256(prev + '\n' + 정준 JSON). 고치기는 지우지 않고 revises(그 토큰의 현재 root)를 단 새 사건으로 — 마지막 사건이 현재 값.
// 이 파일은 판정만 한다(읽기·쓰기 없음): 사슬 무결성 · 새 항목 검사(서기가 쓰기 전) · 덮임(vocab 토큰마다 영어가 있나).
'use strict';
const crypto = require('crypto');
const ATT = require('./attestation.js');
const V = require('../vocab.js');
const D = require('../dictionary.js');
const sha = (x) => crypto.createHash('sha256').update(x).digest('hex');
const GENESIS = sha('dictionary\n');
const PROPOSAL_FIELDS = ['register', 'key', 'label_en', 'meaning_en', 'xref', 'since', 'revises'];
const qid = (e) => `${e.register}/${e.key}`;
const nonEmpty = (s) => typeof s === 'string' && s.trim().length > 0;

function verifyChain(events) {
  const errors = [], rules = [], err = (rule, m) => { errors.push(m); rules.push(rule); }; let prev = GENESIS;
  events.forEach((e, i) => {
    const { root, ...body } = e;
    if (e.seq !== i + 1) err('RULE-0506', `사건 ${i + 1}: seq ${e.seq} — 빠지거나 끼운 사건`);
    if (e.prev !== prev) err('RULE-0506', `사건 ${i + 1}: prev 가 직전 root 와 다름 — 사슬이 끊김`);
    if (root !== sha(body.prev + '\n' + ATT.canon(body))) err('RULE-0506', `사건 ${i + 1} (${qid(e)}): root 재계산 불일치 — 내용이 바뀜`);
    prev = root;
  });
  return { ok: !errors.length, errors, rules, head: prev };
}

// 토큰마다 현재 사건 (revises 사슬의 끝). 사슬 안의 revises 가 그때의 현재 root 를 가리키지 않으면 오류
function current(events) {
  const cur = new Map(), errors = [], rules = [], err = (rule, m) => { errors.push(m); rules.push(rule); };
  for (const e of events) {
    const had = cur.get(qid(e));
    if (had && e.revises !== had.root) err('RULE-0506', `${qid(e)} 사건 ${e.seq}: 이미 있는 토큰인데 revises 가 현재 root 가 아님`);
    if (!had && e.revises) err('RULE-0506', `${qid(e)} 사건 ${e.seq}: 없는 토큰을 revises`);
    cur.set(qid(e), e);
  }
  return { cur, errors, rules };
}

// 렌더 모호 — 두 토큰이 같은 렌더 문자열(en · en (ko) · ko)을 쓰면 역색인 회수가 깨진다
function ambiguity(cur) {
  const seen = new Map(), out = [];
  const add = (s, id) => { if (seen.has(s) && seen.get(s) !== id) out.push(`렌더 '${s}' 가 ${seen.get(s)} 와 ${id} 둘에서 나옴`); else seen.set(s, id); };
  for (const r of D.registers) for (const [k, b] of Object.entries(V[r])) {
    const id = `${r}/${k}`, e = cur.get(id), ko = b.label || k;
    add(ko, id);
    if (e) { add(e.label_en, id); add(`${e.label_en} (${ko})`, id); }
  }
  return out;
}

// 새 항목 검사 — 서기가 쓰기 전에. 통과해야 봉인이 ok
function checkProposals(events, proposals) {
  const errors = [], rules = [], err = (rule, m) => { errors.push(m); rules.push(rule); }, { cur } = current(events), next = new Map(cur);
  if (!Array.isArray(proposals) || !proposals.length) return { ok: false, errors: ['새 항목이 없음'], rules: ['RULE-0510'] };
  const mine = new Set();
  for (const [i, p] of proposals.entries()) {
    const at = `항목 ${i + 1}${p && p.key ? ` (${p.register}/${p.key})` : ''}`;
    if (!p || typeof p !== 'object') { err('RULE-0510', `${at}: 객체가 아님`); continue; }
    const extra = Object.keys(p).filter((k) => !PROPOSAL_FIELDS.includes(k));
    if (extra.length) err('RULE-0510', `${at}: 받지 않는 칸 ${extra.join(', ')} (사슬 칸 seq·at·prev·root 는 서기가 붙인다)`);
    if (!D.registers.includes(p.register)) { err('RULE-0510', `${at}: register 어휘 밖 '${p.register}' — ${D.registers.join(' | ')}`); continue; }
    if (!Object.prototype.hasOwnProperty.call(V[p.register], p.key)) { err('RULE-0510', `${at}: vocab.${p.register} 에 없는 키 '${p.key}' — 토큰은 vocab 이 먼저 정한다`); continue; }
    if (!nonEmpty(p.label_en) || !nonEmpty(p.meaning_en)) err('RULE-0510', `${at}: label_en·meaning_en 은 비지 않은 문자열`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.since || '')) err('RULE-0510', `${at}: since 는 YYYY-MM-DD`);
    if (p.xref != null) {
      const x = p.xref, pat = x && V.xrefs[x.db] && V.xrefs[x.db].pattern;
      if (!pat || typeof x.id !== 'string' || !new RegExp(pat).test(x.id)) err('RULE-0510', `${at}: xref 는 null 또는 vocab.xrefs 형식의 { db, id } — 외부 대조가 확인된 것만`);
    }
    const id = qid(p), had = next.get(id);
    if (mine.has(id)) err('RULE-0510', `${at}: 같은 묶음에 같은 토큰이 둘`);
    mine.add(id);
    if (had && p.revises !== had.root) err('RULE-0510', `${at}: 이미 있는 토큰 — 고치려면 revises 에 현재 root (${String(had.root).slice(0, 12)}…)`);
    if (!had && p.revises != null) err('RULE-0510', `${at}: 없는 토큰을 revises`);
    next.set(id, { ...p, root: 'pending:' + i });
  }
  for (const m of ambiguity(next)) err('RULE-0510', m); // 렌더 모호도 사전 항목 규칙
  return { ok: !errors.length, errors, rules };
}

// 전체 판정 (validate): 사슬 · revises · 렌더 모호 · 덮임
function audit(events) {
  const chain = verifyChain(events), c = current(events);
  const missing = [];
  for (const r of D.registers) for (const k of Object.keys(V[r])) if (!c.cur.has(`${r}/${k}`)) missing.push(`${r}/${k}`);
  const amb = ambiguity(c.cur), errors = [...chain.errors, ...c.errors, ...amb, ...missing.map((m) => `vocab 토큰 ${m} 에 사전 항목(en)이 없음`)];
  const rules = [...chain.rules, ...c.rules, ...amb.map(() => 'RULE-0510'), ...missing.map(() => 'RULE-0044')]; // rules[i] = errors[i] 를 집행하는 규칙 번호
  return { ok: !errors.length, errors, rules, events: events.length, tokens: c.cur.size, head: chain.head };
}
function auditText(a) {
  return a.ok ? `사전 봉인: 통과 — 사건 ${a.events} · 토큰 ${a.tokens} · head ${a.head.slice(0, 12)}…`
    : `사전 봉인: 위반 ${a.errors.length}\n` + a.errors.map((e) => '  ✗ ' + e).join('\n');
}

module.exports = { GENESIS, PROPOSAL_FIELDS, verifyChain, current, checkProposals, audit, auditText };
