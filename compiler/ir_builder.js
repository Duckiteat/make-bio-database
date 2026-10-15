// 컴파일러 — 운명 계 IR 생성 (IR Builder). docs/design/engine-port-roadmap.md 0.5단계
//
// db + 시나리오 → 불변 IR. 순수 함수: 쓰기·판정·엔진 호출을 하지 않는다. 행정부(JS·Rust/WASM 엔진)는 이 IR 만 먹는다.
//   · 계 조립(assemble): 상태 집합 → 규칙(공급·분해)·조절·묶음·신호 (엔진에서 옮겨 옴, 같은 결과)
//   · 정수 번호: 묶음 → 0…nB−1, 규칙 → 0…nR−1 (엔진·FFI 는 문자열 키를 다루지 않는다)
//   · 기호 미분: 규칙마다 속도식 rate_j(N; f_j) 와 그 편도함수 ∂rate_j/∂N_i 를 수식 트리로 미분해 테이프(compiler/tape.js)로 낮춘다.
//     속도 테이프는 조절 배율 f_j(힐)를 FAC 로 받는다 — 배율식과 그 도함수(∂f_j/∂s)는 따로 둔다. 엔진의 전체 도함수는
//     ∂(f·g)/∂N_i = f·∂g/∂N_i (dRate, FAC = f) + g·∂f/∂N_i (dFactor × 배율 1 의 속도 g) — 1.5단계부터 배율을 고정하지 않는다.
//   · 희소 패턴: 활성 규칙 j 가 의존하는 묶음 목록 → 결합 Rosenbrock 야코비안 J = (∂rate/∂N)·S (진행량 좌표) 의 0 아닌 자리
//   · 해시: 정준 JSON 의 sha256 — 무결성 증명서의 입력 해시, 엔진 원자료의 irHash 와 맞춘다.
'use strict';
const crypto = require('crypto');
const M = require('../model.js');
const COUPLING = require('../engine/coupling.js');
const { OP } = require('./tape.js');
const SLU = require('./sparse_lu.js');

const V = M.VOCAB;
const FORMAT = 'definition-db-fate-ir', IR_VERSION = 3; // 2: 빠른 층 구조(fast·S) → 활성 규칙 전체(active·S) — 분할 없는 결합 적분 · 3: 희소 LU 기호 분석(jac.lu)·J 항의 값 위치(jac.scatter)

