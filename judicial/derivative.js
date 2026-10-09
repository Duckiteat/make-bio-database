// 사법부 — IR·기호 도함수 검사 (Derivative Audit). docs/design/engine-port-roadmap.md 0.5단계
//
// 컴파일러가 만든 IR(compiler/ir_builder.js)을 엔진이 먹기 전에 사법부가 독립적으로 검증한다. 컴파일러 코드를 쓰지 않는다:
//   ① 해시      — IR 의 정준 JSON sha256 이 ir.hash 와 같고(변조 없음), 엔진 원자료의 irHash 와도 같다(엔진이 바로 이 IR 을 먹음)
//   ② 법칙 충실도 — 규칙마다 db·시나리오에서 속도 법칙(질량작용·0차·포화·1차 분해)·상수·부피·화학량을 사법부가 다시 세워,
//                  IR 속도 테이프의 값과 임의 상태점에서 비교 (상대 ≤ 1e-14)
//   ③ 기호 도함수 — 사법부의 이중수(dual number) 전진 자동미분으로 같은 법칙을 미분해 IR 의 ∂rate/∂N·∂f/∂s 테이프와 비교 (상대 ≤ 1e-14)
//   ④ 희소 패턴   — IR 이 의존 목록에서 뺀 묶음의 자동미분 도함수는 정확히 0 이어야 한다 (빠진 의존성 없음)
//   ⑤ 교차 확인   — 중심 유한차분과 비교 (상대 ≤ 1e-6, 유한차분 자체 오차 수준)
// 상태점은 고정 seed 로 뽑는다(결정론). 꺾인 곳(완충 상한·0)과 힐 n<1 의 자른 구간은 피한다 — 그 구간의 식은 테이프 명세로 정의된다.
'use strict';
const crypto = require('crypto');
const M = require('../model.js');
const { canon } = require('./attestation.js');

const TOL = 1e-14, FD_TOL = 1e-6;

// ---- 이중수 (값, 한 방향 도함수)
const D = (v, d) => ({ v, d: d || 0 });
const dmul = (a, b) => D(a.v * b.v, a.d * b.v + a.v * b.d);
const dsat = (a, K) => D(a.v / (a.v + K), (K / ((a.v + K) * (a.v + K))) * a.d);
const dpowr = (a, n) => D(Math.pow(a.v, n), a.v === 0 ? (n === 1 ? a.d : 0) : n * Math.pow(a.v, n - 1) * a.d);

// ---- 사법부의 테이프 해석기 (명세: compiler/tape.js 머리 주석 — 코드는 공유하지 않음)
const AR = [1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 5, 6];
function runTape(t, N, f, sp) {
  const st = [];
  const c = (i) => { const V = sp.V[i]; if (!(V > 0)) return 0; const x = Math.max(0, N[i]) / (M.NA * V); return Math.min(x, sp.buf[i]); };
  for (let p = 0; p < t.length;) {
    const op = t[p], a = t.slice(p + 1, p + 1 + AR[op]); p += 1 + AR[op];
    if (op === 0) st.push(a[0]);
    else if (op === 1) st.push(c(a[0]));
    else if (op === 2) { const i = a[0], V = sp.V[i]; st.push(V > 0 && N[i] > 0 && c(i) < sp.buf[i] ? 1 / (M.NA * V) : 0); }
    else if (op === 3) st.push(Math.max(0, N[a[0]]));
    else if (op === 4) st.push(N[a[0]] > 0 ? 1 : 0);
    else if (op === 5) st.push(f);
    else if (op === 6) { const y = st.pop(); st.push(st.pop() * y); }
    else if (op === 7) { const y = st.pop(); st.push(st.pop() + y); }
    else if (op === 8) st.push(Math.pow(st.pop(), a[0]));
    else if (op === 9) { const x = st.pop(); st.push(a[0] === 1 ? 1 : a[0] * Math.pow(x, a[0] - 1)); }
    else if (op === 10) { const x = st.pop(); st.push(x / (x + a[0])); }
    else if (op === 11) { const x = st.pop(); st.push(a[0] / ((x + a[0]) * (x + a[0]))); }
    else if (op === 12) { const s = st.pop(); st.push(M.hillFactor(a[0] ? 'activates' : 'inhibits', { K: a[1], n: a[2], fmax: a[3], fmin: a[4] }, s)); }
    else if (op === 13) { let s = st.pop(); const [e, K, n, fmax, fmin, smin] = a; if (n < 1 && s < smin) s = smin; const x = s > 0 ? Math.pow(s / K, n) : 0, dd = s > 0 ? n * x / (s * (1 + x) * (1 + x)) : n === 1 ? 1 / K : 0; st.push(e ? (fmax - 1) * dd : -(1 - fmin) * dd); }
    else throw new Error(`알 수 없는 명령 ${op}`);
  }
  return st.length ? st[st.length - 1] : 0;
}

