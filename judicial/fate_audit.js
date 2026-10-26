// 사법부 — 운명 판정 (Fate Adjudication). docs/design/tripartite-governance.md §2
//
// 운명 엔진(행정부)의 원자료를 받아 판결을 낸다: 감사 목록 · 분화 정지 · 사후 분석(실패 표지 → 조절 배율 → 약한 활성화 인자
// → 고갈 저장소) · 소비만 되는 저장소 · 독립 질량 검증(judicial/verifier.js) · 궤적 해시.
// 엔진을 실행하지 않고, 데이터를 바꾸지 않는다. 결과는 원자료 + 판결을 합친 '판결된 보기(view)' — 보고서(judicial/process_report.js)가 읽는다.
'use strict';
const crypto = require('crypto');
const M = require('../model.js');
const J = require('./judicial.js');
const { verifyFate } = require('./verifier.js');
const { checkFateRaw } = require('./contract.js');
const { verifyIR } = require('./derivative.js');
const REL = require('./reliability.js'); // 신뢰 지표 — 쓰인 상수의 등급 (②)

// 표지 거리 (상태 서명 · 문턱) — 엔진의 분류와 독립적으로 다시 센다
function distanceFns(db, r) {
  const thr = r.process.thresholds, at = new Map(r.keys.map((b, i) => [b, i]));
  const sig = (sid) => db.senses[sid].signature;
  const distance = (N, sid) => { let s = 0, n = 0; for (const m of sig(sid)) { const b = `${m.ref}|${m.location}`, t = thr[b]; if (!t) continue; const x = Math.max(N[at.get(b)], 1e-9), span = Math.log(t.high / t.low); s += m.level === 'high' ? (x >= t.high ? 0 : x <= t.low ? 1 : Math.log(t.high / x) / span) : (x <= t.low ? 0 : x >= t.high ? 1 : Math.log(x / t.low) / span); n++; } return n ? s / n : 1; };
  const rawDistance = (N, sid) => { let s = 0, n = 0; for (const m of sig(sid)) { const b = `${m.ref}|${m.location}`, t = thr[b]; if (!t) continue; const x = Math.max(N[at.get(b)], 1e-9), span = Math.log(t.high / t.low); s += Math.max(0, m.level === 'high' ? Math.log(t.high / x) / span : Math.log(x / t.low) / span); n++; } return n ? s / n : 1; };
  return { distance, rawDistance };
}
// 농도·조절 배율 — 원자료(부피·완충 설정)와 model 의 힐 법칙으로
function concFns(r) {
  const at = new Map(r.keys.map((b, i) => [b, i]));
  const concAt = (N, i) => { const b = r.keys[i], Vv = r.volumes[b.split('|').pop()] || 0; if (!Vv) return 0; const c = Math.max(0, N[i]) / (M.NA * Vv), bf = r.buffered[b]; return bf ? Math.min(bf.conc_M, c) : c; };
  const factorsAt = (N) => r.process.ruleInfo.map((R) => R.mods.map((m) => M.hillFactor(m.effect, m.kin, concAt(N, at.get(m.bundle)))));
  return { at, concAt, factorsAt };
}

