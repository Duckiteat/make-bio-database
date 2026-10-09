// 수치 결합점 등록부 (Tear-away Coupling Registry) — docs/design/tripartite-governance.md §4
//
// v9 엔진이 쓰는 '생물 사실이 아닌' 수치 선택(정칙화 상수·관문 문턱·탐침 격자·뉴턴 허용 오차)을 한곳에 모은다.
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
    { key: 'explicit_fraction', scenario: 'explicit_fraction', default: 0.1, unit: '1', meaning: '명시 부분 단계가 한 번에 쓸 입력 비율 (N_sub = ⌈λΔ/이 값⌉)', layer: 'numerics' },
    { key: 'shock_threshold', scenario: 'shock_threshold', default: 0.2, unit: '1', meaning: 'P5 사전 필터 γ_max — 신호 상대 변화가 이보다 크면 같은 단계 강등', layer: 'gate' },
    { key: 'gate.K_up', scenario: 'gate.K_up', default: 15, unit: 'N_sub', meaning: 'P5 승격 문턱', layer: 'gate' },
    { key: 'gate.K_down', scenario: 'gate.K_down', default: 8, unit: 'N_sub', meaning: 'P5 강등 문턱', layer: 'gate' },
    { key: 'gate.M', scenario: 'gate.M', default: 5, unit: '단계', meaning: 'P5 히스테리시스 연속 단계 수', layer: 'gate' },
    { key: 'gate.W', scenario: 'gate.W', default: 20, unit: '단계', meaning: 'P5 충격 후 냉각 단계 수', layer: 'gate' },
    { key: 'commitment_horizon', scenario: 'commitment.horizon', default: 24 * 3600, unit: 's', meaning: '신호 철회 탐침의 관찰 길이', layer: 'commitment' },
    { key: 'commitment_coarse', scenario: 'commitment.coarse', default: 7200, unit: 's', meaning: '결정 탐침의 거친 격자 간격 (이분 탐색 전)', layer: 'commitment' },
    { key: 'newton_tol', scenario: 'newton.tol', default: 1e-10, unit: '1', meaning: '역방향 오일러 뉴턴 상대 잔차 허용', layer: 'numerics' },
    { key: 'newton_iters', scenario: 'newton.iters', default: 50, unit: '회', meaning: '뉴턴 최대 반복', layer: 'numerics' },
  ];

  const get = (o, path) => path.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
  // 결과: { key: 값, gate: { K_up, K_down, M, W }, _source: { key: 'scenario'|'data'|'default' } }
  function resolve(sc, params) {
    const out = { gate: {}, _source: {} };
    for (const e of REGISTRY) {
      const s = get(sc || {}, e.scenario), d = get(params || {}, e.key);
      const v = s != null ? s : d != null ? d : e.default;
      out._source[e.key] = s != null ? 'scenario' : d != null ? 'data' : 'default';
      if (e.key.startsWith('gate.')) out.gate[e.key.slice(5)] = v; else out[e.key] = v;
    }
    // 관문 옵션의 나머지 키(등록부 밖)는 시나리오에서 그대로 — P5 모듈 기본값을 따름
    for (const [k, v] of Object.entries((sc && sc.gate) || {})) if (out.gate[k] == null) out.gate[k] = v;
    return out;
  }

  return Object.freeze({ REGISTRY, resolve });
});
