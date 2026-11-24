// 사법부 — 전환 기록 검사 (재건 PLAN §3, 6c). 한 세션 = 한 모드: 다른 모드가 필요하면 세션은 전환 기록을 남기고 끝난다.
//   기록 하나 = { from, to, at, why, target[], files[], open[], sup? } — 다음 세션이 이것만 받고 새 모드로 시작한다(산문 NEXT-*.md 를 대신).
//   sup(선택, DEC-0081) = 이 전환이 어느 상위 작업(감독 장부 SUP-…)의 일인지 — 감독 장부가 넘김이 가리킨 전환 기록과 자기 상위 작업이 같은지 본다.
//   번호(DEC-0092 · DEC-0093): 한 묶음의 일은 같은 번호 + 글자 — seq "21a" → "21b" → … (z 다음 aa). 새 기록은 work(일의 번호)를 주고 서기가 글자를 붙인다.
//   새 번호의 첫 기록(…a)은 opened_by: DEC-… (그 번호를 연 사람 결정) · 완결은 close: true (사람이 PR 승인) — 완결된 번호에는 더 붙이지 않는다.
//   옛 기록 #1–#20 은 정수 seq 그대로 읽는다(두 #20 포함) — 새 방식은 그 뒤부터.
//   쓰기는 입법 서기(appendTransition)만, 서기는 이 검사가 통과할 때만 붙인다. 이 파일은 읽기·판정만.
'use strict';
const fs = require('fs');
const path = require('path');
const V = require('../vocab.js');

const FIELDS = ['from', 'to', 'at', 'why', 'target', 'files', 'open'];
const OPTIONAL = ['sup', 'work', 'opened_by', 'close']; // 선택 칸 — sup(DEC-0081) · work · opened_by · close(DEC-0092) — 옛 기록에는 없다
// 가리킬 수 있는 번호 — 데이터(T·D·S·O·L·V)·가정(A)·규칙(RULE-)·하위 번호(D…/site|rule/키)
const TARGET_RE = /^(?:[TDSOLV]\d{6}(?:\/(?:site|rule)\/[a-z0-9_]+)?|A\d{6}|RULE-\d{4})$/;

// rec: 새 기록 · root: 저장소 최상위 (files 가 실제로 있는지)
function checkTransition(rec, root) {
  const errors = [], rules = [], err = (rule, m) => { errors.push(m); rules.push(rule); }; // rules[i] = errors[i] 의 규칙 번호
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return { ok: false, errors: ['전환 기록은 JSON 객체'], rules: ['RULE-0513'] };
  const extra = Object.keys(rec).filter((k) => !FIELDS.includes(k) && !OPTIONAL.includes(k));
  if (extra.length) err('RULE-0513', `받지 않는 칸 ${extra.join(', ')} — ${FIELDS.join(' · ')} · 선택 ${OPTIONAL.join(' · ')} (순번 seq 는 서기가 붙인다)`);
  if (rec.sup !== undefined && !/^SUP-\d{4}$/.test(String(rec.sup))) err('RULE-0513', `sup '${rec.sup}' — 상위 작업 번호 SUP-네 자리 (없으면 칸을 빼기)`);
  if (rec.work !== undefined && !(Number.isInteger(rec.work) && rec.work > 0)) err('RULE-0513', `work '${rec.work}' — 일의 번호는 양의 정수 (글자는 서기가 붙인다)`);
  if (rec.opened_by !== undefined && !/^DEC-\d{4}$/.test(String(rec.opened_by))) err('RULE-0513', `opened_by '${rec.opened_by}' — 새 번호를 연 결정 DEC-네 자리`);
  if (rec.close !== undefined && rec.close !== true) err('RULE-0513', 'close 는 true 만 (완결이 아니면 칸을 빼기)');
  for (const k of ['from', 'to']) if (!V.sessionModes[rec[k]]) err('RULE-0513', `${k} '${rec[k]}' — ${Object.keys(V.sessionModes).join(' | ')}`);
  if (rec.from && rec.from === rec.to) err('RULE-0513', 'from 과 to 가 같음 — 같은 모드면 전환이 아니라 그 세션에서 계속');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rec.at || '') || Number.isNaN(Date.parse(rec.at))) err('RULE-0513', 'at 은 YYYY-MM-DD');
  if (typeof rec.why !== 'string' || !rec.why.trim()) err('RULE-0513', 'why 가 없음 — 왜 다른 모드가 필요한지 한 줄');
  for (const k of ['target', 'files', 'open']) if (!Array.isArray(rec[k])) err('RULE-0513', `${k} 는 목록 (없으면 [])`);
  for (const t of rec.target || []) if (!TARGET_RE.test(String(t))) err('RULE-0513', `target '${t}' 은(는) 번호가 아님 — T·D·S·O·L·V + 여섯 자리 · A… · RULE-…`);
  for (const f of rec.files || []) {
    const rel = String(f), abs = path.resolve(root || process.cwd(), rel);
    if (path.isAbsolute(rel) || rel.split(/[\\/]/).includes('..')) err('RULE-0513', `files '${rel}' — 저장소 최상위 기준 상대 경로만`);
    else if (!fs.existsSync(abs)) err('RULE-0513', `files '${rel}' 가 없음`);
  }
  for (const q of rec.open || []) if (typeof q !== 'string' || !q.trim()) err('RULE-0513', 'open 은 비지 않은 문장 목록 — 다음 세션이 답할 질문');
  if (!(rec.target || []).length && !(rec.files || []).length && !(rec.open || []).length) err('RULE-0513', 'target·files·open 이 모두 비었음 — 다음 세션이 무엇을 받는지 없음');
  return { ok: !errors.length, errors, rules };
}

