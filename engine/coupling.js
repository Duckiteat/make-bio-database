// 수치 결합점 등록부 (Tear-away Coupling Registry) — docs/design/tripartite-governance.md §4
//
// v9 엔진이 쓰는 '생물 사실이 아닌' 수치 선택(정칙화 상수·탐침 격자·적분 허용 오차·단계 제어)을 한곳에 모은다.
// 엔진 코드는 이 값들을 직접 적지 않고 resolve() 의 결과만 읽는다. 그래서 어떤 결합점이든 엔진을 고치지 않고
// 데이터 층으로 떼어 낼 수 있다: 해석 순서는 시나리오(sc[scenario 키]) → 데이터(params[키], 예: 향후 db.meta.coupling) → 기본값.
// 엔진 연결: simulateFate(db, id, { coupling: params }) — 조정자가 데이터 층의 값을 params 로 넘기면 엔진 코드는 그대로다.
// 이 파일은 순수 정의다 — 파일·데이터베이스를 쓰지 않고, 판정하지 않는다.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../model.js'));
  else root.DefDBCoupling = factory(root.DefDBModel);
})(typeof self !== 'undefined' ? self : this, function (M) {
  'use strict';

  // key: 엔진 안 이름 · scenario: 시나리오에서 덮어쓰는 경로 · default · unit · meaning · layer(데이터로 뗄 때 놓일 곳)
  const REGISTRY = [
    { key: 'saturation_K', scenario: 'saturation_K', default: M.SAT_K, unit: 'M', meaning: '포화 보조 기질의 정칙화 상수 c/(c+K) — 생물 상수 아님', layer: 'numerics' },
    { key: 'commitment_horizon', scenario: 'commitment.horizon', default: 24 * 3600, unit: 's', meaning: '신호 철회 탐침의 관찰 길이', layer: 'commitment' },
    { key: 'commitment_coarse', scenario: 'commitment.coarse', default: 7200, unit: 's', meaning: '결정 탐침의 거친 격자 간격 (이분 탐색 전)', layer: 'commitment' },
    { key: 'commitment_tol', scenario: 'commitment.tol', default: 1, unit: 's', meaning: '결정 시각의 격자 구간 안 연속 이분 탐색을 멈추는 폭 (4단계 ③)', layer: 'commitment' },
    { key: 'event_tol', scenario: 'event_tol', default: 0.01, unit: 's', meaning: '사건(문턱 도달·고갈·재생) 시각 근 찾기를 멈추는 폭 — 실제 정확도는 적분 허용 오차가 정한다 (4단계 ③)', layer: 'numerics' },
    // 혼성 확률 층 (4단계 ④, 시나리오 stochastic 이 있을 때만) — 규칙마다 방식: 정확 SSA(적은 분자 수) · τ-도약(중간) · Rodas3(많거나 빠름)
    { key: 'sto_ssa_max', scenario: 'stochastic.ssa_max', default: 100, unit: '분자', meaning: '규칙의 참여 분자 수(신호·완충 제외 최솟값)가 이보다 적으면 정확 SSA (수정 다음 반응법)', layer: 'stochastic' },
    { key: 'sto_ode_min', scenario: 'stochastic.ode_min', default: 1e4, unit: '분자', meaning: '참여 분자 수가 이 이상이면 결정론(Rodas3) — 상대 요동 ≲ 1/√N = 1 %', layer: 'stochastic' },
    { key: 'sto_fast', scenario: 'stochastic.fast', default: 1, unit: '1/s', meaning: '성향이 이 이상인 빠른 규칙은 분자 수와 무관하게 결정론 (Haseltine–Rawlings 빠른 부분 — 요동을 평균으로 근사). 기본 1 s⁻¹ = 표지 반응(0.04–0.2 s⁻¹, 가상 시나리오)보다 5–25 배 빠름 — 작은 풀이 빠르게 회전하면(고갈 뒤 ATP 등) SSA 발화가 수백만 번 쌓이는 것을 막는다', layer: 'stochastic' },
    { key: 'sto_hyst', scenario: 'stochastic.hysteresis', default: 2, unit: '1', meaning: '더 거친 방식으로 올라갈 때 문턱에 곱하는 히스테리시스 (분할은 관찰 격자점마다)', layer: 'stochastic' },
    { key: 'leap_eps', scenario: 'stochastic.leap_eps', default: 0.03, unit: '1', meaning: 'τ-도약 단계 한계 (Cao 2006): 한 단계에서 참여 분자 수의 기대 변화·표준 편차 ≤ ε·N', layer: 'stochastic' },
    { key: 'sto_atol', scenario: 'stochastic.atol', default: 1e-3, unit: '발화', meaning: '적분 성향 ∫a dt 의 절대 허용 오차 (Rodas3 오차 노름에 함께)', layer: 'stochastic' },
    { key: 'ssa_tol', scenario: 'stochastic.ssa_tol', default: 1e-9, unit: '발화', meaning: 'SSA 발화 시각 근 찾기 — 적분 성향이 다음 발화 내부 시각에 닿는 폭', layer: 'stochastic' },
    { key: 'hill_s_floor', scenario: 'hill_s_floor', default: 1e-12, unit: 'M', meaning: '힐 n < 1 일 때 s → 0 에서 기울기를 자르는 농도 하한 (도함수 발산 방지) — 생물 상수 아님', layer: 'numerics' },
    // 결합 Rosenbrock(Rodas3) 단계 제어 — engine-port-roadmap 1.5단계. 오차 = max_i |e_i| / (atol + rtol·max(|N_i|, |N_i'|))
    { key: 'rtol', scenario: 'integrator.rtol', default: 1e-6, unit: '1', meaning: '국소 오차 상대 허용 (내장 2차 추정 대비)', layer: 'numerics' },
    { key: 'atol', scenario: 'integrator.atol', default: 1e-2, unit: '분자', meaning: '국소 오차 절대 허용 (0 근처 저장소)', layer: 'numerics' },
    { key: 'ref_tol_factor', scenario: 'integrator.ref_factor', default: 1e-3, unit: '1', meaning: '수렴 기준해의 허용 오차 배율 — 같은 적분기를 rtol·atol × 이 값으로 다시 돌려 수치 오차의 기준으로 삼는다 (orchestrator.refScenario). 엔진은 읽지 않음', layer: 'numerics' },
    { key: 'h0', scenario: 'integrator.h0', default: 1, unit: 's', meaning: '실행(본 실행·탐침)의 첫 시도 단계', layer: 'numerics' },
    { key: 'h_min', scenario: 'integrator.h_min', default: 1e-6, unit: 's', meaning: '최소 단계 — 여기서도 거부되면 받아들이고 hMinHits 로 센다 (사법부 NUMERICAL 감사)', layer: 'numerics' },
    { key: 'safety', scenario: 'integrator.safety', default: 0.9, unit: '1', meaning: '단계 갱신 h·safety·err^(−1/3) 의 안전 계수', layer: 'numerics' },
    { key: 'fac_min', scenario: 'integrator.fac_min', default: 0.2, unit: '1', meaning: '한 번에 줄이는 단계 배율 하한', layer: 'numerics' },
    { key: 'fac_max', scenario: 'integrator.fac_max', default: 5, unit: '1', meaning: '한 번에 늘리는 단계 배율 상한 (거부 직후에는 1)', layer: 'numerics' },
    { key: 'pivot_rel', scenario: 'integrator.pivot_rel', default: 1e-12, unit: '1', meaning: '희소 LU 정적 피벗 문턱 — |u_rr| < 이 값 × 행 최대 |M| 이면 특이로 보고 단계 거부 (h 가 줄어 대각 1/(γh) 이 커짐)', layer: 'numerics' },
    { key: 'neg_shrink', scenario: 'integrator.neg_shrink', default: 0.25, unit: '1', meaning: '음수 상태로 거부된 단계의 축소 배율 (양수성)', layer: 'numerics' },
  ];

  const get = (o, path) => path.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
  // 결과: { key: 값, _source: { key: 'scenario'|'data'|'default' } }
  function resolve(sc, params) {
    const out = { _source: {} };
    for (const e of REGISTRY) {
      const s = get(sc || {}, e.scenario), d = get(params || {}, e.key);
      const v = s != null ? s : d != null ? d : e.default;
      out._source[e.key] = s != null ? 'scenario' : d != null ? 'data' : 'default';
      out[e.key] = v;
    }
    return out;
  }

  return Object.freeze({ REGISTRY, resolve });
});
