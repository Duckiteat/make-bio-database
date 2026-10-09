// 사법부 — 통계 판정 (Statistical Verdicts). docs/design/engine-port-roadmap.md §10 (4단계 ②)
//
// 확률 결과는 한 번의 실행으로 맞다고 할 수 없다 — 분포를 기준(해석해 · 다른 방법의 표본 · 관찰)과 검정해 p값과 검정력을 낸다.
// 의존성 없는 순수 함수: 엔진을 부르지 않고 쓰지 않는다. 재표본(붓스트랩·순열)은 사법부 자신의 난수(xoshiro128**, 고정 seed) —
// 엔진의 난수(xoshiro256++)와 일부러 다른 생성기를 쓴다 (판정이 엔진 구현을 빌리지 않게).
//   · 특수 함수: lnΓ(Lanczos) · 정칙 불완전 감마 P/Q · 정칙 불완전 베타 · 정규 분포(Φ, Φ⁻¹) · 콜모고로프 꼬리
//   · 검정: χ² 적합도(기대 < 5 칸 합침) · 분할표 χ²(동질성 — 운명 비율 두 표본) · 이산 Anderson-Darling 한 표본(Choulakian 외 1994,
//     p 는 모수 붓스트랩)·두 표본(Scholz–Stephens 1987 A²_akN, p 는 순열) · KS 한·두 표본(Stephens 보정 점근) · F(분산 비)
//   · 검정력: χ² 적합도(비중심 χ²) · z 검정(평균 차) · 필요한 표준 편차·반복 수
'use strict';

const ALPHA = 0.05, POWER = 0.8; // 판정 문턱 (사법부 상수 — 보고서에 함께 적는다)
const EPS = 1e-15, FPMIN = 1e-300;

