#!/usr/bin/env node
// Phase P5 시험: 동적 승격·강등 관문 — 확산 계수 D(t) 를 Tier 1 환경 변화처럼 단계별로 바꿔 강성(N_sub)이 오르내리게 하고,
// 히스테리시스·냉각·사전 필터·전이 질량 협정과 5 불변식을 10,000 단계에서 확인한다.
// 실행: node tests/p5_dynamic_promotion.js [--steps 10000] [--every 1000]   (가상 값 — 엔진 시험용)
'use strict';
const HMSE = require('../engine/hmse.js'), FV = require('../engine/fv_solver.js'), DEVS = require('../engine/devs_scheduler.js'), GATE = require('../engine/p5_dynamic_gate.js');
const RT = 8.314462618 * 310.15;
// 단계 → D_A (B 는 절반). Δt 1e-3 s, h 1e-7 m: N_sub = ⌈15·D·1e11⌉
const PHASES = [
  { from: 0, to: 200, name: '워밍업 (FV, 학습)', D: () => 2e-12 },
  { from: 200, to: 2000, name: '비강성', key: 'nonstiff', D: () => 2e-12 },
  { from: 2000, to: 4500, name: '강성', key: 'stiff', D: () => 5e-11 },
  { from: 4500, to: 5500, name: '승격 중 히스테리시스 대역', key: 'hystP', D: (s, r) => 6e-12 + 6e-12 * r() },
  { from: 5500, to: 7500, name: '강성 + 충격', key: 'shock', D: () => 5e-11 },
  { from: 7500, to: 8500, name: '비강성 복귀', key: 'back', D: () => 2e-12 },
  { from: 8500, to: 9000, name: '적대적 교대', key: 'adv', D: (s) => (s % 2 ? 2e-11 : 2e-12) },
  { from: 9000, to: 1e9, name: '강등 중 히스테리시스 대역', key: 'hystD', D: (s, r) => 6e-12 + 3e-12 * r() },
];
// 정확도 비교용 압축 일정 (n=8): 워밍업 → 비강성 → 강성(+충격) → 비강성
const ACC_PHASES = [
  { from: 0, to: 200, name: '워밍업', D: () => 2e-12 }, { from: 200, to: 400, name: '비강성', D: () => 2e-12 },
  { from: 400, to: 1400, name: '강성 + 충격', D: () => 5e-11 }, { from: 1400, to: 1e9, name: '비강성', D: () => 2e-12 },
];
const phaseIn = (ph, s) => ph.find((p) => s >= p.from && s < p.to);
const phaseOf = (s) => phaseIn(PHASES, s);

