// 과정 분석 보고서 (Process-Oriented Fate Analysis & Integrity Reporting) — 운명 시뮬레이션 한 번마다 끝 상태가 아니라 과정을 문서로 남긴다.
//   1 요약 · 2 단계별 전개(변곡점·시계열·구간 [기간 | 주된 원인 | 우세 표지 | 대사 비용]) · 3 무결성 증명서 · 4 인과 추적 · 5 기술 부록
// 삼권 분립: 이 파일은 사법부다. 입력은 판결된 보기(judicial/fate_audit.js judgeFate — 행정부 원자료 + 사법부 독립 재계산)이며, 엔진을 실행하거나 쓰지 않는다.
// 무결성 증명서는 사법부 검증기(judicial/verifier.js)가 원자료로 다시 센 값으로만 판정한다 — 매 관찰 격자 단계의 부분 구조 원장(≤ 1e-14)·저장소 재생(규칙 진행량 밖 변경 없음)·
//   선언된 신호 일정과의 일치·결정론(다시 돌려 같은 궤적 해시)·입력 해시(데이터·시나리오)와 매개변수 출처. 하나라도 어기면 FAIL.
// 이 파일은 생물 이름을 모른다: 번호·묶음·숫자만 다루고 이름은 데이터베이스 색인(ix.label)으로 표시만 한다.
'use strict';
const crypto = require('crypto');

const sha = (x) => crypto.createHash('sha256').update(typeof x === 'string' ? x : JSON.stringify(x)).digest('hex');
const h = (s) => (s == null ? '—' : `${(s / 3600).toFixed(2)} h`);
const fmt = (x) => (x == null || !Number.isFinite(x) ? '—' : Math.abs(x) >= 1e5 || (Math.abs(x) < 1e-2 && x !== 0) ? x.toExponential(2) : (+x.toPrecision(4)).toString());