// ----- 특수 함수 -----
const LG = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
function lnGamma(x) {
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lnGamma(1 - x);
  x -= 1; let a = LG[0]; const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += LG[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}
// 정칙 불완전 감마: 급수(x < a+1) · 연분수(그 밖) — Numerical Recipes 6.2
function gammaP(a, x) {
  if (!(x > 0)) return 0;
  if (x < a + 1) {
    let ap = a, del = 1 / a, sum = del;
    for (let n = 0; n < 10000; n++) { ap += 1; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * EPS) break; }
    return Math.min(1, sum * Math.exp(-x + a * Math.log(x) - lnGamma(a)));
  }
  return 1 - gammaQ(a, x);
}
function gammaQ(a, x) {
  if (!(x > 0)) return 1;
  if (x < a + 1) return 1 - gammaP(a, x);
  let b = x + 1 - a, c = 1 / FPMIN, d = 1 / b, h = d;
  for (let i = 1; i < 10000; i++) {
    const an = -i * (i - a); b += 2;
    d = an * d + b; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < EPS) break;
  }
  return Math.max(0, Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h);
}
// 정칙 불완전 베타 I_x(a, b) — NR 6.4 (연분수)
function betacf(a, b, x) {
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - (qab * x) / qap; if (Math.abs(d) < FPMIN) d = FPMIN; d = 1 / d; let h = d;
  for (let m = 1; m < 10000; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d;
    const del = d * c; h *= del; if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}
function betaI(a, b, x) {
  if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
}
// 정규 분포: erfc(x) = Q(½, x²) — 꼬리까지 상대 정밀도 유지
const normSf = (z) => (z >= 0 ? 0.5 * gammaQ(0.5, (z * z) / 2) : 1 - 0.5 * gammaQ(0.5, (z * z) / 2));
const normCdf = (z) => normSf(-z);
// Φ⁻¹ — Acklam 근사 + 뉴턴 한 번
function normInv(p) {
  if (!(p > 0 && p < 1)) return p === 0 ? -Infinity : p === 1 ? Infinity : NaN;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  let x;
  if (p < 0.02425) { const q = Math.sqrt(-2 * Math.log(p)); x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  else if (p > 1 - 0.02425) { const q = Math.sqrt(-2 * Math.log(1 - p)); x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  else { const q = p - 0.5, r = q * q; x = ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); }
  const e = normCdf(x) - p, u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
  return x - u / (1 + (x * u) / 2);
}
const chi2Sf = (x, k) => gammaQ(k / 2, x / 2);
const chi2Cdf = (x, k) => gammaP(k / 2, x / 2);
// 비중심 χ² 누적: 푸아송(λ/2) 가중 중심 χ² 의 합
function ncChi2Cdf(x, k, lam) {
  if (!(lam > 0)) return chi2Cdf(x, k);
  const h = lam / 2, j0 = Math.floor(h); let sum = 0;
  const w = (j) => Math.exp(-h + j * Math.log(h) - lnGamma(j + 1));
  for (let j = j0; j < j0 + 100000; j++) { const t = w(j) * chi2Cdf(x, k + 2 * j); sum += t; if (j > j0 + 10 && w(j) < 1e-17) break; }
  for (let j = j0 - 1; j >= 0; j--) { const t = w(j) * chi2Cdf(x, k + 2 * j); sum += t; if (w(j) < 1e-17) break; }
  return Math.min(1, sum);
}
// 콜모고로프 꼬리 Q_KS(λ) = 2 Σ (−1)^{j−1} e^{−2 j² λ²}
function ksSf(lam) {
  if (lam < 0.2) return 1;
  let sum = 0, sign = 1;
  for (let j = 1; j < 200; j++) { const t = sign * Math.exp(-2 * j * j * lam * lam); sum += t; if (Math.abs(t) < 1e-17) break; sign = -sign; }
  return Math.min(1, Math.max(0, 2 * sum));
}
// F 분포 누적 (분산 비 검정)
const fCdf = (f, d1, d2) => (f <= 0 ? 0 : betaI(d1 / 2, d2 / 2, (d1 * f) / (d1 * f + d2)));

// ----- 사법부 난수 (재표본 전용): splitmix32 → xoshiro128** -----
function rng(seed) {
  let x = seed >>> 0;
  const sm = () => { x = (x + 0x9e3779b9) >>> 0; let z = x; z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0; z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0; return (z ^ (z >>> 16)) >>> 0; };
  const s = [sm(), sm(), sm(), sm()];
  const rotl = (v, k) => ((v << k) | (v >>> (32 - k))) >>> 0;
  return () => {
    const r = Math.imul(rotl(Math.imul(s[1], 5) >>> 0, 7), 9) >>> 0, t = (s[1] << 9) >>> 0;
    s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3]; s[2] ^= t; s[3] = rotl(s[3], 11);
    return r / 4294967296;
  };
}
// 이산 분포에서 표본 n 개의 칸별 개수 (역누적)
function drawCounts(p, n, u) {
  const H = []; let acc = 0; for (const q of p) { acc += q; H.push(acc); }
  const out = new Array(p.length).fill(0);
  for (let i = 0; i < n; i++) { const r = u() * acc; let j = 0; while (j < H.length - 1 && r >= H[j]) j++; out[j]++; }
  return out;
}

// ----- 검정 -----
// χ² 적합도: 관찰 개수 vs 기대 확률. 기대 < minExp 칸은 이웃과 합친다(순서 유지). ddof = 추정한 모수 수
function chi2GOF(obs, prob, opt) {
  opt = Object.assign({ minExp: 5, ddof: 0 }, opt || {});
  const n = obs.reduce((a, b) => a + b, 0), P = prob.reduce((a, b) => a + b, 0);
  const cells = []; let co = 0, ce = 0;
  for (let j = 0; j < obs.length; j++) { co += obs[j]; ce += (n * prob[j]) / P; if (ce >= opt.minExp) { cells.push([co, ce]); co = 0; ce = 0; } }
  if (ce > 0 || co > 0) { if (cells.length) { cells[cells.length - 1][0] += co; cells[cells.length - 1][1] += ce; } else cells.push([co, ce]); }
  const stat = cells.reduce((s, [o, e]) => s + ((o - e) * (o - e)) / e, 0), df = cells.length - 1 - opt.ddof;
  return { test: 'chi2_gof', stat, df, p: df > 0 ? chi2Sf(stat, df) : NaN, n, cells: cells.length };
}
// 분할표 χ² (동질성): rows[r][c] 개수 — 예: 운명 비율의 두 표본(SSA 대 τ-도약)
function chi2Contingency(rows) {
  const R = rows.length, Cn = rows[0].length, rs = rows.map((r) => r.reduce((a, b) => a + b, 0)), cs = Array.from({ length: Cn }, (_, c) => rows.reduce((s, r) => s + r[c], 0)), N = rs.reduce((a, b) => a + b, 0);
  let stat = 0, used = 0;
  for (let c = 0; c < Cn; c++) { if (!cs[c]) continue; used++; for (let r = 0; r < R; r++) { const e = (rs[r] * cs[c]) / N; stat += ((rows[r][c] - e) ** 2) / e; } }
  const df = (R - 1) * (used - 1);
  return { test: 'chi2_contingency', stat, df, p: df > 0 ? chi2Sf(stat, df) : NaN, n: N };
}
// 이산 Anderson-Darling 한 표본 (Choulakian·Lockhart·Stephens 1994): A² = (1/n) Σ_{j<k} Z_j² p_j / (H_j (1 − H_j))
function adStatDiscrete(counts, p) {
  const n = counts.reduce((a, b) => a + b, 0), P = p.reduce((a, b) => a + b, 0);
  let Z = 0, H = 0, A = 0;
  for (let j = 0; j < p.length - 1; j++) { const pj = p[j] / P; Z += counts[j] - n * pj; H += pj; if (H > 0 && H < 1 && pj > 0) A += (Z * Z * pj) / (H * (1 - H)); }
  return A / n;
}
function adDiscrete(counts, p, opt) {
  opt = Object.assign({ boot: 2000, seed: 20261009 }, opt || {});
  const n = counts.reduce((a, b) => a + b, 0), A = adStatDiscrete(counts, p), u = rng(opt.seed);
  let ge = 0; for (let b = 0; b < opt.boot; b++) if (adStatDiscrete(drawCounts(p, n, u), p) >= A - 1e-12) ge++;
  return { test: 'ad_discrete', stat: A, p: (ge + 1) / (opt.boot + 1), n, boot: opt.boot, seed: opt.seed };
}
// 이산 Anderson-Darling 두 표본 (Scholz–Stephens 1987, 동점 처리 A²_akN) — p 는 순열
function adStat2(x, y) {
  const all = [...x, ...y], N = all.length, z = [...new Set(all)].sort((a, b) => a - b), cnt = (s) => { const m = new Map(); for (const v of s) m.set(v, (m.get(v) || 0) + 1); return m; };
  const L = cnt(all), samples = [cnt(x), cnt(y)], ns = [x.length, y.length];
  let A = 0;
  for (let i = 0; i < 2; i++) {
    let Mi = 0, B = 0, s = 0;
    for (const v of z) {
      const l = L.get(v), f = samples[i].get(v) || 0; Mi += f; B += l;
      const Ma = Mi - f / 2, Ba = B - l / 2, den = Ba * (N - Ba) - (N * l) / 4;
      if (den > 0) s += (l * (N * Ma - ns[i] * Ba) ** 2) / den;
    }
    A += s / ns[i];
  }
  return ((N - 1) / (N * N)) * A;
}
function ad2Sample(x, y, opt) {
  opt = Object.assign({ perm: 1000, seed: 20261009 }, opt || {});
  const A = adStat2(x, y), all = [...x, ...y], u = rng(opt.seed);
  let ge = 0;
  for (let b = 0; b < opt.perm; b++) {
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(u() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
    if (adStat2(all.slice(0, x.length), all.slice(x.length)) >= A - 1e-12) ge++;
  }
  return { test: 'ad_2sample', stat: A, p: (ge + 1) / (opt.perm + 1), n: [x.length, y.length], perm: opt.perm, seed: opt.seed };
}
// KS 한 표본 (연속 cdf) · 두 표본 — Stephens 보정 점근 p
function ks1(x, cdf) {
  const s = [...x].sort((a, b) => a - b), n = s.length; let D = 0;
  s.forEach((v, i) => { const F = cdf(v); D = Math.max(D, (i + 1) / n - F, F - i / n); });
  const ne = Math.sqrt(n); return { test: 'ks_1sample', stat: D, p: ksSf((ne + 0.12 + 0.11 / ne) * D), n };
}
function ks2(x, y) {
  const a = [...x].sort((p, q) => p - q), b = [...y].sort((p, q) => p - q); let i = 0, j = 0, D = 0;
  while (i < a.length && j < b.length) { const v = Math.min(a[i], b[j]); while (i < a.length && a[i] <= v) i++; while (j < b.length && b[j] <= v) j++; D = Math.max(D, Math.abs(i / a.length - j / b.length)); }
  const ne = Math.sqrt((a.length * b.length) / (a.length + b.length));
  return { test: 'ks_2sample', stat: D, p: ksSf((ne + 0.12 + 0.11 / ne) * D), n: [a.length, b.length] };
}
// 분산 비 F = s1²/s2² (자유도 d1, d2) — 양측 p
function fTest(s1sq, d1, s2sq, d2) {
  const F = s1sq / s2sq, c = fCdf(F, d1, d2);
  return { test: 'f_variance', stat: F, df: [d1, d2], p: Math.min(1, 2 * Math.min(c, 1 - c)), upper: 1 - c };
}

// ----- 검정력 -----
// χ² 적합도: 대립 분포 p1 이 참일 때 귀무 p0 를 기각할 확률 (λ = n Σ (p1 − p0)² / p0)
function powerChi2GOF(p0, p1, n, alpha) {
  alpha = alpha == null ? ALPHA : alpha;
  const df = p0.length - 1, lam = n * p0.reduce((s, q, j) => s + (q > 0 ? ((p1[j] - q) ** 2) / q : 0), 0);
  let lo = 0, hi = 1; while (chi2Sf(hi, df) > alpha) hi *= 2;
  for (let it = 0; it < 200; it++) { const m = (lo + hi) / 2; if (chi2Sf(m, df) > alpha) lo = m; else hi = m; }
  return { power: 1 - ncChi2Cdf(hi, df, lam), lambda: lam, crit: hi, df };
}
// z 검정: 평균 차 δ, 표준 오차 σ — 양측
const zCrit = (alpha) => normInv(1 - (alpha == null ? ALPHA : alpha) / 2);
function powerZ(delta, sigma, alpha) { const z = zCrit(alpha), d = Math.abs(delta) / sigma; return normCdf(d - z) + normCdf(-d - z); }
// δ 를 검정력 power 로 가르려면 필요한 표준 오차
const requiredSE = (delta, alpha, power) => Math.abs(delta) / (zCrit(alpha) + normInv(power == null ? POWER : power));

const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const variance = (a) => { if (a.length < 2) return 0; const m = mean(a); return a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1); };

module.exports = { ALPHA, POWER, lnGamma, gammaP, gammaQ, betaI, normCdf, normSf, normInv, chi2Sf, chi2Cdf, ncChi2Cdf, ksSf, fCdf, rng, drawCounts,
  chi2GOF, chi2Contingency, adStatDiscrete, adDiscrete, adStat2, ad2Sample, ks1, ks2, fTest, powerChi2GOF, powerZ, zCrit, requiredSE, mean, variance };
