// 시계 시험 (PLAN-092 안전망 → PLAN-093 시계 정리) — 엔진이 시간을 세는 방법 (해부 보고서 engine-teardown §2 · engine-teardown-2 §3)
//   PLAN-092 에서 결함 K1·K3·K4 를 "지금은 이렇게 틀린다"로 고정했고, PLAN-093 시계 정리가 그 줄만 올바른 값으로 갱신했다.
//   ① 정상 격자(t_end 가 dt_slow 의 배수): 기록 시각이 정확히 dt·i 이고 JS = Rust            — 정리 전후 그대로
//   ② 출하 시나리오의 t_end·신호 시각이 모두 dt_slow 의 배수 — 정리 전에 결함을 한 번도 안 밟은 이유. 출하 시나리오의 성질로 남긴다 (출하 시나리오의 시각열·궤적은 정리 전후 비트 불변)
//   ③ K3 (고침): 마지막 구간이 dt 보다 짧아도 기록 시각은 실제 적분 끝(t_end) — 상태와 시각이 맞음
//   ④ K4 (고침): 격자 사이의 신호 시각에서 적분을 끊고 그 시각에 신호를 바꾼다 (100 s 신호 ≠ 120 s 신호, 격자를 100 s 로 맞춘 실행과 같음)
//   ⑤ K1 (고침): 속도 엔진은 t_end 를 넘지 않는다 (마지막 걸음만 dt 보다 짧음)
//   ⑥ 신호 시각이 격자점을 h_min 보다 가깝게 비껴가면 그 격자점에서 적용 (조각이 h_min 보다 짧아지지 않음)
//   ⑦ 사법부의 무결성 증명서(수정 없이)가 짧은 마지막 구간·격자 사이 신호 실행에서도 통과
import SCN from '../scenarios.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const C = require('../core.js'), F = require('../engine/fate_engine.js'), ORCH = require('../orchestrator.js'), FA = require('../judicial/fate_audit.js'), PR = require('../judicial/process_report.js');
const DB = C.normalize(JSON.parse(readFileSync(new URL('../data/db.json', import.meta.url), 'utf8')));
const DIR = new URL('../examples/scenarios/', import.meta.url);
const SRC = 'D000174', RATE_PATH = 'LPS–TLR4–NF-κB 신호 전달';
const base = SCN.read(new URL('fate-effector-pulse-short-hypothetical.json', DIR)); // 신호 { D000163|extracellular: [{t:0,n:600},{t:3600,n:0}] } · dt_slow 60
const SIGKEY = Object.keys(base.signals)[0];
const run = (over, engine) => F.simulateFate(DB, SRC, { scenario: { ...base, ...over }, engine, commitment: false });
const both = (over) => [run(over, 'js'), run(over, 'rust')];
const relDiff = (a, b) => { let w = 0; for (const k of a.keys) w = Math.max(w, Math.abs(a.final.N[k] - b.final.N[k]) / Math.max(1, Math.abs(b.final.N[k]))); return w; };

test('① 정상 격자: t_end 가 dt_slow 의 배수이면 기록 시각이 정확히 dt·i (JS = Rust)', () => {
  const want = Array.from({ length: 10 }, (_, i) => (i + 1) * 60);
  for (const r of both({ t_end: 600, dt_slow: 60 })) {
    assert.deepEqual(Array.from(r.process.times), want, `${r.engine}: 기록 시각`);
    assert.equal(r.t_end, 600);
  }
});

test('② 출하 시나리오는 모두 t_end·신호 시각이 dt_slow 의 배수 (정리 전에 결함 K3·K4 를 밟지 않았던 이유)', () => {
  const files = readdirSync(DIR).filter((f) => f.endsWith('.json'));
  const aligned = (t, dt) => Math.abs(t / dt - Math.round(t / dt)) < 1e-12;
  let fate = 0;
  const raw = (f) => JSON.parse(readFileSync(new URL(f, DIR), 'utf8'));
  for (const f of files) {
    let sc = raw(f);
    if (sc.base) sc = { ...raw(sc.base), ...sc }; // 파생 시나리오는 기준을 이어받음
    const dt = sc.dt_slow || 60, tEnd = sc.t_end != null ? sc.t_end : 48 * 3600;
    if (sc.t_end != null || sc.signals) fate++;
    assert.ok(aligned(tEnd, dt), `${f}: t_end ${tEnd} 가 dt_slow ${dt} 의 배수가 아님 — K3(기록 시각이 틀림)을 처음 밟음`);
    for (const [b, list] of Object.entries(sc.signals || {})) for (const e of list) assert.ok(aligned(e.t, dt), `${f}: 신호 ${b} 의 시각 ${e.t} 가 dt_slow ${dt} 의 배수가 아님 — K4(신호가 늦게 적용됨)를 처음 밟음`);
  }
  assert.ok(files.length >= 20 && fate >= 10, `시나리오 ${files.length} 개 · 운명 시나리오 ${fate} 개를 봄`);
});

