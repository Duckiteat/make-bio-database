// 형식 v9 — 세포 운명 엔진 (Cell Fate / Lineage Commitment). docs/design/cell-fate-engine.md
//   "운명 = 상태 전이": 세포 상태(cell_state)는 표지 서명(signature)으로 정의되고, 신호(조절 규칙) → 대사(공급 규칙) → 전사 인자(합성·분해) 사슬이
//   한 상태에서 다른 상태로 옮긴다. 데이터베이스의 규칙만 쓰고, 상수·시작량은 시나리오(가상이면 hypothetical)에서 덧씌운다.
//
//   두 시간 척도 (다중 속도 적분):
//     빠른 층 = 대사 공급·분해 규칙 (초) — 반응 진행량(extent) ξ 로 적분하므로 원장과 부분 구조 수지가 구성상 맞는다.
//     느린 층 = 표지(전사 인자)의 합성·분해 (시간) — 느린 단계 Δ 마다 조절 배율을 고정하고 정확한 지수 해로 갱신.
//   P5 동적 관문 재사용 (engine/p5_dynamic_gate.js): 느린 단계마다 빠른 층의 강성 N_sub = ⌈λ_max·Δ / 0.1⌉ (명시 오일러 부분 단계 수).
//     FV_ONLY ↔ 명시 부분 단계 N_sub 번 (기준·비싼 경로), PROMOTED ↔ 역방향 오일러 한 번 (진행량에 대한 뉴턴 — 무조건 안정, 빠른 층의 준정상 상태).
//     히스테리시스 K_up/K_down/M, 신호 급변·저장소 고갈 = 충격(γ) → 같은 단계 강등 + W 냉각.
//   결정(commitment, criterion withdrawal): 그 시각의 상태에서 모든 신호를 끊고 horizon 동안 돌려도 목표 상태로 끝나면 결정된 것.
//     거친 격자 검사 + 이분 탐색으로 처음 통과한 느린 단계를 찾는다 (격자에서 단조성도 확인).
//   분화 정지(Differentiation Arrest): 목표에 도달하지 못하고 거리(distance)가 창(window) 동안 좋아지지 않으면 정지. 사후 분석이
//     실패한 표지 → 그 합성 규칙의 조절 배율 → 가장 모자란 활성화 인자 → (대사물이면) 그것을 만드는 빠른 규칙의 고갈 저장소까지 따라간다.
//
//   삼권 분립 (docs/design/tripartite-governance.md): 이 엔진은 행정부다 — 원자료(궤적·원장·진행량·사건·탐침 결과)만 낸다.
//     질량 수지·재생 검사·분화 정지·사후 분석·감사는 사법부(judicial/fate_audit.js·judicial/verifier.js)가 이 원자료로 판정한다.
//     엔진은 판정·'verified' 선언·파일 쓰기를 하지 않는다. 수치 결합점(기본값)은 engine/coupling.js 에서 읽는다.
'use strict';
const C = require('../core.js');
const GATE = require('./p5_dynamic_gate.js');
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
  const CP = IR.coupling, Ksat = CP.saturation_K;
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
  const volOfIdx = Float64Array.from(keys, (b) => volL[b.split('|').pop()] || 0);
  const concAt = (N, i) => { const Vv = volOfIdx[i]; if (!Vv) return 0; const c = Math.max(0, N[i]) / (NA * Vv); return buf.has(i) ? Math.min(buf.get(i), c) : c; };
  // 규칙 → 색인
  for (const R of rules) {
    R.ci = R.cons.map((q) => ({ i: at.get(q.b), n: q.n, sat: q.sat }));
    R.pi = R.prods.map((q) => ({ i: at.get(q.b), n: q.n }));
    R.Vr = volL[R.loc] || 0;
    R.mi = R.mods.filter((m) => m.k).map((m) => ({ i: at.get(m.b), eff: m.effect, k: m.k, ref: m.ref, owner: m.owner }));
    R.kdeg = R.kind === 'degradation' && R.k ? (R.k.k > 0 ? R.k.k : R.k.half_life > 0 ? Math.LN2 / R.k.half_life : 0) : 0;
  }
  const fast = rules.filter((R) => !R.slow && R.k), slow = rules.filter((R) => R.slow && R.k);
  const modF = (R, N) => { let f = 1; for (const m of R.mi) f *= C.hillFactor(m.eff, m.k, concAt(N, m.i)); return f; };
  // 진행 속도 (분자/s)
  const rate = (R, N, f) => {
    if (R.kind === 'degradation') return R.kdeg * Math.max(0, N[R.ci[0].i]) * f;
    if (!R.Vr) return 0;
    const k = R.k;
    let v = 0;
    if (k.law === 'zero_order') v = k.k;
    else if (k.law === 'mass_action') { v = k.k; for (const q of R.ci) { const c = concAt(N, q.i); v *= q.sat ? c / (c + Ksat) : c ** q.n; } }
    return v * f * NA * R.Vr;
  };
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
  const addN = (N, i, d) => { const [s1, e1] = twoSum(N[i], d); N[i] = s1; LO[i] += e1; };
  const moiTotDD = (N, lo) => { const t = Object.fromEntries(moiKeys.map((k) => [k, [0, 0]])); keys.forEach((b, i) => { if (isSignal[i]) return; for (const [k, c] of Object.entries(moi(b))) { const [p, e] = twoProd(c, N[i]); ddAdd(t[k], p, e + c * lo[i]); } }); return t; };
  const moiTot = (N, lo) => Object.fromEntries(Object.entries(moiTotDD(N, lo || new Float64Array(nB))).map(([k, v]) => [k, v[0] + v[1]]));
  for (const R of rules) { R.dM = {}; const add = (b, n) => { for (const [k, c] of Object.entries(moi(b))) R.dM[k] = (R.dM[k] || 0) + c * n; }; for (const q of R.prods) add(q.b, q.n); for (const q of R.cons) add(q.b, -q.n); R.dMe = Object.entries(R.dM).filter(([, c]) => c); } // 균형 잡힌 규칙은 빈 목록 — 원장 경로를 건너뜀
  const chanDD = { lost: Object.fromEntries(moiKeys.map((k) => [k, [0, 0]])), source: Object.fromEntries(moiKeys.map((k) => [k, [0, 0]])), violation: Object.fromEntries(moiKeys.map((k) => [k, [0, 0]])) };
  const chanAdd = (ch, k, c, x) => { const [p, e] = twoProd(c, x); ddAdd(chanDD[ch][k], p, e); };
  const chan = new Proxy({}, { get: (_, ch) => Object.fromEntries(Object.entries(chanDD[ch]).map(([k, v]) => [k, v[0] + v[1]])) });
  // 규칙별 누적 진행량 (double-double) — 무결성 재생 검사: 모든 저장소 = 시작 + Σ 화학량 × 누적 진행량 (규칙 밖 변경이 없음을 증명)
  rules.forEach((R, k) => { R.idx = k; });
  let CUM = new Float64Array(2 * rules.length);
  const cumAdd = (R, x) => { const a = CUM[2 * R.idx], s1 = a + x, bb = s1 - a; CUM[2 * R.idx] = s1; CUM[2 * R.idx + 1] += (a - (s1 - bb)) + (x - bb); };
  const degCount = new Int32Array(nB); for (const R of rules) if (R.kind === 'degradation' && R.slow) degCount[R.ci[0].i]++;
  const stoich = Array.from({ length: nB }, () => []); // 묶음 i → [[규칙 번호, 화학량]]
  for (const R of rules) { for (const q of R.ci) stoich[q.i].push([R.idx, -q.n]); for (const q of R.pi) stoich[q.i].push([R.idx, q.n]); }
  const applyExtent = (R, N, xi) => {
    cumAdd(R, xi);
    for (const q of R.ci) addProdN(N, q.i, -q.n, xi);
    for (const q of R.pi) addProdN(N, q.i, q.n, xi);
    if (!xi || !R.dMe.length) return;
    const ch = R.lost ? 'lost' : R.source ? 'source' : 'violation';
    for (const [k, c] of R.dMe) chanAdd(ch, k, R.lost ? -c : c, xi);
  };
  // --- 빠른 층: 명시 부분 단계 (기준 경로)
  const lambda = (N, F) => { // 진행이 입력을 다 쓰는 속도 (1/s)의 최댓값 — 강성 지표
    let lam = 0;
    fast.forEach((R, j) => { const r = rate(R, N, F[j]); if (!(r > 0)) return; for (const q of R.ci) lam = Math.max(lam, q.n * r / Math.max(N[q.i], 1)); });
    return lam;
  };
  const explicitFast = (N, F, h, nsub) => {
    for (let s = 0; s < nsub; s++) for (let j = 0; j < fast.length; j++) {
      const R = fast[j];
      let xi = R.kind === 'degradation' ? Math.max(0, N[R.ci[0].i]) * (1 - Math.exp(-R.kdeg * F[j] * h)) : rate(R, N, F[j]) * h;
      for (const q of R.ci) xi = Math.min(xi, Math.max(0, N[q.i]) / q.n);
      if (xi > 0) applyExtent(R, N, xi);
    }
  };
  // --- 빠른 층: 역방향 오일러 (진행량 뉴턴, 관문이 승격했을 때)
  const nF = fast.length, tmp = new Float64Array(nB);
  const stateAt = (N0v, xi) => { tmp.set(N0v); for (let j = 0; j < nF; j++) { const R = fast[j]; for (const q of R.ci) tmp[q.i] -= q.n * xi[j]; for (const q of R.pi) tmp[q.i] += q.n * xi[j]; } return tmp; };
  const resid = (N0v, xi, F, h, out) => { stats.residEvals++; const Nn = stateAt(N0v, xi); for (let j = 0; j < nF; j++) out[j] = xi[j] - h * rate(fast[j], Nn, F[j]); return Nn; };
  const solve = (M, b) => { // 가우스 소거 (부분 피벗)
    const n = b.length, a = M.map((r) => r.slice()), x = b.slice();
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
      [a[c], a[p]] = [a[p], a[c]]; [x[c], x[p]] = [x[p], x[c]];
      if (Math.abs(a[c][c]) < 1e-300) return null;
      for (let r = c + 1; r < n; r++) { const f = a[r][c] / a[c][c]; if (!f) continue; for (let k = c; k < n; k++) a[r][k] -= f * a[c][k]; x[r] -= f * x[c]; }
    }
    for (let c = n - 1; c >= 0; c--) { let s = x[c]; for (let k = c + 1; k < n; k++) s -= a[c][k] * x[k]; x[c] = s / a[c][c]; }
    return x;
  };
  const stats = { newton: 0, newtonFail: 0, substeps: 0, implicitSteps: 0, explicitSteps: 0, residEvals: 0, jacEvals: 0 };
  // 해석적 야코비안 (IR 기호 도함수): J[j][k] = δ_jk − h · Σ_i ∂rate_j/∂N_i · S_ik  — 빠른 규칙 j 가 의존하는 묶음 i 만 (희소)
  //   테이프는 같은 규칙의 고정 배율 f_j 를 FAC 로 받는다. 꺾인 곳(max(0,·)·완충 상한)은 현재 반복점의 가지 도함수 (잔차는 그대로).
  const tctx = { NA, V: Float64Array.from(IR.species, (x) => x.V), buf: Float64Array.from(IR.species, (x) => (x.buf == null ? Infinity : x.buf)), stack: new Float64Array(64) };
  const JD = IR.jac.fast.map((j) => IR.jac.dRate[j]), JS = IR.jac.S;
  if (JD.length !== nF) throw new Error('IR 빠른 층과 엔진 빠른 층이 다름 — IR 과 db·시나리오가 맞지 않음');
  const Jt = Array.from({ length: nF }, () => new Float64Array(nF));
  const analyticJ = (Nn, F, h) => {
    stats.jacEvals++;
    for (let j = 0; j < nF; j++) { Jt[j].fill(0); Jt[j][j] = 1; }
    for (let j = 0; j < nF; j++) for (const d of JD[j]) {
      const v = TAPE.evalTape(d.t, Nn, F[j], tctx);
      if (v) for (const [k, c] of JS[d.i]) Jt[j][k] -= h * v * c;
    }
    return Jt;
  };
  const implicitFast = (N, F, h) => {
    const N0v = Float64Array.from(N), xi = new Array(nF).fill(0), r0 = new Array(nF), r1 = new Array(nF);
    // 초기 추정: 명시 한 단계의 진행량 (입력 한도 안)
    for (let j = 0; j < nF; j++) { let x = h * rate(fast[j], N0v, F[j]); for (const q of fast[j].ci) x = Math.min(x, Math.max(0, N0v[q.i]) / q.n); xi[j] = Math.max(0, x); }
    let ok = false;
    for (let it = 0; it < CP.newton_iters; it++) {
      stats.newton++;
      const Nn = resid(N0v, xi, F, h, r0);
      const norm = Math.max(...r0.map((v, j) => Math.abs(v) / (Math.abs(xi[j]) + 1)));
      if (norm < CP.newton_tol) { ok = true; break; }
      let Jm;
      if (CP.jacobian === 'fd') { // 0.5단계 이전 기준 (비교 검토용): 유한차분 — 잔차 nF 번 더
        const J = [];
        for (let c = 0; c < nF; c++) { const d = Math.max(1e-7 * Math.abs(xi[c]), 1e-6); xi[c] += d; resid(N0v, xi, F, h, r1); xi[c] -= d; J.push(r1.map((v, j) => (v - r0[j]) / d)); }
        Jm = r0.map((_, j) => J.map((col) => col[j]));
      } else Jm = analyticJ(Nn, F, h).map((row) => Array.from(row));
      const dx = solve(Jm, r0.map((v) => -v));
      if (!dx) break;
      let lam = 1; // 감쇠: 음수 상태·음수 진행 금지
      for (let tries = 0; tries < 40; tries++) { const cand = xi.map((v, j) => v + lam * dx[j]); const Nn = stateAt(N0v, cand); if (cand.every((v) => v >= -1e-9) && Nn.every((v, i) => v >= -1e-6 * Math.max(1, N0v[i]))) { for (let j = 0; j < nF; j++) xi[j] = Math.max(0, cand[j]); break; } lam /= 2; }
    }
    if (!ok) { stats.newtonFail++; return false; } // 수렴하지 않으면 아무것도 바꾸지 않고 명시 경로로 (호출자가 대체)
    for (let j = 0; j < nF; j++) applyExtent(fast[j], N, xi[j]);
    return true;
  };
  // --- 느린 층: 표지 합성·분해 — 배율 고정, 정확한 지수 해 (생성 s·Δ, 소실 = 시작 + 생성 − 끝)
  const slowStep = (N, h) => {
    const F = slow.map((R) => modF(R, N));
    const prod = new Float64Array(nB), kd = new Float64Array(nB);
    slow.forEach((R, j) => {
      if (R.kind === 'degradation') kd[R.ci[0].i] += R.kdeg * F[j];
      else { const r = rate(R, N, F[j]); for (const q of R.pi) prod[q.i] += q.n * r; R._r = r; }
    });
    const before = Float64Array.from(N), made = {}, applied = {};
    for (let i = 0; i < nB; i++) {
      if (!prod[i] && !kd[i]) continue;
      const k = kd[i], s = prod[i];
      const v = k > 0 ? N[i] * Math.exp(-k * h) + (s / k) * (1 - Math.exp(-k * h)) : N[i] + s * h;
      const d = v - N[i]; addN(N, i, d); applied[i] = d;
      made[i] = s * h;
    }
    // 원장: 합성(계 밖 공급)·분해(소실) 진행량으로 기록
    slow.forEach((R) => {
      if (R.kind === 'degradation') { const i = R.ci[0].i, lost = before[i] + (made[i] || 0) - N[i], share = kd[i] ? R.kdeg * modF(R, before) / kd[i] : 0;
        if (degCount[i] === 1) { cumAdd(R, made[i] || 0); cumAdd(R, -(applied[i] || 0)); } else cumAdd(R, lost * share); // 소실 = 생성 − 적용된 변화 (정확히 두 항으로)
        for (const [k, c] of Object.entries(R.dM)) chanAdd('lost', k, -c, lost * share); }
      else { cumAdd(R, R._r * h); for (const [k, c] of Object.entries(R.dM)) chanAdd(R.source ? 'source' : 'violation', k, c, R._r * h); }
    });
    return F;
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
  // ===== 한 번의 적분 (본 실행과 결정 탐침이 공유) =====
  const gateOpt = CP.gate, shockMax = CP.shock_threshold;
  function run(Nstart, t0, t1, ctl) {
    LO = ctl.lo ? Float64Array.from(ctl.lo) : new Float64Array(nB);
    CUM = new Float64Array(2 * rules.length);
    const N = Float64Array.from(Nstart), gate = GATE.createGate(gateOpt); gate.gammaMax = shockMax;
    const mode = ctl.mode || 'dynamic', series = [], events = [], resv = new Map();
    let prevSig = null, step = 0, exhaustedNow = false;
    const reservoirs = keys.map((b, i) => i).filter((i) => !isSignal[i] && !isMarker[i] && rules.some((R) => R.ci.some((q) => q.i === i)));
    for (const i of reservoirs) resv.set(i, { start: N[i], min: N[i], state: N[i] >= 1 ? 'ok' : 'empty', watch: N[i] >= 1 });
    const path = { fv: 0, surrogate: 0, fv_shock: 0 }, nsubs = [];
    for (let t = t0; t < t1 - 1e-9; t += dt, step++) {
      // 신호 (경계 조건 — 질량 감사 밖)
      const sig = signalAt(t, ctl.signal);
      sched.forEach((s, j) => { N[s.i] = sig[j]; });
      const gamma = prevSig ? Math.max(exhaustedNow ? 1 : 0, ...sig.map((v, j) => Math.abs(v - prevSig[j]) / (Math.max(v, prevSig[j]) + 1e-12))) : 0;
      prevSig = sig; exhaustedNow = false;
      // 느린 층의 상태로 빠른 층 배율 고정
      const F = fast.map((R) => modF(R, N));
      const lam = lambda(N, F), nsub = Math.max(1, Math.ceil(lam * dt / CP.explicit_fraction));
      nsubs.push(nsub);
      let p;
      if (mode === 'fine') p = { path: 'fv' };
      else if (mode === 'implicit') p = { path: 'surrogate' };
      else p = GATE.decide(gate, step, nsub, () => gamma);
      if (p.path === 'surrogate' && implicitFast(N, F, dt)) { path.surrogate++; stats.implicitSteps++; }
      else if (p.path === 'surrogate') { explicitFast(N, F, dt / nsub, nsub); path.fv_newton = (path.fv_newton || 0) + 1; stats.explicitSteps++; stats.substeps += nsub; } // 뉴턴 실패 → 같은 단계 명시 대체
      else { explicitFast(N, F, dt / nsub, nsub); path[p.event === 'demote_prefilter' ? 'fv_shock' : 'fv']++; stats.explicitSteps++; stats.substeps += nsub; }
      slowStep(N, dt);
      // 저장소 고갈·재생 사건
      for (const [i, r] of resv) {
        r.min = Math.min(r.min, N[i]);
        if (!r.watch) continue; // 처음부터 비어 있던 중간 산물(젖산·CO₂ …)은 고갈·재생 사건을 내지 않음
        if (r.state === 'ok' && N[i] < 1) { r.state = 'empty'; events.push({ t: t + dt, type: 'exhausted', bundle: keys[i] }); exhaustedNow = true; }
        else if (r.state === 'empty' && N[i] >= 1) { r.state = 'ok'; events.push({ t: t + dt, type: 'regenerated', bundle: keys[i] }); }
      }
      if (ctl.record && (step % (ctl.every || 1) === 0)) series.push({ t: t + dt, N: Float64Array.from(N), path: p.path, nsub, gate: gate.state, event: p.event || null, sig, lo: Float64Array.from(LO), cumDD: Float64Array.from(CUM), cum: Float64Array.from({ length: rules.length }, (_, k) => CUM[2 * k] + CUM[2 * k + 1]) });
      if (ctl.snapshots) ctl.snapshots.push({ t: t + dt, N: Float64Array.from(N) });
      if (ctl.onStep) ctl.onStep(t + dt, N);
    }
    return { N, lo: LO, cum: CUM, series, events, gate, path, nsubs, resv };
  }
  // ===== 본 실행 =====
  const M0DD = moiTotDD(N0, new Float64Array(nB)), M0 = Object.fromEntries(Object.entries(M0DD).map(([k, v]) => [k, v[0] + v[1]]));
  const snapshots = [];
  // 질량 수지·재생 검사는 하지 않는다 — 기록점마다 N·LO·누적 진행량(double-double)을 내보내 사법부가 독립적으로 다시 계산한다
  const main = run(N0, 0, tEnd, { record: true, every: sc.record_every || 1, snapshots, mode: opt.mode });
  const chanMain = Object.fromEntries(['lost', 'source', 'violation'].map((ch) => [ch, chan[ch]])); // 결정 탐침이 원장을 더 쓰기 전에 본 실행의 원장을 고정
  // 궤적에서 상태·거리
  const traj = main.series.map((s) => ({ t: s.t, d: Object.fromEntries(states.map((x) => [x, distance(s.N, x)])), cls: classify(s.N), path: s.path, nsub: s.nsub, gate: s.gate }));
  const final = classify(main.N);
  const firstReach = {}; for (const r of traj) if (r.cls.state && firstReach[r.cls.state] == null) firstReach[r.cls.state] = r.t;
  // 기대 목표: 신호가 한 번이라도 켜진 전이의 대상
  const sigOn = new Set(sched.filter((s) => s.list.some((e) => e.n > 0)).map((s) => keys[s.i].split('|')[0]));
  const transitions = (db.senses[sourceId].transitions || []).map((tr) => ({ to: tr.to, signals: tr.signals, criterion: tr.commitment.criterion, driven: tr.signals.some((g) => sigOn.has(g)) }));
  // ===== 결정 시점 (신호 철회 시험) =====
  const horizon = CP.commitment_horizon, coarse = Math.max(1, Math.round(CP.commitment_coarse / dt));
  const probe = (k) => { // k = 스냅숏 번호 → 그 시각 이후 신호 0 으로 horizon 동안
    const s = snapshots[k]; const r = run(s.N, s.t, s.t + horizon, { mode: opt.mode, signal: () => 0 });
    return classify(r.N).state;
  };
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
    gate: { ...main.gate.stats, transitions: main.gate.stats.transitions.length, log: main.gate.stats.transitions, path: main.path, nsub: { min: Math.min(...main.nsubs), max: Math.max(...main.nsubs) } },
    // 엔진의 장부 (판정 아님): 부분 구조 시작·끝 합계와 경로별 누적 — 사법부는 이것을 믿지 않고 원자료로 다시 센다
    mass: { moieties: moiKeys, start: M0, end: moiTot(main.N, main.lo), channels: chanMain },
    reservoirs: Object.fromEntries([...main.resv].map(([i, r]) => [keys[i], { start: r.start, min: r.min, end: main.N[i], state: r.state, watched: r.watch, buffered: buf.has(i) }])),
    volumes: volL, buffered: sc.buffered || {}, coupling: CP,
    process: { // 과정 보고서(judicial/process_report.js)·검증기(judicial/verifier.js)가 읽는 원자료 — 이름 없이 번호·묶음만
      lo: main.series.map((x) => x.lo), cumDD: main.series.map((x) => x.cumDD),
      times: main.series.map((x) => x.t), sig: main.series.map((x) => x.sig), cum: main.series.map((x) => x.cum), gateEvents: main.series.map((x) => x.event),
      schedule: sched.map((x) => ({ bundle: keys[x.i], list: x.list })), signalIdx: sched.map((x) => x.i), thresholds: thr, N0: Float64Array.from(N0),
      ruleInfo: rules.map((R) => ({ ref: R.ref, kind: R.kind, layer: R.slow ? 'slow' : 'fast', cons: R.cons.map((q) => [q.b, q.n]), prods: R.prods.map((q) => [q.b, q.n]), src: R.k ? R.k.src : null, kin: R.k, mods: R.mi.map((m) => ({ ref: m.ref, bundle: keys[m.i], effect: m.eff, kin: m.k })) })),
    },
    irHash: IR.hash, // 먹은 IR 의 해시 — 사법부가 조정자에게서 받은 IR 과 맞춘다
    events: main.events, facts, kineticGaps: A.gaps, modulationGaps: A.modGaps, stats: { ...stats, probes }, ix,
  };
}

module.exports = { simulateFate, assemble: IRB.assemble };
