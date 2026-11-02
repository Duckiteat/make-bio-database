//! 행정부 난수 (4단계 ⑤, PLAN-020) — engine/rng.js 와 같은 알고리즘·같은 산술 순서: 카운터 기반, 난수 하나는 (seed, 궤적, 흐름, 번호, 부번호) 의 순수 함수.
//!   흐름 = 2·규칙 번호 + 종류 (0 정확 SSA 의 지수 · 1 τ-도약의 포아송) · 번호 = 그 규칙·종류의 몇 번째 추출 · 부번호 = 한 추출 안의 균등 난수 순번
//!   섞기: splitmix64 마무리를 네 번 — 열쇠 = 섞기(seed·황금비 + 궤적·상수 + 1), 추출 = 섞기(섞기(섞기(열쇠 ^ 흐름·황금비) + 번호·상수) + 부번호·상수)
//!   균등 U = (x >> 11) · 2⁻⁵³ · 지수 −ln(1 − U) · 포아송(μ): μ < 10 곱셈법(Knuth), 아니면 PTRS(Hörmann 1993) — ln k! 는 표(k < 10) + Stirling 급수. 수학 함수는 순수 Rust libm.
//! 할당 없음 (열쇠 하나).

const LNFACT: [f64; 10] = [0.0, 0.0, 0.6931471805599453, 1.791759469228055, 3.1780538303479458, 4.787491742782046, 6.579251212010101, 8.525161361065415, 10.60460290274525, 12.801827480081469];
const HALF_LN_2PI: f64 = 0.9189385332046728;

pub fn ln_fact(k: f64) -> f64 {
    if k < 10.0 { return LNFACT[k as usize]; }
    let kp = k + 1.0;
    (kp - 0.5) * crate::detmath::log(kp) - kp + HALF_LN_2PI + (1.0 / 12.0 - 1.0 / (360.0 * kp * kp)) / kp
}

const GOLD: u64 = 0x9e3779b97f4a7c15;
const K_TRAJ: u64 = 0xd1342543de82ef95;
const K_IDX: u64 = 0xbf58476d1ce4e5b9;
const K_SUB: u64 = 0x94d049bb133111eb;

#[inline]
fn mix(mut z: u64) -> u64 {
    z = (z ^ (z >> 30)).wrapping_mul(0xbf58476d1ce4e5b9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94d049bb133111eb);
    z ^ (z >> 31)
}

pub struct Rng { key: u64, pub draws: f64 }

impl Rng {
    pub fn new(seed: f64, trajectory: f64) -> Rng {
        let key = mix(((seed as i64 as u64).wrapping_mul(GOLD)).wrapping_add((trajectory as u64).wrapping_mul(K_TRAJ)).wrapping_add(1));
        Rng { key, draws: 0.0 }
    }
    #[inline]
    pub fn uniform_at(&mut self, stream: f64, idx: f64, sub: f64) -> f64 {
        self.draws += 1.0;
        let mut z = mix(self.key ^ (stream as u64).wrapping_mul(GOLD));
        z = mix(z.wrapping_add((idx as u64).wrapping_mul(K_IDX)));
        z = mix(z.wrapping_add((sub as u64).wrapping_mul(K_SUB)));
        (z >> 11) as f64 * 1.1102230246251565e-16
    }
    #[inline]
    pub fn exp1(&mut self, stream: f64, idx: f64) -> f64 { -crate::detmath::log(1.0 - self.uniform_at(stream, idx, 0.0)) }
    pub fn poisson(&mut self, mu: f64, stream: f64, idx: f64) -> f64 {
        if !(mu > 0.0) { return 0.0; }
        let mut sub = 0.0;
        if mu < 10.0 {
            let l = crate::detmath::exp(-mu); let mut k = 0.0; let mut p = self.uniform_at(stream, idx, sub); sub += 1.0;
            while p > l { k += 1.0; p *= self.uniform_at(stream, idx, sub); sub += 1.0; }
            return k;
        }
        let slam = libm::sqrt(mu); let loglam = crate::detmath::log(mu); let b = 0.931 + 2.53 * slam; let a = -0.059 + 0.02483 * b;
        let invalpha = 1.1239 + 1.1328 / (b - 3.4); let vr = 0.9277 - 3.6224 / (b - 2.0);
        loop {
            let u = self.uniform_at(stream, idx, sub) - 0.5; sub += 1.0; let v = self.uniform_at(stream, idx, sub); sub += 1.0; let us = 0.5 - libm::fabs(u);
            let k = libm::floor((2.0 * a / us + b) * u + mu + 0.43);
            if us >= 0.07 && v <= vr { return k; }
            if k < 0.0 || (us < 0.013 && v > us) { continue; }
            if crate::detmath::log(v) + crate::detmath::log(invalpha) - crate::detmath::log(a / (us * us) + b) <= -mu + k * loglam - ln_fact(k) { return k; }
        }
    }
}
