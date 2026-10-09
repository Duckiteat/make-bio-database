// 운명 엔진 Rust/WASM 백엔드 어댑터 (행정부). docs/design/engine-port-roadmap.md 1단계
//
// engine/fate_engine.js 의 공통 앞단(설정·분류·결정 탐침 탐색·원자료 조립)이 부르는 백엔드다 — JS 백엔드(run)와 같은 모양을 돌려준다.
//   pack: IR(컴파일러) + 앞단이 정한 시작 상태·신호 일정·저장소 목록을 평평한 f64 덩어리로 (engine/rust/src/engine.rs Engine::new 와 같은 순서)
//   open: WASM 인스턴스 하나(자기 선형 메모리)를 만들고 fe_init 에서 모든 버퍼를 한 번 잡는다 — 이후 실행·탐침은 할당하지 않는다.
// 판정·파일 쓰기 없음. WASM 은 engine/rust/pkg/fate_core.wasm (engine/rust/build.sh 로 만들고 소스 해시를 옆 json 에 적는다).
'use strict';
const fs = require('fs');
const path = require('path');

const WASM = path.join(__dirname, 'rust', 'pkg', 'fate_core.wasm');
let compiled = null;
const wasmModule = () => compiled || (compiled = new WebAssembly.Module(fs.readFileSync(WASM)));
const EVENTS = [null, 'promote', 'demote_stiffness', 'demote_prefilter', 'cooldown'];
const BUF = { recT: 0, recN: 1, recLO: 2, recCum: 3, recSig: 4, recMeta: 5, snapT: 6, gateLog: 7, events: 8, stats: 9, runInfo: 10, resOut: 11, probeN: 12, finN: 13, finLO: 14, finCum: 15 };

function pack(a) {
  const { IR, N0, isMarker, sched, reservoirs, dt, tEnd, horizon, mode, CP, recordEvery } = a;
  const nB = IR.keys.length, nR = IR.rules.length, nF = IR.jac.fast.length, out = [];
  const P = (...x) => { for (const v of x) out.push(+v); };
  P(1, nB, nR, nF, sched.length, reservoirs.length, dt, tEnd, horizon, mode === 'fine' ? 1 : mode === 'implicit' ? 2 : 0,
    CP.explicit_fraction, CP.shock_threshold, CP.gate.K_up, CP.gate.K_down, CP.gate.M, CP.gate.W, CP.newton_tol, CP.newton_iters, 6.02214076e23, recordEvery, CP.nsub_margin);
  for (let i = 0; i < nB; i++) P(N0[i]);
  for (const s of IR.species) P(s.V);
  for (const s of IR.species) P(s.buf == null ? Infinity : s.buf);
  for (let i = 0; i < nB; i++) P(isMarker[i] ? 1 : 0);
  IR.rules.forEach((R, j) => {
    P(R.kind === 'degradation' ? 1 : 0, R.slow ? 1 : 0, R.k ? 1 : 0, R.kdeg, R.cons.length, R.prods.length);
    for (const q of R.cons) P(q.i, q.n);
    for (const q of R.prods) P(q.i, q.n);
    P(IR.jac.rate[j].length, ...IR.jac.rate[j], IR.jac.factor[j].length, ...IR.jac.factor[j]);
  });
  P(nF, ...IR.jac.fast);
  for (const j of IR.jac.fast) { const d = IR.jac.dRate[j]; P(d.length); for (const x of d) P(x.i, x.t.length, ...x.t); }
  for (let i = 0; i < nB; i++) { const s = IR.jac.S[i]; P(s.length); for (const [k, c] of s) P(k, c); }
  for (const s of sched) { P(s.i, s.list.length); for (const e of s.list) P(e.t, e.n); }
  P(...reservoirs);
  return Float64Array.from(out);
}

