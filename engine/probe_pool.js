// 결정 탐침 병렬화 (행정부, docs/design/engine-port-roadmap.md 2단계).
//
// 워커마다 독립 WASM 인스턴스 하나(engine/probe_worker.js). 호출 쪽(운명 엔진 앞단)은 동기 함수 그대로 — 일을 나눠 보내고
// 공유 제어 칸(SharedArrayBuffer)을 Atomics.wait 로 기다린다. 본 스레드도 한 몫(자기 인스턴스)을 맡는다.
//   lanes = 동시에 도는 탐침 수 (본 스레드 1 + 워커 lanes − 1). 탐침 q 는 lane q mod lanes 가 맡는다 (정적 배정).
//   탐침은 (시작 상태, t0) 의 순수 함수 → 결과는 lanes·배정과 무관하게 비트 단위로 같다 (tests/rust_engine.test.mjs ⑦).
// 판정·파일 쓰기 없음. 워커는 프로세스 종료를 막지 않는다(unref).
'use strict';
const { Worker } = require('worker_threads');
const os = require('os');
const path = require('path');

const TIMEOUT_MS = 10 * 60 * 1000;
let pool = null; // { workers, ctrl, errors }

function ensure(nWorkers) {
  if (pool && pool.workers.length >= nWorkers) return pool;
  if (pool) for (const w of pool.workers) w.terminate();
  const ctrl = new Int32Array(new SharedArrayBuffer(4 * Math.max(1, nWorkers)));
  const errors = [];
  const workers = Array.from({ length: nWorkers }, (_, slot) => {
    const w = new Worker(path.join(__dirname, 'probe_worker.js'), { workerData: { ctrl: ctrl.buffer, slot } });
    w.on('message', (m) => { if (m && m.error) errors[slot] = m.error; });
    w.unref();
    return w;
  });
  pool = { workers, ctrl, errors };
  return pool;
}

// 기본 lanes: 쓸 수 있는 코어 수
const defaultLanes = () => (typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length);

// 워커들에 일을 보내고(post) 끝날 때까지 동기로 기다린다 — work(lane) 은 본 스레드 몫
function dispatch(P, msgs, local) {
  const used = [];
  msgs.forEach((m, i) => { if (!m) return; Atomics.store(P.ctrl, i, 0); P.errors[i] = null; P.workers[i].postMessage(m); used.push(i); });
  if (local) local();
  for (const i of used) {
    const t0 = Date.now();
    while (Atomics.load(P.ctrl, i) === 0) {
      if (Atomics.wait(P.ctrl, i, 0, 1000) === 'timed-out' && Date.now() - t0 > TIMEOUT_MS) throw new Error(`탐침 워커 ${i} 응답 없음`);
    }
    if (Atomics.load(P.ctrl, i) < 0) throw new Error(`탐침 워커 ${i} 실패${P.errors[i] ? ': ' + P.errors[i] : ''}`);
  }
}

// 백엔드 하나(본 스레드의 Rust 인스턴스 be + 같은 열기 인자 args)에 병렬 탐침을 붙인다.
//   probeMany(starts: [{ t0, N }]) → 끝 상태 배열 (starts 순서)
function attach(be, args, lanes) {
  lanes = Math.max(1, Math.floor(lanes || defaultLanes()));
  if (lanes === 1) return { lanes, probeMany: (starts) => starts.map((s) => be.probeFrom(s.t0, s.N)) };
  const P = ensure(lanes - 1);
  const W = lanes - 1;
  let loaded = false;
  return {
    lanes,
    probeMany(starts) {
      const nb = args.N0.length, n = starts.length;
      if (n === 1) return [be.probeFrom(starts[0].t0, starts[0].N)];
      if (!loaded) { dispatch(P, Array.from({ length: W }, () => ({ type: 'load', args })), null); loaded = true; }
      const inp = new Float64Array(new SharedArrayBuffer(8 * n * nb)), out = new Float64Array(new SharedArrayBuffer(8 * n * nb));
      starts.forEach((s, q) => inp.set(s.N, q * nb));
      const t0 = starts.map((s) => s.t0), lane = (q) => q % lanes;
      const msgs = Array.from({ length: W }, (_, i) => { const tasks = []; for (let q = 0; q < n; q++) if (lane(q) === i + 1) tasks.push(q); return tasks.length ? { type: 'probe', inp: inp.buffer, out: out.buffer, t0, nb, tasks } : null; });
      dispatch(P, msgs, () => { for (let q = 0; q < n; q++) if (lane(q) === 0) out.set(be.probeFrom(t0[q], starts[q].N), q * nb); });
      return starts.map((_, q) => Float64Array.from(out.subarray(q * nb, (q + 1) * nb)));
    },
  };
}

module.exports = { attach, defaultLanes };
