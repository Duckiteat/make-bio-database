// Phase P3 — 3차원 유한 체적(FV) 반응·확산(·이류) 풀이기. Tier 3 영역용, engine/hmse.js 의 정수 원장에 닻을 내린다.
// docs/design/hybrid-multiscale-engine.md §2.3·§B(불변식 1·3). 상태 변수는 칸마다 '분자 수'(실수) — 농도 = 분자 수 / 칸 부피.
//   확산: 면 유속 F_ij = (D/h²)(n_j − n_i) — 두 칸에 같은 크기 반대 부호로 더해지므로 보존형(중심 차분).
//   이류(선택): 면 값은 MUSCL 재구성 + minmod 유속 제한자(진동·음수·비물리적 엔트로피 생성 억제), 역시 면 유속 형태라 보존형.
//   반응: 칸 안 1차 변환 from → to, Δ = n_from(1 − e^{−kΔt}) — 종 사이 이동이라 부분 구조 보존.
//   경계: 기준 경계(geometry_template)로 만든 활성 칸 마스크 밖으로는 유속 0 (닫힌 벽). 인터페이스 면만 BoundaryEngine 이 정수로 연다.
//   원장 닻: 매 단계 끝에 종마다 Σ n = N_ledger (정수) 가 되도록 재척도. 종 사이 반응량은 최대 나머지 반올림으로 정수화해 지역 거래로 원장에 반영.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./hmse.js'));
  else root.FV = factory(root.HMSE);
})(typeof self !== 'undefined' ? self : this, function (HMSE) {
  'use strict';

  // 기준 경계 → 활성 칸 마스크 (불변식 3: 대리 모델·FV 모두 이 다섯 모양만 받는다)
  function templateMask(template, n) {
    if (!HMSE.TEMPLATES.includes(template)) throw new Error(`기준 경계가 아님: '${template}' — ${HMSE.TEMPLATES.join(' | ')}`);
    const m = new Uint8Array(n * n * n), c = (n - 1) / 2, R = n / 2;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
      const x = i - c, y = j - c, z = k - c, r = Math.sqrt(x * x + y * y + z * z), rc = Math.sqrt(y * y + z * z);
      let on = true;
      if (template === 'slab') on = Math.abs(z) <= Math.max(1, n / 4);
      else if (template === 'sphere') on = r <= R;
      else if (template === 'spherical_shell') on = r <= R && r >= R / 2;
      else if (template === 'cylinder') on = rc <= R; // 축 = x
      m[(i * n + j) * n + k] = on ? 1 : 0;
    }
    return m;
  }

  // spec: { n, h_m, template, species: { key: { D: m^2/s } }, reactions: [{ from, to, k: s^-1 }], velocity: [vx,vy,vz] m/s, interfaceFace: 'x+' }
  function createRegion(spec, initialCounts) {
    const n = spec.n, N3 = n * n * n, mask = templateMask(spec.template, n);
    const idx = (i, j, k) => (i * n + j) * n + k;
    const active = []; for (let p = 0; p < N3; p++) if (mask[p]) active.push(p);
    if (!active.length) throw new Error('활성 칸 없음');
    // 면 목록 (활성 칸끼리만) — 축별로 (p, q, axis), q = p 의 + 방향 이웃
    const faces = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
      const p = idx(i, j, k); if (!mask[p]) continue;
      if (i + 1 < n && mask[idx(i + 1, j, k)]) faces.push([p, idx(i + 1, j, k), 0]);
      if (j + 1 < n && mask[idx(i, j + 1, k)]) faces.push([p, idx(i, j + 1, k), 1]);
      if (k + 1 < n && mask[idx(i, j, k + 1)]) faces.push([p, idx(i, j, k + 1), 2]);
    }
    // 인터페이스 칸: x 가 가장 큰 활성 칸들 (x+ 면이 T2 노드에 닿음)
    let imax = -1; for (const p of active) imax = Math.max(imax, Math.floor(p / (n * n)));
    const iface = active.filter((p) => Math.floor(p / (n * n)) === imax);
    const fields = {};
    for (const key of Object.keys(spec.species)) {
      const f = new Float64Array(N3), N = (initialCounts || {})[key] || 0;
      const w = HMSE.distributeCounts(active.map(() => 1), N); // 균일 정수 분배 (질량을 만들지 않음)
      active.forEach((p, a) => { f[p] = w[a]; });
      fields[key] = f;
    }
    return { spec, n, mask, active, faces, iface, fields, idx, vox_m3: spec.h_m ** 3, stats: { substeps: 0, maxRescale: 0 } };
  }

  // 안정 조건: 명시적 확산 6DΔt/h² ≤ 1/2·… → 부분 단계 수
  function substepsFor(region, dt) {
    const h2 = region.spec.h_m ** 2, Dmax = Math.max(...Object.values(region.spec.species).map((s) => s.D || 0));
    const v = region.spec.velocity || [0, 0, 0], vmax = Math.max(...v.map(Math.abs));
    const lim = Math.min(Dmax > 0 ? 0.4 * h2 / (6 * Dmax) : Infinity, vmax > 0 ? 0.4 * region.spec.h_m / vmax : Infinity);
    return Number.isFinite(lim) ? Math.max(1, Math.ceil(dt / lim)) : 1;
  }
  const minmod = (a, b) => (a * b <= 0 ? 0 : Math.abs(a) < Math.abs(b) ? a : b);

  // 확산 + 이류 한 부분 단계 (보존형)
  function transport(region, key, dt) {
    const f = region.fields[key], D = region.spec.species[key].D || 0, h = region.spec.h_m, n = region.n;
    const v = region.spec.velocity || [0, 0, 0], d = new Float64Array(f.length), stride = [n * n, n, 1];
    for (const [p, q, ax] of region.faces) {
      let F = (D / (h * h)) * (f[q] - f[p]) * dt; // p 로 들어오는 양 (q → p 가 양수)
      if (v[ax]) {
        // MUSCL: 위쪽 칸의 기울기를 minmod 로 제한해 면 값 재구성, 면 유속 = v·n_face / h (분자 수 단위)
        const up = v[ax] > 0 ? p : q, s = stride[ax], sign = v[ax] > 0 ? 1 : -1;
        const prev = up - sign * s, next = up + sign * s;
        const fu = f[up], fprev = prev >= 0 && prev < f.length && region.mask[prev] ? f[prev] : fu, fnext = next >= 0 && next < f.length && region.mask[next] ? f[next] : fu;
        const face = Math.max(0, fu + 0.5 * minmod(fu - fprev, fnext - fu));
        F -= sign * (Math.abs(v[ax]) / h) * face * dt; // v>0: p → q 로 나감, v<0: q → p 로 들어옴
      }
      d[p] += F; d[q] -= F;
    }
    for (const p of region.active) f[p] = Math.max(0, f[p] + d[p]); // 안정 조건 아래에서 음수는 반올림 오차뿐
  }

  // 반응: 칸마다 1차 변환. 실수 반응량의 합을 돌려줌 (정수화는 원장 쪽에서)
  function react(region, dt) {
    const moved = {};
    for (const r of region.spec.reactions || []) {
      const a = region.fields[r.from], b = region.fields[r.to], frac = 1 - Math.exp(-r.k * dt);
      let tot = 0; for (const p of region.active) { const x = a[p] * frac; a[p] -= x; b[p] += x; tot += x; }
      moved[`${r.from}>${r.to}`] = (moved[`${r.from}>${r.to}`] || 0) + tot;
    }
    return moved;
  }

  // 한 거시 단계: 부분 단계로 수송·반응 → 원장 닻 (종 사이 반응은 정수 지역 거래로 원장에 반영한 뒤 재척도)
  // ledger: { state, domainId, moieties } (HMSE 원장 상태를 감싼 가변 핸들). 반환: { substeps, reactionTx }
  function step(region, dt, ledger) {
    const ns = substepsFor(region, dt), sdt = dt / ns, movedTot = {};
    for (let s = 0; s < ns; s++) {
      for (const key of Object.keys(region.fields)) transport(region, key, sdt);
      for (const [k, v] of Object.entries(react(region, sdt))) movedTot[k] = (movedTot[k] || 0) + v;
    }
    region.stats.substeps += ns;
    // 반응량 정수화: 원장 대비 실수 목표를 최대 나머지 반올림 (부분 구조 보존: from −m, to +m)
    const L = ledger.state.ledgers[ledger.domainId].counts, deltas = {};
    for (const r of region.spec.reactions || []) {
      const key = `${r.from}>${r.to}`;
      region.carry = region.carry || {};
      const want = (movedTot[key] || 0) + (region.carry[key] || 0);
      let m = Math.floor(want); region.carry[key] = want - m;
      m = Math.min(m, (L[r.from] || 0) + (deltas[r.from] || 0)); // 원장보다 많이 바꿀 수 없음
      if (m > 0) { deltas[r.from] = (deltas[r.from] || 0) - m; deltas[r.to] = (deltas[r.to] || 0) + m; }
    }
    let reactionTx = null;
    if (Object.keys(deltas).length) {
      const res = HMSE.applyLocalTx(ledger.state, { domain: ledger.domainId, base_version: ledger.state.ledgers[ledger.domainId].version, deltas, cause: 'fv_reaction' }, ledger.moieties);
      if (res.status !== 'committed') throw new Error(`FV 반응 지역 거래 실패: ${res.status} ${res.errors || ''}`);
      ledger.state = res.state; reactionTx = deltas;
    }
    anchor(region, ledger);
    return { substeps: ns, reactionTx };
  }

  // 원장 닻 (불변식 1): ∫Ω C dΩ = Σ 칸 분자 수 = N_ledger — 모양은 유지하고 크기만 맞춘다
  function anchor(region, ledger) {
    const L = ledger.state.ledgers[ledger.domainId].counts;
    for (const [key, f] of Object.entries(region.fields)) {
      const target = L[key] || 0;
      let s = 0; for (const p of region.active) s += f[p];
      if (s > 0) { const fac = target / s; region.stats.maxRescale = Math.max(region.stats.maxRescale, Math.abs(fac - 1)); for (const p of region.active) f[p] *= fac; }
      else if (target > 0) { const w = HMSE.distributeCounts(region.active.map(() => 1), target); region.active.forEach((p, a) => { f[p] = w[a]; }); }
    }
  }

  // 인터페이스 칸의 분자 수 합 (경계 유속 계산용)
  function interfaceAmount(region, key) { let s = 0; for (const p of region.iface) s += region.fields[key][p]; return s; }
  // 정수 이동을 장에 반영: 나가면 인터페이스 칸에서 비례 차감, 들어오면 인터페이스 칸에 고르게
  function applyInterfaceTransfer(region, key, dnOut) {
    const f = region.fields[key];
    if (dnOut > 0) { const s = interfaceAmount(region, key); if (s > 0) { const fac = Math.max(0, 1 - dnOut / s); for (const p of region.iface) f[p] *= fac; } }
    else if (dnOut < 0) { const add = -dnOut / region.iface.length; for (const p of region.iface) f[p] += add; }
  }
  function totals(region) { const t = {}; for (const [k, f] of Object.entries(region.fields)) { let s = 0; for (const p of region.active) s += f[p]; t[k] = s; } return t; }

  return { templateMask, createRegion, substepsFor, transport, react, step, anchor, interfaceAmount, applyInterfaceTransfer, totals, minmod };
});
