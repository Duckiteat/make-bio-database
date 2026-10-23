// 사법부 — 첫 장면 기원 감사 (Scene Origin). 실험의 시작 상태가 어디서 왔는지 입력마다 분류한다.
//
// 시나리오가 주는 것(시작량·부피·신호·문턱·완충·속도 상수 덮어쓰기)과, 계가 쓰는 db 규칙의 숫자(화학량·속도 상수)를 하나씩:
//   measured   — db 값이 관찰(O…)·실측 근거에 매임 (등급은 reliability 가 따로)
//   abstracted — db 에 있으나 근거가 추상·추론(abstracted·predicted) — 숫자의 출처가 기록되지 않음
//   assumed    — 시나리오의 가상 값, 그 대상을 다루는 열린 한계(L…)가 있음 — 정직하게 공백으로 등록됨
//   unrecorded — 시나리오의 가상 값인데 어떤 한계도 그 대상을 다루지 않음 — 기원이 어디에도 없음
// 판정만 한다(읽기·쓰기·엔진 없음). 계의 규칙 집합은 컴파일러 조립(엔진이 먹는 것)과 같다.
'use strict';
const M = require('../model.js');
const IRB = require('../compiler/ir_builder.js');
const { limitationStatus } = require('./judicial.js');

const baseOf = (ref) => String(ref || '').split('|')[0].split('/')[0];
const MEASURED_LEVELS = new Set(['curated', 'computed']);
// 입력 종류마다 그 숫자의 기원을 실제로 말하는 한계 종류만 인정한다 (다른 공백 — 예: 정체성·조절 매개 — 은 시작량의 기원이 아니다)
const RELEVANT = {
  amounts: ['Concentration_Gap', 'Resource_Gap', 'Observation_Gap'], thresholds: ['Concentration_Gap', 'Observation_Gap'],
  buffered: ['Concentration_Gap', 'Resource_Gap', 'Observation_Gap'], signals: ['Concentration_Gap', 'Observation_Gap'],
  kinetics: ['Kinetic_Gap', 'Regulatory_Gap', 'Observation_Gap'], stoichiometry: ['Kinetic_Gap', 'Structural_Gap', 'Observation_Gap'],
};

