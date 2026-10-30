// 형식 v9 — 세포 운명 엔진 (Cell Fate / Lineage Commitment). docs/design/cell-fate-engine.md
//   "운명 = 상태 전이": 세포 상태(cell_state)는 표지 서명(signature)으로 정의되고, 신호(조절 규칙) → 대사(공급 규칙) → 전사 인자(합성·분해) 사슬이
//   한 상태에서 다른 상태로 옮긴다. 데이터베이스의 규칙만 쓰고, 상수·시작량은 시나리오(가상이면 hypothetical)에서 덧씌운다.
//
//   결합 적분 (engine-port-roadmap 1.5단계): 대사(공급·분해, 초)와 표지(전사 인자 합성·분해, 시간)를 조절 배율까지 한 계로,
//     반응 진행량(extent) ξ 좌표의 Rodas3(Rosenbrock, 3차, L-안정) + 내장 오차 추정·단계 거부(양수성)로 푼다 — 원장과 부분 구조 수지가 구성상 맞는다.
//     관찰 격자 Δ(dt_slow)는 신호(경계 조건)·기록·탐침 스냅숏의 간격일 뿐 적분 오차를 정하지 않는다  — 연산자 분할의 1차 오차(L000069)가 생기지 않게.
//     강성은 L-안정 암시 단계가 흡수하므로 경로 선택 관문(P5)은 이 엔진에서 쓰지 않는다 (P5 모듈은 P3·P4 층에 그대로).
//   결정(commitment, criterion withdrawal): 그 시각의 상태에서 모든 신호를 끊고 horizon 동안 돌려도 목표 상태로 끝나면 결정된 것.
//     거친 격자 검사 + 이분 탐색으로 처음 통과한 관찰 격자점을 찾고, 그 격자 구간 안에서 연속 이분 탐색으로 commitment_tol 까지 좁힌다 (4단계 ③).
//   사건 시각 (4단계 ③, L000070): 문턱 도달·저장소 고갈·재생은 격자에서 감지한 뒤, 직전 스냅숏 상태에서 같은 적분기로 다시 적분하며
//     사건 함수의 근을 찾는다(Illinois 할선법, event_tol 까지). 보고 시각은 격자에 묶이지 않는다 — 정확도는 적분 허용 오차가 정한다.
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
const RNG = require('./rng.js'); // 4단계 ④ 확률 층의 난수 (xoshiro256++)
const V = C.VOCAB, VOL = C.VOL;


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
  for (const b of A.bundles) { const l = b.split('|').pop(); if (!volL[l] && !(V.locations[l] && V.locations[l].dim === '2D')) facts.push({ kind: 'volume_unknown', bundle: b, location: l }); } // 막(2D) 묶음은 부피가 없다 — 단계의 반응 부피로만 센다
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
  const tctx = { cinv: Float64Array.from(IR.species, (x) => x.cinv), buf: Float64Array.from(IR.species, (x) => (x.buf == null ? Infinity : x.buf)), stack: new Float64Array(64) };
  const stats = { rhs: 0, jac: 0, steps: 0, rejected: 0, rejectedNeg: 0, hMinHits: 0, singular: 0 };
  const fy = new Float64Array(nA), f0 = new Float64Array(nA), Kst = Array.from({ length: 4 }, () => new Float64Array(nA)), xs = new Float64Array(nA), xn = new Float64Array(nA), xe = new Float64Array(nA), bv = new Float64Array(nA);
  const Y = new Float64Array(nB), Yn = new Float64Array(nB);
  const rhs = (N, out) => { stats.rhs++; for (let k = 0; k < nA; k++) { const j = act[k], f = TAPE.evalTape(IR.jac.factor[j], N, 1, tctx); out[k] = TAPE.evalTape(IR.jac.rate[j], N, f, tctx); } };
  // M = I/(γh) − J 를 희소 패턴(IR jac.lu — 최소 차수 순서·채움, compiler/sparse_lu.js)의 값 배열에 조립하고 제자리 LU (3단계).
  //   조립: 규칙마다 dRate 다음 dFactor, 항마다 IR 이 준 [위치, 화학량] 순서 — Rust 와 같은 순서. 대각 1/(γh) 은 마지막에.
  //   분해: 행 단위, 피벗 교환 없음 — 행을 밀집 작업 벡터로 흩뿌리고 앞 행들의 U 로 소거한 뒤 모은다. |u_rr| < pivot_rel × 행 최대면 특이(단계 거부).
  const LUP = IR.jac.lu, SCR = IR.jac.scatter, nnzLU = LUP.nnz, RP = LUP.rowPtr, CL = LUP.col, DP = LUP.diagPos, PERM = LUP.perm;
  const VAL = new Float64Array(nnzLU), WRK = new Float64Array(nA), YS = new Float64Array(nA);
  // ===== 혼성 확률 층 (4단계 ④) — 시나리오 stochastic 이 있을 때만. 없으면 가림(disc)이 모두 0 이라 결정론 경로의 산술이 그대로다 =====
  //   규칙(활성 k)마다 방식 mode: 0 결정론(Rodas3 진행량) · 1 τ-도약 · 2 정확 SSA. 이산(1·2) 규칙의 성분은 진행량 대신 적분 성향 T = ∫a dt 이고
  //   그 화학량 열은 가린다(N 을 바꾸지 않음). 도약: 받아들인 단계마다 발화 수 ~ 포아송(ΔT), 단계는 Cao 한계로 자른다.
  //   SSA(수정 다음 반응법, Anderson 2007): 내부 시각 T 가 다음 발화 P 에 닿는 단계 길이를 근 찾기로 구하고 한 번 발화, P += Exp(1).
  //   발화는 정수 진행량으로 원장에 — 원장은 결정론과 같은 double-double. 분할은 관찰 격자점마다(히스테리시스 sto_hyst).
  const STO = sc.stochastic ? { seed: Number(sc.stochastic.seed) || 0, trajectory: opt.trajectory || 0 } : null;
  const disc = new Uint8Array(nA), mode = new Uint8Array(nA), Tq = new Float64Array(nA), Pq = new Float64Array(nA);
  const firedSsa = new Float64Array(nA), firedLeap = new Float64Array(nA), stoStats = { switches: 0, ssaFires: 0, ssaBlocked: 0, leapRejects: 0, rootEvals: 0 };
  const COLOF = Int32Array.from(CL, (c) => PERM[c]); // 값 위치 → 원래 활성 규칙 번호 (가림용)
  let rng = null, nLeap = 0;
  const buildM = (N, h) => {
    stats.jac++;
    VAL.fill(0);
    for (let k = 0; k < nA; k++) {
      const j = act[k], f = TAPE.evalTape(IR.jac.factor[j], N, 1, tctx), g = TAPE.evalTape(IR.jac.rate[j], N, 1, tctx);
      IR.jac.dRate[j].forEach((d, di) => { const v = TAPE.evalTape(d.t, N, f, tctx); if (v) { const sl = SCR.rate[k][di]; for (let q = 0; q < sl.length; q += 2) if (!disc[COLOF[sl[q]]]) VAL[sl[q]] -= v * sl[q + 1]; } });
      IR.jac.dFactor[j].forEach((d, di) => { const v = TAPE.evalTape(d.t, N, 1, tctx) * g; if (v) { const sl = SCR.factor[k][di]; for (let q = 0; q < sl.length; q += 2) if (!disc[COLOF[sl[q]]]) VAL[sl[q]] -= v * sl[q + 1]; } });
    }
    const d0 = 1 / (ROD.g * h);
    for (let k = 0; k < nA; k++) VAL[SCR.diag[k]] += d0;
    for (let r = 0; r < nA; r++) {
      const a = RP[r], b = RP[r + 1];
      let rmax = 0;
      for (let p = a; p < b; p++) { WRK[CL[p]] = VAL[p]; rmax = Math.max(rmax, Math.abs(VAL[p])); }
      for (let p = a; p < b; p++) {
        const k = CL[p]; if (k >= r) break;
        const l = WRK[k] / VAL[DP[k]]; WRK[k] = l;
        if (l !== 0) for (let q = DP[k] + 1; q < RP[k + 1]; q++) WRK[CL[q]] -= l * VAL[q];
      }
      for (let p = a; p < b; p++) VAL[p] = WRK[CL[p]];
      if (!(Math.abs(VAL[DP[r]]) >= CP.pivot_rel * rmax)) return false;
    }
    return true;
  };
  const luSolve = (x) => {
    for (let r = 0; r < nA; r++) YS[r] = x[PERM[r]];
    for (let r = 0; r < nA; r++) { let s = YS[r]; for (let p = RP[r]; p < DP[r]; p++) s -= VAL[p] * YS[CL[p]]; YS[r] = s; }
    for (let r = nA - 1; r >= 0; r--) { let s = YS[r]; for (let p = DP[r] + 1; p < RP[r + 1]; p++) s -= VAL[p] * YS[CL[p]]; YS[r] = s / VAL[DP[r]]; }
    for (let r = 0; r < nA; r++) x[PERM[r]] = YS[r];
  };
  const plusS = (N, x, out) => { for (let i = 0; i < nB; i++) { let v = N[i]; for (const [k, c] of SA[i]) if (!disc[k]) v += c * x[k]; out[i] = v; } };
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
      let e = 0; for (const [k, c] of SA[i]) if (!disc[k]) e += c * xe[k];
      if (Yn[i] < 0) neg = true;
      const w = CP.atol + CP.rtol * Math.max(Math.abs(N[i]), Math.abs(Yn[i])), r = Math.abs(e) / w;
      if (r > err) err = r;
    }
    // 4단계 ④: 이산 규칙의 성분은 적분 성향 ∫a dt — 그 오차도 노름에 (발화 시각·도약 평균의 정확도)
    if (STO) for (let k = 0; k < nA; k++) if (disc[k]) { const r = Math.abs(xe[k]) / (CP.sto_atol + CP.rtol * Math.abs(xn[k])); if (r > err) err = r; }
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
  // ----- 확률 층: 규칙별 참여 분자(신호 제외 — 완충 저장소도 총량이 유한하므로 센다)의 알짜 화학량, 분할, Cao 한계, 적분 -----
  const SPEC = act.map((j) => { const m = new Map(); for (const q of rules[j].ci) m.set(q.i, (m.get(q.i) || 0) - q.n); for (const q of rules[j].pi) m.set(q.i, (m.get(q.i) || 0) + q.n); return [...m].filter(([i]) => !isSignal[i]); });
  const MU = new Float64Array(nB), S2 = new Float64Array(nB);
  const partition = (N, first) => {
    rhs(N, f0);
    const H = CP.sto_hyst; nLeap = 0;
    for (let k = 0; k < nA; k++) {
      let cnt = Infinity; for (const [i] of SPEC[k]) cnt = Math.min(cnt, N[i]);
      const a = Math.abs(f0[k]), cur = mode[k];
      const coarse = (x) => cnt >= CP.sto_ode_min * x || a >= CP.sto_fast * x;
      let m;
      if (first || cur === 0) m = coarse(1) ? 0 : cnt < CP.sto_ssa_max ? 2 : 1;
      else if (coarse(H)) m = 0;
      else if (cur === 1) m = cnt < CP.sto_ssa_max ? 2 : 1;
      else m = cnt >= CP.sto_ssa_max * H ? 1 : 2;
      if (m !== cur || first) { if (!first) stoStats.switches++; if (m === 2) { Tq[k] = 0; Pq[k] = rng.exp1(); } }
      mode[k] = m; disc[k] = m > 0 ? 1 : 0; if (m === 1) nLeap++;
    }
  };
  // Cao·Gillespie·Petzold (2006): 도약 규칙이 바꾸는 분자마다 기대 변화 μ 와 분산 σ² 가 ε·N 을 넘지 않는 τ
  const caoTau = (N) => {
    MU.fill(0); S2.fill(0);
    for (let k = 0; k < nA; k++) { if (mode[k] !== 1) continue; const j = act[k], a = Math.max(0, TAPE.evalTape(IR.jac.rate[j], N, TAPE.evalTape(IR.jac.factor[j], N, 1, tctx), tctx)); for (const [i, v] of SPEC[k]) { MU[i] += v * a; S2[i] += v * v * a; } }
    let tau = Infinity;
    for (let i = 0; i < nB; i++) { if (!S2[i]) continue; const b = Math.max(CP.leap_eps * N[i], 1); if (MU[i]) tau = Math.min(tau, b / Math.abs(MU[i])); tau = Math.min(tau, (b * b) / S2[i]); }
    return tau;
  };
  // 구간 안 승격: 이산 규칙이 빨라지거나(성향 ≥ sto_fast·H) 분자가 많아지면(≥ sto_ode_min·H) 받아들인 단계 직후 바로 결정론으로 —
  //   격자점까지 기다리면 0 에서 시작한 중간 산물의 배출처럼 구간 안에서 성향이 수만 배 커지는 규칙이 SSA 발화로 폭주한다. 내려가는 전환은 격자점에서만.
  const promote = (N) => {
    for (let k = 0; k < nA; k++) {
      if (!disc[k]) continue;
      let cnt = Infinity; for (const [i] of SPEC[k]) cnt = Math.min(cnt, N[i]);
      const j = act[k], a = Math.abs(TAPE.evalTape(IR.jac.rate[j], N, TAPE.evalTape(IR.jac.factor[j], N, 1, tctx), tctx));
      if (cnt >= CP.sto_ode_min * CP.sto_hyst || a >= CP.sto_fast * CP.sto_hyst) { if (mode[k] === 1) nLeap--; mode[k] = 0; disc[k] = 0; stoStats.switches++; }
    }
  };
  const ssaOver = () => { let m = -Infinity; for (let k = 0; k < nA; k++) if (mode[k] === 2) m = Math.max(m, Tq[k] + xn[k] - Pq[k]); return m; };
  const saveN = new Float64Array(nB), saveLO = new Float64Array(nB), saveT = new Float64Array(nA), KL = new Float64Array(nA), NC = new Float64Array(nB);
  let saveCUM = null;
  const integrateSto = (N, t0, t1, onStep) => {
    let tt = t0, h = ival.h, lastRej = false; ival.steps = 0; ival.rej = 0;
    while (tt < t1) {
      let clip = h >= t1 - tt, hu = clip ? t1 - tt : h;
      if (nLeap) { const tl = Math.max(caoTau(N), CP.h_min); if (tl < hu) { hu = tl; clip = false; } }
      let err = tryStep(N, hu);
      if (!(err >= 0 && err <= 1) && hu > CP.h_min) {
        stats.rejected++; ival.rej++; if (err < 0) stats.rejectedNeg++;
        h = Math.max(CP.h_min, hu * (err < 0 ? CP.neg_shrink : Math.max(CP.fac_min, CP.safety * Math.pow(err, -1 / 3)))); lastRej = true; continue;
      }
      if (!(err >= 0 && err <= 1)) stats.hMinHits++;
      // SSA: 이 단계 안에서 내부 시각이 다음 발화에 닿으면, 닿는 단계 길이를 근 찾기(Illinois)로 — 그 길이로 받아들이고 한 번 발화
      let fire = -1, over = ssaOver();
      if (over > 0) {
        let a = 0, fa = -Infinity, b = hu, fb = over, side = 0;
        for (let k = 0; k < nA; k++) if (mode[k] === 2) fa = Math.max(fa, Tq[k] - Pq[k]);
        for (let it = 0; it < 100 && fb > CP.ssa_tol && b - a > 1e-12 * Math.max(1, tt); it++) {
          let c = b - (fb * (b - a)) / (fb - fa);
          if (!(c > a && c < b)) c = (a + b) / 2;
          tryStep(N, c); stoStats.rootEvals++; const fc = ssaOver();
          if (fc >= 0) { b = c; fb = fc; if (side === -1) fa /= 2; side = -1; } else { a = c; fa = fc; if (side === 1) fb /= 2; side = 1; }
        }
        hu = b; clip = false; err = tryStep(N, hu);
        let best = -Infinity; for (let k = 0; k < nA; k++) if (mode[k] === 2 && Tq[k] + xn[k] - Pq[k] > best) { best = Tq[k] + xn[k] - Pq[k]; fire = k; }
      }
      if (nLeap) { saveN.set(N); saveLO.set(LO); saveT.set(Tq); saveCUM = Float64Array.from(CUM); }
      for (let k = 0; k < nA; k++) { if (!disc[k]) { if (xn[k] !== 0) applyExtent(act[k], N, xn[k]); } else Tq[k] += xn[k]; }
      if (nLeap) {
        NC.set(N); // 연속 부분만 적용한 상태 — 도약이 만든 음수만 거부한다 (h_min 에서 받아들인 연속 단계의 음수는 결정론과 같이 hMinHits)
        for (let k = 0; k < nA; k++) { KL[k] = 0; if (mode[k] === 1) { const K = rng.poisson(xn[k]); if (K) { applyExtent(act[k], N, K); KL[k] = K; } } }
        let neg = false; for (let i = 0; i < nB; i++) if (!isSignal[i] && N[i] < 0 && N[i] < NC[i]) { neg = true; break; }
        if (neg) { // 도약이 음수를 만들면 되돌리고 단계를 반으로 (난수는 이미 썼다 — seed 가 같으면 같은 경로)
          N.set(saveN); LO.set(saveLO); Tq.set(saveT); CUM.set(saveCUM);
          stoStats.leapRejects++; stats.rejected++; ival.rej++; h = Math.max(CP.h_min, hu / 2); lastRej = true; continue;
        }
        for (let k = 0; k < nA; k++) firedLeap[k] += KL[k];
      }
      if (fire >= 0) {
        const R = rules[act[fire]];
        if (R.ci.every((q) => isSignal[q.i] || N[q.i] >= q.n)) { applyExtent(act[fire], N, 1); firedSsa[fire]++; stoStats.ssaFires++; }
        else stoStats.ssaBlocked++; // 연속 속도 법칙의 성향이 분자 수 < 화학량에서도 0 이 아님 — 발화를 막고 다음 발화를 뽑는다 (솎아내기)
        Pq[fire] += rng.exp1();
      }
      promote(N);
      stats.steps++; ival.steps++; ival.hMin = Math.min(ival.hMin, hu); ival.hMax = Math.max(ival.hMax, hu);
      tt = clip ? t1 : tt + hu;
      const fac = Math.min(lastRej ? 1 : CP.fac_max, Math.max(CP.fac_min, CP.safety * Math.pow(Math.max(err, 1e-10), -1 / 3)));
      const hn = hu * fac; h = clip ? Math.max(h, hn) : hn; lastRej = false;
      if (onStep) onStep(N, tt);
    }
    ival.h = h;
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
  // 상태 s 의 문턱 사건 함수: 서명 표지마다 문턱까지 남은 로그 거리 중 최대 (≤ 0 ⇔ 거리 0)
  const reachG = (sid) => { const ms = db.senses[sid].signature.map((m) => ({ i: at.get(`${m.ref}|${m.location}`), t: thr[`${m.ref}|${m.location}`], high: m.level === 'high' })).filter((m) => m.t);
    if (!ms.length) return () => Infinity; // 문턱 있는 표지가 없으면 도달을 판정할 수 없음 (distance 와 같게)
    return (N) => ms.reduce((g, m) => { const x = Math.max(N[m.i], 1e-9); return Math.max(g, m.high ? Math.log(m.t.high / x) : Math.log(x / m.t.low)); }, -Infinity); };
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
    // 확률 실행(4단계 ④): 사건·도달은 받아들인 단계마다 — 다시 적분으로 근을 찾을 수 없다(난수 경로가 단계 길이에 따라 달라짐). 시각의 해상도는 그 단계 길이
    const reach = {}, reachFns = STO && ctl.record ? states.map((sid) => [sid, reachG(sid)]) : [];
    const onStep = STO && ctl.record ? (Nn, tt) => {
      for (const [i, r] of resv) {
        r.min = Math.min(r.min, Nn[i]);
        if (!r.watch) continue;
        if (r.state === 'ok' && Nn[i] < 1) { r.state = 'empty'; events.push({ t: tt, type: 'exhausted', bundle: keys[i] }); }
        else if (r.state === 'empty' && Nn[i] >= 1) { r.state = 'ok'; events.push({ t: tt, type: 'regenerated', bundle: keys[i] }); }
      }
      for (const [sid, g] of reachFns) if (reach[sid] == null && g(Nn) <= 0) reach[sid] = tt;
    } : null;
    if (onStep) for (const [sid, g] of reachFns) if (g(N) <= 0) reach[sid] = t0;
    for (let t = t0; t < t1 - 1e-9; t += dt, step++) {
      // 신호 (경계 조건 — 질량 감사 밖)
      const sig = signalAt(t, ctl.signal);
      sched.forEach((s, j) => { N[s.i] = sig[j]; });
      const te = t1 - t < dt - 1e-9 ? t1 : t + dt; // 마지막 구간이 Δ 보다 짧으면 t1 에서 끊는다 (사건 근 찾기의 다시 적분 — 격자 정렬 실행은 그대로)
      if (STO) { partition(N, step === 0); integrateSto(N, t, te, onStep); } else integrate(N, t, te);
      perMin = Math.min(perMin, ival.steps); perMax = Math.max(perMax, ival.steps);
      // 저장소 고갈·재생 사건
      for (const [i, r] of resv) {
        r.min = Math.min(r.min, N[i]);
        if (!r.watch || STO) continue; // 처음부터 비어 있던 중간 산물(젖산·CO₂ …)은 고갈·재생 사건을 내지 않음 · 확률 실행은 단계마다(onStep)
        if (r.state === 'ok' && N[i] < 1) { r.state = 'empty'; events.push({ t: t + dt, type: 'exhausted', bundle: keys[i] }); }
        else if (r.state === 'empty' && N[i] >= 1) { r.state = 'ok'; events.push({ t: t + dt, type: 'regenerated', bundle: keys[i] }); }
      }
      if (ctl.record && (step % (ctl.every || 1) === 0)) series.push({ t: t + dt, N: Float64Array.from(N), steps: ival.steps, rejects: ival.rej, sig, lo: Float64Array.from(LO), cumDD: Float64Array.from(CUM), cum: Float64Array.from({ length: rules.length }, (_, k) => CUM[2 * k] + CUM[2 * k + 1]) });
      if (ctl.snapshots) ctl.snapshots.push({ t: t + dt, N: Float64Array.from(N) });
    }
    const integ = { method: 'rodas3', rtol: CP.rtol, atol: CP.atol, steps: stats.steps - steps0, rejected: stats.rejected - rej0, rejectedNeg: stats.rejectedNeg - neg0, hMinHits: stats.hMinHits - hit0, h: { min: ival.hMin, max: ival.hMax }, perInterval: { min: perMin, max: perMax } };
    return { N, lo: LO, cum: CUM, series, events, integrator: integ, resv, reach };
  }
  // ===== 본 실행 =====
  const M0DD = moiTotDD(N0, new Float64Array(nB)), M0 = Object.fromEntries(Object.entries(M0DD).map(([k, v]) => [k, v[0] + v[1]]));
  // ===== 적분 백엔드: 'js'(기준 구현·오라클, 위 run) | 'rust'(engine/rust — 같은 알고리즘, IR 테이프만 해석, WASM) =====
  // 질량 수지·재생 검사는 하지 않는다 — 기록점마다 N·LO·누적 진행량(double-double)을 내보내 사법부가 독립적으로 다시 계산한다
  const horizon = CP.commitment_horizon, coarse = Math.max(1, Math.round(CP.commitment_coarse / dt));
  // 백엔드가 주는 것: 본 실행 · 스냅숏 상태 snapN(k) · 탐침 probeStarts([{ t0, N }]) · 다시 적분 advance(t0, N, t1) (신호 일정대로)
  let main, snapshots, snapN, probeStarts, advance, backendStats, lanes = 1;
  if ((opt.engine || 'js') === 'rust') {
    // 4단계 ⑤: 확률 실행이면 seed·궤적·상태별 도달 표지를 덩어리에 (JS reachG 와 같은 표지·문턱)
    const sto = STO ? { seed: STO.seed, trajectory: STO.trajectory, reach: states.map((sid) => db.senses[sid].signature.map((m) => ({ i: at.get(`${m.ref}|${m.location}`), t: thr[`${m.ref}|${m.location}`], high: m.level === 'high' })).filter((m) => m.t)) } : null;
    const args = { IR, N0, sched, reservoirs, dt, tEnd, horizon, CP, recordEvery: sc.record_every || 1, sto };
    const be = require('./fate_rust.js').open(args);
    main = be.main(); snapshots = be.snapshots(); backendStats = () => be.stats();
    if (STO) main.reach = Object.fromEntries(states.map((sid, q) => [sid, main.sto.reach[q]]).filter(([, t]) => !Number.isNaN(t)));
    // 2단계: 결정 탐침은 워커마다 독립 WASM 인스턴스로 (engine/probe_pool.js) — lanes 는 결과에 영향이 없다 (확률 실행은 탐침이 없어 풀을 열지 않음)
    const pp = STO ? { lanes: 1, probeMany: () => [] } : require('./probe_pool.js').attach(be, args, opt.workers);
    lanes = pp.lanes;
    snapN = (k) => be.snapState(k); probeStarts = (starts) => pp.probeMany(starts); advance = (t0, N, t1) => be.advance(t0, N, t1);
  } else {
    snapshots = [];
    if (STO) rng = RNG.create(STO.seed, STO.trajectory);
    main = run(N0, 0, tEnd, { record: true, every: sc.record_every || 1, snapshots });
    snapN = (k) => snapshots[k].N;
    probeStarts = (starts) => starts.map((s) => run(s.N, s.t0, s.t0 + horizon, { signal: () => 0 }).N); // 기준 구현: 직렬
    advance = (t0, N, t1) => run(N, t0, t1, {}).N;
    backendStats = () => stats;
  }
  const probeMany = (ks) => probeStarts(ks.map((k) => ({ t0: snapshots[k].t, N: snapN(k) })));
  const before = (k) => (k < 0 ? { t: 0, N: N0 } : { t: snapshots[k].t, N: snapN(k) }); // 스냅숏 k 의 상태 (k = −1 이면 시작)
  // ===== 사건 시각 (4단계 ③): 사건 함수 g(N) ≤ 0 이 처음 참이 된 스냅숏 kHit 와 그 앞 사이에서 근 찾기 =====
  //   g 는 그 앞 스냅숏 상태에서 같은 적분기로 τ 까지 다시 적분해 잰다(Illinois 할선법). 보고는 브래킷의 오른쪽 끝(참인 쪽) — event_tol 안.
  let eventEvals = 0;
  const locate = (g, kHit) => {
    const P = before(kHit - 1);
    let a = P.t, ga = g(P.N), b = snapshots[kHit].t, gb = g(snapN(kHit)), side = 0;
    if (!(ga > 0)) return a; // 앞 점에서 이미 참 (시작부터)
    for (let it = 0; it < 100 && b - a > CP.event_tol; it++) {
      let c = b - (gb * (b - a)) / (gb - ga);
      if (!(c > a && c < b)) c = (a + b) / 2;
      const gc = g(advance(P.t, P.N, c)); eventEvals++;
      if (gc <= 0) { b = c; gb = gc; if (side === -1) ga /= 2; side = -1; } else { a = c; ga = gc; if (side === 1) gb /= 2; side = 1; }
    }
    return b;
  };
  const snapAt = (t) => { let lo = 0, hi = snapshots.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (snapshots[m].t < t - 1e-6) lo = m + 1; else hi = m; } return lo; };
  if (!STO) main.events = main.events.map((e) => { const i = at.get(e.bundle); return { ...e, t: locate(e.type === 'exhausted' ? (N) => N[i] - 1 : (N) => 1 - N[i], snapAt(e.t)) }; }).sort((x, y) => x.t - y.t);
  const chanMain = chanFrom(main.cum);
  // 궤적에서 상태·거리
  const traj = main.series.map((s) => ({ t: s.t, d: Object.fromEntries(states.map((x) => [x, distance(s.N, x)])), cls: classify(s.N), steps: s.steps, rejects: s.rejects }));
  const final = classify(main.N);
  const firstReach = {}; for (const r of traj) if (r.cls.state && firstReach[r.cls.state] == null) firstReach[r.cls.state] = r.t;
  // 기록 격자에서 찾은 도달을 스냅숏(모든 격자점)으로 앞당겨 첫 점을 찾고, 그 구간에서 근 찾기
  if (STO) { for (const k of Object.keys(firstReach)) delete firstReach[k]; for (const sid of states) if (main.reach[sid] != null) firstReach[sid] = main.reach[sid]; }
  else for (const s of Object.keys(firstReach)) { const kR = snapAt(firstReach[s]); let k = 0; while (k < kR && classify(snapN(k)).state !== s) k++; firstReach[s] = locate(reachG(s), k); }
  // 기대 목표: 신호가 한 번이라도 켜진 전이의 대상
  const sigOn = new Set(sched.filter((s) => s.list.some((e) => e.n > 0)).map((s) => keys[s.i].split('|')[0]));
  const transitions = (db.senses[sourceId].transitions || []).map((tr) => ({ to: tr.to, signals: tr.signals, criterion: tr.commitment.criterion, driven: tr.signals.some((g) => sigOn.has(g)) }));
  // ===== 결정 시점 (신호 철회 시험) =====
  //   탐침 k = 스냅숏 k 의 상태에서 신호를 모두 끊고 horizon 동안 → 끝 상태의 분류. 탐침은 (시작 상태, t0) 의 순수 함수라 결과를 스냅숏마다 한 번만 센다(전이끼리 공유).
  //   2단계: 탐침을 묶음(라운드)으로 백엔드에 넘긴다 — 모든 전이의 거친 격자를 한 라운드에, 이분 탐색은 결정 트리의 다음 D 층 중점을 미리 한 라운드에.
  //   그 뒤 직렬 이분 탐색과 똑같은 경로를 따라가므로(단조성과 무관하게) 결정 시각이 직렬과 같다. D = ⌊log₂(lanes + 1)⌋.
  const cls = new Map();
  let probes = 0, rounds = 0;
  const runRound = (ks) => { const need = [...new Set(ks)].filter((k) => !cls.has(k)); if (!need.length) return; rounds++; probes += need.length; probeMany(need).forEach((N, j) => cls.set(need[j], classify(N).state)); };
  const depth = Math.max(1, Math.floor(Math.log2(lanes + 1)));
  const tree = (lo, hi, d, out) => { if (!d || hi - lo <= 1) return out; const mid = (lo + hi) >> 1; out.push(mid); tree(lo, mid, d - 1, out); return tree(mid, hi, d - 1, out); };
  const grid = []; for (let k = coarse - 1; k < snapshots.length; k += coarse) grid.push(k);
  if (grid[grid.length - 1] !== snapshots.length - 1) grid.push(snapshots.length - 1);
  // 확률 실행은 결정 탐침을 하지 않는다 — 요동 아래의 결정(결정 확률)은 앙상블 판정의 몫 (Structural_Gap 으로 등록)
  const searches = transitions.map((tr) => (opt.commitment !== false && !STO && tr.criterion === 'withdrawal' && tr.driven ? { tr } : null));
  if (searches.some(Boolean)) runRound(grid);
  for (const S of searches.filter(Boolean)) {
    S.res = grid.map((k) => cls.get(k) === S.tr.to);
    S.first = S.res.indexOf(true); S.monotone = S.first < 0 || S.res.slice(S.first).every(Boolean);
    if (S.first >= 0) { S.lo = S.first ? grid[S.first - 1] : -1; S.hi = grid[S.first]; } // lo 실패(또는 시작), hi 통과
  }
  for (let active = searches.filter((S) => S && S.first >= 0 && S.hi - S.lo > 1); active.length; active = active.filter((S) => S.hi - S.lo > 1)) {
    runRound(active.flatMap((S) => tree(S.lo, S.hi, depth, [])));
    for (const S of active) for (let d = 0; d < depth && S.hi - S.lo > 1; d++) { const mid = (S.lo + S.hi) >> 1; if (cls.get(mid) === S.tr.to) S.hi = mid; else S.lo = mid; }
  }
  // 격자 구간 안 연속 이분 탐색 (4단계 ③): 탐침 시작 상태는 앞 격자점에서 τ 까지 다시 적분한 상태 — 같은 결정 트리 선행으로 lanes 와 무관하게 직렬과 같은 경로
  const ccls = new Map(), ckey = (S, tau) => `${S.idx}|${tau}`;
  const ctree = (a, b, d, out) => { if (!d || b - a <= CP.commitment_tol) return out; const m = (a + b) / 2; out.push(m); ctree(a, m, d - 1, out); return ctree(m, b, d - 1, out); };
  let refineProbes = 0;
  for (const S of searches.filter((x) => x && x.first >= 0)) { S.idx = searches.indexOf(S); S.base = before(S.lo); S.a = S.base.t; S.b = snapshots[S.hi].t; }
  for (let active = searches.filter((S) => S && S.first >= 0 && S.b - S.a > CP.commitment_tol); active.length; active = active.filter((S) => S.b - S.a > CP.commitment_tol)) {
    const need = active.flatMap((S) => ctree(S.a, S.b, depth, []).filter((tau) => !ccls.has(ckey(S, tau))).map((tau) => ({ S, tau })));
    if (need.length) { rounds++; probes += need.length; refineProbes += need.length; probeStarts(need.map(({ S, tau }) => ({ t0: tau, N: advance(S.base.t, S.base.N, tau) }))).forEach((N, j) => ccls.set(ckey(need[j].S, need[j].tau), classify(N).state)); }
    for (const S of active) for (let d = 0; d < depth && S.b - S.a > CP.commitment_tol; d++) { const m = (S.a + S.b) / 2; if (ccls.get(ckey(S, m)) === S.tr.to) S.b = m; else S.a = m; }
  }
  const commitment = transitions.map((tr, i) => {
    if (opt.commitment === false || STO) return { to: tr.to, criterion: tr.criterion, driven: tr.driven, t: null, skipped: true };
    if (!searches[i]) return { to: tr.to, criterion: tr.criterion, driven: tr.driven, t: tr.criterion === 'threshold' ? firstReach[tr.to] || null : null };
    const S = searches[i], kC = S.first >= 0 ? S.hi : null;
    return { to: tr.to, criterion: 'withdrawal', driven: true, t: kC == null ? null : S.b, t_grid: kC == null ? null : snapshots[kC].t, step: kC, tol: CP.commitment_tol, monotone: S.monotone, grid: grid.map((k, j) => ({ t: snapshots[k].t, pass: S.res[j] })), horizon };
  });
  // 분화 정지·사후 분석·소비만 되는 저장소 판정은 사법부(judicial/fate_audit.js)가 아래 원자료로 한다
  const target = (sc.target && sc.target) || (transitions.find((t) => t.driven) || {}).to || null;
  return {
    source: sourceId, states, scenario: sc.name || null, hypothetical: !!sc.hypothetical, dt, t_end: tEnd, keys, markers: [...markers.keys()], signals,
    rules: rules.map((R) => ({ ref: R.ref, kind: R.kind, ...(R.step ? { step: R.step, dir: R.dir } : {}), layer: R.slow ? 'slow' : 'fast', active: !!R.k, src: R.k ? R.k.src : null, modulators: R.mods.map((m) => ({ ref: m.ref, bundle: m.b, effect: m.effect, active: !!m.k })) })),
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
      ruleInfo: rules.map((R) => ({ ref: R.ref, kind: R.kind, ...(R.step ? { step: R.step, dir: R.dir } : {}), layer: R.slow ? 'slow' : 'fast', cons: R.cons.map((q) => [q.b, q.n]), prods: R.prods.map((q) => [q.b, q.n]), src: R.k ? R.k.src : null, kin: R.k, mods: R.mi.map((m) => ({ ref: m.ref, bundle: keys[m.i], effect: m.eff, kin: m.k })) })),
    },
    irHash: IR.hash, // 먹은 IR 의 해시 — 사법부가 조정자에게서 받은 IR 과 맞춘다
    // 확률 실행의 원자료 (4단계 ④): seed·궤적 번호·규칙별 발화 수(정수)·끝 방식·분할 전환·난수 소비 — 판정은 사법부
    ...(STO ? { stochastic: main.sto ? { seed: STO.seed, trajectory: STO.trajectory, method: 'hybrid: ssa (modified next reaction) · tau-leap (Cao) · rodas3', draws: main.sto.stats.draws,
      switches: main.sto.stats.switches, ssaFires: main.sto.stats.ssaFires, ssaBlocked: main.sto.stats.ssaBlocked, leapRejects: main.sto.stats.leapRejects, rootEvals: main.sto.stats.rootEvals,
      rules: act.map((j, k) => ({ ref: rules[j].ref, mode: ['ode', 'leap', 'ssa'][main.sto.mode[k]], ssa: main.sto.firedSsa[k], leap: main.sto.firedLeap[k] })) }
      : { seed: STO.seed, trajectory: STO.trajectory, method: 'hybrid: ssa (modified next reaction) · tau-leap (Cao) · rodas3', draws: rng ? rng.draws() : 0, ...stoStats,
      rules: act.map((j, k) => ({ ref: rules[j].ref, mode: ['ode', 'leap', 'ssa'][mode[k]], ssa: firedSsa[k], leap: firedLeap[k] })) } } : {}),
    events: main.events, facts, kineticGaps: A.gaps, modulationGaps: A.modGaps, stats: { ...backendStats(), probes, probeRounds: rounds, probeLanes: lanes, refineProbes, eventEvals }, engine: opt.engine || 'js', ix,
  };
}

module.exports = { simulateFate, assemble: IRB.assemble };