function judgeFate(db, r, ctx) {
  db = M.normalize(db);
  ctx = ctx || {};
  const ix = M.index(db), sc = ctx.scenario || {}, audit = [], AE = (rule, fault, code, where, msg, suggestion) => audit.push({ code, fault, where, msg, suggestion, rule }); // fault: judicial/fault.js
  // ⓪ 원자료 계약 (schemas/ffi/fate-raw.schema.json) — 어긴 원자료는 판정하지 않는다 (JS·Rust 어느 엔진이든 같은 계약)
  const contract = checkFateRaw(r);
  if (!contract.ok) {
    for (const x of contract.violations.slice(0, 10)) AE('RULE-0213', 'ENGINE_DEFECT', 'AUDIT_SCHEMA', x.path, `원자료 계약 위반: ${x.msg}`, '엔진(행정부) 출력이 FFI 계약과 다름 — 엔진 오류');
    return { error: `원자료 계약 위반 ${contract.violations.length}건 — 판정하지 않음 (${contract.violations.slice(0, 3).map((x) => `${x.path}: ${x.msg}`).join(' · ')})`, audit, contract };
  }
  // ⓪-2 IR·기호 도함수 (조정자가 넘긴 IR 이 있을 때): 해시·엔진이 먹은 IR 과 같은지·법칙 충실도·자동미분 대비 도함수
  let irCheck = null;
  if (ctx.ir) {
    irCheck = verifyIR(db, ctx.ir, sc);
    irCheck.consumed = r.irHash === ctx.ir.hash;
    irCheck.ruleOrder = ctx.ir.rules.map((x) => x.ref).join() === r.process.ruleInfo.map((x) => x.ref).join();
    irCheck.ok = irCheck.ok && irCheck.consumed && irCheck.ruleOrder;
    if (!irCheck.consumed) AE('RULE-0032', 'ENGINE_DEFECT', 'AUDIT_SCHEMA', 'IR', `엔진이 먹은 IR(${String(r.irHash).slice(0, 12)})이 조정자가 넘긴 IR(${ctx.ir.hash.slice(0, 12)})과 다름`, '같은 IR 로 다시 실행');
    if (!irCheck.hashOK || irCheck.problems.length || !irCheck.ruleOrder) AE('RULE-0032', 'COMPILER_DEFECT', 'AUDIT_SCHEMA', 'IR', `IR 충실도 위반: ${[...(irCheck.hashOK ? [] : ['해시']), ...(irCheck.ruleOrder ? [] : ['규칙 순서']), ...irCheck.problems].slice(0, 4).join(' · ')}`, '컴파일러(compiler/ir_builder.js) 오류 또는 IR 변조');
    if (irCheck.missingDeps.length || irCheck.rateWorst > irCheck.tolerance || irCheck.derivWorst > irCheck.tolerance || irCheck.factorWorst > irCheck.tolerance || irCheck.fdWorst > irCheck.fdTolerance) AE('RULE-0037', 'COMPILER_DEFECT', 'AUDIT_KINETIC', 'IR', `기호 도함수 검사 실패 — 속도 ${irCheck.rateWorst.toExponential(1)} · 도함수 ${irCheck.derivWorst.toExponential(1)} · 배율 ${irCheck.factorWorst.toExponential(1)} · 유한차분 ${irCheck.fdWorst.toExponential(1)}${irCheck.missingDeps.length ? ` · 빠진 의존 ${irCheck.missingDeps.slice(0, 3).join(', ')}` : ''}`, '컴파일러의 미분 규칙 오류');
  }
  const rules = r.process.ruleInfo, { distance, rawDistance } = distanceFns(db, r), { at, concAt, factorsAt } = concFns(r);
  // ① 원자료 사실
  for (const f of r.facts) {
    if (f.kind === 'not_supply') AE('RULE-0133', 'DOMAIN_CONFLICT', 'AUDIT_SCHEMA', f.ref, '공급 규칙이 아님 — 계에서 뺌');
    else if (f.kind === 'step_rule_missing') AE('RULE-0360', 'DOMAIN_CONFLICT', 'AUDIT_SCHEMA', f.step, `단계의 규칙 ${f.ref} 이 없음 — 계에서 뺌`);
    else if (f.kind === 'step_law_unsupported') AE('RULE-0168', 'DATA_GAP', 'AUDIT_KINETIC', f.step, `속도 법칙 ${f.law} 는 기전 단계의 결합 적분에서 아직 다루지 않음 — 단계를 끔`, J.gapSuggest(db, ix, f.ref, 'Kinetic_Gap'));
    else if (f.kind === 'step_volume_unknown') AE('RULE-0169', 'DATA_GAP', 'AUDIT_CONCENTRATION', f.step, `반응 부피(${f.location || '3D 참여자 없음'})를 몰라 단계를 끔`, J.gapSuggest(db, ix, f.ref, 'Concentration_Gap'));
    else if (f.kind === 'recycle_ignored') AE('RULE-0385', 'DATA_GAP', 'AUDIT_SCHEMA', f.ref, '재활용 분해는 운명 층에서 아직 다루지 않음 — 소실로 처리');
    else if (f.kind === 'volume_unknown') AE('RULE-0081', 'DATA_GAP', 'AUDIT_CONCENTRATION', f.bundle, `구획 ${f.location} 부피를 모름 — 농도 0 으로 계산`, J.gapSuggest(db, ix, r.source, 'Concentration_Gap'));
    else if (f.kind === 'threshold_missing') AE('RULE-0152', 'DATA_GAP', 'AUDIT_CONCENTRATION', f.bundle, '표지 문턱(thresholds[묶음] = { high, low })이 없음 — 상태를 판정할 수 없음', J.gapSuggest(db, ix, r.source, 'Concentration_Gap'));
  }
  // ② 독립 질량 검증
  const v = verifyFate(db, r);
  for (const x of v.stoichMismatch) AE('RULE-0010', 'ENGINE_DEFECT', 'AUDIT_MASS', x.ref, `화학량 대조 실패 — ${x.msg}`, '엔진이 데이터베이스 규칙과 다른 화학량을 썼음: 엔진 오류');
  for (const x of v.violations) AE('RULE-0010', 'DOMAIN_CONFLICT', 'AUDIT_MASS', x.moiety, `부분 구조 ${ix.label(x.moiety)} 가 균형 잡히지 않은 규칙으로 ${x.amount.toExponential(3)} 만큼 바뀜`, '규칙의 소비·생성을 고치거나 source/소실로 명시');
  if (v.replayWorst > v.tolerance) AE('RULE-0010', 'ENGINE_DEFECT', 'AUDIT_MASS', '재생', `저장소 재생 검사 불일치 최대 ${v.replayWorst.toExponential(3)} — 규칙 진행량으로 설명되지 않는 변경`, '엔진 오류 또는 규칙 밖 개입');
  if (v.worst > v.tolerance) AE('RULE-0010', 'ENGINE_DEFECT', 'AUDIT_MASS', '전역', `부분 구조 원장 불일치 최대 ${v.worst.toExponential(3)} (상대)`, '적분기 오류 — 진행량 원장과 상태가 어긋남');
  for (const x of v.negatives) AE('RULE-0010', 'ENGINE_DEFECT', 'AUDIT_MASS', x.bundle, `음수 양 ${x.value}`, '엔진 오류');
  // ②-2 수치: 최소 단계에서도 오차·양수성 시험을 통과하지 못해 그대로 받아들인 단계, 특이 행렬 (원장은 맞지만 적분기가 한계에 닿음 — 결합점·솔버 쪽)
  if (r.stats.hMinHits > 0 || r.stats.singular > 0) AE('RULE-0137', 'NUMERICAL', 'AUDIT_KINETIC', '수치', `Rodas3 최소 단계(h_min)에서 허용 오차를 넘긴 채 받아들인 단계 ${r.stats.hMinHits}회 · 특이 행렬 ${r.stats.singular}회 (받아들인 ${r.stats.steps}, 거부 ${r.stats.rejected}, 그중 음수 ${r.stats.rejectedNeg})`, '결합점(integrator.rtol·atol·h_min) 또는 솔버 단계 제어를 조정 — 생물 상수는 바꾸지 않는다');
  // ③ 분화 정지
  const target = r.target, traj = r.trajectory;
  let arrest = null;
  if (target && !r.firstReach[target]) {
    const d = r.series.map((N) => rawDistance(N, target)), suf = new Float64Array(d.length);
    for (let i = d.length - 1; i >= 0; i--) suf[i] = Math.min(d[i], i + 1 < d.length ? suf[i + 1] : Infinity);
    const tLast = traj[traj.length - 1].t;
    for (let i = 0; i < d.length; i++) if (d[i] - suf[i] < 0.01) { if (tLast - traj[i].t >= (sc.arrest_window || 6 * 3600)) arrest = { t: traj[i].t, d: traj[i].d[target], raw: d[i] }; break; }
    if (!arrest) arrest = { t: null, d: traj[traj.length - 1].d[target], note: '창 안에서 아직 움직이는 중 — t_end 를 늘려 확인' };
  }
  // ④ 사후 분석
  const sigOn = new Set(r.process.schedule.filter((s) => s.list.some((e) => e.n > 0)).map((s) => s.bundle.split('|')[0]));
  const pm = target && !r.firstReach[target] ? postMortem(db, ix, r, { target, concAt, at, sigOn }) : null;
  if (pm) AE('RULE-0039', 'FINDING', 'AUDIT_FATE', target, `분화 정지 — ${ix.label(target)} 에 도달하지 못함 (원인 ${pm.cause}${pm.limiting ? ', 제한 ' + pm.limiting.label : ''})`, pm.suggestion);
  // ⑤ 소비만 되는 저장소 (재생 경로 없음)
  for (const [b, x] of Object.entries(r.reservoirs)) { const prod = rules.some((R) => R.prods.some((q) => q[0] === b)); if (!prod && !x.buffered) AE('RULE-0135', 'DATA_GAP', 'AUDIT_RESOURCE', b, `${ix.bundleLabel(b)} 는 소비만 되고 재생 경로가 없음 (시작 ${+x.start.toPrecision(4)}, 끝 ${+x.end.toPrecision(4)})`, fateSuggest(db, ix, b, 'Resource_Gap', rules)); }
  // ⑥ 상수 등급 (신뢰 지표 ②): 시뮬레이션이 읽은 상수마다 등급을 계산해 문턱(기본 parameter) 미달을 잡는다.
  //   가상 값(시나리오)은 등급 밖 — 시나리오가 hypothetical 을 선언했을 때만 허용한다. 엔진·데이터를 고치지 않고 판결로만 낸다.
  let grades = null;
  if (ctx.ir) {
    grades = REL.constantVerdict(ctx.ir, sc, { stamps: ctx.stamps });
    if (grades.error) AE('RULE-0103', 'DATA_GAP', 'AUDIT_KINETIC', '상수 등급', grades.error);
    else for (const x of grades.violations.slice(0, 10)) AE('RULE-0103', 'DATA_GAP', 'AUDIT_KINETIC', x.ref, `상수 등급: ${x.msg}`, x.grade === 'hypothetical' ? '시나리오에 hypothetical: true 를 적거나 확인된 상수를 데이터에 넣을 것' : J.gapSuggest(db, ix, x.ref, 'Kinetic_Gap'));
  }
  // ⑦ 궤적 해시 (결정론 판정용 지문)
  const hash = trajectoryHash(r);
  return Object.assign({}, r, {
    ix, // 사법부 자기 색인 (엔진이 넘긴 편의 색인을 쓰지 않음)
    audit, arrest, postMortem: pm, verification: v, contract, irCheck, grades,
    mass: Object.assign({}, r.mass, { moieties: v.moieties, start: v.start, end: v.end, worst: v.worst, tolerance: v.tolerance, series: v.series, replayWorst: v.replayWorst, replaySeries: v.replaySeries }),
    process: Object.assign({}, r.process, { factorsAt, rawDistance, distance, hash }),
  });
}