// ===== 계 조립: 상태들 → 규칙·묶음 =====
function assemble(db, sourceId, sc) {
  sc = sc || {};
  const ix = M.index(db), src = db.senses[sourceId];
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
  const rules = [], gaps = [], facts = []; // facts: 관찰된 사실 (판정은 사법부)
  const bundles = new Set(markers.keys());
  for (const ref of ruleRefs) {
    const r = ix.ruleOf(ref);
    if (!r || r.type !== 'supply') { facts.push({ kind: 'not_supply', ref }); continue; }
    const loc = r.where[0], k = kinOf(ref);
    const cons = r.consumes.map((q) => ({ b: `${q.ref}|${loc}`, n: q.n, sat: !!q.saturating })), prods = r.produces.map((q) => ({ b: `${q.ref}|${loc}`, n: q.n }));
    for (const q of [...cons, ...prods]) bundles.add(q.b);
    if (!k) gaps.push(ref);
    rules.push({ ref, kind: 'supply', rule: r, loc, k, cons, prods, source: !!r.source });
  }
  // 기전 프로그램 (MHC 실험): 상태들의 mechanisms 경로에 속한 단계(part_of) → 반응 규칙. simulateRate 와 같은 법칙·같은 반응 부피 규약
  //   반응 부피 Vr = 단계 참여자(행위자 → 입력 → 출력, minor 제외) 중 첫 3D 위치의 부피 — 막(2D) 참여자의 농도도 Vr 로 센다 (simulateRate 의 근사와 같음)
  //   질량 작용 k·Π c(법칙 입력)^n·Π c(행위자) · 가역 결합 k_on·Π c(입력)^n 과 k_off·Π c(출력)^n 을 정·역 두 채널로 (확률 층의 성향 ≥ 0)
  //   미카엘리스–멘텐 kcat·Π c(행위자)·S/(Km + S) (S = 첫 법칙 입력). 화학량은 minor 를 포함한 입력·출력. 법칙 상수 없는 단계는 꺼짐(Kinetic_Gap)
  const mechs = new Set(states.flatMap((s) => (db.senses[s].mechanisms || []).map((m) => m.ref)));
  const stepIds = mechs.size ? Object.keys(db.steps).filter((sid) => (db.steps[sid].part_of || []).some((p) => mechs.has(p))).sort() : [];
  const volOf = (l) => { const v = (sc.volumes || {})[l]; return v && M.VOL[v.unit] ? v.value * M.VOL[v.unit] : 0; };
  const agg = (list) => { const m = new Map(); for (const p of list) m.set(p.b, (m.get(p.b) || 0) + (p.n || 1)); return [...m].map(([b, n]) => ({ b, n })); };
  for (const sid of stepIds) {
    const st = db.steps[sid], ref = st.rule, r = ix.ruleOf(ref);
    if (!r) { facts.push({ kind: 'step_rule_missing', ref, step: sid }); continue; }
    const parts = [...st.agents, ...st.inputs, ...st.outputs].filter((p) => !p.minor);
    // 반응 부피의 위치: 참여자 중 첫 3D 위치, 없으면(막에서만 일어나는 단계 — 소포 수송·막 안 조립) 첫 참여자의 막 — 그 막의 유효 부피는 시나리오 volumes 가 준다
    const locs = parts.map((p) => p.b.split('|').pop());
    const loc = locs.find((l) => V.locations[l] && V.locations[l].dim === '3D') || locs.find((l) => volOf(l) > 0) || locs[0] || null;
    let k = kinOf(ref);
    if (k && !['mass_action', 'binding', 'michaelis_menten'].includes(k.law)) { facts.push({ kind: 'step_law_unsupported', ref, step: sid, law: k.law }); k = null; }
    if (k && k.law === 'mass_action' && (k.k0 > 0 || Number.isFinite(k.dG0) || k.env)) { facts.push({ kind: 'step_law_unsupported', ref, step: sid, law: 'mass_action(TST·ΔG°)' }); k = null; }
    if (k && !(loc && volOf(loc) > 0)) { facts.push({ kind: 'step_volume_unknown', ref, step: sid, location: loc }); k = null; }
    if (!k) gaps.push(ref);
    const cons = agg(st.inputs), prods = agg(st.outputs), agents = st.agents.map((p) => p.b);
    const lawIns = agg(st.inputs.filter((p) => !p.minor)), lawOuts = agg(st.outputs.filter((p) => !p.minor));
    for (const b of [...cons, ...prods].map((q) => q.b).concat(agents)) bundles.add(b);
    rules.push({ ref, step: sid, dir: 'f', kind: 'step', rule: r, loc, k, cons, prods, agents, lawIns, lawOuts });
    if (k && k.law === 'binding') rules.push({ ref, step: sid, dir: 'r', kind: 'step', rule: r, loc, k, cons: prods, prods: cons, agents, lawIns: lawOuts, lawOuts: lawIns });
  }
  // 분해 규칙: 계 안 묶음마다 (위치·부위 조건 — 묶음의 부위:특징이 규칙의 when 과 맞아야 함)
  for (const b of [...bundles]) {
    const [base, loc] = [b.split('|')[0], b.split('|').pop()], d = db.senses[base];
    if (!d) continue;
    const feats = new Map(M.parseBundle(b).features.map((f) => [f.site, f.feature]));
    for (const r of d.rule) {
      if (r.type !== 'degradation' || !Object.entries(r.when).every(([s2, f]) => feats.get(s2) === f) || (r.where && !r.where.includes(loc))) continue;
      const ref = `${base}/rule/${r.id}`, k = kinOf(ref);
      if (!k) gaps.push(ref);
      if (r.recycle_to.length) facts.push({ kind: 'recycle_ignored', ref });
      rules.push({ ref, kind: 'degradation', rule: r, loc, k, cons: [{ b, n: 1 }], prods: [], lost: true });
    }
  }
  // 교란(build-plan 4, compiler/perturb.js): 시나리오 exclude_rules 의 규칙은 계에서 뺀다 — 묶음은 그대로 두어 기준 IR 과 번호가 같다
  const excl = new Set(sc.exclude_rules || []);
  for (let i = rules.length - 1; i >= 0; i--) if (excl.has(rules[i].ref)) { facts.push({ kind: 'excluded', ref: rules[i].ref }); rules.splice(i, 1); }
  // 조절: 계 안 규칙을 대상으로 하는 모든 조절 규칙 (조절자 묶음 = 소유자|at)
  const mods = M.modulationIndex(db), modGaps = [];
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
  return { ix, states, markers, rules, bundles: [...bundles], signals: [...signals], gaps: [...new Set(gaps)], modGaps: [...new Set(modGaps)], facts, kinOf };
}

