#!/usr/bin/env node
// Fate-Test 모음 (형식 v9 세포 운명 층): 활성화된 CD8 T 세포 → 효과기 | 기억 전구.
//   A 계통 충실도 (최적 조건에서 목표 상태 도달·결정)  B 경쟁 (IL-12 + IL-15 → 효과기 우세)
//   C 결정 비가역성 (결정 전 철회 → 되돌아감, 결정 후 철회 → 유지; 철회 = 경계 조건 불연속 → 단계 제어가 흡수)
//   D 스트레스 분화 정지 (포도당·지방산 결핍 → 고갈 저장소까지 사후 분석)  E 스트레스 다른 운명 (IL-12 + IL-15 + 포도당 결핍 → 기억 전구)
//   F 다중 규모 정확도 (결합 Rodas3 기본 허용 오차 대 수렴 기준(허용 오차 1/1000): 표지 궤적 L2 < 1e-6, 같은 최종 상태, 강성 범위, 속도 향상)
//   G 질량 (모든 실행에서 부분 구조 원장 상대 편차 ≤ 1e-14 — ΣIn = ΣOut, 음수 없음)
//   I 확률 앙상블 (4단계 ④·⑤): 혼합-최적 + 확률 층 — 운명 비율이 결정론과 맞고, 도달 시각 분포가 결정론 값을 감싸고, 모든 궤적의 원장이 맞음
// 실행: node tests/fate_suite.js [--quick] [--engine js|rust]   (시나리오 examples/scenarios/fate-*-hypothetical.json — 가상 값, 엔진 시험용)
'use strict';
const { readFileSync } = require('fs');
const path = require('path');
const F = require('../engine/fate_engine.js');
const PR = require('../judicial/process_report.js');
const FA = require('../judicial/fate_audit.js');
const IRB = require('../compiler/ir_builder.js'); // 컴파일러: 같은 IR 을 엔진과 사법부에
const ORCH = require('../orchestrator.js'); // 수렴 기준 시나리오 (refScenario)
const VER = require('../judicial/verifier.js'); // 원자료 실행(정확도 비교용)의 질량은 사법부 검증기로
const vw = (x) => { const v = VER.verifyFate(db, x); return v.pass ? Math.max(v.worst, v.replayWorst) : Infinity; }; // 사법부: 원자료 → 판결된 보기 (감사·정지·사후 분석·독립 질량 검증)
const ROOT = path.join(__dirname, '..');
const db = JSON.parse(readFileSync(path.join(ROOT, 'data/db.json'), 'utf8'));
const SRC = 'D000174', EFF = 'D000175', MEM = 'D000176';
const TBET = 'D000165|nucleoplasm', EOMES = 'D000166|nucleoplasm', GLC = 'D000046|cytosol', PAL = 'D000169|mito_matrix';
const scen = (name, over) => Object.assign(JSON.parse(readFileSync(path.join(ROOT, `examples/scenarios/fate-${name}-hypothetical.json`), 'utf8')), over || {});
const h = (s) => (s == null ? '—' : `${(s / 3600).toFixed(2)} h`);

