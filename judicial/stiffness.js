// 사법부 — 강성 프로파일 진단 (build-plan 46). 운명 엔진이 낸 적분 진단(integrator·rules)만 읽어 "왜 느린가"를 분류한다.
//   판정만 한다 — 엔진 실행·데이터 수정·쓰기 없음. 느림(시간척도 분리·큰 LU·거부)은 결과지 결함이 아니다(fault.js: 결과를 결함으로 고치지 않음).
//   예외: 최소 단계 바닥에서 허용 오차를 못 맞추고 받아들인 경우(hMinHits>0)만 정확도가 타협되어 NUMERICAL 후보 — 결합점·솔버(생물 상수 아님). L000113 의 증상.
//   문턱은 판정(분류) 컷이다 — 엔진 수치가 아니라 보고 임계라 여기 둔다(engine/coupling.js 는 시뮬레이션 수치만).
'use strict';
const REJ_STORM = 0.5; // 거부/(받아들임+거부) 가 이 위면 단계 거부 폭주
const H_SPREAD = 1e6;  // h.max/h.min 가 이 위고 거부가 적으면 넓은 시간척도를 작은 받아들인 단계로 흡수 (강성)
const LU_LARGE = 40;   // 활성 규칙 수가 이 위면 단계당 희소 LU 비용이 지배

function stiffnessProfile(r) {
  const ig = r.integrator || {}, h = ig.h || {}, nAct = (r.rules || []).filter((x) => x.active).length;
  const accepted = ig.steps || 0, rejected = ig.rejected || 0, total = accepted + rejected;
  const rejFrac = total ? rejected / total : 0;
  const hSpread = h.min > 0 ? h.max / h.min : Infinity;
  const flags = [];
  if (ig.hMinHits > 0) flags.push('h_min_floor');
  if (rejFrac > REJ_STORM) flags.push('rejection_storm');
  if (hSpread > H_SPREAD && rejFrac <= REJ_STORM) flags.push('timescale_separation');
  if (nAct > LU_LARGE) flags.push('lu_cost');
  return { nAct, accepted, rejected, rejFrac, hSpread, hMinHits: ig.hMinHits || 0, flags: flags.length ? flags : ['well_conditioned'], fault: ig.hMinHits > 0 ? 'NUMERICAL' : 'FINDING' };
}

const LABEL = Object.fromEntries(Object.entries(require('../vocab.js').stiffnessFlags).map(([k, v]) => [k, v.label])); // 표지 토큰 → 라벨 (표는 vocab)
function stiffnessText(p) {
  return `강성 프로파일 [${p.fault}]: ${p.flags.map((f) => LABEL[f] || f).join(' · ')} — 활성 규칙 ${p.nAct}, 받아들인 ${p.accepted}·거부 ${p.rejected}(${(100 * p.rejFrac).toFixed(1)}%), h 범위 ${Number.isFinite(p.hSpread) ? Number(p.hSpread.toPrecision(3)) + '×' : '∞'}, 최소단계 바닥 ${p.hMinHits}`;
}
module.exports = { stiffnessProfile, stiffnessText };