// ===== 수식 트리 · 기호 미분 · 단순화 =====
const num = (v) => ({ op: 'num', v });
const isNum = (e, v) => e.op === 'num' && (v == null || e.v === v);
function mul(...args) {
  let c = 1; const rest = [];
  for (const a of args.flat()) { if (isNum(a)) c *= a.v; else if (a.op === 'mul') { for (const b of a.args) if (isNum(b)) c *= b.v; else rest.push(b); } else rest.push(a); }
  if (c === 0) return num(0);
  if (!rest.length) return num(c);
  const out = c === 1 ? rest : [num(c), ...rest];
  return out.length === 1 ? out[0] : { op: 'mul', args: out };
}
function add(...args) {
  const rest = args.flat().filter((a) => !isNum(a, 0));
  return !rest.length ? num(0) : rest.length === 1 ? rest[0] : { op: 'add', args: rest };
}
// d e / d N_i
function diff(e, i) {
  switch (e.op) {
    case 'num': case 'fac': return num(0);
    case 'conc': return e.i === i ? { op: 'dconc', i } : num(0);
    case 'cnt': return e.i === i ? { op: 'dcnt', i } : num(0);
    case 'mul': return add(e.args.map((a, k) => mul(diff(a, i), ...e.args.filter((_, q) => q !== k))));
    case 'add': return add(e.args.map((a) => diff(a, i)));
    case 'pow': return mul({ op: 'dpow', x: e.x, n: e.n }, diff(e.x, i));
    case 'sat': return mul({ op: 'dsat', x: e.x, K: e.K }, diff(e.x, i));
    case 'hill': return mul({ ...e, op: 'dhill' }, diff(e.x, i));
    default: throw new Error(`미분할 수 없는 노드 ${e.op}`);
  }
}
function deps(e, out) {
  out = out || new Set();
  if (e.op === 'conc' || e.op === 'cnt') out.add(e.i);
  for (const a of e.args || []) deps(a, out);
  if (e.x) deps(e.x, out);
  return out;
}
// 테이프로 낮추기 (후위 순서)
function lower(e, t) {
  t = t || [];
  switch (e.op) {
    case 'num': t.push(OP.CONST, e.v); break;
    case 'fac': t.push(OP.FAC); break;
    case 'conc': t.push(OP.CONC, e.i); break;
    case 'dconc': t.push(OP.DCONC, e.i); break;
    case 'cnt': t.push(OP.CNT, e.i); break;
    case 'dcnt': t.push(OP.DCNT, e.i); break;
    case 'mul': case 'add': e.args.forEach((a, k) => { lower(a, t); if (k) t.push(e.op === 'mul' ? OP.MUL : OP.ADD); }); break;
    case 'pow': lower(e.x, t); t.push(OP.POW, e.n); break;
    case 'dpow': lower(e.x, t); t.push(OP.DPOW, e.n); break;
    case 'sat': lower(e.x, t); t.push(OP.SAT, e.K); break;
    case 'dsat': lower(e.x, t); t.push(OP.DSAT, e.K); break;
    case 'hill': lower(e.x, t); t.push(OP.HILL, e.e, e.K, e.n, e.fmax, e.fmin); break;
    case 'dhill': lower(e.x, t); t.push(OP.DHILL, e.e, e.K, e.n, e.fmax, e.fmin, e.smin); break;
    default: throw new Error(`낮출 수 없는 노드 ${e.op}`);
  }
  return t;
}
// 사람이 읽는 수식 (보고서·디버그)
function show(e, key) {
  const k = (i) => (key ? key[i] : `#${i}`);
  switch (e.op) {
    case 'num': return String(+e.v.toPrecision(6)); case 'fac': return 'f';
    case 'conc': return `c(${k(e.i)})`; case 'dconc': return `∂c(${k(e.i)})`; case 'cnt': return `N(${k(e.i)})`; case 'dcnt': return `∂N(${k(e.i)})`;
    case 'mul': return e.args.map((a) => (a.op === 'add' ? `(${show(a, key)})` : show(a, key))).join('·'); case 'add': return e.args.map((a) => show(a, key)).join(' + ');
    case 'pow': return `${show(e.x, key)}^${e.n}`; case 'dpow': return `${e.n}·${show(e.x, key)}^${e.n - 1}`;
    case 'sat': return `sat(${show(e.x, key)}; ${e.K})`; case 'dsat': return `dsat(${show(e.x, key)}; ${e.K})`;
    case 'hill': return `hill${e.e ? '+' : '−'}(${show(e.x, key)})`; case 'dhill': return `dhill${e.e ? '+' : '−'}(${show(e.x, key)})`;
    default: return e.op;
  }
}

