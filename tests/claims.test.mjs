// 주장 층 (PLAN-115 · DEC-0075 · SCHEMA §주장) — 칸 단위 근거의 형식 · 관문 · 불변 · 인용 대조 · 칸 상태 계산
//   인용은 저장소에 받아 둔 실제 초록(data/fetched/europepmc)에서 — 지어낸 문장으로 시험하지 않는다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const M = req('../model.js'), J = req('../judicial/judicial.js'), LEG = req('../legislative/legislative.js'), ORCH = req('../orchestrator.js'), CL = req('../judicial/claims.js');
const RAW = readFileSync(new URL('../data/db.json', import.meta.url), 'utf8');
const BASE = M.normalize(JSON.parse(RAW));
const FETCHED = ORCH.fetchedTexts(new URL('../data', import.meta.url).pathname);
const shaOf = (pmid) => Object.entries(FETCHED).find(([, v]) => v.source.id === pmid)[0];
const AT = '2026-11-23T00:00:00.000Z';
const row = (o) => ({ stance: 'supports', kind: 'direct', context: { species: '9986' }, by: { agent: 'ai' }, at: '2026-11-23', ...o });
const q164350 = 'phosphorylated by protein kinase, dependent on adenosine 3\':5\'-monophosphate';
const q6245074 = 'not affected by the inhibitor of the cAMP-dependent protein kinase';
const merge = (db, claims, extra = {}) => LEG.merge(db, { recorded_at: AT, why: '시험', claims, ...extra });
const gate = (db, res) => J.gate(db, res, { fetched: FETCHED });
const has = (g, rule, frag) => [...g.errors, ...(g.warnings || [])].some((e) => e.rule === rule && String(e.msg).includes(frag));

test('① 주장이 없으면 db 바이트 그대로 — claims · meta.next.C 를 더하지 않는다 (moved 와 같은 선택 칸)', () => {
  assert.equal(JSON.stringify(BASE, null, 2) + '\n', RAW);
  assert.equal(BASE.claims, undefined);
  assert.equal(BASE.meta.next.C, undefined);
});

test('② 새 주장: 번호 C000001 · 인용이 받은 초록에 있으면 관문 통과 · 직렬화에 claims 와 next.C', () => {
  const res = merge(BASE, [{ target: 'D000057/rule/phk_phos#effect.site', context: { species: '9606' },
    evidence: [row({ source: { db: 'PMID', id: '164350' }, locator: { file_sha256: shaOf('164350'), part: 'abstract', exact: q164350 }, context: { species: '9986', tissue: 'skeletal_muscle', system: 'purified' } })] }]);
  const g = gate(BASE, res);
  assert.deepEqual(res.report.added, ['C000001']);
  assert.equal(g.ok, true, JSON.stringify(g.errors));
  const back = M.normalize(JSON.parse(JSON.stringify(res.db)));
  assert.equal(back.meta.next.C, 2);
  assert.equal(back.claims.C000001.evidence[0].context.system, 'purified');
});

test('③ RULE-0537 대상 칸: 모양 · 없는 규칙 · 그 종류의 칸이 아님 · 지금 규칙에 없는 칸', () => {
  for (const [t, frag] of [['D000057#exists', "'D…/rule/키#칸' 모양"], ['D000057/rule/none#exists', '이 없음'], ['D000057/rule/phk_phos#activity', '주장 칸이 아님'], ['D000057/rule/phk_phos#via_component', '에 없음']]) {
    const g = gate(BASE, merge(BASE, [{ target: t, context: { species: '9606' }, evidence: [row({ kind: 'interpretation', source: { db: 'PMID', id: '164350' } })] }]));
    assert.ok(has(g, 'RULE-0537', frag), `${t}: ${JSON.stringify(g.errors)}`);
  }
});

