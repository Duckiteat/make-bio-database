// 사법부 — 독립 질량 검증기 (Independent Mass Verifier). docs/design/tripartite-governance.md §2
//
// 운명 엔진(행정부)이 낸 원자료만 읽는다: 기록점마다 상태 N(hi)·반올림 잔여 LO·규칙별 누적 진행량(double-double).
// 엔진의 장부(mass.channels·start·end)와 엔진 안 화학량 색인을 믿지 않고, 화학량을 데이터베이스 규칙에서 다시 세운다:
//   ① 화학량 대조 — 엔진이 주장한 규칙별 소비·생성 묶음 = 데이터베이스 규칙(공급: consumes/produces@where, 분해: 그 묶음 1)
//   ② 재생(replay)  — 모든 비신호 묶음: (N + LO) − (N₀ + Σ_k S_ik · X_k) = 0  (규칙 진행량 밖 변경이 없음)
//   ③ 부분 구조 원장 — Σ_i m(b_i)·(N + LO) = Σ_i m(b_i)·N₀ + Σ_k ΔM_k · X_k  (m 은 model.moietyOf, 상대 1e-14)
//   ④ 규칙 밖 부분 구조 — 계 밖 공급(source)·분해(소실)가 아닌 규칙의 ΔM_k·X_k 는 0 이어야 한다
//   ⑤ 음수 상태 없음
// 산술은 이 파일의 TwoSum·TwoProduct (엔진의 것을 쓰지 않음). 판정만 하고 어떤 것도 고치거나 쓰지 않는다.
'use strict';
const M = require('../model.js');
const J = require('./judicial.js');

const twoSum = (a, b) => { const s = a + b, bb = s - a; return [s, (a - (s - bb)) + (b - bb)]; };
const split = (a) => { const c = 134217729 * a, hi = c - (c - a); return [hi, a - hi]; };
const twoProd = (a, b) => { const p = a * b, [ah, al] = split(a), [bh, bl] = split(b); return [p, ((ah * bh - p) + ah * bl + al * bh) + al * bl]; };
const dd = () => [0, 0];
const ddAdd = (acc, x, e) => { const [s, e1] = twoSum(acc[0], x); acc[0] = s; acc[1] += e1 + (e || 0); };
const ddMulAdd = (acc, c, hi, lo) => { const [p, e] = twoProd(c, hi); ddAdd(acc, p, e + c * (lo || 0)); }; // acc += c·(hi + lo)

// 데이터베이스에서 규칙의 화학량을 다시 세운다 (엔진 주장과 독립)
function stoichFromDB(db, ix, info) {
  const r = ix.ruleOf(info.ref);
  if (!r) return { error: '규칙이 데이터베이스에 없음' };
  if (r.type === 'supply') {
    const loc = r.where[0];
    return { kind: 'supply', source: !!r.source, cons: r.consumes.map((q) => [`${q.ref}|${loc}`, q.n]), prods: r.produces.map((q) => [`${q.ref}|${loc}`, q.n]) };
  }
  if (r.type === 'degradation') {
    const b = (info.cons[0] || [])[0], owner = info.ref.split('/rule/')[0];
    if (!b || b.split('|')[0] !== owner) return { error: `분해 대상 묶음 ${b} 가 규칙 소유자 ${owner} 의 것이 아님` };
    if (r.where && r.where.length && !r.where.includes(b.split('|').pop())) return { error: `분해 위치 ${b.split('|').pop()} 가 규칙 where 밖` };
    return { kind: 'degradation', lost: true, cons: [[b, 1]], prods: [] };
  }
  return { error: `공급·분해 규칙이 아님 (${r.type})` };
}
const sameStoich = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