function build(opt) {
  const ph = opt.phases || PHASES, n = opt.n || 16;
  const moieties = { A: { A: 1 }, B: { A: 1 }, Ax: { A: 1 }, AR: { A: 1, R: 1 }, R: { R: 1 } };
  const cfg = { domains: [{ id: 'node', tier: 'T2', location: 'cytosol', volume_fL: 1 }, { id: 'reg', tier: 'T3', location: 'cytosol', volume_fL: 4, geometry_template: 'box', grid: { n, h_m: 1e-7 } }],
    adjacency: [['node', 'reg']], metrics: { w1: 1, w2: 1, tau_high: 0.5, tau_low: 0.1, t_min: 0.01 }, solver: { epsilon_max: 1, fallback: 'fv3d', window_min_s: 1e-3 } };
  const handle = { state: HMSE.makeLedgerState(cfg, { reg: { A: 20000, B: 0 }, node: { A: 0, R: 500, AR: 0, Ax: 0 } }) };
  const region = FV.createRegion({ n, h_m: 1e-7, template: 'box', species: { A: { D: 2e-12 }, B: { D: 1e-12 } },
    reactions: [{ from: 'A', to: 'B', k: 5, dG0: -RT * Math.log(5 / 2) }, { from: 'B', to: 'A', k: 2 }] }, handle.state.ledgers.reg.counts);
  const rnd = HMSE.rngOf(99), sched = DEVS.createScheduler(handle, { mode: 'residual', seed: 11 });
  let shockAt = null; const hooks = [];
  const reg = DEVS.regionModel(handle, { id: 'reg', node: 'node', dt_macro: 1e-3, region, moieties, iface_species: opt.coupled ? ['A'] : [], D_iface: 1e-12, h_iface_m: 1e-7, nodeVolume_m3: 1e-18,
    solver: { mode: opt.mode, warmup: 200, profile: true, gate: { K_up: 15, K_down: 8, M: 5, W: 20 }, beforeStep: (m, R) => {
      const D = phaseIn(ph, m.steps).D(m.steps, rnd); R.spec.species.A.D = D; R.spec.species.B.D = D / 2; // Tier 1 환경 변화 → D(t)
      for (const h of hooks) h(m, R);
      if (m.steps === opt.shock && shockAt == null) { const f = R.fields.A, c = R.active[Math.floor(R.active.length / 2) + Math.floor(R.n / 2)]; let take = 0; for (const p of R.active) { const x = f[p] * 0.3; f[p] -= x; take += x; } f[c] += take; shockAt = m.steps; }
    } } });
  sched.add(reg, opt.coupled ? ['node'] : []);
  if (opt.coupled) sched.add(DEVS.nodeModel(handle, { id: 'node', moieties, dt_min: 2.5e-4, leap_threshold: 1, seed: 12, reactions: [
    { id: 'bind', reactants: { A: 1, R: 1 }, products: { AR: 1 }, k: 2e-3 }, { id: 'unbind', reactants: { AR: 1 }, products: { A: 1, R: 1 }, k: 0.5 },
    { id: 'activate', reactants: { A: 1 }, products: { Ax: 1 }, k: 5e2 }, { id: 'deactivate', reactants: { Ax: 1 }, products: { A: 1 }, k: 4e2 }] }), ['reg']);
  return { handle, region, sched, reg, moieties, shock: () => shockAt, addHook: (h) => hooks.push(h) };
}

