// 가정 원장 (build-plan 49 · 설계 docs/design/structure-realignment.md §3) — 연결이 약해지지 않게:
//   ① 사슬: 변조·삭제·번호 바꾸기는 잡힌다 ② 풀기: 번호를 다른 자리에 옮겨 붙이거나 없는 번호면 거부, 번호 없는 시나리오는 비트 그대로
//   ③ '최신 따라가기' 없음: revises 가 있어도 옛 번호는 옛 숫자 ④ 새 기록 검사(거부 사유별) ⑤ 서기: 봉인 없이는 못 씀, 번호는 순번
//   ⑥ 등록은 번호로만 (인라인 가상 숫자 거부) ⑦ 거꾸로 색인: 번호 + 등록된 인라인 시나리오의 내용 일치 ⑧ 변환 결과: 모든 시나리오가 풀리고 같은 자리·값은 한 번호
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
const req = createRequire(import.meta.url);
const ROOT = new URL('..', import.meta.url).pathname;
const CLERK = await import('../legislative/clerk.mjs');
const AS = req('../compiler/assumptions.js'), AA = req('../judicial/assumption_audit.js'), SCN = req('../scenarios.js'), ATT = req('../judicial/attestation.js');
const SO = req('../judicial/scene_origin.js');
const DB = JSON.parse(readFileSync(join(ROOT, 'data/db.json'), 'utf8'));
const EVENTS = SCN.ledger();
const DIR = join(ROOT, 'examples/scenarios');
const ALL = Object.fromEntries(readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== 'subjects.json').map((f) => [f, JSON.parse(readFileSync(join(DIR, f), 'utf8'))]));
const clone = (x) => JSON.parse(JSON.stringify(x));

test('① 사슬: 지금 원장은 통과 — 값 하나 바꾸기·사건 빼기·번호 바꾸기는 잡힌다', () => {
  assert.ok(AA.verifyChain(EVENTS).ok);
  const t = clone(EVENTS); t[5].value *= 2;
  assert.match(AA.verifyChain(t).errors.join(), /root 재계산 불일치/);
  const d = clone(EVENTS); d.splice(3, 1);
  assert.match(AA.verifyChain(d).errors.join(), /seq|prev/);
  const n = clone(EVENTS); n[0].id = 'A000999';
  assert.match(AA.verifyChain(n).errors.join(), /순번|root/);
});

test('② 풀기: 번호를 다른 자리에 옮겨 붙이면·없는 번호면 거부 · 번호 없는 시나리오는 같은 객체와 같은 글자', () => {
  const sc = clone(ALL['telomere-hayflick-hypothetical.json']);
  const kinRef = sc.kinetics['D000207/rule/turnover'].half_life;
  assert.ok(AS.isRef(kinRef), '변환된 시나리오는 번호를 가리킨다');
  const moved = clone(sc); moved.amounts[Object.keys(moved.amounts)[0]] = kinRef;
  assert.match(AS.resolve(moved, EVENTS).error, /다른 자리.*옮겨 붙일 수 없음/);
  const missing = clone(sc); missing.kinetics['D000207/rule/turnover'].half_life = { assume: 'A999999' };
  assert.match(AS.resolve(missing, EVENTS).error, /원장에 없음/);
  const reg = ALL['telomere-quiescence-validation-hypothetical.json'];
  assert.equal(AS.resolve(reg, EVENTS).scenario, reg, '등록된 인라인 시나리오는 그대로');
  const f = join(DIR, 'telomere-quiescence-validation-hypothetical.json');
  assert.equal(SCN.text(f), readFileSync(f, 'utf8'), '글자까지 같음 — 입력 해시 불변');
});

test('③ 최신 따라가기 없음: 고친 새 번호가 있어도 옛 번호를 가리킨 시나리오는 옛 숫자', () => {
  const old = EVENTS.find((e) => e.id === 'A000177');
  const rev = { ...clone(old), seq: EVENTS.length + 1, id: 'A' + String(EVENTS.length + 1).padStart(6, '0'), value: 2400, revises: 'A000177', migrated: undefined };
  const sc = ALL['telomere-hayflick-hypothetical.json'];
  const r = AS.resolve(sc, [...EVENTS, rev]);
  assert.equal(r.scenario.kinetics['D000207/rule/turnover'].half_life, 1200);
  assert.ok(r.used.some((u) => u.id === 'A000177'));
});