test('④ RULE-0538 근거 줄 모양: 방향 · 종류 · 적은 쪽 · 출처 · 실험계 어휘', () => {
  const g = gate(BASE, merge(BASE, [{ target: 'D000057/rule/phk_phos#exists', context: { species: '9606' },
    evidence: [{ stance: 'maybe', kind: 'guess', by: {}, at: '2026-11-23', context: { species: '9606', system: 'dish' } }] }]));
  for (const f of ["방향 'maybe'", "종류 'guess'", '적은 쪽(by.agent)', '출처(source)도 관찰(from)도 없음', "실험계 'dish'"]) assert.ok(has(g, 'RULE-0538', f), f);
});

test('⑤ RULE-0539 직접 근거는 인용 위치(파일 sha256 + 원문 그대로)가 있어야', () => {
  const g = gate(BASE, merge(BASE, [{ target: 'D000057/rule/phk_phos#exists', context: { species: '9606' }, evidence: [row({ source: { db: 'PMID', id: '164350' } })] }]));
  assert.ok(has(g, 'RULE-0539', '인용 위치가 필요함'));
});

test('⑥ RULE-0540 인용 대조: 고쳐 쓴 인용 · 다른 논문의 파일 · 모르는 파일 — 그리고 원문을 안 주면 경고만', () => {
  const one = (loc, src = { db: 'PMID', id: '164350' }) => gate(BASE, merge(BASE, [{ target: 'D000057/rule/phk_phos#exists', context: { species: '9606' }, evidence: [row({ source: src, locator: loc })] }]));
  assert.ok(has(one({ file_sha256: shaOf('164350'), exact: 'phosphorylated by protein kinase A only in human liver' }), 'RULE-0540', '받은 원문(abstract)에 없음'));
  assert.ok(has(one({ file_sha256: shaOf('6245074'), exact: q6245074 }), 'RULE-0540', '출처 PMID:164350 와 인용 파일의 출처'));
  assert.ok(has(one({ file_sha256: 'a'.repeat(64), exact: q164350 }), 'RULE-0540', '받은 원문(FETCH_LOG)에 없음'));
  const res = merge(BASE, [{ target: 'D000057/rule/phk_phos#exists', context: { species: '9606' }, evidence: [row({ source: { db: 'PMID', id: '164350' }, locator: { file_sha256: shaOf('164350'), exact: q164350 } })] }]);
  const g = J.gate(BASE, res); // 원문 없이
  assert.ok(g.warnings.some((w) => w.rule === 'RULE-0540'), '원문을 넘기지 않으면 대조하지 않았다고 경고');
});

test('⑦ RULE-0541 덧붙이기만: 줄 덧붙이기 · 철회 한 번은 됨 — 칸 바꾸기 · 줄 고치기 · 지우기 · 두 번 철회 · 기록 시각 없음은 거부', () => {
  const first = merge(BASE, [{ target: 'D000057/rule/phk_phos#exists', context: { species: '9606' }, evidence: [row({ kind: 'interpretation', source: { db: 'PMID', id: '164350' } })] }]).db;
  const add = merge(first, [{ id: 'C000001', evidence_add: [row({ stance: 'contradicts', kind: 'interpretation', source: { db: 'PMID', id: '6245074' } })] }]);
  assert.equal(gate(first, add).ok, true, JSON.stringify(gate(first, add).errors));
  assert.equal(add.db.claims.C000001.evidence.length, 2);
  const ret = merge(first, [{ id: 'C000001', retracted: { note: '시험' } }]);
  assert.equal(gate(first, ret).ok, true);
  assert.ok(merge(ret.db, [{ id: 'C000001', retracted: { note: '또' } }]).report.errors.some((e) => e.rule === 'RULE-0541'));
  assert.ok(merge(first, [{ id: 'C000001', target: 'D000057/rule/free#activity' }]).report.errors.some((e) => e.rule === 'RULE-0541'));
  assert.ok(merge(first, [], { remove: ['C000001'] }).report.errors.some((e) => e.rule === 'RULE-0541'));
  // 입법부를 거치지 않고 바꾼 결과도 관문이 잡는다
  const tamper = JSON.parse(JSON.stringify(first)); tamper.claims.C000001.evidence[0].stance = 'contradicts'; delete tamper.claims.C000001.recorded_at;
  const imm = J.claimImmutability(first, tamper);
  assert.ok(imm.some((x) => x.msg.includes('기존 근거 줄은 바꾸거나 지울 수 없음')));
  assert.ok(imm.some((x) => x.msg.includes("'recorded_at'")));
  const gone = JSON.parse(JSON.stringify(first)); delete gone.claims.C000001;
  assert.ok(J.claimImmutability(first, gone).some((x) => x.msg.includes('지울 수 없음')));
  const fresh = JSON.parse(JSON.stringify(BASE)); fresh.claims = { C000001: M.normClaim({ target: 'D000057/rule/phk_phos#exists', evidence: [] }) };
  assert.ok(J.claimImmutability(BASE, fresh).some((x) => x.msg.includes('기록 시각')));
});

