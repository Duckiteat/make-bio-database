#!/usr/bin/env node
// Fate-Test 모음 (형식 v9 세포 운명 층): 활성화된 CD8 T 세포 → 효과기 | 기억 전구.
//   A 계통 충실도 (최적 조건에서 목표 상태 도달·결정)  B 경쟁 (IL-12 + IL-15 → 효과기 우세)
//   C 결정 비가역성 (결정 전 철회 → 되돌아감, 결정 후 철회 → 유지; 철회 = 충격 → 같은 단계 강등 + 냉각)
//   D 스트레스 분화 정지 (포도당·지방산 결핍 → 고갈 저장소까지 사후 분석)  E 스트레스 다른 운명 (IL-12 + IL-15 + 포도당 결핍 → 기억 전구)
//   F 다중 규모 정확도 (P5 관문 동적 경로 대 명시 기준 경로: 표지 궤적 L2 < 2%, 같은 최종 상태, 속도 향상)
//   G 질량 (모든 실행에서 부분 구조 원장 상대 편차 ≤ 1e-12, 음수 없음)
// 실행: node tests/fate_suite.js [--quick]   (시나리오 examples/scenarios/fate-*-hypothetical.json — 가상 값, 엔진 시험용)
'use strict';
const { readFileSync } = require('fs');
const path = require('path');
const F = require('../engine/fate_engine.js');
const ROOT = path.join(__dirname, '..');
const db = JSON.parse(readFileSync(path.join(ROOT, 'data/db.json'), 'utf8'));
const SRC = 'D000174', EFF = 'D000175', MEM = 'D000176';
const TBET = 'D000165|nucleoplasm', EOMES = 'D000166|nucleoplasm', GLC = 'D000046|cytosol', PAL = 'D000169|mito_matrix';
const scen = (name, over) => Object.assign(JSON.parse(readFileSync(path.join(ROOT, `examples/scenarios/fate-${name}-hypothetical.json`), 'utf8')), over || {});
const h = (s) => (s == null ? '—' : `${(s / 3600).toFixed(2)} h`);