// ---- db·시나리오에서 규칙 법칙을 다시 세움 (컴파일러와 독립)
function lawsFromDB(db, ir, sc) {
  const ix = M.index(db), at = new Map(ir.keys.map((b, i) => [b, i])), mods = M.modulationIndex(db), problems = [];
  const kinOf = (ref) => ((sc.kinetics || {})[ref] ? sc.kinetics[ref] : (ix.ruleOf(ref) || {}).kinetics || null);
  const volL = {}; for (const [l, v] of Object.entries(sc.volumes || {})) if (M.VOL[v.unit]) volL[l] = v.value * M.VOL[v.unit];
  const sp = { V: ir.keys.map((b) => volL[b.split('|').pop()] || 0), buf: ir.keys.map((b) => ((sc.buffered || {})[b] ? sc.buffered[b].conc_M : Infinity)) };
  const Ksat = ir.coupling.saturation_K, srcK = ir.coupling._source.saturation_K;
  if (srcK === 'scenario' && Ksat !== sc.saturation_K) problems.push(`saturation_K ${Ksat} ≠ 시나리오 ${sc.saturation_K}`);
  if (srcK === 'default' && Ksat !== M.SAT_K) problems.push(`saturation_K ${Ksat} ≠ 기본값 ${M.SAT_K}`);
  for (let i = 0; i < ir.keys.length; i++) { const s = ir.species[i]; if (s.V !== sp.V[i] || (s.buf == null ? Infinity : s.buf) !== sp.buf[i]) problems.push(`묶음 ${ir.keys[i]} 의 부피·완충 값이 시나리오와 다름`); }
  const laws = ir.rules.map((R) => {
    const r = ix.ruleOf(R.ref), k = kinOf(R.ref), L = { ref: R.ref, k, kind: r ? r.type : null, cons: [], mods: [] };
    if (!r) { problems.push(`${R.ref}: db 에 없음`); return L; }
    const same = (a, b) => (a == null && b == null) || (a && b && ['law', 'k', 'half_life', 'order'].every((f) => a[f] === b[f]));
    if (!same(k, R.k)) problems.push(`${R.ref}: IR 속도 상수 ≠ db·시나리오`);
    if (r.type === 'supply') { const loc = r.where[0]; L.Vr = volL[loc] || 0; L.cons = r.consumes.map((q) => ({ i: at.get(`${q.ref}|${loc}`), n: q.n, sat: !!q.saturating })); if (L.cons.some((q) => q.i == null)) problems.push(`${R.ref}: 소비 묶음이 IR 에 없음`); }
    else if (r.type === 'degradation') { const b = R.cons[0] && R.cons[0].b; if (!b || b.split('|')[0] !== R.ref.split('/rule/')[0]) problems.push(`${R.ref}: 분해 대상 묶음이 소유자의 것이 아님`); L.i = at.get(b); L.kdeg = k ? (k.k > 0 ? k.k : k.half_life > 0 ? Math.LN2 / k.half_life : 0) : 0; }
    else if (R.kind === 'step') {
      // 기전 단계 (MHC 실험): db 의 단계에서 반응 부피·법칙 입력·행위자·화학량을 다시 세움 (컴파일러 코드를 쓰지 않음)
      const st = db.steps[R.step];
      if (!st || st.rule !== R.ref) { problems.push(`${R.ref}: 단계 ${R.step} 가 이 규칙을 쓰지 않음`); return L; }
      L.kind = 'step'; L.dir = R.dir;
      const locs = [...st.agents, ...st.inputs, ...st.outputs].filter((p) => !p.minor).map((p) => p.b.split('|').pop());
      // 반응 부피: 첫 3D 위치, 없으면(막에서만 일어나는 단계) 부피가 주어진 첫 막 — 컴파일러의 규약과 같아야 한다
      const loc = locs.find((l) => M.VOCAB.locations[l] && M.VOCAB.locations[l].dim === '3D') || locs.find((l) => (volL[l] || 0) > 0) || locs[0];
      L.Vr = loc ? volL[loc] || 0 : 0;
      const sum = (list) => { const m = new Map(); for (const p of list) m.set(p.b, (m.get(p.b) || 0) + (p.n || 1)); return [...m].map(([b, n]) => ({ i: at.get(b), n, b })); };
      const ins = sum(st.inputs), outs = sum(st.outputs), want = R.dir === 'r' ? [outs, ins] : [ins, outs];
      const eq = (a, b) => a.length === b.length && a.every((q, j) => q.b === b[j].b && q.n === b[j].n);
      if (!eq(want[0], R.cons) || !eq(want[1], R.prods)) problems.push(`${R.ref} (${R.step} ${R.dir}): IR 화학량 ≠ 단계의 입력·출력`);
      const lawIn = sum(st.inputs.filter((p) => !p.minor)), lawOut = sum(st.outputs.filter((p) => !p.minor));
      L.lawIns = R.dir === 'r' ? lawOut : lawIn; L.agents = st.agents.map((p) => at.get(p.b));
      if (k && k.law === 'binding' && !['f', 'r'].includes(R.dir)) problems.push(`${R.ref}: 가역 결합의 방향 표시가 없음`);
    }
    else problems.push(`${R.ref}: 공급·분해·단계 규칙이 아님`);
    L.mods = (mods.get(R.ref) || []).map((m) => ({ i: at.get(`${m.owner}|${m.rule.at}`), effect: m.rule.effect, k: kinOf(m.ref) })).filter((m) => m.k);
    return L;
  });
  return { laws, sp, Ksat, problems };
}
// 사법부의 속도식 (이중수): rate_j(N; f) 의 값과 N_seed 방향 도함수
function rateDual(L, N, f, sp, Ksat, seed) {
  const conc = (i) => { const V = sp.V[i]; if (!(V > 0)) return D(0); const x = Math.max(0, N[i]) / (M.NA * V); return x >= sp.buf[i] ? D(sp.buf[i]) : D(x, i === seed && N[i] > 0 ? 1 / (M.NA * V) : 0); };
  if (!L.k) return D(0);
  if (L.kind === 'degradation') return L.kdeg > 0 ? dmul(D(L.kdeg * f), D(Math.max(0, N[L.i]), L.i === seed && N[L.i] > 0 ? 1 : 0)) : D(0);
  if (!L.Vr) return D(0);
  if (L.kind === 'step') {
    const cr = (i) => D(Math.max(0, N[i]) / (M.NA * L.Vr), i === seed && N[i] > 0 ? 1 / (M.NA * L.Vr) : 0), K = L.k;
    let v;
    if (K.law === 'michaelis_menten') { v = D(K.kcat * f * M.NA * L.Vr); for (const i of L.agents) v = dmul(v, cr(i)); if (L.lawIns.length) v = dmul(v, dsat(cr(L.lawIns[0].i), K.Km)); return v; }
    const kk = K.law === 'binding' ? (L.dir === 'r' ? K.k_off || (K.k_on && K.Kd ? K.k_on * K.Kd : 0) : K.k_on || (K.k_off && K.Kd ? K.k_off / K.Kd : 0)) : K.k;
    v = D(kk * f * M.NA * L.Vr);
    for (const q of L.lawIns) v = dmul(v, dpowr(cr(q.i), q.n));
    if (K.law === 'mass_action') for (const i of L.agents) v = dmul(v, cr(i));
    return v;
  }
  if (L.k.law === 'zero_order') return D(L.k.k * f * M.NA * L.Vr);
  if (L.k.law !== 'mass_action') return D(0);
  let v = D(L.k.k);
  for (const q of L.cons) v = dmul(v, q.sat ? dsat(conc(q.i), Ksat) : dpowr(conc(q.i), q.n));
  return dmul(v, D(f * M.NA * L.Vr));
}
// 사법부의 배율식 (이중수 — 힐을 기본 연산으로 미분)
function factorDual(L, N, sp, seed) {
  let f = D(1);
  for (const m of L.mods) {
    const V = sp.V[m.i]; let s = D(0);
    if (V > 0) { const x = Math.max(0, N[m.i]) / (M.NA * V); s = x >= sp.buf[m.i] ? D(sp.buf[m.i]) : D(x, m.i === seed && N[m.i] > 0 ? 1 / (M.NA * V) : 0); }
    const xn = dpowr(D(s.v / m.k.K, s.d / m.k.K), m.k.n), occ = D(xn.v / (1 + xn.v), xn.d / ((1 + xn.v) * (1 + xn.v)));
    const fmax = m.k.fmax != null ? m.k.fmax : 1, fmin = m.k.fmin != null ? m.k.fmin : 0;
    f = dmul(f, m.effect === 'activates' ? D(1 + (fmax - 1) * occ.v, (fmax - 1) * occ.d) : D(fmin + (1 - fmin) * (1 - occ.v), -(1 - fmin) * occ.d));
  }
  return f;
}
const rel = (a, b) => { const m = Math.max(Math.abs(a), Math.abs(b)); return m === 0 ? 0 : Math.abs(a - b) / m; };

