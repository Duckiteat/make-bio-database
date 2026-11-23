// 사법부 — 주장 층의 칸 상태 계산 (PLAN-115 · DEC-0075 · 설계 보고서 §5.3 — PLAN-115 결과 칸 · SCHEMA §주장)
//
// 주장(claims.C…)은 규칙의 칸 하나를 가리키고 근거 줄을 갖는다. 여기서는 그 줄들에서 칸 상태와 규칙의 계산 수준을 **계산만** 한다 —
//   저장하지 않는다(등급과 같다: 데이터가 스스로 상태를 주장할 수 없게). 쓰기 · 파일 읽기 · 엔진 실행 없음. 입력은 정규화된 db.
// 칸 상태 (vocab.claimStates — 이름 · 순위는 거기, 조건은 fieldState):
//   살아 있는 줄 = 주장이 철회되지 않음 ∧ 출처가 철회(가정)되지 않음 ∧ 기댄 관찰이 철회되지 않음. 'absent' 줄은 지지도 반박도 아니다.
//   지지 ∧ 반박 → contested(둘 다 남김) · 반박만 → refuted · 지지 없음 → unsupported · 지지가 배경 · 해석뿐 → inferred
//   직접 지지가 있으나 주장 맥락의 종과 다름 → supported_elsewhere(자동 승격 없음 — 이전 판정의 몫) · 그 밖 → supported
// 칸에 주장이 없으면: '*'(규칙 전체) 주장이 있으면 그것으로, 없으면 규칙 evidence 의 보기 legacy(옛 level 그대로 — curated 를 supported 로 올리지 않음).
// 규칙의 계산 수준 = 그 규칙 종류의 핵심 칸(vocab.claimFields.core 중 규칙에 있는 칸) 상태 중 순위가 가장 낮은 것. 다툼이 하나라도 있으면 contested 를 함께 표시.
// opt.assume: ['PMID:…' | 'DOI:…' | 'O…' | 'C…'] — 철회를 가정한 출처 · 관찰 · 주장 (retraction 의 '만약' 과 같은 뜻 — db 는 그대로)
'use strict';
const M = require('../model.js');
const V = require('../vocab.js');

const RANK = (s) => (V.claimStates[s] || { rank: -1 }).rank;
const srcKey = (s) => (s ? `${s.db}:${s.id}` : null);

function rowLive(db, claimId, c, e, assume) {
  if (c.retracted || assume.has(claimId)) return false;
  if (e.source && assume.has(srcKey(e.source))) return false;
  for (const o of e.from || []) if (assume.has(o) || (db.observations[o] && db.observations[o].retracted)) return false;
  return true;
}

// 줄 묶음 하나(같은 칸을 가리키는 살아 있는 줄들) → 상태 · 까닭
function fieldState(rows, species) {
  const sup = rows.filter((e) => e.stance === 'supports' && e.kind !== 'absent');
  const con = rows.filter((e) => e.stance === 'contradicts' && e.kind !== 'absent');
  if (sup.length && con.length) return { state: 'contested', why: `지지 ${sup.length} · 반박 ${con.length}` };
  if (con.length) return { state: 'refuted', why: `반박 ${con.length}` };
  if (!sup.length) return { state: 'unsupported', why: rows.length ? `지지 줄 없음 (초록에 없음 ${rows.filter((e) => e.kind === 'absent').length})` : '살아 있는 줄 없음' };
  const direct = sup.filter((e) => e.kind === 'direct');
  if (!direct.length) return { state: 'inferred', why: `지지 ${sup.length} — 배경 · 해석뿐` };
  if (species) {
    const here = direct.filter((e) => e.context.species === species);
    if (!here.length) return { state: 'supported_elsewhere', why: `직접 지지 ${direct.length} — 종 ${[...new Set(direct.map((e) => e.context.species || '?'))].join('·')} (주장 맥락 ${species})` };
  }
  return { state: 'supported', why: `직접 지지 ${direct.length}` };
}

