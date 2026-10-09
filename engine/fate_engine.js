// 형식 v9 — 세포 운명 엔진 (Cell Fate / Lineage Commitment). docs/design/cell-fate-engine.md
//   "운명 = 상태 전이": 세포 상태(cell_state)는 표지 서명(signature)으로 정의되고, 신호(조절 규칙) → 대사(공급 규칙) → 전사 인자(합성·분해) 사슬이
//   한 상태에서 다른 상태로 옮긴다. 데이터베이스의 규칙만 쓰고, 상수·시작량은 시나리오(가상이면 hypothetical)에서 덧씌운다.
//
//   결합 적분 (engine-port-roadmap 1.5단계): 대사(공급·분해, 초)와 표지(전사 인자 합성·분해, 시간)를 조절 배율까지 한 계로,
//     반응 진행량(extent) ξ 좌표의 Rodas3(Rosenbrock, 3차, L-안정) + 내장 오차 추정·단계 거부(양수성)로 푼다 — 원장과 부분 구조 수지가 구성상 맞는다.
//     관찰 격자 Δ(dt_slow)는 신호(경계 조건)·기록·탐침 스냅숏의 간격일 뿐 적분 오차를 정하지 않는다 (예전 연산자 분할 + 배율 고정 1차 오차 L000069 를 없앰).
//     강성은 L-안정 암시 단계가 흡수하므로 경로 선택 관문(P5)은 이 엔진에서 쓰지 않는다 (P5 모듈은 P3·P4 층에 그대로).
//   결정(commitment, criterion withdrawal): 그 시각의 상태에서 모든 신호를 끊고 horizon 동안 돌려도 목표 상태로 끝나면 결정된 것.
//     거친 격자 검사 + 이분 탐색으로 처음 통과한 관찰 격자점을 찾는다 (격자에서 단조성도 확인).
//   분화 정지(Differentiation Arrest): 목표에 도달하지 못하고 거리(distance)가 창(window) 동안 좋아지지 않으면 정지. 사후 분석이
//     실패한 표지 → 그 합성 규칙의 조절 배율 → 가장 모자란 활성화 인자 → (대사물이면) 그것을 만드는 빠른 규칙의 고갈 저장소까지 따라간다.
//
//   삼권 분립 (docs/design/tripartite-governance.md): 이 엔진은 행정부다 — 원자료(궤적·원장·진행량·사건·탐침 결과)만 낸다.
//     질량 수지·재생 검사·분화 정지·사후 분석·감사는 사법부(judicial/fate_audit.js·judicial/verifier.js)가 이 원자료로 판정한다.
//     엔진은 판정·'verified' 선언·파일 쓰기를 하지 않는다. 수치 결합점(기본값)은 engine/coupling.js 에서 읽는다.
'use strict';
const C = require('../core.js');
const IRB = require('../compiler/ir_builder.js'); // IR (컴파일러 — 순수): 조립·정수 번호·기호 도함수 테이프
const TAPE = require('../compiler/tape.js');
const V = C.VOCAB, NA = C.NA, VOL = C.VOL;


