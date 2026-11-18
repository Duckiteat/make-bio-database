// 비교 검토 (Comparative Review, 프로토콜 §5) — 새 규칙·경로·수식(패치 또는 시나리오 변형)을 지금 구현과 나란히 돌려
//   ① 복잡도: 조립된 규칙·조절 수, 결합 적분 일(Rodas3 받아들인 + 거부된 단계 — 같은 입력이면 같은 수). 실행 시간(ms)은 진단 칸일 뿐
//      판정에 들어가지 않는다 — 벽시계는 기계 부하에 따라 흔들려 같은 두 변형의 판정이 실행마다 달라진다 (PLAN-095 ②)
//   ② 수치 정확도: 각 변형을 자기 수렴 기준(같은 적분기, 허용 오차 1/1000 — 조정자 refScenario)과 비교한 표지 궤적 상대 L2
//   ③ 결과: 최종 상태·도달·결정 시점, 두 변형 사이 표지 궤적 L2
//   ③′ 같은 시각: 관찰 격자 Δ 가 아니라 시각을 찾은 정밀도로 — 도달은 2·event_tol + 10·rtol·|t|(사건 근 찾기 폭 + 적분 허용 오차가 시각에 남기는 차),
//      결정은 2·commitment_tol (연속 이분 탐색 폭). Δ 를 바꿔도 같은 결과로 판정되어야 하고, Δ 보다 작은 진짜 차이를 덮지 않아야 한다 (PLAN-095 ③)
//   ④ 판정: 결과가 같고 복잡도만 늘면 Optimization-Negative (거부), 줄면 Optimization-Positive, 결과가 바뀌면 Behavior-Changing —
//      그때는 수치 기준이 모형을 고를 수 없다(두 모형 모두 자기 기준에는 수렴) — 관찰 데이터(obs·kinetics)가 필요하다.
// 이 파일은 생물 이름을 모른다: 상태 번호·시나리오·패치만 받는다.
// 삼권 분립: 이 파일은 사법부다 — 엔진을 돌리지 않는다. 변형마다의 실행(본 실행·수렴 기준·시간 측정)은
//   orchestrator.js 가 행정부로 돌려 원자료로 넘기고, 여기서는 수치 L2·질량 검증·판정만 한다.
'use strict';
const { verifyFate } = require('./verifier.js');
const l2 = (a, b, idx) => { let worst = 0; for (const i of idx) { let n = 0, d = 0; const m = Math.min(a.length, b.length); for (let j = 0; j < m; j++) { n += (a[j][i] - b[j][i]) ** 2; d += b[j][i] ** 2; } worst = Math.max(worst, d ? Math.sqrt(n / d) : 0); } return worst; };