function checkLU(ir) {
  const J = ir.jac, L = J.lu, n = J.active.length, problems = [];
  if (!L || !J.scatter) return { checked: 0, problems: ['IR 에 희소 LU 패턴(jac.lu·jac.scatter)이 없음'] };
  const seen = new Set(L.perm); if (L.perm.length !== n || seen.size !== n || L.perm.some((k) => !(k >= 0 && k < n)) || L.perm.some((k, r) => L.iperm[k] !== r)) problems.push('희소 LU 순서가 순열이 아님');
  // 값 위치 → 행: 미리 만든 표 (O(nnz)) — 선형 탐색이면 O(nnz·n) 으로 검증이 엔진보다 느려진다 (4단계 ②)
  const rowAt = new Int32Array(L.col.length).fill(-1); for (let r = 0; r < n; r++) for (let q = L.rowPtr[r]; q < L.rowPtr[r + 1]; q++) rowAt[q] = r;
  const rowOf = (pos) => (pos >= 0 && pos < rowAt.length ? rowAt[pos] : -1);
  const cols = Array.from({ length: n }, (_, r) => L.col.slice(L.rowPtr[r], L.rowPtr[r + 1]));
  let checked = 0;
  for (let r = 0; r < n; r++) {
    if (cols[r][L.diagPos[r] - L.rowPtr[r]] !== r) problems.push(`희소 LU 행 ${r} 의 대각 위치가 틀림`);
    if (cols[r].some((c, q) => q && c <= cols[r][q - 1])) problems.push(`희소 LU 행 ${r} 의 열이 정렬되지 않음`);
    const set = new Set(cols[r]);
    for (const k of cols[r]) if (k < r) for (const c of cols[k]) if (c > k && !set.has(c)) problems.push(`희소 LU 채움 누락: 행 ${r} 이 행 ${k} 의 열 ${c} 를 받아야 함`);
  }
  // 값 위치: 활성 규칙 k(원래 번호)의 도함수 항(묶음 i)마다 S[i] 의 (열 c, 화학량) 이 순서대로 (행 iperm[k], 열 iperm[c]) 자리를 가리켜야 한다
  J.active.forEach((j, k) => {
    for (const [kind, list] of [['rate', J.dRate[j]], ['factor', J.dFactor[j]]]) list.forEach((d, di) => {
      const sl = J.scatter[kind][k][di], want = J.S[d.i];
      if (!sl || sl.length !== 2 * want.length) { problems.push(`값 위치 목록 길이 틀림 (규칙 ${k} ${kind} ${di})`); return; }
      want.forEach(([c, co], q) => { const pos = sl[2 * q]; checked++; if (sl[2 * q + 1] !== co || rowOf(pos) !== L.iperm[k] || L.col[pos] !== L.iperm[c]) problems.push(`값 위치 틀림 (규칙 ${k} ${kind} ${di} 열 ${c})`); });
    });
    const dp = J.scatter.diag[k]; checked++; if (rowOf(dp) !== L.iperm[k] || L.col[dp] !== L.iperm[k]) problems.push(`대각 값 위치 틀림 (규칙 ${k})`);
  });
  return { checked, nnz: L.nnz, flops: L.flops, denseFlops: L.denseFlops, problems: problems.slice(0, 10) };
}

