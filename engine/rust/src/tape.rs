//! 수식 테이프 해석기 — compiler/tape.js 명령표와 같은 의미 (법칙 코드는 여기 없다: IR 테이프만 해석한다).
//! 할당 없음: 스택은 호출자가 미리 잡은 버퍼.

#[inline(always)]
fn max0(x: f64) -> f64 { if x > 0.0 { x } else { 0.0 } }

#[inline(always)]
fn occ(s: f64, k: f64, n: f64) -> f64 {
    let x = if s > 0.0 { libm::pow(s / k, n) } else { 0.0 };
    x / (1.0 + x)
}

#[inline(always)]
fn docc(mut s: f64, k: f64, n: f64, smin: f64) -> f64 {
    if n < 1.0 && s < smin { s = smin; }
    if s <= 0.0 { return if n > 1.0 { 0.0 } else if n == 1.0 { 1.0 / k } else { 0.0 }; }
    let x = libm::pow(s / k, n);
    n * x / (s * (1.0 + x) * (1.0 + x))
}

/// 테이프 하나를 평가한다. `n` 상태(분자 수), `f` 이 규칙의 고정 배율, `cinv` 묶음별 1/(N_A·V) (컴파일러가 접은 상수, V = 0 이면 0),
/// `buf` 완충 상한(M, 없으면 ∞).
#[inline]
pub fn eval(t: &[f64], n: &[f64], f: f64, cinv: &[f64], buf: &[f64], st: &mut [f64]) -> f64 {
    let mut sp = 0usize;
    let mut p = 0usize;
    while p < t.len() {
        let op = t[p] as u32;
        p += 1;
        match op {
            0 => { st[sp] = t[p]; p += 1; sp += 1; }
            1 => {
                let i = t[p] as usize; p += 1;
                let q = cinv[i];
                let mut c = if q > 0.0 { max0(n[i]) * q } else { 0.0 };
                if c > buf[i] { c = buf[i]; }
                st[sp] = c; sp += 1;
            }
            2 => {
                let i = t[p] as usize; p += 1;
                let q = cinv[i];
                st[sp] = if q > 0.0 && n[i] > 0.0 && max0(n[i]) * q < buf[i] { q } else { 0.0 };
                sp += 1;
            }
            3 => { let i = t[p] as usize; p += 1; st[sp] = max0(n[i]); sp += 1; }
            4 => { let i = t[p] as usize; p += 1; st[sp] = if n[i] > 0.0 { 1.0 } else { 0.0 }; sp += 1; }
            5 => { st[sp] = f; sp += 1; }
            6 => { sp -= 1; st[sp - 1] *= st[sp]; }
            7 => { sp -= 1; st[sp - 1] += st[sp]; }
            8 => { let e = t[p]; p += 1; st[sp - 1] = libm::pow(st[sp - 1], e); }
            9 => { let e = t[p]; p += 1; let a = st[sp - 1]; st[sp - 1] = if e == 1.0 { 1.0 } else { e * libm::pow(a, e - 1.0) }; }
            10 => { let k = t[p]; p += 1; let a = st[sp - 1]; st[sp - 1] = a / (a + k); }
            11 => { let k = t[p]; p += 1; let a = st[sp - 1]; st[sp - 1] = k / ((a + k) * (a + k)); }
            12 => {
                let (e, k, nn, fmax, fmin) = (t[p], t[p + 1], t[p + 2], t[p + 3], t[p + 4]); p += 5;
                let o = occ(st[sp - 1], k, nn);
                st[sp - 1] = if e != 0.0 { 1.0 + (fmax - 1.0) * o } else { fmin + (1.0 - fmin) * (1.0 - o) };
            }
            13 => {
                let (e, k, nn, fmax, fmin, smin) = (t[p], t[p + 1], t[p + 2], t[p + 3], t[p + 4], t[p + 5]); p += 6;
                let d = docc(st[sp - 1], k, nn, smin);
                st[sp - 1] = if e != 0.0 { (fmax - 1.0) * d } else { -(1.0 - fmin) * d };
            }
            _ => panic!("unknown tape opcode"),
        }
    }
    if sp > 0 { st[sp - 1] } else { 0.0 }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn mass_action_and_hill() {
        let na = 6.02214076e23;
        let cinv = [1.0 / (na * 1e-12), 1.0 / (na * 1e-12)];
        let buf = [f64::INFINITY, f64::INFINITY];
        let n = [6.02214076e11, 3.0e11];
        let mut st = [0.0; 16];
        // 2·f·c0^1·sat(c1; 1e-6)
        let t = [0.0, 2.0, 5.0, 6.0, 1.0, 0.0, 8.0, 1.0, 6.0, 1.0, 1.0, 10.0, 1e-6, 6.0];
        let c0 = n[0] / (na * 1e-12); let c1 = n[1] / (na * 1e-12);
        let want = 2.0 * 0.5 * c0 * (c1 / (c1 + 1e-6));
        let got = eval(&t, &n, 0.5, &cinv, &buf, &mut st);
        assert!(((got - want) / want).abs() < 1e-15);
        // HILL activates K=1 n=2 fmax=5 at s=1 → 3
        let h = [0.0, 1.0, 12.0, 1.0, 1.0, 2.0, 5.0, 0.0];
        assert!((eval(&h, &n, 1.0, &cinv, &buf, &mut st) - 3.0).abs() < 1e-15);
    }
    #[test]
    fn buffered_cap_derivative_zero() {
        let cinv = [1.0 / (6.02214076e23 * 1e-12)]; let buf = [1e-3];
        let n = [1e15]; // c ≫ 1 mM
        let mut st = [0.0; 4];
        assert_eq!(eval(&[1.0, 0.0], &n, 1.0, &cinv, &buf, &mut st), 1e-3);
        assert_eq!(eval(&[2.0, 0.0], &n, 1.0, &cinv, &buf, &mut st), 0.0);
    }
    #[test]
    fn zero_volume_is_zero_concentration() {
        let mut st = [0.0; 4];
        assert_eq!(eval(&[1.0, 0.0], &[5.0], 1.0, &[0.0], &[f64::INFINITY], &mut st), 0.0);
        assert_eq!(eval(&[2.0, 0.0], &[5.0], 1.0, &[0.0], &[f64::INFINITY], &mut st), 0.0);
    }
}