// 궤적 해시: 기록점마다 상태 벡터의 바이트 — 같은 입력으로 다시 돌린 원자료와 비교해 결정론을 판정
function trajectoryHash(r) { return crypto.createHash('sha256').update(Buffer.concat(r.series.map((N) => Buffer.from(N.buffer, N.byteOffset, N.byteLength)))).digest('hex'); }
// 수치 확인: 표지 궤적의 상대 L2 (본 실행 대 수렴 기준, 기준의 길이까지)
function markerL2(r, ref) { let worst = 0; for (const b of r.markers) { const i = r.keys.indexOf(b); let n = 0, d = 0; for (let j = 0; j < ref.series.length; j++) { n += (r.series[j][i] - ref.series[j][i]) ** 2; d += ref.series[j][i] ** 2; } worst = Math.max(worst, d ? Math.sqrt(n / d) : 0); } return worst; }

// 사후 분석: 실패한 표지 → 합성 규칙의 조절 배율 → 가장 모자란 활성화 인자 → 대사물이면 그 생산 규칙의 고갈 저장소
function postMortem(db, ix, r, c) {
  const { target, concAt, at, sigOn } = c, rules = r.process.ruleInfo, thr = r.process.thresholds;
  const N = Float64Array.from(r.keys, (b) => r.final.N[b]), val = (b) => N[at.get(b)], fails = [];
  for (const m of db.senses[target].signature) {
    const b = `${m.ref}|${m.location}`, t = thr[b], x = val(b);
    if (!t) continue;
    if (m.level === 'high' && x < t.high) fails.push({ bundle: b, level: 'high', value: x, need: t.high });
    if (m.level === 'low' && x > t.low) fails.push({ bundle: b, level: 'low', value: x, need: t.low });
  }
  const fin = r.final.state, alt = fin && fin !== target && fin !== r.states[0] ? fin : null; // 시작 상태에 머문 것은 다른 운명이 아님 (정지)
  const out = { target, reached: false, final: fin, alternative: alt, failing: fails, drivers: [], cause: null, limiting: null, chain: [] };
  for (const f of fails.filter((x) => x.level === 'high')) {
    const syn = rules.find((R) => R.layer === 'slow' && (R.kind === 'supply' || R.kind === 'step') && R.prods.some((q) => q[0] === f.bundle));
    if (!syn) continue;
    for (const m of syn.mods) {
      const s = concAt(N, at.get(m.bundle)), fac = M.hillFactor(m.effect, m.kin, s);
      const occ = m.effect === 'activates' ? (fac - 1) / ((m.kin.fmax || 1) - 1) : (1 - fac) / (1 - (m.kin.fmin || 0));
      out.drivers.push({ marker: f.bundle, modulator: m.bundle, effect: m.effect, factor: fac, occupancy: occ, ref: m.ref });
    }
  }
  const acts = out.drivers.filter((d) => d.effect === 'activates').sort((a, z) => a.occupancy - z.occupancy);
  const reps = out.drivers.filter((d) => d.effect === 'inhibits').sort((a, z) => z.occupancy - a.occupancy);
  const weakest = acts[0], strongestRep = reps[0], label = (b) => ix.bundleLabel(b);
  // 사슬 따라가기 (너비 우선): 약한 활성화 인자를 만드는 빠른 규칙의 입력 중 바닥난 저장소
  const trace = (b0) => {
    const seen = new Set([b0]); let level = [b0];
    for (let depth = 0; depth < 5 && level.length; depth++) {
      const next = [], hits = [];
      for (const b of level) for (const R of rules.filter((x) => x.layer !== 'slow' && x.prods.some((q) => q[0] === b))) for (const [kb] of R.cons) {
        if (seen.has(kb)) continue; seen.add(kb);
        const rv = r.reservoirs[kb], x = val(kb);
        out.chain.push({ from: kb, via: R.ref, to: b, amount: x, start: rv ? rv.start : null });
        if (rv && rv.start >= 1 && (x < 1 || x < 1e-3 * rv.start)) hits.push({ bundle: kb, rule: R.ref, start: rv.start, end: x });
        next.push(kb);
      }
      if (hits.length) return hits.sort((a, z) => a.end / a.start - z.end / z.start)[0];
      level = next;
    }
    return null;
  };
  const exhausted = r.events.filter((e) => e.type === 'exhausted').map((e) => e.bundle);
  if (alt && strongestRep && strongestRep.occupancy > 0.5) { out.cause = 'alternative_fate'; out.limiting = { bundle: strongestRep.modulator, label: label(strongestRep.modulator), role: 'antagonist', factor: strongestRep.factor }; }
  if (weakest && weakest.occupancy < 0.5) {
    const isSig = sigOn.has(weakest.modulator.split('|')[0]) || /extracellular$/.test(weakest.modulator);
    const res = !isSig ? trace(weakest.modulator) : null;
    if (res) { const ev = r.events.find((e) => e.type === 'exhausted' && e.bundle === res.bundle); if (ev) res.t_exhausted = ev.t; out.cause = alt ? 'alternative_fate' : 'resource_exhaustion'; out.resource = res; out.limiting = { bundle: res.bundle, label: label(res.bundle), role: 'reservoir', via: weakest.modulator }; }
    else if (!out.cause) { out.cause = isSig ? 'signal_insufficient' : 'kinetic_stall'; out.limiting = { bundle: weakest.modulator, label: label(weakest.modulator), role: isSig ? 'signal' : 'activator', occupancy: weakest.occupancy }; }
    out.weakest = weakest;
  }
  if (!out.cause && strongestRep) { out.cause = alt ? 'alternative_fate' : 'antagonist_dominance'; out.limiting = { bundle: strongestRep.modulator, label: label(strongestRep.modulator), role: 'antagonist', factor: strongestRep.factor }; }
  if (!out.cause) out.cause = exhausted.length ? 'resource_exhaustion' : 'kinetic_stall';
  out.exhausted = exhausted;
  const lb = out.limiting ? out.limiting.bundle : target;
  out.suggestion = out.cause === 'resource_exhaustion' || (out.resource && out.cause === 'alternative_fate')
    ? fateSuggest(db, ix, lb, 'Resource_Gap', rules) + ' — 또는 이 저장소를 채우는 공급 규칙(type: supply)을 상태의 대사 프로그램에'
    : out.cause === 'signal_insufficient' ? '신호 세기·지속 시간을 늘리거나 ' + fateSuggest(db, ix, out.weakest ? out.weakest.ref : lb, 'Regulatory_Gap', rules)
    : fateSuggest(db, ix, out.weakest ? out.weakest.ref : out.limiting ? lb : target, 'Regulatory_Gap', rules);
  return out;
}