function processReport(r, ctx) {
  ctx = Object.assign({ scenario: {}, scenarioText: null, dbText: null, rerunHash: null, numerics: null, gridHours: [0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8, 12, 18, 24, 36, 48, 72] }, ctx || {});
  const P = r.process, ix = r.ix, L = (id) => ix.label(id), BL = (b) => ix.bundleLabel(b), sc = ctx.scenario;
  const T = P.times, nT = T.length, at = new Map(r.keys.map((b, i) => [b, i])), dt = r.dt;
  const series = r.series, val = (j, b) => series[j][at.get(b)];
  const idxAt = (t) => { let k = 0; while (k < nT - 1 && T[k + 1] <= t + 1e-9) k++; return k; };
  const targets = r.states.filter((s) => s !== r.source);
  // 기준선 = 신호가 들어오기 전 시작 상태 (첫 기록은 이미 한 단계 뒤라 개시 신호의 효과가 들어 있다)
  const N0 = Float64Array.from(P.N0); for (const s of P.schedule) N0[at.get(s.bundle)] = 0;
  const thr = P.thresholds;
  // 비율: 목표 상태들의 높은 표지끼리(자동) + 시나리오 report.ratios (선언된 것만)
  const highOf = (s) => (r.ix.db.senses[s].signature || []).filter((m) => m.level === 'high').map((m) => `${m.ref}|${m.location}`);
  const ratios = [];
  for (let a = 0; a < targets.length; a++) for (let b = a + 1; b < targets.length; b++) { const x = highOf(targets[a])[0], y = highOf(targets[b])[0]; if (x && y && x !== y) ratios.push([x, y]); }
  for (const pr of ((sc.report || {}).ratios || [])) if (at.has(pr[0]) && at.has(pr[1])) ratios.push(pr);
  const ratioAt = (j, [x, y]) => val(j, x) / Math.max(val(j, y), 1e-12);
  const lnV = (j, b) => Math.log(Math.max(val(j, b), 1e-9));
  const W = Math.max(1, Math.round(900 / dt)); // 속도 창 ±15 분 (단계 반응의 잡음을 줄임)
  const vel = (j, b) => { const a = Math.max(0, j - W), c = Math.min(nT - 1, j + W); return c > a ? (lnV(c, b) - lnV(a, b)) / ((T[c] - T[a]) / 3600) / Math.LN10 : 0; }; // log10 /h
  // ===== 변곡점 =====
  const infl = [];
  const add = (t, type, what) => infl.push({ t, type, what });
  for (const s of P.schedule) { let prev = null; for (const e of s.list) { if (e.n !== prev) add(e.t, 'signal', `신호 ${BL(s.bundle)} = ${fmt(e.n)}${prev != null ? ` (이전 ${fmt(prev)})` : ''}`); prev = e.n; } }
  const dep = r.trajectory.findIndex((x) => x.d[r.source] > 0);
  if (dep >= 0) add(r.trajectory[dep].t, 'departure', `시작 상태 ${L(r.source)} 를 벗어남 (서명 문턱 넘음)`);
  for (const b of r.markers) {
    const t0 = thr[b]; if (!t0) continue;
    let prev = series[0][at.get(b)];
    for (let j = 1; j < nT; j++) { const x = series[j][at.get(b)]; for (const [lv, name] of [[t0.low, 'low'], [t0.high, 'high']]) { if (prev < lv && x >= lv) add(T[j], 'threshold', `${BL(b)} ↑ ${name} 문턱 ${fmt(lv)} (속도 ${fmt(vel(j, b))} log10/h)`); if (prev >= lv && x < lv) add(T[j], 'threshold', `${BL(b)} ↓ ${name} 문턱 ${fmt(lv)} (속도 ${fmt(vel(j, b))} log10/h)`); } prev = x; }
    // 신호 개시 반응(처음 30 분)은 따로, 그 뒤의 최대 변화 속도 = 전이의 중점
    const j30 = Math.min(nT - 1, 2 * W);
    add(T[j30], 'onset', `${BL(b)} 개시 반응 ${fmt(val(0, b))} → ${fmt(val(j30, b))} (속도 ${fmt(vel(j30, b))} log10/h)`);
    // 내부 극대 (±W 안에서 가장 빠르고, 창 경계가 아님)만 — 감쇠하는 개시 반응의 꼬리는 중점이 아니다
    let best = 0, jb = -1; for (let j = j30 + W; j < nT - W; j++) { const v = Math.abs(vel(j, b)); if (v > best && v >= Math.abs(vel(j - W, b)) && v >= Math.abs(vel(j + W, b))) { best = v; jb = j; } }
    if (jb >= 0 && best > 0.01) add(T[jb], 'peak_velocity', `${BL(b)} 변화 속도 최대 ${fmt(vel(jb, b))} log10/h (값 ${fmt(val(jb, b))}) — 전이의 중점`);
  }
  for (const c of r.commitment) if (c.t != null) add(c.t, 'commitment', `${L(c.to)} 로 결정 (신호 철회 시험 통과 — 이후 신호를 끊어도 ${h(c.horizon)} 뒤 ${L(c.to)})`);
  for (const [s, t] of Object.entries(r.firstReach)) if (s !== r.source) add(t, 'reach', `${L(s)} 도달 (모든 표지가 문턱 안)`);
  // 운명 전환: 가장 가까운 목표 상태(잘리지 않은 거리)가 바뀐 시각 — 처음부터, 거리 차가 0.01 넘을 때만 (동률 무시)
  let lead = null;
  for (let j = 0; j < nT; j++) { const ds = targets.map((s) => ({ s, d: P.rawDistance(series[j], s) })).sort((a, b) => a.d - b.d); if (ds.length < 2 || ds[1].d - ds[0].d < 0.01) continue; if (lead && ds[0].s !== lead) add(T[j], 'fate_switch', `가장 가까운 목표가 ${L(lead)} → ${L(ds[0].s)} 로 바뀜 (운명 전환)`); lead = ds[0].s; }
  // 표지 비율이 1 을 가로지름 (경쟁하는 계통 표지의 우세가 뒤집힘)
  for (const pr of ratios) { let prev = ratioAt(0, pr); for (let j = 1; j < nT; j++) { const x = ratioAt(j, pr); if ((prev - 1) * (x - 1) < 0) add(T[j], 'ratio_cross', `${BL(pr[0]).split('@')[0]}/${BL(pr[1]).split('@')[0]} = 1 을 ${x > prev ? '위로' : '아래로'} 지남${r.markers.includes(pr[0]) && r.markers.includes(pr[1]) ? ' (경쟁 계통 표지의 우세가 뒤집힘)' : ''}`); prev = x; } }
  for (const e of r.events) add(e.t, e.type, `${e.type === 'exhausted' ? '고갈' : '재생'} ${BL(e.bundle)}`);
  if (r.arrest && r.arrest.t != null) add(r.arrest.t, 'arrest', `분화 정지 — ${L(r.target)} 쪽 진전이 창 동안 0.01 미만`);
  infl.sort((a, b) => a.t - b.t);
  // ===== 구간 =====
  const tC = Object.fromEntries(r.commitment.filter((c) => c.t != null).map((c) => [c.to, c.t]));
  const bounds = [...new Set([0, ...infl.filter((x) => ['signal', 'departure', 'commitment', 'reach', 'exhausted', 'fate_switch', 'arrest'].includes(x.type)).map((x) => x.t), r.t_end].map((t) => Math.min(r.t_end, Math.max(0, t))))].sort((a, b) => a - b);
  const merged = []; for (const b of bounds) if (!merged.length || b - merged[merged.length - 1] > 2 * dt) merged.push(b); else merged[merged.length - 1] = b === r.t_end ? b : merged[merged.length - 1];
  if (merged[merged.length - 1] !== r.t_end) merged.push(r.t_end);
  const phases = [];
  for (let k = 0; k + 1 < merged.length; k++) {
    const t0 = merged[k], t1 = merged[k + 1], j0 = t0 === 0 ? 0 : idxAt(t0), j1 = idxAt(t1), mid = idxAt((t0 + t1) / 2);
    const cls = r.trajectory[mid].cls, sigOn = P.schedule.filter((s, q) => (P.sig[mid] || [])[q] > 0).map((s) => BL(s.bundle));
    const committedTo = Object.entries(tC).find(([, t]) => t <= t0 + 1e-9);
    const moving = r.markers.some((b) => Math.abs(lnV(j1, b) - lnV(j0, b)) > 0.05 || Math.abs(vel(mid, b)) > 0.01);
    const nearest = targets.map((s) => ({ s, d: P.rawDistance(series[mid], s) })).sort((a, b) => a.d - b.d)[0];
    const afterArrest = r.arrest && r.arrest.t != null && t0 >= r.arrest.t - 1e-9;
    const name = cls.state && cls.state !== r.source ? `정상 상태 (유지) — ${L(cls.state)}`
      : committedTo ? `결정 — ${L(committedTo[0])} 로 향함`
      : afterArrest && moving && nearest && nearest.s !== r.target ? `전이 — 다른 운명 ${L(nearest.s)} 쪽으로 (${L(r.target)} 쪽은 정지)`
      : afterArrest ? `정지 — ${L(r.target)} 쪽 진전 없음`
      : dep >= 0 && T[mid] >= r.trajectory[dep].t ? '전이 (결정 전)'
      : moving && P.schedule.some((x, q) => (P.sig[mid] || [])[q] > 0) ? `개시 — ${nearest ? L(nearest.s) + ' 쪽으로 ' : ''}(신호 반응, 서명 문턱 아래)` : '기저 (시작 상태)';
    // 우세 표지: 문턱 대비 가장 높은 표지 + 가장 크게 변한 표지
    const dl = r.markers.map((b) => ({ b, d: lnV(j1, b) - lnV(j0, b), rel: val(j1, b) / ((thr[b] || {}).high || 1) })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
    const dom = [...dl].sort((a, b) => b.rel - a.rel)[0], mover = dl[0];
    // 주된 원인: 모든 표지 합성 규칙의 조절 가운데 ln 배율이 구간에서 가장 크게 바뀐 것 (작으면 평균 기여가 가장 큰 유지 인자)
    let driver = null;
    {
      const fa0 = P.factorsAt(t0 === 0 ? N0 : series[j0]), fa1 = P.factorsAt(series[j1]), fam = P.factorsAt(series[mid]), all = [];
      P.ruleInfo.forEach((R, k) => { if (R.layer !== 'slow' || R.kind !== 'supply') return; const tgt = (R.prods[0] || [])[0]; R.mods.forEach((m, q) => all.push({ m, tgt, d: Math.log(fa1[k][q]) - Math.log(fa0[k][q]), mean: Math.log(fam[k][q]), f0: fa0[k][q], f1: fa1[k][q] })); });
      const ch = [...all].sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0], su = [...all].sort((a, b) => Math.abs(b.mean) - Math.abs(a.mean))[0];
      driver = ch && Math.abs(ch.d) >= 0.05 ? { kind: '변화', ...ch } : su ? { kind: '유지', ...su } : null;
    }
    // 대사 비용: 빠른 층 진행량 — 생산자가 없는 연료의 소비 + 가장 큰 흐름
    const dcum = P.ruleInfo.map((R, q) => (P.cum[j1][q] - (t0 === 0 ? 0 : P.cum[j0][q])));
    const fuels = {}; P.ruleInfo.forEach((R, q) => { if (R.layer !== 'fast') return; for (const [b, n] of R.cons) if (!P.ruleInfo.some((S) => S.prods.some(([pb]) => pb === b))) fuels[b] = (fuels[b] || 0) + n * dcum[q]; });
    const flows = P.ruleInfo.map((R, q) => ({ R, x: dcum[q] })).filter((x) => x.R.layer === 'fast' && x.x > 0).sort((a, b) => b.x - a.x).slice(0, 2);
    phases.push({ t0, t1, name, sigOn, dom, mover, driver, fuels, flows, cls, j0, j1 });
  }
  // ===== 무결성 =====
  const checks = [];
  const chk = (name, ok, detail) => checks.push({ name, ok: !!ok, detail });
  chk(`원자료 계약 — ${r.contract ? r.contract.schema : 'schemas/ffi/fate-raw.schema.json'} (형·필드·배열 길이·묶음 참조)`, !!(r.contract && r.contract.ok), r.contract ? (r.contract.ok ? '위반 없음' : r.contract.violations.slice(0, 3).map((x) => `${x.path}: ${x.msg}`).join(' · ')) : '검사 안 함');
  const ic = r.irCheck;
  chk('IR·기호 도함수 — 엔진이 먹은 IR = 조정자 IR, 법칙 충실도·자동미분 대비 도함수 ≤ 1e-14, 유한차분 교차 ≤ 1e-6', ic ? ic.ok : null, ic ? `속도 ${fmt(ic.rateWorst)} · 도함수 ${fmt(ic.derivWorst)} · 배율 ${fmt(ic.factorWorst)} · 유한차분 ${fmt(ic.fdWorst)} (${ic.checked} 항목, 상태점 ${ic.samples})${ic.consumed ? '' : ' · IR 해시 불일치'}${ic.problems.length ? ' · ' + ic.problems.slice(0, 2).join(' · ') : ''}` : 'IR 을 받지 않음');
  const tol = r.mass.tolerance, ms = r.mass.series, rs = r.mass.replaySeries;
  const argmax = (a) => a.reduce((m, v, i) => (v > a[m] ? i : m), 0);
  chk(`부분 구조 원장 ΣIn = ΣOut — 매 관찰 격자 단계 (${ms.length} 단계) 상대 ≤ ${tol}`, ms.every((v) => v <= tol), `최대 ${fmt(Math.max(...ms))} @ ${h(T[argmax(ms)])}, 중앙값 ${fmt([...ms].sort((a, b) => a - b)[ms.length >> 1])}`);
  chk(`저장소 재생 — 모든 묶음 = 시작 + Σ 화학량 × 규칙 진행량 (규칙 밖 변경 없음), 매 단계 ≤ ${tol}`, rs.every((v) => v <= tol), `최대 ${fmt(Math.max(...rs))} @ ${h(T[argmax(rs)])}`);
  // 신호: 선언된 일정과 매 단계 일치 (본 실행에는 일정 밖 개입이 없음)
  let sigBad = 0; const decl = (s, t) => { let v = 0; for (const e of s.list) if (e.t <= t + 1e-9) v = e.n; return v; };
  for (let j = 0; j < nT; j++) P.schedule.forEach((s, q) => { if ((P.sig[j] || [])[q] !== decl(s, T[j] - dt)) sigBad++; });
  chk('신호 = 선언된 일정 (경계 조건) — 매 단계', sigBad === 0, `불일치 ${sigBad} / ${nT * P.schedule.length}`);
  chk('결정론 — 같은 입력으로 다시 돌린 궤적 해시가 같음', ctx.rerunHash == null ? null : ctx.rerunHash === P.hash, ctx.rerunHash == null ? '다시 돌리지 않음' : `${P.hash.slice(0, 16)} ${ctx.rerunHash === P.hash ? '=' : '≠'} ${ctx.rerunHash.slice(0, 16)}`);
  const neg = Object.entries(r.final.N).filter(([b, v]) => v < -1e-6);
  chk('음수 저장소 없음', !neg.length, neg.map(([b, v]) => `${BL(b)} ${fmt(v)}`).join(', ') || '없음');
  // 매개변수 출처: 쓰인 속도 상수는 모두 데이터 또는 시나리오(해시된 입력)에서 왔고, 값이 그대로다
  const kinOK = P.ruleInfo.every((R) => { if (!R.kin) return true; const srcK = R.src === 'scenario' ? (sc.kinetics || {})[R.ref] : (r.ix.ruleOf(R.ref) || {}).kinetics; return srcK && ['k', 'K', 'n', 'fmax', 'fmin', 'half_life', 'order'].every((f) => srcK[f] == null || srcK[f] === R.kin[f]); })
    && P.ruleInfo.every((R) => R.mods.every((m) => { const srcK = (sc.kinetics || {})[m.ref] || (r.ix.ruleOf(m.ref) || {}).kinetics; return !m.kin || (srcK && ['K', 'n', 'fmax', 'fmin'].every((f) => srcK[f] == null || srcK[f] === m.kin[f])); }));
  const nScen = P.ruleInfo.filter((R) => R.src === 'scenario').length + P.ruleInfo.reduce((t, R) => t + R.mods.filter((m) => (sc.kinetics || {})[m.ref]).length, 0);
  const nData = P.ruleInfo.filter((R) => R.src === 'data').length + P.ruleInfo.reduce((t, R) => t + R.mods.filter((m) => !(sc.kinetics || {})[m.ref] && (r.ix.ruleOf(m.ref) || {}).kinetics).length, 0);
  chk('매개변수 출처 — 쓰인 상수가 모두 해시된 입력(데이터·시나리오)의 값 그대로', kinOK, `시나리오 ${nScen} · 데이터 ${nData}${sc.hypothetical ? ' · 시나리오는 hypothetical (가상 값)' : ''}`);
  chk('엔진 감사에 AUDIT_MASS 없음', !r.audit.some((a) => a.code === 'AUDIT_MASS'), r.audit.filter((a) => a.code === 'AUDIT_MASS').map((a) => a.msg).join(' / ') || '없음');
  const pass = checks.every((c) => c.ok !== false);
  // ===== 예측과의 차이 =====
  const expect = sc.expect || {}, disc = [];
  const driven = r.transitions.filter((t) => t.driven).map((t) => t.to);
  const predicted = expect.final !== undefined ? expect.final : r.target;
  if (predicted !== undefined && (r.final.state || null) !== (predicted || null)) disc.push(`최종 상태: 예측 ${predicted ? L(predicted) : '미결정/정지'} ≠ 관찰 ${r.final.state ? L(r.final.state) : '미결정'}`);
  if (expect.limiting && (!r.postMortem || !r.postMortem.resource || r.postMortem.resource.bundle !== expect.limiting)) disc.push(`제한 저장소: 예측 ${BL(expect.limiting)} ≠ 관찰 ${r.postMortem && r.postMortem.resource ? BL(r.postMortem.resource.bundle) : '없음'}`);
  if (expect.commit_before_h != null) for (const c of r.commitment.filter((x) => x.driven && x.to === predicted)) if (!(c.t != null && c.t <= expect.commit_before_h * 3600)) disc.push(`결정 시점: 예측 ≤ ${expect.commit_before_h} h ≠ 관찰 ${h(c.t)}`);
  for (const c of r.commitment) if (c.monotone === false) disc.push(`${L(c.to)} 결정 탐침이 격자에서 단조가 아님 (결정 뒤 되돌아감)`);
  // ===== 인과 추적 =====
  const trace = [];
  const tEnd = r.firstReach[predicted] != null ? r.firstReach[predicted] : r.t_end, jE = idxAt(tEnd);
  if (r.postMortem) {
    const p = r.postMortem;
    trace.push(`목표 ${L(p.target)} 에 도달하지 못함 → 원인 ${p.cause}${p.alternative ? ` (대신 ${L(p.alternative)})` : ''}`);
    p.failing.forEach((f, k) => trace.push(`${k + 1}. 실패 표지 ${BL(f.bundle)} = ${fmt(f.value)} (필요 ${f.level === 'high' ? '≥' : '≤'} ${fmt(f.need)})`));
    for (const d of p.drivers) trace.push(`   · 그 합성의 조절 ${BL(d.modulator)} ${d.effect === 'activates' ? '→' : '⊣'} 배율 ${fmt(d.factor)} (점유 ${(d.occupancy * 100).toFixed(1)}%)${p.weakest && p.weakest.modulator === d.modulator ? ' ← 가장 약한 활성화 인자' : ''}`);
    for (const c of p.chain) trace.push(`   · ${BL(c.to)} 는 ${c.via} 가 ${BL(c.from)} 로 만든다 (끝 ${fmt(Math.max(0, c.amount))}${c.start != null ? `, 시작 ${fmt(c.start)}` : ''})`);
    if (p.resource) trace.push(`근본 원인: ${BL(p.resource.bundle)} 고갈${p.resource.t_exhausted != null ? ` @ t = ${h(p.resource.t_exhausted)}` : ''} (규칙 ${p.resource.rule}) → ${p.suggestion}`);
  } else if (predicted && r.final.state === predicted) {
    // 성공 사슬: 목표의 높은 표지 → 합성 조절 중 0 → 도달 사이 ln 배율이 가장 크게 오른 것 → 그것이 대사물이면 그것을 만드는 빠른 규칙의 조절(신호)
    for (const b of highOf(predicted)) {
      const syn = P.ruleInfo.findIndex((R) => R.layer === 'slow' && R.kind === 'supply' && R.prods.some(([pb]) => pb === b)); if (syn < 0) continue;
      const f0 = P.factorsAt(N0)[syn], f1 = P.factorsAt(series[jE])[syn];
      trace.push(`${BL(b)}: ${fmt(N0[at.get(b)])} (신호 전) → ${fmt(val(jE, b))} (${h(tEnd)}) — 합성 배율 Π ${fmt(f0.reduce((a, x) => a * x, 1))} → ${fmt(f1.reduce((a, x) => a * x, 1))}`);
      P.ruleInfo[syn].mods.map((m, q) => ({ m, d: Math.log(f1[q] / f0[q]), f0: f0[q], f1: f1[q] })).sort((a, z) => Math.abs(z.d) - Math.abs(a.d)).forEach((x) => {
        trace.push(`   · ${BL(x.m.bundle)} ${x.m.effect === 'activates' ? '→' : '⊣'} 배율 ${fmt(x.f0)} → ${fmt(x.f1)} (Δln ${x.d >= 0 ? '+' : ''}${x.d.toFixed(2)})`);
        const mk = P.ruleInfo.findIndex((R) => R.layer === 'fast' && R.prods.some(([pb]) => pb === x.m.bundle));
        if (mk >= 0 && Math.abs(x.d) > 0.05) {
          const g0 = P.factorsAt(N0)[mk], g1 = P.factorsAt(series[jE])[mk];
          const fl = (j) => (j < 1 ? null : (P.cum[j][mk] - P.cum[j - 1][mk]) / dt);
          trace.push(`      ← ${P.ruleInfo[mk].ref} 흐름 ${fmt(fl(1))} → ${fmt(fl(jE))} /s; 그 조절: ${P.ruleInfo[mk].mods.map((m, q) => `${BL(m.bundle)} ${m.effect === 'activates' ? '→' : '⊣'} ${fmt(g0[q])}→${fmt(g1[q])}`).join(', ') || '없음'}`);
        }
      });
    }
    for (const c of r.commitment.filter((x) => x.to === predicted && x.t != null)) trace.push(`결정 ${h(c.t)}: 그 뒤로는 신호를 끊어도 자기 활성화·대사 유지 고리가 상태를 붙든다 (철회 탐침 ${c.grid ? c.grid.length : 0} 격자 + 이분)`);
  } else trace.push('목표 상태가 정해지지 않음 (구동된 전이가 없음) — 인과 추적 생략');
  return { r, infl, phases, checks, pass, disc, trace, ratios, inputs: { db: ctx.dbText ? sha(ctx.dbText) : null, scenario: ctx.scenarioText ? sha(ctx.scenarioText) : sha(sc) }, ctx, idxAt, highOf, val, vel, BL, L };
}

