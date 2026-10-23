// Phase P3 / T3 — 3차원 유한 체적(FV) 반응·확산(·이류) 풀이기. Tier 3 영역용, engine/hmse.js 의 정수 원장에 닻을 내린다.
// docs/design/hybrid-multiscale-engine.md §2.3·§B(불변식 1·3), docs/design/integral-field-engine.md §2·§9 단계 1.
//   확산: 면 유속 F_ij = (D/h²)(n_j − n_i) — 두 칸에 같은 크기 반대 부호(보존형 중심 차분).
//   이류(선택): MUSCL 재구성 + minmod 유속 제한자, 역시 면 유속 형태라 보존형.
//   반응: 칸 안 1차 변환 from → to, Δ = n_from(1 − e^{−kΔt}) — 종 사이 이동이라 부분 구조 보존.
//   경계: 기준 경계(geometry_template) 활성 칸 마스크 밖으로 유속 0. 인터페이스 면만 BoundaryEngine 이 정수로 연다.
//
// 정수 장 (integral-field-engine §9 단계 1, 기본): 칸 값 = i64 분자 수(양자 1, Float64Array 로 보유 — 칸당 ≪2²⁹ 라 정확).
//   수송: 면마다 실수 유속을 **면별 잔여 누산기(carry)** 로 정수화해 대칭 정수 이동(d[p]+=m·d[q]−=m) — Σ칸 이 구성상 정확 보존.
//   반응: 칸마다 carry 로 정수화, 장에서 옮긴 정수 m 을 **그대로** 원장 지역 거래로 — 장·원장이 같은 정수라 Σ칸 = N_ledger 가 정확.
//   경계: 정수 dnOut 을 인터페이스 칸에 정수 분배(비례 재척도 아님). → **재척도(anchor) 불필요**: 보존이 1e-14 근사가 아니라 정확한 0.
//   실수 모드(opt.integer === false): 예전 거동(실수 장 + 매 단계 재척도) — 정수 장과의 L2 대조 기준.
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
  // opt: { integer: true } — 정수 장(기본). false 면 실수 장 + 재척도(L2 기준).
  function createRegion(spec, initialCounts, opt) {
    const integer = !!(opt && opt.integer); // 단계 1: 정수 장은 opt-in. P4/P5 가 저마다 정수화되기 전까지 기본은 실수(기존 시험 유지, integral-field-engine §9)

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
    // 잔여 누산기 (정수 모드): 면별 수송 carry · 칸별 반응 carry — 부분 단계·거시 단계를 가로질러 들고 다닌다
    const fluxCarry = {}, reactCarry = {};
    if (integer) {
      for (const key of Object.keys(spec.species)) fluxCarry[key] = new Float64Array(faces.length);
      for (const r of spec.reactions || []) reactCarry[`${r.from}>${r.to}`] = new Float64Array(N3);
    }
    return { spec, n, mask, active, faces, iface, fields, idx, vox_m3: spec.h_m ** 3, integer, fluxCarry, reactCarry, stats: { substeps: 0, maxRescale: 0, negClips: 0 } };
  }

  // 안정 조건: 명시적 확산 6DΔt/h² ≤ 1/2·… → 부분 단계 수
  function substepsFor(region, dt) {
    const h2 = region.spec.h_m ** 2, Dmax = Math.max(...Object.values(region.spec.species).map((s) => s.D || 0));
    const v = region.spec.velocity || [0, 0, 0], vmax = Math.max(...v.map(Math.abs));
    const lim = Math.min(Dmax > 0 ? 0.4 * h2 / (6 * Dmax) : Infinity, vmax > 0 ? 0.4 * region.spec.h_m / vmax : Infinity);
    return Number.isFinite(lim) ? Math.max(1, Math.ceil(dt / lim)) : 1;
  }
  const minmod = (a, b) => (a * b <= 0 ? 0 : Math.abs(a) < Math.abs(b) ? a : b);

  // 면 하나의 실수 유속 (p 로 들어오는 양; q → p 가 양수) — 확산 + 이류(MUSCL)
  function faceFlux(region, key, fi, dt) {
    const f = region.fields[key], D = region.spec.species[key].D || 0, h = region.spec.h_m, n = region.n;
    const v = region.spec.velocity || [0, 0, 0], stride = [n * n, n, 1];
    const [p, q, ax] = region.faces[fi];
    let F = (D / (h * h)) * (f[q] - f[p]) * dt;
    if (v[ax]) {
      const up = v[ax] > 0 ? p : q, s = stride[ax], sign = v[ax] > 0 ? 1 : -1;
      const prev = up - sign * s, next = up + sign * s;
      const fu = f[up], fprev = prev >= 0 && prev < f.length && region.mask[prev] ? f[prev] : fu, fnext = next >= 0 && next < f.length && region.mask[next] ? f[next] : fu;
      const face = Math.max(0, fu + 0.5 * minmod(fu - fprev, fnext - fu));
      F -= sign * (Math.abs(v[ax]) / h) * face * dt;
    }
    return F;
  }

  // 확산 + 이류 한 부분 단계 (보존형). 정수 모드: 면별 carry 로 정수화해 대칭 정수 이동 — Σ 가 정확히 불변.
  function transport(region, key, dt) {
    const f = region.fields[key], d = new Float64Array(f.length);
    if (region.integer) {
      // 면을 훑으며 정수 이동을 소스 칸 내용으로 상한(incremental sweep) — 못 옮긴 양은 carry 로 다음 단계에. 비음수·정확 보존·결정론 모두.
      const cr = region.fluxCarry[key];
      for (let fi = 0; fi < region.faces.length; fi++) {
        const [p, q] = region.faces[fi];
        const want = faceFlux(region, key, fi, dt) + cr[fi]; // q→p 가 양수
        let m = Math.trunc(want);
        if (m > 0) { if (m > f[q]) m = f[q]; } // q → p, 소스 q
        else if (m < 0) { if (-m > f[p]) m = -f[p]; } // p → q, 소스 p
        cr[fi] = want - m;
        if (m) { f[p] += m; f[q] -= m; }
      }
    } else {
      for (let fi = 0; fi < region.faces.length; fi++) { const F = faceFlux(region, key, fi, dt), [p, q] = region.faces[fi]; d[p] += F; d[q] -= F; }
      for (const p of region.active) f[p] = Math.max(0, f[p] + d[p]);
    }
  }

  // 반응: 칸마다 1차 변환. 정수 모드: 칸별 carry 로 정수화(장에서 옮긴 정수 m 을 그대로 원장에). 실수 모드: 실수 이동량 합(정수화는 reconcile).
  function react(region, dt) {
    const moved = {};
    for (const r of region.spec.reactions || []) {
      const a = region.fields[r.from], b = region.fields[r.to], frac = 1 - Math.exp(-r.k * dt), key = `${r.from}>${r.to}`;
      let tot = 0;
      if (region.integer) {
        const rc = region.reactCarry[key];
        for (const p of region.active) {
          const want = a[p] * frac + rc[p];
          let m = Math.trunc(want); if (m > a[p]) m = a[p]; // 있는 것보다 많이 못 옮김 (나머지는 carry 로 다음 단계에)
          rc[p] = want - m;
          if (m) { a[p] -= m; b[p] += m; tot += m; }
        }
      } else {
        for (const p of region.active) { const x = a[p] * frac; a[p] -= x; b[p] += x; tot += x; }
      }
      moved[key] = (moved[key] || 0) + tot;
    }
    return moved;
  }

  // 한 거시 단계 = integrate(장만 진행, 원장 무관) + reconcile(반응량을 원장에 반영 + (실수 모드만) 재척도)
  function integrate(region, dt) {
    const ns = substepsFor(region, dt), sdt = dt / ns, movedTot = {};
    for (let s = 0; s < ns; s++) {
      for (const key of Object.keys(region.fields)) transport(region, key, sdt);
      for (const [k, v] of Object.entries(react(region, sdt))) movedTot[k] = (movedTot[k] || 0) + v;
    }
    region.stats.substeps += ns;
    return { substeps: ns, moved: movedTot };
  }
  // 반응량 → 원장. 정수 모드: moved 가 이미 정수(장에서 옮긴 그 수)라 그대로 지역 거래. 실수 모드: 내림 + carry 로 정수화.
  function reconcile(region, movedTot, ledger) {
    const L = ledger.state.ledgers[ledger.domainId].counts, deltas = {};
    if (region.integer) {
      for (const r of region.spec.reactions || []) { const m = movedTot[`${r.from}>${r.to}`] || 0; if (m) { deltas[r.from] = (deltas[r.from] || 0) - m; deltas[r.to] = (deltas[r.to] || 0) + m; } }
    } else {
      region.carry = region.carry || {};
      for (const r of region.spec.reactions || []) {
        const key = `${r.from}>${r.to}`, want = (movedTot[key] || 0) + (region.carry[key] || 0);
        let m = Math.floor(want); region.carry[key] = want - m;
        m = Math.min(m, (L[r.from] || 0) + (deltas[r.from] || 0));
        if (m > 0) { deltas[r.from] = (deltas[r.from] || 0) - m; deltas[r.to] = (deltas[r.to] || 0) + m; }
      }
    }
    let reactionTx = null;
    if (Object.keys(deltas).length) {
      const res = HMSE.applyLocalTx(ledger.state, { domain: ledger.domainId, base_version: ledger.state.ledgers[ledger.domainId].version, deltas, cause: 'fv_reaction' }, ledger.moieties);
      if (res.status !== 'committed') throw new Error(`FV 반응 지역 거래 실패: ${res.status} ${res.errors || ''}`);
      ledger.state = res.state; reactionTx = deltas;
    }
    anchor(region, ledger);
    return reactionTx;
  }
  function step(region, dt, ledger) {
    const r = integrate(region, dt);
    return { substeps: r.substeps, reactionTx: reconcile(region, r.moved, ledger) };
  }

  // 원장 닻 (불변식 1): ∫Ω C dΩ = Σ 칸 분자 수 = N_ledger. 정수 모드는 구성상 이미 정확 → 재척도 없음(검증만, 모양·크기 불변).
  //   실수 모드만 모양 유지하고 크기를 원장에 맞춰 재척도(부동 소수 표류 보정).
  function anchor(region, ledger) {
    const L = ledger.state.ledgers[ledger.domainId].counts;
    if (region.integer) return; // 정수 수송(대칭)·정수 반응(장=원장)·정수 경계 → Σ칸 = N_ledger 가 이미 정확. 재척도 금지(정수 깨짐).
    for (const [key, f] of Object.entries(region.fields)) {
      const target = L[key] || 0;
      let s = 0; for (const p of region.active) s += f[p];
      if (s > 0) { const fac = target / s; region.stats.maxRescale = Math.max(region.stats.maxRescale, Math.abs(fac - 1)); for (const p of region.active) f[p] *= fac; }
      else if (target > 0) { const w = HMSE.distributeCounts(region.active.map(() => 1), target); region.active.forEach((p, a) => { f[p] = w[a]; }); }
    }
  }

  // 인터페이스 칸의 분자 수 합 (경계 유속 계산용)
  function interfaceAmount(region, key) { let s = 0; for (const p of region.iface) s += region.fields[key][p]; return s; }
  // 정수 이동(dnOut)을 장에 반영. 정수 모드: 인터페이스 칸에 정수 분배(비례 재척도 아님) — 장·원장이 같은 정수.
  function applyInterfaceTransfer(region, key, dnOut) {
    const f = region.fields[key];
    if (!region.integer) {
      if (dnOut > 0) { const s = interfaceAmount(region, key); if (s > 0) { const fac = Math.max(0, 1 - dnOut / s); for (const p of region.iface) f[p] *= fac; } }
      else if (dnOut < 0) { const add = -dnOut / region.iface.length; for (const p of region.iface) f[p] += add; }
      return;
    }
    if (dnOut > 0) {
      // 나감: 현재 칸 내용 비례 정수 분배, 칸 내용으로 상한. 상한에 걸려 남으면 내용 있는 칸에서 라운드로빈으로 정확히 dnOut 채움.
      const w = region.iface.map((p) => f[p]), avail = w.reduce((a, b) => a + b, 0), take = Math.min(dnOut, avail);
      const rem = HMSE.distributeCounts(w, take); let left = take;
      region.iface.forEach((p, a) => { const t = Math.min(rem[a], f[p]); f[p] -= t; left -= t; });
      for (let g = 0; left > 0 && g < region.iface.length * 64; g++) { const p = region.iface[g % region.iface.length]; if (f[p] > 0) { f[p]--; left--; } }
    } else if (dnOut < 0) {
      const add = HMSE.distributeCounts(region.iface.map(() => 1), -dnOut);
      region.iface.forEach((p, a) => { f[p] += add[a]; });
    }
  }
  function totals(region) { const t = {}; for (const [k, f] of Object.entries(region.fields)) { let s = 0; for (const p of region.active) s += f[p]; t[k] = s; } return t; }

  return { templateMask, createRegion, substepsFor, faceFlux, transport, react, integrate, reconcile, step, anchor, interfaceAmount, applyInterfaceTransfer, totals, minmod };
});
