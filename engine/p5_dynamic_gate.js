// Phase P5 — 동적 승격·강등 관문. 매 거시 단계마다 FV(P3) 와 대리 모델(P4) 중 빠르고 안전한 쪽을 고른다.
//   A. 강성 지표 O(1): K_est = D_max·Δt/h², N_sub = ⌈C_CFL·K_est⌉. C_CFL 은 P3 FV 의 실제 안정 조건(Δt_sub ≤ 0.4·h²/(6D))에서 나온 6/0.4 = 15 —
//      명세의 '≈ 2' 대신 이 값을 써서 추정이 FV 가 실제로 쓰는 부분 단계 수와 정확히 같다 (FV.substepsFor 와 대조 시험).
//   B. 히스테리시스 상태 기계: FV_ONLY —(N_sub ≥ K_up 이 M 단계 연속, 사전 필터 통과)→ PROMOTED —(N_sub < K_down)→ FV_ONLY.
//      OOD·충격 → 같은 단계 강제 강등 + W 단계 냉각(재승격 시도 없음).
//   C. 공간 사전 필터 O(N): γ = max_i |(∇²u)_i| / (ū + ε) — 대리 모델을 부르기 전에(스펙트럼 변환 비용 없이) 충격을 FV 로.
//   D. 전이 질량 협정: 승격 전 Σu 를 원장에 맞추고(드리프트 제거), 강등 시 음수 잘라내고 재척도 + 보상 합 교정 → |Σu − N_ledger| ≤ 1e-15·N.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GATE = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const C_CFL = 6 / 0.4; // = 15, P3 fv_solver.substepsFor 와 같은 안정 조건

  function stiffness(spec, dt) {
    const Dmax = Math.max(...Object.values(spec.species).map((s) => s.D || 0));
    const h2 = spec.h_m ** 2, K = Dmax * dt / h2;
    // P3 substepsFor 와 같은 부동 소수 연산 순서 (ceil(dt / (0.4·h²/(6D)))) — 경계값에서도 실제 부분 단계 수와 비트 단위로 같다
    return { K, Nsub: Dmax > 0 ? Math.max(1, Math.ceil(dt / (0.4 * h2 / (6 * Dmax)))) : 1 };
  }

  // 공간 충격 지표 γ (활성 칸, 무유속 벽): 종마다 최댓값
  function shockGamma(region, eps) {
    const n = region.n, nn = n * n, mask = region.mask; let worst = 0;
    for (const f of Object.values(region.fields)) {
      let sum = 0; for (const p of region.active) sum += f[p];
      const mean = sum / region.active.length; let mx = 0;
      for (const p of region.active) {
        const i = (p / nn) | 0, j = ((p / n) | 0) % n, k = p % n, c = f[p]; let lap = 0;
        if (i > 0 && mask[p - nn]) lap += f[p - nn] - c; if (i < n - 1 && mask[p + nn]) lap += f[p + nn] - c;
        if (j > 0 && mask[p - n]) lap += f[p - n] - c; if (j < n - 1 && mask[p + n]) lap += f[p + n] - c;
        if (k > 0 && mask[p - 1]) lap += f[p - 1] - c; if (k < n - 1 && mask[p + 1]) lap += f[p + 1] - c;
        const a = Math.abs(lap); if (a > mx) mx = a;
      }
      worst = Math.max(worst, mx / (mean + (eps == null ? 1e-12 : eps)));
    }
    return worst;
  }

  // 보상(Kahan) 합
  function kahan(f, idx) { let s = 0, c = 0; for (const p of idx) { const y = f[p] - c, t = s + y; c = (t - s) - y; s = t; } return s; }
  // 정밀 닻: (1) 음수 0 으로 + 보상 합 + 최대 칸, (2) 재척도 + 보상 합, (3) 남은 차이를 가장 큰 칸에 더하고 보상 합으로 검증 → |Σ − N| 이 부동 소수 한 칸 수준
  function exactAnchor(region, ledgerCounts) {
    const report = { clipped: 0, clippedMass: 0, maxDev: 0 }, act = region.active;
    for (const [key, f] of Object.entries(region.fields)) {
      const N = ledgerCounts[key] || 0;
      let s = 0, c = 0, big = act[0];
      for (const p of act) { let v = f[p]; if (!(v >= 0)) { report.clipped++; if (Number.isFinite(v)) report.clippedMass -= v; v = 0; f[p] = 0; } const y = v - c, t = s + y; c = (t - s) - y; s = t; if (v > f[big]) big = p; }
      if (s > 0) { const fac = N / s; s = 0; c = 0; for (const p of act) { const v = f[p] * fac; f[p] = v; const y = v - c, t = s + y; c = (t - s) - y; s = t; } }
      else { const each = N / act.length; s = 0; c = 0; for (const p of act) { f[p] = each; const y = each - c, t = s + y; c = (t - s) - y; s = t; } }
      let d = N - s; if (d !== 0 && f[big] + d >= 0) f[big] += d;
      let dev = Math.abs(kahan(f, act) - N);
      if (dev !== 0) { d = N - kahan(f, act); if (f[big] + d >= 0) f[big] += d; dev = Math.abs(kahan(f, act) - N); } // 드물게 한 번 더
      report.maxDev = Math.max(report.maxDev, dev / Math.max(1, N));
    }
    return report;
  }

  // 관문 상태 기계
  function createGate(opt) {
    opt = Object.assign({ K_up: 15, K_down: 8, M: 5, W: 20, gammaMargin: 3 }, opt || {});
    if (!(opt.K_down < opt.K_up && opt.M >= 1 && opt.W >= 0)) throw new Error('관문 설정: K_down < K_up, M ≥ 1, W ≥ 0');
    return { opt, state: 'FV_ONLY', upCount: 0, cooldownUntil: -1, gammaMax: null,
      stats: { promotions: 0, demotions: 0, forced: 0, prefilterTrips: 0, oodTrips: 0, cooldownSteps: 0, fvSteps: 0, surSteps: 0, transitions: [] } };
  }
  function trainGamma(gate, snapshotsRegionLike) { // 분포 안 장들의 γ 최댓값 × 여유
    let g = 0; for (const r of snapshotsRegionLike) g = Math.max(g, shockGamma(r));
    gate.gammaMax = Math.max(g, 1e-9) * gate.opt.gammaMargin; return gate.gammaMax;
  }
  // 이번 단계 경로 결정. gammaFn() 은 필요할 때만 부르는 O(N) 사전 필터. 반환 { path: 'fv'|'surrogate', state, event }
  function decide(gate, step, Nsub, gammaFn) {
    const o = gate.opt, log = (ev) => { gate.stats.transitions.push({ step, ev, Nsub }); return ev; };
    if (gate.state === 'PROMOTED') {
      if (Nsub < o.K_down) { gate.state = 'FV_ONLY'; gate.upCount = 0; gate.stats.demotions++; return { path: 'fv', state: gate.state, event: log('demote_stiffness') }; }
      const g = gammaFn();
      if (g > gate.gammaMax) { forceDemote(gate, step); gate.stats.prefilterTrips++; return { path: 'fv', state: gate.state, event: log('demote_prefilter'), gamma: g }; }
      return { path: 'surrogate', state: gate.state, gamma: g };
    }
    // FV_ONLY
    if (step < gate.cooldownUntil) { gate.stats.cooldownSteps++; gate.upCount = 0; return { path: 'fv', state: gate.state, event: 'cooldown' }; }
    if (Nsub >= o.K_up) {
      const g = gammaFn(); // 승격 후보일 때만 O(N)
      if (g <= gate.gammaMax) gate.upCount++; else gate.upCount = 0;
      if (gate.upCount >= o.M) { gate.state = 'PROMOTED'; gate.stats.promotions++; return { path: 'surrogate', state: gate.state, event: log('promote'), gamma: g, promoted: true }; }
    } else gate.upCount = 0;
    return { path: 'fv', state: gate.state };
  }
  function forceDemote(gate, step) { gate.state = 'FV_ONLY'; gate.upCount = 0; gate.cooldownUntil = step + 1 + gate.opt.W; gate.stats.forced++; gate.stats.demotions++; }
  function reportOOD(gate, step) { forceDemote(gate, step); gate.stats.oodTrips++; gate.stats.transitions.push({ step, ev: 'demote_ood' }); }

  return { C_CFL, stiffness, shockGamma, kahan, exactAnchor, createGate, trainGamma, decide, forceDemote, reportOOD };
});
