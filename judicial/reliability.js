// 사법부 — 신뢰 지표 (Reliability Index). 어떤 값을 무엇에 쓸 수 있는지 계산한다 (저장하지 않는다).
//
// 두 축을 **독립으로** 둔다. 곱(S×D)은 보고용 숫자일 뿐 판정에 쓰지 않는다 — (2,4) 와 (4,2) 가 같은 8 이 되어
// "블로그가 전한 실측" 과 "권위 DB 에서 온 추론" 을 가르지 못하기 때문이다. 관문은 쌍을 사전식으로 본다.
//   S 출처 (Source)  4 권위 DB + 사법부 도장(digest·증거 sha256·재확인) · 3 문헌 식별자(DOI·PMID — 수신함 기록으로 학술지 확인 S3.confirmed · 미확인 S3.unconfirmed, 원고는 S2 · 철회는 S0) · 2 그 밖(출처 없음·추론·예측) · 0 확인 불가
//   D 성질 (Data)    4 추적 가능한 실측·도구가 원본에서 계산한 값 · 3 요약 상수·정체성 사실 · 2 추론·단순화·출처 없이 적은 값
// 등급은 **권한의 이름**이다 (진리의 이름이 아니다 — 이 저장소는 검증 엔진이지 진리 선언기가 아니다):
//   anchor 기준값 · parameter 매개변수 · bounded 구간값(오차 막대와 함께) · legacy 지난값 · reference 참고(계산 금지) · blocked 차단(한계로만)
// 점수는 손으로 매기지 않는다 — 도장·근거·관찰 기록에서 계산한다. 그래서 데이터가 스스로 등급을 높일 수 없다.
// 이 파일은 판정만 한다: 쓰기·엔진 실행·데이터 수정 없음. 추세 축(시간)은 judicial/trend.js 가 판정해 opt.trend 로 들어온다 — 없으면 'unchecked'(anchor 없음).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../model.js'));
  else root.DefDBReliability = factory(root.DefDBModel);
})(typeof self !== 'undefined' ? self : this, function (M) {
'use strict';

// 척도·등급의 이름·쓰임은 vocab(sourceScale·dataScale·reliabilityGrades)에. 여기 남는 것은 등급을 정하는 규칙과 그 설명(RULE) — 로직이 바뀌면 같이 바뀐다
const S_LABEL = M.labelsOf(M.VOCAB.sourceScale);
const D_LABEL = M.labelsOf(M.VOCAB.dataScale);
const RULE = {
  anchor: 'S4 ∧ D4 ∧ 추세 일치', parameter: 'S ≥ 3 ∧ D ≥ 3', bounded: 'S4 ∧ D2 — 출처는 최상, 값은 추론·단순화',
  legacy: '추세 불일치 — 과거 합의', reference: '그 밖 (S2 또는 D 가 낮음)', blocked: '확인 불가·모순 (S0)',
};
const GRADES = Object.freeze(Object.fromEntries(Object.entries(M.VOCAB.reliabilityGrades).map(([k, g]) => [k, Object.freeze({ label: g.label, use: g.note, rule: RULE[k] })])));
const ORDER = ['anchor', 'parameter', 'bounded', 'legacy', 'reference', 'blocked'];

// ----- 기준 표 (2026-10-24, build-plan 71·73): 점수를 매기는 갈래마다 번호 · 조건(when) · 이유(why) -----
//   이유가 확립되지 않은 기준은 why: null + open(무엇이 미정인지) — 이유를 지어내지 않는다. 기준 자체를 바꾸는 것은 사용자 결정.
//   점수 함수는 갈래마다 이 번호(cs·cd)를 단다 — 기록마다 "어떤 기준으로, 왜" 를 따라갈 수 있게.
const CRITERIA = Object.freeze({
  'S4.stamp':     { axis: 'S', level: 4, when: '외부 ID·지문이 원본과 대조되고 유효한 사법부 도장이 있음', why: '사법부가 원본과 직접 대조한 것만 최고 출처 — 데이터가 스스로 출처를 올릴 수 없게 (도장은 digest·증거 sha256·재확인)' },
  'S4.tool':      { axis: 'S', level: 4, when: '도장받은 원본 파일(sha256 일치)에서 도구가 계산한 값', why: '원본이 도장받았고 같은 도구로 다시 계산하면 같은 값 — 원본과 같은 출처로 본다' },
  'S3.confirmed': { axis: 'S', level: 3, when: '출처 식별자(DOI·PMID)의 수신함 기록(Europe PMC)이 학술지 논문(MED)이고 철회 표시가 없음', why: '논문이 학술지에 실렸고 철회되지 않았음을 원본 기록으로 확인 — 심사를 거친 문헌' },
  'S3.unconfirmed': { axis: 'S', level: 3, when: '출처 식별자(DOI·PMID)는 있으나 수신함 기록이 없어 학술지·철회 여부를 확인하지 못함', why: '식별자로 되짚을 수 있는 문헌 — 2026-10-24 결정: 확인 전이라 내리지 않음(내리면 parameter 139 개가 한꺼번에 떨어짐), 대신 확인된 것과 갈라 두고 높은 용도(build-plan 72 검증 근거·기준)는 S3.confirmed 를 요구', open: '확인되지 않은 식별자를 언제까지 S3 로 둘지 미정 — 수집(fetch_abstract)으로 확인을 채운다' },
  'S2.preprint':  { axis: 'S', level: 2, when: '출처의 수신함 기록이 심사 전 원고(Europe PMC PPR)뿐', why: 'DOI 가 있어도 동료 심사를 거치지 않았다 — 식별자가 심사를 보증하지 않는다' },
  'S0.retracted': { axis: 'S', level: 0, when: '출처 논문의 수신함 기록에 철회 표시(Retracted Publication)', why: '논문이 철회되면 그 논문에 기댄 근거는 무효 — 관찰 철회(S0.void)와 같은 급' },
  'S2.unsourced': { axis: 'S', level: 2, when: '식별자 없는 문헌 근거 · 예측 모델 · 출처 없이 적음 · 근거 없음 · 원본과 대조하지 않은 외부 ID · 도장 없는 지문', why: '누가 말했는지 확인할 수 없다 — 모순은 아니므로 차단하지 않고 계산에서만 뺀다' },
  'S0.void':      { axis: 'S', level: 0, when: '철회된 관찰 · 도장 없는 verified · 지난 도장 · 외부 ID 없음(unmapped)', why: '확인할 수 없거나 확인이 무효가 됨 — 근거를 주장할 수 없으니 한계로만 남긴다' },
  'D4.measured':  { axis: 'D', level: 4, when: '관찰 기록에 불확도와 반복 수 ≥ 1', why: '측정 조건과 퍼짐이 적혀 있어 다시 잴 수 있다', open: '반복 1 회의 문턱 이유 미정 — 반복의 독립성은 D 가 아니라 I 축(build-plan 71, 52 뒤)이 맡는다' },
  'D4.computed':  { axis: 'D', level: 4, when: '도구가 원본에서 계산한 값 · 구조 지문', why: '같은 원본과 도구로 다시 계산하면 같은 값 — 추적 가능' },
  'D3.curated':   { axis: 'D', level: 3, when: '문헌에서 옮긴 값(curated)', why: '정리된 값 — 원래 측정의 퍼짐·조건은 이 기록에 없다' },
  'D3.identity':  { axis: 'D', level: 3, when: '외부 ID (정체성 사실)', why: '같은 것을 가리킨다는 사실 — 측정값이 아니므로 D4 가 아니다 (그래서 외부 ID 의 상한은 parameter)' },
  'D3.obs_bare':  { axis: 'D', level: 3, when: '불확도나 반복 수가 없는 관찰', why: '측정이지만 퍼짐을 모른다' },
  'D2.asserted':  { axis: 'D', level: 2, when: '출처 없이 적은 값(asserted)', why: '근거가 없으면 무엇을 어떻게 얻은 값인지도 모른다 — 정리된 문헌 값(D3)으로 볼 근거가 없다 (2026-10-24 결정: D3 → D2, 이미 S2 라 등급은 reference 그대로)' },
  'D2.inferred':  { axis: 'D', level: 2, when: '추론·단순화(abstracted) · 예측 모델 · 근거 없음 · 외부 ID 없음', why: '직접 잰 값이 아니다' },
  'T.match':      { axis: 'T', level: 'match', when: '같은 신원 확인을 더 새 원본(합의 수신함)에 다시 돌려 같은 결론', why: '"그때 맞았다" 가 아니라 "지금도 합의와 같다" — 재현되지 않는 웹 검색 대신 같은 확인을 다시 돌린다' },
  'T.mismatch':   { axis: 'T', level: 'mismatch', when: '새 원본에서 결론이나 값이 달라짐', why: '값을 지우지 않고 지난값으로 — 왜 달라졌는지가 데이터 (Consensus_Gap)' },
  'T.unchecked':  { axis: 'T', level: 'unchecked', when: '새 원본이 없거나 점검일이 합의 창(vocab.consensus.window_days)보다 오래됨', why: '확인하지 않은 것은 확인된 것이 아니다 — anchor 는 영구하지 않다', open: '창 365 일의 이유 미정 — 값의 종류마다 합의가 바뀌는 속도가 다르다(서열 대 속도 상수)' },
  'T.scope':      { axis: 'T', level: '범위', when: '추세 점검은 유효한 신원 도장이 있는 외부 ID·지문에만 — 설명·규칙·속도 상수·관찰은 늘 unchecked', why: '도장이 없으면 S 가 이미 낮아 추세를 물을 자리가 아니다', open: '문헌 값(S3)에는 이 이유가 맞지 않음 — 생물 값이 anchor 에 오를 길이 없다 (build-plan 71: 값에도 T 축)' },
});
// 등급 규칙의 이유 (조건은 gradeOf, 이름·쓰임은 vocab)
const GRADE_WHY = Object.freeze({
  anchor:    { why: '고정점은 출처·성질이 최상이고 지금도 합의와 같아야 — 셋 중 하나라도 빠지면 고정점이 흔들린다' },
  parameter: { why: '문헌 이상의 출처와 정리된 값 이상의 성질 — 주 매개변수로 쓰되 추세 미점검이면 함께 보고' },
  bounded:   { why: '출처는 최상인데 값은 추론·단순화 — 쓰려면 오차 막대가 있어야 한다' },
  legacy:    { why: '과거 합의 — 지우지 않고 비교에만 (판정을 재현하려면 옛 값이 필요)' },
  reference: { why: '출처나 성질이 낮음 — 계산에 쓰면 결론이 근거를 주장할 수 없다, 서술에만' },
  blocked:   { why: '확인 불가·모순 — 계산·인용 모두 금지, 한계로만' },
});
const POLICY_OPEN = Object.freeze({
  order:       { what: '등급 순번 ORDER (meets)', open: '쌍으로 비교할 수 없는 bounded(S4,D2)와 parameter(S3,D3)의 위아래를 정해 버린다 — 문턱을 순번이 아니라 축 조건으로 (build-plan 73)' },
  default_min: { what: `기본 문턱 DEFAULT_MIN`, open: '시뮬레이션이 쓰는 상수의 최저선을 parameter 로 둔 이유 미정' },
});

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
// 출처 논문의 상태 — 부르는 쪽이 수신함에서 읽어 ctx.literature 로 넘긴다({ 'PMID:1': { kind: 'journal'|'preprint', retracted } }, 사법부는 파일을 읽지 않음)
//   철회가 하나라도 있으면 S0 · 학술지 확인이 하나라도 있으면 S3.confirmed · 알려진 것이 원고뿐이면 S2 · 기록이 없으면 S3.unconfirmed
function litS(sources, ctx) {
  const L = (ctx && ctx.literature) || {}, st = (sources || []).filter((x) => ['DOI', 'PMID'].includes(x.db) && x.id).map((x) => L[`${x.db}:${x.db === 'DOI' ? String(x.id).toLowerCase() : x.id}`]).filter(Boolean); // DOI 는 대소문자 무관
  if (st.some((x) => x.retracted)) return { s: 0, cs: 'S0.retracted' };
  if (st.some((x) => x.kind === 'journal')) return { s: 3, cs: 'S3.confirmed' };
  if (st.length && st.every((x) => x.kind === 'preprint')) return { s: 2, cs: 'S2.preprint' };
  return { s: 3, cs: 'S3.unconfirmed' };
}
const toolSha = (ev) => { const m = /sha256:([0-9a-f]{6,64})/.exec(ev.tool || ''); return m ? m[1] : null; };

function scoreEvidence(ev, ctx) {
  if (!ev || !ev.level) return { s: 2, d: 2, cs: 'S2.unsourced', cd: 'D2.inferred', why: '근거가 없음' };
  if (ev.level === 'curated') return { ...(hasDOI(ev) ? litS(ev.sources, ctx) : { s: 2, cs: 'S2.unsourced' }), d: 3, cd: 'D3.curated', why: hasDOI(ev) ? `문헌 ${(ev.sources || []).map((x) => `${x.db}:${x.id}`).join(', ')}` : '문헌이라 적혀 있지만 식별자가 없음' };
  if (ev.level === 'computed') {
    const sha = toolSha(ev), ok = sha && ctx.evidenceShas.some((x) => x.startsWith(sha));
    return { s: ok ? 4 : 2, d: 4, cs: ok ? 'S4.tool' : 'S2.unsourced', cd: 'D4.computed', why: ok ? `도구가 도장받은 원본에서 계산 (${ev.tool || ''}`.slice(0, 120) + ')' : '도구 계산인데 원본 증거를 찾을 수 없음' };
  }
  if (ev.level === 'abstracted') return { ...(hasDOI(ev) ? litS(ev.sources, ctx) : /DOI|PMID/.test(ev.basis || '') ? { s: 3, cs: 'S3.unconfirmed' } : { s: 2, cs: 'S2.unsourced' }), d: 2, cd: 'D2.inferred', why: '추론·단순화 (기전 흐름에서)' };
  if (ev.level === 'predicted') return { s: 2, d: 2, cs: 'S2.unsourced', cd: 'D2.inferred', why: `예측 모델 출력 (신뢰도 ${ev.confidence != null ? ev.confidence : '없음'})` };
  return { s: 2, d: 2, cs: 'S2.unsourced', cd: 'D2.asserted', why: '출처 없이 적음 (asserted)' };
}

// ----- 항목 모으기 -----
// 등급을 다는 것은 "쓸 수 있는가" 를 물을 수 있는 것뿐이다: 외부 ID·지문(정체성) · 근거를 가진 주장 · 속도 상수 · 관찰 기록.
// 관찰 기록의 (S,D): 출처가 문헌 식별자면 S3(철회면 S0, 그 밖 S2) · 불확도와 반복 수가 있으면 D4(실측) 아니면 D3
function scoreObservation(o, ctx) {
  const src = (o.provenance || {}).source || {}, doi = ['DOI', 'PMID'].includes(src.db), lit = doi ? litS([src], ctx) : null;
  return { s: o.retracted ? 0 : doi ? lit.s : 2, d: o.uncertainty && o.replicates >= 1 ? 4 : 3,
    cs: o.retracted ? 'S0.void' : doi ? lit.cs : 'S2.unsourced', cd: o.uncertainty && o.replicates >= 1 ? 'D4.measured' : 'D3.obs_bare',
    why: o.retracted ? `철회됨: ${o.retracted.note || ''}`.slice(0, 60) : `${doi ? `문헌 ${src.db}:${src.id}` : '출처 식별자 없음'} · 반복 ${o.replicates || 0}` };
}

function items(db, opt) {
  db = M.normalize(db); opt = opt || {};
  const ix = M.index(db);
  const valid = new Set(opt.attestations || []), stale = new Set((opt.stale || []).map((x) => (typeof x === 'string' ? x : x.key)));
  const evidenceShas = (opt.stamps || []).map((st) => (st.evidence || {}).sha256).filter(Boolean);
  const ctx = { evidenceShas, literature: opt.literature || {} };
  // 추세 축 (judicial/trend.js): 창 안의 유효한 추세 도장만 'match'·'mismatch' 로 온다. 없으면 'unchecked' — 그래서 anchor 가 나오지 않는다.
  const trends = opt.trend || {};
  const tr = (sense, ns, value) => trends[`${sense}|${ns}:${value}`] || 'unchecked';
  const out = [];
  const add = (o) => { o.grade = gradeOf(o.s, o.d, o.trend || 'unchecked'); o.ct = `T.${o.trend || 'unchecked'}`; out.push(o); };
  for (const [sid, d] of Object.entries(db.senses)) {
    const label = ix.label(sid);
    // 외부 ID: 도장이 유효하면 S4·D3 (정체성 사실), asserted 면 S2, 지난 도장·unmapped 는 S0
    for (const x of d.xrefs) {
      const key = stampKey(sid, 'xref', x.db, x.id);
      const s = x.status === 'verified' ? (valid.has(key) ? 4 : 0) : 2;
      add({ sense: sid, label, what: 'xref', target: `${x.db}:${x.id}${x.role ? ` (${x.role})` : ''}`, s, d: 3, cs: s === 4 ? 'S4.stamp' : s === 0 ? 'S0.void' : 'S2.unsourced', cd: 'D3.identity', trend: tr(sid, x.db, x.id),
        why: s === 4 ? '원본 대조 + 유효한 도장' : s === 0 ? (stale.has(key) ? '지난 도장 — 주체가 데이터에서 빠짐' : 'verified 인데 유효한 도장이 없음') : '원본과 대조하지 않음 (asserted)' });
    }
    if (d.unmapped) add({ sense: sid, label, what: 'identity', target: '외부 ID 없음', s: 0, d: 2, cs: 'S0.void', cd: 'D2.inferred', why: `unmapped: ${String(d.unmapped).slice(0, 60)}` });
    if (d.fingerprint) {
      const f = d.fingerprint, key = stampKey(sid, 'fingerprint', f.scheme, f.value);
      const s = f.status === 'verified' || f.status === 'computed' ? (valid.has(key) ? 4 : 2) : 2;
      add({ sense: sid, label, what: 'fingerprint', target: `${f.scheme}`, s, d: 4, cs: s === 4 ? 'S4.stamp' : 'S2.unsourced', cd: 'D4.computed', trend: tr(sid, f.scheme, f.value), why: s === 4 ? '원본·도구 계산 + 유효한 도장' : '도장 없음' });
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
    const sc = scoreObservation(o, ctx);
    add({ sense: oid, label: oid, what: 'observation', target: `${(o.observable || o.readout || {}).kind || '?'} (${o.use || '?'})`, s: sc.s, d: sc.d, cs: sc.cs, cd: sc.cd, trend: 'unchecked', why: sc.why });
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
  L.push('', criteriaText(rows));
  return L.join('\n');
}

// 기준과 이유 — 기준마다 쓰인 항목 수, 이유 미정은 따로 센다
function criteriaText(rows) {
  const used = {}; for (const r of rows || []) for (const c of [r.cs, r.cd, r.ct]) if (c) used[c] = (used[c] || 0) + 1;
  const L = ['## 기준과 이유 (`judicial/reliability.js` CRITERIA)', '', '| 기준 | 축·단계 | 조건 | 이유 | 쓰인 항목 |', '|---|---|---|---|---|'];
  for (const [id, c] of Object.entries(CRITERIA)) L.push(`| ${id} | ${c.axis} ${c.level} | ${c.when} | ${c.why ? c.why + (c.open ? ` · **미정:** ${c.open}` : '') : `**이유 미정:** ${c.open}`} | ${used[id] || 0} |`);
  L.push('', '| 등급 | 조건 | 이유 |', '|---|---|---|', ...ORDER.map((g) => `| ${g} | ${RULE[g]} | ${GRADE_WHY[g].why} |`));
  L.push('', '| 정책 | 이유 미정 |', '|---|---|', ...Object.values(POLICY_OPEN).map((x) => `| ${x.what} | ${x.open} |`));
  const open = Object.values(CRITERIA).filter((c) => c.open).length + Object.keys(POLICY_OPEN).length;
  L.push('', `이유 미정 ${open} (기준 ${Object.values(CRITERIA).filter((c) => c.open).length} · 정책 ${Object.keys(POLICY_OPEN).length}) — 이유를 지어내지 않고 드러낸다. 기준을 바꾸는 것은 사용자 결정.`);
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
  const ctx = { evidenceShas: (opt.stamps || []).map((st) => (st.evidence || {}).sha256).filter(Boolean), literature: opt.literature || {} };
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

return Object.freeze({ CRITERIA, GRADE_WHY, POLICY_OPEN, criteriaText, DEFAULT_MIN, constants, constantVerdict, constantText, S_LABEL, D_LABEL, GRADES, ORDER, gradeOf, scoreEvidence, scoreObservation, items, summary, meets, gradeText });
});
