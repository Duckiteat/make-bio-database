// 거부 말뭉치와 래칫 (형식 v11) — 레드팀 시나리오 1 'Silent Rule Erosion' 차단.
//   공격은 두 수로 이루어진다: ① 방어 규칙을 느슨하게 하고 ② 그것을 잡던 시험을 지우거나 건너뛴다.
//   ①은 말뭉치가 잡는다(규칙이 느슨해지면 거부되어야 할 패치가 통과해 버린다).
//   ②는 래칫이 잡는다 — 말뭉치 수·사법부 검사 자리 수·시험 수의 바닥값이 FLOOR.json 에 박혀 있고,
//   skip 한 시험이 하나라도 있으면 실패한다. 바닥값을 내리는 변경은 그 자체로 눈에 보이는 커밋이 된다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const DefDB = req('../core.js'), J = req('../judicial/judicial.js'), LEG = req('../legislative/legislative.js');
const BASE = DefDB.normalize(JSON.parse(readFileSync(new URL('../data/db.json', import.meta.url), 'utf8')));
const DIR = new URL('./fixtures/rejections/', import.meta.url);
const EXPECT = JSON.parse(readFileSync(new URL('EXPECT.json', DIR), 'utf8'));
const FLOOR = JSON.parse(readFileSync(new URL('./fixtures/FLOOR.json', import.meta.url), 'utf8'));
const files = readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== 'EXPECT.json').sort();

test('① 거부 말뭉치: 나쁜 패치가 모두 거부되고, 사유가 그대로다', () => {
  assert.deepEqual(files, Object.keys(EXPECT.cases).sort(), 'EXPECT.json 과 말뭉치 파일이 어긋남 — 둘을 같이 고친다');
  for (const f of files) {
    const patch = JSON.parse(readFileSync(new URL(f, DIR), 'utf8'));
    const res = LEG.merge(BASE, { recorded_at: '2026-10-15T00:00:00.000Z', ...patch }), g = J.gate(BASE, res); // 병합 전 dbtool 이 찍는 시각 (형식 v12)
    const all = [...g.errors, ...g.warnings, ...(res.report.errors || []).map((e) => ({ where: e.where, msg: e.msg }))];
    assert.equal(g.ok, false, `${f}: 통과해 버렸다 — 방어 규칙이 느슨해졌는지 본다`);
    assert.ok(all.some((e) => String(e.msg).includes(EXPECT.cases[f])),
      `${f}: 기대한 사유 '${EXPECT.cases[f]}' 가 없다. 실제:\n` + all.map((e) => `  ${e.where}: ${e.msg}`).join('\n'));
  }
});

test('② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다', () => {
  assert.ok(files.length >= FLOOR.rejection_fixtures, `거부 말뭉치가 ${files.length} — 바닥 ${FLOOR.rejection_fixtures}`);
  const jud = readFileSync(new URL('../judicial/judicial.js', import.meta.url), 'utf8');
  const sites = (jud.match(/\bE\(/g) || []).length;
  assert.ok(sites >= FLOOR.judicial_check_sites, `사법부 검사 자리가 ${sites} — 바닥 ${FLOOR.judicial_check_sites} (규칙을 지웠는지 본다)`);
  let total = 0;
  for (const f of readdirSync(new URL('.', import.meta.url)).filter((x) => x.endsWith('.test.mjs')))
    total += (readFileSync(new URL(f, import.meta.url), 'utf8').match(/^\s*(test|it)\(/gm) || []).length;
  assert.ok(total >= FLOOR.tests, `시험이 ${total} — 바닥 ${FLOOR.tests}`);
});

test('③ 건너뛴 시험이 없다 (규칙을 느슨하게 하면서 시험만 skip 하는 수를 막는다)', () => {
  const bad = [];
  for (const f of readdirSync(new URL('.', import.meta.url)).filter((x) => x.endsWith('.test.mjs'))) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8');
    for (const m of src.matchAll(/^\s*(?:test|it|describe)\.(skip|todo)\(|^\s*(?:test|it)\([^)]*\{\s*skip:/gm)) bad.push(`${f}: ${m[0].trim()}`);
  }
  assert.deepEqual(bad, [], '건너뛴 시험 — 고치거나 지운다 (건너뛴 시험은 없는 시험이다)');
});