function run(opt) {
  opt = Object.assign({ quiet: false, quick: false, engine: 'js' }, opt || {}); // engine: 'js'(기준 구현) | 'rust'(engine/rust WASM)
  const E = { engine: opt.engine };
  const say = (...a) => { if (!opt.quiet) console.log(...a); };
  const checks = [], runs = {};
  const check = (group, name, ok, detail) => { checks.push({ group, name, ok: !!ok, detail }); };
  const names = {};
  const sim = (key, name, over, o) => { const t0 = process.hrtime.bigint(); const sc = scen(name, over), ir = IRB.buildFateIR(db, SRC, sc), raw = F.simulateFate(db, SRC, Object.assign({ scenario: sc, ir }, E, o || {})); const ms = Number(process.hrtime.bigint() - t0) / 1e6; const r = FA.judgeFate(db, raw, { scenario: sc, ir }); r.ms = ms; runs[key] = r; names[key] = name; return r; };
  const massOK = (r) => r.mass.worst <= 1e-14 && !r.audit.some((a) => a.code === 'AUDIT_MASS') && Object.values(r.final.N).every((v) => v > -1e-6);

  say('Fate-Test — 활성화된 CD8 T 세포 (D000174) → 효과기 (D000175) | 기억 전구 (D000176) · 가상 시나리오');
  // A 계통 충실도
  for (const [key, name, tgt] of [['eff', 'effector-il12', EFF], ['mem', 'memory-il15', MEM]]) {
    const r = sim(key, name), c = r.commitment.find((x) => x.to === tgt);
    check('A 계통 충실도', `${name}: 최종 ${tgt}`, r.final.state === tgt, `최종 ${r.final.state}, 도달 ${h(r.firstReach[tgt])}`);
    check('A 계통 충실도', `${name}: 결정 시점 존재·격자 단조·도달보다 먼저`, c && c.t != null && c.monotone && c.t <= r.firstReach[tgt], `결정 ${h(c && c.t)} ≤ 도달 ${h(r.firstReach[tgt])}`);
    check('A 계통 충실도', `${name}: 정지·사후 분석 없음`, !r.postMortem && !r.audit.some((a) => a.code === 'AUDIT_FATE'));
  }
  // B 경쟁
  { const r = sim('mix', 'mixed-optimal');
    check('B 경쟁', 'IL-12 + IL-15 + 자원 충분 → 효과기 우세 (IL-12 가 Eomes 를 누름)', r.final.state === EFF && r.final.N[EOMES] < 2000, `최종 ${r.final.state}, Eomes ${r.final.N[EOMES].toFixed(0)}`); }
  // C 결정 비가역성
  const tC = runs.eff.commitment.find((x) => x.to === EFF).t;
  { const r = sim('short', 'effector-pulse-short');
    const off = Math.round(3600 / r.dt), tr = r.trajectory; // 1 h 펄스 → 끄는 관찰 구간 (기록 j 는 구간 [jΔ, (j+1)Δ])
    const ref = F.simulateFate(db, SRC, Object.assign({ scenario: ORCH.refScenario(scen('effector-pulse-short')), commitment: false }, E));
    const l2 = FA.markerL2(r, ref);
    check('C 결정 비가역성', `결정 전 철회 (1 h < 결정 ${h(tC)}) → 시작 상태로 되돌아감`, tC > 3600 && r.final.state === SRC && r.postMortem && r.postMortem.cause === 'signal_insufficient', `최종 ${r.final.state}, 원인 ${r.postMortem && r.postMortem.cause}`);
    check('C 결정 비가역성', '철회(경계 조건 불연속) → 단계 제어가 다시 잘게 (철회 구간 단계 > 직전 구간), 수렴 기준과 같은 최종 상태·L2 < 1e-6', tr[off].steps > tr[off - 1].steps && ref.final.state === r.final.state && l2 < 1e-6, `단계 ${tr[off - 1].steps} → ${tr[off].steps} (거부 ${tr[off].rejects}), L2 ${l2.toExponential(2)}`); }
  { const r = sim('long', 'effector-pulse-long');
    check('C 결정 비가역성', `결정 후 철회 (2 h > 결정 ${h(tC)}) → 효과기 유지`, tC < 7200 && r.final.state === EFF, `최종 ${r.final.state}`); }
  // D 스트레스 분화 정지
  { const r = sim('glcw', 'effector-glucose-withheld'), p = r.postMortem || {};
    check('D 분화 정지', 'IL-12 + 포도당 결핍 → 효과기 도달 못 함, 원인 resource_exhaustion', r.final.state !== EFF && p.cause === 'resource_exhaustion', `최종 ${r.final.state}, 원인 ${p.cause}`);
    check('D 분화 정지', '사후 분석: 표지 T-bet → 피루브산 허가 → 해당과정 → 고갈 저장소 포도당@세포질 (고갈 시각 < 정지 시각)', p.resource && p.resource.bundle === GLC && p.failing.some((f) => f.bundle === TBET) && p.resource.t_exhausted < r.arrest.t, `제한 ${p.resource && p.resource.bundle} 고갈 ${h(p.resource && p.resource.t_exhausted)}, 정지 ${h(r.arrest && r.arrest.t)}`);
    check('D 분화 정지', '교정 제안이 등록된 Resource_Gap(포도당 흡수)을 가리킴', /L\d{6} \[Resource_Gap\].*GLUT1/.test(p.suggestion || ''), (p.suggestion || '').slice(0, 60)); }
  { const r = sim('faw', 'memory-fa-withheld'), p = r.postMortem || {};
    check('D 분화 정지', 'IL-15 + 지방산 결핍 → 시작 상태에서 정지, 제한 팔미토일-CoA', r.final.state === SRC && p.cause === 'resource_exhaustion' && p.resource && p.resource.bundle === PAL, `최종 ${r.final.state}, 제한 ${p.resource && p.resource.bundle}`); }
  // E 스트레스 다른 운명
  { const r = sim('mixw', 'mixed-glucose-withheld'), p = r.postMortem || {};
    check('E 다른 운명', 'IL-12 + IL-15 + 포도당 결핍 → 효과기 대신 기억 전구 (최적 조건과 다른 운명)', runs.mix.final.state === EFF && r.final.state === MEM && p.cause === 'alternative_fate' && p.alternative === MEM, `최적 ${runs.mix.final.state} → 결핍 ${r.final.state}, 원인 ${p.cause}`);
    check('E 다른 운명', '다른 운명의 원인 사슬이 고갈된 포도당까지', p.resource && p.resource.bundle === GLC, `제한 ${p.resource && p.resource.bundle}`); }
  // F 다중 규모 정확도: 기준 = 같은 결합 적분기를 허용 오차 1/1000 로 (조정자 refScenario — 자기 수렴, 두 차수의 Rosenbrock 이 1e-8 안에서 일치함을 1.5단계에서 확인)
  const acc = [];
  const l2Of = (a, b) => { let worst = 0; for (const k of [TBET, EOMES]) { const i = a.keys.indexOf(k); let num = 0, den = 0; for (let j = 0; j < a.series.length; j++) { num += (a.series[j][i] - b.series[j][i]) ** 2; den += b.series[j][i] ** 2; } worst = Math.max(worst, Math.sqrt(num / den)); } return worst; };
  const timed = (f) => { const t0 = process.hrtime.bigint(), r = f(); r.ms = Number(process.hrtime.bigint() - t0) / 1e6; return r; };
  for (const [name, hours] of opt.quick ? [['memory-il15', 6]] : [['memory-il15', 12], ['effector-il12', 2.5]]) {
    const over = { t_end: hours * 3600 };
    const ref = timed(() => F.simulateFate(db, SRC, { scenario: ORCH.refScenario(scen(name, over)), commitment: false, ...E }));
    const a = timed(() => F.simulateFate(db, SRC, { scenario: scen(name, over), commitment: false, ...E }));
    const row = { name, hours, l2: l2Of(a, ref), same: a.final.state === ref.final.state, msD: a.ms, msF: ref.ms, speedup: ref.ms / a.ms, steps: a.integrator.steps, stepsRef: ref.integrator.steps, hRange: a.integrator.h.max / a.integrator.h.min, massDyn: vw(a), massFine: vw(ref) };
    acc.push(row);
    check('F 다중 규모 정확도', `${name} ${hours} h: 표지 궤적 상대 L2 < 1e-6 (수렴 기준 대비), 같은 최종 상태`, row.l2 < 1e-6 && row.same, `L2 ${row.l2.toExponential(2)}, ${a.final.state} = ${ref.final.state}`);
    check('F 다중 규모 정확도', `${name} ${hours} h: 강성(단계 크기 범위 ≥ 10³)을 L-안정 단계가 흡수, 수렴 기준보다 빠름`, row.hRange >= 1e3 && row.speedup > 1, `h ${a.integrator.h.min.toExponential(1)}–${a.integrator.h.max} s, 단계 ${row.steps} (기준 ${row.stepsRef}), ${row.speedup.toFixed(1)}×`);
    check('G 질량', `${name} 수렴 기준 실행: 원장 상대 편차 ≤ 1e-14`, row.massFine <= 1e-14, row.massFine.toExponential(2));
  }
  // G 질량
  for (const [k, r] of Object.entries(runs)) check('G 질량', `${k}: 부분 구조 원장 ≤ 1e-14, 음수 없음`, massOK(r), r.mass.worst.toExponential(2));

  // H 과정 분석 보고서: 모든 실행이 무결성 증명서 PASS (원장·재생 매 단계 ≤ 1e-14, 신호 = 일정, 결정론, 출처) + 실행 전에 적은 예측(expect)과 일치
  const reports = {};
  for (const [k, r] of Object.entries(runs)) {
    const scText = readFileSync(path.join(ROOT, `examples/scenarios/fate-${names[k]}-hypothetical.json`), 'utf8');
    const again = F.simulateFate(db, SRC, { scenario: JSON.parse(scText), commitment: false, ...E });
    const rep = PR.processReport(r, { scenario: JSON.parse(scText), scenarioText: scText, rerunHash: FA.trajectoryHash(again) });
    reports[k] = rep;
    check('H 과정 보고서', `${k}: 무결성 증명서 PASS (${rep.checks.length} 확인)`, rep.pass && rep.checks.every((c) => c.ok === true), rep.checks.filter((c) => c.ok !== true).map((c) => c.name).join(', ') || `원장 ${r.mass.worst.toExponential(1)} · 재생 ${r.mass.replayWorst.toExponential(1)}`);
    check('H 과정 보고서', `${k}: 실행 전 예측(expect)과 관찰이 같음`, !rep.disc.length, rep.disc.join(' / ') || '차이 없음');
    const cover = rep.phases.length && rep.phases[0].t0 === 0 && rep.phases[rep.phases.length - 1].t1 === r.t_end && rep.phases.every((p, q) => !q || p.t0 === rep.phases[q - 1].t1);
    check('H 과정 보고서', `${k}: 구간이 0 – 끝을 빈틈없이 덮고 변곡점 ≥ 3 (끝 상태만이 아님)`, cover && rep.infl.length >= 3, `구간 ${rep.phases.length}, 변곡점 ${rep.infl.length}`);
  }
  // I 확률 앙상블 (Rust/WASM, 궤적 20 — 앙상블 판정은 사법부 stoch_audit)
  const SA = require('../judicial/stoch_audit.js');
  const stoSc = JSON.parse(readFileSync(path.join(ROOT, 'examples/scenarios/stochastic-mixed-optimal-hypothetical.json'), 'utf8'));
  const ens = ORCH.runEnsemble(db, SRC, stoSc, opt.quick ? 8 : 20, { commitment: false }), sum = SA.ensembleSummary(ens), det = runs.mix || sim('mix', 'mixed-optimal');
  const fr = sum.fate[det.final.state] || { k: 0, ci: [0, 0] }, rr = sum.reach[EFF];
  check('I 확률 앙상블', `혼합-최적: 결정론 끝 상태(${det.final.state})의 앙상블 비율 구간이 1 을 포함`, fr.ci[1] >= 1, `${fr.k}/${sum.n}, 95% ${(fr.ci[0] * 100).toFixed(1)}–${(fr.ci[1] * 100).toFixed(1)}%`);
  check('I 확률 앙상블', '도달 시각 분포가 결정론 도달 시각을 감쌈 (10–90%)', rr && rr.q10 <= det.firstReach[EFF] && det.firstReach[EFF] <= rr.q90, rr ? `${h(rr.q10)} ≤ ${h(det.firstReach[EFF])} ≤ ${h(rr.q90)} (sd ${h(rr.sd)})` : '도달 없음');
  check('I 확률 앙상블', '모든 궤적 원장·재생 ≤ 1e-14, 발화 정수, 엔진 결함 없음', ens.every((r) => { const a = SA.auditTrajectory(db, r, { scenario: stoSc }); return !a.error && !a.audit.some((z) => z.fault === 'ENGINE_DEFECT') && a.verdict.mass.worst <= 1e-14; }), `${ens.length} 궤적`);
  // 보고
  say('\n| 실행 | 최종 상태 | 도달 | 결정 (철회 시험) | 원인 · 제한 | 적분 단계 (거부) | 질량 편차 | ms |');
  say('|---|---|---|---|---|---|---|---|');
  const L = runs.eff.ix.label;
  for (const [k, r] of Object.entries(runs)) {
    const c = r.commitment.filter((x) => x.driven).map((x) => `${L(x.to)} ${h(x.t)}`).join(', ') || '—';
    const p = r.postMortem;
    say(`| ${k} ${r.scenario} | ${r.final.state ? L(r.final.state) : '미결정'} | ${Object.entries(r.firstReach).filter(([s]) => s !== SRC).map(([s, t]) => `${L(s)} ${h(t)}`).join(', ') || '—'} | ${c} | ${p ? `${p.cause}${p.limiting ? ' · ' + p.limiting.label : ''}${p.resource && p.resource.t_exhausted != null ? ` (고갈 ${h(p.resource.t_exhausted)})` : ''}` : '—'} | ${r.integrator.steps} (${r.integrator.rejected}) | ${r.mass.worst.toExponential(1)} | ${r.ms.toFixed(0)} |`);
  }
  say('\n다중 규모 정확도 (기준 = 같은 적분기, 허용 오차 1/1000 — 결정 탐침 없이)');
  say('| 시나리오 | 시간 | L2 (기준 대비) | 최종 같음 | 단계 (기준) | h 범위 | ms | 기준 ms | 속도 향상 (기준/기본) |');
  say('|---|---|---|---|---|---|---|---|---|');
  for (const a of acc) say(`| ${a.name} | ${a.hours} h | ${a.l2.toExponential(2)} | ${a.same} | ${a.steps} (${a.stepsRef}) | ${a.hRange.toExponential(1)} | ${a.msD.toFixed(0)} | ${a.msF.toFixed(0)} | ${a.speedup.toFixed(1)}× |`);
  say('');
  for (const c of checks) say(`${c.ok ? '✓' : '✗'} [${c.group}] ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
  const pass = checks.every((c) => c.ok);
  say(pass ? `\n✓ PASS — Fate-Test ${checks.length}/${checks.length}` : `\n✗ FAIL — ${checks.filter((c) => !c.ok).length}/${checks.length} 실패`);
  return { pass, checks, runs, acc, reports };
}
if (require.main === module) process.exit(run({ quick: process.argv.includes('--quick'), engine: process.argv.includes('--engine') ? process.argv[process.argv.indexOf('--engine') + 1] : 'js' }).pass ? 0 : 1);
module.exports = { run };