// ── 번호 (DEC-0092 · DEC-0093) ──
// 글자: a … z, aa … az, ba … (z 다음 aa — 길이가 먼저, 같은 길이는 사전순)
function nextLetter(l) {
  const c = String(l).split(''); let i = c.length - 1;
  while (i >= 0 && c[i] === 'z') { c[i] = 'a'; i--; }
  if (i < 0) return 'a' + c.join('');
  c[i] = String.fromCharCode(c[i].charCodeAt(0) + 1); return c.join('');
}
const letterCmp = (a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0);
// seq → { num, letter } (새 방식) · { num, legacy: true } (옛 정수) · null (읽을 수 없음)
function parseSeq(seq) {
  if (Number.isInteger(seq) && seq > 0) return { num: seq, legacy: true };
  const m = typeof seq === 'string' && /^([1-9]\d*)([a-z]+)$/.exec(seq);
  return m ? { num: Number(m[1]), letter: m[2] } : null;
}
// 번호마다 묶음 — { num → { entries: [{rec, letter}], closed, opened_by } } (옛 정수는 legacy 집합)
function works(records) {
  const by = new Map(), legacy = new Set();
  for (const r of records || []) {
    const p = parseSeq(r && r.seq); if (!p) continue;
    if (p.legacy) { legacy.add(p.num); continue; }
    const w = by.get(p.num) || by.set(p.num, { num: p.num, entries: [], closed: false, opened_by: null }).get(p.num);
    w.entries.push({ rec: r, letter: p.letter }); if (r.close === true) w.closed = true; if (p.letter === 'a' && r.opened_by) w.opened_by = r.opened_by;
  }
  for (const w of by.values()) w.entries.sort((x, y) => letterCmp(x.letter, y.letter));
  return { by, legacy };
}
// 새 기록 rec 이 받을 seq — prev: 지금 장부 · decisions: 계획에 있는 결정 번호 집합(Set) — 없으면 존재 확인을 건너뜀
function nextSeq(prev, rec, decisions) {
  const errors = [], rules = [], err = (rule, m) => { errors.push(m); rules.push(rule); };
  if (!rec || !Number.isInteger(rec.work) || rec.work < 1) { err('RULE-0513', 'work 가 없음 — 이 일의 번호(양의 정수). 새 번호는 사람 결정으로만 연다 (opened_by: DEC-…)'); return { ok: false, errors, rules, seq: null }; }
  const { by, legacy } = works(prev), w = by.get(rec.work);
  let seq = null;
  if (!w) {
    if (legacy.has(rec.work)) err('RULE-0513', `번호 ${rec.work} 는 옛 기록(정수 seq)이 썼음 — 새 번호를 사람 결정으로 연다`);
    if (!rec.opened_by) err('RULE-0513', `번호 ${rec.work} 는 새 번호 — 첫 기록에는 opened_by: DEC-… (그 번호를 연 사람 결정)`);
    else if (decisions && !decisions.has(rec.opened_by)) err('RULE-0513', `opened_by ${rec.opened_by} — 계획에 그 결정이 없음`);
    else { const other = [...by.values()].find((x) => x.opened_by === rec.opened_by); if (other) err('RULE-0513', `opened_by ${rec.opened_by} — 그 결정은 이미 번호 ${other.num} 을 열었음`); }
    seq = rec.work + 'a';
  } else {
    if (w.closed) err('RULE-0513', `번호 ${rec.work} 는 완결됨 — 더 붙이지 않는다 (다음 일은 새 번호, 사람 결정으로)`);
    if (rec.opened_by) err('RULE-0513', `opened_by 는 새 번호의 첫 기록에만 — 번호 ${rec.work} 는 이미 열림 (${w.opened_by || '?'})`);
    seq = rec.work + nextLetter(w.entries[w.entries.length - 1].letter);
  }
  return { ok: !errors.length, errors, rules, seq };
}
// 장부 전체 검사 — 두 브랜치를 합친 뒤에도 (같은 글자 둘 · 완결 뒤 기록 · 첫 기록의 opened_by)
function checkLedger(records) {
  const out = [], E = (m) => out.push({ rule: 'RULE-0513', msg: m });
  const seen = new Map();
  (records || []).forEach((r, i) => {
    const p = parseSeq(r && r.seq);
    if (!p) { E(`${i + 1} 번째 줄 seq '${r && r.seq}' — 옛 정수 또는 번호 + 글자("21a")`); return; }
    if (p.legacy) return; // 옛 기록은 그대로 (DEC-0092 ⑤ — 두 #20 포함)
    if (seen.has(r.seq)) E(`seq ${r.seq} 가 둘 — 두 브랜치가 같은 글자를 씀 (뒤의 것을 다음 글자로 다시 기록)`); else seen.set(r.seq, i);
  });
  const { by, legacy } = works(records);
  for (const w of by.values()) {
    if (legacy.has(w.num)) E(`번호 ${w.num} 를 옛 기록과 새 기록이 함께 씀`);
    const first = w.entries[0];
    if (first.letter !== 'a') E(`번호 ${w.num} 의 첫 기록이 ${w.num}${first.letter} — ${w.num}a 부터`);
    else if (!first.rec.opened_by) E(`${w.num}a 에 opened_by 가 없음 — 새 번호는 사람 결정으로만`);
    for (const e of w.entries.slice(1)) if (e.rec.opened_by) E(`${w.num}${e.letter} 의 opened_by — 첫 기록에만`);
    const ci = w.entries.findIndex((e) => e.rec.close === true);
    if (ci >= 0 && ci < w.entries.length - 1) E(`번호 ${w.num} 은 ${w.num}${w.entries[ci].letter} 에서 완결됨 — 그 뒤 기록 ${w.entries.slice(ci + 1).map((e) => w.num + e.letter).join(' · ')}`);
  }
  const opens = new Map();
  for (const w of by.values()) if (w.opened_by) { if (opens.has(w.opened_by)) E(`${w.opened_by} 가 번호 ${opens.get(w.opened_by)} · ${w.num} 를 함께 엶 — 결정 하나 = 번호 하나`); else opens.set(w.opened_by, w.num); }
  return out;
}
// 열린 일(완결 안 된 번호) — 문지기 시작 안내 · 목록용
const openWorks = (records) => [...works(records).by.values()].filter((w) => !w.closed).map((w) => ({ num: w.num, last: w.num + w.entries[w.entries.length - 1].letter, count: w.entries.length, opened_by: w.opened_by }));

