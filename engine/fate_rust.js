// 운명 엔진 Rust/WASM 백엔드 어댑터 (행정부). docs/design/engine-port-roadmap.md 1·1.5·2단계
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
const BUF = { recT: 0, recN: 1, recLO: 2, recCum: 3, recSig: 4, recMeta: 5, snapT: 6, events: 7, stats: 8, runInfo: 9, resOut: 10, probeN: 11, finN: 12, finLO: 13, finCum: 14, snapN: 15, probeIn: 16 };

function pack(a) {
  const { IR, N0, sched, reservoirs, dt, tEnd, horizon, CP, recordEvery } = a;
  const nB = IR.keys.length, nR = IR.rules.length, nA = IR.jac.active.length, out = [];
  const P = (...x) => { for (const v of x) out.push(+v); };
  const tapes = (list) => { P(list.length); for (const x of list) P(x.i, x.t.length, ...x.t); };
  P(3, nB, nR, nA, sched.length, reservoirs.length, dt, tEnd, horizon, CP.rtol, CP.atol, CP.h0, CP.h_min, CP.safety, CP.fac_min, CP.fac_max, CP.neg_shrink, CP.pivot_rel, 6.02214076e23, recordEvery);
  for (let i = 0; i < nB; i++) P(N0[i]);
  for (const s of IR.species) P(s.V);
  for (const s of IR.species) P(s.buf == null ? Infinity : s.buf);
  IR.rules.forEach((R, j) => {
    P(R.cons.length, R.prods.length);
    for (const q of R.cons) P(q.i, q.n);
    for (const q of R.prods) P(q.i, q.n);
    P(IR.jac.rate[j].length, ...IR.jac.rate[j], IR.jac.factor[j].length, ...IR.jac.factor[j]);
    tapes(IR.jac.dRate[j]); tapes(IR.jac.dFactor[j]);
  });
  P(nA, ...IR.jac.active);
  for (let i = 0; i < nB; i++) { const s = IR.jac.S[i]; P(s.length); for (const [k, c] of s) P(k, c); }
  for (const s of sched) { P(s.i, s.list.length); for (const e of s.list) P(e.t, e.n); }
  P(...reservoirs);
  // 3단계 희소 LU: 활성 규칙마다 대각 위치와 도함수 항별 [위치, 화학량] 목록, 그다음 패턴(순서·행 시작·열·대각 위치)
  const SC = IR.jac.scatter, LU = IR.jac.lu;
  for (let k = 0; k < nA; k++) { P(SC.diag[k]); for (const lists of [SC.rate[k], SC.factor[k]]) for (const l of lists) P(l.length / 2, ...l); }
  P(LU.nnz, ...LU.perm, ...LU.rowPtr, ...LU.col, ...LU.diagPos);
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
        return { t: tt, N: N.slice(k * nB, (k + 1) * nB), steps: META[2 * k], rejects: META[2 * k + 1],
          sig: Array.from(SIG.slice(k * nS, (k + 1) * nS)), lo: LO.slice(k * nB, (k + 1) * nB), cumDD, cum: Float64Array.from({ length: nR }, (_, r) => cumDD[2 * r] + cumDD[2 * r + 1]) };
      });
      const ev = copy(BUF.events), events = [];
      for (let k = 0; k < ev.length; k += 3) events.push({ t: ev[k], type: ev[k + 1] ? 'regenerated' : 'exhausted', bundle: keys[ev[k + 2]] });
      const ri = copy(BUF.runInfo);
      const ro = copy(BUF.resOut), resv = new Map();
      a.reservoirs.forEach((i, r) => resv.set(i, { start: ro[5 * r], min: ro[5 * r + 1], state: ro[5 * r + 3] ? 'ok' : 'empty', watch: !!ro[5 * r + 4] }));
      const integrator = { method: 'rodas3', rtol: a.CP.rtol, atol: a.CP.atol, steps: ri[0], rejected: ri[1], rejectedNeg: ri[2], hMinHits: ri[3], h: { min: ri[4], max: ri[5] }, perInterval: { min: ri[6], max: ri[7] } };
      return { N: copy(BUF.finN), lo: copy(BUF.finLO), cum: copy(BUF.finCum), series, events, integrator, resv };
    },
    snapshots() { return Array.from(copy(BUF.snapT), (t) => ({ t })); },
    probe(k) { if (ex.fe_probe(k) !== 0) throw new Error(`탐침 스냅숏 ${k} 없음`); return copy(BUF.probeN); },
    // 2단계: 스냅숏 k 의 시작 상태(본 실행 뒤) · 넘겨받은 시작 상태에서 탐침 (다른 인스턴스 — 워커가 쓴다)
    snapState(k) { return Float64Array.from(view(BUF.snapN).subarray(k * nB, (k + 1) * nB)); },
    probeFrom(t0, N) { view(BUF.probeIn).set(N); ex.fe_probe_from(t0); return copy(BUF.probeN); },
    stats() { const s = copy(BUF.stats); return { rhs: s[0], jac: s[1], steps: s[2], rejected: s[3], rejectedNeg: s[4], hMinHits: s[5], singular: s[6] }; },
  };
}

module.exports = { open, pack, WASM };
