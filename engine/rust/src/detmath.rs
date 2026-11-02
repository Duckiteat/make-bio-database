//! 결정론 수학 (PLAN-021) — compiler/detmath.js 와 같은 계수 · 같은 연산 순서. pow · log · exp 를 사칙연산과 비트 연산만으로.
//!   약속: libm::pow · libm::log · libm::exp 를 부르지 않는다 · 곱셈과 덧셈을 합치지 않는다(FMA 없음 — 빌드 스크립트가 검사).
//!   쓰는 정확한 연산: floor · 비트 조작 · 사칙연산 (IEEE 754 가 정확한 반올림을 요구). 할당 없음.

const LN2_HI: f64 = 6.93147180369123816490e-01;
const LN2_LO: f64 = 1.90821492927058770002e-10;
const INV_LN2: f64 = 1.4426950408889634;
const EC: [f64; 15] = [1.0, 0.5, 0.16666666666666666, 0.041666666666666664, 0.008333333333333333, 0.001388888888888889, 0.0001984126984126984, 2.48015873015873e-05, 2.7557319223985893e-06, 2.755731922398589e-07, 2.505210838544172e-08, 2.08767569878681e-09, 1.6059043836821613e-10, 1.1470745597729725e-11, 7.647163731819816e-13];
const AC: [f64; 12] = [0.3333333333333333, 0.2, 0.14285714285714285, 0.1111111111111111, 0.09090909090909091, 0.07692307692307693, 0.06666666666666667, 0.058823529411764705, 0.05263157894736842, 0.047619047619047616, 0.043478260869565216, 0.04];
const EXP_OVER: f64 = 709.782712893384;
const EXP_UNDER: f64 = -745.1332191019412;
const SPLIT: f64 = 134217729.0;

#[inline]
fn pow2(j: i32) -> f64 { f64::from_bits(((j + 1023) as u64) << 52) }

/// x > 0 유한 → (가수 m ∈ [√½, √2), 지수 e), x = m · 2^e
#[inline]
fn split(mut x: f64) -> (f64, i32) {
    let mut e = 0i32;
    if x < 2.2250738585072014e-308 { x *= 18014398509481984.0; e = -54; }
    let bits = x.to_bits();
    let be = ((bits >> 52) & 0x7ff) as i32;
    e += be - 1022;
    let mut m = f64::from_bits((bits & 0x800f_ffff_ffff_ffff) | (1022u64 << 52));
    if m < 0.7071067811865476 { m *= 2.0; e -= 1; }
    (m, e)
}

#[inline]
fn two_sum(a: f64, b: f64) -> (f64, f64) { let s = a + b; let bb = s - a; (s, (a - (s - bb)) + (b - bb)) }
#[inline]
fn fast_two_sum(a: f64, b: f64) -> (f64, f64) { let s = a + b; (s, b - (s - a)) }
#[inline]
fn two_prod(a: f64, b: f64) -> (f64, f64) {
    let p = a * b; let c1 = SPLIT * a; let ah = c1 - (c1 - a); let al = a - ah; let c2 = SPLIT * b; let bh = c2 - (c2 - b); let bl = b - bh;
    (p, ((ah * bh - p) + ah * bl + al * bh) + al * bl)
}
#[inline]
fn mul_dd(ah: f64, al: f64, bh: f64, bl: f64) -> (f64, f64) { let (p, e) = two_prod(ah, bh); fast_two_sum(p, e + (ah * bl + al * bh)) }

