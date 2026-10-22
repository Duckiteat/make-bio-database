// 사법부 — 확률 감사·앙상블 판정 (Stochastic Audit). docs/design/engine-port-roadmap.md §10 (4단계 ④)
//
// 확률 실행의 원자료(행정부 — 궤적마다 seed·궤적 번호·규칙별 발화 수)를 받아 판정한다. 엔진을 부르지 않는다:
// 다시 돌린 궤적·다른 방식의 앙상블·부피 계열은 조정자(orchestrator.js)가 만들어 넘긴다.
//   궤적 하나  ① 원자료 계약·독립 질량 검증(fate_audit.judgeFate — 원장·재생·음수) ② 발화 수가 음이 아닌 정수 ③ seed 재현(같은 입력 → 같은 궤적 해시)
//   앙상블    ④ 운명 비율(Wilson 구간)·도달 시각 분포·표지 분포(평균·sd·Fano) ⑤ 방식 비교(정확 SSA 대 τ-도약: 이산 AD 두 표본·분할표 χ²)
//             ⑥ 결정론 극한: 부피 Ω 를 키우면 앙상블 평균이 결정론 궤적으로 다가감(상대 오차가 줄어듦)
// 결함 태그: 발화 수·재현·원장 실패 → ENGINE_DEFECT, 방식 비교·극한 실패 → NUMERICAL(결합점 leap_eps·분할 문턱 — 생물 상수를 바꾸지 않음).
'use strict';
const S = require('./stats.js');
const FA = require('./fate_audit.js');

function auditTrajectory(db, r, ctx) {
  const v = FA.judgeFate(db, r, ctx || {}), items = [];
  if (v.error) return { error: v.error, audit: v.audit };
  const st = r.stochastic;
  if (!st) items.push({ code: 'AUDIT_STOCH', fault: 'ENGINE_DEFECT', where: '원자료', msg: '확률 실행인데 stochastic 원자료가 없음' });
  else for (const x of st.rules) if (!(Number.isInteger(x.ssa) && x.ssa >= 0 && Number.isInteger(x.leap) && x.leap >= 0)) items.push({ code: 'AUDIT_STOCH', fault: 'ENGINE_DEFECT', where: x.ref, msg: `발화 수가 음이 아닌 정수가 아님 (ssa ${x.ssa}, leap ${x.leap})` });
  return { verdict: v, audit: [...v.audit, ...items], hash: v.process.hash };
}

// ③ 같은 (seed, 궤적)으로 다시 돌린 원자료와 해시 비교
function reproducible(a, b) {
  const ha = FA.trajectoryHash(a), hb = FA.trajectoryHash(b);
  return { ok: ha === hb, a: ha, b: hb, fault: ha === hb ? 'FINDING' : 'ENGINE_DEFECT' };
}

// Wilson 점수 구간 (비율)
function wilson(k, n, z) {
  z = z || S.zCrit(); if (!n) return [0, 1];
  const p = k / n, d = 1 + (z * z) / n, c = (p + (z * z) / (2 * n)) / d, w = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - w), Math.min(1, c + w)];
}
const quant = (xs, q) => { const s = [...xs].sort((a, b) => a - b); if (!s.length) return NaN; const i = (s.length - 1) * q, lo = Math.floor(i); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo); };

// ④ 앙상블 요약: 끝 상태 비율, 도달 시각 분포(도달한 궤적만 — 도달 못 한 수를 함께), 표지의 끝 분포
function ensembleSummary(raws) {
  const n = raws.length, fate = {}, reach = {}, markers = {};
  for (const r of raws) {
    const k = r.final.state || 'none'; fate[k] = (fate[k] || 0) + 1;
    for (const [s, t] of Object.entries(r.firstReach)) if (s !== r.source) (reach[s] = reach[s] || []).push(t);
    for (const b of r.markers) (markers[b] = markers[b] || []).push(r.final.N[b]);
  }
  const out = { n, fate: {}, reach: {}, markers: {} };
  for (const [s, k] of Object.entries(fate)) out.fate[s] = { k, p: k / n, ci: wilson(k, n) };
  for (const [s, ts] of Object.entries(reach)) out.reach[s] = { reached: ts.length, of: n, mean: S.mean(ts), sd: Math.sqrt(S.variance(ts)), q10: quant(ts, 0.1), q50: quant(ts, 0.5), q90: quant(ts, 0.9) };
  for (const [b, xs] of Object.entries(markers)) { const m = S.mean(xs), v = S.variance(xs); out.markers[b] = { mean: m, sd: Math.sqrt(v), fano: m > 0 ? v / m : NaN, cv: m > 0 ? Math.sqrt(v) / m : NaN }; }
  return out;
}

