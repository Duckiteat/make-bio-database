// 사법부 — 정성 모의 판정 (build-plan 8 · docs/design/integral-field-engine.md §13.7·§13.9)
//
// 정성 관찰(형식 v12 §4)의 기대를 모의 실행 결과와 비교한다: 대조군 대비 방향(늘어남·줄어듦·같음) · 유무 · 단조 · 사건 순서.
// 실행·교란·측정량 계산은 하지 않는다 — 조정자(orchestrator.observeQualitative)가 교란 시나리오(compiler/perturb.js)로
// 대조군·교란군을 돌리고 관찰 연산자(compiler/obs_operator.js)로 측정량 표본을 만들어 넘긴다. 쓰기·엔진 실행 없음.
//   결정론(실행 하나): 차이가 분해능(resolution)보다 커야 방향이 있다. 분해능 = 수치 오차(같은 적분기를 허용 오차 1/1000 로 돌린 기준과의 차)
//     + 측정량의 양자(분자 수 1 개 — 1 개보다 작은 차이는 관찰될 수 없다). 새 문턱 숫자를 두지 않는다.
//   앙상블(확률 실행 여럿): 방향은 양측 z(Welch) 검정 α = stats.ALPHA · 유무·순서는 이항 검정 — 차이를 못 보이면 '보이지 못함'(불일치가 아니다).
//     효과 없음(no_change)을 앙상블로 보이려면 동등성 허용 차이 δ 가 필요하다(M1) — 규약 protocol.equivalence 에 그 측정량이 없으면 '보이지 못함'.
//   결론: 일치는 사전 등록된 규약의 검증 세트에 있는 관찰에서만 결론(conclusive) — 그 밖은 탐색 실행.
//   우연 기준선: 판정한 주장들의 맞힌 수 k 가 우연(vocab.qualitativeExpectations.chance, 순서 1/m!)으로 나올 확률 P(K ≥ k) — 포아송 이항 분포.
'use strict';
const V = require('../vocab.js');
const S = require('./stats.js');

const fact = (m) => (m <= 1 ? 1 : m * fact(m - 1));
const chanceOf = (o) => (o.expect && typeof o.expect === 'object' ? 1 / fact((o.expect.order || []).length) : (V.qualitativeExpectations[o.expect] || {}).chance);
const meanVar = (a) => ({ n: a.length, m: S.mean(a), v: S.variance(a) });
const binomSf = (k, n, p) => (k <= 0 ? 1 : k > n ? 0 : S.betaI(k, n - k + 1, p)); // P(X ≥ k)

// 방향: 대조군 x · 교란군 y (표본 배열). 결정론이면 분해능, 앙상블이면 z 검정
function direction(x, y, res, alpha) {
  const fx = x.filter(Number.isFinite), fy = y.filter(Number.isFinite);
  if (!fx.length || !fy.length) return { observed: 'undefined', why: '측정량이 유한하지 않음 (도달 못 한 사건 시각 등)' };
  const A = meanVar(fx), B = meanVar(fy), d = B.m - A.m;
  if (A.n === 1 && B.n === 1) return { observed: d > res ? 'increase' : d < -res ? 'decrease' : 'no_change', d, resolution: res, mode: 'deterministic' };
  const se = Math.sqrt(A.v / A.n + B.v / B.n);
  if (!(se > 0)) return { observed: d > res ? 'increase' : d < -res ? 'decrease' : 'no_change', d, resolution: res, mode: 'ensemble', note: '두 군 모두 퍼짐 0 — 분해능으로' };
  const z = d / se, p = 2 * S.normSf(Math.abs(z));
  return { observed: p < alpha ? (d > 0 ? 'increase' : 'decrease') : 'not_shown', d, se, z, p, mode: 'ensemble', n: [A.n, B.n] };
}