function sceneOrigin(db, scenario, opt = {}) {
  db = M.normalize(db);
  const ix = M.index(db), sc = scenario || {}, target = opt.target;
  const kind = (db.senses[target] || {}).kind;
  // 열린 한계가 다루는 것: 대상 + needs 의 규칙·부위·정의항 (정확한 ref 와 기준 정의항 둘 다)
  const cover = new Map(), types = new Map();
  for (const [id, l] of Object.entries(db.limitations)) {
    if (limitationStatus(db, l).status.startsWith('resolved')) continue;
    const refs = [l.target, ...l.requirement.needs.flatMap((n) => [n.rule, n.site, n.on].filter(Boolean))];
    for (const r of refs) for (const k of [r, baseOf(r)]) { if (!cover.has(k)) cover.set(k, new Set()); cover.get(k).add(id); }
    types.set(id, l.type);
  }
  const coveredBy = (ref, field) => [...new Set([...(cover.get(ref) || []), ...(cover.get(baseOf(ref)) || [])])].filter((id) => RELEVANT[field].includes(types.get(id))).sort();
  const rows = [];
  const scen = (field, key, value, ref) => { const L = coveredBy(ref, field); rows.push({ where: 'scenario', field, key, label: ix.bundleLabel ? (ix.bundleLabel(key) || key) : key, value, origin: L.length ? 'assumed' : 'unrecorded', limitations: L }); };
  for (const [k, v] of Object.entries(sc.amounts || {})) scen('amounts', k, v, k);
  for (const [k, v] of Object.entries(sc.signals || {})) scen('signals', k, (Array.isArray(v) ? v : []).map((p) => `t=${p.t}: ${p.n}`).join(', '), k);
  for (const [k, v] of Object.entries(sc.thresholds || {})) scen('thresholds', k, `${v.low} · ${v.high}`, k);
  for (const [k, v] of Object.entries(sc.buffered || {})) scen('buffered', k, `${v.conc_M} M`, k);
  for (const [k, v] of Object.entries(sc.kinetics || {})) scen('kinetics', k, Object.entries(v).filter(([f]) => M.KIN_VALUE_FIELDS.includes(f)).map(([f, x]) => `${f}=${x}`).join(' '), k);
  // 부피: 한계의 해결 경로 obs compartment_volume(위치, 세포) 로 다뤄진다 — 시나리오의 세포와 같거나 세포 미지정인 것만
  const volCover = (loc) => Object.entries(db.limitations).filter(([, l]) => !limitationStatus(db, l).status.startsWith('resolved') && l.requirement.needs.some((n) => n.kind === 'obs' && n.property === 'compartment_volume' && n.location === loc && (!n.cell || !sc.cell || n.cell === sc.cell))).map(([id]) => id).sort();
  for (const [k, v] of Object.entries(sc.volumes || {})) { const L = volCover(k); rows.push({ where: 'scenario', field: 'volumes', key: k, label: k, value: `${v.value} ${v.unit}`, origin: L.length ? 'assumed' : 'unrecorded', limitations: L }); }

  // 계가 쓰는 db 규칙의 숫자: 화학량(n ≠ 1) · db 속도 상수 (시나리오가 덮어쓴 상수는 위에서 셈)
  let ruleRefs = [];
  if (kind === 'cell_state') { const A = IRB.assemble(db, target, sc); if (A.error) return { error: A.error }; ruleRefs = [...new Set(A.rules.map((R) => R.ref).concat(A.rules.flatMap((R) => (R.mods || []).map((m) => m.ref))))]; }
  else if (kind === 'pathway') ruleRefs = [...new Set(ix.stepsIn(target).map((s) => db.steps[s].rule))];
  for (const ref of ruleRefs.sort()) {
    const r = ix.ruleOf(ref); if (!r) continue;
    const ev = r.evidence || {}, lvl = ev.level;
    const stoich = [...(r.consumes || []), ...(r.produces || [])].filter((q) => q.n != null && q.n !== 1);
    if (stoich.length) {
      const L = coveredBy(ref, 'stoichiometry');
      rows.push({ where: 'db', field: 'stoichiometry', key: ref, label: r.label || ref, value: stoich.map((q) => `${ix.label(q.ref)} ×${q.n}`).join(' · '),
        origin: MEASURED_LEVELS.has(lvl) ? 'measured' : 'abstracted', evidence: lvl || null, basis: ev.basis || null, limitations: L });
    }
    if (r.kinetics && !(sc.kinetics || {})[ref]) {
      const k = r.kinetics, kl = k.evidence && k.evidence.level, from = (k.from || []).map((x) => x.obs);
      rows.push({ where: 'db', field: 'kinetics', key: ref, label: r.label || ref, value: Object.entries(k).filter(([f]) => M.KIN_VALUE_FIELDS.includes(f)).map(([f, x]) => `${f}=${x}`).join(' '),
        origin: from.length || MEASURED_LEVELS.has(kl) ? 'measured' : 'abstracted', evidence: kl || null, from, limitations: coveredBy(ref, 'kinetics') });
    }
  }
  const count = {}; for (const r of rows) count[r.origin] = (count[r.origin] || 0) + 1;
  return { target, kind, rows, count, hypothetical: !!sc.hypothetical };
}

const ORIGIN_KO = { measured: '실측에 매임', abstracted: 'db 에 있으나 숫자 출처 없음(추상·추론)', assumed: '가상 값 — 한계로 등록됨', unrecorded: '가상 값 — 기원 기록 없음' };
function sceneOriginText(v, name) {
  if (v.error) return `첫 장면 기원: ${v.error}`;
  const o = [`첫 장면 기원 — ${name || ''} (대상 ${v.target} · ${v.kind}) · ${Object.entries(v.count).map(([k, n]) => `${ORIGIN_KO[k]} ${n}`).join(' · ')}`];
  for (const k of ['unrecorded', 'abstracted', 'assumed', 'measured']) for (const r of v.rows.filter((x) => x.origin === k))
    o.push(`  ${k === 'measured' ? '●' : k === 'assumed' ? '◐' : '✗'} [${r.where}·${r.field}] ${r.label} = ${r.value} — ${ORIGIN_KO[k]}${r.limitations && r.limitations.length ? ` (${r.limitations.join(', ')})` : ''}${r.evidence ? ` · 근거 ${r.evidence}` : ''}${r.note ? ` · ${r.note}` : ''}`);
  return o.join('\n');
}

module.exports = { sceneOrigin, sceneOriginText, ORIGIN_KO };
