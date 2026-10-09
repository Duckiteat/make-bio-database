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
'use strict';
const C = require('../core.js');
const GATE = require('./p5_dynamic_gate.js');
const V = C.VOCAB, NA = C.NA, VOL = C.VOL;

const loc3 = (l) => V.locations[l] && V.locations[l].dim === '3D';

// ===== 계 조립: 상태들 → 규칙·묶음 =====
function assemble(db, sourceId, sc) {
  const ix = C.index(db), src = db.senses[sourceId];
  if (!src || src.kind !== 'cell_state') return { error: `'${sourceId}' 는 세포 상태(cell_state) 정의항이 아님` };
  // 상태: 시작 상태 + 전이로 닿는 상태 (닫힌 집합)
  const states = [sourceId];
  for (let i = 0; i < states.length; i++) for (const t of db.senses[states[i]].transitions || []) if (!states.includes(t.to)) states.push(t.to);
  const markers = new Map(); // 묶음 → 기준 정의항
  for (const s of states) for (const m of db.senses[s].signature) markers.set(`${m.ref}|${m.location}`, m.ref);
  // 규칙: 상태들의 대사 프로그램 + 표지 정의항이 가진 공급 규칙 + 시나리오 extra_rules
  const ruleRefs = new Set();
  for (const s of states) for (const m of db.senses[s].metabolome || []) ruleRefs.add(m.ref);
  for (const base of new Set(markers.values())) for (const r of db.senses[base].rule) if (r.type === 'supply') ruleRefs.add(`${base}/rule/${r.id}`);
  for (const r of sc.extra_rules || []) ruleRefs.add(r);
  const kinOf = (ref) => (sc.kinetics || {})[ref] ? { ...sc.kinetics[ref], src: 'scenario' } : ix.ruleOf(ref) && ix.ruleOf(ref).kinetics ? { ...ix.ruleOf(ref).kinetics, src: 'data' } : null;
  const rules = [], gaps = [], audit = [];
  const AE = (code, where, msg, suggestion) => audit.push({ code, where, msg, suggestion });
  const bundles = new Set(markers.keys());
  for (const ref of ruleRefs) {
    const r = ix.ruleOf(ref);
    if (!r || r.type !== 'supply') { AE('AUDIT_SCHEMA', ref, '공급 규칙이 아님 — 계에서 뺌'); continue; }
    const loc = r.where[0], k = kinOf(ref);
    const cons = r.consumes.map((q) => ({ b: `${q.ref}|${loc}`, n: q.n, sat: !!q.saturating })), prods = r.produces.map((q) => ({ b: `${q.ref}|${loc}`, n: q.n }));
    for (const q of [...cons, ...prods]) bundles.add(q.b);
    if (!k) gaps.push(ref);
    rules.push({ ref, kind: 'supply', rule: r, loc, k, cons, prods, source: !!r.source });
  }
  // 분해 규칙: 계 안 묶음마다 (위치·부위 조건)
  for (const b of [...bundles]) {
    const [base, loc] = [b.split('|')[0], b.split('|').pop()], d = db.senses[base];
    if (!d) continue;
    for (const r of d.rule) {
      if (r.type !== 'degradation' || Object.keys(r.when).length || (r.where && !r.where.includes(loc))) continue;
      const ref = `${base}/rule/${r.id}`, k = kinOf(ref);
      if (!k) gaps.push(ref);
      if (r.recycle_to.length) AE('AUDIT_SCHEMA', ref, '재활용 분해는 운명 층에서 아직 다루지 않음 — 소실로 처리');
      rules.push({ ref, kind: 'degradation', rule: r, loc, k, cons: [{ b, n: 1 }], prods: [], lost: true });
    }
  }
  // 조절: 계 안 규칙을 대상으로 하는 모든 조절 규칙 (조절자 묶음 = 소유자|at)
  const mods = C.modulationIndex(db), modGaps = [];
  for (const R of rules) {
    R.mods = (mods.get(R.ref) || []).map((m) => ({ ...m, b: `${m.owner}|${m.rule.at}`, k: kinOf(m.ref) }));
    for (const m of R.mods) { bundles.add(m.b); if (!m.k) modGaps.push(m.ref); }
  }
  // 층 나누기: 표지를 만들거나 없애는 규칙 = 느린 층, 나머지 = 빠른 층
  for (const R of rules) R.slow = [...R.cons, ...R.prods].some((q) => markers.has(q.b));
  // 신호: 상태 전이의 신호 정의항의 묶음 (시나리오 signals 의 키)
  const signalBases = new Set(states.flatMap((s) => (db.senses[s].transitions || []).flatMap((t) => t.signals)));
  const signals = new Set(Object.keys(sc.signals || {}));
  for (const b of bundles) if (signalBases.has(b.split('|')[0])) signals.add(b);
  for (const b of signals) bundles.add(b);
  return { ix, states, markers, rules, bundles: [...bundles], signals: [...signals], gaps: [...new Set(gaps)], modGaps: [...new Set(modGaps)], audit, kinOf };
}