// 덧붙이기만 하는 기록 (DEC-0079 ③ · RULE-0544): 서기는 끝에 줄을 붙이기만 한다 — 바뀐 뒤 글에 바뀌기 전의 줄이 모두(같은 수만큼) 남아 있어야 한다.
//   줄 순서가 바뀐 것은 고침이 아니다(두 브랜치를 합친 장부). 어느 파일에 적용하는지는 부르는 쪽(CI 구역 점검 · 문지기)이 정한다 — 이 함수는 글만 본다
function appendOnly(before, after) {
  const count = new Map();
  for (const l of String(after || '').split('\n')) if (l.trim()) count.set(l, (count.get(l) || 0) + 1);
  const lost = [];
  for (const l of String(before || '').split('\n')) { if (!l.trim()) continue; const n = count.get(l) || 0; if (n) count.set(l, n - 1); else lost.push(l); }
  return lost.length ? [{ rule: 'RULE-0544', msg: `기존 줄 ${lost.length} 이 고쳐지거나 지워짐 — 덧붙이기만 (첫 줄: ${lost[0].slice(0, 80)})` }] : [];
}

module.exports = { FIELDS, OPTIONAL, TARGET_RE, checkTransition, appendOnly, nextLetter, parseSeq, works, nextSeq, checkLedger, openWorks };