function verifyIR(db, ir, sc, opt) {
  db = M.normalize(db); sc = sc || {}; opt = Object.assign({ samples: 6, seed: 20261009 }, opt || {});
  const out = { tolerance: TOL, fdTolerance: FD_TOL, boundarySamples: 0, problems: [], rateWorst: 0, derivWorst: 0, factorWorst: 0, fdWorst: 0, missingDeps: [], samples: opt.samples, checked: 0 };
  const { hash, ...rest } = ir;
  out.hashOK = crypto.createHash('sha256').update(canon(rest)).digest('hex') === hash;
  if (!out.hashOK) out.problems.push('IR 해시가 내용과 다름 — 컴파일 뒤 바뀜(변조)');
  const { laws, sp, Ksat, problems } = lawsFromDB(db, ir, sc);
  out.problems.push(...problems);
  // 상태점 (고정 seed): 기본량 × 10^U(−2, 1), 완충 묶음은 상한에서 떨어뜨림, 힐 조절자는 자른 구간 위로
  let s = opt.seed >>> 0; const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const base = ir.keys.map((b) => { const a = (sc.amounts || {})[b], bf = (sc.buffered || {})[b]; return a > 0 ? a : bf ? bf.total : 1e6; });
  const smin = ir.coupling.hill_s_floor;
  // 상태점: 무작위 표본 + 꺾인 곳 경계 표본(완충 상한 바로 아래·위 — 한쪽 도함수가 테이프 명세와 맞는지; 한계 표 §5 #3)
  const states = [];
  for (let n = 0; n < opt.samples; n++) {
    const N = Float64Array.from(base, (b) => Math.max(1, b * Math.pow(10, rnd() * 3 - 2)));
    for (let i = 0; i < N.length; i++) {
      const V = sp.V[i]; if (!(V > 0)) continue;
      const c = N[i] / (M.NA * V);
      if (Number.isFinite(sp.buf[i]) && Math.abs(c / sp.buf[i] - 1) < 0.2) N[i] *= c < sp.buf[i] ? 0.5 : 2;
      if (N[i] / (M.NA * V) < 1e3 * smin) N[i] = 1e3 * smin * M.NA * V * (1 + rnd());
    }
    states.push({ N, boundary: false });
  }
  for (let i = 0; i < ir.keys.length; i++) if (Number.isFinite(sp.buf[i]) && sp.V[i] > 0 && states.length) for (const side of [1 - 1e-6, 1 + 1e-6]) {
    const N = Float64Array.from(states[0].N); N[i] = sp.buf[i] * side * M.NA * sp.V[i]; states.push({ N, boundary: true });
  }
  out.boundarySamples = states.filter((x) => x.boundary).length;
  for (const { N, boundary } of states) {
    for (let j = 0; j < ir.rules.length; j++) {
      const L = laws[j], f = 0.5 + 1.5 * rnd();
      const r0 = rateDual(L, N, f, sp, Ksat, -1).v, rt = runTape(ir.jac.rate[j], N, f, sp);
      out.rateWorst = Math.max(out.rateWorst, rel(r0, rt));
      const dep = new Set(ir.jac.dep[j]);
      for (let i = 0; i < N.length; i++) {
        const ad = rateDual(L, N, f, sp, Ksat, i).d;
        if (!dep.has(i)) { if (ad !== 0) out.missingDeps.push(`${ir.rules[j].ref} ∂/∂${ir.keys[i]}`); continue; }
        const tp = ir.jac.dRate[j].find((x) => x.i === i), tv = tp ? runTape(tp.t, N, f, sp) : 0;
        out.derivWorst = Math.max(out.derivWorst, rel(ad, tv)); out.checked++;
        // 중심 유한차분 (사법부 속도식)
        // 간격 h = ε^(1/3)·N (중심 차분의 반올림·절단 오차가 맞먹는 최적점), 오차 척도 = max(|도함수|, |rate|/N) (도함수의 자연 크기)
        if (boundary) continue; // 경계 바로 옆에서는 중심 차분이 꺾인 곳을 걸침 — 한쪽 도함수는 위의 자동미분 대비로 검사
        const h = 6.055454e-6 * Math.max(1, Math.abs(N[i])), Np = Float64Array.from(N), Nm = Float64Array.from(N); Np[i] += h; Nm[i] -= h;
        const fd = (rateDual(L, Np, f, sp, Ksat, -1).v - rateDual(L, Nm, f, sp, Ksat, -1).v) / (2 * h);
        const scale = Math.max(Math.abs(ad), Math.abs(r0) / Math.max(1, Math.abs(N[i])));
        out.fdWorst = Math.max(out.fdWorst, scale ? Math.abs(fd - ad) / scale : 0);
      }
      for (const { i, t } of ir.jac.dFactor[j]) { out.factorWorst = Math.max(out.factorWorst, rel(factorDual(L, N, sp, i).d, runTape(t, N, 1, sp))); out.checked++; }
      out.factorWorst = Math.max(out.factorWorst, rel(factorDual(L, N, sp, -1).v, runTape(ir.jac.factor[j], N, 1, sp)));
    }
  }
  out.missingDeps = [...new Set(out.missingDeps)];
  // 희소 LU 패턴 (3단계): 순서가 순열인지, 모든 J 항의 값 위치가 그 (행, 열) 자리인지, 채움이 행 소거에 닫혀 있는지 — 엔진이 믿는 구조를 따로 확인
  out.lu = checkLU(ir);
  for (const m of out.lu.problems) out.problems.push(m);
  out.ok = out.hashOK && !out.problems.length && !out.missingDeps.length && out.rateWorst <= TOL && out.derivWorst <= TOL && out.factorWorst <= TOL && out.fdWorst <= FD_TOL;
  return out;
}

module.exports = { verifyIR, checkLU, runTape, TOL, FD_TOL };