function run(opt) {
  opt = Object.assign({ quiet: false, quick: false }, opt || {});
  const say = (...a) => { if (!opt.quiet) console.log(...a); };
  const checks = [], runs = {};
  const check = (group, name, ok, detail) => { checks.push({ group, name, ok: !!ok, detail }); };
  const sim = (key, name, over, o) => { const t0 = process.hrtime.bigint(); const r = F.simulateFate(db, SRC, Object.assign({ scenario: scen(name, over) }, o || {})); r.ms = Number(process.hrtime.bigint() - t0) / 1e6; runs[key] = r; return r; };
  const massOK = (r) => r.mass.worst <= 1e-12 && !r.audit.some((a) => a.code === 'AUDIT_MASS') && Object.values(r.final.N).every((v) => v > -1e-6);

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
  { const r = sim('short', 'effector-pulse-short'), g = r.gate.log.find((x) => x.ev === 'demote_prefilter');
    const off = 3600 / r.dt; // 1 h 펄스 → 끄는 느린 단계
    check('C 결정 비가역성', `결정 전 철회 (1 h < 결정 ${h(tC)}) → 시작 상태로 되돌아감`, tC > 3600 && r.final.state === SRC && r.postMortem && r.postMortem.cause === 'signal_insufficient', `최종 ${r.final.state}, 원인 ${r.postMortem && r.postMortem.cause}`);
    check('C 결정 비가역성', '철회 = 충격 → 같은 단계 강등, W=20 냉각 뒤 재승격', g && g.step === off && r.gate.cooldownSteps === 20 && r.gate.log.some((x) => x.ev === 'promote' && x.step >= off + 21), `강등 @ 단계 ${g && g.step} (철회 ${off}), 냉각 ${r.gate.cooldownSteps}`); }
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
  // F 다중 규모 정확도: 기준 = 명시 부분 단계를 수렴할 만큼 잘게(부분 단계당 소비 1%, explicit_fraction 0.01).
  //   관문의 명시 경로(소비 10%)도 같은 기준과 비교해 그 자체 오차(순차 분할 편향)를 밝힌다.
  const acc = [];
  const l2Of = (a, b) => { let worst = 0; for (const k of [TBET, EOMES]) { const i = a.keys.indexOf(k); let num = 0, den = 0; for (let j = 0; j < a.series.length; j++) { num += (a.series[j][i] - b.series[j][i]) ** 2; den += b.series[j][i] ** 2; } worst = Math.max(worst, Math.sqrt(num / den)); } return worst; };
  const timed = (f) => { const t0 = process.hrtime.bigint(), r = f(); r.ms = Number(process.hrtime.bigint() - t0) / 1e6; return r; };
  for (const [name, hours] of opt.quick ? [['memory-il15', 6]] : [['memory-il15', 12], ['effector-il12', 2.5]]) {
    const over = { t_end: hours * 3600 };
    const ref = timed(() => F.simulateFate(db, SRC, { scenario: scen(name, { ...over, explicit_fraction: 0.01 }), commitment: false, mode: 'fine' }));
    const coarse = timed(() => F.simulateFate(db, SRC, { scenario: scen(name, over), commitment: false, mode: 'fine' }));
    const a = timed(() => F.simulateFate(db, SRC, { scenario: scen(name, over), commitment: false }));
    const row = { name, hours, l2: l2Of(a, ref), l2Coarse: l2Of(coarse, ref), same: a.final.state === ref.final.state, reachDyn: a.firstReach, reachRef: ref.firstReach, msD: a.ms, msF: ref.ms, msC: coarse.ms, speedup: ref.ms / a.ms, nsub: a.gate.nsub, path: a.gate.path, promotions: a.gate.promotions, massDyn: a.mass.worst, massFine: ref.mass.worst };
    acc.push(row);
    check('F 다중 규모 정확도', `${name} ${hours} h: 표지 궤적 상대 L2 < 2% (수렴 기준 대비), 같은 최종 상태`, row.l2 < 0.02 && row.same, `L2 ${row.l2.toExponential(2)} (명시 10% 경로 ${row.l2Coarse.toExponential(2)}), ${a.final.state} = ${ref.final.state}`);
    check('F 다중 규모 정확도', `${name} ${hours} h: 강성(N_sub ≥ K_up)에서 승격, 수렴 기준보다 빠름`, row.nsub.max >= 15 && row.promotions >= 1 && row.speedup > 1, `N_sub ${row.nsub.min}–${row.nsub.max}, ${row.speedup.toFixed(1)}×`);
    check('G 질량', `${name} 기준 경로(명시): 원장 상대 편차 ≤ 1e-9`, row.massFine <= 1e-9, row.massFine.toExponential(2));
  }
  // G 질량
  for (const [k, r] of Object.entries(runs)) check('G 질량', `${k}: 부분 구조 원장 ≤ 1e-12, 음수 없음`, massOK(r), r.mass.worst.toExponential(2));

  // 보고
  say('\n| 실행 | 최종 상태 | 도달 | 결정 (철회 시험) | 원인 · 제한 | P5 관문 경로 | 질량 편차 | ms |');
  say('|---|---|---|---|---|---|---|---|');
  const L = runs.eff.ix.label;
  for (const [k, r] of Object.entries(runs)) {
    const c = r.commitment.filter((x) => x.driven).map((x) => `${L(x.to)} ${h(x.t)}`).join(', ') || '—';
    const p = r.postMortem;
    say(`| ${k} ${r.scenario} | ${r.final.state ? L(r.final.state) : '미결정'} | ${Object.entries(r.firstReach).filter(([s]) => s !== SRC).map(([s, t]) => `${L(s)} ${h(t)}`).join(', ') || '—'} | ${c} | ${p ? `${p.cause}${p.limiting ? ' · ' + p.limiting.label : ''}${p.resource && p.resource.t_exhausted != null ? ` (고갈 ${h(p.resource.t_exhausted)})` : ''}` : '—'} | ${JSON.stringify(r.gate.path)} | ${r.mass.worst.toExponential(1)} | ${r.ms.toFixed(0)} |`);
  }
  say('\n다중 규모 정확도 (기준 = 명시 부분 단계 소비 1% — 수렴, 결정 탐침 없이)');
  say('| 시나리오 | 시간 | 동적 관문 L2 | 명시 10% 경로 L2 | 최종 같음 | N_sub | 동적 ms | 명시 10% ms | 기준 ms | 속도 향상 (기준/동적) |');
  say('|---|---|---|---|---|---|---|---|---|---|');
  for (const a of acc) say(`| ${a.name} | ${a.hours} h | ${a.l2.toExponential(2)} | ${a.l2Coarse.toExponential(2)} | ${a.same} | ${a.nsub.min}–${a.nsub.max} | ${a.msD.toFixed(0)} | ${a.msC.toFixed(0)} | ${a.msF.toFixed(0)} | ${a.speedup.toFixed(1)}× |`);
  say('');
  for (const c of checks) say(`${c.ok ? '✓' : '✗'} [${c.group}] ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
  const pass = checks.every((c) => c.ok);
  say(pass ? `\n✓ PASS — Fate-Test ${checks.length}/${checks.length}` : `\n✗ FAIL — ${checks.filter((c) => !c.ok).length}/${checks.length} 실패`);
  return { pass, checks, runs, acc };
}
if (require.main === module) process.exit(run({ quick: process.argv.includes('--quick') }).pass ? 0 : 1);
module.exports = { run };
