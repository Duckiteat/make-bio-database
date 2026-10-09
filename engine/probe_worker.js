// 결정 탐침 워커 (행정부, 2단계). engine/probe_pool.js 가 띄운다 — 워커마다 자기 WASM 인스턴스(자기 선형 메모리)를 연다.
// 메시지: load(같은 IR·결합점으로 엔진 열기) · probe(넘겨받은 시작 상태들에서 탐침 → 공유 버퍼에 끝 상태). 끝나면 공유 제어 칸에 1(실패 -1)을 쓰고 깨운다.
// 판정·파일 쓰기 없음. 탐침은 (시작 상태, t0) 의 순수 함수라 어느 인스턴스에서 돌든 비트 단위로 같다.
'use strict';
const { parentPort, workerData } = require('worker_threads');
const RB = require('./fate_rust.js');

const ctrl = new Int32Array(workerData.ctrl), slot = workerData.slot;
let be = null;
parentPort.on('message', (m) => {
  let code = 1;
  try {
    if (m.type === 'load') be = RB.open(m.args);
    else if (m.type === 'probe') {
      const inp = new Float64Array(m.inp), out = new Float64Array(m.out), nb = m.nb;
      for (const q of m.tasks) out.set(be.probeFrom(m.t0[q], inp.subarray(q * nb, (q + 1) * nb)), q * nb);
    }
  } catch (e) { code = -1; parentPort.postMessage({ error: String(e && e.stack || e) }); }
  Atomics.store(ctrl, slot, code);
  Atomics.notify(ctrl, slot);
});
