// 행정부 난수 (4단계 ④, PLAN-020) — 카운터 기반: 난수 하나는 (seed, 궤적, 흐름, 번호, 부번호) 의 순수 함수다. docs/design/engine-port-roadmap.md §10
//
// 확률 층의 모든 무작위는 여기서만 나온다. seed 는 시나리오(입력 해시에 들어감), 궤적 번호는 조정자가 준다.
// 줄 서서 하나씩 꺼내 쓰는 수열이 아니라 번호로 찾는 난수라서, 적분 걸음이 거부되거나 허용 오차·격자가 바뀌어도 다른 난수가 밀리지 않는다:
//   · 흐름(stream) = 2·규칙 번호 + 종류 (0 정확 SSA 의 지수 · 1 τ-도약의 포아송) — 규칙마다 독립이고 규칙이 활성인지에 무관(전역 규칙 번호)
//   · 번호(idx) = 그 규칙·종류의 몇 번째 추출인가 (엔진이 규칙마다 센다; 거부된 도약은 되돌린다)
//   · 부번호(sub) = 한 추출 안에서 균등 난수를 몇 번째로 쓰는가 (포아송의 변환 거부는 몇 번 쓸지 모른다)
// 균등 U ∈ [0, 1): 상위 53 비트 × 2⁻⁵³ · 지수: −ln(1 − U) · 포아송(μ): μ < 10 이면 곱셈법(Knuth), 아니면 PTRS (Hörmann 1993) — ln k! 는 표(k < 10) + Stirling 급수
// 섞기: splitmix64 마무리(곱셈 둘·이동 셋)를 네 번 — 열쇠 = 섞기(seed·황금비 + 궤적·상수 + 1), 추출 = 섞기(섞기(섞기(열쇠 ^ 흐름·황금비) + 번호·상수) + 부번호·상수)
// engine/rust/src/rng.rs 와 같은 알고리즘·같은 산술 순서. 사법부는 이 난수를 쓰지 않는다 (판정의 재표본은 judicial/stats.js 자기 생성기).
'use strict';
const DM = require('../compiler/detmath.js'); // 결정론 수학 (Rust 와 비트까지 같음)
const M64 = (1n << 64n) - 1n;
const GOLD = 0x9e3779b97f4a7c15n, K_TRAJ = 0xd1342543de82ef95n, K_IDX = 0xbf58476d1ce4e5b9n, K_SUB = 0x94d049bb133111ebn;

function mix(z) {
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
  return (kp - 0.5) * DM.log(kp) - kp + HALF_LN_2PI + (1 / 12 - 1 / (360 * kp * kp)) / kp;
}

function create(seed, trajectory) {
  const key = mix((((BigInt(Math.trunc(seed)) & M64) * GOLD) + (BigInt(trajectory || 0) * K_TRAJ) + 1n) & M64);
  let draws = 0;
  const uniformAt = (stream, idx, sub) => {
    draws++;
    let z = mix(key ^ ((BigInt(stream) * GOLD) & M64));
    z = mix((z + BigInt(idx) * K_IDX) & M64);
    z = mix((z + BigInt(sub) * K_SUB) & M64);
    return Number(z >> 11n) * 1.1102230246251565e-16; // 2⁻⁵³
  };
  const exp1 = (stream, idx) => -DM.log(1 - uniformAt(stream, idx, 0));
  function poisson(mu, stream, idx) {
    if (!(mu > 0)) return 0;
    let sub = 0;
    const uniform = () => uniformAt(stream, idx, sub++);
    if (mu < 10) { const L = DM.exp(-mu); let k = 0, p = uniform(); while (p > L) { k++; p *= uniform(); } return k; }
    // PTRS: 변환 거부 (Hörmann 1993)
    const slam = Math.sqrt(mu), loglam = DM.log(mu), b = 0.931 + 2.53 * slam, a = -0.059 + 0.02483 * b, invalpha = 1.1239 + 1.1328 / (b - 3.4), vr = 0.9277 - 3.6224 / (b - 2);
    for (;;) {
      const U = uniform() - 0.5, V = uniform(), us = 0.5 - Math.abs(U), k = Math.floor((2 * a / us + b) * U + mu + 0.43);
      if (us >= 0.07 && V <= vr) return k;
      if (k < 0 || (us < 0.013 && V > us)) continue;
      if (DM.log(V) + DM.log(invalpha) - DM.log(a / (us * us) + b) <= -mu + k * loglam - lnFact(k)) return k;
    }
  }
  return { uniformAt, exp1, poisson, draws: () => draws, key: () => key.toString(16) };
}

module.exports = { create, lnFact };
