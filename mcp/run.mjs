#!/usr/bin/env node
// MCP 서버 run — 엔진 실행 창구 (읽기 전용, PLAN-094). 시나리오를 받아 운명 엔진 · 앙상블 · 속도 엔진을 돌리고 예측을 돌려준다.
//   엔진은 저장소를 바꾸지 않는다 — 이 서버도 파일을 쓰지 않고 서기를 부르지 않는다(조회와 같은 급). 판정은 사법부 함수가 한다.
//   모든 결과에 출처 꼬리표(provenance)를 붙인다:
//     inputs   — db · 시나리오(정준 해시) · 대상 · 엔진 · 선택지, IR 해시, 코드 지문(엔진 · 컴파일러 · 사법부 · 어휘 파일 내용)
//     mode     — 'protocol'(규약 + 사전 등록이 실행보다 앞섬 — 검증 결론을 낼 수 있는 실행) 아니면 'exploration'(탐색 — 일치 결론 못 냄)
//     grades   — 실행이 읽은 상수의 등급(데이터 상수) · 가상(시나리오 상수) 수, 관문 위반 수
//     assumptions — 시나리오 hypothetical · 쓴 가정 번호(A…) · 첫 장면 기원(실측 · 추상 · 가정 · 기원 없음) 수
//     limitations — 실행이 닿는 정의항 · 규칙을 대상으로 한 열린 한계
//     output_sha256 — 위 전부와 결과 요약의 정준 해시: 같은 입력 · 같은 코드면 같은 값 (시간 · 경로 같은 실행 환경은 넣지 않음)
//   실행: BIODB_ROLE=collector node mcp/run.mjs   (BIODB_DATA = 다른 data 폴더, 시험용)
import { readFileSync, statSync, existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { join, dirname, resolve, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, need, ROLES } from './protocol.mjs';
const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = process.env.BIODB_DATA ? resolve(process.env.BIODB_DATA) : join(ROOT, 'data');
const C = require('../core.js'), ORCH = require('../orchestrator.js'), IRB = require('../compiler/ir_builder.js'), AS = require('../compiler/assumptions.js');
const J = require('../judicial/judicial.js'), FA = require('../judicial/fate_audit.js'), SA = require('../judicial/stoch_audit.js');
const PROTO = require('../judicial/protocol.js'), REL = require('../judicial/reliability.js'), SO = require('../judicial/scene_origin.js');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const canon = (o) => (Array.isArray(o) ? `[${o.map(canon).join(',')}]` : o && typeof o === 'object' ? `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => JSON.stringify(k) + ':' + canon(o[k])).join(',')}}` : JSON.stringify(o));
const jsonl = (f) => (existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)) : []);
const SCENARIO_DIR = join(ROOT, 'examples', 'scenarios');
const MAX_N = 500; // 앙상블 궤적 수 상한 — 한 호출이 서버를 오래 붙들지 않게

// 코드 지문: 실행 결과를 정하는 소스(엔진 · 컴파일러 · 사법부 · 조정자 · 어휘)의 내용 해시 — 파일 이름 순, 시작할 때 한 번
const CODE_FILES = (() => {
  const walk = (d) => readdirSync(join(ROOT, d), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === 'target' || e.name.startsWith('.') ? [] : walk(`${d}/${e.name}`)) : /\.(js|mjs|rs|wasm)$/.test(e.name) ? [`${d}/${e.name}`] : []));
  return ['core.js', 'model.js', 'vocab.js', 'orchestrator.js', 'scenarios.js', ...walk('engine'), ...walk('compiler'), ...walk('judicial')].sort();
})();
const CODE_SHA = sha(CODE_FILES.map((f) => `${f}\0${sha(readFileSync(join(ROOT, f)))}\n`).join(''));

// 저장소 상태 — db · 가정 원장 · 사전 등록부를 (크기, 수정 시각)이 바뀔 때만 다시 읽는다 (query 서버와 같은 방식)
const FILES = ['db.json', 'assumptions.jsonl', 'preregistrations.jsonl'];
let state = null;
const keyNow = () => FILES.map((f) => { const p = join(DATA, f); if (!existsSync(p)) return `${f}:-`; const s = statSync(p); return `${f}:${s.size}:${s.mtimeMs}`; }).join('|');
function S() {
  const key = keyNow();
  if (state && state.key === key) return state;
  const text = readFileSync(join(DATA, 'db.json'), 'utf8'), db = C.normalize(JSON.parse(text));
  state = { key, db, ix: C.index(db), dbSha: sha(text), assumptions: jsonl(join(DATA, 'assumptions.jsonl')), prereg: jsonl(join(DATA, 'preregistrations.jsonl')) };
  return state;
}

