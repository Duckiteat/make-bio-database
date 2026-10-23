// 사법부 — 결함 출처 분류 (Fault Origin). docs/design/engine-port-roadmap.md §5
//
// 모든 감사 항목에 결정론적 태그를 붙여, 고치는 사람(에이전트)이 엉뚱한 층을 고치지 않게 한다.
// 특히 수치 문제를 생물 상수로 '맞추는' 무한 수정 고리와, 생물학적 결과(고갈·정지)를 결함으로 오인하는 것을 막는다.
// 태그는 감사 항목을 만드는 곳에서 명시한다 (메시지 문자열에서 추측하지 않음). 표는 vocab.faultChannels, 이 파일은 확인만 갖는다.
'use strict';
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../vocab.js'));
  else root.DefDBFault = factory(root.DefDBVocab);
})(typeof self !== 'undefined' ? self : this, function (V) {
  // 표(데이터)는 vocab.faultChannels 에 — 이 파일은 태그 확인·렌더 로직만. note = 고치는 곳(route)
  const FAULTS = V.faultChannels;
  const isFault = (f) => Object.prototype.hasOwnProperty.call(FAULTS, f);
  const tag = (a) => `[${a.code} · ${a.fault}]`;
  // 감사 목록의 태그 확인 — 태그 없는 항목은 판정 체계 오류
  const untagged = (list) => list.filter((a) => !isFault(a.fault));
  const routeText = (f) => (isFault(f) ? `${FAULTS[f].label} → ${FAULTS[f].note}` : '태그 없음');
  return Object.freeze({ FAULTS, isFault, tag, untagged, routeText });
});
