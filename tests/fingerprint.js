#!/usr/bin/env node
// 지문 대조 — 엔진을 고치기 전과 후의 결과가 비트까지 같은지 확인하는 도구 (쓰기: 지정한 JSON 파일 하나)
//   node tests/fingerprint.js snapshot <지문.json> [--only 이름조각] [--no-rate]   고치기 전에 지문을 만든다
//   node tests/fingerprint.js compare  <지문.json> [<다른지문.json>] [--only 이름조각]   고친 뒤 대조 (두 번째가 없으면 지금 코드로 다시 만들어 대조)
//   node tests/fingerprint.js parity   [<지문.json>] [--only 이름조각]   같은 시나리오의 JS 와 Rust 칸이 같은지 (지문 파일이 없으면 지금 코드로 만든다)
// 운명 엔진: 파생이 아닌 시나리오를 JS · Rust 두 백엔드로 (결정 탐침 포함) · 속도 엔진: 대표 시나리오 몇 개.
// 칸마다 따로 해시해서 어느 칸이 달라졌는지 좁힌다 — 시각열 · 궤적 · 신호 기록 · 사건 · 도달 · 결정 · 끝 상태 · 적분 요약 · 걸음 수 · 난수 소비.
// 기준 지문은 저장소에 커밋하지 않는다: 해시는 실행기와 수학 함수 구현에 따라 달라질 수 있고, 의도한 변경마다 기준을 갈아야 하기 때문이다.
// 기본 시험(node --test)에 넣지 않는다 — 운명 엔진 26 시나리오 × 2 백엔드가 약 100 초.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const SCN = require('../scenarios.js');
const C = require('../core.js');
const F = require('../engine/fate_engine.js');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'examples/scenarios');
const sha = (x) => crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const arr = (x) => Array.from(x, (v) => (Array.isArray(v) || ArrayBuffer.isView(v) ? Array.from(v) : v));

// 운명 엔진: 시나리오 이름 앞부분 → 시작 상태
const FATE_SRC = [['fate-', 'D000174'], ['stochastic-mixed', 'D000174'], ['mhc-dc', 'D000202'], ['telomere-', 'D000210']];
// 속도 엔진: 시나리오 → 경로 (시나리오가 가리키는 계)
const RATE_PATH = { 'lps-hypothetical.json': 'LPS–TLR4–NF-κB 신호 전달', 'camp-competition-hypothetical.json': '에피네프린에 의한 글리코겐 분해', 'gtp-exhaustion-hypothetical.json': '에피네프린에 의한 글리코겐 분해', 'gtp-regeneration-hypothetical.json': '에피네프린에 의한 글리코겐 분해', 'tca-acetylcoa-exhaustion-hypothetical.json': '시트르산 회로', 'tca-co2-equilibrium-hypothetical.json': '시트르산 회로' };

function fateFields(r) {
  return {
    times: sha(arr(r.process.times)), series: sha(r.series.map(arr)), sig: sha(r.process.sig.map(arr)), events: sha(r.events), firstReach: sha(r.firstReach),
    commitment: sha(r.commitment.map((c) => ({ to: c.to, t: c.t, t_grid: c.t_grid, step: c.step }))), final: sha(arr(Object.values(r.final.N))),
    integrator: sha(r.integrator), steps: sha({ steps: r.stats.steps, rejected: r.stats.rejected, hMinHits: r.stats.hMinHits }),
    draws: sha(r.stochastic ? { draws: r.stochastic.draws, ssa: r.stochastic.ssaFires, switches: r.stochastic.switches } : null),
  };
}
function rateFields(r) {
  return { series: sha(r.series), final: sha(r.final), events: sha(r.events), ledger: sha(r.ledger), firstReach: sha(r.firstReach), stalls: sha(r.stalls), death: sha(r.death), irHash: sha(r.irHash) };
}

function build(only, withRate) {
  const db = C.normalize(JSON.parse(fs.readFileSync(path.join(ROOT, 'data/db.json'), 'utf8')));
  const out = { runs: {} };
  const want = (name) => !only || name.includes(only);
  for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.json') && x !== 'subjects.json').sort()) {
    const raw = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
    if (raw.base) continue; // 파생 시나리오는 기준 + 교란이라 따로 세지 않음
    const fate = FATE_SRC.find(([p]) => f.startsWith(p));
    if (fate) for (const engine of ['js', 'rust']) {
      const key = `fate|${f}|${engine}`;
      if (!want(key)) continue;
      const r = F.simulateFate(db, fate[1], { scenario: SCN.read(path.join(DIR, f)), engine });
      out.runs[key] = r.error ? { error: String(r.error).slice(0, 80) } : { n: r.process.times.length, fields: fateFields(r) };
    }
    if (withRate && RATE_PATH[f]) {
      const key = `rate|${f}`;
      if (!want(key)) continue;
      const r = C.simulateRate(db, RATE_PATH[f], { scenario: SCN.read(path.join(DIR, f)), t_end: 10, dt: 0.01 });
      out.runs[key] = r.error ? { error: String(r.error).slice(0, 80) } : { n: r.series.length, fields: rateFields(r) };
    }
  }
  return out;
}