// ⑤ 두 방식(예: 정확 SSA 대 τ-도약)의 앙상블이 같은 분포인가: 묶음별 끝 개수(이산 AD 두 표본) + 끝 상태 분할표 χ²
function compareMethods(rawsA, rawsB, bundles, opt) {
  opt = Object.assign({ alpha: S.ALPHA, perm: 500, seed: 20261009 }, opt || {});
  const tests = bundles.map((b) => ({ bundle: b, ...S.ad2Sample(rawsA.map((r) => Math.round(r.final.N[b])), rawsB.map((r) => Math.round(r.final.N[b])), { perm: opt.perm, seed: opt.seed }) }));
  const states = [...new Set([...rawsA, ...rawsB].map((r) => r.final.state || 'none'))];
  const row = (rs) => states.map((s) => rs.filter((r) => (r.final.state || 'none') === s).length);
  const fate = states.length > 1 ? S.chi2Contingency([row(rawsA), row(rawsB)]) : { test: 'chi2_contingency', p: 1, note: '끝 상태 하나뿐' };
  // 여러 검정 — Bonferroni
  const m = tests.length + 1, ok = tests.every((t) => t.p >= opt.alpha / m) && !(fate.p < opt.alpha / m);
  return { tests, fate, alpha: opt.alpha, bonferroni: m, ok, fault: ok ? 'FINDING' : 'NUMERICAL' };
}

// ⑥ 결정론 극한: rows = [{ omega, raws(확률 앙상블), det(같은 Ω 결정론 원자료) }] — 표지 궤적의 앙상블 평균 대 결정론의 상대 L2
function limitTrend(rows, bundles) {
  const err = rows.map(({ omega, raws, det }) => {
    let num = 0, den = 0;
    for (const b of bundles) {
      const i = det.keys.indexOf(b);
      for (let j = 0; j < det.series.length; j++) { const m = S.mean(raws.map((r) => r.series[j][i])); num += (m - det.series[j][i]) ** 2; den += det.series[j][i] ** 2; }
    }
    return { omega, n: raws.length, rel: den ? Math.sqrt(num / den) : 0 };
  });
  const decreasing = err.every((e, k) => !k || e.rel < err[k - 1].rel);
  const slope = err.length > 1 ? Math.log(err[err.length - 1].rel / err[0].rel) / Math.log(err[err.length - 1].omega / err[0].omega) : NaN;
  return { err, decreasing, slope, fault: decreasing ? 'FINDING' : 'NUMERICAL' };
}

// 수렴 스윕 판정 (build-plan 45): 허용 오차를 조인 수열 runs = [{tol, det}] 의 각 궤적을 더 조인 기준해 ref 와 상대 L2 로 대조.
//   converged = 가장 큰 오차도 bound 미만 (적분기 기여가 무시 가능 — 현실과의 차이는 수치가 아니라 모델·데이터). 아니면 NUMERICAL.
//   매끈한 계는 느슨한 허용 오차에서도 바닥이라 차수 slope 가 깨끗하지 않을 수 있다 — 보고만 하고 수렴 판정은 bound 로 한다.
function convergenceTrend(runs, ref, bundles, bound) {
  const rel = (det) => { let num = 0, den = 0; for (const b of bundles) { const i = det.keys.indexOf(b), ir = ref.keys.indexOf(b); const L = Math.min(det.series.length, ref.series.length); for (let j = 0; j < L; j++) { num += (det.series[j][i] - ref.series[j][ir]) ** 2; den += ref.series[j][ir] ** 2; } } return den ? Math.sqrt(num / den) : 0; };
  const err = runs.map(({ tol, det }) => ({ tol, rel: rel(det) }));
  const worst = Math.max(...err.map((e) => e.rel)), converged = worst < bound;
  const a = err[0], z = err[err.length - 1];
  const slope = err.length > 1 && a.rel > 0 && z.rel > 0 ? Math.log(z.rel / a.rel) / Math.log(z.tol / a.tol) : NaN;
  return { err, worst, bound, converged, slope, fault: converged ? 'FINDING' : 'NUMERICAL' };
}

function ensembleText(sum) {
  const pct = (x) => (100 * x).toFixed(1) + '%', h = (s) => (s / 3600).toFixed(2) + ' h', f = (x) => (Number.isFinite(x) ? (+x.toPrecision(4)).toString() : '—');
  const lines = [`앙상블 ${sum.n} 궤적`, '', '| 끝 상태 | 수 | 비율 | 95% 구간 |', '|---|---|---|---|', ...Object.entries(sum.fate).map(([s, x]) => `| ${s} | ${x.k} | ${pct(x.p)} | ${pct(x.ci[0])}–${pct(x.ci[1])} |`)];
  if (Object.keys(sum.reach).length) lines.push('', '| 도달 | 도달 수 | 평균 | sd | 10% | 50% | 90% |', '|---|---|---|---|---|---|---|', ...Object.entries(sum.reach).map(([s, x]) => `| ${s} | ${x.reached}/${x.of} | ${h(x.mean)} | ${h(x.sd)} | ${h(x.q10)} | ${h(x.q50)} | ${h(x.q90)} |`));
  lines.push('', '| 표지 (끝) | 평균 | sd | Fano | CV |', '|---|---|---|---|---|', ...Object.entries(sum.markers).map(([b, x]) => `| ${b} | ${f(x.mean)} | ${f(x.sd)} | ${f(x.fano)} | ${f(x.cv)} |`));
  return lines.join('\n');
}

module.exports = { auditTrajectory, reproducible, wilson, ensembleSummary, compareMethods, limitTrend, convergenceTrend, ensembleText };
