// MCP 실행 서버 run (PLAN-094) — 읽기 전용 실행 창구
//   ① 도구 목록: 역할 셋 모두 run_fate · run_ensemble · run_rate 셋 · 쓰기 함수 · 서기 · 자식 프로세스 없음
//   ② 같은 입력 같은 출력 해시 (한 서버 안 두 번 · 새 서버) · 실행 뒤 저장소 파일이 그대로
//   ③ 출처 꼬리표: 입력 지문 · 등급 · 가정 의존 · 열린 한계 · 규약 없는 실행은 'exploration', 사전 등록된 규약은 'protocol' — 시나리오를 고치면 다시 탐색
//   ④ 결과가 조정자를 직접 부른 것과 같다 (궤적 해시) ⑤ 거부: 저장소 밖 · 풀리지 않는 가정 번호 · 엔진과 맞지 않는 대상 · 궤적 수 범위
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const req = createRequire(import.meta.url);
const ROOT = new URL('..', import.meta.url).pathname;
const sha = (x) => createHash('sha256').update(x).digest('hex');
const MO = 'examples/scenarios/fate-mixed-optimal-hypothetical.json', BD = 'examples/scenarios/stochastic-birth-death-hypothetical.json';
const GTP = 'examples/scenarios/gtp-exhaustion-hypothetical.json', B2M = 'examples/scenarios/mhc-i-b2m-validation-hypothetical.json';

function call(msgs, env = {}) {
  const input = msgs.map((m, i) => JSON.stringify({ jsonrpc: '2.0', id: i + 1, ...m })).join('\n') + '\n';
  const r = spawnSync(process.execPath, [join(ROOT, 'mcp', 'run.mjs')], { input, encoding: 'utf8', env: { ...process.env, BIODB_ROLE: '', ...env }, cwd: ROOT, timeout: 300000 });
  return r.stdout.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}
const tool = (name, args) => ({ method: 'tools/call', params: { name, arguments: args || {} } });
const data = (m) => m.result.structuredContent;
const text = (m) => m.result.content[0].text;
// data/ 의 모든 파일 내용 지문 — 실행 앞뒤가 같아야 한다
const dataSnapshot = () => { const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [`${join(d, e.name)}:${statSync(join(d, e.name)).size}:${sha(readFileSync(join(d, e.name)))}`])); return sha(walk(join(ROOT, 'data')).sort().join('\n')); };

test('① 도구 목록: 이름표로 줄 수 있는 역할 둘 모두 실행 도구 셋 · human 이름표는 시작 거부 — 서버 코드에 파일 쓰기 · 서기 · 자식 프로세스 없음', () => {
  for (const role of ['collector', 'integrator']) {
    const [m] = call([{ method: 'tools/list' }], { BIODB_ROLE: role });
    assert.deepEqual(m.result.tools.map((t) => t.name).sort(), ['run_ensemble', 'run_fate', 'run_rate'], role);
  }
  assert.deepEqual(call([{ method: 'tools/list' }], { BIODB_ROLE: 'human' }), [], 'human 이름표로는 서버가 뜨지 않는다 (PLAN-105)');
  const src = readFileSync(join(ROOT, 'mcp', 'run.mjs'), 'utf8');
  assert.ok(!/\b(writeFileSync|appendFileSync|mkdirSync|rmSync|unlinkSync|renameSync|copyFileSync|cpSync|createWriteStream|writeFile|appendFile)\b/.test(src), '파일 쓰기 함수');
  assert.ok(!/legislative\/clerk|mcp\/clerk/.test(src), '서기를 부르지 않는다');
  assert.ok(!/child_process/.test(src), '자식 프로세스 없음');
});

test('② 같은 입력 같은 출력 해시 (한 서버 안 · 새 서버) · 실행 뒤 data/ 그대로', () => {
  const before = dataSnapshot();
  const args = { scenario: MO, commitment: false };
  const [a, b] = call([tool('run_fate', args), tool('run_fate', args)]), [c] = call([tool('run_fate', args)]);
  for (const m of [a, b, c]) assert.equal(m.result.isError, false, text(m));
  assert.equal(data(a).output_sha256, data(b).output_sha256, '한 서버 안 두 번');
  assert.equal(data(a).output_sha256, data(c).output_sha256, '새 서버');
  assert.match(data(a).output_sha256, /^[0-9a-f]{64}$/);
  // 입력이 바뀌면 출력 해시도 바뀐다
  const [d] = call([tool('run_fate', { ...args, t_hours: 24 })]);
  assert.notEqual(data(d).output_sha256, data(a).output_sha256);
  const [e1] = call([tool('run_ensemble', { scenario: BD, n: 8 })]), [e2] = call([tool('run_ensemble', { scenario: BD, n: 8 })]);
  assert.equal(data(e1).output_sha256, data(e2).output_sha256, '앙상블도 seed 가 입력 — 같은 출력');
  assert.equal(dataSnapshot(), before, 'data/ 가 바뀜 — 실행 창구는 읽기 전용');
});

