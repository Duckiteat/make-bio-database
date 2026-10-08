// Phase P4 — 스펙트럼 신경 연산자 대리 모델 (Tier 3). docs/design/hybrid-multiscale-engine.md §P4.
// 구조: FNO 한 층의 선형 핵심 — 들어올림(종별 장) → 스펙트럼 합성곱(코사인 기저에서 모드마다 학습된 이득 g_s(k)) → 투영.
//   · 이득 g_s(k) 는 P3 유한 체적 풀이기의 궤적에서 최소 제곱으로 '학습'한다 (calibrate). 닫힌 상자(무유속 벽) 위의 FV 라플라시안은
//     DCT-II 기저에서 정확히 대각이므로, 학습된 연산자는 FV 한 거시 단계를 기계 정밀도로 재현할 수 있다 (분포 안에서).
//   · 반응(칸 안 1차 선형 변환)은 Strang 분할: ½반응(정확한 행렬 지수) → 확산(스펙트럼) → ½반응.
//   · 비용: 축마다 n² 개의 길이-2n FFT → O(N log N), N = n³. Δt 와 무관 (FV 는 부분 단계 수 ∝ DΔt/h² 만큼 비용이 는다).
//   · 분포: 기준 경계 'box', 이류 없음, 선형 1차 반응. 그 밖(다른 모양·이류·충격·열역학 표류)은 ood_detector 가 잡아 FV 로.
//   · 질량: 비음수 투영 → 원장 닻 재척도 (Σ = N_ledger, Σ=0 이면 균일 정수 분배) — 원장은 절대 장에 맞춰 바뀌지 않는다.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./hmse.js'), require('./fv_solver.js'));
  else root.FNO = factory(root.HMSE, root.FV);
})(typeof self !== 'undefined' ? self : this, function (HMSE, FV) {
  'use strict';

  // ===== FFT (반복형 radix-2, 제자리) =====
  const isPow2 = (n) => n > 0 && (n & (n - 1)) === 0;
  function fft(re, im, inverse) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = (inverse ? 2 : -2) * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const ar = re[i + k], ai = im[i + k], br = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, bi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
          re[i + k] = ar + br; im[i + k] = ai + bi; re[i + k + len / 2] = ar - br; im[i + k + len / 2] = ai - bi;
          const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
        }
      }
    }
    if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
  }
  // DCT-II: X_k = Σ_j x_j cos(πk(2j+1)/2n) — Makhoul 재배열 + 길이 n 복소 FFT (표 미리 계산, 할당 없음) → O(n log n).
  //   정방향: v_j = x_{2j}, v_{n−1−j} = x_{2j+1}; X_k = Re(e^{−iπk/2n} V_k).  역방향(DCT-III, 정확한 역): W_k = X_k − i X_{n−k}, V_k = e^{iπk/2n} W_k, v = IFFT(V).
  const DCT_CACHE = new Map();
  function makeDCT(n) {
    if (!isPow2(n)) throw new Error(`격자 n=${n} 은 2 의 거듭제곱이어야 함 (FFT)`);
    if (DCT_CACHE.has(n)) return DCT_CACHE.get(n);
    const re = new Float64Array(n), im = new Float64Array(n), c = new Float64Array(n), s = new Float64Array(n), rev = new Uint32Array(n);
    const tw_c = new Float64Array(n / 2 || 1), tw_s = new Float64Array(n / 2 || 1);
    for (let k = 0; k < n; k++) { c[k] = Math.cos(Math.PI * k / (2 * n)); s[k] = Math.sin(Math.PI * k / (2 * n)); }
    for (let k = 0; k < n / 2; k++) { tw_c[k] = Math.cos(2 * Math.PI * k / n); tw_s[k] = Math.sin(2 * Math.PI * k / n); }
    for (let i = 0, j = 0; i < n; i++) { rev[i] = j; let bit = n >> 1; while (j & bit) { j ^= bit; bit >>= 1; } j |= bit; }
    function fftn(inv) {
      for (let i = 0; i < n; i++) { const j = rev[i]; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
      for (let len = 2; len <= n; len <<= 1) {
        const half = len >> 1, step = n / len;
        for (let i = 0; i < n; i += len) for (let k = 0; k < half; k++) {
          const wr = tw_c[k * step], wi = inv ? tw_s[k * step] : -tw_s[k * step], a = i + k, b = a + half;
          const br = re[b] * wr - im[b] * wi, bi = re[b] * wi + im[b] * wr;
          re[b] = re[a] - br; im[b] = im[a] - bi; re[a] += br; im[a] += bi;
        }
      }
    }
    function forward(x, X) {
      for (let j = 0; j < n / 2; j++) { re[j] = x[2 * j]; re[n - 1 - j] = x[2 * j + 1]; }
      im.fill(0); fftn(false);
      for (let k = 0; k < n; k++) X[k] = re[k] * c[k] + im[k] * s[k];
    }
    function inverse(X, x) {
      for (let k = 0; k < n; k++) { const wr = X[k], wi = k ? -X[n - k] : 0; re[k] = wr * c[k] - wi * s[k]; im[k] = wr * s[k] + wi * c[k]; }
      fftn(true);
      for (let j = 0; j < n / 2; j++) { x[2 * j] = re[j] / n; x[2 * j + 1] = re[n - 1 - j] / n; }
    }
    const d = { forward, inverse, n, line: new Float64Array(n), res: new Float64Array(n) };
    DCT_CACHE.set(n, d);
    return d;
  }
  // 3차원 분리형 변환: 축마다 n² 줄 → O(n³ log n). out 을 주면 그 배열에 씀
  function dct3(field, n, dct, inverse, out) {
    out = out || new Float64Array(field.length); if (out !== field) out.set(field);
    const line = dct.line, res = dct.res, nn = n * n;
    for (let ax = 0; ax < 3; ax++) {
      const st = ax === 0 ? nn : ax === 1 ? n : 1, o1 = ax === 0 ? n : nn, o2 = ax === 2 ? n : 1;
      for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
        const base = a * o1 + b * o2;
        for (let j = 0; j < n; j++) line[j] = out[base + j * st];
        if (inverse) dct.inverse(line, res); else dct.forward(line, res);
        for (let j = 0; j < n; j++) out[base + j * st] = res[j];
      }
    }
    return out;
  }
  // 스펙트럼 대역 에너지: hi = 어느 축이든 모드 번호 ≥ n/2, tot = 직류 포함 전체 (농도 수준 대비 거칠기 — 거의 평평한 장에서 안정)
  function bandEnergy(X, n) {
    const half = n / 2; let hi = 0, tot = 0;
    for (let i = 0, p = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++, p++) { const e = X[p] * X[p]; tot += e; if (i >= half || j >= half || k >= half) hi += e; }
    return tot > 0 ? hi / tot : 0;
  }

  // ===== 반응: 균일한 1차 선형 반응의 종 공간 행렬 지수 (스케일링·제곱 + 테일러) =====
  function reactionMatrix(keys, reactions) {
    const S = keys.length, M = Array.from({ length: S }, () => new Float64Array(S)), ix = Object.fromEntries(keys.map((k, i) => [k, i]));
    for (const r of reactions || []) { const a = ix[r.from], b = ix[r.to]; M[a][a] -= r.k; M[b][a] += r.k; } // dn_b/dt += k n_a
    return M;
  }
  function expm(M, t) {
    const S = M.length; let norm = 0; for (const row of M) for (const v of row) norm = Math.max(norm, Math.abs(v * t));
    const sq = Math.max(0, Math.ceil(Math.log2(norm + 1e-300)) + 4), h = t / 2 ** sq;
    const mul = (A, B) => A.map((_, i) => Float64Array.from({ length: S }, (_, j) => { let x = 0; for (let k = 0; k < S; k++) x += A[i][k] * B[k][j]; return x; }));
    let E = M.map((_, i) => Float64Array.from({ length: S }, (_, j) => (i === j ? 1 : 0))), term = E.map((r) => Float64Array.from(r));
    for (let p = 1; p <= 16; p++) { term = mul(term, M.map((r) => r.map((v) => v * h / p))); E = E.map((r, i) => r.map((v, j) => v + term[i][j])); }
    for (let q = 0; q < sq; q++) E = mul(E, E);
    return E;
  }

  // 반응 쌍: {a, b} 마다 하나. 종이 두 쌍 이상에 들면 null (진행량이 유일하지 않음 → 분포 밖)
  function reactionPairs(reactions) {
    const pairs = new Map(), seen = new Map();
    for (const r of reactions || []) { const key = [r.from, r.to].sort().join('⇄'); if (!pairs.has(key)) pairs.set(key, [r.from, r.to]); }
    for (const [a, b] of pairs.values()) for (const x of [a, b]) { seen.set(x, (seen.get(x) || 0) + 1); if (seen.get(x) > 1) return null; }
    return [...pairs.values()];
  }

  // ===== 대리 모델 =====
  // region: FV.createRegion 결과 (box 만), dt: 거시 Δt. 반환 모델 { gains[key]: Float64Array(N) 모드별 이득, Rhalf, dct, n, trained }
  function createSurrogate(region, dt) {
    if (region.spec.template !== 'box') throw new Error('대리 모델은 기준 경계 box 에서만 학습·추론 (그 밖은 FV)');
    if (!reactionPairs(region.spec.reactions)) throw new Error('반응 쌍이 겹침 — 대리 모델 분포 밖 (FV)');
    const n = region.n, keys = Object.keys(region.fields);
    return { n, dt, keys, dct: makeDCT(n), gains: {}, Rhalf: expm(reactionMatrix(keys, region.spec.reactions), dt / 2), trained: false, train: { samples: 0, residual: {} }, stats: { steps: 0 } };
  }
  // 학습: 무작위 저주파 장 K 개를 FV(반응 끔)로 한 거시 단계 보내고, 모드마다 g = Σ ŷx̂ / Σ x̂² (최소 제곱). 학습 잔차도 기록.
  function calibrate(sur, region, opt) {
    opt = Object.assign({ samples: 6, seed: 101 }, opt || {});
    const n = sur.n, N = n ** 3, rand = HMSE.rngOf(opt.seed);
    const probe = FV.createRegion({ ...region.spec, reactions: [], velocity: [0, 0, 0] }, {});
    for (const key of sur.keys) {
      const num = new Float64Array(N), den = new Float64Array(N), pairs = [];
      for (let s = 0; s < opt.samples; s++) {
        const x = new Float64Array(N);
        // 저주파 무작위 장 + 칸 단위 잡음(모든 모드가 들어오게)
        const a = [rand(), rand(), rand()].map((v) => 1 + 3 * v), ph = [rand(), rand(), rand()].map((v) => 6.28 * v);
        for (let p = 0; p < N; p++) { const i = Math.floor(p / (n * n)), j = Math.floor(p / n) % n, k = p % n; x[p] = 100 + 40 * Math.cos(a[0] * i / n + ph[0]) * Math.cos(a[1] * j / n + ph[1]) * Math.cos(a[2] * k / n + ph[2]) + 10 * rand(); }
        for (const k2 of Object.keys(probe.fields)) probe.fields[k2].fill(0);
        probe.fields[key].set(x);
        FV.integrate(probe, sur.dt);
        const X = dct3(x, n, sur.dct, false), Y = dct3(probe.fields[key], n, sur.dct, false);
        for (let m = 0; m < N; m++) { num[m] += Y[m] * X[m]; den[m] += X[m] * X[m]; }
        pairs.push([X, Y]);
      }
      const g = new Float64Array(N); for (let m = 0; m < N; m++) g[m] = den[m] > 0 ? num[m] / den[m] : 1;
      let r2 = 0, y2 = 0; for (const [X, Y] of pairs) for (let m = 0; m < N; m++) { r2 += (g[m] * X[m] - Y[m]) ** 2; y2 += Y[m] ** 2; }
      sur.gains[key] = g; sur.train.residual[key] = Math.sqrt(r2 / y2);
    }
    sur.train.samples = opt.samples; sur.trained = true;
    return sur.train;
  }
  // 한 거시 단계 (장만): ½반응 → 확산 → ½반응. 반응한 실수량을 돌려줌 (FV.integrate 와 같은 형태)
  function integrate(sur, region) {
    if (!sur.trained) throw new Error('학습되지 않은 대리 모델');
    const n = sur.n, N = n ** 3, keys = sur.keys, F = keys.map((k) => region.fields[k]), S = keys.length, moved = {};
    const halfReact = () => {
      if (!(region.spec.reactions || []).length) return;
      const v = new Float64Array(S);
      for (let p = 0; p < N; p++) { for (let i = 0; i < S; i++) v[i] = F[i][p]; for (let i = 0; i < S; i++) { let x = 0; for (let j = 0; j < S; j++) x += sur.Rhalf[i][j] * v[j]; F[i][p] = x; } }
    };
    const totalsNow = () => keys.map((k, i) => { let s = 0; for (let p = 0; p < N; p++) s += F[i][p]; return s; });
    const t0 = totalsNow();
    halfReact();
    const spec = {};
    sur.buf = sur.buf || new Float64Array(N);
    for (let i = 0; i < S; i++) {
      const X = dct3(F[i], n, sur.dct, false, sur.buf), g = sur.gains[keys[i]], ein = bandEnergy(X, n);
      for (let m = 0; m < N; m++) X[m] *= g[m];
      spec[keys[i]] = { E_in: ein, E_out: bandEnergy(X, n) }; // 탐지기가 추가 변환 없이 쓰는 입력·출력 스펙트럼 지표
      dct3(X, n, sur.dct, true, F[i]);
    }
    sur.lastSpectra = spec;
    halfReact();
    // 반응 진행량: 분포 조건(종마다 반응 쌍 하나)에서는 쌍 (a ⇄ b) 의 순 변화가 유일 — Δ_b > 0 이면 a>b, < 0 이면 b>a 로 장부에
    const t1 = totalsNow();
    for (const [a, b] of reactionPairs(region.spec.reactions)) { const d = t1[keys.indexOf(b)] - t0[keys.indexOf(b)]; if (d > 0) moved[`${a}>${b}`] = d; else if (d < 0) moved[`${b}>${a}`] = -d; }
    sur.stats.steps++;
    return { moved };
  }
  // 질량 조정 연산자: C̃ = max(0, C_raw), C = C̃ · N_ledger / ∫C̃ (∫C̃ = 0 이면 균일 정수 분배) — 활성 칸만
  function reconcileMass(region, key, Nledger) {
    const f = region.fields[key]; let s = 0;
    for (const p of region.active) { if (!(f[p] > 0)) f[p] = 0; s += f[p]; }
    if (s > 0) { const fac = Nledger / s; for (const p of region.active) f[p] *= fac; return fac; }
    const w = HMSE.distributeCounts(region.active.map(() => 1), Nledger); region.active.forEach((p, a) => { f[p] = w[a]; });
    return null;
  }

  return { fft, makeDCT, dct3, bandEnergy, reactionMatrix, reactionPairs, expm, createSurrogate, calibrate, integrate, reconcileMass, isPow2 };
});
