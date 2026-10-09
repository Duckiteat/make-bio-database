// 행정부 난수 (4단계 ④) — xoshiro256++ (Blackman & Vigna 2018). docs/design/engine-port-roadmap.md §10
//
// 확률 층의 모든 무작위는 여기서만 나온다. seed 는 시나리오(입력 해시에 들어감), 궤적 번호는 조정자가 준다 —
// (seed, 궤적) 이 같으면 같은 수열 → 같은 궤적 (재현). engine/rust/src/rng.rs 와 같은 알고리즘·같은 산술 순서.
//   · 상태 초기화: splitmix64 (seed · 0x9E3779B97F4A7C15 + 궤적) 의 연속 출력 넷
//   · 균등 U ∈ [0, 1): 상위 53 비트 × 2⁻⁵³ · 지수: −ln(1 − U)
//   · 포아송(μ): μ < 10 이면 곱셈법(Knuth), 아니면 PTRS (Hörmann 1993, 변환 거부) — ln k! 는 표(k < 10) + Stirling 급수
// 사법부는 이 난수를 쓰지 않는다 (판정의 재표본은 judicial/stats.js 자기 생성기).
'use strict';
const M64 = (1n << 64n) - 1n;
const rotl = (x, k) => ((x << BigInt(k)) | (x >> BigInt(64 - k))) & M64;

function splitmix64(state) { // state: [BigInt] — 제자리 갱신
  state[0] = (state[0] + 0x9e3779b97f4a7c15n) & M64;
  let z = state[0];
  z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & M64;
  z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & M64;
  return z ^ (z >> 31n);
}

const LNFACT = [0, 0, 0.6931471805599453, 1.791759469228055, 3.1780538303479458, 4.787491742782046, 6.579251212010101, 8.525161361065415, 10.60460290274525, 12.801827480081469];
const HALF_LN_2PI = 0.9189385332046728;
// ln k! — Stirling 급수 (PTRS 원문 형식)
function lnFact(k) {
  if (k < 10) return LNFACT[k];
  const kp = k + 1;
  return (kp - 0.5) * Math.log(kp) - kp + HALF_LN_2PI + (1 / 12 - 1 / (360 * kp * kp)) / kp;
}

function create(seed, trajectory) {
  const sm = [((BigInt(Math.trunc(seed)) * 0x9e3779b97f4a7c15n) + BigInt(trajectory || 0)) & M64];
  const s = [splitmix64(sm), splitmix64(sm), splitmix64(sm), splitmix64(sm)];
  let draws = 0;
  const next = () => {
    const r = (rotl((s[0] + s[3]) & M64, 23) + s[0]) & M64, t = (s[1] << 17n) & M64;
    s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3]; s[2] ^= t; s[3] = rotl(s[3], 45);
    return r;
  };
  const uniform = () => { draws++; return Number(next() >> 11n) * 1.1102230246251565e-16; }; // 2⁻⁵³
  const exp1 = () => -Math.log(1 - uniform());
  function poisson(mu) {
    if (!(mu > 0)) return 0;
    if (mu < 10) { const L = Math.exp(-mu); let k = 0, p = uniform(); while (p > L) { k++; p *= uniform(); } return k; }
    // PTRS: 변환 거부 (Hörmann 1993)
    const slam = Math.sqrt(mu), loglam = Math.log(mu), b = 0.931 + 2.53 * slam, a = -0.059 + 0.02483 * b, invalpha = 1.1239 + 1.1328 / (b - 3.4), vr = 0.9277 - 3.6224 / (b - 2);
    for (;;) {
      const U = uniform() - 0.5, V = uniform(), us = 0.5 - Math.abs(U), k = Math.floor((2 * a / us + b) * U + mu + 0.43);
      if (us >= 0.07 && V <= vr) return k;
      if (k < 0 || (us < 0.013 && V > us)) continue;
      if (Math.log(V) + Math.log(invalpha) - Math.log(a / (us * us) + b) <= -mu + k * loglam - lnFact(k)) return k;
    }
  }
  return { uniform, exp1, poisson, draws: () => draws, state: () => s.map((x) => x.toString(16)) };
}

module.exports = { create, lnFact };
