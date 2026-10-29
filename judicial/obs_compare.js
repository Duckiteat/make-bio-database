// 사법부 — 관찰 비교 (Observation Verdict). docs/design/observation-port.md §4 · engine-port-roadmap.md §10 (4단계 ②)
//
// 모델 예측(측정량 표본 — 결정론이면 하나, 앙상블이면 여럿)에 관찰의 측정 잡음 모형을 합성해 관찰과 비교한다.
// 질문은 "너무 시끄러운가"가 아니라 "이 오차 막대로 가를 수 있는가"다.
//   CONSISTENT        가설 하나: 선언된 δ 안임을 동등성 검정(TOST)으로 보임 · 가설 둘: 이 가설만 기각되지 않음 → FINDING
//   CONFLICT          밖 — 모델(데이터)과 관찰의 모순 (p < α)                       → DOMAIN_CONFLICT
//   INDISTINGUISHABLE 가를 수 없음 — 두 가설이 모두 맞거나, 가설 하나인데 일치를 보이지 못함(δ 미선언·근거 등급 미달·정밀도 부족)
//                     → DATA_GAP (Observation_Gap, 필요한 정밀도)
//   "기각하지 못함" 은 일치가 아니다: 오차 막대가 크면 무엇이든 기각되지 않는다 (M1, docs/design/integral-field-engine.md §13.6)
//   일치는 사전 등록된 규약(judicial/protocol.js)의 검증 세트에 있는 관찰에서만 (L3) — opt.protocol · opt.observationId
// 불확도 유형:
//   measurement  관찰 값 = 같은 양을 replicates 번 잰 평균, sd = 한 번 잴 때의 잡음 → 표준 오차 sd/√r. 모델은 평균으로 비교
//   biological   관찰 값 = 개체(세포) r 개의 평균, sd = 개체 간 퍼짐 — 확률 층이 예측하는 것. 평균은 sd/√r 로, 퍼짐은 F 검정으로(앙상블일 때만)
//   combined     sd = 측정 + 생물 합산 퍼짐 — 평균은 sd/√r 로, 모델 퍼짐이 sd 를 넘으면(한쪽 F) 모순
// 모델 쪽 불확도: 앙상블 n 개의 몬테카를로 표준 오차 s/√n 를 더한다. 로그정규는 ln 척도, 계수(poisson)는 분산에 평균/r 을 더한다.
// 추정용(use: estimation) 관찰은 판정하지 않는다 — 상수를 맞춘 관찰로 그 상수를 검증하면 순환이다.
// 엔진을 부르지 않는다: 예측 표본은 조정자가 관찰 연산자(compiler/obs_operator.js predict)로 만들어 넘긴다.
'use strict';
const S = require('./stats.js');
const RELI = require('./reliability.js');
const PROTO = require('./protocol.js');

// 반복 수 미보고(null)는 한 번 잰 것으로 본다 — 표준 오차가 가장 넓은 쪽(보수적), 반복을 지어내지 않음
const reps = (o) => (o.replicates == null ? 1 : o.replicates);

// 불확도 크기 (RULE-0090): 해상도로 채운 sd 는 기본 그대로(A, 보수적) · opt.resolution 'gum' 이면 측정 표준 사각 분포 sd/√12
const GUM_RECT = 1 / Math.sqrt(12);
const isResolution = (o) => o.uncertainty.basis === 'resolution';
function sdOf(o, opt) {
  const conv = (opt && opt.resolution) || 'A';
  if (conv !== 'A' && conv !== 'gum') throw new Error(`해상도 sd 읽기 '${conv}' — A | gum`);
  return isResolution(o) && conv === 'gum' ? o.uncertainty.sd * GUM_RECT : o.uncertainty.sd;
}

// 비교 척도로 옮긴 예측·관찰과 분산 성분
function scale(o, samples, opt) {
  const u = o.uncertainty, r = reps(o), log = u.model === 'lognormal', sd = sdOf(o, opt);
  const finite = samples.filter(Number.isFinite), censored = samples.length - finite.length;
  const xs = log ? finite.map((v) => Math.log(v)) : finite;
  const n = xs.length, mu = n ? S.mean(xs) : NaN, s2 = S.variance(xs);
  const y = log ? Math.log(o.value) : o.value;
  let noise = (sd * sd) / (isResolution(o) ? 1 : r); // 관찰 평균의 측정(또는 합산) 분산 — 해상도는 보고된 평균값 자체의 반올림이라 반복 수로 줄지 않는다
  if (u.model === 'poisson') noise += Math.max(mu, 0) / r; // 계수 잡음
  if (o.observable.kind === 'fraction' || o.observable.kind === 'fraction_above') noise += (mu * (1 - mu)) / r; // r 개 세포를 센 비율의 표집 분산
  const mc = n > 1 ? s2 / n : 0; // 앙상블 평균의 몬테카를로 분산
  return { y, mu, s2, n, censored, noise, mc, se: Math.sqrt(noise + mc), log };
}