function compare(a, b) {
  const lines = []; let same = 0, diff = 0;
  for (const k of Object.keys(a.runs)) {
    const x = a.runs[k], y = b.runs[k];
    if (!y) { lines.push(`없음  ${k}`); diff++; continue; }
    if (x.error || y.error) { if (JSON.stringify(x) === JSON.stringify(y)) same++; else { lines.push(`오류  ${k}: ${x.error || '정상'} → ${y.error || '정상'}`); diff++; } continue; }
    const cols = Object.keys(x.fields).filter((c) => x.fields[c] !== y.fields[c]);
    if (!cols.length && x.n === y.n) same++; else { diff++; lines.push(`다름  ${k}  (칸 ${x.n} → ${y.n}) 달라진 칸: ${cols.join(' · ') || '없음(길이만)'}`); }
  }
  for (const k of Object.keys(b.runs)) if (!a.runs[k]) { lines.push(`새 항목  ${k}`); diff++; }
  return { same, diff, lines };
}

// 같은 시나리오의 JS 와 Rust 칸을 견줘 어느 칸이 다른지 — 시나리오별 한 줄
function parity(snap) {
  const lines = []; let same = 0, diff = 0;
  for (const k of Object.keys(snap.runs)) {
    const m = /^fate\|(.+)\|js$/.exec(k); if (!m) continue;
    const a = snap.runs[k], b = snap.runs[`fate|${m[1]}|rust`];
    if (!b || a.error || b.error) continue;
    // steps 칸(전체 통계)은 뺀다: 결정 탐침을 워커 인스턴스가 나눠 돌려서 Rust 쪽 통계에는 탐침의 걸음이 안 잡힌다 — 본 실행의 걸음은 integrator 칸에 있다
    const cols = Object.keys(a.fields).filter((c) => c !== 'steps' && a.fields[c] !== b.fields[c]);
    if (!cols.length) same++; else { diff++; lines.push(`다름  ${m[1]}  달라진 칸: ${cols.join(' · ')}`); }
  }
  return { same, diff, lines };
}

function main(argv) {
  const [cmd, fileA, maybeB] = argv, flags = argv.filter((x) => x.startsWith('--'));
  const only = flags.includes('--only') ? argv[argv.indexOf('--only') + 1] : null, withRate = !flags.includes('--no-rate');
  const second = maybeB && !maybeB.startsWith('--') ? maybeB : null;
  if (cmd === 'snapshot' && fileA) {
    const t0 = Date.now(), snap = build(only, withRate);
    fs.writeFileSync(fileA, JSON.stringify(snap, null, 1));
    console.log(`지문 ${Object.keys(snap.runs).length} 개 → ${fileA} (${Math.round((Date.now() - t0) / 1000)} s)`);
    return 0;
  }
  if (cmd === 'compare' && fileA) {
    const a = JSON.parse(fs.readFileSync(fileA, 'utf8'));
    const b = second ? JSON.parse(fs.readFileSync(second, 'utf8')) : build(only, withRate);
    const r = compare(only ? { runs: Object.fromEntries(Object.entries(a.runs).filter(([k]) => k.includes(only))) } : a, b);
    console.log([...r.lines, `같음 ${r.same} · 다름 ${r.diff}`].join('\n'));
    return r.diff ? 1 : 0;
  }
  if (cmd === 'parity') {
    const snap = fileA && !fileA.startsWith('--') ? JSON.parse(fs.readFileSync(fileA, 'utf8')) : build(only, false);
    const r = parity(snap);
    console.log([...r.lines, `JS = Rust 같음 ${r.same} · 다름 ${r.diff}`].join('\n'));
    return r.diff ? 1 : 0;
  }
  console.error('사용: node tests/fingerprint.js snapshot <지문.json> [--only 조각] [--no-rate] · compare <지문.json> [<다른지문.json>] [--only 조각] · parity [<지문.json>] [--only 조각]');
  return 2;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { build, compare, parity, fateFields, rateFields };