function processReportMarkdown(rep) {
  const { r, ctx } = rep, L = rep.L, BL = rep.BL, P = r.process, out = [];
  const why = r.postMortem ? r.postMortem.cause : '진전 없음';
  const outcome = r.final.state && r.final.state !== r.source ? `${L(r.final.state)} 도달 ${h(r.firstReach[r.final.state])}` : r.final.state === r.source ? `시작 상태 ${L(r.source)} 에 머묾/되돌아감 — 분화 정지 (${why})` : r.arrest ? `분화 정지 — 어느 상태에도 들지 못함 (${why})` : '미결정';
  out.push(`# 과정 분석 보고서 — ${r.scenario || '(이름 없는 시나리오)'}`, '');
  out.push('## 1. 요약 (Executive Summary)', '', '| 항목 | 내용 |', '|---|---|');
  out.push(`| 시작 상태 · 후보 | ${L(r.source)} → ${r.states.filter((s) => s !== r.source).map(L).join(', ')} |`);
  out.push(`| 신호 (선언된 일정) | ${P.schedule.map((s) => `${BL(s.bundle)}: ${s.list.map((e) => `${h(e.t)} → ${fmt(e.n)}`).join(', ')}`).join(' · ') || '없음'} |`);
  out.push(`| 결과 | **${outcome}** · 예측 ${rep.disc.length ? '과 다름 (§4)' : '과 일치'} |`);
  out.push(`| 결정 시점 | ${r.commitment.filter((c) => c.driven).map((c) => `${L(c.to)} ${h(c.t)}`).join(', ') || '—'} |`);
  out.push(`| 무결성 | **${rep.pass ? 'PASS' : 'FAIL'}** (${rep.checks.filter((c) => c.ok === true).length}/${rep.checks.length} 확인${rep.checks.some((c) => c.ok == null) ? `, 미실행 ${rep.checks.filter((c) => c.ok == null).length}` : ''}) |`);
  out.push(`| 상수 | ${r.hypothetical ? '**가상 값 (hypothetical)** — 결과는 기전이 그 값에서 어떻게 흐르는지를 말할 뿐, 실제 세포의 시각을 예측하지 않는다' : '데이터·시나리오 값'} |`, '');
  out.push('## 2. 단계별 전개 (Phase-wise Evolution)', '', '### 2.1 변곡점', '', '| 시각 | 종류 | 내용 |', '|---|---|---|');
  for (const x of rep.infl) out.push(`| ${h(x.t)} | ${x.type} | ${x.what} |`);
  out.push('', '### 2.2 시계열', '');
  const cols = [...r.markers.map((b) => BL(b)), ...rep.ratios.map(([x, y]) => `${BL(x).split('@')[0]}/${BL(y).split('@')[0]}`)];
  out.push(`| t | ${cols.join(' | ')} | 목표 거리 | 상태 | 적분 단계 |`, `|---|${cols.map(() => '---').join('|')}|---|---|---|`);
  const grid = [...new Set([...ctx.gridHours.map((x) => x * 3600).filter((t) => t <= r.t_end + 1e-9), r.t_end])];
  for (const t of grid) { const j = rep.idxAt(t), tr = r.trajectory[j]; out.push(`| ${h(r.process.times[j])} | ${[...r.markers.map((b) => `${fmt(rep.val(j, b))} (${fmt(rep.vel(j, b))}/h)`), ...rep.ratios.map((pr) => fmt(rep.val(j, pr[0]) / Math.max(rep.val(j, pr[1]), 1e-12)))].join(' | ')} | ${r.target ? fmt(tr.d[r.target]) : '—'} | ${tr.cls.state ? L(tr.cls.state) : '전이 중'} | ${tr.steps} |`); }
  out.push('', '표지 칸: 분자 수 (log10 변화 속도 /h).', '', '### 2.3 구간 [기간 | 주된 원인 | 우세 표지 | 대사 비용]', '', '| 구간 | 기간 | 주된 원인 | 우세 표지 | 대사 비용 |', '|---|---|---|---|---|');
  for (const p of rep.phases) {
    const drv = p.driver ? `${p.driver.kind}: ${BL(p.driver.m.bundle)} ${p.driver.m.effect === 'activates' ? '→' : '⊣'} ${BL(p.driver.tgt).split('@')[0]} 합성 (배율 ${fmt(p.driver.f0)} → ${fmt(p.driver.f1)})` : '—';
    const cost = [...Object.entries(p.fuels).filter(([, v]) => v > 0).map(([b, v]) => `${BL(b)} ${fmt(v)} 분자 (${fmt(v / Math.max(1e-9, (p.t1 - p.t0) / 3600))}/h)`), ...p.flows.map((f) => `흐름 ${f.R.ref} ${fmt(f.x)}`)].join('; ') || '—';
    out.push(`| ${p.name}${p.sigOn.length ? ` · 신호 ${p.sigOn.join(', ')}` : ' · 신호 없음'} | ${h(p.t0)} – ${h(p.t1)} (${h(p.t1 - p.t0)}) | ${drv} | ${BL(p.dom.b)} (문턱의 ${fmt(p.dom.rel)}배); 가장 크게 변함 ${BL(p.mover.b).split('@')[0]} Δln ${p.mover.d >= 0 ? '+' : ''}${p.mover.d.toFixed(2)} | ${cost} |`);
  }
  out.push('', '## 3. 무결성 증명서 (Integrity Certificate)', '', '| 확인 | 결과 | 근거 |', '|---|---|---|');
  for (const c of rep.checks) out.push(`| ${c.name} | ${c.ok === true ? 'PASS' : c.ok === false ? '**FAIL**' : '미실행'} | ${c.detail} |`);
  out.push('', `입력 해시 — 데이터 sha256:${rep.inputs.db ? rep.inputs.db.slice(0, 16) : '—'} · 시나리오 sha256:${rep.inputs.scenario.slice(0, 16)} · 궤적 sha256:${P.hash.slice(0, 16)}`, '');
  out.push(rep.pass
    ? `**판정: PASS.** 이 실행의 모든 상태 변화는 데이터베이스의 규칙(신호 → 대사 공급 규칙 → 대사물 → 전사 인자 합성·분해)과 위 해시의 입력만으로 만들어졌다. 매 관찰 격자 단계에서 부분 구조 원장과 저장소 재생이 상대 ${r.mass.tolerance} 안에서 맞았고, 신호는 선언된 일정 그대로였다. 이 증명서는 계산의 무결성을 증명할 뿐, 가상 상수의 생물학적 타당성을 증명하지 않는다.`
    : '**판정: FAIL.** 위에서 FAIL 인 항목이 있다 — 이 실행의 결과를 결론으로 쓰지 말 것.');
  out.push('', '## 4. 인과 추적 (Post-mortem / Causal Trace)', '');
  for (const l of rep.trace) out.push(`- ${l}`);
  out.push('', '### 예측과의 차이', '');
  out.push(rep.disc.length ? rep.disc.map((d) => `- ${d}`).join('\n') : `- 없음 — 예측(${ctx.scenario.expect ? '시나리오 expect' : '구동된 전이의 목표'})과 관찰이 같다`);
  out.push('', '## 5. 기술 부록 (Technical Appendix)', '', '| 지표 | 값 |', '|---|---|');
  out.push(`| 관찰 격자 Δ · 기간 | ${r.dt} s · ${h(r.t_end)} (${r.process.times.length} 단계) |`);
  out.push(`| 부분 구조 원장 편차 (최대 · 끝) | ${fmt(r.mass.worst)} · ${fmt(r.mass.series[r.mass.series.length - 1])} (허용 ${r.mass.tolerance}) |`);
  out.push(`| 저장소 재생 편차 (최대) | ${fmt(r.mass.replayWorst)} |`);
  out.push(`| 결합 적분 (Rodas3) | rtol ${r.integrator.rtol} · atol ${r.integrator.atol} 분자 · 받아들인 단계 ${r.integrator.steps} · 거부 ${r.integrator.rejected} (음수 ${r.integrator.rejectedNeg}) · 최소 단계 강제 ${r.integrator.hMinHits} · h ${fmt(r.integrator.h.min)}–${fmt(r.integrator.h.max)} s · Δ 당 ${r.integrator.perInterval.min}–${r.integrator.perInterval.max} 단계 |`);
  out.push(`| 결정 탐침 | ${r.stats.probes} |`);
  if (ctx.numerics) out.push(`| 수치 L2 (수렴 기준 대비, 처음 ${ctx.numerics.hours} h) | ${fmt(ctx.numerics.l2)} (기준 ${fmt(ctx.numerics.refMs)} ms) |`);
  out.push(`| 부분 구조별 (시작 → 끝, 소실) | ${r.mass.moieties.map((k) => `${L(k)} ${fmt(r.mass.start[k])} → ${fmt(r.mass.end[k])} (${fmt(r.mass.channels.lost[k])})`).join('<br>')} |`);
  out.push(`| 속도 상수 없음 (적용 안 함) | ${r.kineticGaps.join(', ') || '—'} |`);
  out.push(`| 힐 상수 없음 (배율 1) | ${r.modulationGaps.join(', ') || '—'} |`);
  out.push(`| 엔진 감사 | ${r.audit.map((a) => `[${a.code}] ${a.where}`).join('<br>') || '—'} |`);
  return out.join('\n') + '\n';
}

module.exports = { processReport, processReportMarkdown };
