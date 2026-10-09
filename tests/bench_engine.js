#!/usr/bin/env node
// 0단계 기준선 측정 (docs/design/engine-port-roadmap.md §0) — Rust/WASM 이식과 기호 야코비안의 이득을 판정할 기준.
//   운명 엔진: 본 실행 대 결정 탐침 시간 · 뉴턴 반복 · 유한차분 잔차 비중(반복마다 잔차 1 + 빠른 규칙 수 nF) · 뉴턴 실패 → 명시 대체 부분 단계
//   (0.5단계의 유한차분 대 해석적 비교 결과는 docs/design/engine-port-roadmap.md §4 에 기록 — 유한차분 경로는 판정 뒤 제거)
//   simulateRate: 준비(정규화·색인·조립) 대 적분 루프
// 실행: node tests/bench_engine.js [--repeat 3]   (쓰기 없음 — 표를 콘솔에)
'use strict';
const { readFileSync } = require('fs');
const path = require('path');
const C = require('../core.js');
const F = require('../engine/fate_engine.js');

const ROOT = path.join(__dirname, '..');
const db = C.normalize(JSON.parse(readFileSync(path.join(ROOT, 'data/db.json'), 'utf8')));
const rep = +(process.argv[process.argv.indexOf('--repeat') + 1] || 3) || 3;
const scen = (f) => JSON.parse(readFileSync(path.join(ROOT, 'examples/scenarios', f), 'utf8'));
const best = (f) => { let ms = Infinity, r; for (let i = 0; i < rep; i++) { const t0 = process.hrtime.bigint(); r = f(); ms = Math.min(ms, Number(process.hrtime.bigint() - t0) / 1e6); } return { r, ms }; };

function fateRows() {
  const rows = [];
  for (const name of ['effector-il12', 'memory-il15', 'effector-glucose-withheld', 'mixed-optimal']) {
    const sc = scen(`fate-${name}-hypothetical.json`);
    const main = best(() => F.simulateFate(db, 'D000174', { scenario: sc, commitment: false }));
    const full = best(() => F.simulateFate(db, 'D000174', { scenario: sc }));
    const s = main.r.stats, nF = main.r.rules.filter((x) => x.layer === 'fast' && x.active).length;
    rows.push({ name, mainMs: main.ms, fullMs: full.ms, probeShare: 1 - main.ms / full.ms, probes: full.r.stats.probes, newton: s.newton, perStep: s.newton / Math.max(1, s.implicitSteps), nF, residPerIter: s.residEvals / Math.max(1, s.newton), fail: s.newtonFail, substeps: s.substeps });
  }
  return rows;
}
function rateRows() {
  const rows = [];
  const pid = (re) => Object.keys(db.senses).find((k) => db.senses[k].kind === 'pathway' && re.test(db.terms[db.senses[k].term].names.ko));
  for (const [label, re, f, t, dt] of [['시트르산 회로', /시트르산 회로/, 'tca-acetylcoa-exhaustion-hypothetical.json', 60, 0.01], ['LPS → NF-κB', /NF-κB|TLR4/, 'lps-hypothetical.json', 60, 0.01]]) {
    const p = pid(re); if (!p) continue;
    const sc = scen(f), setup = best(() => C.simulateRate(db, p, { scenario: sc, t_end: dt, dt })), all = best(() => C.simulateRate(db, p, { scenario: sc, t_end: t, dt }));
    rows.push({ label, steps: Math.round(t / dt), setupMs: setup.ms, loopMs: Math.max(0, all.ms - setup.ms), perStepUs: Math.max(0, all.ms - setup.ms) * 1000 / (t / dt) });
  }
  return rows;
}

function run() {
  const fr = fateRows(), rr = rateRows(), f = (x, d = 0) => x.toFixed(d);
  console.log(`0단계 기준선 (최솟값, ${rep}회) — 운명 엔진`);
  console.log('| 시나리오 | 본 실행 ms | 전체 ms | 탐침 비중 | 탐침 | 뉴턴 반복 | 반복/단계 | nF | 잔차/반복 | 뉴턴 실패 | 명시 부분 단계 |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of fr) console.log(`| ${r.name} | ${f(r.mainMs)} | ${f(r.fullMs)} | ${f(r.probeShare * 100)}% | ${r.probes} | ${r.newton} | ${f(r.perStep, 1)} | ${r.nF} | ${f(r.residPerIter, 1)} | ${r.fail} | ${r.substeps} |`);
  console.log('\nsimulateRate');
  console.log('| 경로 | Δt 단계 | 준비 ms | 루프 ms | 단계당 µs |');
  console.log('|---|---|---|---|---|');
  for (const r of rr) console.log(`| ${r.label} | ${r.steps} | ${f(r.setupMs, 1)} | ${f(r.loopMs, 1)} | ${f(r.perStepUs, 2)} |`);
  return { fate: fr, rate: rr };
}
if (require.main === module) run();
module.exports = { run };
