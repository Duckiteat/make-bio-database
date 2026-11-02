// 내부 일관성 (ASY-14 · 자료 무결성 보고서의 제안) — 원문 안의 앞뒤가 맞는지: SEM = SD/√n · 정수 자료의 평균(GRIM) · SD 와 SEM 을 바꿔 적은 흔적.
// 계약: 순수 — 값만 받고 값만 돌려준다 (읽기·쓰기·실행 없음, 사법부). 걸리면 거부가 아니라 사유를 붙여 사람에게 (원문이 틀렸을 수 있다).
//   쓰는 곳: 지금은 시험뿐 — 관찰 형식에 sem · n · 평균 칸이 아직 없다 (형식 변경은 사용자 요청이 있을 때, RULE-0261).
// 정확한 유리수 원칙(ASY-08): 평균 · 반올림은 정수로 센다 — 부동소수 오차로 가능한 평균을 불가능이라 하지 않는다.
const R = 'RULE-0530'; // 이 검사가 사유 앞에 붙이는 규칙 번호
// 적힌 소수 자리수 — 글자에서 읽는다 ('2.0' 은 1 자리, 숫자 2.0 은 끝의 0 이 사라져 0 자리). 원문에 적힌 그대로의 글을 넘겨야 정확하다
const dec = (x) => { const s = String(x); const i = s.indexOf('.'); return i < 0 ? 0 : s.length - i - 1; };
const toInt = (x, d) => Math.round(x * 10 ** d); // 소수 d 자리 수를 정수로 (적힌 자리수 안에서만)

// GRIM — n 개의 정수를 더해 평균을 낸 값을 소수 d 자리로 적었다면, 그 평균이 될 수 있는 정수 합이 있어야 한다.
//   평균 m(d 자리)이 되려면 정수 합 S 가 (m - 0.5·10^-d) ≤ S/n < (m + 0.5·10^-d) — 양변에 2·10^d·n 을 곱해 정수로 비교
export function grimPossible(mean, n, decimals = dec(mean)) { // mean: 적힌 그대로의 글 또는 수
  if (!Number.isInteger(n) || n < 1) return null; // 판정할 수 없음
  const M = toInt(Number(mean), decimals), P = 10 ** decimals;
  const lo = Math.ceil(((2 * M - 1) * n) / (2 * P)), hi = Math.floor(((2 * M + 1) * n - 1) / (2 * P));
  for (let S = lo; S <= hi; S++) if (2 * S * P >= (2 * M - 1) * n && 2 * S * P < (2 * M + 1) * n) return true;
  return false;
}

// SD ↔ SEM — SEM = SD/√n. 적힌 자리수의 반올림 오차 안에서 맞아야 한다.
//   SEM 이 SD 보다 크면(n > 1) SD 와 SEM 을 바꿔 적은 흔적 — 어떤 n > 1 에서도 SEM ≤ SD
export function sdSem({ sd: sdIn, sem: semIn, n, sdDecimals = dec(sdIn), semDecimals = dec(semIn) }) { // sd · sem: 적힌 그대로의 글 또는 수
  const sd = Number(sdIn), sem = Number(semIn);
  if (!(n > 1) || !(sd >= 0) || !(sem >= 0)) return { kind: 'unchecked' };
  if (sem > sd) return { kind: 'swapped', expected: sd / Math.sqrt(n) };
  const expected = sd / Math.sqrt(n), tol = (0.5 * 10 ** -sdDecimals) / Math.sqrt(n) + 0.5 * 10 ** -semDecimals + 1e-12;
  return Math.abs(sem - expected) <= tol ? { kind: 'ok', expected } : { kind: 'mismatch', expected, tol };
}

// 한 기록의 사유들 — rec = { mean?, sd?, sem?, n?, integer? }. 걸린 것의 사유 문장 목록 (비어 있으면 맞거나 판정할 재료가 없음)
export function consistencyNotes(rec) {
  const out = [], { mean, sd, sem, n, integer } = rec || {};
  if (sd != null && sem != null && n != null) {
    const r = sdSem({ sd, sem, n });
    if (r.kind === 'swapped') out.push(`${R} SEM(${sem}) 이 SD(${sd}) 보다 큼 — n=${n} > 1 이면 SEM ≤ SD 라서 SD 와 SEM 을 바꿔 적은 흔적 (원문 확인)`);
    else if (r.kind === 'mismatch') out.push(`${R} SEM ${sem} ≠ SD/√n = ${r.expected.toPrecision(4)} (허용 ±${r.tol.toPrecision(2)}) — n 이나 SD 가 다르게 적혔을 수 있음 (원문 확인)`);
  }
  if (integer === true && mean != null && n != null && grimPossible(mean, n) === false) out.push(`${R} 정수 자료 ${n} 개의 평균이 ${mean} 일 수 없음 (GRIM) — 평균이나 n 이 다르게 적혔을 수 있음 (원문 확인)`);
  return out;
}