test('③ 출처 꼬리표: 입력 지문 · 등급 · 가정 의존 · 열린 한계 · 탐색/규약', () => {
  const [f, r, e, p] = call([tool('run_fate', { scenario: MO, commitment: false }), tool('run_rate', { scenario: GTP }), tool('run_ensemble', { scenario: BD, n: 5 }), tool('run_fate', { scenario: B2M, commitment: false })]);
  const PROTO = req('../judicial/protocol.js'), SCN = req('../scenarios.js');
  for (const m of [f, r, e, p]) {
    assert.equal(m.result.isError, false, text(m));
    const x = data(m);
    assert.match(x.inputs.db_sha256, /^[0-9a-f]{64}$/); assert.match(x.inputs.scenario_sha256, /^[0-9a-f]{64}$/); assert.match(x.inputs.code_sha256, /^[0-9a-f]{64}$/);
    assert.ok(x.grades && x.grades.byGrade, '등급');
    assert.equal(typeof x.assumptions.hypothetical, 'boolean'); assert.ok(Array.isArray(x.assumptions.used)); assert.ok(x.assumptions.origin && !x.assumptions.origin.error, '첫 장면 기원');
    assert.ok(Array.isArray(x.limitations) && x.limitations.every((l) => /^L\d{6}$/.test(l.id)), '열린 한계');
    assert.ok(/^실행 방식: /.test(text(m)) && /입력 지문: /.test(text(m)), '글의 머리에도');
  }
  assert.equal(data(f).inputs.scenario_sha256, PROTO.scenarioHash(SCN.read(join(ROOT, MO))), '시나리오 지문 = 풀린 시나리오의 정준 해시 (사전 등록과 같은 계산)');
  assert.match(data(f).inputs.ir_hash, /^[0-9a-f]+$/);
  assert.ok(data(f).assumptions.hypothetical && data(f).assumptions.used.length > 0 && data(f).grades.byGrade.hypothetical > 0, '가상 시나리오는 가정 번호 · 가상 상수가 보인다');
  assert.ok(data(f).limitations.length > 0, '운명 계에 닿는 열린 한계가 있다');
  for (const m of [f, r, e]) assert.equal(data(m).mode, 'exploration', '규약 없는 실행은 탐색');
  assert.match(text(f), /탐색 실행 — 검증 결론\(일치\)을 낼 수 없음/);
  assert.equal(data(p).mode, 'protocol', `사전 등록된 규약 실행: ${data(p).mode_why}`);
  // 등록 뒤 시나리오를 고치면(끝 시각) 해시가 달라져 다시 탐색
  const [q] = call([tool('run_fate', { scenario: B2M, commitment: false, t_hours: 1 })]);
  assert.equal(data(q).mode, 'exploration');
});

test('④ 결과 = 조정자를 직접 부른 것 (궤적 해시 · 끝 상태 · 도달 시각)', () => {
  const C = req('../core.js'), ORCH = req('../orchestrator.js'), FA = req('../judicial/fate_audit.js'), SCN = req('../scenarios.js');
  const db = C.normalize(JSON.parse(readFileSync(join(ROOT, 'data', 'db.json'), 'utf8'))), { stochastic, ...sc } = SCN.read(join(ROOT, MO));
  const v = ORCH.runFate(db, 'D000174', { scenario: sc, engine: 'rust', commitment: false });
  const [m] = call([tool('run_fate', { scenario: MO, commitment: false })]), x = data(m).result;
  assert.equal(x.trajectory_sha256, FA.trajectoryHash(v));
  assert.equal(x.final_state, v.final.state);
  assert.deepEqual(x.first_reach, v.firstReach);
  // 글로 준 시나리오(scenario_json)도 같은 결과
  const [j] = call([tool('run_fate', { scenario_json: readFileSync(join(ROOT, MO), 'utf8'), target: 'D000174', commitment: false })]);
  assert.equal(data(j).result.trajectory_sha256, x.trajectory_sha256);
  assert.equal(data(j).inputs.scenario_sha256, data(m).inputs.scenario_sha256);
});

test('⑤ 거부: 저장소 밖 · 풀리지 않는 가정 번호 · 엔진과 맞지 않는 대상 · 궤적 수 범위 · stochastic 없는 앙상블', () => {
  const bad = JSON.stringify({ hypothetical: true, t_end: 60, amounts: { 'D000165|nucleoplasm': { assume: 'A999999' } } });
  const out = call([
    tool('run_fate', { scenario: '../etc/passwd' }),
    tool('run_fate', { scenario_json: bad, target: 'D000174' }),
    tool('run_rate', { scenario: MO, target: 'D000174' }),
    tool('run_fate', { scenario: GTP, target: 'D000051' }),
    tool('run_ensemble', { scenario: BD, n: 0 }),
    tool('run_ensemble', { scenario: BD, n: 10000 }),
    tool('run_ensemble', { scenario: MO, n: 2 }),
    tool('run_fate', {}),
  ]);
  const want = [/저장소 밖 경로/, /A999999/, /세포 상태 — 속도 엔진이 아니라/, /세포 상태\(cell_state\)가 아님/, /n 은 1–500/, /n 은 1–500/, /stochastic \{ seed \}/, /시나리오가 필요함/];
  out.forEach((m, i) => { assert.equal(m.result.isError, true, `${i}: 거부되어야 함`); assert.match(text(m), want[i], `${i}: ${text(m)}`); });
});
