// 사법부 — 두 엔진의 차이 판정 (PLAN-055). 속도 엔진(core.simulateRate)과 운명 엔진(engine/fate_engine.js)이
//   같은 경로 · 같은 시나리오에서 낸 원자료만 받아, 공유 묶음마다 끝 값의 차이를 재고 그 원인을 가른다. 엔진을 돌리지 않는다(조정자가 돌림).
//   행 하나 = 공유 묶음 b: gap = |rate − fate| / max(1, |rate|, |fate|) (1 분자 바닥 — 0 근처 묶음의 상대 차가 부풀지 않게)
//     dt   = 속도 엔진을 Δt/10 으로 다시 돌린 값과의 차 (명시 오일러의 걸음 의존)
//     num  = 운명 엔진을 허용 오차 1/1000 로 다시 돌린 값과의 차 (적분 허용 오차가 남긴 차)
//   원인 (gap > tol 인 행만, 먼저 맞는 것):
//     start_default — 두 엔진의 시작량이 다름 (속도 엔진은 시나리오가 주지 않은 묶음을 세포 기본값 · 대사물 풀로 채우고, 운명 엔진은 0)
//     boundary      — 운명 엔진에서 그 묶음에 닿는 규칙 · 단계 중 속도 엔진의 경로 밖인 것이 있음 (운명 엔진은 세포 상태의 기전 경로 전부 + 대사 · 표지 규칙을 한 계로)
//     instant_step  — 속도 엔진이 그 묶음에 닿는 단계를 '즉시'로 처리함 (속도 상수 없음 · 막에서만 일어나는 단계 — L000081)
//     dt            — 속도 엔진의 걸음 의존이 차이의 1/10 이상
//     numerical     — 운명 엔진의 허용 오차 차가 차이의 1/10 이상
//     unexplained   — 위 어느 것도 아님 (새 구멍일 수 있다 — 사람에게)
'use strict';

function engineGap(db, raw, opt) {
  opt = Object.assign({ tol: 1e-4 }, opt || {});
  const { rate, rateFine, fate, fateRef, rateStart, fateStart, pathway } = raw;
  if (!rate || !fate || rate.error || fate.error) return { error: (rate && rate.error) || (fate && fate.error) || '원자료 없음' };
  const rel = (x, y) => Math.abs(x - y) / Math.max(1, Math.abs(x), Math.abs(y));
  // 속도 엔진이 '즉시'로 처리한 단계에 닿는 묶음 (단계 참여자 — 행위자 · 입력 · 출력)
  const instant = new Set();
  for (const sid of rate.approx || []) { const st = db.steps[sid]; if (!st) continue; for (const p of [...st.agents, ...st.inputs, ...st.outputs]) instant.add(p.b); }
  // 계의 경계: 운명 엔진의 규칙 중 속도 엔진 경로의 단계가 아닌 것이 닿는 묶음
  const inPath = new Set(pathway && db.steps ? Object.keys(db.steps).filter((sid) => (db.steps[sid].part_of || []).includes(pathway)) : []);
  const outside = new Set();
  for (const R of (fate.process && fate.process.ruleInfo) || []) if (!R.step || !inPath.has(R.step)) for (const [b] of [...R.cons, ...R.prods]) outside.add(b);
  const rows = [];
  for (const [b, x] of Object.entries(rate.final)) {
    if (!fate.keys.includes(b)) continue;
    const y = fate.final.N[b], gap = rel(x, y), dt = rateFine ? rel(x, rateFine.final[b]) : null, num = fateRef ? rel(y, fateRef.final.N[b]) : null;
    const s0r = rateStart ? rateStart[b] : null, s0f = fateStart ? fateStart[b] || 0 : null;
    let cause = null;
    if (gap > opt.tol) {
      if (s0r != null && s0f != null && rel(s0r, s0f) > opt.tol) cause = 'start_default';
      else if (instant.has(b)) cause = 'instant_step';
      else if (outside.has(b)) cause = 'boundary';
      else if (dt != null && dt >= gap / 10) cause = 'dt';
      else if (num != null && num >= gap / 10) cause = 'numerical';
      else cause = 'unexplained';
    }
    rows.push({ bundle: b, rate: x, fate: y, gap, dt, num, start: { rate: s0r, fate: s0f }, cause });
  }
  rows.sort((p, q) => q.gap - p.gap || (p.bundle < q.bundle ? -1 : 1));
  const causes = {}; for (const r of rows) if (r.cause) causes[r.cause] = (causes[r.cause] || 0) + 1;
  const worst = rows.length ? rows[0].gap : 0, within = rows.filter((r) => !r.cause);
  return {
    tol: opt.tol, shared: rows.length, rows, causes, worst,
    worstWithin: within.length ? Math.max(...within.map((r) => r.gap)) : 0,
    dtWorst: Math.max(0, ...rows.map((r) => r.dt || 0)), numWorst: Math.max(0, ...rows.map((r) => r.num || 0)),
    instantSteps: [...(rate.approx || [])], ok: !causes.unexplained,
  };
}

function engineGapText(v, label) {
  if (v.error) return `두 엔진 차이: ${v.error}`;
  const fmt = (x) => (x == null ? '—' : x === 0 ? '0' : Math.abs(x) >= 1e-3 && Math.abs(x) < 1e6 ? x.toPrecision(5) : x.toExponential(2));
  const KO = { start_default: '시작량 기본값', boundary: '계의 경계', instant_step: "속도 엔진 '즉시' 단계", dt: '속도 엔진 걸음 의존', numerical: '운명 엔진 허용 오차', unexplained: '설명 안 됨' };
  const out = [`두 엔진 차이 — ${label || ''} · 공유 묶음 ${v.shared} · 허용 ${v.tol} 넘음 ${v.rows.filter((r) => r.cause).length} (${Object.entries(v.causes).map(([k, n]) => `${KO[k]} ${n}`).join(' · ') || '없음'}) · 허용 안 최대 ${fmt(v.worstWithin)} · 속도 엔진 Δt 의존 최대 ${fmt(v.dtWorst)} · 운명 엔진 허용 오차 최대 ${fmt(v.numWorst)}`, '',
    '| 묶음 | 속도 엔진 | 운명 엔진 | 차 | Δt 의존 | 허용 오차 | 원인 |', '|---|---|---|---|---|---|---|'];
  for (const r of v.rows.slice(0, 15)) out.push(`| ${r.bundle} | ${fmt(r.rate)} | ${fmt(r.fate)} | ${fmt(r.gap)} | ${fmt(r.dt)} | ${fmt(r.num)} | ${r.cause ? KO[r.cause] : '허용 안'} |`);
  return out.join('\n');
}

module.exports = { engineGap, engineGapText };