/// 로그: 두 배 정밀도 (hi, lo)
pub fn log_dd(x: f64) -> (f64, f64) {
    if x != x || x < 0.0 { return (f64::NAN, 0.0); }
    if x == 0.0 { return (f64::NEG_INFINITY, 0.0); }
    if x == f64::INFINITY { return (f64::INFINITY, 0.0); }
    let (m, e) = split(x);
    let n = m - 1.0;
    let (dh, dl) = two_sum(m, 1.0);
    let q1 = n / dh; let (p, pe) = two_prod(q1, dh);
    let rem = ((n - p) - pe) - q1 * dl; let q2 = rem / dh;
    let (sh, sl) = fast_two_sum(q1, q2);
    let s2 = sh * sh;
    let mut t = AC[11];
    let mut k = 10i32;
    while k >= 0 { t = AC[k as usize] + s2 * t; k -= 1; }
    t = s2 * t;
    let a = 2.0 * sh; let b = 2.0 * sl + 2.0 * sh * t;
    let ef = e as f64;
    let c = ef * LN2_HI; let d = ef * LN2_LO;
    let (h, l0) = two_sum(c, a);
    fast_two_sum(h, l0 + (b + d))
}

/// 지수: 두 배 정밀도 인수 hi + lo
pub fn exp_dd(hi: f64, lo: f64) -> f64 {
    if hi != hi || lo != lo { return f64::NAN; }
    if hi > EXP_OVER { return f64::INFINITY; }
    if hi < EXP_UNDER { return 0.0; }
    let kf = libm::floor(hi * INV_LN2 + 0.5);
    let k = kf as i32;
    let r1 = hi - kf * LN2_HI; let r2 = lo - kf * LN2_LO;
    let mut q = EC[14];
    let mut i = 13i32;
    while i >= 2 { q = EC[i as usize] + r1 * q; i -= 1; }
    let rest = r1 * (r1 * r1) * q;
    let (p2, e2) = two_prod(r1, r1);
    let (a1, b1) = two_sum(1.0, r1);
    let (a, b2) = two_sum(a1, 0.5 * p2);
    let low = ((b1 + b2) + 0.5 * e2) + rest;
    let tot = a + low;
    let res = a + (low + tot * r2);
    if k > 1023 { return res * pow2(1023) * pow2(k - 1023); }
    if k < -1022 { return res * pow2(k + 1000) * pow2(-1000); }
    res * pow2(k)
}

pub fn log(x: f64) -> f64 { log_dd(x).0 }
pub fn exp(x: f64) -> f64 { exp_dd(x, 0.0) }

pub fn pow(x: f64, y: f64) -> f64 {
    if y == 0.0 { return 1.0; }
    if x != x || y != y { return f64::NAN; }
    if x == 1.0 { return 1.0; }
    let y_int = libm::floor(y) == y && y > -1e15 && y < 1e15;
    if x < 0.0 {
        if !y_int { return f64::NAN; }
        let r = pow(-x, y);
        return if libm::fabs(y) % 2.0 == 1.0 { -r } else { r };
    }
    if x == 0.0 { return if y > 0.0 { 0.0 } else { f64::INFINITY }; }
    if x == f64::INFINITY { return if y > 0.0 { f64::INFINITY } else { 0.0 }; }
    if y == f64::INFINITY || y == f64::NEG_INFINITY { return if (x > 1.0) == (y > 0.0) { f64::INFINITY } else { 0.0 }; }
    if y_int && y >= -64.0 && y <= 64.0 {
        if y == 1.0 { return x; }
        let mut n = if y < 0.0 { -y } else { y };
        let (mut bh, mut bl, mut rh, mut rl) = (x, 0.0f64, 1.0f64, 0.0f64);
        while n > 0.0 {
            if n % 2.0 == 1.0 { let m = mul_dd(rh, rl, bh, bl); rh = m.0; rl = m.1; }
            n = libm::floor(n / 2.0);
            if n > 0.0 { let m = mul_dd(bh, bl, bh, bl); bh = m.0; bl = m.1; }
        }
        if y > 0.0 { return rh + rl; }
        let q1 = 1.0 / rh; let (pp, pe) = two_prod(q1, rh); let rem = ((1.0 - pp) - pe) - q1 * rl;
        return q1 + rem / rh;
    }
    let (lh, ll) = log_dd(x);
    let (ph, pe) = two_prod(y, lh);
    let (h, l) = fast_two_sum(ph, pe + y * ll);
    exp_dd(h, l)
}