// 예측 하나와 관찰 하나 — 평균 검정 (+ 퍼짐 검정)
function test(o, samples, alpha, opt) {
  alpha = alpha == null ? S.ALPHA : alpha;
  const k = scale(o, samples, opt), out = { mu: k.mu, y: k.y, se: k.se, n: k.n, censored: k.censored, scale: k.log ? 'ln' : 'linear', notes: [] };
  if (!k.n) { Object.assign(out, { p: 0, z: Infinity }); out.notes.push('모든 실행이 측정량을 내지 못함(도달 안 함·중도 절단) — 관찰은 도달을 보고함'); return out; }
  if (k.censored) out.notes.push(`실행 ${k.censored}/${samples.length} 개가 도달하지 않아 중도 절단 — 도달한 실행만 평균`);
  if (o.detection_limit != null && o.value <= o.detection_limit) {
    // 검출 한계 아래: 관찰은 상한만 말한다 — 예측이 한계 아래일 확률
    const dl = k.log ? Math.log(o.detection_limit) : o.detection_limit;
    out.p = S.normCdf((dl - k.mu) / k.se); out.z = (k.mu - dl) / k.se; out.notes.push(`검출 한계 ${o.detection_limit} 아래 — 상한 검정`);
  } else if (o.saturation != null && o.value >= o.saturation) {
    // 포화 상한 위: 관찰은 하한만 말한다 (장치 천장) — 예측이 상한 위일 확률
    const sl = k.log ? Math.log(o.saturation) : o.saturation;
    out.p = S.normSf((sl - k.mu) / k.se); out.z = (k.mu - sl) / k.se; out.notes.push(`포화 상한 ${o.saturation} 위 — 하한 검정`);
  } else if (k.se === 0) { out.z = k.y === k.mu ? 0 : Infinity; out.p = k.y === k.mu ? 1 : 0; out.notes.push('불확도 0 — 정확히 같아야 함'); }
  else { out.z = (k.y - k.mu) / k.se; out.p = 2 * S.normSf(Math.abs(out.z)); }
  // 퍼짐: 생물 변이는 확률 앙상블만 예측한다
  const kind = o.uncertainty.kind;
  if (isResolution(o)) { if (o.replicates > 1) out.notes.push('sd 가 해상도로 채운 값(잰 퍼짐 아님) — 퍼짐 검정을 하지 않음'); }
  else if (kind !== 'measurement' && o.replicates > 1) {
    if (k.n < 2) out.notes.push('결정론 예측(실행 1개) — 생물 변이(퍼짐)는 판정할 수 없음: 확률 앙상블 필요');
    else if (k.s2 > 0) {
      const obsVar = o.uncertainty.sd ** 2;
      const f = S.fTest(k.s2, k.n - 1, obsVar, o.replicates - 1);
      out.spread = { model_sd: Math.sqrt(k.s2), obs_sd: o.uncertainty.sd, F: f.stat, p: kind === 'biological' ? f.p : f.upper };
      if (out.spread.p < alpha) out.notes.push(kind === 'biological' ? '모델 퍼짐이 관찰된 생물 변이와 다름' : '모델 퍼짐이 관찰된 전체 퍼짐(측정 + 생물)보다 큼');
    }
  }
  out.ok = out.p >= alpha && !(out.spread && out.spread.p < alpha);
  return out;
}