test('③ K3 고침: 마지막 구간이 dt 보다 짧아도 기록 시각은 실제 적분 끝 — [60, 100] (JS = Rust), 상태는 100 s 의 것', () => {
  const [js, rs] = both({ t_end: 100, dt_slow: 60 });
  for (const r of [js, rs]) assert.deepEqual(Array.from(r.process.times), [60, 100], `${r.engine}: 마지막 기록 시각은 t_end`);
  for (const r of [js, rs]) {
    const at100 = run({ t_end: 100, dt_slow: 100 }, r.engine), at120 = run({ t_end: 120, dt_slow: 60 }, r.engine);
    assert.ok(relDiff(r, at100) < 1e-6, `${r.engine}: 마지막 기록의 상태가 100 s 와 다름 ${relDiff(r, at100)}`);
    assert.ok(relDiff(r, at120) > 1e-3, `${r.engine}: 100 s 와 120 s 의 상태가 구별되지 않음 — 시험의 힘이 없음`);
    assert.ok(r.process.times.every((t) => t <= 100), `${r.engine}: 기록 시각이 t_end 를 넘음`);
    assert.ok(r.events.every((e) => e.t <= 100), `${r.engine}: 사건 시각이 t_end 를 넘음`);
  }
});

const sigAt = (t) => ({ [SIGKEY]: base.signals[SIGKEY].map((e) => (e.t > 0 ? { ...e, t } : e)) });
const finalNums = (r) => r.keys.map((k) => r.final.N[k]);
const relNums = (a, b) => { let w = 0; a.forEach((x, i) => { w = Math.max(w, Math.abs(x - b[i]) / Math.max(1, Math.abs(b[i]))); }); return w; };

test('④ K4 고침: 격자 사이의 신호 시각에서 적분을 끊고 그 시각에 신호를 바꾼다 — 100 s 신호는 격자를 100 s 로 맞춘 실행과 같고 120 s 신호와 다름', () => {
  for (const engine of ['js', 'rust']) {
    const a = run({ signals: sigAt(100), t_end: 300, dt_slow: 60 }, engine);
    const aligned = run({ signals: sigAt(100), t_end: 300, dt_slow: 100 }, engine), late = run({ signals: sigAt(120), t_end: 300, dt_slow: 60 }, engine);
    assert.ok(relNums(finalNums(a), finalNums(aligned)) < 1e-6, `${engine}: 100 s 신호가 격자 100 s 실행과 다름 ${relNums(finalNums(a), finalNums(aligned))}`);
    assert.ok(relNums(finalNums(a), finalNums(late)) > 1e-3, `${engine}: 100 s 신호와 120 s 신호가 구별되지 않음 — 시험의 힘이 없음`);
    // 기록되는 신호 값은 구간 시작의 값 (사법부의 신호 확인이 읽는 규약 그대로)
    assert.deepEqual(JSON.parse(JSON.stringify(a.process.sig)), [[600], [600], [0], [0], [0]], `${engine}: 기록된 신호`);
    assert.equal(a.stats.hMinHits, 0, `${engine}: 구간 조각이 최소 걸음 강제 수락을 일으킴`);
  }
});