// 교정 제안: 그 묶음·규칙을 대상으로 하거나 해결 경로에 둔 열린 한계 → 없으면 그 묶음을 만드는 규칙의 한계 → 없으면 등록 형식
function fateSuggest(db, ix, refOrBundle, type, rules) {
  const base = String(refOrBundle).split('|')[0].split('/')[0], isRule = /\/rule\//.test(refOrBundle);
  const makers = rules ? rules.filter((R) => R.prods.some((q) => q[0] === refOrBundle) || R.cons.some((q) => q[0] === refOrBundle)).map((R) => R.ref) : [];
  const want = new Set([refOrBundle, base, ...makers]);
  const open = Object.entries(db.limitations).filter(([, l]) => J.limitationStatus(db, l).status === 'open');
  const hit = open.filter(([, l]) => l.type === type).filter(([, l]) => want.has(l.target) || (isRule ? false : want.has((M.parseTarget(l.target) || {}).base)) || l.requirement.needs.some((n) => want.has(n.rule) || want.has(n.on)));
  if (hit.length) return hit.slice(0, 3).map(([id, l]) => `${id} [${l.type}] ${l.requirement.text}`).join(' / ');
  return `한계 등록부에 등록할 것: [${refOrBundle} | ${type} | 필요한 데이터·규칙]`;
}