function run(opt) {
  opt = Object.assign({ steps: 10000, every: 1000, quiet: false, shock: 6000 }, opt || {});
  const say = (...a) => { if (!opt.quiet) console.log(...a); };
  // ① 결합 동적 실행 (노드 포함) — 질량·관문 동작 ② 같은 일정의 FV 전용 결합 실행 — 단계별 시간 비교
  const dyn = build({ mode: 'dynamic', coupled: true, shock: opt.shock });
  // FV 전용 비교: 구간마다 그 구간의 실제 장·D 로 FV 한 단계(integrate + reconcile)를 복제본에서 재어 단계당 시간 (전 구간 FV 실행은 강성 구간에서 분 단위라 표본으로)
  const fvMsAt = {}, sampleFV = (m, R) => {
    const p = phaseOf(m.steps); if (!p.key || fvMsAt[p.key] != null || m.steps < p.from + 30) return;
    const clone = FV.createRegion({ ...R.spec, species: JSON.parse(JSON.stringify(R.spec.species)) }, {}); for (const [k, f] of Object.entries(R.fields)) clone.fields[k].set(f);
    const led = { state: HMSE.makeLedgerState({ domains: [{ id: 'x' }], adjacency: [] }, { x: Object.fromEntries(Object.entries(dyn.handle.state.ledgers.reg.counts)) }), domainId: 'x', moieties: dyn.moieties };
    // 같은 D 일정(단계별)으로 K 단계 — 교대·떨림 구간도 FV 전용이 실제로 치를 비용 그대로
    const K = 8, rl = HMSE.rngOf(5); let ms = 0;
    for (let i = 0; i < K; i++) { const D = p.D(m.steps + i, rl); clone.spec.species.A.D = D; clone.spec.species.B.D = D / 2; const t0 = process.hrtime.bigint(); FV.step(clone, 1e-3, led); ms += Number(process.hrtime.bigint() - t0) / 1e6; }
    fvMsAt[p.key] = ms / K;
  };
  dyn.addHook(sampleFV); // beforeStep 에서 표본 — 관문 경로와 무관한 복제본
  const M0 = HMSE.moietyTotals(dyn.handle.state, dyn.moieties);
  say(`P5 동적 관문 시험 — 상자 n=16, Δt 1e-3 s, K_up 15 / K_down 8 / M 5 / W 20, 충격 @ ${opt.shock}`);
  say('  step  단계 구간                              N_sub  상태      경로           ΣA      ΣR   |Σu−N|/N     승격 강등 강제');
  let last = -1, negSeen = 0;
  dyn.sched.run(Infinity, { stop: () => dyn.reg.steps >= opt.steps, afterEvent: () => {
    const r = dyn.reg;
    if (r.steps !== last && r.steps % opt.every === 0 && r.steps > 0) {
      last = r.steps; const M = HMSE.moietyTotals(dyn.handle.state, dyn.moieties), g = r.p5.gate, L = dyn.handle.state.ledgers.reg.counts;
      const dev = Math.max(...Object.keys(dyn.region.fields).map((k) => Math.abs(GATE.kahan(dyn.region.fields[k], dyn.region.active) - (L[k] || 0)) / Math.max(1, L[k] || 0)));
      for (const f of Object.values(dyn.region.fields)) for (const p of dyn.region.active) if (f[p] < 0) negSeen++;
      say(`${String(r.steps).padStart(6)}  ${phaseOf(r.steps - 1).name.padEnd(36)} ${String(r.p5.nsub[r.p5.nsub.length - 1] || '-').padStart(5)}  ${g.state.padEnd(9)} ${String(r.p5.path[r.p5.path.length - 1] || 'fv(warmup)').padEnd(14)} ${String(M.A).padStart(6)} ${String(M.R).padStart(6)}   ${dev.toExponential(1).padStart(8)}   ${String(g.stats.promotions).padStart(3)} ${String(g.stats.demotions).padStart(4)} ${String(g.stats.forced).padStart(4)}`);
    }
  } });

  const M1 = HMSE.moietyTotals(dyn.handle.state, dyn.moieties), g = dyn.reg.p5.gate, tr = g.stats.transitions, q = dyn.reg.p5;
  for (const f of Object.values(dyn.region.fields)) for (const p of dyn.region.active) if (f[p] < 0) negSeen++;
  // 단계 구간별 영역 풀이 시간 (동적 대 FV 전용)
  const phaseStats = PHASES.filter((p) => p.key && p.from < opt.steps).map((p) => {
    const idx = []; for (let s = Math.max(p.from, 200); s < Math.min(p.to, opt.steps); s++) idx.push(s);
    const mean = (a) => idx.reduce((x, s) => x + a[s], 0) / Math.max(1, idx.length);
    const paths = {}; for (const s of idx) { const k = q.path[s - 200]; paths[k] = (paths[k] || 0) + 1; }
    const fvMs = fvMsAt[p.key];
    return { name: p.name, key: p.key, from: p.from, to: p.to, dynMs: mean(dyn.reg.prof), fvMs, speedup: fvMs / mean(dyn.reg.prof), paths, nsub: [Math.min(...idx.map((s) => q.nsub[s - 200])), Math.max(...idx.map((s) => q.nsub[s - 200]))] };
  });
  const shock = dyn.shock(), afterShock = tr.filter((t) => t.step >= shock), firstDemote = afterShock.find((t) => t.ev.startsWith('demote')), repromote = afterShock.find((t) => t.ev === 'promote');
  const flips = (a, b) => tr.filter((t) => t.step >= a && t.step < b && (t.ev === 'promote' || t.ev.startsWith('demote'))).length;
  // ③ 정확도: 노드 없이 같은 일정(충격 포함)의 영역만 — 동적 대 FV 전용 상대 L2 (500 단계마다 최댓값)
  const accSteps = 1600, accD = build({ mode: 'dynamic', coupled: false, shock: 900, phases: ACC_PHASES, n: 8 }), accF = build({ mode: 'fv', coupled: false, shock: 900, phases: ACC_PHASES, n: 8 });
  let maxL2 = 0;
  for (let target = 100; target <= accSteps; target += 100) {
    accD.sched.run(Infinity, { stop: () => accD.reg.steps >= target }); accF.sched.run(Infinity, { stop: () => accF.reg.steps >= target });
    let num = 0, den = 0; for (const k of ['A', 'B']) for (const p of accD.region.active) { num += (accD.region.fields[k][p] - accF.region.fields[k][p]) ** 2; den += accF.region.fields[k][p] ** 2; }
    maxL2 = Math.max(maxL2, Math.sqrt(num / den));
  }
  const out = {
    steps: dyn.reg.steps, N_initial: M0.A + M0.R, N_final: M1.A + M1.R, massError: Math.abs(M0.A + M0.R - M1.A - M1.R), moietyExact: M0.A === M1.A && M0.R === M1.R,
    fieldParity: q.maxDev, promotionDrift: q.promotionDrift, negatives: negSeen, clipped: q.clipped, clippedMass: q.clippedMass, gainRefresh: q.gainRefresh,
    gate: { ...g.stats, transitions: tr.length }, shockAt: shock, shockDemote: firstDemote || null, repromote: repromote || null, phaseStats, maxL2,
    flipsHystPromoted: flips(4500, 5500), flipsAdversarial: flips(8500, 9000), flipsHystDemoted: flips(9000, opt.steps),
  };
  out.accuracyGate = accD.reg.p5.gate.stats;
  const ns = phaseStats.find((p) => p.key === 'nonstiff'), st = phaseStats.find((p) => p.key === 'stiff');
  out.pass = out.massError === 0 && out.moietyExact && out.fieldParity <= 1e-15 && out.negatives === 0 && out.maxL2 < 0.02
    && !!firstDemote && firstDemote.step === shock && repromote && repromote.step >= shock + 1 + 20 && ns.dynMs <= ns.fvMs * 1.25 && st.speedup >= 10
    && out.flipsHystPromoted === 0 && out.flipsAdversarial === 0 && out.flipsHystDemoted === 0;
  say('\n단계 구간별 영역 풀이 시간 (ms/단계): 동적 관문 대 FV 전용');
  say('  구간                                   N_sub      동적     FV 전용   속도 향상   경로');
  for (const p of phaseStats) say(`  ${p.name.padEnd(36)} ${(p.nsub[0] + '–' + p.nsub[1]).padStart(7)} ${p.dynMs.toFixed(3).padStart(9)} ${p.fvMs.toFixed(3).padStart(10)} ${(p.speedup.toFixed(1) + '×').padStart(10)}   ${JSON.stringify(p.paths)}`);
  say(`\n관문: 승격 ${g.stats.promotions}, 강등 ${g.stats.demotions} (강제 ${g.stats.forced}: 사전 필터 ${g.stats.prefilterTrips}, OOD ${g.stats.oodTrips}), 냉각 단계 ${g.stats.cooldownSteps}, 대리 ${g.stats.surSteps} / FV ${g.stats.fvSteps}, 이득 재계산 ${q.gainRefresh}`);
  say(`히스테리시스: 승격 중 대역(4500–5500) 전이 ${out.flipsHystPromoted}, 적대적 교대(8500–9000) 전이 ${out.flipsAdversarial}, 강등 중 대역(9000–) 전이 ${out.flipsHystDemoted}`);
  say(`충격 @ ${shock}: ${firstDemote ? `${firstDemote.ev} @ 단계 ${firstDemote.step} (같은 단계)` : '탐지 없음'} → 재승격 @ ${repromote ? repromote.step : '—'} (냉각 W=20 + 연속 M=5)`);
  say(`질량: N_initial ${out.N_initial} → N_final ${out.N_final} · |ΔN| = ${out.massError} · 장–원장 최대 상대 편차 ${out.fieldParity.toExponential(2)} (≤ 1e-15) · 승격 직전 드리프트 ${out.promotionDrift.toExponential(2)} · 음수 칸 ${negSeen} (잘라낸 값 ${q.clipped}개, 질량 ${q.clippedMass.toExponential(2)})`);
  say(`정확도 (노드 없이, n=8 압축 일정 1,600 단계: 비강성→강성+충격→비강성, 100 단계마다): 동적 대 FV 전용 최대 상대 L2 ${out.maxL2.toExponential(2)} (< 2%) · 그 실행의 대리 ${out.accuracyGate.surSteps} / FV ${out.accuracyGate.fvSteps} 단계`);
  say(out.pass ? '✓ PASS — 5 불변식 + 동적 효율 + 충격 회복' : '✗ FAIL');
  return out;
}
if (require.main === module) {
  const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
  const r = run({ steps: +arg('steps', 10000), every: +arg('every', 1000) });
  process.exit(r.pass ? 0 : 1);
}
module.exports = { run, build, PHASES, ACC_PHASES };