const OK = { slot: { kind: 'kinetics', key: 'D000205/rule/division_attrition', param: 'k' }, value: 1e-19, unit: null, origin: 'assumed', limitations: ['L000116'], basis: '시험 — 열린 한계 L000116 이 다루는 상수' };
const rejects = (p, re) => { const v = AA.checkProposals(EVENTS, [p], DB); assert.equal(v.ok, false, JSON.stringify(p)); assert.match(v.errors.join('\n'), re); };
test('④ 새 기록 검사: 통과 1 + 거부 사유별', () => {
  assert.ok(AA.checkProposals(EVENTS, [OK], DB).ok, AA.checkProposals(EVENTS, [OK], DB).errors.join());
  rejects({ ...OK, origin: 'unrecorded', limitations: [] }, /새 기록에 쓸 수 없음/);
  rejects({ ...OK, limitations: [] }, /한계\(limitations\)가 필요/);
  rejects({ ...OK, limitations: ['L999999'] }, /한계 L999999 이 없음/);
  const resolved = Object.keys(DB.limitations).find((id) => (DB.limitations[id].status || '').startsWith('resolved') || DB.limitations[id].resolved);
  if (resolved) rejects({ ...OK, limitations: [resolved] }, /이미 해결됨/);
  const dup = EVENTS.find((e) => e.slot.kind === 'kinetics');
  rejects({ slot: dup.slot, value: dup.value, unit: dup.unit, origin: 'assumed', limitations: ['L000116'], basis: 'x' }, /같은 자리·같은 값/);
  rejects({ ...OK, revises: dup.id }, /다른 자리/);
  rejects({ ...OK, slot: { ...OK.slot, kind: 'colors' } }, /자리 종류/);
  rejects({ ...OK, slot: { ...OK.slot, key: 'D000205/rule/nope' } }, /db 에 없음/);
  rejects({ ...OK, value: -1 }, /음수/);
  rejects({ ...OK, id: 'A000500' }, /서기가 붙인다/);
  rejects({ ...OK, migrated: true }, /변환\(012\)만/);
  rejects({ ...OK, range: { low: 1e-18, high: 1e-17 } }, /low ≤ 값 ≤ high/);
  rejects({ ...OK, basis: '' }, /근거 문장/);
  rejects({ ...OK, unit: 's' }, /단위/);
});

test('⑤ 서기: 봉인이 없으면 못 쓰고, 번호는 순번으로 붙는다 · 사슬이 이어진다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'assume-'));
  try {
    writeFileSync(join(dir, 'assumptions.jsonl'), readFileSync(join(ROOT, 'data/assumptions.jsonl')));
    assert.throws(() => CLERK.appendAssumptions({ dataDir: dir, proposals: [OK], seal: null }), /봉인/);
    const seal = ATT.sealVerdict({ ok: true, errors: [], warnings: [] }, [OK], { issuer: 'judicial/assumption_audit.js#checkProposals' });
    assert.throws(() => CLERK.appendAssumptions({ dataDir: dir, proposals: [{ ...OK, value: 2e-19 }], seal }), /다름/);
    const out = CLERK.appendAssumptions({ dataDir: dir, proposals: [OK], seal });
    assert.equal(out[0].id, 'A' + String(EVENTS.length + 1).padStart(6, '0'));
    assert.ok(AA.verifyChain(CLERK.readAssumptions(dir)).ok);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('⑥ 등록은 번호로만: 인라인 가상 숫자가 있는 시나리오는 등록 거부 (쓰기 전에)', () => {
  const r = spawnSync(process.execPath, [join(ROOT, 'dbtool.mjs'), 'register', join(DIR, 'telomere-quiescence-validation-hypothetical.json')], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /인라인 가상 숫자 \d+개/);
});

test('⑦ 거꾸로 색인: 번호로 가리킨 시나리오 + 등록된 인라인 시나리오의 내용 일치', () => {
  const u = AA.uses(EVENTS, ALL, 'A000177');
  assert.ok(u.ref.includes('telomere-hayflick-hypothetical.json'));
  assert.ok(u.content.includes('telomere-quiescence-validation-hypothetical.json'), '등록 시나리오가 같은 숫자를 인라인으로 씀');
  const rows = SO.scenarioRows(DB, AS.resolve(ALL['telomere-hayflick-hypothetical.json'], EVENTS).scenario, { used: AS.resolve(ALL['telomere-hayflick-hypothetical.json'], EVENTS).used }).rows;
  assert.ok(rows.some((x) => x.field === 'kinetics' && x.key === 'D000207/rule/turnover' && x.assumptions.includes('A000177')), '첫 장면 기원 행에 번호');
});

test('⑧ 변환 결과: 모든 시나리오가 풀리고 같은 자리·같은 값은 한 번호 · 원장 감사 통과', () => {
  const a = AA.audit(EVENTS, DB, ALL);
  assert.ok(a.ok, a.errors.slice(0, 5).join('\n'));
  const keys = EVENTS.map((e) => `${AS.slotKey(e.slot)}|${e.value}|${e.unit}`);
  assert.equal(new Set(keys).size, keys.length);
  for (const [f, sc] of Object.entries(ALL)) {
    const r = AS.resolve(sc, EVENTS);
    assert.ok(AS.slots(r.scenario).every((x) => typeof x.value === 'number'), `${f}: 풀린 뒤 숫자만`);
    if (sc.protocol) assert.equal(r.used.length, 0, `${f}: 등록 시나리오는 다시 쓰지 않음`);
  }
});