// 짧은 텍스트 보고 (판결된 보기에서)
function fateText(r) {
  if (r.error) return { text: '오류: ' + r.error, code: 1 };
  const L = r.ix.label, BL = r.ix.bundleLabel, h = (s) => s == null ? '—' : `${(s / 3600).toFixed(2)} h`;
  const lines = [];
  lines.push(`세포 운명 시뮬레이션 — 시작 ${r.source} ${L(r.source)} · 상태 ${r.states.map((s) => `${s} ${L(s)}`).join(', ')}${r.scenario ? ` · 시나리오 "${r.scenario}"` : ''}${r.hypothetical ? ' [가상 값 — 엔진 시험용]' : ''}`);
  lines.push(`  관찰 격자 Δ ${r.dt} s, ${h(r.t_end)} · 빠른 층 규칙 ${r.rules.filter((x) => x.layer === 'fast').length} · 느린 층 ${r.rules.filter((x) => x.layer === 'slow').length} · 조절 ${r.rules.reduce((a, x) => a + x.modulators.length, 0)}`);
  lines.push(`  최종 상태: ${r.final.state ? `${r.final.state} ${L(r.final.state)}` : `미결정 (가장 가까운 ${r.final.nearest} ${L(r.final.nearest)}, 거리 ${r.final.d.toFixed(3)})`}`);
  for (const [s, t] of Object.entries(r.firstReach)) lines.push(`  도달 ${s} ${L(s)} @ ${h(t)}`);
  for (const c of r.commitment) lines.push(`  결정 ${c.to} ${L(c.to)} [${c.criterion}${c.driven ? '' : ', 신호 없음'}]: ${c.t != null ? h(c.t) : '없음'}${c.monotone === false ? ' (격자에서 단조 아님!)' : ''}${c.horizon ? ` · 철회 후 ${h(c.horizon)} 관찰` : ''}`);
  if (r.arrest) lines.push(`  분화 정지: ${r.arrest.t != null ? h(r.arrest.t) : '판정 보류'} · 목표 거리 ${r.arrest.d.toFixed(3)}${r.arrest.note ? ' — ' + r.arrest.note : ''}`);
  if (r.postMortem) {
    const p = r.postMortem;
    lines.push(`  사후 분석: 원인 ${p.cause}${p.alternative ? ` · 대신 ${p.alternative} ${L(p.alternative)}` : ''}${p.limiting ? ` · 제한 ${p.limiting.label} (${p.limiting.role})` : ''}`);
    for (const f of p.failing) lines.push(`    실패 표지 ${BL(f.bundle)}: ${+f.value.toPrecision(4)} (${f.level === 'high' ? '≥' : '≤'} ${f.need})`);
    for (const d of p.drivers) lines.push(`    조절 ${BL(d.modulator)} ${d.effect === 'activates' ? '→' : '⊣'} 배율 ${d.factor.toFixed(3)} (점유 ${(d.occupancy * 100).toFixed(1)}%)`);
    if (p.resource) lines.push(`    고갈 저장소 ${BL(p.resource.bundle)}: ${+p.resource.start.toPrecision(4)} → ${+Math.max(0, p.resource.end).toPrecision(4)} (규칙 ${p.resource.rule})${p.resource.t_exhausted != null ? ` — 고갈 시각 ${h(p.resource.t_exhausted)} (실패 지점)` : ''}`);
    lines.push(`    교정: ${p.suggestion}`);
  }
  for (const e of r.events) lines.push(`  사건 ${h(e.t)} ${e.type} ${BL(e.bundle)}`);
  const g = r.integrator;
  lines.push(`  적분 (Rodas3, rtol ${g.rtol} · atol ${g.atol}): 받아들인 단계 ${g.steps} · 거부 ${g.rejected} (음수 ${g.rejectedNeg}) · h ${+g.h.min.toPrecision(3)}–${+g.h.max.toPrecision(3)} s · Δ 당 ${g.perInterval.min}–${g.perInterval.max} 단계 · 결정 탐침 ${r.stats.probes} (라운드 ${r.stats.probeRounds}, 동시 ${r.stats.probeLanes})`);
  lines.push(`  질량 (사법부 독립 재계산): 부분 구조 원장 최대 상대 편차 ${r.mass.worst.toExponential(2)} · 재생 ${r.mass.replayWorst.toExponential(2)} · ${r.mass.moieties.map((k) => `${L(k)} ${+r.mass.start[k].toPrecision(6)} → ${+r.mass.end[k].toPrecision(6)} (소실 ${+(r.mass.channels.lost[k] || 0).toPrecision(4)})`).join(' · ')}`);
  if (r.kineticGaps.length) lines.push(`  속도 상수 없음(적용 안 함): ${r.kineticGaps.join(', ')}`);
  if (r.modulationGaps.length) lines.push(`  힐 상수 없음(배율 1): ${r.modulationGaps.join(', ')}`);
  for (const a of r.audit) lines.push(`  [${a.code} · ${a.fault}] ${a.where}: ${a.msg}${a.suggestion ? ' → ' + a.suggestion : ''}`);
  return { text: lines.join('\n'), code: r.audit.some((a) => a.code === 'AUDIT_MASS') ? 1 : 0 };
}

