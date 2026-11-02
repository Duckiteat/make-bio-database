// 결정론 수학 (Deterministic Math) — pow · log · exp 를 사칙연산과 비트 연산만으로 (PLAN-021)
//
// 이유: 엔진 안의 거듭제곱·로그·지수는 JS(V8)와 Rust(libm 크레이트)가 서로 다른 구현이라 입력의 몇 퍼센트에서 마지막 한 자리(1 ulp)가 다르다.
//   그 차이가 걸음 수락·난수 수락 같은 이산 결정을 갈라 경로를 가른다. 여기서는 사칙연산(IEEE 754 가 정확한 반올림을 요구)과
//   정확한 연산(floor · sqrt · 비트 조작)만 써서 한 번 쓰고, engine/rust/src/detmath.rs 가 같은 계수 · 같은 연산 순서로 옮긴다 — 같은 입력이면 비트까지 같다.
// 약속: ① 외부 Math.pow · Math.exp · Math.log 를 부르지 않는다 ② 곱셈과 덧셈을 합치지 않는다(FMA 없음 — 빌드가 검사) ③ 계수는 십진 리터럴(두 언어가 같게 읽음)
// 정밀도: 목표 ≤ 1 ulp (tests/detmath.test.mjs 가 고정밀 기준값과 대조해 확인한다). 정수 지수는 곱셈 반복(정확한 반올림 몇 번), 그 밖은 두 배 정밀도 로그 · 지수.
// 순수 함수: 쓰기 · 판정 · 엔진 호출 없음. 브라우저에서도 읽히므로 UMD.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DefDBDetMath = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ----- 비트 조작 (리틀 엔디언 — x86 · WASM) -----
  const F = new Float64Array(1), U = new Uint32Array(F.buffer);
  if ((F[0] = 1, U[1]) !== 0x3ff00000) throw new Error('detmath: 리틀 엔디언이 아님');
  const pow2 = (j) => { U[0] = 0; U[1] = (j + 1023) << 20; return F[0]; }; // 2^j, -1022 ≤ j ≤ 1023
  // frexp 변형: x > 0 유한 → [가수 m ∈ [√½, √2), 지수 e], x = m · 2^e
  const split = (x) => {
    let e = 0;
    if (x < 2.2250738585072014e-308) { x *= 18014398509481984; e = -54; } // 2^54 로 키워 부정규 수를 정규 수로
    F[0] = x;
    const be = (U[1] >>> 20) & 0x7ff;
    e += be - 1022;
    U[1] = (U[1] & 0x800fffff) | (1022 << 20); // 지수 부분을 0.5 ≤ m < 1 로
    let m = F[0];
    if (m < 0.7071067811865476) { m *= 2; e -= 1; }
    return [m, e];
  };

  // ----- 두 배 정밀도 도우미 (Dekker · Knuth, FMA 없음) -----
  const twoSum = (a, b) => { const s = a + b, bb = s - a; return [s, (a - (s - bb)) + (b - bb)]; };
  const fastTwoSum = (a, b) => { const s = a + b; return [s, b - (s - a)]; }; // |a| ≥ |b|
  const SPLIT = 134217729; // 2^27 + 1
  const twoProd = (a, b) => {
    const p = a * b, c1 = SPLIT * a, ah = c1 - (c1 - a), al = a - ah, c2 = SPLIT * b, bh = c2 - (c2 - b), bl = b - bh;
    return [p, ((ah * bh - p) + ah * bl + al * bh) + al * bl];
  };

  const mulDD = (ah, al, bh, bl) => { const [p, e] = twoProd(ah, bh); return fastTwoSum(p, e + (ah * bl + al * bh)); };

  // ----- 상수 -----
  const LN2_HI = 6.93147180369123816490e-01, LN2_LO = 1.90821492927058770002e-10, INV_LN2 = 1.4426950408889634; // LN2_HI 는 뒤쪽 비트가 0 이라 k·LN2_HI 가 정확
  // 1/n! (n = 1 … 15) — exp(r) − 1 = r · (c1 + r · (c2 + …))
  const EC = [1.0, 0.5, 0.16666666666666666, 0.041666666666666664, 0.008333333333333333, 0.001388888888888889, 0.0001984126984126984, 2.48015873015873e-05, 2.7557319223985893e-06, 2.755731922398589e-07, 2.505210838544172e-08, 2.08767569878681e-09, 1.6059043836821613e-10, 1.1470745597729725e-11, 7.647163731819816e-13];
  // 1/(2k+1) (k = 1 … 12) — atanh(s) = s · (1 + s² · (a1 + s² · (a2 + …)))
  const AC = [0.3333333333333333, 0.2, 0.14285714285714285, 0.1111111111111111, 0.09090909090909091, 0.07692307692307693, 0.06666666666666667, 0.058823529411764705, 0.05263157894736842, 0.047619047619047616, 0.043478260869565216, 0.04];
  const EXP_OVER = 709.782712893384, EXP_UNDER = -745.1332191019412;

  // ----- 로그: 두 배 정밀도 [hi, lo] (x > 0 유한) -----
  function logDD(x) {
    if (x !== x || x < 0) return [NaN, 0];
    if (x === 0) return [-Infinity, 0];
    if (x === Infinity) return [Infinity, 0];
    const [m, e] = split(x);
    const n = m - 1; // 정확 (스테르벤츠)
    const [dh, dl] = twoSum(m, 1);
    // s = n / (dh + dl) — 두 배 정밀도 나눗셈
    const q1 = n / dh, [p, pe] = twoProd(q1, dh);
    const rem = ((n - p) - pe) - q1 * dl, q2 = rem / dh;
    const [sh, sl] = fastTwoSum(q1, q2);
    const s2 = sh * sh;
    let t = AC[11];
    for (let k = 10; k >= 0; k--) t = AC[k] + s2 * t;
    t = s2 * t; // s² · (1/3 + s² · (1/5 + …))
    const A = 2 * sh, B = 2 * sl + 2 * sh * t; // log m = A + B
    const C = e * LN2_HI, D = e * LN2_LO;
    const [h, l0] = twoSum(C, A);
    return fastTwoSum(h, l0 + (B + D));
  }

  // ----- 지수: 두 배 정밀도 인수 hi + lo -----
  function expDD(hi, lo) {
    if (hi !== hi || lo !== lo) return NaN;
    if (hi > EXP_OVER) return Infinity;
    if (hi < EXP_UNDER) return 0;
    const k = Math.floor(hi * INV_LN2 + 0.5);
    const r1 = hi - k * LN2_HI, r2 = lo - k * LN2_LO;
    // exp(r1) = 1 + r1 + r1²/2 + (r1³ 이상): 앞 세 항은 두 배 정밀도(r1² 의 곱 오차를 남김), 나머지는 호너
    let q = EC[14];
    for (let i = 13; i >= 2; i--) q = EC[i] + r1 * q;
    const rest = r1 * (r1 * r1) * q; // r1³/6 + r1⁴/24 + …
    const [p2, e2] = twoProd(r1, r1);
    const [a1, b1] = twoSum(1, r1);
    const [a, b2] = twoSum(a1, 0.5 * p2);
    const low = ((b1 + b2) + 0.5 * e2) + rest;
    const tot = a + low; // exp(r1) 의 보통 정밀도 값 — r2 는 작아서(≤ 1e-9) 이 값으로 곱해도 충분
    const res = a + (low + tot * r2); // exp(r1) · (1 + r2)
    // 2^k 곱: 지수 범위를 두 번에 나눠 넘침 · 부정규 수에서도 안전
    if (k > 1023) return res * pow2(1023) * pow2(k - 1023);
    if (k < -1022) return res * pow2(k + 1000) * pow2(-1000);
    return res * pow2(k);
  }

  const log = (x) => logDD(x)[0];
  const exp = (x) => expDD(x, 0);

  // ----- 거듭제곱 -----
  function pow(x, y) {
    if (y === 0) return 1;
    if (x !== x || y !== y) return NaN;
    if (x === 1) return 1;
    const yInt = Math.floor(y) === y && y > -1e15 && y < 1e15;
    if (x < 0) { // 음수 밑은 정수 지수일 때만
      if (!yInt) return NaN;
      const r = pow(-x, y);
      return (Math.abs(y) % 2 === 1) ? -r : r;
    }
    if (x === 0) return y > 0 ? 0 : Infinity;
    if (x === Infinity) return y > 0 ? Infinity : 0;
    if (y === Infinity || y === -Infinity) { if (x === 1) return 1; return ((x > 1) === (y > 0)) ? Infinity : 0; }
    if (yInt && y >= -64 && y <= 64) { // 정수 지수: 두 배 정밀도 곱셈 반복 (제곱 · 곱의 순서가 고정)
      if (y === 1) return x;
      let n = y < 0 ? -y : y, bh = x, bl = 0, rh = 1, rl = 0;
      while (n > 0) {
        if (n % 2 === 1) { const m = mulDD(rh, rl, bh, bl); rh = m[0]; rl = m[1]; }
        n = Math.floor(n / 2);
        if (n > 0) { const m = mulDD(bh, bl, bh, bl); bh = m[0]; bl = m[1]; }
      }
      if (y > 0) return rh + rl;
      const q1 = 1 / rh, [pp, pe] = twoProd(q1, rh), rem = ((1 - pp) - pe) - q1 * rl; // 1 / (rh + rl) 두 배 정밀도
      return q1 + rem / rh;
    }
    const [lh, ll] = logDD(x);
    const [ph, pe] = twoProd(y, lh);
    const [h, l] = fastTwoSum(ph, pe + y * ll);
    return expDD(h, l);
  }

  return Object.freeze({ pow, log, exp, logDD, expDD });
});