// raw = orchestrator.runVariant 의 결과 { complexity, run, dyn, ref, ms, refMs } (모두 행정부 원자료)
function variant(db, raw) {
  if (raw.error) return { error: raw.error };
  const { run, dyn, ref } = raw;
  const idx = run.markers.map((b) => run.keys.indexOf(b));
  return {
    complexity: raw.complexity,
    ms: raw.ms, steps: run.integrator.steps, work: run.integrator.steps + (run.integrator.rejected || 0), coupling: run.coupling, final: run.final.state, firstReach: run.firstReach, commitment: run.commitment.filter((c) => c.driven).map((c) => ({ to: c.to, t: c.t })),
    numericalL2: l2(dyn.series, ref.series, idx), refMs: raw.refMs, mass: ((v) => Math.max(v.worst, v.replayWorst))(verifyFate(db, run)), run,
  };
}
// 같은 시각의 허용치 (③′) — 두 변형의 결합점 중 느슨한 쪽. 관찰 격자 Δ 는 쓰지 않는다
function timeTol(a, b) {
  const g = (k, d) => Math.max(...[a, b].map((x) => (x.coupling && x.coupling[k] != null ? x.coupling[k] : d)));
  const ev = g('event_tol', 0.01), rt = g('rtol', 1e-6), ct = g('commitment_tol', 1);
  return { reach: (t) => 2 * ev + 10 * rt * t, commit: () => 2 * ct };
}
function compare(dbA, dbB, rawA, rawB, opt) {
  opt = Object.assign({ negligible: 1e-5 }, opt || {});
  const a = variant(dbA, rawA), b = variant(dbB, rawB);
  if (a.error || b.error) return { error: a.error || b.error };
  const markers = a.run.markers.filter((m) => b.run.markers.includes(m));
  // 시간으로 맞춘 궤적 차 (관찰 격자 Δ 가 다르면 표본 시각이 다르다 — A 의 시각마다 B 의 같은 시각, 없으면 선형 보간)
  const tA = a.run.trajectory.map((x) => x.t), tB = b.run.trajectory.map((x) => x.t);
  const atB = (t, ib) => { let k = 0; while (k < tB.length - 1 && tB[k + 1] <= t + 1e-9) k++; if (Math.abs(tB[k] - t) < 1e-9 || k === tB.length - 1) return b.run.series[k][ib]; const w = (t - tB[k]) / (tB[k + 1] - tB[k]); return b.run.series[k][ib] * (1 - w) + b.run.series[k + 1][ib] * w; };
  let worst = 0;
  for (const m of markers) { const ia = a.run.keys.indexOf(m), ib = b.run.keys.indexOf(m); let n = 0, d = 0; for (let j = 0; j < tA.length; j++) { if (tA[j] > tB[tB.length - 1] + 1e-9) break; const va = a.run.series[j][ia]; n += (atB(tA[j], ib) - va) ** 2; d += va ** 2; } worst = Math.max(worst, d ? Math.sqrt(n / d) : 0); }
  const tol = timeTol(a, b);
  const same = (x, y, w) => (x == null && y == null) || (x != null && y != null && Math.abs(x - y) <= w(Math.max(Math.abs(x), Math.abs(y))));
  const outcomeChanged = a.final !== b.final || Object.keys({ ...a.firstReach, ...b.firstReach }).some((s) => !same(a.firstReach[s], b.firstReach[s], tol.reach))
    || a.commitment.some((c) => !same(c.t, (b.commitment.find((x) => x.to === c.to) || {}).t, tol.commit));
  const dUnits = (b.complexity.units - a.complexity.units) / Math.max(1, a.complexity.units), dWork = (b.work - a.work) / Math.max(1, a.work), dMs = (b.ms - a.ms) / a.ms; // dMs 는 진단 — 판정에 쓰지 않음
  // 판정 (프로토콜 §5B): 비용 = 구조(규칙·조절)가 늘거나 적분 일이 5% 넘게 늚, 이득 = 수렴 기준 대비 수치 L2 의 절대 감소 (0.001% = 1e-5 미만은 이득 없음)
  const cost = dUnits > 0 || dWork > 0.05, gain = a.numericalL2 - b.numericalL2;
  let verdict, why;
  const nums = `복잡도 ${(dUnits * 100).toFixed(1)}%, 적분 일 ${(dWork * 100).toFixed(1)}%, 궤적 차 ${worst.toExponential(2)}, 수치 L2 ${a.numericalL2.toExponential(2)} → ${b.numericalL2.toExponential(2)}`;
  if (outcomeChanged) { verdict = 'Behavior-Changing'; why = `결과(최종 상태·도달·결정 시점)가 바뀜 — 두 변형 모두 자기 수렴 기준에는 맞으므로 수치로는 고를 수 없다. 관찰 데이터(obs·kinetics)로 고르고, 없으면 그 차이를 Kinetic_Gap/Regulatory_Gap 으로 등록 (${nums})`; }
  else if (cost && (gain < opt.negligible || worst < opt.negligible)) { verdict = 'Optimization-Negative'; why = `비용은 늘고(${nums}) 정확도 이득이 ${opt.negligible} 미만 — 거부`; }
  else if (!cost && (dUnits < 0 || dWork < -0.05 || gain >= opt.negligible)) { verdict = 'Optimization-Positive'; why = `비용이 늘지 않고 더 단순·빠름·정확 (${nums}) — 채택 권장`; }
  else if (!cost) { verdict = 'Neutral'; why = `차이 없음 (${nums})`; }
  else { verdict = 'Trade-off'; why = `비용과 정확도 이득이 함께 늚 (${nums}) — 사람이 판단`; }
  return { a, b, between: worst, outcomeChanged, dUnits, dWork, dMs, timeTol: { reach_at_1h: tol.reach(3600), commit: tol.commit(0) }, verdict, why, ix: a.run.ix };
}
function compareText(r) {
  if (r.error) return '오류: ' + r.error;
  const L = r.ix.label, h = (s) => (s == null ? '—' : `${(s / 3600).toFixed(2)} h`);
  const row = (k, x) => `| ${k} | ${x.complexity.rules} 규칙 + ${x.complexity.modulations} 조절 (빠른 ${x.complexity.fast}·느린 ${x.complexity.slow}) | ${x.steps} (+${x.work - x.steps} 거부) | ${x.ms.toFixed(0)} | ${x.numericalL2.toExponential(2)} | ${x.final ? L(x.final) : '미결정'} | ${x.commitment.map((c) => `${L(c.to)} ${h(c.t)}`).join(', ') || '—'} | ${x.mass.toExponential(1)} |`;
  return ['| 변형 | 복잡도 | 적분 단계 | 시간 ms (진단 — 판정 밖) | 수치 L2 (수렴 기준) | 최종 상태 | 결정 | 질량 편차 |', '|---|---|---|---|---|---|---|---|', row('A 기준', r.a), row('B 제안', r.b),
    '', `두 변형 사이 표지 궤적 L2 ${r.between.toExponential(2)} · 복잡도 ${(r.dUnits * 100).toFixed(1)}% · 적분 일 ${(r.dWork * 100).toFixed(1)}% · 시간 ${(r.dMs * 100).toFixed(1)}% (진단)`, `판정: **${r.verdict}** — ${r.why}`].join('\n');
}
module.exports = { compare, compareText, variant, timeTol };
