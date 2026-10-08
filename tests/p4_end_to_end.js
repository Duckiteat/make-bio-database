#!/usr/bin/env node
// Phase P4 종단 시험: Tier 3 상자 영역을 스펙트럼 신경 연산자 대리 모델로, T2 노드는 P3 와 같이, 영역 10,000 단계.
// 중간(기본 5,000 단계)에 디랙 충격(영역 A 질량의 30% 를 한 칸으로 — 원장은 그대로)을 넣어 OOD 탐지 → 같은 단계 FV 대체를 확인하고,
// 원장 + 경계 버퍼 질량이 정확히 보존되는지(|ΔN| = 0) 본다. 실행: node tests/p4_end_to_end.js [--steps 10000] [--every 1000] [--fallback inline|worker] [--shock 5000]
// 모든 값은 가상(엔진 시험용)이다.
'use strict';
const HMSE = require('../engine/hmse.js'), FV = require('../engine/fv_solver.js'), DEVS = require('../engine/devs_scheduler.js'), AF = require('../engine/async_fallback_worker.js');
const RT = 8.314462618 * 310.15;

function run(opt) {
  opt = Object.assign({ steps: 10000, every: 1000, fallback: 'inline', shock: 5000, quiet: false, seed: 11, n: 16, warmup: 200, template: 'box' }, opt || {});
  const say = (...a) => { if (!opt.quiet) console.log(...a); };
  const moieties = { A: { A: 1 }, B: { A: 1 }, Ax: { A: 1 }, AR: { A: 1, R: 1 }, R: { R: 1 } };
  const cfg = { domains: [{ id: 'node', tier: 'T2', location: 'cytosol', volume_fL: 1 }, { id: 'reg', tier: 'T3', location: 'cytosol', volume_fL: 4, geometry_template: opt.template, grid: { n: opt.n, h_m: 1e-7 } }],
    adjacency: [['node', 'reg']], metrics: { w1: 1, w2: 1, tau_high: 0.5, tau_low: 0.1, t_min: 0.01 }, solver: { epsilon_max: 1, fallback: 'fv3d', window_min_s: 1e-3 } };
  const errs = HMSE.validateDomainConfig(cfg); if (errs.length) throw new Error(errs.join('; '));
  const handle = { state: HMSE.makeLedgerState(cfg, { reg: { A: 20000, B: 0 }, node: { A: 0, R: 500, AR: 0, Ax: 0 } }) };
  // 가역 쌍 A ⇄ B 에 ΔG° 를 붙여 열역학 표류 성분도 검사 (k_f/k_r = e^{−ΔG°/RT} 와 일치하게)
  const region = FV.createRegion({ n: opt.n, h_m: 1e-7, template: opt.template, species: { A: { D: 1e-12 }, B: { D: 5e-13 } },
    reactions: [{ from: 'A', to: 'B', k: 5, dG0: -RT * Math.log(5 / 2) }, { from: 'B', to: 'A', k: 2 }] }, handle.state.ledgers.reg.counts);
  const executor = AF.createFallbackExecutor({ mode: opt.fallback });
  let shockInjected = null;
  const sched = DEVS.createScheduler(handle, { mode: 'residual', seed: opt.seed });
  const dt = 1e-3;
  const reg = DEVS.regionModel(handle, { id: 'reg', node: 'node', dt_macro: dt, region, moieties, iface_species: ['A'], D_iface: 1e-12, h_iface_m: 1e-7, nodeVolume_m3: 1e-18,
    solver: { mode: 'surrogate', warmup: opt.warmup, executor, beforeStep: (m, R) => {
      if (m.steps === opt.shock && shockInjected == null) { // 디랙 충격: 질량 보존 재배치 (원장 불변)
        const f = R.fields.A, c = R.active[Math.floor(R.active.length / 2) + Math.floor(R.n / 2)]; let take = 0;
        for (const p of R.active) { const x = f[p] * 0.3; f[p] -= x; take += x; } f[c] += take; shockInjected = m.steps;
      } } } });
  const node = DEVS.nodeModel(handle, { id: 'node', moieties, dt_min: 2.5e-4, leap_threshold: 1, seed: opt.seed + 1, reactions: [
    { id: 'bind', reactants: { A: 1, R: 1 }, products: { AR: 1 }, k: 2e-3 }, { id: 'unbind', reactants: { AR: 1 }, products: { A: 1, R: 1 }, k: 0.5 },
    { id: 'activate', reactants: { A: 1 }, products: { Ax: 1 }, k: 5e2 }, { id: 'deactivate', reactants: { Ax: 1 }, products: { A: 1 }, k: 4e2 }] });
  sched.add(reg, ['node']); sched.add(node, ['reg']);
  const M0 = HMSE.moietyTotals(handle.state, moieties), worst = { field: 0, moiety: 0 };
  const audit = () => {
    const M = HMSE.moietyTotals(handle.state, moieties), L = handle.state.ledgers.reg.counts, T = FV.totals(region);
    const dF = Math.max(...Object.keys(T).map((k) => Math.abs(T[k] - (L[k] || 0)))), dM = Math.max(...Object.keys(M0).map((k) => Math.abs(M[k] - M0[k])));
    worst.field = Math.max(worst.field, dF); worst.moiety = Math.max(worst.moiety, dM); return { M, dF };
  };
  say(`P4 종단 시험 — 상자 영역 n=${opt.n} (N=${opt.n ** 3} 칸), 대리 모델(스펙트럼 연산자, 학습 ${opt.warmup} 단계) + OOD 탐지 + FV 대체(${opt.fallback}), 충격 @ ${opt.shock}`);
  say('  step      t(s)   reg.A   reg.B  node.A  node.Ax    ΣA    ΣR  |∫C−N|max  대리   FV  대체  S_ood(최근)');
  let last = -1;
  const t0 = Date.now();
  const res = sched.run(Infinity, { stop: () => reg.steps >= opt.steps, afterEvent: () => {
    if (reg.steps !== last && reg.steps % opt.every === 0) {
      last = reg.steps; const a = audit(), r = handle.state.ledgers.reg.counts, nn = handle.state.ledgers.node.counts, p = reg.p4;
      say(`${String(reg.steps).padStart(6)} ${reg.tLast.toFixed(3).padStart(9)} ${String(r.A).padStart(7)} ${String(r.B).padStart(7)} ${String(nn.A).padStart(7)} ${String(nn.Ax).padStart(8)} ${String(a.M.A).padStart(6)} ${String(a.M.R).padStart(5)}   ${a.dF.toExponential(2)} ${String(p.surrogateSteps).padStart(6)} ${String(p.fvSteps).padStart(4)} ${String(p.fallbacks).padStart(5)}  ${p.lastScore == null ? '—' : Number.isFinite(p.lastScore) ? p.lastScore.toFixed(3) : '∞'}`);
    } else if (sched.log.events % 97 === 0) audit();
  } });
  const wall = Date.now() - t0;
  executor.close();
  const a = audit(), p = reg.p4, after = p.flaggedAt.filter((f) => f.step >= (shockInjected ?? Infinity));
  const latency = shockInjected == null ? null : after.length ? after[0].step - shockInjected : Infinity;
  const NA0 = M0.A + M0.R, NAf = a.M.A + a.M.R;
  const out = { steps: reg.steps, t: res.t, wallMs: wall, surrogateSteps: p.surrogateSteps, fvSteps: p.fvSteps, fallbacks: p.fallbacks, fallbackRun: after.length ? after.findIndex((f, i) => i > 0 && f.step !== after[i - 1].step + 1) : 0,
    shockAt: shockInjected, latencySteps: latency, firstFlag: after[0] || null, maxInDistScore: p.maxScore, trainResidual: p.sur && p.sur.train.residual, detectorRef: p.det && p.det.ref, executor: executor.stats,
    final: { reg: { ...handle.state.ledgers.reg.counts }, node: { ...handle.state.ledgers.node.counts } }, lockWindows: p.lockWindows, unsupported: p.unsupported || null,
    N_initial: NA0, N_final: NAf, massError: Math.abs(NA0 - NAf), worstMoiety: worst.moiety, worstFieldLedger: worst.field,
    pass: Math.abs(NA0 - NAf) < 1 && worst.moiety === 0 && worst.field < 1e-6 && reg.steps >= opt.steps && (shockInjected == null || latency <= 1) };
  say(`\n결과: 영역 ${out.steps} 단계 (실제 ${wall} ms) — 대리 ${out.surrogateSteps} 단계, FV ${out.fvSteps} 단계 (학습 ${opt.warmup} + 대체 ${out.fallbacks})`);
  say(out.detectorRef && out.detectorRef.E != null ? `학습: 모드별 이득 최소 제곱 잔차 ${JSON.stringify(out.trainResidual)} · 탐지기 기준 E_ref ${out.detectorRef.E.toExponential(2)}, V_ref ${out.detectorRef.V.toFixed(2)} · 분포 안 최대 S_ood ${out.maxInDistScore.toFixed(3)}` : `대리 모델 없음 — ${out.unsupported} → 모든 단계 FV`);
  if (shockInjected != null) say(`충격 @ 단계 ${shockInjected}: 첫 탐지 단계 ${out.firstFlag && out.firstFlag.step} (지연 ${latency} 단계), S_ood ${out.firstFlag && (Number.isFinite(out.firstFlag.score) ? out.firstFlag.score.toFixed(1) : '∞')}, 이후 연속 대체 ${after.length} 단계 뒤 대리 모델 복귀 · 실행기 ${opt.fallback} (join 대기 ${executor.stats.waitMs} ms)`);
  say(`질량: N_initial ${NA0} → N_final ${NAf} · |ΔN| = ${out.massError} · 최악 부분 구조 편차 ${worst.moiety} · 최악 |∫C dΩ − N_ledger| ${worst.field.toExponential(2)}`);
  say(out.pass ? '✓ PASS — 질량 보존, OOD 탐지 ≤ 1 단계' : '✗ FAIL');
  return out;
}
if (require.main === module) {
  const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
  const r = run({ steps: +arg('steps', 10000), every: +arg('every', 1000), fallback: arg('fallback', 'inline'), shock: +arg('shock', 5000) });
  process.exit(r.pass ? 0 : 1);
}
module.exports = { run };
