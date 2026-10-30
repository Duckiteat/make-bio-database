// 사법부 — 전환 기록 검사 (재건 PLAN §3, 6c). 한 세션 = 한 모드: 다른 모드가 필요하면 세션은 전환 기록을 남기고 끝난다.
//   기록 하나 = { from, to, at, why, target[], files[], open[] } — 다음 세션이 이것만 받고 새 모드로 시작한다(산문 NEXT-*.md 를 대신).
//   쓰기는 입법 서기(appendTransition)만, 서기는 이 검사가 통과할 때만 붙인다. 이 파일은 읽기·판정만.
'use strict';
const fs = require('fs');
const path = require('path');
const V = require('../vocab.js');

const FIELDS = ['from', 'to', 'at', 'why', 'target', 'files', 'open'];
// 가리킬 수 있는 번호 — 데이터(T·D·S·O·L·V)·가정(A)·규칙(RULE-)·하위 번호(D…/site|rule/키)
const TARGET_RE = /^(?:[TDSOLV]\d{6}(?:\/(?:site|rule)\/[a-z0-9_]+)?|A\d{6}|RULE-\d{4})$/;

// rec: 새 기록 · root: 저장소 최상위 (files 가 실제로 있는지)
function checkTransition(rec, root) {
  const errors = [], rules = [], err = (rule, m) => { errors.push(m); rules.push(rule); }; // rules[i] = errors[i] 의 규칙 번호
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return { ok: false, errors: ['전환 기록은 JSON 객체'], rules: ['RULE-0513'] };
  const extra = Object.keys(rec).filter((k) => !FIELDS.includes(k));
  if (extra.length) err('RULE-0513', `받지 않는 칸 ${extra.join(', ')} — ${FIELDS.join(' · ')} (순번 seq 는 서기가 붙인다)`);
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

module.exports = { FIELDS, TARGET_RE, checkTransition };