// 동등성 (M1): 관찰과 예측의 차이가 허용 차이 δ 안임을 두 단측 검정(TOST)으로 보인다.
// δ 는 실행 전에 시나리오가 근거(evidence)와 함께 선언한다. δ 도 값이므로 신뢰 지표 (S,D) 쌍으로 등급을 매긴다 —
// parameter 이상이면 판정, bounded 면 조건부, 그 밖이면 판정하지 않는다(결정 11). 검출 한계 관찰은 δ 없이 "확신 상한" 으로 본다.
function equivalence(o, A, opt) {
  const alpha = opt.alpha, z1 = S.normInv(1 - alpha), d = A.y - A.mu, se = A.se;
  // 일치를 결론으로 쓰려면 사전 등록된 모의 실험 규약이 있고, 이 관찰이 그 규약의 검증 세트에 실행 전부터 있어야 한다 (L3 — 사후 선택 금지)
  const pv = opt.protocol;
  if (!pv || !pv.declared) return { shown: false, requirement: '모의 실험 규약이 없음(탐색 실행) — 일치를 결론으로 쓰려면 protocol 을 선언하고 실행 전에 사전 등록 (node dbtool.mjs register <시나리오>)' };
  if (!pv.ok) return { shown: false, requirement: '모의 실험 규약 위반: ' + pv.problems.join(' · ') };
  if (!opt.observationId || !(pv.validation || []).includes(opt.observationId)) return { shown: false, requirement: `관찰 ${opt.observationId || '(파일 — 번호 없음)'} 이 사전 등록된 검증 세트(protocol.validation)에 없음 — 결과를 본 뒤 고른 관찰은 검증에 쓰지 않는다` };
  // 인정 (build-plan 75): 부르는 쪽이 인정을 넘겼으면 검증 근거로 인정된 관찰만 결론 (넘기지 않으면 확인 안 함)
  const ac = opt.acceptance;
  if (ac && !ac.ok) return { shown: false, requirement: `관찰 ${opt.observationId} 이 검증 근거로 인정되지 않음 (${ac.status}${ac.reasons && ac.reasons.length ? ' — ' + ac.reasons.join(' · ') : ''}) — 결론은 가장 약한 근거를 따른다 (node dbtool.mjs accept)` };
  if (o.detection_limit != null && o.value <= o.detection_limit) {
    const shown = A.p >= 1 - alpha;
    return { kind: 'below_limit', shown, p: 1 - A.p, requirement: shown ? '' : `예측이 검출 한계 아래라고 확신할 수 없음 (확률 ${fmt(A.p)} < ${fmt(1 - alpha)}) — 예측 퍼짐을 줄이거나 더 낮은 검출 한계의 관찰 필요` };
  }
  if (o.saturation != null && o.value >= o.saturation) {
    const shown = A.p >= 1 - alpha;
    return { kind: 'above_saturation', shown, p: 1 - A.p, requirement: shown ? '' : `예측이 포화 상한 위라고 확신할 수 없음 (확률 ${fmt(A.p)} < ${fmt(1 - alpha)}) — 예측 퍼짐을 줄이거나 더 높은 포화 상한의 관찰 필요` };
  }
  const decl = opt.equivalence;
  if (!decl) return { shown: false, requirement: '허용 차이 δ 가 선언되지 않음 — 시나리오 equivalence 에 δ 를 근거(evidence)와 함께 실행 전에 선언해야 일치를 판정할 수 있음' };
  const log = A.scale === 'ln', scale = decl.scale || 'linear';
  if (!(decl.delta > 0) || !Number.isFinite(decl.delta)) return { shown: false, requirement: `δ 가 양의 유한수가 아님 (${decl.delta})` };
  if ((scale === 'ln') !== log) return { shown: false, requirement: `δ 의 척도(${scale})가 관찰의 비교 척도(${A.scale})와 다름` };
  // 판정 강도 = min(δ 근거 등급, 검증 관찰 등급) — 둘 중 약한 쪽이 결론의 강도를 정한다 (결정 11)
  const sd = RELI.scoreEvidence(decl.evidence), dGrade = RELI.gradeOf(sd.s, sd.d, 'unchecked');
  const so = RELI.scoreObservation(o), oGrade = RELI.gradeOf(so.s, so.d, 'unchecked');
  const grade = RELI.ORDER.indexOf(dGrade) >= RELI.ORDER.indexOf(oGrade) ? dGrade : oGrade;
  const base = { delta: decl.delta, scale, grade, delta_grade: dGrade, observation_grade: oGrade, basis: sd.why, d, se };
  if (!['anchor', 'parameter', 'bounded'].includes(dGrade)) return Object.assign(base, { shown: false, requirement: `δ 의 근거 등급이 ${dGrade} (S${sd.s}·D${sd.d}: ${sd.why}) — 동등성 판정에는 parameter 이상(조건부는 bounded) 필요` });
  if (!['anchor', 'parameter', 'bounded'].includes(oGrade)) return Object.assign(base, { shown: false, requirement: `검증 관찰의 등급이 ${oGrade} (S${so.s}·D${so.d}: ${so.why}) — 일치를 결론으로 쓰려면 parameter 이상의 관찰 필요` });
  const p = se > 0 ? Math.max(S.normSf((d + decl.delta) / se), S.normCdf((d - decl.delta) / se)) : Math.abs(d) < decl.delta ? 0 : 1;
  const shown = p < alpha, out = Object.assign(base, { p, shown });
  if (shown && grade === 'bounded') out.conditional = `${dGrade === 'bounded' ? 'δ 근거' : '관찰'}가 bounded — δ = ${fmt(decl.delta)} 가정 아래의 일치`;
  if (!shown) {
    const seReq = (decl.delta - Math.abs(d)) / z1;
    out.required_se = seReq > 0 ? seReq : 0;
    out.requirement = seReq > 0 ? `동등성을 보이려면 표준 오차 ≤ ${fmt(seReq)} (지금 ${fmt(se)}, ${scale === 'ln' ? 'ln 척도, ' : ''}δ ${fmt(decl.delta)})`
      : `관찰과 예측의 차 ${fmt(Math.abs(d))} 가 δ ${fmt(decl.delta)} 이상 — 어떤 정밀도로도 동등성을 보일 수 없음(모순은 아님): δ 의 근거나 모델을 재검토`;
  }
  return out;
}

