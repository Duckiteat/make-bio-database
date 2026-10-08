// Phase P4 — 보수적 비동기 대체(fallback) 실행기. OOD 로 대리 출력을 버린 단계를 P3 FV 로 다시 푼다.
//   inline : 그 자리에서 FV.integrate (결정론, 기본)
//   worker : worker_threads 일꾼이 SharedArrayBuffer 위의 장을 FV 로 적분. 주 스레드는 그동안 다른 모델(T2 노드 SSA 등)의 사건을 계속 처리하고,
//            영역의 다음 사건(t + Δt_safe)에서 join(Atomics.wait) 한다. 원장은 join 때만 바뀐다(reconcile) — 일꾼은 원장을 만지지 않음.
//   잠금: submit 시각 t 에서 영역의 lookahead 창을 [t, t + Δt_safe] 로 묶는다 → 영향받는 모델은 t + Δt_safe 까지만 진행(보수적), 롤백 없음.
'use strict';
const { Worker, isMainThread, parentPort } = require('worker_threads');
const path = require('path');

if (!isMainThread && parentPort) {
  // ===== 일꾼 쪽 =====
  const FV = require('./fv_solver.js');
  const cache = new Map();
  parentPort.on('message', (msg) => {
    const { id, spec, dt, fieldBufs, ctrlBuf, outBuf, reactionKeys } = msg;
    let region = cache.get(id);
    if (!region) { region = FV.createRegion(spec, {}); cache.set(id, region); }
    for (const [k, buf] of Object.entries(fieldBufs)) region.fields[k] = new Float64Array(buf); // 공유 메모리 위에서 바로 적분
    const r = FV.integrate(region, dt), out = new Float64Array(outBuf), ctrl = new Int32Array(ctrlBuf);
    reactionKeys.forEach((k, i) => { out[i] = r.moved[k] || 0; });
    out[reactionKeys.length] = r.substeps;
    Atomics.store(ctrl, 0, 1); Atomics.notify(ctrl, 0);
  });
} else {
  const FV = require('./fv_solver.js');
  function createFallbackExecutor(opt) {
    opt = Object.assign({ mode: 'inline' }, opt || {});
    let worker = null;
    const stats = { submitted: 0, joined: 0, waitMs: 0, mode: opt.mode };
    if (opt.mode === 'worker') { worker = new Worker(path.join(__dirname, 'async_fallback_worker.js')); worker.unref(); }
    function submit(region, dt, regionId) {
      stats.submitted++;
      if (opt.mode !== 'worker') { const r = FV.integrate(region, dt); return { done: true, result: r, region }; }
      const keys = Object.keys(region.fields), fieldBufs = {}, reactionKeys = (region.spec.reactions || []).map((r) => `${r.from}>${r.to}`);
      for (const k of keys) { const sab = new SharedArrayBuffer(region.fields[k].length * 8); new Float64Array(sab).set(region.fields[k]); fieldBufs[k] = sab; }
      const ctrlBuf = new SharedArrayBuffer(4), outBuf = new SharedArrayBuffer((reactionKeys.length + 1) * 8);
      worker.postMessage({ id: regionId || 'region', spec: region.spec, dt, fieldBufs, ctrlBuf, outBuf, reactionKeys });
      return { done: false, region, fieldBufs, ctrl: new Int32Array(ctrlBuf), out: new Float64Array(outBuf), reactionKeys };
    }
    function join(job) {
      stats.joined++;
      if (job.done) return job.result;
      const t0 = Date.now();
      while (Atomics.load(job.ctrl, 0) === 0) Atomics.wait(job.ctrl, 0, 0, 1000);
      stats.waitMs += Date.now() - t0;
      for (const [k, buf] of Object.entries(job.fieldBufs)) job.region.fields[k].set(new Float64Array(buf));
      const moved = {}; job.reactionKeys.forEach((k, i) => { moved[k] = job.out[i]; });
      const substeps = job.out[job.reactionKeys.length]; job.region.stats.substeps += substeps;
      return { moved, substeps };
    }
    function close() { if (worker) { worker.terminate(); worker = null; } }
    return { submit, join, close, stats };
  }
  module.exports = { createFallbackExecutor };
}