function verifyFate(db, r) {
  db = M.normalize(db);
  const ix = M.index(db), P = r.process, keys = r.keys, nB = keys.length, at = new Map(keys.map((b, i) => [b, i]));
  const signal = new Set(r.signals.map((b) => at.get(b)));
  const TOL = J.MASS_REL_TOL;
  const out = { tolerance: TOL, stoichMismatch: [], series: [], replaySeries: [], worst: 0, replayWorst: 0, violations: [], negatives: [] };
  // ① 화학량
  const S = Array.from({ length: nB }, () => []), dM = [], allowed = [];
  const moiCache = new Map(), moi = (b) => { if (!moiCache.has(b)) moiCache.set(b, M.moietyOf(db, b.split('|')[0], 1, {})); return moiCache.get(b); };
  P.ruleInfo.forEach((info, k) => {
    const s = stoichFromDB(db, ix, info);
    if (s.error) { out.stoichMismatch.push({ ref: info.ref, msg: s.error }); dM.push({}); allowed.push(true); return; }
    if (!sameStoich(s.cons.map(String), info.cons.map(String)) || !sameStoich(s.prods.map(String), info.prods.map(String))) out.stoichMismatch.push({ ref: info.ref, msg: `엔진 화학량 ${JSON.stringify([info.cons, info.prods])} ≠ 데이터베이스 ${JSON.stringify([s.cons, s.prods])}` });
    for (const [b, n] of s.cons) if (at.has(b)) S[at.get(b)].push([k, -n]);
    for (const [b, n] of s.prods) if (at.has(b)) S[at.get(b)].push([k, n]);
    const d = {}; for (const [b, n] of s.prods) for (const [m, c] of Object.entries(moi(b))) d[m] = (d[m] || 0) + c * n; for (const [b, n] of s.cons) for (const [m, c] of Object.entries(moi(b))) d[m] = (d[m] || 0) - c * n;
    dM.push(Object.fromEntries(Object.entries(d).filter(([, c]) => c)));
    allowed.push(!!(s.source || s.lost));
  });
  const moiKeys = [...new Set(keys.filter((b, i) => !signal.has(i)).flatMap((b) => Object.keys(moi(b))))];
  const N0 = P.N0, total = (N, lo) => { const t = Object.fromEntries(moiKeys.map((m) => [m, dd()])); keys.forEach((b, i) => { if (signal.has(i)) return; for (const [m, c] of Object.entries(moi(b))) ddMulAdd(t[m], c, N[i], lo ? lo[i] : 0); }); return t; };
  const M0 = total(N0, null);
  out.start = Object.fromEntries(moiKeys.map((m) => [m, M0[m][0] + M0[m][1]]));
  // ②③ 기록점마다
  for (let j = 0; j < r.series.length; j++) {
    const N = r.series[j], lo = P.lo[j], X = P.cumDD[j];
    let rw = 0;
    for (let i = 0; i < nB; i++) {
      if (signal.has(i)) continue;
      const acc = [N[i], lo[i]]; ddAdd(acc, -N0[i], 0);
      for (const [k, c] of S[i]) ddMulAdd(acc, -c, X[2 * k], X[2 * k + 1]);
      const dev = Math.abs(acc[0] + acc[1]) / Math.max(1, Math.abs(N0[i]), Math.abs(N[i]));
      if (dev > rw) rw = dev;
    }
    const now = total(N, lo);
    let mw = 0;
    for (const m of moiKeys) {
      const e = [M0[m][0], M0[m][1]];
      dM.forEach((d, k) => { if (d[m]) ddMulAdd(e, d[m], X[2 * k], X[2 * k + 1]); });
      const dev = Math.abs((now[m][0] - e[0]) + (now[m][1] - e[1])) / Math.max(1, Math.abs(out.start[m]));
      if (dev > mw) mw = dev;
    }
    out.series.push(mw); out.replaySeries.push(rw);
    if (mw > out.worst) out.worst = mw;
    if (rw > out.replayWorst) out.replayWorst = rw;
  }
  // ④ 규칙 밖 부분 구조 (끝 시점 누적)
  const XE = P.cumDD[P.cumDD.length - 1] || new Float64Array(2 * P.ruleInfo.length);
  for (const m of moiKeys) {
    const v = dd(); P.ruleInfo.forEach((info, k) => { if (!allowed[k] && dM[k] && dM[k][m]) ddMulAdd(v, dM[k][m], XE[2 * k], XE[2 * k + 1]); });
    const x = v[0] + v[1]; if (Math.abs(x) > 1e-6 * Math.max(1, Math.abs(out.start[m]))) out.violations.push({ moiety: m, amount: x });
  }
  const last = r.series[r.series.length - 1], lastLo = P.lo[P.lo.length - 1];
  const endT = last ? total(last, lastLo) : M0;
  out.end = Object.fromEntries(moiKeys.map((m) => [m, endT[m][0] + endT[m][1]]));
  out.moieties = moiKeys;
  // ⑤ 음수
  keys.forEach((b, i) => { const x = r.final.N[b]; if (x < -1e-6) out.negatives.push({ bundle: b, value: x }); });
  out.pass = !out.stoichMismatch.length && out.worst <= TOL && out.replayWorst <= TOL && !out.violations.length && !out.negatives.length;
  return out;
}

module.exports = { verifyFate, stoichFromDB };
