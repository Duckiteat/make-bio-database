// 사법부 — 관찰 비교 (Observation Verdict). docs/design/observation-port.md §4 · engine-port-roadmap.md §10 (4단계 ②)
//
// 모델 예측(측정량 표본 — 결정론이면 하나, 앙상블이면 여럿)에 관찰의 측정 잡음 모형을 합성해 관찰과 비교한다.
// 질문은 "너무 시끄러운가"가 아니라 "이 오차 막대로 가를 수 있는가"다.
//   CONSISTENT        관찰이 예측 ⊛ 측정 잡음 안 (p ≥ α)                         → FINDING
//   CONFLICT          밖 — 모델(데이터)과 관찰의 모순 (p < α)                       → DOMAIN_CONFLICT
//   INDISTINGUISHABLE 경쟁 가설 둘(compare 의 Behavior-Changing 쌍)이 모두 맞음 — 가를 수 없음 → DATA_GAP (Observation_Gap, 필요한 정밀도)
// 불확도 유형:
//   measurement  관찰 값 = 같은 양을 replicates 번 잰 평균, sd = 한 번 잴 때의 잡음 → 표준 오차 sd/√r. 모델은 평균으로 비교
//   biological   관찰 값 = 개체(세포) r 개의 평균, sd = 개체 간 퍼짐 — 확률 층이 예측하는 것. 평균은 sd/√r 로, 퍼짐은 F 검정으로(앙상블일 때만)
//   combined     sd = 측정 + 생물 합산 퍼짐 — 평균은 sd/√r 로, 모델 퍼짐이 sd 를 넘으면(한쪽 F) 모순
// 모델 쪽 불확도: 앙상블 n 개의 몬테카를로 표준 오차 s/√n 를 더한다. 로그정규는 ln 척도, 계수(poisson)는 분산에 평균/r 을 더한다.
// 추정용(use: estimation) 관찰은 판정하지 않는다 — 상수를 맞춘 관찰로 그 상수를 검증하면 순환이다.
// 엔진을 부르지 않는다: 예측 표본은 조정자가 관찰 연산자(compiler/obs_operator.js predict)로 만들어 넘긴다.
'use strict';
const S = require('./stats.js');

// 비교 척도로 옮긴 예측·관찰과 분산 성분
function scale(o, samples) {
  const u = o.uncertainty, r = o.replicates, log = u.model === 'lognormal';
  const finite = samples.filter(Number.isFinite), censored = samples.length - finite.length;
  const xs = log ? finite.map((v) => Math.log(v)) : finite;
  const n = xs.length, mu = n ? S.mean(xs) : NaN, s2 = S.variance(xs);
  const y = log ? Math.log(o.value) : o.value;
  let noise = (u.sd * u.sd) / r; // 관찰 평균의 측정(또는 합산) 분산
  if (u.model === 'poisson') noise += Math.max(mu, 0) / r; // 계수 잡음
  if (o.observable.kind === 'fraction') noise += (mu * (1 - mu)) / r; // r 개 세포를 센 비율의 표집 분산
  const mc = n > 1 ? s2 / n : 0; // 앙상블 평균의 몬테카를로 분산
  return { y, mu, s2, n, censored, noise, mc, se: Math.sqrt(noise + mc), log };
}