const inRepo = (p) => { const abs = resolve(ROOT, p), r = relative(ROOT, abs); if (r.startsWith('..')) throw new Error(`저장소 밖 경로: ${p}`); return abs; };
const subjectOf = (file) => { const f = join(SCENARIO_DIR, 'subjects.json'); return file && existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')).subjects[basename(file)] || null : null; };
// 시나리오: 저장소 안 파일(scenario) 또는 글(scenario_json) — 가정 번호(A…)는 원장으로 푼다(풀리지 않으면 거부 — 숫자를 지어내지 않음)
function scenarioOf(a, s) {
  let raw, file = null;
  if (a.scenario) { file = inRepo(need(a, 'scenario')); raw = readFileSync(file, 'utf8'); }
  else if (a.scenario_json) raw = need(a, 'scenario_json');
  else throw new Error("시나리오가 필요함 — scenario(저장소 안 경로) 또는 scenario_json(글)");
  let sc; try { sc = JSON.parse(raw); } catch (e) { throw new Error('시나리오가 JSON 이 아님'); }
  const r = AS.resolve(sc, s.assumptions);
  if (r.error) throw new Error(`시나리오: ${r.error}`);
  return { scenario: r.scenario, used: r.used, file: file ? relative(ROOT, file) : null };
}
function targetOf(a, s, file, kind) {
  const t = a.target || subjectOf(file);
  if (!t) throw new Error('대상 없음 — target 을 주거나 examples/scenarios/subjects.json 에 등록된 시나리오를 쓴다');
  const x = C.resolveRef(s.ix, String(t));
  if (x.error) throw new Error(x.error);
  const k = (s.db.senses[x.id] || {}).kind;
  if (kind === 'cell_state' && k !== 'cell_state') throw new Error(`'${x.id}' 는 세포 상태(cell_state)가 아님 — 운명 엔진의 대상은 시작 세포 상태`);
  if (kind === 'rate' && k === 'cell_state') throw new Error(`'${x.id}' 는 세포 상태 — 속도 엔진이 아니라 run_fate · run_ensemble`);
  return x.id;
}
const engineOf = (a) => { const e = a.engine || 'rust'; if (!['rust', 'js'].includes(e)) throw new Error(`engine '${e}' — rust | js`); return e; };

// 열린 한계 중 실행이 닿는 것(대상 · 필요 항목이 실행의 정의항 · 규칙)
function openLimitations(db, ids) {
  const want = new Set(ids);
  return Object.entries(db.limitations).filter(([, l]) => J.limitationStatus(db, l).status === 'open')
    .filter(([, l]) => want.has(l.target) || want.has((C.parseTarget ? C.parseTarget(l.target) || {} : {}).base) || (l.requirement.needs || []).some((n) => want.has(n.rule) || want.has(n.on)))
    .map(([id, l]) => ({ id, target: l.target, type: l.type })).sort((x, y) => (x.id < y.id ? -1 : 1));
}

// 출처 꼬리표 — 결과 요약(result)과 함께 정준 해시
function provenance(s, L, target, opt) {
  const { scenario: sc } = L, pv = PROTO.protocolVerdict(s.db, sc, { prereg: s.prereg, runAt: new Date().toISOString() });
  const origin = SO.sceneOrigin(s.db, sc, { target, used: L.used });
  return {
    inputs: { db_sha256: s.dbSha, scenario_sha256: PROTO.scenarioHash(sc), scenario_file: L.file, target, ...opt, code_sha256: CODE_SHA },
    mode: pv.declared && pv.ok ? 'protocol' : 'exploration',
    mode_why: pv.declared && pv.ok ? `규약 · 사전 등록 #${pv.registered.seq} (${pv.registered.at})` : (pv.problems || []).slice(0, 3).join(' · '),
    assumptions: { hypothetical: !!sc.hypothetical, used: [...new Set(L.used.map((u) => (typeof u === 'string' ? u : u.id)).filter(Boolean))].sort(), origin: origin.error ? { error: origin.error } : origin.count },
  };
}
function finish(prov, result, grades, limits, text) {
  const data = { ...prov, grades, limitations: limits, result };
  data.output_sha256 = sha(canon(data));
  const g = grades.byGrade ? Object.entries(grades.byGrade).map(([k, n]) => `${k} ${n}`).join(' · ') : '—';
  const head = [
    `실행 방식: ${data.mode === 'protocol' ? '규약 실행' : '탐색 실행 — 검증 결론(일치)을 낼 수 없음'}${data.mode_why ? ` (${data.mode_why})` : ''}`,
    `상수 등급: ${g}${grades.violations ? ` · 관문 위반 ${grades.violations}` : ''} · 시나리오 ${data.assumptions.hypothetical ? '가상(hypothetical)' : '가상 선언 없음'} · 가정 번호 ${data.assumptions.used.length}`,
    `첫 장면 기원: ${data.assumptions.origin.error ? data.assumptions.origin.error : Object.entries(data.assumptions.origin).map(([k, n]) => `${SO.ORIGIN_KO[k] || k} ${n}`).join(' · ')}`,
    `열린 한계 ${limits.length}${limits.length ? ': ' + limits.slice(0, 8).map((l) => l.id).join(' · ') + (limits.length > 8 ? ' …' : '') : ''}`,
    `입력 지문: db ${data.inputs.db_sha256.slice(0, 12)} · 시나리오 ${data.inputs.scenario_sha256.slice(0, 12)} · IR ${(data.inputs.ir_hash || '—').slice(0, 12)} · 코드 ${CODE_SHA.slice(0, 12)} · 출력 ${data.output_sha256.slice(0, 12)}`,
  ];
  return { text: `${head.join('\n')}\n\n${text}`, data };
}
const gradesOfIR = (ir, sc) => { const v = REL.constantVerdict(ir, sc); return v.error ? { error: v.error } : { min: v.min, byGrade: v.byGrade, violations: v.violations.length }; };
const fateIds = (ir) => [ir.source, ...ir.states, ...ir.keys.map((b) => b.split('|')[0]), ...ir.rules.flatMap((R) => [R.ref, ...R.mods.map((m) => m.ref)])];
const num = (x) => (Number.isFinite(x) ? x : null);
const ALL = ROLES;
const str = (d) => ({ type: 'string', description: d });
const SC_PROPS = { scenario: str('시나리오 경로 (저장소 안, 예: examples/scenarios/…json)'), scenario_json: str('시나리오 JSON 글 (scenario 대신)'), target: str('대상 — 운명: 시작 세포 상태, 속도: 경로 (없으면 subjects.json)') };

const tools = [
  { name: 'run_fate', roles: ALL, description: '운명 엔진 실행 (결정론) — 끝 상태 · 도달 시각 · 결정 시각 · 표지 끝 값 + 출처 꼬리표(입력 지문 · 등급 · 가정 의존 · 열린 한계 · 탐색/규약)',
    inputSchema: { type: 'object', properties: { ...SC_PROPS, engine: { type: 'string', enum: ['rust', 'js'] }, t_hours: { type: 'number' }, commitment: { type: 'boolean', description: '결정 탐침 (기본 true)' } } },
    run: (a) => {
      const s = S(), L = scenarioOf(a, s), target = targetOf(a, s, L.file, 'cell_state'), engine = engineOf(a);
      const { stochastic, ...sc } = L.scenario; // 결정론 실행 — 확률 층은 run_ensemble
      if (a.t_hours != null) { if (!(a.t_hours > 0)) throw new Error('t_hours 는 양수'); sc.t_end = a.t_hours * 3600; }
      const commitment = a.commitment === false ? false : undefined, ir = IRB.buildFateIR(s.db, target, sc);
      if (ir.error) throw new Error(ir.error);
      const v = ORCH.runFate(s.db, target, { scenario: sc, engine, commitment, ir });
      if (v.error) throw new Error(v.error);
      const prov = provenance(s, { ...L, scenario: sc }, target, { engine, t_end: v.t_end, commitment: commitment !== false, ir_hash: ir.hash });
      const result = { final_state: v.final.state || null, nearest: v.final.nearest || null, first_reach: v.firstReach, commitment: (v.commitment || []).map((c) => ({ to: c.to, criterion: c.criterion || null, t: c.t != null ? num(c.t) : null })),
        markers: Object.fromEntries(v.markers.map((b) => [b, num(v.final.N[b])])), trajectory_sha256: FA.trajectoryHash(v) };
      return finish(prov, result, gradesOfIR(ir, sc), openLimitations(s.db, fateIds(ir)), FA.fateText(v).text);
    } },
  { name: 'run_ensemble', roles: ALL, description: '확률 앙상블 (운명 엔진 혼성 확률 층) — 끝 상태 비율(Wilson 구간) · 도달 시각 분위 · 표지 평균·sd + 출처 꼬리표. 시나리오에 stochastic { seed } 필요',
    inputSchema: { type: 'object', properties: { ...SC_PROPS, n: { type: 'integer', description: `궤적 수 (1–${MAX_N})` }, engine: { type: 'string', enum: ['rust', 'js'] } }, required: ['n'] },
    run: (a) => {
      const s = S(), L = scenarioOf(a, s), target = targetOf(a, s, L.file, 'cell_state'), engine = engineOf(a), n = a.n;
      if (!Number.isInteger(n) || n < 1 || n > MAX_N) throw new Error(`n 은 1–${MAX_N} 정수`);
      if (!L.scenario.stochastic) throw new Error('앙상블에는 시나리오 stochastic { seed } 가 필요함 (seed 는 입력 — 입력 해시에 들어감)');
      const ir = IRB.buildFateIR(s.db, target, L.scenario);
      if (ir.error) throw new Error(ir.error);
      const raws = ORCH.runEnsemble(s.db, target, L.scenario, n, { engine, commitment: false });
      if (raws.error) throw new Error(raws.error);
      const audits = raws.map((r) => SA.auditTrajectory(s.db, r, { scenario: L.scenario }));
      const defects = audits.flatMap((x, i) => (x.error ? [`궤적 ${i}: ${x.error}`] : x.audit.filter((z) => z.fault === 'ENGINE_DEFECT' || z.fault === 'COMPILER_DEFECT').map((z) => `궤적 ${i}: [${z.code}] ${z.msg}`)));
      const sum = SA.ensembleSummary(raws), clean = (o) => JSON.parse(JSON.stringify(o, (k, x) => (typeof x === 'number' && !Number.isFinite(x) ? null : x)));
      const prov = provenance(s, L, target, { engine, n, seed: L.scenario.stochastic.seed, ir_hash: ir.hash });
      const result = { ...clean(sum), integrity: defects.length ? { ok: false, defects: defects.slice(0, 10) } : { ok: true } };
      return finish(prov, result, gradesOfIR(ir, L.scenario), openLimitations(s.db, fateIds(ir)), SA.ensembleText(sum) + (defects.length ? `\n\n무결성 FAIL ${defects.length}: ${defects.slice(0, 3).join(' · ')}` : '\n\n무결성: 궤적별 원장 · 재생 · 정수 발화 PASS'));
    } },
  { name: 'run_rate', roles: ALL, description: '속도 엔진 실행 (경로) — 끝 분자 수 · 정지 · 감사 + 출처 꼬리표',
    inputSchema: { type: 'object', properties: { ...SC_PROPS, t_end: { type: 'number', description: '끝 시각 s (기본 60)' }, dt: { type: 'number', description: '걸음 s (기본 1e-3)' } } },
    run: (a) => {
      const s = S(), L = scenarioOf(a, s), target = targetOf(a, s, L.file, 'rate');
      const t_end = a.t_end != null ? a.t_end : 60, dt = a.dt != null ? a.dt : 1e-3;
      if (!(t_end > 0) || !(dt > 0) || t_end / dt > 1e7) throw new Error('t_end · dt 는 양수, 걸음 수 ≤ 1e7');
      const r = ORCH.runRate(s.db, target, { scenario: L.scenario, t_end, dt });
      if (r.error) throw new Error(r.error);
      const prov = provenance(s, L, target, { engine: 'rate', t_end, dt, ir_hash: r.irHash || null });
      const fromSc = (ref) => !!((L.scenario.kinetics || {})[ref]);
      const byGrade = {}; for (const u of r.kinUsed || []) { const g = fromSc(u.ref) ? 'hypothetical' : 'data'; byGrade[g] = (byGrade[g] || 0) + 1; }
      const audit = (r.audit || []).map((z) => ({ code: z.code, fault: z.fault })), ids = [target, ...Object.keys(r.final).map((b) => b.split('|')[0]), ...(r.kinUsed || []).map((u) => u.ref)];
      const result = { final: Object.fromEntries(Object.entries(r.final).map(([b, x]) => [b, num(x)])), stalls: (r.stalls || []).length, death: r.death || null, audit };
      return finish(prov, result, { byGrade }, openLimitations(s.db, ids), J.simulateRateText(s.db, target, r));
    } },
];

serve({ name: 'biodb-run', version: '1', instructions: '읽기 전용 실행 — 엔진을 돌려 예측을 돌려준다. 저장소를 바꾸지 않는다. 결과의 mode 가 exploration 이면 검증 결론을 낼 수 없다.', tools });
