// 사법부 — 결함 출처 분류 (Fault Origin). docs/design/engine-port-roadmap.md §5
//
// 모든 감사 항목에 결정론적 태그를 붙여, 고치는 사람(에이전트)이 엉뚱한 층을 고치지 않게 한다.
// 특히 수치 문제를 생물 상수로 '맞추는' 무한 수정 고리와, 생물학적 결과(고갈·정지)를 결함으로 오인하는 것을 막는다.
// 태그는 감사 항목을 만드는 곳에서 명시한다 (메시지 문자열에서 추측하지 않음). 이 파일은 표와 확인만 갖는다.
'use strict';
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DefDBFault = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const FAULTS = {
    FINDING:         { label: '결과 (결함 아님)', route: '고치지 않는다 — 결과로 보고. 재생 경로가 없으면 한계(Resource_Gap 등)로 등록', fix: 'none' },
    DATA_GAP:        { label: '데이터 공백', route: '한계 등록부에 등록하고, 확인된 값만 패치로 채운다 (지어내지 않음)', fix: 'limitation' },
    DOMAIN_CONFLICT: { label: '데이터 모순 (규칙·화학량·상수·관찰 사이)', route: '근거와 함께 데이터 패치 (입법) — 모순의 어느 쪽이 틀렸는지 근거로 정함', fix: 'data' },
    NUMERICAL:       { label: '수치 문제', route: 'engine/coupling.js 결합점 또는 솔버 단계 제어 (행정) — 생물 상수(db.json)를 바꾸지 않는다', fix: 'numerics' },
    ENGINE_DEFECT:   { label: '엔진 결함', route: '엔진 코드 (행정) — 데이터·결합점을 바꿔 덮지 않는다', fix: 'engine' },
    COMPILER_DEFECT: { label: '컴파일러 결함', route: 'compiler/ (IR·기호 미분·테이프) — 엔진·데이터를 바꿔 덮지 않는다', fix: 'compiler' },
  };
  const isFault = (f) => Object.prototype.hasOwnProperty.call(FAULTS, f);
  const tag = (a) => `[${a.code} · ${a.fault}]`;
  // 감사 목록의 태그 확인 — 태그 없는 항목은 판정 체계 오류
  const untagged = (list) => list.filter((a) => !isFault(a.fault));
  const routeText = (f) => (isFault(f) ? `${FAULTS[f].label} → ${FAULTS[f].route}` : '태그 없음');
  return Object.freeze({ FAULTS, isFault, tag, untagged, routeText });
});