// 판정: 예측 A (필수), 경쟁 예측 B (선택 — compare 의 Behavior-Changing 쌍)
function verdict(o, predA, predB, opt) {
  opt = Object.assign({ alpha: S.ALPHA, power: S.POWER }, opt || {});
  if (o.use !== 'validation') return { error: `관찰의 용도가 ${o.use} — 추정용 관찰은 판정하지 않음 (상수를 맞춘 관찰로 그 상수를 검증하면 순환)` };
  if (o.retracted) return { error: '철회된 관찰 — 판정하지 않음' };
  const A = test(o, predA, opt.alpha, opt), out = { observable: o.observable, alpha: opt.alpha, power_target: opt.power, A };
  if (isResolution(o)) out.sd_basis = { basis: 'resolution', read: opt.resolution || 'A', sd: sdOf(o, opt) }; // 판정에 쓴 sd 읽기가 결과에 남는다
  if (!predB) {
    // 가설 하나: 기각하지 못한 것은 일치가 아니다 — 일치는 동등성(TOST)으로 적극적으로 보여야 한다 (M1)
    if (!A.ok) out.verdict = 'CONFLICT';
    else {
      const eq = equivalence(o, A, opt); out.equivalence = eq;
      out.verdict = eq.shown ? 'CONSISTENT' : 'INDISTINGUISHABLE';
      if (eq.shown && eq.conditional) out.conditional = eq.conditional;
      if (!eq.shown) out.limitation = { type: 'Observation_Gap', requirement: eq.requirement };
    }
  } else {
    const B = test(o, predB, opt.alpha, opt); out.B = B;
    // 가를 수 있는가: 두 예측 평균의 차를 관찰 하나의 표준 오차로 — 검정력
    const se = Math.max(A.se, B.se), delta = A.mu - B.mu;
    if (A.ok && B.ok) out.verdict = 'INDISTINGUISHABLE';
    else if (A.ok || B.ok) { out.verdict = A.ok ? 'CONSISTENT' : 'CONFLICT'; out.preferred = A.ok ? 'A' : 'B'; }
    else out.verdict = 'CONFLICT';
    if (!Number.isFinite(delta)) {
      // 한 가설은 측정량을 내지 않음(도달 안 함) — 관찰이 있다는 것 자체로 가른다
      out.discrimination = { delta: null, se, power: 1, scale: A.scale, note: '한 가설은 측정량을 내지 않음 — 관찰의 존재로 가름' };
    } else {
      out.discrimination = { delta, se, power: se > 0 ? S.powerZ(delta, se, opt.alpha) : delta ? 1 : 0, scale: A.scale };
      // 필요한 정밀도: 지금 반복 수에서 sd, 지금 sd 에서 반복 수 (몬테카를로 분산은 빼고 — 앙상블을 늘려 줄일 수 있음)
      const seReq = S.requiredSE(delta, opt.alpha, opt.power), r = reps(o), mc = Math.max(scale(o, predA, opt).mc, scale(o, predB, opt).mc);
      const noiseReq = seReq * seReq - mc;
      out.required = { se: seReq, sd_at_replicates: noiseReq > 0 ? Math.sqrt(noiseReq * r) : 0, replicates_at_sd: noiseReq > 0 ? Math.ceil((sdOf(o, opt) ** 2) / noiseReq) : Infinity, scale: A.scale,
        note: delta === 0 ? '두 가설의 예측이 같음 — 이 측정량으로는 어떤 정밀도로도 가를 수 없음' : noiseReq > 0 ? '' : '모델 쪽 몬테카를로 오차가 이미 필요한 표준 오차보다 큼 — 앙상블을 늘려야 함' };
    }
  }
  out.fault = { CONSISTENT: 'FINDING', CONFLICT: 'DOMAIN_CONFLICT', INDISTINGUISHABLE: 'DATA_GAP' }[out.verdict];
  if (out.verdict === 'INDISTINGUISHABLE' && out.required) out.limitation = { type: 'Observation_Gap', requirement: `두 가설을 가르려면 ${out.required.scale === 'ln' ? 'ln 척도 ' : ''}표준 오차 ≤ ${fmt(out.required.se)} (지금 ${fmt(Math.max(A.se, out.B.se))}): 반복 ${reps(o)} 회${o.replicates == null ? '(미보고 — 1 회로 봄)' : ''}면 sd ≤ ${fmt(out.required.sd_at_replicates)}, 지금 sd 면 반복 ≥ ${out.required.replicates_at_sd}` };
  return out;
}
const fmt = (x) => (Number.isFinite(x) ? Number(x.toPrecision(4)).toString() : String(x));