// ===== 시뮬레이션 =====
function simulateFate(db, sourceId, opt) {
  db = C.normalize(db);
  opt = Object.assign({}, opt || {});
  const sc = opt.scenario || {};
  // 행정부는 IR 만 먹는다 (조정자가 넘기거나, 없으면 같은 입력으로 컴파일) — 규칙·묶음·결합점 값은 모두 IR 에서
  const IR = opt.ir || IRB.buildFateIR(db, sourceId, sc, opt.coupling);
  if (IR.error) return IR;
  const ix = C.index(db), states = IR.states, markers = new Map(IR.markers.map((b) => [b, b.split('|')[0]])), signals = IR.signals;
  const rules = IR.rules.map((R) => ({ ...R, cons: R.cons.map((q) => ({ ...q })), prods: R.prods.map((q) => ({ ...q })), mods: R.mods.map((m) => ({ ...m })) })); // IR 은 불변 — 사본에 색인을 단다
  const A = { bundles: IR.keys, facts: IR.facts, gaps: IR.gaps, modGaps: IR.modGaps };
  const dt = opt.dt_slow || sc.dt_slow || 60, tEnd = opt.t_end || sc.t_end || 48 * 3600;
  const CP = IR.coupling;
  // 부피 (시나리오 → 없음)
  const volL = {};
  for (const [l, v] of Object.entries(sc.volumes || {})) if (VOL[v.unit]) volL[l] = v.value * VOL[v.unit];
  const facts = A.facts.slice();
  for (const b of A.bundles) { const l = b.split('|').pop(); if (!volL[l]) facts.push({ kind: 'volume_unknown', bundle: b, location: l }); }
  // 상태 벡터
  const keys = A.bundles, at = new Map(keys.map((b, i) => [b, i])), nB = keys.length;
  const N0 = new Float64Array(nB);
  const init = Object.assign({}, sc.amounts || {});
  for (const [b, v] of Object.entries(sc.buffered || {})) init[b] = v.total;
  for (const b of keys) N0[at.get(b)] = init[b] != null ? init[b] : 0;
  const isSignal = new Uint8Array(nB); for (const b of signals) isSignal[at.get(b)] = 1;
  const isMarker = new Uint8Array(nB); for (const b of markers.keys()) isMarker[at.get(b)] = 1;
  // 완충 저장소: 남은 양이 '한 구획분'(c0·N_A·V) 이상이면 농도 c0 로 고정, 그 아래로는 남은 양만큼 — 배지 + 수송체의 근사 (질량은 정확히 줄어든다)
  const buf = new Map(Object.entries(sc.buffered || {}).map(([b, v]) => [at.get(b), v.conc_M]));
  // 규칙 → 색인 (원자료 ruleInfo·저장소 목록용)
  for (const R of rules) {
    R.ci = R.cons.map((q) => ({ i: at.get(q.b), n: q.n, sat: q.sat }));
    R.pi = R.prods.map((q) => ({ i: at.get(q.b), n: q.n }));
    R.mi = R.mods.filter((m) => m.k).map((m) => ({ i: at.get(m.b), eff: m.effect, k: m.k, ref: m.ref, owner: m.owner }));
  }
  // 원장: 묶음별 생성·소비, 부분 구조 경로(소실·계 밖 공급)
  const moiOf = new Map();
  const moi = (b) => { if (!moiOf.has(b)) moiOf.set(b, C.moietyOf(db, b.split('|')[0], 1, {})); return moiOf.get(b); };
  const moiKeys = [...new Set(keys.filter((b, i) => !isSignal[i]).flatMap((b) => Object.keys(moi(b))))];
  // 보상 산술 (double-double): 상태 N 은 hi, 반올림 잔여는 LO 에 — 질량 원장을 1e-14 안에서 맞추기 위해 (상태·원장·합계 모두 오차 없는 덧셈 TwoSum·곱셈 TwoProduct)
  let LO = new Float64Array(nB);
  const twoSum = (a, b) => { const s = a + b, bb = s - a; return [s, (a - (s - bb)) + (b - bb)]; };
  const split = (a) => { const c = 134217729 * a, hi = c - (c - a); return [hi, a - hi]; };
  const twoProd = (a, b) => { const p = a * b, [ah, al] = split(a), [bh, bl] = split(b); return [p, ((ah * bh - p) + ah * bl + al * bh) + al * bl]; };
  // 뜨거운 경로(진행량 적용)는 배열을 만들지 않는 같은 산술: N[i] += d (d = n·ξ 의 정확한 곱 p + e)
  const addProdN = (N, i, n, x) => {
    const p = n * x, c1 = 134217729 * n, nh = c1 - (c1 - n), nl = n - nh, c2 = 134217729 * x, xh = c2 - (c2 - x), xl = x - xh;
    const e = ((nh * xh - p) + nh * xl + nl * xh) + nl * xl, a = N[i], s1 = a + p, bb = s1 - a;
    N[i] = s1; LO[i] += ((a - (s1 - bb)) + (p - bb)) + e;
  };
  const ddAdd = (acc, x, e) => { const [s1, e1] = twoSum(acc[0], x); acc[0] = s1; acc[1] += e1 + (e || 0); };
  const moiTotDD = (N, lo) => { const t = Object.fromEntries(moiKeys.map((k) => [k, [0, 0]])); keys.forEach((b, i) => { if (isSignal[i]) return; for (const [k, c] of Object.entries(moi(b))) { const [p, e] = twoProd(c, N[i]); ddAdd(t[k], p, e + c * lo[i]); } }); return t; };
  const moiTot = (N, lo) => Object.fromEntries(Object.entries(moiTotDD(N, lo || new Float64Array(nB))).map(([k, v]) => [k, v[0] + v[1]]));
  for (const R of rules) { R.dM = {}; const add = (b, n) => { for (const [k, c] of Object.entries(moi(b))) R.dM[k] = (R.dM[k] || 0) + c * n; }; for (const q of R.prods) add(q.b, q.n); for (const q of R.cons) add(q.b, -q.n); R.dMe = Object.entries(R.dM).filter(([, c]) => c); } // 균형 잡힌 규칙은 빈 목록 — 원장 경로를 건너뜀
  // 부분 구조 경로 장부 (판정 아님): 끝의 규칙별 누적 진행량 X 로 — 소실 = −Σ ΔM·X (분해), 계 밖 공급 = Σ ΔM·X (source), 규칙 밖 = 나머지 (두 백엔드 공통)
  const chanFrom = (X) => {
    const out = { lost: {}, source: {}, violation: {} };
    for (const ch of Object.keys(out)) for (const k of moiKeys) out[ch][k] = [0, 0];
    rules.forEach((R, j) => { const ch = R.lost ? 'lost' : R.source ? 'source' : 'violation'; for (const [k, c] of R.dMe) { const [p, e] = twoProd(R.lost ? -c : c, X[2 * j]); ddAdd(out[ch][k], p, e + (R.lost ? -c : c) * X[2 * j + 1]); } });
    return Object.fromEntries(Object.entries(out).map(([ch, o]) => [ch, Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v[0] + v[1]]))]));
  };
  // 규칙별 누적 진행량 (double-double) — 무결성 재생 검사: 모든 저장소 = 시작 + Σ 화학량 × 누적 진행량 (규칙 밖 변경이 없음을 증명)
  let CUM = new Float64Array(2 * rules.length);
  const cumAdd = (j, x) => { const a = CUM[2 * j], s1 = a + x, bb = s1 - a; CUM[2 * j] = s1; CUM[2 * j + 1] += (a - (s1 - bb)) + (x - bb); };
  // ===== 결합 적분: Rodas3 (Rosenbrock 4 단, 3차, L-안정, 내장 2차 오차 추정) — 진행량 좌표 dξ/dt = rate(N₀ + S·ξ) =====
  //   두 층(대사·표지)과 조절 배율을 한 계로 푼다 (분할·배율 고정 없음). 야코비안은 IR 기호 도함수: ∂rate_j/∂N_i = f_j·∂g_j/∂N_i + g_j·∂f_j/∂N_i,
  //   J_ξ = (∂rate/∂N)·S. 단 k: (I/(γh) − J)·K_k = rate(N + S·Σ A_kq K_q) + Σ (C_kq/h)·K_q, ξ' = Σ M_k K_k, 오차 = Σ E_k K_k (Sandu 외 1997, KPP 형식).
  //   단계 거부: 오차 > 1 또는 음수 상태 (양수성). 받아들인 진행량만 규칙마다 원장에 적용 — 상태와 원장은 언제나 같은 진행량으로 바뀐다.
  //   알고리즘 상수는 여기와 engine/rust/src/engine.rs 에 같게 — 단계 제어 값은 결합점 등록부.
  const ROD = { g: 0.5, newF: [1, 0, 1, 1], A: [[], [0], [2, 0], [2, 0, 1]], C: [[], [4], [1, -1], [1, -1, -8 / 3]], M: [2, 0, 1, 1], E: [0, 0, 0, 1] };
  const act = IR.jac.active, nA = act.length, SA = IR.jac.S;
  const tctx = { NA, V: Float64Array.from(IR.species, (x) => x.V), buf: Float64Array.from(IR.species, (x) => (x.buf == null ? Infinity : x.buf)), stack: new Float64Array(64) };
  const stats = { rhs: 0, jac: 0, steps: 0, rejected: 0, rejectedNeg: 0, hMinHits: 0, singular: 0 };
  const fy = new Float64Array(nA), f0 = new Float64Array(nA), Kst = Array.from({ length: 4 }, () => new Float64Array(nA)), xs = new Float64Array(nA), xn = new Float64Array(nA), xe = new Float64Array(nA), bv = new Float64Array(nA);
  const Y = new Float64Array(nB), Yn = new Float64Array(nB), Ev = new Float64Array(nB), LU = new Float64Array(nA * nA), piv = new Int32Array(nA);
  const rhs = (N, out) => { stats.rhs++; for (let k = 0; k < nA; k++) { const j = act[k], f = TAPE.evalTape(IR.jac.factor[j], N, 1, tctx); out[k] = TAPE.evalTape(IR.jac.rate[j], N, f, tctx); } };
  // LU ← I/(γh) − J (J 를 쌓는 순서: 규칙마다 dRate 다음 dFactor, 묶음마다 S 순서 — Rust 와 같은 순서)
  const buildM = (N, h) => {
    stats.jac++;
    LU.fill(0);
    for (let k = 0; k < nA; k++) {
      const j = act[k], f = TAPE.evalTape(IR.jac.factor[j], N, 1, tctx), g = TAPE.evalTape(IR.jac.rate[j], N, 1, tctx);
      for (const d of IR.jac.dRate[j]) { const v = TAPE.evalTape(d.t, N, f, tctx); if (v) for (const [c, sc_] of SA[d.i]) LU[k * nA + c] -= v * sc_; }
      for (const d of IR.jac.dFactor[j]) { const v = TAPE.evalTape(d.t, N, 1, tctx) * g; if (v) for (const [c, sc_] of SA[d.i]) LU[k * nA + c] -= v * sc_; }
    }
    const d0 = 1 / (ROD.g * h);
    for (let k = 0; k < nA; k++) LU[k * nA + k] += d0;
    // 부분 피벗 LU (제자리)
    for (let c = 0; c < nA; c++) {
      let p = c; for (let r = c + 1; r < nA; r++) if (Math.abs(LU[r * nA + c]) > Math.abs(LU[p * nA + c])) p = r;
      piv[c] = p;
      if (p !== c) for (let k = 0; k < nA; k++) { const t = LU[c * nA + k]; LU[c * nA + k] = LU[p * nA + k]; LU[p * nA + k] = t; }
      const dg = LU[c * nA + c]; if (Math.abs(dg) < 1e-300) return false;
      for (let r = c + 1; r < nA; r++) { const fr = LU[r * nA + c] / dg; LU[r * nA + c] = fr; if (fr !== 0) for (let k = c + 1; k < nA; k++) LU[r * nA + k] -= fr * LU[c * nA + k]; }
    }
    return true;
  };
  const luSolve = (x) => {
    for (let c = 0; c < nA; c++) { const p = piv[c]; if (p !== c) { const t = x[c]; x[c] = x[p]; x[p] = t; } }
    for (let c = 0; c < nA; c++) { const v = x[c]; if (v !== 0) for (let r = c + 1; r < nA; r++) x[r] -= LU[r * nA + c] * v; }
    for (let c = nA - 1; c >= 0; c--) { let s = x[c]; for (let k = c + 1; k < nA; k++) s -= LU[c * nA + k] * x[k]; x[c] = s / LU[c * nA + c]; }
  };
  const plusS = (N, x, out) => { for (let i = 0; i < nB; i++) { let v = N[i]; for (const [k, c] of SA[i]) v += c * x[k]; out[i] = v; } };
  // 시도 단계 하나: 성공하면 오차 노름(≤ 1), 실패하면 -1(음수) 또는 오차 노름(> 1), 특이 행렬은 Infinity — xn 에 진행량
  const tryStep = (N, h) => {
    rhs(N, f0);
    if (!buildM(N, h)) { stats.singular++; return Infinity; }
    for (let s = 0; s < 4; s++) {
      if (s === 0) fy.set(f0);
      else if (ROD.newF[s]) { for (let k = 0; k < nA; k++) { let v = 0; for (let q = 0; q < s; q++) v += ROD.A[s][q] * Kst[q][k]; xs[k] = v; } plusS(N, xs, Y); rhs(Y, fy); }
      for (let k = 0; k < nA; k++) { let v = fy[k]; for (let q = 0; q < s; q++) v += (ROD.C[s][q] / h) * Kst[q][k]; bv[k] = v; }
      luSolve(bv); Kst[s].set(bv);
    }
    for (let k = 0; k < nA; k++) { let a = 0, e = 0; for (let s = 0; s < 4; s++) { a += ROD.M[s] * Kst[s][k]; e += ROD.E[s] * Kst[s][k]; } xn[k] = a; xe[k] = e; }
    plusS(N, xn, Yn);
    let err = 0, neg = false;
    for (let i = 0; i < nB; i++) {
      let e = 0; for (const [k, c] of SA[i]) e += c * xe[k];
      if (Yn[i] < 0) neg = true;
      const w = CP.atol + CP.rtol * Math.max(Math.abs(N[i]), Math.abs(Yn[i])), r = Math.abs(e) / w;
      if (r > err) err = r;
    }
    return neg ? -1 : err;
  };
  // 구간 [t0, t1] 을 적분한다 (h 는 구간 사이에 이어짐). 받아들인 단계 수·거부 수를 돌려준다.
  const ival = { h: 0, steps: 0, rej: 0, hMin: Infinity, hMax: 0 };
  const integrate = (N, t0, t1) => {
    let tt = t0, h = ival.h, lastRej = false; ival.steps = 0; ival.rej = 0;
    while (tt < t1) {
      const clip = h >= t1 - tt, hu = clip ? t1 - tt : h;
      const err = tryStep(N, hu);
      if (err >= 0 && err <= 1 || hu <= CP.h_min) {
        if (!(err >= 0 && err <= 1)) stats.hMinHits++;
        for (let k = 0; k < nA; k++) if (xn[k] !== 0) applyExtent(act[k], N, xn[k]);
        stats.steps++; ival.steps++; ival.hMin = Math.min(ival.hMin, hu); ival.hMax = Math.max(ival.hMax, hu);
        tt = clip ? t1 : tt + hu;
        const fac = Math.min(lastRej ? 1 : CP.fac_max, Math.max(CP.fac_min, CP.safety * Math.pow(Math.max(err, 1e-10), -1 / 3)));
        const hn = hu * fac; h = clip ? Math.max(h, hn) : hn; lastRej = false;
      } else {
        stats.rejected++; ival.rej++; if (err < 0) stats.rejectedNeg++;
        h = Math.max(CP.h_min, hu * (err < 0 ? CP.neg_shrink : Math.max(CP.fac_min, CP.safety * Math.pow(err, -1 / 3)))); lastRej = true;
      }
    }
    ival.h = h;
  };
  const applyExtent = (j, N, xi) => {
    cumAdd(j, xi);
    const R = rules[j];
    for (const q of R.ci) addProdN(N, q.i, -q.n, xi);
    for (const q of R.pi) addProdN(N, q.i, q.n, xi);
  };
  // ===== 거리·상태 =====
  const thr = sc.thresholds || {};
  for (const b of markers.keys()) if (!thr[b]) facts.push({ kind: 'threshold_missing', bundle: b });
  const distance = (N, sid) => {
    let s = 0, n = 0;
    for (const m of db.senses[sid].signature) {
      const b = `${m.ref}|${m.location}`, t = thr[b]; if (!t) continue;
      const x = Math.max(N[at.get(b)], 1e-9), span = Math.log(t.high / t.low);
      const d = m.level === 'high' ? (x >= t.high ? 0 : x <= t.low ? 1 : Math.log(t.high / x) / span) : (x <= t.low ? 0 : x >= t.high ? 1 : Math.log(x / t.low) / span);
      s += d; n++;
    }
    return n ? s / n : 1;
  };
  // 잘리지 않은 거리 (진전 감지용): 문턱 밖에서도 로그 거리가 계속 줄어드는지 본다
  const rawDistance = (N, sid) => { let s = 0, n = 0; for (const m of db.senses[sid].signature) { const b = `${m.ref}|${m.location}`, t = thr[b]; if (!t) continue; const x = Math.max(N[at.get(b)], 1e-9), span = Math.log(t.high / t.low); s += Math.max(0, m.level === 'high' ? Math.log(t.high / x) / span : Math.log(x / t.low) / span); n++; } return n ? s / n : 1; };
  const classify = (N) => { let best = null; for (const s of states) { const d = distance(N, s); if (d === 0) return { state: s, d: 0 }; if (!best || d < best.d) best = { state: null, nearest: s, d }; } return best; };
  // ===== 신호 일정 =====
  const sched = Object.entries(sc.signals || {}).map(([b, list]) => ({ i: at.get(b), list: [...list].sort((a, z) => a.t - z.t) }));
  const signalAt = (t, override) => sched.map((s) => { if (override) return override(s, t); let v = 0; for (const e of s.list) if (e.t <= t + 1e-9) v = e.n; return v; });
  // ===== 한 번의 적분 (본 실행과 결정 탐침이 공유) — 관찰 격자 Δ 마다 신호(경계 조건)를 놓고 결합 적분, 기록·사건 =====
  const reservoirs = keys.map((b, i) => i).filter((i) => !isSignal[i] && !isMarker[i] && rules.some((R) => R.ci.some((q) => q.i === i)));
  function run(Nstart, t0, t1, ctl) {
    LO = ctl.lo ? Float64Array.from(ctl.lo) : new Float64Array(nB);
    CUM = new Float64Array(2 * rules.length);
    const N = Float64Array.from(Nstart), series = [], events = [], resv = new Map();
    ival.h = CP.h0; ival.hMin = Infinity; ival.hMax = 0;
    const steps0 = stats.steps, rej0 = stats.rejected, neg0 = stats.rejectedNeg, hit0 = stats.hMinHits;
    let step = 0, perMin = Infinity, perMax = 0;
    for (const i of reservoirs) resv.set(i, { start: N[i], min: N[i], state: N[i] >= 1 ? 'ok' : 'empty', watch: N[i] >= 1 });
    for (let t = t0; t < t1 - 1e-9; t += dt, step++) {
      // 신호 (경계 조건 — 질량 감사 밖)
      const sig = signalAt(t, ctl.signal);
      sched.forEach((s, j) => { N[s.i] = sig[j]; });
      integrate(N, t, t + dt);
      perMin = Math.min(perMin, ival.steps); perMax = Math.max(perMax, ival.steps);
      // 저장소 고갈·재생 사건
      for (const [i, r] of resv) {
        r.min = Math.min(r.min, N[i]);
        if (!r.watch) continue; // 처음부터 비어 있던 중간 산물(젖산·CO₂ …)은 고갈·재생 사건을 내지 않음
        if (r.state === 'ok' && N[i] < 1) { r.state = 'empty'; events.push({ t: t + dt, type: 'exhausted', bundle: keys[i] }); }
        else if (r.state === 'empty' && N[i] >= 1) { r.state = 'ok'; events.push({ t: t + dt, type: 'regenerated', bundle: keys[i] }); }
      }
      if (ctl.record && (step % (ctl.every || 1) === 0)) series.push({ t: t + dt, N: Float64Array.from(N), steps: ival.steps, rejects: ival.rej, sig, lo: Float64Array.from(LO), cumDD: Float64Array.from(CUM), cum: Float64Array.from({ length: rules.length }, (_, k) => CUM[2 * k] + CUM[2 * k + 1]) });
      if (ctl.snapshots) ctl.snapshots.push({ t: t + dt, N: Float64Array.from(N) });
    }
    const integ = { method: 'rodas3', rtol: CP.rtol, atol: CP.atol, steps: stats.steps - steps0, rejected: stats.rejected - rej0, rejectedNeg: stats.rejectedNeg - neg0, hMinHits: stats.hMinHits - hit0, h: { min: ival.hMin, max: ival.hMax }, perInterval: { min: perMin, max: perMax } };
    return { N, lo: LO, cum: CUM, series, events, integrator: integ, resv };
  }
  // ===== 본 실행 =====
  const M0DD = moiTotDD(N0, new Float64Array(nB)), M0 = Object.fromEntries(Object.entries(M0DD).map(([k, v]) => [k, v[0] + v[1]]));
  // ===== 적분 백엔드: 'js'(기준 구현·오라클, 위 run) | 'rust'(engine/rust — 같은 알고리즘, IR 테이프만 해석, WASM) =====
  // 질량 수지·재생 검사는 하지 않는다 — 기록점마다 N·LO·누적 진행량(double-double)을 내보내 사법부가 독립적으로 다시 계산한다
  const horizon = CP.commitment_horizon, coarse = Math.max(1, Math.round(CP.commitment_coarse / dt));
  let main, snapshots, probeEnd, backendStats;
  if ((opt.engine || 'js') === 'rust') {
    const be = require('./fate_rust.js').open({ IR, N0, sched, reservoirs, dt, tEnd, horizon, CP, recordEvery: sc.record_every || 1 });
    main = be.main(); snapshots = be.snapshots(); probeEnd = (k) => be.probe(k); backendStats = () => be.stats();
  } else {
    snapshots = [];
    main = run(N0, 0, tEnd, { record: true, every: sc.record_every || 1, snapshots });
    probeEnd = (k) => { const s = snapshots[k]; return run(s.N, s.t, s.t + horizon, { signal: () => 0 }).N; };
    backendStats = () => stats;
  }
  const chanMain = chanFrom(main.cum);
  // 궤적에서 상태·거리
  const traj = main.series.map((s) => ({ t: s.t, d: Object.fromEntries(states.map((x) => [x, distance(s.N, x)])), cls: classify(s.N), steps: s.steps, rejects: s.rejects }));
  const final = classify(main.N);
  const firstReach = {}; for (const r of traj) if (r.cls.state && firstReach[r.cls.state] == null) firstReach[r.cls.state] = r.t;
  // 기대 목표: 신호가 한 번이라도 켜진 전이의 대상
  const sigOn = new Set(sched.filter((s) => s.list.some((e) => e.n > 0)).map((s) => keys[s.i].split('|')[0]));
  const transitions = (db.senses[sourceId].transitions || []).map((tr) => ({ to: tr.to, signals: tr.signals, criterion: tr.commitment.criterion, driven: tr.signals.some((g) => sigOn.has(g)) }));
  // ===== 결정 시점 (신호 철회 시험) =====
  const probe = (k) => classify(probeEnd(k)).state; // k = 스냅숏 번호 → 그 시각 이후 신호 0 으로 horizon 동안
  const commitment = [];
  let probes = 0;
  for (const tr of transitions) {
    if (opt.commitment === false) { commitment.push({ to: tr.to, criterion: tr.criterion, driven: tr.driven, t: null, skipped: true }); continue; }
    if (tr.criterion !== 'withdrawal' || !tr.driven) { commitment.push({ to: tr.to, criterion: tr.criterion, driven: tr.driven, t: tr.criterion === 'threshold' ? firstReach[tr.to] || null : null }); continue; }
    const grid = []; for (let k = coarse - 1; k < snapshots.length; k += coarse) grid.push(k);
    if (grid[grid.length - 1] !== snapshots.length - 1) grid.push(snapshots.length - 1);
    const res = grid.map((k) => { probes++; return probe(k) === tr.to; });
    const firstPass = res.indexOf(true), monotone = firstPass < 0 || res.slice(firstPass).every(Boolean);
    let tC = null, kC = null;
    if (firstPass >= 0) {
      let lo = firstPass ? grid[firstPass - 1] : -1, hi = grid[firstPass]; // lo 실패(또는 시작), hi 통과
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; probes++; if (probe(mid) === tr.to) hi = mid; else lo = mid; }
      kC = hi; tC = snapshots[hi].t;
    }
    commitment.push({ to: tr.to, criterion: 'withdrawal', driven: true, t: tC, step: kC, monotone, grid: grid.map((k, j) => ({ t: snapshots[k].t, pass: res[j] })), horizon });
  }
  // 분화 정지·사후 분석·소비만 되는 저장소 판정은 사법부(judicial/fate_audit.js)가 아래 원자료로 한다
  const target = (sc.target && sc.target) || (transitions.find((t) => t.driven) || {}).to || null;
  return {
    source: sourceId, states, scenario: sc.name || null, hypothetical: !!sc.hypothetical, dt, t_end: tEnd, keys, markers: [...markers.keys()], signals,
    rules: rules.map((R) => ({ ref: R.ref, kind: R.kind, layer: R.slow ? 'slow' : 'fast', active: !!R.k, src: R.k ? R.k.src : null, modulators: R.mods.map((m) => ({ ref: m.ref, bundle: m.b, effect: m.effect, active: !!m.k })) })),
    final: { state: final.state, nearest: final.nearest || null, d: final.d, N: Object.fromEntries(keys.map((b, i) => [b, main.N[i]])) },
    trajectory: traj, series: main.series.map((x) => x.N), firstReach, transitions, commitment, target,
    integrator: main.integrator, // 본 실행의 단계 제어 기록 (받아들인·거부한 단계, 단계 크기 범위, Δ 당 단계 수)
    // 엔진의 장부 (판정 아님): 부분 구조 시작·끝 합계와 경로별 누적 — 사법부는 이것을 믿지 않고 원자료로 다시 센다
    mass: { moieties: moiKeys, start: M0, end: moiTot(main.N, main.lo), channels: chanMain },
    reservoirs: Object.fromEntries([...main.resv].map(([i, r]) => [keys[i], { start: r.start, min: r.min, end: main.N[i], state: r.state, watched: r.watch, buffered: buf.has(i) }])),
    volumes: volL, buffered: sc.buffered || {}, coupling: CP,
    process: { // 과정 보고서(judicial/process_report.js)·검증기(judicial/verifier.js)가 읽는 원자료 — 이름 없이 번호·묶음만
      lo: main.series.map((x) => x.lo), cumDD: main.series.map((x) => x.cumDD),
      times: main.series.map((x) => x.t), sig: main.series.map((x) => x.sig), cum: main.series.map((x) => x.cum),
      schedule: sched.map((x) => ({ bundle: keys[x.i], list: x.list })), signalIdx: sched.map((x) => x.i), thresholds: thr, N0: Float64Array.from(N0),
      ruleInfo: rules.map((R) => ({ ref: R.ref, kind: R.kind, layer: R.slow ? 'slow' : 'fast', cons: R.cons.map((q) => [q.b, q.n]), prods: R.prods.map((q) => [q.b, q.n]), src: R.k ? R.k.src : null, kin: R.k, mods: R.mi.map((m) => ({ ref: m.ref, bundle: keys[m.i], effect: m.eff, kin: m.k })) })),
    },
    irHash: IR.hash, // 먹은 IR 의 해시 — 사법부가 조정자에게서 받은 IR 과 맞춘다
    events: main.events, facts, kineticGaps: A.gaps, modulationGaps: A.modGaps, stats: { ...backendStats(), probes }, engine: opt.engine || 'js', ix,
  };
}

module.exports = { simulateFate, assemble: IRB.assemble };