// 유무: 표본(교란이 있으면 교란군) 하나하나가 '있음' 인가 — 양자 이상 · 도달
function presence(vals, quantum, kind, alpha) {
  const has = vals.map((v) => (kind === 'event_time' ? Number.isFinite(v) : kind === 'fraction' ? v >= 1 : v >= quantum));
  const k = has.filter(Boolean).length, n = has.length;
  if (n === 1) return { observed: has[0] ? 'present' : 'absent', mode: 'deterministic', value: vals[0], quantum };
  // 앙상블: 과반이 있음(없음)을 이항 검정으로 — 반반이 우연
  const pPresent = binomSf(k, n, 0.5), pAbsent = binomSf(n - k, n, 0.5);
  return { observed: pPresent < alpha ? 'present' : pAbsent < alpha ? 'absent' : 'not_shown', mode: 'ensemble', k, n, p: Math.min(pPresent, pAbsent) };
}

// 단조: 시계열 { t, v } (앙상블이면 조정자가 같은 시각의 평균으로 넘김). 연속 차이가 −분해능 아래로 내려가지 않고 전체 변화가 분해능보다 커야
function monotone(series, res) {
  const v = series.v, dif = v.slice(1).map((x, i) => x - v[i]), net = v[v.length - 1] - v[0];
  const up = dif.every((x) => x >= -res) && net > res, down = dif.every((x) => x <= res) && net < -res;
  return { observed: up ? 'monotone_increase' : down ? 'monotone_decrease' : Math.abs(net) <= res && dif.every((x) => Math.abs(x) <= res) ? 'flat' : 'non_monotone', net, resolution: res, points: v.length };
}

// 순서: 실행마다 대상별 첫 도달 시각 [t₁, t₂, …] (못 닿으면 Infinity). 앞의 것이 분해능보다 먼저여야
function order(runs, res, chance, alpha) {
  const ok = runs.map((ts) => ts.every(Number.isFinite) && ts.every((t, i) => !i || t - ts[i - 1] > res)), k = ok.filter(Boolean).length, n = runs.length;
  if (n === 1) return { observed: ok[0] ? 'order' : 'other_order', times: runs[0], resolution: res, mode: 'deterministic' };
  const p = binomSf(k, n, chance);
  return { observed: p < alpha ? 'order' : 'not_shown', k, n, p, chance, mode: 'ensemble' };
}

// 주장 하나. input = { o, control: { values, series?, events? }, perturbed?, resolution, quantum, perturbationAudit?, protocol?, observationId?, equivalence? }
function judgeQualitative(input, opt) {
  const alpha = (opt && opt.alpha) || S.ALPHA, o = input.o, ex = o.expect, isOrder = ex && typeof ex === 'object', row = { expect: isOrder ? { order: ex.order } : ex, chance: chanceOf(o) };
  if (input.perturbationAudit && !input.perturbationAudit.ok) return Object.assign(row, { outcome: 'invalid', why: '교란 차이 검사 실패: ' + input.perturbationAudit.problems.join(' · ') });
  const rel = !isOrder && V.qualitativeExpectations[ex] && V.qualitativeExpectations[ex].relative;
  if (rel && !input.perturbed) return Object.assign(row, { outcome: 'invalid', why: '대조군 비교 기대인데 교란군 실행이 없음' });
  const arm = input.perturbed || input.control;
  let r;
  if (rel) {
    r = direction(input.control.values, input.perturbed.values, input.resolution, alpha);
    if (ex === 'no_change' && r.mode === 'ensemble' && r.observed !== 'increase' && r.observed !== 'decrease') {
      const delta = input.equivalence && input.equivalence.delta;
      if (!(delta > 0)) r = Object.assign(r, { observed: 'not_shown', why: '앙상블에서 효과 없음은 동등성 허용 차이 δ 가 있어야 보인다 (protocol.equivalence)' });
      else { const pLo = S.normSf((r.d + delta) / r.se), pHi = S.normCdf((r.d - delta) / r.se), p = Math.max(pLo, pHi); r = Object.assign(r, { observed: p < alpha ? 'no_change' : 'not_shown', tost_p: p, delta }); }
    }
  } else if (ex === 'present' || ex === 'absent') r = presence(arm.values, input.quantum, o.readout.kind, alpha);
  else if (ex === 'monotone_increase' || ex === 'monotone_decrease') r = monotone(arm.series, input.resolution);
  else if (isOrder) r = order(arm.events, input.resolution, row.chance, alpha);
  else return Object.assign(row, { outcome: 'invalid', why: `알 수 없는 기대 '${ex}'` });
  const want = isOrder ? 'order' : ex;
  const outcome = r.observed === want ? 'match' : r.observed === 'not_shown' || r.observed === 'undefined' ? 'not_shown' : 'mismatch';
  // 결론: 사전 등록된 규약의 검증 세트에 있는 관찰만 (obs_compare 와 같은 규칙)
  const pv = input.protocol, conclusive = !!(pv && pv.declared && pv.ok && input.observationId && (pv.validation || []).includes(input.observationId));
  return Object.assign(row, { observed: r.observed, outcome, conclusive, detail: r, why: r.why || null,
    requirement: conclusive ? '' : !pv || !pv.declared ? '모의 실험 규약이 없음(탐색 실행) — 결론으로 쓰려면 protocol 선언 후 실행 전 사전 등록' : !pv.ok ? '규약 위반: ' + pv.problems.join(' · ') : `관찰 ${input.observationId || '(번호 없음)'} 이 사전 등록된 검증 세트에 없음` });
}

