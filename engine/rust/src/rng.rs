//! 행정부 난수 (4단계 ⑤) — engine/rng.js 와 같은 알고리즘·같은 산술 순서: xoshiro256++ (Blackman & Vigna 2018).
//!   초기화: splitmix64(seed · 0x9E3779B97F4A7C15 + 궤적) 의 연속 출력 넷 · 균등 U = (x >> 11) · 2⁻⁵³ · 지수 −ln(1 − U)
//!   포아송(μ): μ < 10 곱셈법(Knuth), 아니면 PTRS(Hörmann 1993) — ln k! 는 표(k < 10) + Stirling 급수. 수학 함수는 순수 Rust libm.
//! 할당 없음 (상태 4 개 u64).

const LNFACT: [f64; 10] = [0.0, 0.0, 0.6931471805599453, 1.791759469228055, 3.1780538303479458, 4.787491742782046, 6.579251212010101, 8.525161361065415, 10.60460290274525, 12.801827480081469];
const HALF_LN_2PI: f64 = 0.9189385332046728;

#[inline]
fn splitmix64(state: &mut u64) -> u64 {
    *state = state.wrapping_add(0x9e3779b97f4a7c15);
    let mut z = *state;
    z = (z ^ (z >> 30)).wrapping_mul(0xbf58476d1ce4e5b9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94d049bb133111eb);
    z ^ (z >> 31)
}

pub fn ln_fact(k: f64) -> f64 {
    if k < 10.0 { return LNFACT[k as usize]; }
    let kp = k + 1.0;
    (kp - 0.5) * libm::log(kp) - kp + HALF_LN_2PI + (1.0 / 12.0 - 1.0 / (360.0 * kp * kp)) / kp
}

pub struct Rng { s: [u64; 4], pub draws: f64 }

impl Rng {
    pub fn new(seed: f64, trajectory: f64) -> Rng {
        let mut sm = (seed as i64 as u64).wrapping_mul(0x9e3779b97f4a7c15).wrapping_add(trajectory as u64);
        let s = [splitmix64(&mut sm), splitmix64(&mut sm), splitmix64(&mut sm), splitmix64(&mut sm)];
        Rng { s, draws: 0.0 }
    }
    #[inline]
    fn next(&mut self) -> u64 {
        let s = &mut self.s;
        let r = (s[0].wrapping_add(s[3])).rotate_left(23).wrapping_add(s[0]);
        let t = s[1] << 17;
        s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3]; s[2] ^= t; s[3] = s[3].rotate_left(45);
        r
    }
    #[inline]
    pub fn uniform(&mut self) -> f64 { self.draws += 1.0; (self.next() >> 11) as f64 * 1.1102230246251565e-16 }
    #[inline]
    pub fn exp1(&mut self) -> f64 { -libm::log(1.0 - self.uniform()) }
    pub fn poisson(&mut self, mu: f64) -> f64 {
        if !(mu > 0.0) { return 0.0; }
        if mu < 10.0 {
            let l = libm::exp(-mu); let mut k = 0.0; let mut p = self.uniform();
            while p > l { k += 1.0; p *= self.uniform(); }
            return k;
        }
        let slam = libm::sqrt(mu); let loglam = libm::log(mu); let b = 0.931 + 2.53 * slam; let a = -0.059 + 0.02483 * b;
        let invalpha = 1.1239 + 1.1328 / (b - 3.4); let vr = 0.9277 - 3.6224 / (b - 2.0);
        loop {
            let u = self.uniform() - 0.5; let v = self.uniform(); let us = 0.5 - libm::fabs(u);
            let k = libm::floor((2.0 * a / us + b) * u + mu + 0.43);
            if us >= 0.07 && v <= vr { return k; }
            if k < 0.0 || (us < 0.013 && v > us) { continue; }
            if libm::log(v) + libm::log(invalpha) - libm::log(a / (us * us) + b) <= -mu + k * loglam - ln_fact(k) { return k; }
        }
    }
}