// 예측 하나와 관찰 하나 — 평균 검정 (+ 퍼짐 검정)
function test(o, samples, alpha) {
  alpha = alpha == null ? S.ALPHA : alpha;
  const k = scale(o, samples), out = { mu: k.mu, y: k.y, se: k.se, n: k.n, censored: k.censored, scale: k.log ? 'ln' : 'linear', notes: [] };
  if (!k.n) { Object.assign(out, { p: 0, z: Infinity }); out.notes.push('모든 실행이 측정량을 내지 못함(도달 안 함·중도 절단) — 관찰은 도달을 보고함'); return out; }
  if (k.censored) out.notes.push(`실행 ${k.censored}/${samples.length} 개가 도달하지 않아 중도 절단 — 도달한 실행만 평균`);
  if (o.detection_limit != null && o.value <= o.detection_limit) {
    // 검출 한계 아래: 관찰은 상한만 말한다 — 예측이 한계 아래일 확률
    const dl = k.log ? Math.log(o.detection_limit) : o.detection_limit;
    out.p = S.normCdf((dl - k.mu) / k.se); out.z = (k.mu - dl) / k.se; out.notes.push(`검출 한계 ${o.detection_limit} 아래 — 상한 검정`);
  } else if (k.se === 0) { out.z = k.y === k.mu ? 0 : Infinity; out.p = k.y === k.mu ? 1 : 0; out.notes.push('불확도 0 — 정확히 같아야 함'); }
  else { out.z = (k.y - k.mu) / k.se; out.p = 2 * S.normSf(Math.abs(out.z)); }
  // 퍼짐: 생물 변이는 확률 앙상블만 예측한다
  const kind = o.uncertainty.kind;
  if (kind !== 'measurement' && o.replicates > 1) {
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

// 판정: 예측 A (필수), 경쟁 예측 B (선택 — compare 의 Behavior-Changing 쌍)
function verdict(o, predA, predB, opt) {
  opt = Object.assign({ alpha: S.ALPHA, power: S.POWER }, opt || {});
  if (o.use !== 'validation') return { error: `관찰의 용도가 ${o.use} — 추정용 관찰은 판정하지 않음 (상수를 맞춘 관찰로 그 상수를 검증하면 순환)` };
  if (o.retracted) return { error: '철회된 관찰 — 판정하지 않음' };
  const A = test(o, predA, opt.alpha), out = { observable: o.observable, alpha: opt.alpha, power_target: opt.power, A };
  if (!predB) {
    out.verdict = A.ok ? 'CONSISTENT' : 'CONFLICT';
  } else {
    const B = test(o, predB, opt.alpha); out.B = B;
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
      const seReq = S.requiredSE(delta, opt.alpha, opt.power), r = o.replicates, mc = Math.max(scale(o, predA).mc, scale(o, predB).mc);
      const noiseReq = seReq * seReq - mc;
      out.required = { se: seReq, sd_at_replicates: noiseReq > 0 ? Math.sqrt(noiseReq * r) : 0, replicates_at_sd: noiseReq > 0 ? Math.ceil((o.uncertainty.sd ** 2) / noiseReq) : Infinity, scale: A.scale,
        note: delta === 0 ? '두 가설의 예측이 같음 — 이 측정량으로는 어떤 정밀도로도 가를 수 없음' : noiseReq > 0 ? '' : '모델 쪽 몬테카를로 오차가 이미 필요한 표준 오차보다 큼 — 앙상블을 늘려야 함' };
    }
  }
  out.fault = { CONSISTENT: 'FINDING', CONFLICT: 'DOMAIN_CONFLICT', INDISTINGUISHABLE: 'DATA_GAP' }[out.verdict];
  if (out.verdict === 'INDISTINGUISHABLE' && out.required) out.limitation = { type: 'Observation_Gap', requirement: `두 가설을 가르려면 ${out.required.scale === 'ln' ? 'ln 척도 ' : ''}표준 오차 ≤ ${fmt(out.required.se)} (지금 ${fmt(Math.max(A.se, out.B.se))}): 반복 ${o.replicates} 회면 sd ≤ ${fmt(out.required.sd_at_replicates)}, 지금 sd 면 반복 ≥ ${out.required.replicates_at_sd}` };
  return out;
}
const fmt = (x) => (Number.isFinite(x) ? Number(x.toPrecision(4)).toString() : String(x));

// 관찰 없이: 두 가설을 가를 실험 설계 — 측정 잡음 sd 에서 필요한 반복 수 (Observation_Gap 의 요구 사항)
function design(o, predA, predB, opt) {
  opt = Object.assign({ alpha: S.ALPHA, power: S.POWER }, opt || {});
  const a = scale(o, predA), b = scale(o, predB), delta = a.mu - b.mu, seReq = S.requiredSE(delta, opt.alpha, opt.power), noiseReq = seReq * seReq - Math.max(a.mc, b.mc);
  return { delta, se: seReq, replicates: noiseReq > 0 ? Math.ceil((o.uncertainty.sd ** 2) / noiseReq) : Infinity, scale: a.log ? 'ln' : 'linear' };
}

function verdictText(v) {
  if (v.error) return '관찰 판정 거부: ' + v.error;
  const row = (h, t) => `| ${h} | ${fmt(t.mu)} | ${fmt(t.se)} | ${fmt(t.z)} | ${fmt(t.p)} | ${t.spread ? `F ${fmt(t.spread.F)}, p ${fmt(t.spread.p)}` : '—'} | ${t.notes.join('; ') || '—'} |`;
  const lines = [`관찰 판정: **${v.verdict}** [${v.fault}] — ${v.observable.kind} @ ${v.observable.target} (α ${v.alpha}, 목표 검정력 ${v.power_target})`, '',
    '| 가설 | 예측 평균 | 표준 오차 | z | p | 퍼짐 | 메모 |', '|---|---|---|---|---|---|---|', row('A', v.A)];
  if (v.B) lines.push(row('B', v.B), '', v.required ? `가름: 차 ${fmt(v.discrimination.delta)} (${v.discrimination.scale}), 검정력 ${fmt(v.discrimination.power)} · 필요한 표준 오차 ≤ ${fmt(v.required.se)}${v.required.note ? ' — ' + v.required.note : ''}` : `가름: ${v.discrimination.note}`);
  if (v.preferred) lines.push(`관찰이 고른 가설: ${v.preferred}`);
  if (v.limitation) lines.push('', `→ 한계 후보 ${v.limitation.type}: ${v.limitation.requirement}`);
  return lines.join('\n');
}

module.exports = { scale, test, verdict, design, verdictText };