function open(a) {
  const blob = pack(a);
  const ex = new WebAssembly.Instance(wasmModule(), {}).exports;
  const ptr = ex.fe_stage(blob.length);
  new Float64Array(ex.memory.buffer, ptr, blob.length).set(blob);
  const rc = ex.fe_init();
  if (rc !== 0) throw new Error(`Rust 엔진 IR 덩어리 거부 (${rc})`);
  const initBytes = ex.memory.buffer.byteLength; // 이 뒤로 메모리가 자라면 안 된다 (JS 뷰 무효화 방지)
  const view = (id) => new Float64Array(ex.memory.buffer, ex.fe_ptr(id), ex.fe_len(id));
  const copy = (id) => Float64Array.from(view(id));
  const nB = a.IR.keys.length, nR = a.IR.rules.length, nS = a.sched.length, keys = a.IR.keys;
  return {
    memory: { initBytes, bytes: () => ex.memory.buffer.byteLength },
    main() {
      ex.fe_run_main();
      const t = copy(BUF.recT), N = copy(BUF.recN), LO = copy(BUF.recLO), CUM = copy(BUF.recCum), SIG = copy(BUF.recSig), META = copy(BUF.recMeta);
      const series = Array.from(t, (tt, k) => {
        const cumDD = CUM.slice(k * 2 * nR, (k + 1) * 2 * nR);
        return { t: tt, N: N.slice(k * nB, (k + 1) * nB), path: META[4 * k] ? 'surrogate' : 'fv', nsub: META[4 * k + 1], gate: META[4 * k + 2] ? 'PROMOTED' : 'FV_ONLY', event: EVENTS[META[4 * k + 3]],
          sig: Array.from(SIG.slice(k * nS, (k + 1) * nS)), lo: LO.slice(k * nB, (k + 1) * nB), cumDD, cum: Float64Array.from({ length: nR }, (_, r) => cumDD[2 * r] + cumDD[2 * r + 1]) };
      });
      const ev = copy(BUF.events), events = [];
      for (let k = 0; k < ev.length; k += 3) events.push({ t: ev[k], type: ev[k + 1] ? 'regenerated' : 'exhausted', bundle: keys[ev[k + 2]] });
      const lg = copy(BUF.gateLog), transitions = [];
      for (let k = 0; k < lg.length; k += 3) transitions.push({ step: lg[k], ev: EVENTS[lg[k + 1]], Nsub: lg[k + 2] });
      const ri = copy(BUF.runInfo), gs = ri.slice(6, 14);
      const pathObj = { fv: ri[0], surrogate: ri[1], fv_shock: ri[2] }; if (ri[3]) pathObj.fv_newton = ri[3];
      const ro = copy(BUF.resOut), resv = new Map();
      a.reservoirs.forEach((i, r) => resv.set(i, { start: ro[5 * r], min: ro[5 * r + 1], state: ro[5 * r + 3] ? 'ok' : 'empty', watch: !!ro[5 * r + 4] }));
      const lastMeta = META.length ? META[META.length - 2] : 0;
      return { N: copy(BUF.finN), lo: copy(BUF.finLO), cum: copy(BUF.finCum), series, events, path: pathObj, nsub: { min: ri[4], max: ri[5] }, resv,
        gate: { state: lastMeta ? 'PROMOTED' : 'FV_ONLY', stats: { promotions: gs[0], demotions: gs[1], forced: gs[2], prefilterTrips: gs[3], oodTrips: gs[4], cooldownSteps: gs[5], fvSteps: gs[6], surSteps: gs[7], transitions } } };
    },
    snapshots() { return Array.from(copy(BUF.snapT), (t) => ({ t })); },
    probe(k) { if (ex.fe_probe(k) !== 0) throw new Error(`탐침 스냅숏 ${k} 없음`); return copy(BUF.probeN); },
    stats() { const s = copy(BUF.stats); return { newton: s[0], newtonFail: s[1], substeps: s[2], implicitSteps: s[3], explicitSteps: s[4], residEvals: s[5], jacEvals: s[6] }; },
  };
}

module.exports = { open, pack, WASM };
