#!/usr/bin/env node
// Phase P4 성능·정확도 측정: 같은 초기 장(저주파 + 경계층)에서 P3 FV 와 P4 대리 모델(+탐지기)을 K 단계 진행해
// 단계당 시간(속도 향상)과 상대 L2 오차를 격자 n·거시 Δt 별로 표로 낸다. FV 부분 단계 수 ns = ⌈Δt / (0.4 h²/6D)⌉ 가 강성의 척도.
// 실행: node tests/p4_benchmark.js [--quick]
'use strict';
const FV = require('../engine/fv_solver.js'), FNO = require('../engine/fno_surrogate.js'), OOD = require('../engine/ood_detector.js');

function initField(R) {
  const n = R.n;
  for (const [key, f] of Object.entries(R.fields)) for (let p = 0; p < f.length; p++) {
    const i = Math.floor(p / (n * n)), j = Math.floor(p / n) % n, k = p % n;
    f[p] = key === 'A' ? 100 * (1 + 0.6 * Math.cos(Math.PI * i / n) * Math.cos(2 * Math.PI * j / n) + 0.3 * Math.exp(-((n - 1 - i) ** 2) / 4) + 0.2 * Math.sin(3 * k / n)) : 10;
  }
}
function case_(n, dt, K) {
  const spec = { n, h_m: 1e-7, template: 'box', species: { A: { D: 1e-12 }, B: { D: 5e-13 } }, reactions: [{ from: 'A', to: 'B', k: 5 }, { from: 'B', to: 'A', k: 2 }] };
  const a = FV.createRegion(spec, {}), b = FV.createRegion(spec, {});
  initField(a); initField(b);
  const tc0 = process.hrtime.bigint(), sur = FNO.createSurrogate(b, dt); FNO.calibrate(sur, b); const det = OOD.createDetector(); OOD.train(det, [b.fields.A, b.fields.B], n, b.mask);
  const trainMs = Number(process.hrtime.bigint() - tc0) / 1e6;
  let t = process.hrtime.bigint();
  for (let s = 0; s < K; s++) FV.integrate(a, dt);
  const fvMs = Number(process.hrtime.bigint() - t) / 1e6 / K;
  t = process.hrtime.bigint(); let flagged = 0;
  for (let s = 0; s < K; s++) {
    FNO.integrate(sur, b); const sp = sur.lastSpectra;
    const post = OOD.evaluate(det, b, sur, 'post', { E: { A: sp.A.E_out, B: sp.B.E_out } }); if (post.ood) flagged++;
    for (const f of Object.values(b.fields)) for (const q of b.active) if (!(f[q] > 0)) f[q] = 0;
  }
  const surMs = Number(process.hrtime.bigint() - t) / 1e6 / K;
  let num = 0, den = 0; for (const k of ['A', 'B']) for (let p = 0; p < a.fields[k].length; p++) { num += (a.fields[k][p] - b.fields[k][p]) ** 2; den += a.fields[k][p] ** 2; }
  return { n, N: n ** 3, dt, K, ns: FV.substepsFor(a, dt), fvMs, surMs, speedup: fvMs / surMs, l2: Math.sqrt(num / den), trainMs, flagged };
}
function run(opt) {
  opt = Object.assign({ quick: false, quiet: false }, opt || {});
  const cases = opt.quick ? [[16, 1e-3, 30], [16, 5e-2, 10], [32, 5e-2, 4]] : [[16, 1e-3, 100], [16, 1e-2, 40], [16, 5e-2, 20], [16, 2e-1, 10], [32, 1e-3, 20], [32, 1e-2, 10], [32, 5e-2, 4], [32, 2e-1, 2]];
  const rows = cases.map(([n, dt, K]) => case_(n, dt, K));
  if (!opt.quiet) {
    console.log('P4 측정 — 단계당 시간: FV(P3) 대 대리 모델 + 사후 탐지(P4), 같은 초기 장에서 K 단계 뒤 상대 L2 오차');
    console.log('   n      N      Δt(s)   FV ns   FV ms/단계   대리 ms/단계   속도 향상   L2 오차     학습 ms   OOD');
    for (const r of rows) console.log(`${String(r.n).padStart(4)} ${String(r.N).padStart(6)} ${r.dt.toExponential(0).padStart(9)} ${String(r.ns).padStart(6)} ${r.fvMs.toFixed(3).padStart(12)} ${r.surMs.toFixed(3).padStart(13)} ${(r.speedup.toFixed(1) + '×').padStart(10)}   ${r.l2.toExponential(2)}  ${r.trainMs.toFixed(0).padStart(8)}   ${r.flagged}`);
  }
  return rows;
}
if (require.main === module) run({ quick: process.argv.includes('--quick') });
module.exports = { run, case_ };