// 우연 기준선: 판정된 주장(맞음·틀림 — 보이지 못함·무효 제외)의 맞힌 수가 우연으로 나올 확률 P(K ≥ k), K ~ 포아송 이항(pᵢ = chance)
function chanceBaseline(rows) {
  const judged = rows.filter((r) => r.outcome === 'match' || r.outcome === 'mismatch'), k = judged.filter((r) => r.outcome === 'match').length;
  let dist = [1];
  for (const r of judged) { const p = r.chance, next = new Array(dist.length + 1).fill(0); dist.forEach((q, i) => { next[i] += q * (1 - p); next[i + 1] += q * p; }); dist = next; }
  const pAtLeast = dist.slice(k).reduce((s, q) => s + q, 0), expected = judged.reduce((s, r) => s + r.chance, 0);
  return { n: judged.length, k, expected_by_chance: expected, p_at_least: judged.length ? pAtLeast : null, not_judged: rows.length - judged.length };
}

const OUT = { match: '맞음', mismatch: '틀림', not_shown: '보이지 못함', invalid: '무효' };
function qualCompareText(rows, base) {
  const out = ['정성 모의 판정'];
  for (const r of rows) {
    const d = r.detail || {};
    out.push(`  ${r.id || ''} 기대 ${typeof r.expect === 'string' ? r.expect : 'order ' + r.expect.order.join(' < ')} · 관찰된 모의 결과 ${r.observed || '—'} → ${OUT[r.outcome]}${r.outcome === 'match' ? (r.conclusive ? ' (결론 — 사전 등록 검증 세트)' : ' (탐색 실행 — 결론 아님)') : ''}`);
    if (d.mode === 'deterministic' && d.d != null) out.push(`      차이 ${d.d.toPrecision(4)} · 분해능 ${d.resolution.toPrecision(3)} (수치 오차 + 양자)`);
    if (d.mode === 'ensemble' && d.p != null) out.push(`      앙상블 ${d.n ? `n ${[].concat(d.n).join('·')}` : ''} · p ${d.p.toPrecision(3)}${d.k != null ? ` · ${d.k}/${d.n}` : ''}`);
    if (r.why) out.push(`      ${r.why}`);
    if (r.requirement) out.push(`      ${r.requirement}`);
  }
  if (base) out.push(`우연 기준선: 판정 ${base.n} 건 중 맞음 ${base.k} (우연 기대 ${base.expected_by_chance.toFixed(2)})${base.p_at_least != null ? ` · 우연으로 ${base.k} 건 이상 맞힐 확률 ${base.p_at_least.toPrecision(3)}` : ''}${base.not_judged ? ` · 판정 못 함 ${base.not_judged}` : ''}`);
  out.push(`α = ${S.ALPHA}. 상수가 가상(hypothetical)인 시나리오의 결과는 기전의 귀결이지 측정 예측이 아니다.`);
  return out.join('\n');
}

module.exports = { judgeQualitative, chanceBaseline, chanceOf, direction, presence, monotone, order, qualCompareText };