// 관찰 없이: 두 가설을 가를 실험 설계 — 측정 잡음 sd 에서 필요한 반복 수 (Observation_Gap 의 요구 사항)
function design(o, predA, predB, opt) {
  opt = Object.assign({ alpha: S.ALPHA, power: S.POWER }, opt || {});
  const a = scale(o, predA, opt), b = scale(o, predB, opt), delta = a.mu - b.mu, seReq = S.requiredSE(delta, opt.alpha, opt.power), noiseReq = seReq * seReq - Math.max(a.mc, b.mc);
  return { delta, se: seReq, replicates: noiseReq > 0 ? Math.ceil((sdOf(o, opt) ** 2) / noiseReq) : Infinity, scale: a.log ? 'ln' : 'linear' };
}

function verdictText(v) {
  if (v.error) return '관찰 판정 거부: ' + v.error;
  const row = (h, t) => `| ${h} | ${fmt(t.mu)} | ${fmt(t.se)} | ${fmt(t.z)} | ${fmt(t.p)} | ${t.spread ? `F ${fmt(t.spread.F)}, p ${fmt(t.spread.p)}` : '—'} | ${t.notes.join('; ') || '—'} |`;
  const lines = [`관찰 판정: **${v.verdict}** [${v.fault}] — ${v.observable.kind} @ ${v.observable.target} (α ${v.alpha}, 목표 검정력 ${v.power_target})`, '',
    '| 가설 | 예측 평균 | 표준 오차 | z | p | 퍼짐 | 메모 |', '|---|---|---|---|---|---|---|', row('A', v.A)];
  if (v.sd_basis) lines.push('', `불확도: 원문 미보고 — sd ${fmt(v.sd_basis.sd)} 는 유효 숫자 해상도로 채운 값 (읽기 ${v.sd_basis.read === 'gum' ? 'GUM 사각 분포 ÷√12' : 'A — 해상도 그대로, 보수적'})`);
  if (v.B) lines.push(row('B', v.B), '', v.required ? `가름: 차 ${fmt(v.discrimination.delta)} (${v.discrimination.scale}), 검정력 ${fmt(v.discrimination.power)} · 필요한 표준 오차 ≤ ${fmt(v.required.se)}${v.required.note ? ' — ' + v.required.note : ''}` : `가름: ${v.discrimination.note}`);
  if (v.equivalence) {
    const e = v.equivalence;
    lines.push('', e.kind === 'below_limit' ? `확신 상한: 예측이 검출 한계 아래일 확률 ${fmt(1 - e.p)}`
      : e.kind === 'above_saturation' ? `확신 하한: 예측이 포화 상한 위일 확률 ${fmt(1 - e.p)}`
      : e.delta != null ? `동등성(TOST): δ ${fmt(e.delta)} (${e.scale}, 강도 ${e.grade} = min(δ ${e.delta_grade}, 관찰 ${e.observation_grade}) — ${e.basis}), 차 ${fmt(e.d)}, 표준 오차 ${fmt(e.se)}${e.p != null ? `, p ${fmt(e.p)}` : ''}${v.conditional ? ' — ' + v.conditional : ''}`
      : '동등성: 판정 안 함 (아래 사유)');
  }
  if (v.preferred) lines.push(`관찰이 고른 가설: ${v.preferred}`);
  if (v.context_transfer) lines.push('', PROTO.contextTransferText(v.context_transfer)); // V8 맥락 이전 (build-plan 59)
  if (v.limitation) lines.push('', `→ 한계 후보 ${v.limitation.type}: ${v.limitation.requirement}`);
  return lines.join('\n');
}

module.exports = { scale, test, verdict, design, verdictText, sdOf, GUM_RECT };