// 규칙 하나의 칸 표: [{ field, core, state, why, claims: [C…], rows }] + 계산 수준
function ruleView(db, ref, opt) {
  opt = opt || {};
  const assume = new Set(opt.assume || []);
  const i =String(ref).indexOf('/rule/'), d = i > 0 && db.senses[ref.slice(0, i)], r = d && d.rule.find((x) => x.id === ref.slice(i + 6));
  if (!r) return null;
  const J = require('./judicial.js');
  const spec = V.claimFields[r.type] || { core: ['exists'], aux: [] };
  const mine = Object.entries(db.claims || {}).map(([id, c]) => [id, c, M.parseClaimTarget(c.target)]).filter(([, , p]) => p && p.ref === ref);
  const regFields = (r.regulators || []).map((g) => `regulators:${g.ref}`);
  const names = [...spec.core, ...spec.aux.filter((f) => f !== 'regulators'), ...regFields].filter((f) => J.claimFieldPresent(r, f));
  const whole = mine.filter(([, , p]) => p.field === '*');
  const ev = r.evidence || { level: 'asserted' };
  const fields = names.map((field) => {
    const own = mine.filter(([, , p]) => p.field === field), use = own.length ? own : whole;
    const core = spec.core.includes(field);
    if (!use.length) {
      const st = ev.level === 'asserted' || !ev.level ? 'unsupported' : 'legacy';
      return { field, core, state: st, why: st === 'legacy' ? `규칙 evidence ${ev.level} (출처 ${(ev.sources || []).filter((s) => s.db === 'PMID').map((s) => s.id).join('·') || '없음'}) — 칸 단위 확인 전` : '규칙 evidence asserted · 주장 없음', claims: [], rows: [] };
    }
    const rows = use.flatMap(([id, c]) => c.evidence.filter((e) => rowLive(db, id, c, e, assume)).map((e) => ({ ...e, claim: id })));
    const species = [...new Set(use.map(([, c]) => c.context.species).filter(Boolean))];
    const s = fieldState(rows, species.length === 1 ? species[0] : null);
    return { field, core, ...s, claims: use.map(([id]) => id), rows, via: own.length ? null : '*' };
  });
  const coreF = fields.filter((f) => f.core);
  const level = coreF.length ? coreF.reduce((a, b) => (RANK(b.state) < RANK(a.state) ? b : a)).state : 'unsupported';
  return { ref, type: r.type, label: r.label, level, contested: fields.some((f) => f.state === 'contested'), fields, legacyLevel: ev.level || 'asserted' };
}

// 고르기: 규칙 참조 · 정의항(그 규칙 전부) · 단계(그 단계의 규칙) · 없음(주장이 있는 규칙 전부)
function refsOf(db, sel) {
  if (!sel) return [...new Set(Object.values(db.claims || {}).map((c) => M.parseClaimTarget(c.target)).filter(Boolean).map((p) => p.ref))].sort();
  if (/\/rule\//.test(sel)) return [sel];
  if (db.steps[sel]) return [db.steps[sel].rule].filter(Boolean);
  if (db.senses[sel]) return db.senses[sel].rule.map((r) => `${sel}/rule/${r.id}`);
  return [];
}

function claimsReport(dbIn, sel, opt) {
  const db = M.normalize(dbIn);
  const rules = refsOf(db, sel).map((ref) => ruleView(db, ref, opt)).filter(Boolean);
  const n = Object.keys(db.claims || {}).length;
  return { claims: n, rows: Object.values(db.claims || {}).reduce((a, c) => a + c.evidence.length, 0), rules, assume: opt && opt.assume || [] };
}

function claimsText(dbIn, sel, opt) {
  const r = claimsReport(dbIn, sel, opt), L = (s) => `${s} (${(V.claimStates[s] || {}).label || '?'})`;
  const out = [`주장 층 — 주장 ${r.claims} · 근거 줄 ${r.rows}${r.assume.length ? ` · 철회 가정 ${r.assume.join(', ')}` : ''}`];
  if (!r.rules.length) out.push(sel ? `  ${sel}: 규칙 없음` : '  주장이 있는 규칙 없음 — 칸 상태는 모두 규칙 evidence 의 보기(legacy). 규칙 하나를 보려면 claims <D…|S…|D…/rule/키>');
  for (const v of r.rules) {
    out.push(`  ${v.ref} 「${v.label}」 [${v.type}] 계산 수준 ${L(v.level)}${v.contested ? ' · ⚠ 다툼 있음' : ''} · 옛 evidence ${v.legacyLevel}`);
    for (const f of v.fields) out.push(`    ${f.core ? '●' : '○'} ${f.field}: ${f.state}${f.via ? ' (규칙 전체 주장으로)' : ''} — ${f.why}${f.claims.length ? ` · ${f.claims.join('·')}` : ''}`);
  }
  out.push('  ● 핵심 칸(계산 수준을 정함) · ○ 보조 칸(표시만) — vocab.claimFields');
  return out.join('\n');
}

module.exports = { fieldState, ruleView, claimsReport, claimsText, rowLive };
