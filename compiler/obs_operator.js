// 컴파일러 — 관찰 연산자 (Observation Operator). docs/design/observation-port.md · engine-port-roadmap.md 4단계
//
// 측정 장치의 성질(보정)과, 모델 원자료 → 측정량 대응을 엔진 밖에서 흡수한다. 순수 함수: 쓰기·판정·엔진 호출 없음.
//   · calibrate(cal, raw): 읽은 값 → SI 값. identity · linear(a·raw + b) · table(raw 오름차순 점 사이 선형 보간, 범위 밖은 NaN — 보정하지 않은 영역)
//   · hash(cal): 보정의 정준 JSON sha256 — 같은 원본·같은 보정이면 같은 해시 (관찰 기록의 재변환 확인)
// 엔진은 이 모듈을 부르지 않는다 (엔진은 관찰을 모른다). 입법부 관문(사법부 검사)과 사법부 관찰 비교가 같은 함수를 쓴다.
// 경로 IR 처럼 브라우저(viewer — 관문 미리 보기)에서도 읽히므로 UMD — 해시는 Node(crypto)에서만.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('crypto'));
  else root.DefDBObsOp = factory(null);
})(typeof self !== 'undefined' ? self : this, function (crypto) {
'use strict';

const canon = (o) => (Array.isArray(o) ? `[${o.map(canon).join(',')}]` : o && typeof o === 'object' ? `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => JSON.stringify(k) + ':' + canon(o[k])).join(',')}}` : JSON.stringify(o));

function calibrate(cal, raw) {
  const kind = (cal && cal.kind) || 'identity';
  if (kind === 'identity') return raw;
  if (kind === 'linear') return cal.a * raw + cal.b;
  if (kind === 'table') {
    const P = cal.points;
    if (!(raw >= P[0][0] && raw <= P[P.length - 1][0])) return NaN;
    let i = 1; while (P[i][0] < raw) i++;
    const [x0, y0] = P[i - 1], [x1, y1] = P[i];
    return raw === x1 ? y1 : y0 + ((y1 - y0) * (raw - x0)) / (x1 - x0);
  }
  return NaN;
}

const hash = (cal) => (crypto ? crypto.createHash('sha256').update(canon(cal || { kind: 'identity' })).digest('hex') : null);

return Object.freeze({ calibrate, hash, canon });
});
