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

// ----- 기준 표 (PLAN-071·073): 점수를 매기는 갈래마다 번호 · 조건(when) · 이유(why) -----
//   이유가 확립되지 않은 기준은 why: null + open(무엇이 미정인지) — 이유를 지어내지 않는다. 기준 자체를 바꾸는 것은 사용자 결정.
//   basis = 이유의 종류(vocab.reasonBasis: 원칙·실증·외부 표준·운영·결정) — 원칙에서 나온 이유와 편의·결정에서 나온 이유를 섞지 않는다.
//   점수 함수는 갈래마다 이 번호(cs·cd)를 단다 — 기록마다 "어떤 기준으로, 왜" 를 따라갈 수 있게.
const CRITERIA = Object.freeze({
  'S4.stamp':     { basis: ['principle'], axis: 'S', level: 4, when: '외부 ID·지문이 원본과 대조되고 유효한 사법부 도장이 있음', why: '사법부가 원본과 직접 대조한 것만 최고 출처 — 데이터가 스스로 출처를 올릴 수 없게 (도장은 digest·증거 sha256·재확인)' },
  'S4.tool':      { basis: ['principle'], axis: 'S', level: 4, when: '도장받은 원본 파일(sha256 일치)에서 도구가 계산한 값', why: '원본이 도장받았고 같은 도구로 다시 계산하면 같은 값 — 원본과 같은 출처로 본다' },
  'S3.confirmed': { basis: ['principle', 'standard'], axis: 'S', level: 3, when: '출처 식별자(DOI·PMID)의 수신함 기록(Europe PMC)이 학술지 논문(MED)이고 철회 표시가 없음', why: '논문이 학술지에 실렸고 철회되지 않았음을 원본 기록으로 확인 — 심사를 거친 문헌' },
  'S3.unconfirmed': { basis: ['decision', 'empirical'], axis: 'S', level: 3, when: '출처 식별자(DOI·PMID)는 있으나 수신함 기록이 없어 학술지·철회 여부를 확인하지 못함', why: '식별자로 되짚을 수 있는 문헌 — 2026-10-24 결정: 확인 전이라 내리지 않음(내리면 parameter 139 개가 한꺼번에 떨어짐), 대신 확인된 것과 갈라 두고 높은 용도(build-plan 72 검증 근거·기준)는 S3.confirmed 를 요구', open: '확인되지 않은 식별자를 언제까지 S3 로 둘지 미정 — 수집(fetch_abstract)으로 확인을 채운다' },
  'S2.preprint':  { basis: ['standard', 'principle'], axis: 'S', level: 2, when: '출처의 수신함 기록이 심사 전 원고(Europe PMC PPR)뿐', why: 'DOI 가 있어도 동료 심사를 거치지 않았다 — 식별자가 심사를 보증하지 않는다' },
  'S0.retracted': { basis: ['principle'], axis: 'S', level: 0, when: '출처 논문의 수신함 기록에 철회 표시(Retracted Publication)', why: '논문이 철회되면 그 논문에 기댄 근거는 무효 — 관찰 철회(S0.void)와 같은 급' },
  'S2.unsourced': { basis: ['principle'], axis: 'S', level: 2, when: '식별자 없는 문헌 근거 · 예측 모델 · 출처 없이 적음 · 근거 없음 · 원본과 대조하지 않은 외부 ID · 도장 없는 지문', why: '누가 말했는지 확인할 수 없다 — 모순은 아니므로 차단하지 않고 계산에서만 뺀다' },
  'S0.void':      { basis: ['principle'], axis: 'S', level: 0, when: '철회된 관찰 · 도장 없는 verified · 지난 도장 · 외부 ID 없음(unmapped)', why: '확인할 수 없거나 확인이 무효가 됨 — 근거를 주장할 수 없으니 한계로만 남긴다' },
  'D4.measured':  { basis: ['principle', 'decision'], axis: 'D', level: 4, when: '관찰 기록에 불확도와 반복 수 ≥ 1', why: '측정 조건과 퍼짐(불확도)·반복 수가 적혀 있어 다시 잴 수 있다. 문턱이 반복 1 회인 것은 D 축이 \"무엇을 어떻게 잰 기록인가\" 만 묻기 때문 — 몇 번, 서로 독립으로 쟀는가는 I 축(build-plan 71, 52 뒤)이 따로 맡는다. 반복 수를 D 에 넣으면 두 축이 섞여 \"축을 곱하지 않는다\" 가 깨진다 (2026-10-24 결정: 문턱 그대로, 이유 적기)' },
  'D4.computed':  { basis: ['principle'], axis: 'D', level: 4, when: '도구가 원본에서 계산한 값 · 구조 지문', why: '같은 원본과 도구로 다시 계산하면 같은 값 — 추적 가능' },
  'D3.curated':   { basis: ['principle'], axis: 'D', level: 3, when: '문헌에서 옮긴 값(curated)', why: '정리된 값 — 원래 측정의 퍼짐·조건은 이 기록에 없다' },
  'D3.identity':  { basis: ['principle'], axis: 'D', level: 3, when: '외부 ID (정체성 사실)', why: '같은 것을 가리킨다는 사실 — 측정값이 아니므로 D4 가 아니다 (그래서 외부 ID 의 상한은 parameter)' },
  'D3.obs_bare':  { basis: ['principle'], axis: 'D', level: 3, when: '불확도가 없거나 해상도로 채운 관찰(uncertainty.basis resolution — 원문 미보고, RULE-0090) · 반복 수가 미보고(null)인 관찰', why: '측정이지만 퍼짐을 모른다' },
  'D2.asserted':  { basis: ['principle', 'decision'], axis: 'D', level: 2, when: '출처 없이 적은 값(asserted)', why: '근거가 없으면 무엇을 어떻게 얻은 값인지도 모른다 — 정리된 문헌 값(D3)으로 볼 근거가 없다 (2026-10-24 결정: D3 → D2, 이미 S2 라 등급은 reference 그대로)' },
  'D2.estimate':  { basis: ['principle', 'decision'], axis: 'D', level: 2, when: '관찰 기록이지만 근거 수준이 도구 추정(computed·predicted) — 예: eQuilibrator 성분 기여법 ΔG°′', why: '모형의 추정이지 잰 값이 아니다 — 불확도가 있어도 측정의 퍼짐이 아니라 모형 오차다. 구조 지문(D4.computed)은 원본의 정확한 함수라 다르다 (2026-10-25 결정: 계산값이 D4.measured 를 받던 결함)' },
  'D2.inferred':  { basis: ['principle'], axis: 'D', level: 2, when: '추론·단순화(abstracted) · 예측 모델 · 근거 없음 · 외부 ID 없음', why: '직접 잰 값이 아니다' },
  'T.match':      { basis: ['principle'], axis: 'T', level: 'match', when: '같은 신원 확인을 더 새 원본(합의 수신함)에 다시 돌려 같은 결론', why: '"그때 맞았다" 가 아니라 "지금도 합의와 같다" — 재현되지 않는 웹 검색 대신 같은 확인을 다시 돌린다' },
  'T.mismatch':   { basis: ['principle'], axis: 'T', level: 'mismatch', when: '새 원본에서 결론이나 값이 달라짐', why: '값을 지우지 않고 지난값으로 — 왜 달라졌는지가 데이터 (Consensus_Gap)' },
  'T.unchecked':  { basis: ['principle', 'standard', 'decision'], axis: 'T', level: 'unchecked', when: '새 원본이 없거나 점검일이 그 원천의 합의 창(vocab.consensus.sources — 원천의 판 주기: UniProt 56 일 · ChEBI 31 일)보다 오래됨 · 창이 없는 원천', why: '확인하지 않은 것은 확인된 것이 아니다 — anchor 는 영구하지 않다' + ' — 창은 원천이 다음 판을 낼 수 있는 시점: 그 뒤의 \"지금\" 은 확인하지 않은 것 (2026-10-24 결정: 365 일 하나 → 원천별 판 주기)' },
  'T.scope':      { basis: ['principle'], axis: 'T', level: '범위', when: '추세 점검은 유효한 신원 도장이 있는 외부 ID·지문에만 — 설명·규칙·속도 상수·관찰은 늘 unchecked', why: '도장이 없으면 S 가 이미 낮아 추세를 물을 자리가 아니다', open: '문헌 값(S3)에는 이 이유가 맞지 않음 — 생물 값이 anchor 에 오를 길이 없다 (build-plan 71: 값에도 T 축)' },
});
// 등급 규칙의 이유 (조건은 gradeOf, 이름·쓰임은 vocab)
const GRADE_WHY = Object.freeze({
  anchor:    { basis: ['principle'], why: '고정점은 출처·성질이 최상이고 지금도 합의와 같아야 — 셋 중 하나라도 빠지면 고정점이 흔들린다' },
  parameter: { basis: ['principle'], why: '문헌 이상의 출처와 정리된 값 이상의 성질 — 주 매개변수로 쓰되 추세 미점검이면 함께 보고' },
  bounded:   { basis: ['principle'], why: '출처는 최상인데 값은 추론·단순화 — 쓰려면 오차 막대가 있어야 한다' },
  legacy:    { basis: ['principle'], why: '과거 합의 — 지우지 않고 비교에만 (판정을 재현하려면 옛 값이 필요)' },
  reference: { basis: ['principle'], why: '출처나 성질이 낮음 — 계산에 쓰면 결론이 근거를 주장할 수 없다, 서술에만' },
  blocked:   { basis: ['principle'], why: '확인 불가·모순 — 계산·인용 모두 금지, 한계로만' },
});
// 정책 (등급을 어디에 쓰나) — 기준과 같은 칸: basis · why · 남은 open
const POLICY = Object.freeze({
  order:       { what: '문턱 비교 meets = 축 조건 THRESHOLD', basis: ['principle'], why: '축은 곱 순서(부분 순서)라 한 줄로 세울 수 없다 — 문턱은 "S ≥ s ∧ D ≥ d ∧ 허용 추세" 바닥들의 합으로 비교해, bounded(S4,D2)와 parameter(S3,D3)는 서로의 문턱을 넘지 못한다. ORDER 는 보고서의 열 순서일 뿐 (build-plan 73, 2026-10-25)' },
  raise_only:  { what: '관문 문턱은 올리기만 (gateMinError)', basis: ['principle'], why: '시나리오가 문턱을 내리면 근거 없는 상수로 결론을 낼 수 있다 — min_grade 는 기본보다 엄격한(atLeast) 등급만: 지금 anchor·parameter (2026-10-25, 규칙은 있었으나 집행되지 않던 것)' },
  default_min: { what: '기본 문턱 DEFAULT_MIN = parameter', basis: ['principle', 'empirical', 'decision'],
    why: '시뮬레이션 결론이 "실측에 매여 있다" 고 말하려면 쓴 상수가 모두 심사 문헌 이상 출처(S ≥ 3)·정리된 값 이상(D ≥ 3)이어야 — 그 아래(reference)를 쓰면 결론이 근거를 주장할 수 없다(등급 reference 의 이유). 그 위(anchor)를 기본으로 두면 외부 ID(D3 정체성)·속도 상수(추세 축 없음)가 구조적으로 닿지 못해 모든 실행이 막힌다. 더 엄격한 문턱은 시나리오 min_grade 로 올리기만 (2026-10-24 결정: parameter 유지)' },
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
  // 출처는 sources 칸의 식별자로만 — 설명 문장에 'DOI' 글자가 있는 것으로는 S3 이 아니다 ("DOI/PMID 는 확인하지 못함" 이라 적힌 규칙도 S3 을 받게 되므로)
  if (ev.level === 'abstracted') return { ...(hasDOI(ev) ? litS(ev.sources, ctx) : { s: 2, cs: 'S2.unsourced' }), d: 2, cd: 'D2.inferred', why: '추론·단순화 (기전 흐름에서)' };
  if (ev.level === 'predicted') return { s: 2, d: 2, cs: 'S2.unsourced', cd: 'D2.inferred', why: `예측 모델 출력 (신뢰도 ${ev.confidence != null ? ev.confidence : '없음'})` };
  return { s: 2, d: 2, cs: 'S2.unsourced', cd: 'D2.asserted', why: '출처 없이 적음 (asserted)' };
}

// ----- 항목 모으기 -----
// 등급을 다는 것은 "쓸 수 있는가" 를 물을 수 있는 것뿐이다: 외부 ID·지문(정체성) · 근거를 가진 주장 · 속도 상수 · 관찰 기록.
// 관찰 기록의 (S,D): 출처가 문헌 식별자면 S3(철회면 S0, 그 밖 S2) · 불확도와 반복 수가 있으면 D4(실측) 아니면 D3
const ESTIMATE = new Set(['computed', 'predicted']); // 관찰의 근거 수준 중 측정이 아닌 것 (동작 표 — 라벨은 vocab.evidenceLevels)
function scoreObservation(o, ctx) {
  const src = (o.provenance || {}).source || {}, doi = ['DOI', 'PMID'].includes(src.db), lit = doi ? litS([src], ctx) : null;
  // 관찰 칸에 있어도 도구의 추정(evidence.level computed·predicted)은 측정이 아니다 → D2.estimate
  const est = ESTIMATE.has((o.evidence || {}).level), cd = est ? 'D2.estimate' : o.uncertainty && o.uncertainty.basis !== 'resolution' && o.replicates >= 1 ? 'D4.measured' : 'D3.obs_bare'; // 해상도로 채운 sd 는 잰 퍼짐이 아니다 (DEC-0036)
  return { s: o.retracted ? 0 : doi ? lit.s : 2, d: CRITERIA[cd].level,
    cs: o.retracted ? 'S0.void' : doi ? lit.cs : 'S2.unsourced', cd,
    why: o.retracted ? `철회됨: ${o.retracted.note || ''}`.slice(0, 60) : `${doi ? `문헌 ${src.db}:${src.id}` : '출처 식별자 없음'} · ${est ? '도구 추정값' : `반복 ${o.replicates == null ? '미보고' : o.replicates}`}` };
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
// 문턱 = 축 조건 (build-plan 73): 등급마다 "이 등급 이상" 을 축의 바닥(S ≥ s ∧ D ≥ d ∧ 허용 추세)들의 합으로.
//   순번(ORDER)으로 비교하면 쌍으로 비교할 수 없는 bounded(S4,D2)와 parameter(S3,D3)의 위아래가 정해져 버린다 —
//   바닥은 곱 순서라 둘 다 서로의 문턱을 넘지 못한다. 나머지 등급의 문턱 판정은 순번 비교와 같다(시험이 전수 대조).
const T_ALL = ['match', 'mismatch', 'unchecked'], T_OK = ['match', 'unchecked'];
const THRESHOLD = Object.freeze({
  anchor:    [{ s: 4, d: 4, t: ['match'] }],
  parameter: [{ s: 3, d: 3, t: T_OK }],
  bounded:   [{ s: 4, d: 2, t: T_OK }],
  legacy:    [{ s: 3, d: 3, t: T_OK }, { s: 4, d: 2, t: T_OK }, { s: 2, d: 2, t: ['mismatch'] }], // 과거 합의까지 — 추세가 어긋난 것은 S 가 살아 있으면 모두(gradeOf 의 legacy)
  reference: [{ s: 2, d: 2, t: T_ALL }],
  blocked:   [{ s: 0, d: 0, t: T_ALL }],
});
const fits = (s, d, t, f) => s >= f.s && d >= f.d && f.t.includes(t);
// 행은 축 값(s·d·trend)으로 판정한다 — 등급 이름만으로는 문턱을 물을 수 없다
function meets(row, min) {
  if (!THRESHOLD[min]) throw new Error(`등급 문턱 '${min}' — ${ORDER.join(' | ')}`);
  if (!Number.isFinite(row.s) || !Number.isFinite(row.d)) throw new Error('meets: 행에 축 값(s·d)이 없음');
  return THRESHOLD[min].some((f) => fits(row.s, row.d, row.trend || 'unchecked', f));
}
// a 가 b 보다 엄격하거나 같은가: a 의 모든 바닥이 b 의 어떤 바닥 안에 든다 (관문 문턱은 올리기만 — CLAUDE.md)
const atLeast = (a, b) => THRESHOLD[a].every((fa) => THRESHOLD[b].some((fb) => fa.s >= fb.s && fa.d >= fb.d && fa.t.every((t) => fb.t.includes(t))));
// 관문이 받는 문턱: 등급 이름이고 기본보다 느슨하지 않아야 한다. 오류 문장 또는 null
const gateMinError = (min) => (!THRESHOLD[min] ? `등급 문턱 '${min}' 을 모름 — ${ORDER.join(' | ')}` : !atLeast(min, DEFAULT_MIN) ? `등급 문턱 '${min}' 은 기본(${DEFAULT_MIN})보다 엄격하지 않음 — 문턱은 올리기만 (${ORDER.filter((g) => atLeast(g, DEFAULT_MIN)).join(' | ')})` : null);

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

// 기준과 이유 — 기준마다 이유의 종류·쓰인 항목 수, 이유 미정은 따로 센다
const kinds = (b) => (b && b.length ? b.map((k) => M.VOCAB.reasonBasis[k].label).join('·') : '—');
const reason = (x) => (x.why ? x.why + (x.open ? ` · **미정:** ${x.open}` : '') : `**이유 미정:** ${x.open}`);
function criteriaText(rows) {
  const used = {}; for (const r of rows || []) for (const c of [r.cs, r.cd, r.ct]) if (c) used[c] = (used[c] || 0) + 1;
  const L = ['## 기준과 이유 (`judicial/reliability.js` CRITERIA)', '', '| 기준 | 축·단계 | 조건 | 이유의 종류 | 이유 | 쓰인 항목 |', '|---|---|---|---|---|---|'];
  for (const [id, c] of Object.entries(CRITERIA)) L.push(`| ${id} | ${c.axis} ${c.level} | ${c.when} | ${kinds(c.basis)} | ${reason(c)} | ${used[id] || 0} |`);
  L.push('', '| 등급 | 조건 | 이유의 종류 | 이유 |', '|---|---|---|---|', ...ORDER.map((g) => `| ${g} | ${RULE[g]} | ${kinds(GRADE_WHY[g].basis)} | ${GRADE_WHY[g].why} |`));
  L.push('', '| 정책 | 이유의 종류 | 이유 |', '|---|---|---|', ...Object.values(POLICY).map((x) => `| ${x.what} | ${kinds(x.basis)} | ${reason(x)} |`));
  const nc = Object.values(CRITERIA).filter((c) => c.open).length, np = Object.values(POLICY).filter((x) => x.open).length;
  const tally = {}; for (const x of [...Object.values(CRITERIA), ...Object.values(GRADE_WHY), ...Object.values(POLICY)]) for (const b of x.basis) tally[b] = (tally[b] || 0) + 1;
  L.push('', `이유의 종류 (vocab.reasonBasis): ${Object.keys(M.VOCAB.reasonBasis).map((b) => `${M.VOCAB.reasonBasis[b].label} ${tally[b] || 0}`).join(' · ')}`);
  L.push('', `이유 미정 ${nc + np} (기준 ${nc} · 정책 ${np}) — 이유를 지어내지 않고 드러낸다. 기준을 바꾸는 것은 사용자 결정.`);
  return L.join('\n');
}

// ===== 인정의 용도 (build-plan 72·74) — (기록, 용도) 판정은 여기 하나: judicial/acceptance.js(표·승인 도장)와 관문(constantVerdict)이 같이 부른다 =====
// 용도별 조건 (동작 표 — 라벨·뜻은 vocab.acceptanceUses). floors: 하나라도 맞으면 축 조건 통과. conditional: 맞으면 조건부.
//   sameSpecies: 기록의 종이 기준 종과 같아야(다른 종 값은 서술·비교에만 — 64 전까지 기준 종 하나)
//   confirmed: 출처가 확인된 문헌·도장이어야(S3.unconfirmed 는 높은 용도에 못 씀 — 사용자 결정)
//   notEstimated: 추정에 쓴 관찰은 검증 근거가 될 수 없다(순환) · approval: 승인 도장 필요 · independence: 독립 단위 수(I 축) 요구
const USES = Object.freeze({
  describe: { floors: [{ s: 2, d: 2, t: T_ALL }] },
  compare:  { floors: [{ s: 3, d: 2, t: T_ALL }] },
  estimate: { floors: [{ s: 3, d: 3, t: T_OK }], conditional: [{ s: 4, d: 2, t: T_OK, why: '출처는 최상이나 값이 추론 — 오차 막대가 있을 때만' }], sameSpecies: true },
  evidence: { floors: [{ s: 3, d: 2, t: T_OK }], sameSpecies: true, confirmed: true, notEstimated: true, approval: true },
  standard: { floors: [{ s: 4, d: 4, t: ['match'] }], sameSpecies: true, confirmed: true, approval: true, independence: 2 },
});
const fitsRow = (r, f) => fits(r.s, r.d, r.trend || 'unchecked', f);

// 기록의 종: 관찰은 조건의 종, 정의항 obs 는 맥락의 종, 그 밖은 정의항의 기준 종. 모르면 null
function speciesOf(db, row) {
  if (row.species) return String(row.species); // 부르는 쪽이 아는 종(관문의 상수: kinetics.context.species)
  if (!db) return null;
  if (row.what === 'observation') return ((db.observations[row.sense] || {}).condition || {}).species || null;
  const s = db.senses[row.sense] || {};
  if (row.what === 'obs') { const o = (s.obs || []).find((x) => x.property === row.target); if (o && o.context && o.context.species) return String(o.context.species); }
  if (row.what === 'kinetics') { const ru = (s.rule || []).find((x) => `${row.sense}/rule/${x.id}` === row.target); if (ru && ru.kinetics && ru.kinetics.context && ru.kinetics.context.species) return String(ru.kinetics.context.species); }
  return s.reference_species ? String(s.reference_species) : null;
}
// 한 (기록, 용도) 의 인정. ctx = { db(정규화), ref(기준 종), estimated(Set), approvals(Map 열쇠 → 도장) }
//   status: accepted · conditional · needs_approval(축·관계는 맞고 승인이 없음) · review(승인이 있는데 축·관계가 내려감) · rejected
function accept(row, use, ctx) {
  const u = USES[use];
  if (!u) throw new Error(`용도 '${use}' — ${Object.keys(USES).join(' | ')}`);
  const reasons = [], cond = [];
  const axisOk = u.floors.some((f) => fitsRow(row, f)), condHit = !axisOk && (u.conditional || []).find((f) => fitsRow(row, f));
  if (!axisOk && !condHit) reasons.push(`축 조건 미달: S${row.s}D${row.d} ${row.trend || 'unchecked'} — 필요 ${u.floors.map((f) => `S≥${f.s}∧D≥${f.d}${f.t.length < 3 ? `∧T∈{${f.t.join(',')}}` : ''}`).join(' 또는 ')}`);
  if (condHit) cond.push(condHit.why);
  if (u.confirmed && row.cs === 'S3.unconfirmed') reasons.push('출처 문헌이 확인되지 않음(S3.unconfirmed) — 높은 용도는 학술지 확인이 필요');
  if (u.sameSpecies) { const sp = speciesOf(ctx.db, row); if (sp && sp !== ctx.ref) reasons.push(`종 ${sp} ≠ 기준 종 ${ctx.ref} — 다른 종 값은 서술·비교에만`); }
  if (u.notEstimated && row.what === 'observation' && (ctx.estimated || new Set()).has(row.sense)) reasons.push('추정에 쓴 관찰 — 같은 관찰로 검증하면 순환');
  if (u.notEstimated && row.what !== 'observation') reasons.push('검증 근거는 관찰 기록만');
  if (u.independence) reasons.push(`독립 단위 ≥ ${u.independence} 필요 — I 축이 아직 없다(build-plan 52·71)`);
  const st = u.approval ? (ctx.approvals || new Map()).get(`${row.sense}|${use}`) : null;
  let status;
  if (reasons.length) status = st ? 'review' : 'rejected';
  else if (u.approval && !st) status = 'needs_approval';
  else status = cond.length ? 'conditional' : 'accepted';
  return { use, status, ok: status === 'accepted' || status === 'conditional', reasons, conditions: cond, approval: st ? { by: st.by, at: st.issued_at, reason: st.reason } : null };
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
    out.push({ ref, kind, src: k.src || 'data', ...r, species: (k.context || {}).species || null, grade: gradeOf(r.s, r.d, 'unchecked') });
  };
  for (const R of ir.rules || []) {
    one(R.ref, R.kind, R.k);
    for (const m of R.mods || []) one(m.ref, 'modulation', m.k);
  }
  return out;
}
// 데이터 상수 하나의 관문 판정: 문턱(축 조건) ∧ 인정 '추정' accepted. 위반 문장 또는 null — 관문 두 곳(constantVerdict · judicial 감사)이 이것 하나를 쓴다
function gateMessage(r, min) {
  if (!meets({ ...r, trend: 'unchecked' }, min)) return `등급 ${r.grade || gradeOf(r.s, r.d, 'unchecked')} < ${min} (S${r.s}D${r.d}) — ${r.why || ''}`;
  const a = accept({ ...r, what: 'kinetics', trend: 'unchecked' }, 'estimate', { ref: String(M.VOCAB.defaultReferenceSpecies) });
  return a.status === 'accepted' ? null : `추정으로 인정되지 않음 (${a.status}${a.reasons.length ? ' — ' + a.reasons.join(' · ') : a.conditions.length ? ' — ' + a.conditions.join(' · ') : ''})`;
}
function constantVerdict(ir, sc, opt) {
  sc = sc || {}; opt = opt || {};
  const min = opt.min || sc.min_grade || DEFAULT_MIN, bad = gateMinError(min);
  if (bad) return { error: bad };
  const rows = constants(ir, sc, opt), hypo = !!sc.hypothetical;
  // 데이터 상수 = 문턱(축 조건) ∧ 인정 '추정' accepted — 관문과 인정 표가 같은 판정 (build-plan 74). 조건부(오차 막대)는 관문이 볼 수 없어 통과시키지 않는다
  const violations = rows.map((r) => ({ r, m: r.grade === 'hypothetical' ? (hypo ? null : '가상 값인데 시나리오가 hypothetical 을 선언하지 않음') : gateMessage(r, min) })).filter((x) => x.m).map(({ r, m }) => ({ ...r, msg: m }));
  const byGrade = {};
  for (const r of rows) byGrade[r.grade] = (byGrade[r.grade] || 0) + 1;
  return { min, hypothetical: hypo, n: rows.length, byGrade, rows, violations, ok: !violations.length };
}
const constantText = (v) => (v.error ? v.error : `문턱 ${v.min}${v.hypothetical ? ' · 시나리오는 hypothetical (가상 값 허용)' : ''} · 상수 ${v.n} (${Object.entries(v.byGrade).map(([g, n]) => `${g} ${n}`).join(' · ') || '없음'})${v.violations.length ? ` · 위반 ${v.violations.length}: ${v.violations.slice(0, 3).map((x) => `${x.ref} ${x.msg}`).join(' / ')}` : ''}`);

return Object.freeze({ USES, accept, speciesOf, gateMessage, CRITERIA, GRADE_WHY, POLICY, THRESHOLD, atLeast, gateMinError, criteriaText, DEFAULT_MIN, constants, constantVerdict, constantText, S_LABEL, D_LABEL, GRADES, ORDER, gradeOf, scoreEvidence, scoreObservation, items, summary, meets, gradeText });
});
