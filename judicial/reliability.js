// 사법부 — 신뢰 지표 (Reliability Index). 어떤 값을 무엇에 쓸 수 있는지 계산한다 (저장하지 않는다).
//
// 두 축을 **독립으로** 둔다. 곱(S×D)은 보고용 숫자일 뿐 판정에 쓰지 않는다 — (2,4) 와 (4,2) 가 같은 8 이 되어
// "블로그가 전한 실측" 과 "권위 DB 에서 온 추론" 을 가르지 못하기 때문이다. 관문은 쌍을 사전식으로 본다.
//   S 출처 (Source)  4 권위 DB + 사법부 도장(digest·증거 sha256·재확인) · 3 동료 심사 문헌 식별자(DOI·PMID) · 2 그 밖(출처 없음·추론·예측) · 0 확인 불가
//   D 성질 (Data)    4 추적 가능한 실측·도구가 원본에서 계산한 값 · 3 요약 상수·정체성 사실 · 2 추론·단순화·출처 없는 값
// 등급은 **권한의 이름**이다 (진리의 이름이 아니다 — 이 저장소는 검증 엔진이지 진리 선언기가 아니다):
//   anchor 기준값 · parameter 매개변수 · bounded 구간값(오차 막대와 함께) · legacy 지난값 · reference 참고(계산 금지) · blocked 차단(한계로만)
// 점수는 손으로 매기지 않는다 — 도장·근거·관찰 기록에서 계산한다. 그래서 데이터가 스스로 등급을 높일 수 없다.
// 이 파일은 판정만 한다: 쓰기·엔진 실행·데이터 수정 없음. 추세 축(시간)은 judicial/trend.js 가 판정해 opt.trend 로 들어온다 — 없으면 'unchecked'(anchor 없음).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../model.js'));
  else root.DefDBReliability = factory(root.DefDBModel);
})(typeof self !== 'undefined' ? self : this, function (M) {
'use strict';

const S_LABEL = { 4: '권위 DB + 사법부 도장', 3: '동료 심사 문헌(DOI·PMID)', 2: '출처 없음·추론·예측', 0: '확인 불가' };
const D_LABEL = { 4: '추적 가능한 실측·도구 계산', 3: '요약 상수·정체성 사실', 2: '추론·단순화·출처 없는 값' };
const GRADES = {
  anchor:    { label: '기준값', use: '시뮬레이션의 고정점으로 쓸 수 있음', rule: 'S4 ∧ D4 ∧ 추세 일치' },
  parameter: { label: '매개변수', use: '주 매개변수로 쓸 수 있음 (추세 미점검이면 함께 보고)', rule: 'S ≥ 3 ∧ D ≥ 3' },
  bounded:   { label: '구간값', use: '오차 막대와 함께만 쓸 수 있음', rule: 'S4 ∧ D2 — 출처는 최상, 값은 추론·단순화' },
  legacy:    { label: '지난값', use: '비교 분석에만 (지우지 않는다)', rule: '추세 불일치 — 과거 합의' },
  reference: { label: '참고', use: '계산에 쓰지 않음 — 서술에만', rule: '그 밖 (S2 또는 D 가 낮음)' },
  blocked:   { label: '차단', use: '계산·인용 금지 — 한계로만 남긴다', rule: '확인 불가·모순 (S0)' },
};
const ORDER = ['anchor', 'parameter', 'bounded', 'legacy', 'reference', 'blocked'];

function gradeOf(s, d, trend) {
  if (!s) return 'blocked';
  if (trend === 'mismatch') return 'legacy';
  if (s === 4 && d === 4 && trend === 'match') return 'anchor';
  if (s >= 3 && d >= 3) return 'parameter';
  if (s === 4 && d === 2) return 'bounded';
  return 'reference';
}

// ----- S: 출처 -----
// 도장이 있는 주장만 S4. 문헌 식별자(DOI·PMID)가 붙으면 S3. 나머지는 S2. 확인할 수 없는 것(철회·지난 도장·unmapped)은 S0.
const stampKey = (sense, field, ns, value) => `${sense}|${field}|${ns}:${value}`;
const hasDOI = (ev) => (ev.sources || []).some((x) => ['DOI', 'PMID'].includes(x.db) && x.id);
// 도구가 원본에서 계산한 값: 그 원본 파일의 sha256 이 유효한 도장의 증거와 같으면 권위 DB 에서 온 것으로 본다
const toolSha = (ev) => { const m = /sha256:([0-9a-f]{6,64})/.exec(ev.tool || ''); return m ? m[1] : null; };

function scoreEvidence(ev, ctx) {
  if (!ev || !ev.level) return { s: 2, d: 2, why: '근거가 없음' };
  if (ev.level === 'curated') return { s: hasDOI(ev) ? 3 : 2, d: 3, why: hasDOI(ev) ? `문헌 ${(ev.sources || []).map((x) => `${x.db}:${x.id}`).join(', ')}` : '문헌이라 적혀 있지만 식별자가 없음' };
  if (ev.level === 'computed') {
    const sha = toolSha(ev), ok = sha && ctx.evidenceShas.some((x) => x.startsWith(sha));
    return { s: ok ? 4 : 2, d: 4, why: ok ? `도구가 도장받은 원본에서 계산 (${ev.tool || ''}`.slice(0, 120) + ')' : '도구 계산인데 원본 증거를 찾을 수 없음' };
  }
  if (ev.level === 'abstracted') return { s: hasDOI(ev) || /DOI|PMID/.test(ev.basis || '') ? 3 : 2, d: 2, why: '추론·단순화 (기전 흐름에서)' };
  if (ev.level === 'predicted') return { s: 2, d: 2, why: `예측 모델 출력 (신뢰도 ${ev.confidence != null ? ev.confidence : '없음'})` };
  return { s: 2, d: 3, why: '출처 없이 적음 (asserted)' };
}

// ----- 항목 모으기 -----
// 등급을 다는 것은 "쓸 수 있는가" 를 물을 수 있는 것뿐이다: 외부 ID·지문(정체성) · 근거를 가진 주장 · 속도 상수 · 관찰 기록.
function items(db, opt) {
  db = M.normalize(db); opt = opt || {};
  const ix = M.index(db);
  const valid = new Set(opt.attestations || []), stale = new Set((opt.stale || []).map((x) => (typeof x === 'string' ? x : x.key)));
  const evidenceShas = (opt.stamps || []).map((st) => (st.evidence || {}).sha256).filter(Boolean);
  const ctx = { evidenceShas };
  // 추세 축 (judicial/trend.js): 창 안의 유효한 추세 도장만 'match'·'mismatch' 로 온다. 없으면 'unchecked' — 그래서 anchor 가 나오지 않는다.
  const trends = opt.trend || {};
  const tr = (sense, ns, value) => trends[`${sense}|${ns}:${value}`] || 'unchecked';
  const out = [];
  const add = (o) => { o.grade = gradeOf(o.s, o.d, o.trend || 'unchecked'); out.push(o); };
  for (const [sid, d] of Object.entries(db.senses)) {
    const label = ix.label(sid);
    // 외부 ID: 도장이 유효하면 S4·D3 (정체성 사실), asserted 면 S2, 지난 도장·unmapped 는 S0
    for (const x of d.xrefs) {
      const key = stampKey(sid, 'xref', x.db, x.id);
      const s = x.status === 'verified' ? (valid.has(key) ? 4 : 0) : 2;
      add({ sense: sid, label, what: 'xref', target: `${x.db}:${x.id}${x.role ? ` (${x.role})` : ''}`, s, d: 3, trend: tr(sid, x.db, x.id),
        why: s === 4 ? '원본 대조 + 유효한 도장' : s === 0 ? (stale.has(key) ? '지난 도장 — 주체가 데이터에서 빠짐' : 'verified 인데 유효한 도장이 없음') : '원본과 대조하지 않음 (asserted)' });
    }
    if (d.unmapped) add({ sense: sid, label, what: 'identity', target: '외부 ID 없음', s: 0, d: 2, why: `unmapped: ${String(d.unmapped).slice(0, 60)}` });
    if (d.fingerprint) {
      const f = d.fingerprint, key = stampKey(sid, 'fingerprint', f.scheme, f.value);
      const s = f.status === 'verified' || f.status === 'computed' ? (valid.has(key) ? 4 : 2) : 2;
      add({ sense: sid, label, what: 'fingerprint', target: `${f.scheme}`, s, d: 4, trend: tr(sid, f.scheme, f.value), why: s === 4 ? '원본·도구 계산 + 유효한 도장' : '도장 없음' });
    }
    for (const [i, x] of (d.desc || []).entries()) { const r = scoreEvidence(x.evidence, ctx); add({ sense: sid, label, what: 'desc', target: `설명 ${i + 1}`, ...r, trend: 'unchecked' }); }
    for (const r0 of d.rule || []) {
      const r = scoreEvidence(r0.evidence, ctx);
      add({ sense: sid, label, what: 'rule', target: `${sid}/rule/${r0.id}`, ...r, trend: 'unchecked' });
      if (r0.kinetics) { const k = scoreEvidence(r0.kinetics.evidence, ctx); add({ sense: sid, label, what: 'kinetics', target: `${sid}/rule/${r0.id}`, ...k, trend: 'unchecked' }); }
    }
    for (const o of d.obs || []) { const r = scoreEvidence(o.evidence, ctx); add({ sense: sid, label, what: 'obs', target: o.property, ...r, trend: 'unchecked' }); }
    for (const t of d.transitions || []) { const r = scoreEvidence(t.evidence, ctx); add({ sense: sid, label, what: 'transition', target: `→ ${t.to}`, ...r, trend: 'unchecked' }); }
  }
  // 관찰 기록 (v10): 불확도·반복 수가 있는 실측 — 철회된 것은 차단
  for (const [oid, o] of Object.entries(db.observations || {})) {
    const src = (o.provenance || {}).source || {}, doi = ['DOI', 'PMID'].includes(src.db);
    const s = o.retracted ? 0 : doi ? 3 : 2, dd = o.uncertainty && o.replicates >= 1 ? 4 : 3;
    add({ sense: oid, label: oid, what: 'observation', target: `${(o.observable || {}).kind || '?'} (${o.use || '?'})`, s, d: dd, trend: 'unchecked',
      why: o.retracted ? `철회됨: ${o.retracted.note || ''}`.slice(0, 60) : `${doi ? `문헌 ${src.db}:${src.id}` : '출처 식별자 없음'} · 반복 ${o.replicates || 0}` });
  }
  return out;
}

// 분포: 등급별 수 · 쌍(S,D)별 수 — 곱은 보고용으로만 함께 적는다
function summary(rows) {
  const byGrade = Object.fromEntries(ORDER.map((g) => [g, 0])), byPair = {}, byWhat = {};
  for (const r of rows) {
    byGrade[r.grade]++;
    const k = `S${r.s}D${r.d}`; byPair[k] = (byPair[k] || 0) + 1;
    byWhat[r.what] = byWhat[r.what] || Object.fromEntries(ORDER.map((g) => [g, 0]));
    byWhat[r.what][r.grade]++;
  }
  return { n: rows.length, byGrade, byPair, byWhat };
}
// 관문: 쌍을 사전식으로 — 곱으로 가르지 않는다
const meets = (row, min) => ORDER.indexOf(row.grade) <= ORDER.indexOf(min);

function gradeText(rows, opt) {
  opt = opt || {};
  const sum = summary(rows), L = [];
  L.push(`# 신뢰 지표 (Reliability Index) — 항목 ${sum.n}`, '', '점수는 손으로 매기지 않는다: S 는 도장·문헌 식별자에서, D 는 관찰 기록·도구 계산에서 계산한다. 곱(S×D)은 아래 쌍 표의 참고 숫자이며 판정에 쓰지 않는다 (2×4 와 4×2 가 겹친다).', '');
  L.push('| 등급 | 뜻 | 조건 | 쓸 수 있는 곳 | 수 |', '|---|---|---|---|---|');
  for (const g of ORDER) L.push(`| ${g} | ${GRADES[g].label} | ${GRADES[g].rule} | ${GRADES[g].use} | ${sum.byGrade[g]} |`);
  L.push('', '| 쌍 (S, D) | 출처 | 성질 | 수 | 곱(참고) |', '|---|---|---|---|---|');
  for (const [k, n] of Object.entries(sum.byPair).sort()) { const s = +k[1], d = +k[3]; L.push(`| ${k} | ${S_LABEL[s]} | ${D_LABEL[d] || '—'} | ${n} | ${s * d} |`); }
  L.push('', '| 항목 종류 | ' + ORDER.join(' | ') + ' |', '|---|' + ORDER.map(() => '---').join('|') + '|');
  for (const [w, g] of Object.entries(sum.byWhat)) L.push(`| ${w} | ${ORDER.map((x) => g[x]).join(' | ')} |`);
  if (opt.min) {
    const bad = rows.filter((r) => !meets(r, opt.min));
    L.push('', `## ${opt.min} 미달 ${bad.length}`, '', '| 정의항 | 항목 | 등급 | S·D | 근거 |', '|---|---|---|---|---|');
    for (const r of bad.slice(0, opt.limit || 40)) L.push(`| ${r.sense} ${r.label} | ${r.what} ${r.target} | ${r.grade} | S${r.s}D${r.d} | ${r.why} |`);
    if (bad.length > (opt.limit || 40)) L.push(`| … | 그 밖 ${bad.length - (opt.limit || 40)} 개 | | | |`);
  }
  const byTrend = {};
  for (const r of rows) byTrend[r.trend || 'unchecked'] = (byTrend[r.trend || 'unchecked'] || 0) + 1;
  L.push('', `추세 축 (\`dbtool trend\`): ${Object.entries(byTrend).map(([k, n]) => `${k} ${n}`).join(' · ')}. \`unchecked\` 인 항목에서는 \`anchor\` 가 나오지 않고, 창을 넘긴 추세 도장은 다시 \`unchecked\` 다.`);
  return L.join('\n');
}

// ===== 관문 (②): 시뮬레이션이 읽는 상수의 등급 =====
// IR 은 규칙마다 쓰인 상수를 evidence·src 와 함께 싣는다 — 사법부는 그 IR 만 보고 판정한다 (엔진을 부르지 않음).
//   src 'data'     → 그 상수의 근거로 등급을 계산하고, 문턱(기본 parameter) 미달이면 위반
//   src 'scenario' → 가상 값이므로 등급 밖('hypothetical'): 시나리오가 hypothetical 을 선언했을 때만 허용
// 문턱은 시나리오 min_grade 로 올릴 수 있다. 판정만 하고 멈추는 것은 부르는 쪽(조정자·dbtool)이 한다.
const DEFAULT_MIN = 'parameter';
function constants(ir, sc, opt) {
  sc = sc || {}; opt = opt || {};
  const ctx = { evidenceShas: (opt.stamps || []).map((st) => (st.evidence || {}).sha256).filter(Boolean) };
  const out = [];
  const one = (ref, kind, k) => {
    if (!k) return;
    if (k.src === 'scenario') { out.push({ ref, kind, src: 'scenario', grade: 'hypothetical', s: null, d: null, why: '시나리오가 준 가상 값 — 등급 밖' }); return; }
    const r = scoreEvidence(k.evidence, ctx);
    out.push({ ref, kind, src: k.src || 'data', ...r, grade: gradeOf(r.s, r.d, 'unchecked') });
  };
  for (const R of ir.rules || []) {
    one(R.ref, R.kind, R.k);
    for (const m of R.mods || []) one(m.ref, 'modulation', m.k);
  }
  return out;
}
function constantVerdict(ir, sc, opt) {
  sc = sc || {}; opt = opt || {};
  const min = opt.min || sc.min_grade || DEFAULT_MIN;
  if (!ORDER.includes(min)) return { error: `등급 문턱 '${min}' — ${ORDER.join(' | ')}` };
  const rows = constants(ir, sc, opt), hypo = !!sc.hypothetical;
  const violations = rows.filter((r) => (r.grade === 'hypothetical' ? !hypo : !meets(r, min)))
    .map((r) => ({ ...r, msg: r.grade === 'hypothetical' ? '가상 값인데 시나리오가 hypothetical 을 선언하지 않음' : `등급 ${r.grade} < ${min} (S${r.s}D${r.d}) — ${r.why}` }));
  const byGrade = {};
  for (const r of rows) byGrade[r.grade] = (byGrade[r.grade] || 0) + 1;
  return { min, hypothetical: hypo, n: rows.length, byGrade, rows, violations, ok: !violations.length };
}
const constantText = (v) => (v.error ? v.error : `문턱 ${v.min}${v.hypothetical ? ' · 시나리오는 hypothetical (가상 값 허용)' : ''} · 상수 ${v.n} (${Object.entries(v.byGrade).map(([g, n]) => `${g} ${n}`).join(' · ') || '없음'})${v.violations.length ? ` · 위반 ${v.violations.length}: ${v.violations.slice(0, 3).map((x) => `${x.ref} ${x.msg}`).join(' / ')}` : ''}`);

return Object.freeze({ DEFAULT_MIN, constants, constantVerdict, constantText, S_LABEL, D_LABEL, GRADES, ORDER, gradeOf, scoreEvidence, items, summary, meets, gradeText });
});
