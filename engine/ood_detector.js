// Phase P4 — 분포 이탈(OOD)·수치 안정성 탐지기. 대리 모델 한 단계의 입력(사전)과 원 출력(사후)을 같은 단계 안에서 검사한다.
//   S_ood = w1·E_spec/E_ref + w2·V_grad/V_ref + w3·ΔG_drift/tol,  S_ood > τ_ood(=1) 이면 그 단계의 대리 출력을 버리고 FV 로 (지연 0 단계).
//   E_spec : 전체 스펙트럼 에너지(직류 포함) 중 고주파 대역(어느 축이든 모드 번호 ≥ n/2)의 비율 — 공간 진동(ringing)·충격
//            (직류를 빼면 거의 평평한 장 — 가장 분포 안인 상태 — 에서 비율이 폭발해 오탐이 난다: P4 첫 실행에서 확인)
//   V_grad : max|∇C| / (⟨|∇C|⟩ + ε·C̄) (활성 칸, ε = 0.01) — 기울기 폭발·국소 스파이크. ε·C̄ 항은 평평한 장에서 분모가 0 으로 가는 것을 막는다
//   대리 모델이 계산한 입력·출력 스펙트럼(sur.lastSpectra)을 그대로 써서 추가 변환 없이 평가한다
//   ΔG_drift: 가역 반응 쌍의 |ln(k_f/k_r) + ΔG°/RT| — 미시적 가역성(불변식 5)에서 벗어난 속도 집합
//   E_ref·V_ref 는 학습 분포(보정용 장 + P3 FV 궤적 스냅숏)의 최댓값 × 여유(margin). 가중치 합 = 1 이라 분포 안에서는 S < 1/margin·…
//   즉시 OOD(점수 ∞): 상자 아닌 기준 경계, 이류, 겹치는 반응 쌍, 학습 안 됨, 비유한 값, 큰 음수(원 출력의 −1% 넘는 음수 질량).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./fno_surrogate.js'));
  else root.OOD = factory(root.FNO);
})(typeof self !== 'undefined' ? self : this, function (FNO) {
  'use strict';
  const R = 8.314462618, T = 310.15, LN_TOL = Math.log(1.1);

  function spectralHighFraction(field, n, dct) { return FNO.bandEnergy(FNO.dct3(field, n, dct, false), n); }
  function gradientExplosion(field, n, mask, eps) {
    let mx = 0, sum = 0, cnt = 0, csum = 0; const nn = n * n;
    for (let i = 0, p = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++, p++) {
      if (mask && !mask[p]) continue;
      const c = field[p];
      const gx = i + 1 < n && (!mask || mask[p + nn]) ? field[p + nn] - c : 0;
      const gy = j + 1 < n && (!mask || mask[p + n]) ? field[p + n] - c : 0;
      const gz = k + 1 < n && (!mask || mask[p + 1]) ? field[p + 1] - c : 0;
      const m = Math.sqrt(gx * gx + gy * gy + gz * gz); if (m > mx) mx = m; sum += m; cnt++; csum += c;
    }
    const den = (cnt ? sum / cnt : 0) + (eps == null ? 0.01 : eps) * (cnt ? csum / cnt : 0);
    return den > 1e-12 ? mx / den : 1;
  }
  function thermoDrift(reactions) {
    let worst = 0;
    for (const r of reactions || []) {
      if (r.dG0 == null) continue;
      const back = (reactions || []).find((q) => q.from === r.to && q.to === r.from);
      if (!back) continue;
      worst = Math.max(worst, Math.abs(Math.log(r.k / back.k) + r.dG0 / (R * T)));
    }
    return worst;
  }

  // 탐지기 생성: opt { w: [w1,w2,w3], tau, margin }
  function createDetector(opt) {
    opt = Object.assign({ w: [0.4, 0.4, 0.2], tau: 1, margin: 1.5, negTol: 0.01 }, opt || {});
    return { opt, ref: { E: null, V: null }, trained: false, stats: { evaluated: 0, flagged: 0, reasons: {} } };
  }
  // 학습: 분포 안 장들(종별)에서 E_spec·V_grad 최댓값 × margin
  function train(det, fields, n, mask) {
    const dct = FNO.makeDCT(n); let E = 0, V = 1;
    for (const f of fields) { E = Math.max(E, spectralHighFraction(f, n, dct)); V = Math.max(V, gradientExplosion(f, n, mask)); }
    det.ref = { E: Math.max(E, 1e-6) * det.opt.margin, V: V * det.opt.margin }; det.trained = true;
    return det.ref;
  }
  function hardReasons(region, sur) {
    const r = [];
    if (region.spec.template !== 'box') r.push('template');
    if ((region.spec.velocity || [0, 0, 0]).some((v) => v !== 0)) r.push('advection');
    if (!FNO.reactionPairs(region.spec.reactions)) r.push('reaction_pairs');
    if (!sur || !sur.trained) r.push('untrained');
    return r;
  }
  // 평가: phase 'pre'(입력 장) | 'post'(원 출력 장, 투영 전). over: { fields: 종별 장(기본 region.fields), E: 종별 E_spec(대리 모델이 계산한 값) }
  // 반환 { score, ood, components, reasons }
  function evaluate(det, region, sur, phase, over) {
    over = over || {};
    const fields = over.fields || region.fields;
    det.stats.evaluated++;
    const reasons = hardReasons(region, sur);
    let E = 0, V = 1, neg = 0;
    const dct = sur && sur.dct ? sur.dct : FNO.makeDCT(region.n);
    if (!reasons.length) for (const key of Object.keys(fields)) {
      const f = fields[key]; let tot = 0, negm = 0, finite = true;
      for (const p of region.active) { const v = f[p]; if (!Number.isFinite(v)) finite = false; else { tot += Math.abs(v); if (v < 0) negm -= v; } }
      if (!finite) { reasons.push('non_finite'); break; }
      if (phase === 'post' && tot > 0 && negm / tot > det.opt.negTol) reasons.push('negative_mass');
      neg = Math.max(neg, tot > 0 ? negm / tot : 0);
      E = Math.max(E, over.E && over.E[key] != null ? over.E[key] : spectralHighFraction(f, region.n, dct)); V = Math.max(V, gradientExplosion(f, region.n, region.mask));
    }
    const G = thermoDrift(region.spec.reactions), [w1, w2, w3] = det.opt.w;
    const comp = { E_spec: E, V_grad: V, dG_drift: G, negative_fraction: neg };
    let score = reasons.length ? Infinity : w1 * E / det.ref.E + w2 * V / det.ref.V + w3 * G / LN_TOL;
    if (!det.trained && !reasons.length) { reasons.push('detector_untrained'); score = Infinity; }
    const ood = score > det.opt.tau;
    if (ood) { det.stats.flagged++; for (const x of reasons.length ? reasons : ['score']) det.stats.reasons[x] = (det.stats.reasons[x] || 0) + 1; }
    return { score, ood, components: comp, reasons, phase };
  }

  return { createDetector, train, evaluate, spectralHighFraction, gradientExplosion, thermoDrift };
});