test('⑧ 칸 상태 계산: legacy(옛 근거의 보기) · supported_elsewhere · contested · unsupported(초록에 없음) · 철회 가정 · 보조 칸은 수준을 내리지 않음', () => {
  const lg = CL.ruleView(BASE, 'D000043/rule/gp_phos');
  assert.equal(lg.level, 'legacy'); // curated 를 supported 로 올리지 않는다
  assert.ok(lg.fields.every((f) => f.state === 'legacy'));
  assert.equal(CL.ruleView(BASE, 'D000043/rule/basal').level, 'unsupported'); // asserted 규칙
  const src = (id) => ({ db: 'PMID', id });
  const db = merge(BASE, [
    { target: 'D000043/rule/gp_phos#exists', context: { species: '9606' }, evidence: [row({ source: src('6245074'), locator: { file_sha256: shaOf('6245074'), exact: q6245074 } }), row({ source: src('168880'), context: { species: '9606' }, locator: { file_sha256: shaOf('168880'), exact: 'converted into phosphorylase a by incubation at 20degreesC' } })] },
    { target: 'D000043/rule/gp_phos#via_component', context: { species: '9606' }, evidence: [row({ kind: 'absent', source: src('6245074') }), row({ kind: 'absent', source: src('168880') })] },
    { target: 'D000043/rule/basal#activity', context: { species: '9606' }, evidence: [row({ kind: 'interpretation', source: src('6245074') }), row({ stance: 'contradicts', kind: 'direct', source: src('6245074'), locator: { file_sha256: shaOf('6245074'), exact: q6245074 } })] },
    { target: 'D000057/rule/phk_phos#*', context: { species: '9606' }, evidence: [row({ source: src('164350'), locator: { file_sha256: shaOf('164350'), exact: q164350 } })] },
  ]).db;
  const v = CL.ruleView(db, 'D000043/rule/gp_phos'), f = (n) => v.fields.find((x) => x.field === n);
  assert.equal(f('exists').state, 'supported');
  assert.equal(f('via_component').state, 'unsupported');
  assert.equal(f('via_component').core, false);
  assert.equal(f('effect.site').state, 'legacy');
  assert.equal(v.level, 'legacy', '핵심 칸 중 가장 약한 것 — 보조 칸(via_component)의 unsupported 는 수준을 내리지 않음');
  assert.equal(CL.ruleView(db, 'D000043/rule/basal').fields[0].state, 'contested');
  assert.equal(CL.ruleView(db, 'D000043/rule/basal').contested, true);
  const pk = CL.ruleView(db, 'D000057/rule/phk_phos');
  assert.ok(pk.fields.every((x) => x.state === 'supported_elsewhere' && x.via === '*'), '토끼 근거 → 사람 맥락에서 자동 승격 없음');
  // 철회 가정: 사람 적혈구 근거(168880)를 빼면 남는 직접 지지는 토끼뿐
  assert.equal(CL.ruleView(db, 'D000043/rule/gp_phos', { assume: ['PMID:168880'] }).fields.find((x) => x.field === 'exists').state, 'supported_elsewhere');
  assert.equal(CL.ruleView(db, 'D000043/rule/gp_phos', { assume: ['PMID:168880', 'PMID:6245074'] }).fields.find((x) => x.field === 'exists').state, 'unsupported');
  assert.match(CL.claimsText(db, 'S000009'), /계산 수준/);
});
