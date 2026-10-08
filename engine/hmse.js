// 3 층 다중 규모 엔진 (형식 v8) — 실행 층 참조 구현. docs/design/hybrid-multiscale-engine.md §3–§5.
// core.js 는 지식(정의항·규칙·단계)과 그 검사를, 이 파일은 실행 상태(영역·정수 원장·경계 거래·영역 점수)를 다룬다.
// 모든 함수는 순수 함수(상태를 받아 새 상태를 돌려줌) — 브라우저·Node 공용(UMD). 스키마: schemas/v8/*.schema.json
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HMSE = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const TIERS = ['T1', 'T2', 'T3'];
  const TEMPLATES = ['box', 'slab', 'sphere', 'spherical_shell', 'cylinder']; // 정규화된 기준 경계 (FNO 학습 분포)
  const isInt = (x) => Number.isSafeInteger(x);
  const pairKey = (a, b) => (a < b ? `${a}::${b}` : `${b}::${a}`);

  // ===== 영역 구성 (domain-config.schema.json) =====
  function validateDomainConfig(cfg) {
    const E = [], ids = new Set();
    if (!cfg || !Array.isArray(cfg.domains) || !cfg.domains.length) return ['domains 배열이 필요함'];
    for (const d of cfg.domains) {
      const w = `domain ${d.id || '?'}`;
      if (!d.id || ids.has(d.id)) E.push(`${w}: id 가 없거나 중복`);
      ids.add(d.id);
      if (!TIERS.includes(d.tier)) E.push(`${w}: tier 는 ${TIERS.join(' | ')}`);
      if (!d.location) E.push(`${w}: location 필요`);
      if (!(d.volume_fL > 0)) E.push(`${w}: volume_fL 양수`);
      if (d.tier === 'T3') {
        if (!TEMPLATES.includes(d.geometry_template)) E.push(`${w}: T3 영역은 정규화된 기준 경계 geometry_template(${TEMPLATES.join('|')}) 필요 — 대리 모델 OOD 방지`);
        if (!(d.grid && isInt(d.grid.n) && d.grid.n >= 4 && d.grid.h_m > 0)) E.push(`${w}: T3 영역은 grid { n ≥ 4 정수, h_m > 0 } 필요`);
      }
    }
    const m = cfg.metrics || {};
    if (!(m.tau_high > 0 && m.tau_low >= 0 && m.tau_low < m.tau_high)) E.push('metrics: 0 ≤ tau_low < tau_high (히스테리시스)');
    if (!(m.t_min > 0)) E.push('metrics: t_min(최소 체류 시간) > 0');
    if (!(m.w1 >= 0 && m.w2 >= 0 && m.w1 + m.w2 > 0)) E.push('metrics: w1, w2 ≥ 0 이고 합 > 0');
    const sv = cfg.solver || {};
    if (!(sv.epsilon_max > 0)) E.push('solver: epsilon_max > 0 (대리 모델 오차 문턱)');
    if (sv.fallback !== 'fv3d') E.push("solver: fallback 은 'fv3d' (3차원 유한 체적)");
    if (!(sv.window_min_s > 0)) E.push('solver: window_min_s > 0 (비동기 대체 계산의 최소 보수적 시간 창)');
    for (const [a, b] of cfg.adjacency || []) if (!ids.has(a) || !ids.has(b) || a === b) E.push(`adjacency: (${a}, ${b}) 는 서로 다른 두 영역 id 여야 함`);
    return E;
  }

  // ===== 정수 원장 (IntegerLedger) + 인접 경계 거래 (Adjacent Boundary Transaction) =====
  // state = { ledgers: { domainId: { version, counts: { 묶음키: 정수 } } }, adjacency: Set<pairKey>, seq: { pairKey: 마지막 seq } }
  function makeLedgerState(cfg, counts) {
    const ledgers = {};
    for (const d of cfg.domains) ledgers[d.id] = { version: 0, counts: Object.assign({}, (counts || {})[d.id] || {}) };
    for (const [id, c] of Object.entries(ledgers)) for (const [k, v] of Object.entries(c.counts)) if (!isInt(v) || v < 0) throw new Error(`원장 ${id}/${k}: 음이 아닌 정수가 아님 (${v})`);
    return { ledgers, adjacency: new Set((cfg.adjacency || []).map(([a, b]) => pairKey(a, b))), seq: {} };
  }
  // tx (ledger-transaction.schema.json): { from, to, seq, t, base_version: { [from]: v, [to]: v }, items: [{ key, dn }], residual: { key: 실수 }, cause }
  //   dn > 0: from → to, dn < 0: to → from. 거래는 두 원장만 잠근다 — 다른 영역 쌍과 동시에 커밋해도 충돌하지 않음.
  function validateLedgerTx(tx) {
    const E = [];
    if (!tx || !tx.from || !tx.to || tx.from === tx.to) E.push('from·to 는 서로 다른 두 영역');
    if (!isInt(tx.seq) || tx.seq < 1) E.push('seq 는 1 이상의 정수 (영역 쌍마다 단조 증가)');
    if (!(Number.isFinite(tx.t) && tx.t >= 0)) E.push('t ≥ 0');
    if (!Array.isArray(tx.items) || !tx.items.length) E.push('items 가 비어 있음');
    for (const it of tx.items || []) { if (!it.key) E.push('item.key(묶음 키) 필요'); if (!isInt(it.dn) || it.dn === 0) E.push(`item ${it.key}: dn 은 0 이 아닌 정수 (실수 이동 금지 — 나머지는 residual 로)`); }
    for (const [k, r] of Object.entries(tx.residual || {})) if (!(Number.isFinite(r) && Math.abs(r) < 1)) E.push(`residual ${k}: |r| < 1 이어야 함 (넘으면 정수로 옮겨야 함)`);
    if (!tx.base_version || !isInt(tx.base_version[tx.from]) || !isInt(tx.base_version[tx.to])) E.push('base_version: 두 원장의 버전(낙관적 동시성) 필요');
    return E;
  }
  function applyLedgerTx(state, tx) {
    const errs = validateLedgerTx(tx);
    if (errs.length) return { status: 'invalid', errors: errs, state };
    const pk = pairKey(tx.from, tx.to);
    if (!state.adjacency.has(pk)) return { status: 'not_adjacent', errors: [`${tx.from}–${tx.to} 는 인접 경계가 아님`], state };
    if ((state.seq[pk] || 0) >= tx.seq) return { status: 'duplicate', state }; // 멱등 — 같은 거래를 두 번 적용하지 않음
    const A = state.ledgers[tx.from], B = state.ledgers[tx.to];
    if (!A || !B) return { status: 'invalid', errors: ['없는 영역'], state };
    if (A.version !== tx.base_version[tx.from] || B.version !== tx.base_version[tx.to]) return { status: 'conflict', state }; // 다시 읽고 재시도
    const ca = Object.assign({}, A.counts), cb = Object.assign({}, B.counts);
    for (const { key, dn } of tx.items) {
      ca[key] = (ca[key] || 0) - dn; cb[key] = (cb[key] || 0) + dn;
      if (ca[key] < 0 || cb[key] < 0) return { status: 'infeasible', errors: [`${key}: 옮긴 뒤 음수 (${ca[key]}, ${cb[key]})`], state };
    }
    const sum = (o) => Object.values(o).reduce((a, v) => a + v, 0);
    if (sum(ca) + sum(cb) !== sum(A.counts) + sum(B.counts)) throw new Error('보존 위반 — 엔진 오류'); // 정수 산술이라 일어나면 버그
    const ledgers = Object.assign({}, state.ledgers, { [tx.from]: { version: A.version + 1, counts: ca }, [tx.to]: { version: B.version + 1, counts: cb } });
    return { status: 'committed', state: { ledgers, adjacency: state.adjacency, seq: Object.assign({}, state.seq, { [pk]: tx.seq }) } };
  }
  function ledgerTotals(state) {
    const t = {};
    for (const l of Object.values(state.ledgers)) for (const [k, v] of Object.entries(l.counts)) t[k] = (t[k] || 0) + v;
    return t;
  }

  // ===== 경계 이동량 표본 (§2.4–2.5): 확률적(Poisson / 화학 랑주뱅 극한) 또는 나머지 이월 =====
  function rngOf(seed) { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function poisson(rand, mu) {
    if (!(mu > 0)) return 0;
    if (mu > 1000) { const u = Math.max(rand(), 1e-12), g = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand()); return Math.max(0, Math.round(mu + Math.sqrt(mu) * g)); }
    const L = Math.exp(-mu); let k = 0, p = 1;
    do { k++; p *= rand(); } while (p > L);
    return k - 1;
  }
  // mu: 이번 창의 기대 이동 분자 수(≥0), residual: 이월된 소수 나머지 [0,1), available: 보내는 쪽 원장 수
  // 반환: k(이번에 옮길 정수), residual(새 소수 나머지, |r|<1), pending(원장이 모자라 못 보낸 정수 — 다음 창의 mu 에 더함)
  function sampleTransfer(mu, residual, mode, rand, available) {
    let k, r = residual || 0;
    if (mode === 'residual') { k = Math.floor(mu + r + 1e-12); r = mu + r - k; }
    else { k = poisson(rand, mu); r = 0; }
    let pending = 0;
    if (available != null && k > available) { pending = k - available; k = available; } // 사라지지 않고 이월
    return { k, residual: r, pending };
  }

  // ===== 고정 소수점 이동량 (P3, 표류 방지): 나머지를 정수(1e-9 단위)로 들고 다녀 부동 소수 누적 오차가 생기지 않음 =====
  // mu 는 한 번 1e-9 로 양자화되고(모델 해상도), 그 뒤의 이월·차감은 모두 정수 산술 — 10^k 단계 뒤에도 Σk 와 Σmu_q 의 차는 정확히 rFP/1e9 < 1.
  const FP = 1e9;
  function sampleTransferFixed(mu, residualFP, mode, rand, available) {
    const muFP = Math.round(Math.max(mu, 0) * FP);
    let k, rFP = residualFP || 0;
    if (mode === 'residual') { const tot = muFP + rFP; k = Math.floor(tot / FP); rFP = tot - k * FP; }
    else { k = poisson(rand, muFP / FP); rFP = 0; }
    let pending = 0;
    if (available != null && k > available) { pending = k - available; k = available; }
    return { k, residualFP: rFP, pending, muFP };
  }

  // ===== 영역 안 지역 거래 (P3): 한 원장 안에서 종이 바뀌는 반응 — 부분 구조(moiety) 정수 보존을 검사하고 그 원장만 잠근다 =====
  // tx = { domain, base_version, deltas: { 묶음키: 정수 }, cause }, moieties = { 묶음키: { moietyId: 정수 } }
  function applyLocalTx(state, tx, moieties) {
    const L = state.ledgers[tx.domain];
    if (!L) return { status: 'invalid', errors: ['없는 영역'], state };
    if (L.version !== tx.base_version) return { status: 'conflict', state };
    const bal = {};
    for (const [k, dn] of Object.entries(tx.deltas)) {
      if (!isInt(dn)) return { status: 'invalid', errors: [`${k}: 정수가 아님`], state };
      for (const [m, w] of Object.entries((moieties || {})[k] || { [k]: 1 })) bal[m] = (bal[m] || 0) + w * dn;
    }
    const bad = Object.entries(bal).filter(([, v]) => v !== 0);
    if (bad.length) return { status: 'invalid', errors: [`부분 구조가 보존되지 않음: ${bad.map(([m, v]) => `${m} ${v > 0 ? '+' : ''}${v}`).join(', ')}`], state };
    const c = Object.assign({}, L.counts);
    for (const [k, dn] of Object.entries(tx.deltas)) { c[k] = (c[k] || 0) + dn; if (c[k] < 0) return { status: 'infeasible', errors: [`${k}: 음수`], state }; }
    return { status: 'committed', state: { ...state, ledgers: Object.assign({}, state.ledgers, { [tx.domain]: { version: L.version + 1, counts: c } }) } };
  }
  function moietyTotals(state, moieties) {
    const t = {};
    for (const l of Object.values(state.ledgers)) for (const [k, n] of Object.entries(l.counts)) for (const [m, w] of Object.entries((moieties || {})[k] || { [k]: 1 })) t[m] = (t[m] || 0) + w * n;
    return t;
  }

  // ===== 영역 점수 (§2.1 v8): S = w1·⟨|∇²C|⟩ + w2·∂S_spatial/∂t =====
  // field: Float64Array(n³) 농도, h: 격자 간격(m). 정규화: |∇²C| 는 평균 농도·h² 로 나눠 무차원.
  function laplacianMeanAbs(field, n, h) {
    const at = (i, j, k) => field[((Math.min(n - 1, Math.max(0, i)) * n) + Math.min(n - 1, Math.max(0, j))) * n + Math.min(n - 1, Math.max(0, k))]; // 무유속 경계(반사)
    let s = 0, mean = 0;
    for (let x = 0; x < field.length; x++) mean += field[x];
    mean /= field.length;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
      const c = at(i, j, k);
      s += Math.abs(at(i + 1, j, k) + at(i - 1, j, k) + at(i, j + 1, k) + at(i, j - 1, k) + at(i, j, k + 1) + at(i, j, k - 1) - 6 * c);
    }
    return mean > 0 ? s / field.length / mean : 0; // = h²·⟨|∇²C|⟩ / C̄ (h² 가 약분된 무차원 형태)
  }
  function spatialEntropy(field) { // 정규화된 섀넌 엔트로피 ∈ [0,1] (1 = 균일)
    let tot = 0; for (const v of field) tot += Math.max(v, 0);
    if (!(tot > 0)) return 1;
    let H = 0; for (const v of field) { const p = Math.max(v, 0) / tot; if (p > 0) H -= p * Math.log(p); }
    return H / Math.log(field.length);
  }
  function domainScore(field, prevEntropy, n, h, dt, w) {
    const L = laplacianMeanAbs(field, n, h), H = spatialEntropy(field);
    const dSdt = prevEntropy == null ? 0 : Math.abs(H - prevEntropy) / dt;
    return { score: w.w1 * L + w.w2 * dSdt, laplacian: L, entropy: H, dSdt };
  }
  // 히스테리시스 + 최소 체류 시간: 영역 상태 { tier: 'T2'|'T3', since } 와 점수로 다음 상태를 정함 (승격·강등이 번갈아 깜빡이지 않게)
  function decideTransition(cur, score, t, m) {
    if (t - cur.since < m.t_min) return { ...cur, action: 'hold' };
    if (cur.tier !== 'T3' && score >= m.tau_high) return { tier: 'T3', since: t, action: 'promote' };
    if (cur.tier === 'T3' && score <= m.tau_low) return { tier: 'T2', since: t, action: 'demote' };
    return { ...cur, action: 'hold' };
  }

  // ===== 보존적 투영 (§2.3) =====
  function conservativeProject(field, total) {
    let s = 0; const out = new Float64Array(field.length);
    for (let i = 0; i < field.length; i++) { out[i] = Math.max(field[i], 0); s += out[i]; }
    if (!(s > 0)) { out.fill(total / field.length); return out; }
    const f = total / s; for (let i = 0; i < out.length; i++) out[i] *= f;
    return out;
  }
  // 정수 원장 → 격자 칸 정수 분배 (승격 시 질량을 만들지 않음): 다항 표본 또는 최대 나머지 반올림(결정론)
  function distributeCounts(weights, N, rand) {
    const n = weights.length, out = new Int32Array(n); let tot = 0;
    for (const w of weights) tot += Math.max(w, 0);
    if (!(tot > 0) || N === 0) { for (let i = 0; i < N; i++) out[i % n]++; return out; }
    if (rand) { let left = N, rest = tot; for (let i = 0; i < n - 1 && left > 0; i++) { const p = Math.max(weights[i], 0) / rest; let k = 0; for (let j = 0; j < left; j++) if (rand() < p) k++; out[i] = k; left -= k; rest -= Math.max(weights[i], 0); } out[n - 1] += left; return out; }
    const exact = Array.from(weights, (w) => (Math.max(w, 0) / tot) * N); let given = 0;
    exact.forEach((x, i) => { out[i] = Math.floor(x); given += out[i]; });
    exact.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0]).slice(0, N - given).forEach(([, i]) => out[i]++);
    return out;
  }

  return { TIERS, TEMPLATES, pairKey, validateDomainConfig, makeLedgerState, validateLedgerTx, applyLedgerTx, ledgerTotals, rngOf, poisson, sampleTransfer, FP, sampleTransferFixed, applyLocalTx, moietyTotals,
    laplacianMeanAbs, spatialEntropy, domainScore, decideTransition, conservativeProject, distributeCounts };
});