test('⑥ 신호 시각이 격자점을 h_min 보다 가깝게 비껴가면 그 격자점에서 적용 — 조각을 만들지 않음 (비트 동일)', () => {
  for (const engine of ['js', 'rust']) {
    const exact = run({ signals: sigAt(120), t_end: 300, dt_slow: 60 }, engine), near = run({ signals: sigAt(120 + 1e-7), t_end: 300, dt_slow: 60 }, engine), before = run({ signals: sigAt(120 - 1e-7), t_end: 300, dt_slow: 60 }, engine);
    assert.deepEqual(finalNums(near), finalNums(exact), `${engine}: 격자점 뒤 1e-7 s 의 신호가 격자점의 신호와 다름`);
    assert.deepEqual(finalNums(before), finalNums(exact), `${engine}: 격자점 앞 1e-7 s 의 신호가 격자점의 신호와 다름`);
  }
});

test('⑤ K1 고침: 속도 엔진은 t_end 를 넘지 않는다 — 마지막 걸음만 dt 보다 짧음 (배수면 걸음 수가 옛날과 같음)', () => {
  const sc = SCN.read(new URL('lps-hypothetical.json', DIR));
  const last = (T, dt) => { const r = C.simulateRate(DB, RATE_PATH, { scenario: sc, t_end: T, dt, trace: 'full' }); return { r, ts: r.series.map((x) => x.t) }; };
  const a = last(0.5, 0.07), b = last(1, 0.3), c = last(0.5, 0.01);
  assert.equal(a.ts[a.ts.length - 1], 0.5, '0.5 s 를 요청하면 0.5 s 에서 끝남 (옛날 0.56)');
  assert.equal(a.ts.length, 9, '시작점 1 + 온전한 걸음 7 + 짧은 걸음 1');
  assert.equal(b.ts[b.ts.length - 1], 1, '1 s 를 요청하면 1 s 에서 끝남 (옛날 1.2)');
  assert.equal(c.ts[c.ts.length - 1], 0.5, '배수이면 정확');
  assert.equal(c.ts.length, 51);
  c.ts.forEach((t, i) => assert.equal(t, +(i * 0.01).toFixed(9), `온전한 걸음의 시계는 곱셈 ${i}·dt 를 소수 9 자리로 자른 값`));
  // 짧은 걸음의 길이가 반영됨: 온전한 걸음 7 개(0.49 s)에서 0.01 s 짧은 걸음만큼 더 간 값은, 온전한 걸음 하나(0.07 s)만큼 더 간 값(0.56 s)보다 훨씬 가깝다
  //   (짧은 걸음이 dt 만큼 진행했다면 둘이 같아진다 — 옛 동작. 잘게 나눈 실행과의 비교는 오일러의 1 차 오차가 섞여 쓰지 않는다)
  const seven = last(0.49, 0.07), eight = last(0.56, 0.07), worst = (x, y) => Object.keys(y.r.final).reduce((w, k) => Math.max(w, Math.abs(x.r.final[k] - y.r.final[k]) / Math.max(1, Math.abs(y.r.final[k]))), 0);
  assert.equal(seven.ts.length, 8, '0.49 s = 온전한 걸음 7 개');
  assert.ok(worst(a, seven) < 0.5 * worst(eight, seven), `짧은 걸음의 진행 ${worst(a, seven)} 이 온전한 걸음의 진행 ${worst(eight, seven)} 의 절반 미만이 아님`);
});

test('⑦ 사법부 무결성 증명서가 짧은 마지막 구간(K3)·격자 사이 신호(K4) 실행에서도 통과 — 판정 코드는 그대로', () => {
  const cases = { 'K3 t_end=100': { t_end: 100, dt_slow: 60 }, 'K4 신호 100 s': { signals: sigAt(100), t_end: 300, dt_slow: 60 } };
  for (const [label, over] of Object.entries(cases)) for (const engine of ['js', 'rust']) {
    const sc = { ...base, ...over };
    const v = ORCH.runFate(DB, SRC, { scenario: sc, engine, commitment: false });
    assert.ok(!v.error, v.error);
    const again = FA.trajectoryHash(F.simulateFate(DB, SRC, { scenario: sc, engine, commitment: false }));
    const rep = PR.processReport(v, { scenario: sc, scenarioText: JSON.stringify(sc), dbText: readFileSync(new URL('../data/db.json', import.meta.url), 'utf8'), rerunHash: again });
    const fails = (rep.checks || []).filter((c) => c.pass === false || c.ok === false).map((c) => c.name || c.label);
    assert.deepEqual(fails, [], `${label} ${engine}: 증명서 실패 항목`);
    assert.equal(rep.pass, true, `${label} ${engine}: 증명서 통과`);
  }
});
