// 컴파일러 — 관찰 연산자 (Observation Operator). docs/design/observation-port.md · engine-port-roadmap.md 4단계
//
// 측정 장치의 성질(보정)과, 모델 원자료 → 측정량 대응을 엔진 밖에서 흡수한다. 순수 함수: 쓰기·판정·엔진 호출 없음.
//   · calibrate(cal, raw): 읽은 값 → SI 값. identity · linear(a·raw + b) · table(raw 오름차순 점 사이 선형 보간, 범위 밖은 NaN — 보정하지 않은 영역)
//   · hash(cal): 보정의 정준 JSON sha256 — 같은 원본·같은 보정이면 같은 해시 (관찰 기록의 재변환 확인)
//   · predict(o, raws): 운명 원자료(하나 = 결정론, 여럿 = 앙상블) → 측정량 표본 [실행마다 하나]
//       amount: 묶음의 분자 수, condition.time_s 에서(기록점 사이 선형 보간, 없으면 끝 상태) · concentration: N / (NA · V[위치])
//       fraction: 대상 세포 상태에 time_s(없으면 끝)까지 도달한 실행이면 1, 아니면 0 · event_time: 첫 도달 시각(도달 못 하면 Infinity — 중도 절단)
// 엔진은 이 모듈을 부르지 않는다 (엔진은 관찰을 모른다). 입법부 관문(사법부 검사)과 사법부 관찰 비교가 같은 함수를 쓴다.
// 경로 IR 처럼 브라우저(viewer — 관문 미리 보기)에서도 읽히므로 UMD — 해시는 Node(crypto)에서만.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('crypto'), require('../model.js'));
  else root.DefDBObsOp = factory(null, root.DefDBModel);
})(typeof self !== 'undefined' ? self : this, function (crypto, M) {
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

function at(raw, b, t) {
  const k = raw.keys.indexOf(b);
  if (k < 0) return NaN;
  const T = raw.process.times, S = raw.series, N0 = raw.process.N0[k];
  if (t == null || t >= T[T.length - 1]) return S[S.length - 1][k];
  if (t <= 0) return N0;
  let j = 0; while (T[j] < t) j++;
  const t0 = j ? T[j - 1] : 0, v0 = j ? S[j - 1][k] : N0;
  return t === T[j] ? S[j][k] : v0 + ((S[j][k] - v0) * (t - t0)) / (T[j] - t0);
}
function predict(o, raws) {
  const NA = M.NA; // 아보가드로 수는 공유 헌법 층(model.js)에서만
  const ob = o.observable, t = o.condition && o.condition.time_s;
  // 측정이 못 가르는 형태(자유형·결합형 …)는 합산한다 — ob.also 로 선언. 없으면 대상 하나(옛 동작과 비트 동일)
  const forms = ob.also && ob.also.length ? [ob.target, ...ob.also] : [ob.target];
  return raws.map((raw) => {
    if (ob.kind === 'amount') return forms.reduce((s, b) => s + at(raw, b, t), 0);
    if (ob.kind === 'concentration') {
      const loc = ob.target.split('|').pop(), V = raw.volumes[loc];
      if (!(V > 0)) return NaN;
      let N = 0; for (const b of forms) { if (b.split('|').pop() !== loc) return NaN; N += at(raw, b, t); } // 농도 합산은 같은 위치만
      return N / (NA * V);
    }
    if (ob.kind === 'ratio') { const den = at(raw, ob.denominator, t); return den > 0 ? forms.reduce((s, b) => s + at(raw, b, t), 0) / den : NaN; } // 무차원 비 — 분자는 also 합산 가능, 분모는 하나
    const r = raw.firstReach[ob.target];
    if (ob.kind === 'fraction') return r != null && (t == null || r <= t) ? 1 : 0;
    if (ob.kind === 'event_time') return r != null ? r : Infinity;
    return NaN; // kinetic_constant 는 실행에서 나오지 않음 — 추정용 관찰
  });
}

return Object.freeze({ calibrate, hash, canon, predict, at });
});