// ===== 시뮬레이션 =====
function simulateFate(db, sourceId, opt) {
  db = C.normalize(db);
  opt = Object.assign({}, opt || {});
  const sc = opt.scenario || {};
  const A = assemble(db, sourceId, sc);
  if (A.error) return A;
  const { ix, states, markers, rules, signals } = A;
  const dt = opt.dt_slow || sc.dt_slow || 60, tEnd = opt.t_end || sc.t_end || 48 * 3600;
  const Ksat = sc.saturation_K || C.SAT_K;
  // 부피 (시나리오 → 없음)
  const volL = {};
  for (const [l, v] of Object.entries(sc.volumes || {})) if (VOL[v.unit]) volL[l] = v.value * VOL[v.unit];
  const audit = A.audit.slice(), AE = (code, where, msg, suggestion) => audit.push({ code, where, msg, suggestion });
  for (const b of A.bundles) { const l = b.split('|').pop(); if (!volL[l]) AE('AUDIT_CONCENTRATION', b, `구획 ${l} 부피를 모름 — 농도 0 으로 계산`, C.gapSuggest(db, ix, sourceId, 'Concentration_Gap')); }
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
    R.mi = R.mods.filter((m) => m.k).map((m) => ({ i: at.get(m.b), eff: m.rule.effect, k: m.k, ref: m.ref, owner: m.owner }));
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
  const applyExtent = (R, N, xi) => {
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
  const resid = (N0v, xi, F, h, out) => { const Nn = stateAt(N0v, xi); for (let j = 0; j < nF; j++) out[j] = xi[j] - h * rate(fast[j], Nn, F[j]); return Nn; };
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
  const stats = { newton: 0, newtonFail: 0, substeps: 0, implicitSteps: 0, explicitSteps: 0 };
  const implicitFast = (N, F, h) => {
    const N0v = Float64Array.from(N), xi = new Array(nF).fill(0), r0 = new Array(nF), r1 = new Array(nF);
    // 초기 추정: 명시 한 단계의 진행량 (입력 한도 안)
    for (let j = 0; j < nF; j++) { let x = h * rate(fast[j], N0v, F[j]); for (const q of fast[j].ci) x = Math.min(x, Math.max(0, N0v[q.i]) / q.n); xi[j] = Math.max(0, x); }
    let ok = false;
    for (let it = 0; it < 50; it++) {
      stats.newton++;
      resid(N0v, xi, F, h, r0);
      const norm = Math.max(...r0.map((v, j) => Math.abs(v) / (Math.abs(xi[j]) + 1)));
      if (norm < 1e-10) { ok = true; break; }
      const J = [];
      for (let c = 0; c < nF; c++) { const d = Math.max(1e-7 * Math.abs(xi[c]), 1e-6); xi[c] += d; resid(N0v, xi, F, h, r1); xi[c] -= d; J.push(r1.map((v, j) => (v - r0[j]) / d)); }
      const Jt = r0.map((_, j) => J.map((col) => col[j]));
      const dx = solve(Jt, r0.map((v) => -v));
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
    const before = Float64Array.from(N), made = {};
    for (let i = 0; i < nB; i++) {
      if (!prod[i] && !kd[i]) continue;
      const k = kd[i], s = prod[i];
      const v = k > 0 ? N[i] * Math.exp(-k * h) + (s / k) * (1 - Math.exp(-k * h)) : N[i] + s * h;
      addN(N, i, v - N[i]);
      made[i] = s * h;
    }
    // 원장: 합성(계 밖 공급)·분해(소실) 진행량으로 기록
    slow.forEach((R) => {
      if (R.kind === 'degradation') { const i = R.ci[0].i, lost = before[i] + (made[i] || 0) - N[i], share = kd[i] ? R.kdeg * modF(R, before) / kd[i] : 0; for (const [k, c] of Object.entries(R.dM)) chanAdd('lost', k, -c, lost * share); }
      else for (const [k, c] of Object.entries(R.dM)) chanAdd(R.source ? 'source' : 'violation', k, c, R._r * h);
    });
    return F;
  };
  // ===== 거리·상태 =====
  const thr = sc.thresholds || {};
  for (const b of markers.keys()) if (!thr[b]) AE('AUDIT_CONCENTRATION', b, '표지 문턱(thresholds[묶음] = { high, low })이 없음 — 상태를 판정할 수 없음', C.gapSuggest(db, ix, sourceId, 'Concentration_Gap'));
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
  const gateOpt = Object.assign({ K_up: 15, K_down: 8, M: 5, W: 20 }, sc.gate || {});
  const shockMax = sc.shock_threshold != null ? sc.shock_threshold : 0.2;
  function run(Nstart, t0, t1, ctl) {
    LO = ctl.lo ? Float64Array.from(ctl.lo) : new Float64Array(nB);
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
      const lam = lambda(N, F), nsub = Math.max(1, Math.ceil(lam * dt / (sc.explicit_fraction || 0.1)));
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
      if (ctl.record && (step % (ctl.every || 1) === 0)) series.push({ t: t + dt, N: Float64Array.from(N), path: p.path, nsub, gate: gate.state });
      if (ctl.snapshots) ctl.snapshots.push({ t: t + dt, N: Float64Array.from(N) });
      if (ctl.onStep) ctl.onStep(t + dt, N);
    }
    return { N, lo: LO, series, events, gate, path, nsubs, resv };
  }
  // ===== 본 실행 =====
  const M0DD = moiTotDD(N0, new Float64Array(nB)), M0 = Object.fromEntries(Object.entries(M0DD).map(([k, v]) => [k, v[0] + v[1]]));
  const MASS_TOL = 1e-14; // 상대 — ΣIn = ΣOut (프로토콜 불변식)
  let worstMass = 0;
  const snapshots = [];
  const main = run(N0, 0, tEnd, { record: true, every: sc.record_every || 1, snapshots, mode: opt.mode, onStep: (t, N) => {
    const now = moiTotDD(N, LO);
    for (const k of moiKeys) {
      const e = [M0DD[k][0], M0DD[k][1]];
      for (const [ch, sg] of [['source', 1], ['lost', -1], ['violation', 1]]) { ddAdd(e, sg * chanDD[ch][k][0], sg * chanDD[ch][k][1]); }
      const dev = Math.abs((now[k][0] - e[0]) + (now[k][1] - e[1])) / Math.max(1, Math.abs(M0[k]));
      if (dev > worstMass) worstMass = dev;
    }
  } });
  for (const k of moiKeys) if (Math.abs(chan.violation[k]) > 1e-6 * Math.max(1, Math.abs(M0[k]))) AE('AUDIT_MASS', k, `부분 구조 ${ix.label(k)} 가 균형 잡히지 않은 규칙으로 ${chan.violation[k].toExponential(3)} 만큼 바뀜`, '규칙의 소비·생성을 고치거나 source/소실로 명시');
  if (worstMass > MASS_TOL) AE('AUDIT_MASS', '전역', `부분 구조 원장 불일치 최대 ${worstMass.toExponential(3)} (상대)`, '적분기 오류 — 진행량 원장과 상태가 어긋남');
  for (const i of keys.keys()) if (main.N[i] < -1e-6) AE('AUDIT_MASS', keys[i], `음수 양 ${main.N[i]}`, '엔진 오류');
  const chanMain = Object.fromEntries(['lost', 'source', 'violation'].map((ch) => [ch, chan[ch]])); // 결정 탐침이 원장을 더 쓰기 전에 본 실행의 원장을 고정
  // 궤적에서 상태·거리
  const traj = main.series.map((s) => ({ t: s.t, d: Object.fromEntries(states.map((x) => [x, distance(s.N, x)])), cls: classify(s.N), path: s.path, nsub: s.nsub, gate: s.gate }));
  const final = classify(main.N);
  const firstReach = {}; for (const r of traj) if (r.cls.state && firstReach[r.cls.state] == null) firstReach[r.cls.state] = r.t;
  // 기대 목표: 신호가 한 번이라도 켜진 전이의 대상
  const sigOn = new Set(sched.filter((s) => s.list.some((e) => e.n > 0)).map((s) => keys[s.i].split('|')[0]));
  const transitions = (db.senses[sourceId].transitions || []).map((tr) => ({ to: tr.to, signals: tr.signals, criterion: tr.commitment.criterion, driven: tr.signals.some((g) => sigOn.has(g)) }));
  // ===== 결정 시점 (신호 철회 시험) =====
  const horizon = (sc.commitment || {}).horizon || 24 * 3600, coarse = Math.max(1, Math.round(((sc.commitment || {}).coarse || 7200) / dt));
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
  // ===== 분화 정지 감지와 사후 분석 =====
  const target = (sc.target && sc.target) || (transitions.find((t) => t.driven) || {}).to || null;
    let arrest = null;
  if (target && !firstReach[target]) {
    // 정지 시점 = 그 뒤로 목표 쪽 진전(잘리지 않은 로그 거리)이 0.01 이하로만 남고, 그 상태가 창(window) 이상 이어진 첫 시각
    const d = main.series.map((s) => rawDistance(s.N, target)), suf = new Float64Array(d.length);
    for (let i = d.length - 1; i >= 0; i--) suf[i] = Math.min(d[i], i + 1 < d.length ? suf[i + 1] : Infinity);
    const tLast = traj[traj.length - 1].t;
    for (let i = 0; i < d.length; i++) if (d[i] - suf[i] < 0.01) { if (tLast - traj[i].t >= (sc.arrest_window || 6 * 3600)) arrest = { t: traj[i].t, d: traj[i].d[target], raw: d[i] }; break; }
    if (!arrest) arrest = { t: null, d: traj[traj.length - 1].d[target], note: '창 안에서 아직 움직이는 중 — t_end 를 늘려 확인' };
  }
  const pm = target && !firstReach[target] ? postMortem(db, ix, { target, final, main, keys, at, rules, slow, fast, concAt, thr, states, distance, firstReach, sigOn, M0 }) : null;
  if (pm) AE('AUDIT_FATE', target, `분화 정지 — ${ix.label(target)} 에 도달하지 못함 (원인 ${pm.cause}${pm.limiting ? ', 제한 ' + pm.limiting.label : ''})`, pm.suggestion);
  // 소비만 되는 저장소 (재생 경로 없음)
  for (const [i, r] of main.resv) { const prod = rules.some((R) => R.pi.some((q) => q.i === i)); if (!prod && !buf.has(i)) AE('AUDIT_RESOURCE', keys[i], `${ix.bundleLabel(keys[i])} 는 소비만 되고 재생 경로가 없음 (시작 ${+r.start.toPrecision(4)}, 끝 ${+main.N[i].toPrecision(4)})`, fateSuggest(db, ix, keys[i], 'Resource_Gap', rules)); }
  return {
    source: sourceId, states, scenario: sc.name || null, hypothetical: !!sc.hypothetical, dt, t_end: tEnd, keys, markers: [...markers.keys()], signals,
    rules: rules.map((R) => ({ ref: R.ref, kind: R.kind, layer: R.slow ? 'slow' : 'fast', active: !!R.k, src: R.k ? R.k.src : null, modulators: R.mods.map((m) => ({ ref: m.ref, bundle: m.b, effect: m.rule.effect, active: !!m.k })) })),
    final: { state: final.state, nearest: final.nearest || null, d: final.d, N: Object.fromEntries(keys.map((b, i) => [b, main.N[i]])) },
    trajectory: traj, series: main.series.map((x) => x.N), firstReach, transitions, commitment, target, arrest, postMortem: pm,
    gate: { ...main.gate.stats, transitions: main.gate.stats.transitions.length, log: main.gate.stats.transitions, path: main.path, nsub: { min: Math.min(...main.nsubs), max: Math.max(...main.nsubs) } },
    mass: { moieties: moiKeys, start: M0, end: moiTot(main.N, main.lo), channels: chanMain, worst: worstMass, tolerance: MASS_TOL },
    events: main.events, audit, kineticGaps: A.gaps, modulationGaps: A.modGaps, stats: { ...stats, probes }, ix,
  };
}

// 사후 분석: 실패한 표지 → 합성 규칙의 조절 배율 → 가장 모자란 활성화 인자 → 대사물이면 그 생산 규칙의 고갈 저장소
function postMortem(db, ix, c) {
  const { target, final, main, keys, at, rules, concAt, thr, firstReach } = c;
  const N = main.N, fails = [];
  for (const m of db.senses[target].signature) {
    const b = `${m.ref}|${m.location}`, t = thr[b], x = N[at.get(b)];
    if (!t) continue;
    if (m.level === 'high' && x < t.high) fails.push({ bundle: b, level: 'high', value: x, need: t.high });
    if (m.level === 'low' && x > t.low) fails.push({ bundle: b, level: 'low', value: x, need: t.low });
  }
  const alt = final.state && final.state !== target && final.state !== c.states[0] ? final.state : null; // 시작 상태에 머문 것은 다른 운명이 아님 (정지)
  const out = { target, reached: false, final: final.state, alternative: alt, failing: fails, drivers: [], cause: null, limiting: null, chain: [] };
  // 높아야 하는 표지의 합성 규칙: 조절 인자별 배율 (활성화는 fmax 대비 점유율, 억제는 남은 배율)
  for (const f of fails.filter((x) => x.level === 'high')) {
    const syn = rules.find((R) => R.slow && R.kind === 'supply' && R.pi.some((q) => q.i === at.get(f.bundle)));
    if (!syn) continue;
    for (const m of syn.mi) {
      const s = concAt(N, m.i), fac = C.hillFactor(m.eff, m.k, s);
      const occ = m.eff === 'activates' ? (fac - 1) / ((m.k.fmax || 1) - 1) : (1 - fac) / (1 - (m.k.fmin || 0));
      out.drivers.push({ marker: f.bundle, modulator: keys[m.i], effect: m.eff, factor: fac, occupancy: occ, ref: m.ref });
    }
  }
  const acts = out.drivers.filter((d) => d.effect === 'activates').sort((a, z) => a.occupancy - z.occupancy);
  const reps = out.drivers.filter((d) => d.effect === 'inhibits').sort((a, z) => z.occupancy - a.occupancy);
  const weakest = acts[0], strongestRep = reps[0];
  const label = (b) => ix.bundleLabel(b);
  // 사슬 따라가기 (너비 우선): 약한 활성화 인자를 만드는 빠른 규칙의 입력 중 바닥난 저장소 — 가까운 층부터, 이미 본 묶음은 건너뜀
  const trace = (b0) => {
    const seen = new Set([b0]); let level = [b0];
    for (let depth = 0; depth < 5 && level.length; depth++) {
      const next = [], hits = [];
      for (const b of level) for (const R of rules.filter((x) => !x.slow && x.pi.some((q) => q.i === at.get(b)))) for (const q of R.ci) {
        const kb = keys[q.i]; if (seen.has(kb)) continue; seen.add(kb);
        const r = main.resv.get(q.i);
        out.chain.push({ from: kb, via: R.ref, to: b, amount: N[q.i], start: r ? r.start : null });
        if (r && r.start >= 1 && (N[q.i] < 1 || N[q.i] < 1e-3 * r.start)) hits.push({ bundle: kb, rule: R.ref, start: r.start, end: N[q.i] });
        next.push(kb);
      }
      if (hits.length) return hits.sort((a, z) => a.end / a.start - z.end / z.start)[0];
      level = next;
    }
    return null;
  };
  const exhausted = main.events.filter((e) => e.type === 'exhausted').map((e) => e.bundle);
  if (alt && strongestRep && strongestRep.occupancy > 0.5) { out.cause = 'alternative_fate'; out.limiting = { bundle: strongestRep.modulator, label: label(strongestRep.modulator), role: 'antagonist', factor: strongestRep.factor }; }
  if (weakest && weakest.occupancy < 0.5) {
    const isSig = c.sigOn.has(weakest.modulator.split('|')[0]) || /extracellular$/.test(weakest.modulator);
    const res = !isSig ? trace(weakest.modulator) : null;
    if (res) { const ev = main.events.find((e) => e.type === 'exhausted' && e.bundle === res.bundle); if (ev) res.t_exhausted = ev.t; out.cause = alt ? 'alternative_fate' : 'resource_exhaustion'; out.resource = res; out.limiting = { bundle: res.bundle, label: label(res.bundle), role: 'reservoir', via: weakest.modulator }; }
    else if (!out.cause) { out.cause = isSig ? 'signal_insufficient' : 'kinetic_stall'; out.limiting = { bundle: weakest.modulator, label: label(weakest.modulator), role: isSig ? 'signal' : 'activator', occupancy: weakest.occupancy }; }
    out.weakest = weakest;
  }
  if (!out.cause && strongestRep) { out.cause = alt ? 'alternative_fate' : 'antagonist_dominance'; out.limiting = { bundle: strongestRep.modulator, label: label(strongestRep.modulator), role: 'antagonist', factor: strongestRep.factor }; }
  if (!out.cause) out.cause = exhausted.length ? 'resource_exhaustion' : 'kinetic_stall';
  out.exhausted = exhausted;
  const lb = out.limiting ? out.limiting.bundle : target;
  out.suggestion = out.cause === 'resource_exhaustion' || (out.resource && out.cause === 'alternative_fate')
    ? fateSuggest(db, ix, lb, 'Resource_Gap', rules) + ' — 또는 이 저장소를 채우는 공급 규칙(type: supply)을 상태의 대사 프로그램에'
    : out.cause === 'signal_insufficient' ? '신호 세기·지속 시간을 늘리거나 ' + fateSuggest(db, ix, out.weakest ? out.weakest.ref : lb, 'Regulatory_Gap', rules)
    : fateSuggest(db, ix, out.weakest ? out.weakest.ref : out.limiting ? lb : target, 'Regulatory_Gap', rules);
  return out;
}

// 교정 제안: 그 묶음·규칙을 대상으로 하거나 해결 경로에 둔 열린 한계 → 없으면 그 묶음을 만드는 규칙의 한계 → 없으면 등록 형식
function fateSuggest(db, ix, refOrBundle, type, rules) {
  const base = String(refOrBundle).split('|')[0].split('/')[0], isRule = /\/rule\//.test(refOrBundle);
  const makers = rules ? rules.filter((R) => R.pi.some((q) => q.b === refOrBundle) || R.ci.some((q) => q.b === refOrBundle)).map((R) => R.ref) : [];
  const want = new Set([refOrBundle, base, ...makers]);
  const open = Object.entries(db.limitations).filter(([, l]) => C.limitationStatus(db, l).status === 'open');
  const hit = open.filter(([, l]) => l.type === type).filter(([, l]) => want.has(l.target) || (isRule ? false : want.has((C.parseTarget(l.target) || {}).base)) || l.requirement.needs.some((n) => want.has(n.rule) || want.has(n.on)));
  if (hit.length) return hit.slice(0, 3).map(([id, l]) => `${id} [${l.type}] ${l.requirement.text}`).join(' / ');
  return `한계 등록부에 등록할 것: [${refOrBundle} | ${type} | 필요한 데이터·규칙]`;
}

// ===== 텍스트 보고 =====
function simulateFateText(db, sourceId, opt) {
  const r = simulateFate(db, sourceId, opt);
  if (r.error) return { text: '오류: ' + r.error, code: 1, result: r };
  const L = r.ix.label, BL = r.ix.bundleLabel, h = (s) => s == null ? '—' : `${(s / 3600).toFixed(2)} h`;
  const lines = [];
  lines.push(`세포 운명 시뮬레이션 — 시작 ${r.source} ${L(r.source)} · 상태 ${r.states.map((s) => `${s} ${L(s)}`).join(', ')}${r.scenario ? ` · 시나리오 "${r.scenario}"` : ''}${r.hypothetical ? ' [가상 값 — 엔진 시험용]' : ''}`);
  lines.push(`  느린 단계 Δ ${r.dt} s, ${h(r.t_end)} · 빠른 층 규칙 ${r.rules.filter((x) => x.layer === 'fast').length} · 느린 층 ${r.rules.filter((x) => x.layer === 'slow').length} · 조절 ${r.rules.reduce((a, x) => a + x.modulators.length, 0)}`);
  lines.push(`  최종 상태: ${r.final.state ? `${r.final.state} ${L(r.final.state)}` : `미결정 (가장 가까운 ${r.final.nearest} ${L(r.final.nearest)}, 거리 ${r.final.d.toFixed(3)})`}`);
  for (const [s, t] of Object.entries(r.firstReach)) lines.push(`  도달 ${s} ${L(s)} @ ${h(t)}`);
  for (const c of r.commitment) lines.push(`  결정 ${c.to} ${L(c.to)} [${c.criterion}${c.driven ? '' : ', 신호 없음'}]: ${c.t != null ? h(c.t) : '없음'}${c.monotone === false ? ' (격자에서 단조 아님!)' : ''}${c.horizon ? ` · 철회 후 ${h(c.horizon)} 관찰` : ''}`);
  if (r.arrest) lines.push(`  분화 정지: ${r.arrest.t != null ? h(r.arrest.t) : '판정 보류'} · 목표 거리 ${r.arrest.d.toFixed(3)}${r.arrest.note ? ' — ' + r.arrest.note : ''}`);
  if (r.postMortem) {
    const p = r.postMortem;
    lines.push(`  사후 분석: 원인 ${p.cause}${p.alternative ? ` · 대신 ${p.alternative} ${L(p.alternative)}` : ''}${p.limiting ? ` · 제한 ${p.limiting.label} (${p.limiting.role})` : ''}`);
    for (const f of p.failing) lines.push(`    실패 표지 ${BL(f.bundle)}: ${+f.value.toPrecision(4)} (${f.level === 'high' ? '≥' : '≤'} ${f.need})`);
    for (const d of p.drivers) lines.push(`    조절 ${BL(d.modulator)} ${d.effect === 'activates' ? '→' : '⊣'} 배율 ${d.factor.toFixed(3)} (점유 ${(d.occupancy * 100).toFixed(1)}%)`);
    if (p.resource) lines.push(`    고갈 저장소 ${BL(p.resource.bundle)}: ${+p.resource.start.toPrecision(4)} → ${+Math.max(0, p.resource.end).toPrecision(4)} (규칙 ${p.resource.rule})${p.resource.t_exhausted != null ? ` — 고갈 시각 ${h(p.resource.t_exhausted)} (실패 지점)` : ''}`);
    lines.push(`    교정: ${p.suggestion}`);
  }
  for (const e of r.events) lines.push(`  사건 ${h(e.t)} ${e.type} ${BL(e.bundle)}`);
  const g = r.gate;
  lines.push(`  P5 관문: 승격 ${g.promotions}, 강등 ${g.demotions} (강제 ${g.forced}), 냉각 ${g.cooldownSteps} · 경로 ${JSON.stringify(g.path)} · N_sub ${g.nsub.min}–${g.nsub.max} · 뉴턴 ${r.stats.newton} (실패 ${r.stats.newtonFail}) · 결정 탐침 ${r.stats.probes}`);
  lines.push(`  질량: 부분 구조 원장 최대 상대 편차 ${r.mass.worst.toExponential(2)} · ${r.mass.moieties.map((k) => `${L(k)} ${+r.mass.start[k].toPrecision(6)} → ${+r.mass.end[k].toPrecision(6)} (소실 ${+r.mass.channels.lost[k].toPrecision(4)})`).join(' · ')}`);
  if (r.kineticGaps.length) lines.push(`  속도 상수 없음(적용 안 함): ${r.kineticGaps.join(', ')}`);
  if (r.modulationGaps.length) lines.push(`  힐 상수 없음(배율 1): ${r.modulationGaps.join(', ')}`);
  for (const a of r.audit) lines.push(`  [${a.code}] ${a.where}: ${a.msg}${a.suggestion ? ' → ' + a.suggestion : ''}`);
  return { text: lines.join('\n'), code: r.audit.some((a) => a.code === 'AUDIT_MASS') ? 1 : 0, result: r };
}

module.exports = { simulateFate, simulateFateText, assemble, postMortem };