// 정준 JSON (키 정렬) — 해시용
const canon = (o) => (Array.isArray(o) ? `[${o.map(canon).join(',')}]` : o && typeof o === 'object' ? `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => JSON.stringify(k) + ':' + canon(o[k])).join(',')}}` : JSON.stringify(o));
const irHash = (ir) => { const { hash, ...rest } = ir; return crypto.createHash('sha256').update(canon(rest)).digest('hex'); };
const kdegOf = (k) => (k ? (k.k > 0 ? k.k : k.half_life > 0 ? Math.LN2 / k.half_life : 0) : 0);

// ===== IR =====
function buildFateIR(db, sourceId, sc, params) {
  db = M.normalize(db); sc = sc || {};
  const A = assemble(db, sourceId, sc);
  if (A.error) return { error: A.error };
  const CP = COUPLING.resolve(sc, params), Ksat = CP.saturation_K, smin = CP.hill_s_floor;
  const keys = A.bundles, at = new Map(keys.map((b, i) => [b, i]));
  const volL = {}; for (const [l, v] of Object.entries(sc.volumes || {})) if (M.VOL[v.unit]) volL[l] = v.value * M.VOL[v.unit];
  const species = keys.map((b) => { const bf = (sc.buffered || {})[b]; return { b, V: volL[b.split('|').pop()] || 0, buf: bf ? bf.conc_M : null }; });
  const rules = A.rules.map((R) => ({
    ref: R.ref, kind: R.kind, slow: !!R.slow, loc: R.loc, k: R.k, ...((sc.rule_scale || {})[R.ref] != null ? { scale: sc.rule_scale[R.ref] } : {}), source: !!R.source, lost: !!R.lost, Vr: volL[R.loc] || 0, kdeg: R.kind === 'degradation' ? kdegOf(R.k) : 0,
    cons: R.cons.map((q) => ({ b: q.b, i: at.get(q.b), n: q.n, sat: !!q.sat })), prods: R.prods.map((q) => ({ b: q.b, i: at.get(q.b), n: q.n })),
    mods: R.mods.map((m) => ({ ref: m.ref, owner: m.owner, b: m.b, i: at.get(m.b), effect: m.rule.effect, k: m.k })),
    ...(R.kind === 'step' ? { step: R.step, dir: R.dir, Vr: R.loc ? volL[R.loc] || 0 : 0, agents: R.agents.map((b) => at.get(b)), lawIns: R.lawIns.map((q) => ({ i: at.get(q.b), n: q.n })), lawOuts: R.lawOuts.map((q) => ({ i: at.get(q.b), n: q.n })) } : {}),
  }));
  // 속도식 rate_j(N; f) — 엔진 rate() 와 같은 법칙. 교란 inhibit 은 시나리오 rule_scale 의 배율을 곱한다 (사법부 derivative 가 같은 배율로 재구성)
  const rateExpr = (R) => (R.scale != null ? mul(num(R.scale), rateExpr0(R)) : rateExpr0(R));
  const rateExpr0 = (R) => {
    if (!R.k) return num(0);
    if (R.kind === 'degradation') return R.kdeg > 0 ? mul(num(R.kdeg), { op: 'cnt', i: R.cons[0].i }, { op: 'fac' }) : num(0);
    if (!R.Vr) return num(0);
    if (R.kind === 'step') {
      const cr = (i) => mul(num(1 / (M.NA * R.Vr)), { op: 'cnt', i }), K = R.k, scale = M.NA * R.Vr;
      if (K.law === 'michaelis_menten') return mul(num(K.kcat * scale), { op: 'fac' }, ...R.agents.map(cr), ...(R.lawIns.length ? [{ op: 'sat', x: cr(R.lawIns[0].i), K: K.Km }] : []));
      let kk = K.k;
      if (K.law === 'binding') kk = R.dir === 'f' ? K.k_on || (K.k_off && K.Kd ? K.k_off / K.Kd : 0) : K.k_off || (K.k_on && K.Kd ? K.k_on * K.Kd : 0);
      return mul(num(kk * scale), { op: 'fac' }, ...R.lawIns.map((q) => ({ op: 'pow', x: cr(q.i), n: q.n })), ...(K.law === 'mass_action' ? R.agents.map(cr) : []));
    }
    if (R.k.law === 'zero_order') return mul(num(R.k.k * M.NA * R.Vr), { op: 'fac' });
    if (R.k.law === 'mass_action') return mul(num(R.k.k * M.NA * R.Vr), { op: 'fac' }, ...R.cons.map((q) => (q.sat ? { op: 'sat', x: { op: 'conc', i: q.i }, K: Ksat } : { op: 'pow', x: { op: 'conc', i: q.i }, n: q.n })));
    return num(0);
  };
  // 조절 배율 f_j = Π 힐(c_m) — 힐 상수가 없는 조절은 배율 1 (엔진과 같음)
  const factorExpr = (R) => mul(R.mods.filter((m) => m.k).map((m) => ({ op: 'hill', x: { op: 'conc', i: m.i }, e: m.effect === 'activates' ? 1 : 0, K: m.k.K, n: m.k.n, fmax: m.k.fmax != null ? m.k.fmax : 1, fmin: m.k.fmin != null ? m.k.fmin : 0, smin })));
  const jac = { rate: [], dRate: [], factor: [], dFactor: [], dep: [], show: [] };
  for (const R of rules) {
    const re = rateExpr(R), fe = factorExpr(R), dr = [...deps(re)].sort((a, b) => a - b), df = [...deps(fe)].sort((a, b) => a - b);
    jac.rate.push(lower(re)); jac.factor.push(lower(fe)); jac.dep.push(dr);
    jac.dRate.push(dr.map((i) => ({ i, t: lower(diff(re, i)) })));
    jac.dFactor.push(df.map((i) => ({ i, t: lower(diff(fe, i)) })));
    jac.show.push(show(re, keys));
  }
  // 활성 규칙(속도 상수가 있는 규칙 — 두 층 모두)과 그 화학량 — 결합 적분 야코비안 J = (∂rate/∂N)·S 의 구조
  const active = rules.map((R, j) => j).filter((j) => rules[j].k);
  const S = keys.map(() => []); // 묶음 i → [[활성 규칙 위치 k, 화학량]]
  active.forEach((j, k) => { for (const q of rules[j].cons) S[q.i].push([k, -q.n]); for (const q of rules[j].prods) S[q.i].push([k, q.n]); });
  const nnz = active.reduce((t, j) => { const cols = new Set(); for (const i of new Set([...jac.dep[j], ...jac.dFactor[j].map((d) => d.i)])) for (const [k] of S[i]) cols.add(k); return t + cols.size; }, 0);
  // 희소 LU (3단계): M = I/(γh) − J 의 패턴 → 최소 차수 순서·채움 (compiler/sparse_lu.js). 엔진은 값 배열만 다룬다.
  const rowsM = active.map((j, k) => { const cols = new Set([k]); for (const d of [...jac.dRate[j], ...jac.dFactor[j]]) for (const [c] of S[d.i]) cols.add(c); return [...cols].sort((a, b) => a - b); });
  const L = SLU.symbolic(active.length, rowsM);
  // J 항의 값 위치: 활성 규칙 k 의 도함수 항 d(묶음 i)마다 [위치, 화학량, …] — 엔진은 vals[위치] −= ∂·화학량 (예전 밀집 조립과 같은 순서)
  const scat = (k, list) => list.map((d) => S[d.i].flatMap(([c, co]) => [L.posOf(k, c), co]));
  const scatter = { rate: active.map((j, k) => scat(k, jac.dRate[j])), factor: active.map((j, k) => scat(k, jac.dFactor[j])), diag: active.map((j, k) => L.diagPos[L.iperm[k]]) };
  const lu = { perm: L.perm, iperm: L.iperm, rowPtr: L.rowPtr, col: L.col, diagPos: L.diagPos, nnz: L.nnz, nnzA: L.nnzA, flops: L.flops, solveFlops: L.solveFlops, denseFlops: L.denseFlops };
  const ir = {
    format: FORMAT, version: IR_VERSION, source: sourceId, states: A.states, keys, markers: [...A.markers.keys()], signals: A.signals,
    species, rules, gaps: A.gaps, modGaps: A.modGaps, facts: A.facts, coupling: CP,
    jac: Object.assign(jac, { active, S, nnz, lu, scatter, sizes: { nB: keys.length, nR: rules.length, nA: active.length } }),
  };
  ir.hash = irHash(ir);
  return ir;
}

module.exports = { FORMAT, IR_VERSION, assemble, buildFateIR, irHash, canon, diff, lower, show, mul, add, num, deps };
