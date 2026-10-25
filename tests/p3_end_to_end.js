#!/usr/bin/env node
// Phase P3 종단 시험: Tier 3 영역 1개(3차원 FV) + Tier 2 규칙 노드 1개를 Parallel-DEVS 로 결합해 영역 10,000 단계를 돌리고
// 모든 원장 + 경계 버퍼의 질량(부분 구조 A·R 총량)이 정확히 보존되는지(|N_initial − N_final| < 1) 확인한다.
// 실행: node tests/p3_end_to_end.js [--steps 10000] [--every 1000] [--mode residual|stochastic] [--template sphere]
// 모든 값은 가상(엔진 시험용)이다 — 생물학적 결론에 쓰지 않는다.
'use strict';
const HMSE = require('../engine/hmse.js'), FV = require('../engine/fv_solver.js'), DEVS = require('../engine/devs_scheduler.js');

function run(opt) {
  opt = Object.assign({ steps: 10000, every: 1000, mode: 'residual', template: 'sphere', quiet: false, seed: 11 }, opt || {});
  const say = (...a) => { if (!opt.quiet) console.log(...a); };
  // 부분 구조: A 단위(확산 리간드), R 단위(수용체). 복합체 AR = A + R, 활성형 Ax·영역 변형 B 도 A 한 단위
  const moieties = { A: { A: 1 }, B: { A: 1 }, Ax: { A: 1 }, AR: { A: 1, R: 1 }, R: { R: 1 } };
  const cfg = { domains: [{ id: 'node', tier: 'T2', location: 'cytosol', volume_fL: 1 }, { id: 'reg', tier: 'T3', location: 'cytosol', volume_fL: 0.5, geometry_template: opt.template, grid: { n: 8, h_m: 1e-7 } }],
    adjacency: [['node', 'reg']], metrics: { w1: 1, w2: 1, tau_high: 0.5, tau_low: 0.1, t_min: 0.01 }, solver: { epsilon_max: 0.05, fallback: 'fv3d', window_min_s: 1e-3 } };
  const errs = HMSE.validateDomainConfig(cfg); if (errs.length) throw new Error('영역 구성 오류: ' + errs.join('; '));
  const handle = { state: HMSE.makeLedgerState(cfg, { reg: { A: 20000, B: 0 }, node: { A: 0, R: 500, AR: 0, Ax: 0 } }) };
  const region = FV.createRegion({ n: 8, h_m: 1e-7, template: opt.template, velocity: opt.velocity || [2e-5, 0, 0],
    species: { A: { D: 1e-12 }, B: { D: 5e-13 } }, reactions: [{ from: 'A', to: 'B', k: 5 }, { from: 'B', to: 'A', k: 2 }] }, handle.state.ledgers.reg.counts, { integer: opt.integer !== false }); // 단계 1: 정수 장(기본 켬) — 재척도 없이 Σ칸 = N_ledger 정확
  const sched = DEVS.createScheduler(handle, { mode: opt.mode, seed: opt.seed });
  const dt = 1e-3;
  const reg = DEVS.regionModel(handle, { id: 'reg', node: 'node', dt_macro: dt, region, moieties, iface_species: ['A'], D_iface: 1e-12, h_iface_m: 1e-7, nodeVolume_m3: 1e-18 });
  const node = DEVS.nodeModel(handle, { id: 'node', moieties, dt_min: 2.5e-4, leap_threshold: 1, seed: opt.seed + 1, reactions: [
    { id: 'bind', reactants: { A: 1, R: 1 }, products: { AR: 1 }, k: 2e-3 },        // 느린 통로 (SSA)
    { id: 'unbind', reactants: { AR: 1 }, products: { A: 1, R: 1 }, k: 0.5 },
    { id: 'activate', reactants: { A: 1 }, products: { Ax: 1 }, k: 5e2 },         // 강성 통로 (a·Δt_min ≫ 1) → τ-도약/CLE
    { id: 'deactivate', reactants: { Ax: 1 }, products: { A: 1 }, k: 4e2 }] });
  sched.add(reg, ['node']); sched.add(node, ['reg']);

  const M0 = HMSE.moietyTotals(handle.state, moieties), worst = { field: 0, moiety: 0 };
  const audit = () => {
    const M = HMSE.moietyTotals(handle.state, moieties), L = handle.state.ledgers.reg.counts, T = FV.totals(region);
    const dField = Math.max(...Object.keys(T).map((k) => Math.abs(T[k] - (L[k] || 0))));
    const dMoi = Math.max(...Object.keys(M0).map((k) => Math.abs(M[k] - M0[k])));
    worst.field = Math.max(worst.field, dField); worst.moiety = Math.max(worst.moiety, dMoi);
    return { M, dField, dMoi };
  };
  say(`P3 종단 시험 — 영역 ${opt.template} n=8 (활성 칸 ${region.active.length}, 인터페이스 칸 ${region.iface.length}), 노드 SSA+τ-도약, 거시 Δt ${dt} s, 이동 ${opt.mode}`);
  say(`초기 부분 구조 총량: A ${M0.A}, R ${M0.R}`);
  say('  step        t(s)   reg.A   reg.B  node.A node.R node.AR node.Ax   ΣA     ΣR   |∫C−N|max  maxResid  pending  tx');
  let lastPrinted = -1;
  const res = sched.run(Infinity, {
    stop: () => reg.steps >= opt.steps,
    afterEvent: () => {
      if (reg.steps !== lastPrinted && (reg.steps % opt.every === 0)) {
        lastPrinted = reg.steps;
        const a = audit(), r = handle.state.ledgers.reg.counts, n = handle.state.ledgers.node.counts, b = sched.boundary.buffers();
        say(`${String(reg.steps).padStart(6)} ${reg.tLast.toFixed(4).padStart(11)} ${String(r.A).padStart(7)} ${String(r.B).padStart(7)} ${String(n.A).padStart(7)} ${String(n.R).padStart(6)} ${String(n.AR).padStart(7)} ${String(n.Ax).padStart(7)} ${String(a.M.A).padStart(6)} ${String(a.M.R).padStart(6)}   ${a.dField.toExponential(2)}   ${b.maxResidual.toFixed(3)}   ${String(b.pending).padStart(6)} ${sched.boundary.stats.tx}`);
      } else if (sched.log.events % 97 === 0) audit();
    },
  });
  const a = audit(), b = sched.boundary.buffers();
  const NA0 = M0.A + M0.R, NAf = a.M.A + a.M.R;
  const out = { steps: reg.steps, t: res.t, events: sched.log.events, ties: sched.log.ties, tx: sched.boundary.stats.tx, retries: sched.boundary.stats.retries,
    committedOut: sched.boundary.stats.committedOut, committedIn: sched.boundary.stats.committedIn, nodeStats: { ssa: node.stats.ssa, leaps: node.stats.leaps, cle: node.stats.cle, fast: [...node.stats.fastChannels] },
    substeps: region.stats.substeps, maxRescale: region.stats.maxRescale, N_initial: NA0, N_final: NAf, massError: Math.abs(NA0 - NAf), worstFieldLedger: worst.field, worstMoiety: worst.moiety, buffers: b,
    final: { reg: { ...handle.state.ledgers.reg.counts }, node: { ...handle.state.ledgers.node.counts }, regVolume_m3: region.active.length * region.vox_m3, nodeVolume_m3: 1e-18,
      faceA: FV.interfaceAmount(region, 'A'), faceVolume_m3: region.iface.length * region.vox_m3 },
    pass: (opt.integer !== false ? Math.abs(NA0 - NAf) === 0 && worst.field === 0 : Math.abs(NA0 - NAf) < 1 && worst.field < 1e-6) && worst.moiety === 0 && reg.steps >= opt.steps };
  say(`\n결과: 영역 ${out.steps} 단계, t=${out.t.toFixed(4)} s, DEVS 사건 ${out.events} (동시 사건 ${out.ties}), 경계 거래 ${out.tx} (재시도 ${out.retries}), 이동 영역→노드 ${out.committedOut} / 노드→영역 ${out.committedIn}`);
  say(`노드: SSA ${out.nodeStats.ssa}, τ-도약 ${out.nodeStats.leaps} (CLE ${out.nodeStats.cle}), 빠른 통로 ${out.nodeStats.fast.join(', ') || '—'} · FV 부분 단계 ${out.substeps}, 최대 재척도 편차 ${out.maxRescale.toExponential(2)}`);
  say(`질량: N_initial ${NA0} → N_final ${NAf} · |ΔN| = ${out.massError} · 최악 부분 구조 편차 ${worst.moiety} · 최악 |∫C dΩ − N_ledger| ${worst.field.toExponential(2)} · 나머지 최대 ${b.maxResidual.toFixed(6)} (< 1) · pending ${b.pending}`);
  say(out.pass ? '✓ PASS — 질량 보존 (|N_initial − N_final| < 1, 원장 정수 불변, 장 = 원장)' : '✗ FAIL');
  return out;
}

if (require.main === module) {
  const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
  const r = run({ steps: +arg('steps', 10000), every: +arg('every', 1000), mode: arg('mode', 'residual'), template: arg('template', 'sphere') });
  process.exit(r.pass ? 0 : 1);
}
module.exports = { run };