// 시나리오 맥락 (MHC 실험): 이 실행이 어떤 상태에 이르는 원인(cause)을 보이는가, 그 상태의 일반 상황(baseline)을 보이는가.
//   선언 일관성: cause — 대상 상태가 시작 상태에서 가는 전이의 목표이고, 그 전이의 신호가 일정에서 켜져 있어야 함
//               requirement — 같은 조건(신호 켜짐)에서 무엇을 끊으면 그 상태에 이르지 못하는지 보이는 실행 (필수성)
//               baseline — 대상 상태가 시작 상태이고, 어떤 전이도 구동되지 않아야 함
//   결과: cause 는 대상 상태 도달, requirement 는 도달하지 못함, baseline 은 끝까지 그 상태에 머묾 — 예측과의 차이로만 보고
function contextVerdict(r, sc) {
  const c = (sc || {}).context;
  if (!c) return { declared: false };
  const role = c.role, state = c.state, out = { declared: true, role, state, note: c.note || null, problems: [], rules: [] }, prob = (rule, m) => { out.problems.push(m); out.rules.push(rule); }; // rules[i] = problems[i] 의 규칙 번호
  if (!['cause', 'requirement', 'baseline'].includes(role)) prob('RULE-0172', `맥락 role '${role}' — cause | requirement | baseline`);
  if (!r.states.includes(state)) prob('RULE-0172', `맥락 상태 '${state}' 가 이 실행의 상태 집합에 없음`);
  const driven = r.transitions.filter((t) => t.driven);
  if (role === 'cause' || role === 'requirement') {
    if (state === r.source) prob('RULE-0172', `${role} 의 대상은 시작 상태가 아니라 전이의 목표여야 함`);
    else if (!driven.some((t) => t.to === state)) prob('RULE-0172', `'${state}' 로 가는 전이의 신호가 일정에서 켜지지 않음 — ${role === 'cause' ? '원인' : '필수성'}을 보이는 실행이 아님`);
    out.outcome = role === 'cause' ? r.firstReach[state] != null : r.firstReach[state] == null;
  } else if (role === 'baseline') {
    if (state !== r.source) prob('RULE-0172', 'baseline 의 대상은 시작 상태여야 함');
    if (driven.length) prob('RULE-0172', `전이 신호가 켜짐 (${driven.map((t) => t.to).join(', ')}) — 일반 상황이 아님`);
    out.outcome = r.final.state === state && (r.trajectory || []).every((x) => x.cls.state === state || x.cls.state == null);
  }
  out.consistent = !out.problems.length;
  return out;
}

module.exports = { contextVerdict, judgeFate, trajectoryHash, markerL2, postMortem, fateSuggest, fateText, distanceFns, concFns };
