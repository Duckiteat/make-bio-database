// 매핑·검사 규칙 테스트: 규칙이 느슨해지면 여기서 실패한다.   실행: node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const DefDB = createRequire(import.meta.url)('../core.js');
const BASE = DefDB.normalize(JSON.parse(readFileSync(new URL('../data/db.json', import.meta.url), 'utf8')));
const IX = DefDB.index(BASE);
const id = (ref) => { const r = DefDB.resolveRef(IX, ref); if (r.error) throw new Error(r.error); return r.id; };
const P = (o) => Object.assign({ format: 'definition-db-patch', version: 3 }, o);
const run = (patch, opt) => { const res = DefDB.merge(BASE, P(patch)); return { res, g: DefDB.gate(BASE, res, opt) }; };
const msgs = (g) => [...g.errors, ...g.warnings].map((e) => `${e.where}: ${e.msg}`).join('\n');
const passes = (patch, opt) => { const r = run(patch, opt); assert.ok(r.g.ok, '통과해야 함:\n' + msgs(r.g)); return r.res; };
const rejectedFor = (patch, re) => {
  const { g } = run(patch);
  assert.equal(g.ok, false, '거부되어야 함');
  assert.ok([...g.errors, ...g.warnings].some((e) => re.test(e.msg)), `기대한 사유(${re})가 없음:\n` + msgs(g));
};
// 새 개념 하나 + 뜻 하나
const one = (name, sense, termExtra) => ({ terms: [Object.assign({ id: 'T+1', names: { ko: name } }, termExtra)], senses: [Object.assign({ id: 'D+1', term: 'T+1', kind: 'concept', field: '생화학', text: '테스트 정의', context: '테스트' }, sense)] });

test('현재 저장소는 오류·경고 없음', () => {
  const r = DefDB.validate(BASE);
  assert.deepEqual([r.errors, r.warnings], [[], []]);
});

// ===== 고정 번호 =====
test('새 항목은 다음 번호를 받고, 임시 번호 참조도 함께 바뀜', () => {
  const nx = BASE.meta.next;
  const res = passes({ ...one('테스트 개념', { links: [{ to: 'D+2', rel: 'refers', span: '테스트' }] }),
    senses: [{ id: 'D+1', term: 'T+1', kind: 'concept', field: '생화학', text: '테스트 정의', context: 't', links: [{ to: 'D+2', rel: 'refers', span: '테스트' }] },
             { id: 'D+2', term: '테스트 하위', kind: 'concept', field: '생화학', text: 'x', context: 't' }] });
  const T = 'T' + String(nx.T).padStart(6, '0'), D1 = 'D' + String(nx.D).padStart(6, '0'), D2 = 'D' + String(nx.D + 1).padStart(6, '0');
  assert.equal(res.db.terms[T].names.ko, '테스트 개념');
  assert.equal(res.db.senses[D1].links[0].to, D2);
  assert.equal(res.db.terms[res.db.senses[D2].term].names.ko, '테스트 하위', '이름만 적은 term 은 새 개념이 됨');
});
test('삭제한 번호는 다시 쓰지 않음', () => {
  const res = passes({ remove: ['S000011'] });
  const res2 = DefDB.merge(res.db, P({ steps: [{ id: 'S+1', label: 't', action: '결합', compartment: '세포질', inputs: [{ ref: 'ATP' }], outputs: [{ ref: 'ADP' }], part_of: [id('cAMP 신호 전달')] }] }));
  assert.ok(!res2.db.steps.S000011, 'S000011 은 재사용되면 안 됨');
  assert.ok(res2.db.steps.S000012);
});
test('번호 배정기가 쓰인 번호보다 작으면 오류', () => {
  const bad = DefDB.normalize(JSON.parse(JSON.stringify(BASE)));
  bad.meta.next.D = 3;
  assert.ok(DefDB.validate(bad).errors.some((e) => /번호 재사용/.test(e.msg)));
});
test('이름을 바꿔도 번호와 연결은 그대로, 옛 이름은 별칭으로 남음', () => {
  const T = BASE.senses[id('포스포릴레이스')].term;
  const res = passes({ terms: [{ id: T, names: { ko: '글리코겐 포스포릴레이스' } }] });
  assert.equal(res.db.terms[T].names.ko, '글리코겐 포스포릴레이스');
  assert.ok(res.db.terms[T].aliases.includes('글리코겐 인산화효소'));
  assert.ok(Object.values(res.db.steps).some((s) => s.agents.some((a) => a.ref === id('포스포릴레이스'))), '단계 연결 유지');
});
test('없는 번호로 수정하면 거부', () => {
  rejectedFor({ senses: [{ id: 'D999999', kind: 'concept', field: '생화학', text: 't', context: 't' }] }, /없는 정의항 번호/);
  rejectedFor({ terms: [{ id: 'T999999', names: { ko: 'x' } }] }, /없는 개념 번호/);
});
test('정의항을 다른 개념으로 옮길 수 없음', () => {
  const D = id('ATP');
  rejectedFor({ senses: [{ id: D, term: 'ADP', kind: 'small_molecule', field: '생화학', text: 't', context: 't' }] }, /옮길 수 없음/);
});
test('v2 형식 패치는 거부', () => {
  rejectedFor({ terms: { 'x': { definientia: [] } } }, /형식 v2/);
});

// ===== 이름 매핑 =====
test('별칭이 기존 개념의 이름과 겹치는 새 개념은 거부', () => {
  rejectedFor(one('아데닐레이트 사이클레이스', {}, { aliases: ['adenylyl cyclase'] }), /이미 .* 의 이름/);
});
test('띄어쓰기만 다른 이름은 기존 개념으로 매핑되고, 설명 없는 새 뜻 추가는 거부', () => {
  const { res, g } = run(one('아데닐산고리화효소', { kind: 'molecule_class' }));
  assert.ok(res.report.mapped.some((m) => m.to === BASE.senses[id('adenylyl cyclase')].term));
  assert.equal(g.ok, false);
  assert.ok(g.errors.some((e) => /distinction/.test(e.msg)));
});
test('영문 이름으로도 기존 개념에 매핑', () => {
  const { res } = run(one('glycogen phosphorylase', { kind: 'molecule_class', distinction: '테스트' }));
  assert.ok(res.report.mapped.some((m) => m.to === BASE.senses[id('포스포릴레이스')].term));
});
test('뜻이 여러 개인 이름으로 연결하면 거부, "이름#n" 은 통과', () => {
  rejectedFor(one('테스트', { kind: 'molecule_class', text: '효소 관련', links: [{ to: '효소', rel: 'is_a', span: '효소' }] }), /뜻이 여러 개/);
  const res = passes(one('테스트', { kind: 'molecule_class', text: '효소 관련', links: [{ to: '효소#2', rel: 'is_a', span: '효소' }] }));
  assert.equal(Object.values(res.db.senses).find((d) => d.text === '효소 관련').links[0].to, id('효소#2'));
});
test('외부 ID 로 연결하면 정의항 번호로 매핑', () => {
  const res = passes(one('테스트 부류', { kind: 'molecule_class', text: 'ATP 관련', links: [{ to: 'CHEBI:15422', rel: 'refers', span: 'ATP' }] }));
  assert.equal(Object.values(res.db.senses).find((d) => d.text === 'ATP 관련').links[0].to, id('ATP'));
});
test('없는 개념으로 연결하면 거부', () => {
  rejectedFor(one('테스트', { text: '없는개념 관련', links: [{ to: '없는개념', rel: 'refers', span: '없는개념' }] }), /데이터베이스에 없음/);
});
test('예약 문자가 든 이름은 거부', () => {
  rejectedFor(one('A|B', {}), /# @ \|/);
});

// ===== 통제 어휘 =====
test('어휘에 없는 kind·field 는 거부', () => {
  rejectedFor(one('테스트', { kind: 'enzyme' }), /kind 'enzyme'/);
  rejectedFor(one('테스트', { field: '생물' }), /분야\(field\) '생물'/);
});
test('어휘 별칭은 표준 키로 바뀜', () => {
  const res = passes(one('테스트', { field: 'biochemistry', kind: '개념' }));
  const d = Object.values(res.db.senses).find((x) => x.text === '테스트 정의');
  assert.deepEqual([d.field, d.kind], ['생화학', 'concept']);
});

// ===== 외부 ID·지문 =====
test('필수 외부 ID 가 없고 미매핑 사유도 없으면 거부, 사유가 있으면 통과', () => {
  rejectedFor(one('테스트 단백질', { kind: 'protein' }), /UniProt ID 가 필요/);
  passes(one('테스트 단백질', { kind: 'protein', unmapped: '테스트' }));
});
test('형식이 틀리거나 kind 에 허용되지 않은 외부 ID 는 거부', () => {
  rejectedFor(one('테스트 분자', { kind: 'small_molecule', xrefs: [{ db: 'ChEBI', id: '15422' }] }), /ChEBI ID '15422' 형식/);
  rejectedFor(one('테스트', { xrefs: ['GO:0000001'] }), /붙일 수 없음/);
});
test('이미 다른 정의항에 붙은 외부 ID 는 거부', () => {
  rejectedFor(one('테스트 분자', { kind: 'small_molecule', xrefs: ['CHEBI:15422'] }), /여러 정의항/);
});
test('지문: 형식·kind 검사, 중복 거부, 지문으로 찾기', () => {
  const fp = { scheme: 'InChIKey', value: 'AAAAAAAAAAAAAA-BBBBBBBBBB-N', status: 'asserted' };
  rejectedFor(one('테스트 분자', { kind: 'small_molecule', unmapped: 't', fingerprint: { ...fp, value: 'abc' } }), /지문 'abc' 형식/);
  rejectedFor(one('테스트', { fingerprint: fp }), /지문을 붙일 수 없음/);
  const res = passes(one('테스트 분자', { kind: 'small_molecule', unmapped: 't', fingerprint: fp }));
  const r = DefDB.resolveRef(DefDB.index(res.db), fp.value);
  assert.ok(r.id && r.via.startsWith('지문'));
  const res2 = DefDB.merge(res.db, P(one('다른 분자', { kind: 'small_molecule', unmapped: 't', fingerprint: fp })));
  assert.ok(DefDB.validate(res2.db).errors.some((e) => /구조 지문/.test(e.msg)));
});

// ===== 관계 =====
test('kind 제약을 어긴 관계는 거부', () => {
  rejectedFor(one('테스트', { text: '단백질 관련', links: [{ to: '단백질', rel: 'is_a', span: '단백질' }] }), /허용되지 않음/);
});
test('정의 문장에 없는 근거 구절은 거부', () => {
  rejectedFor(one('테스트', { links: [{ to: '에너지', rel: 'refers', span: '없는 구절' }] }), /근거 구절/);
});
test('새 경고를 만드는 패치는 기본 거부, allowWarnings 로만 통과', () => {
  const patch = one('테스트', { links: [{ to: '에너지', rel: 'refers' }] });
  assert.equal(run(patch).g.ok, false);
  assert.equal(run(patch, { allowWarnings: true }).g.ok, true);
});

// ===== 상태·기전 =====
test('상태 이름·별칭은 상태 키로 매핑, 단계는 기존 사슬에 자동 연결', () => {
  const res = passes({
    ...one('테스트 탈인산화효소', { kind: 'protein', unmapped: '테스트' }),
    steps: [{ id: 'S+1', label: '테스트 비활성화', action: 'dephosphorylation', compartment: 'cytosol', agents: [{ ref: 'D+1' }],
      inputs: [{ ref: '포스포릴레이스', state: '포스포릴레이스 a' }], outputs: [{ ref: 'glycogen phosphorylase', state: 'b형(비인산화)' }, { ref: '무기 인산', minor: true }],
      part_of: ['에피네프린에 의한 글리코겐 분해'] }],
  });
  const [sid, st] = Object.entries(res.db.steps).find(([, x]) => x.label === '테스트 비활성화');
  assert.deepEqual([st.action, st.compartment, st.inputs[0].ref, st.inputs[0].state, st.outputs[0].state], ['탈인산화', '세포질', id('포스포릴레이스'), 'a', 'b']);
  assert.ok(DefDB.index(res.db).next('S000009').some((n) => n.id === sid), 'S000009 의 출력(a형)을 쓰므로 이어져야 함');
});
const step = (o) => ({ steps: [Object.assign({ id: 'S+1', label: 't', action: '인산화', compartment: '세포질', outputs: [{ ref: '포도당' }], part_of: ['cAMP 신호 전달'] }, o)] });
test('정의되지 않은 상태를 쓰면 거부', () => rejectedFor(step({ inputs: [{ ref: '포스포릴레이스', state: 'c형' }] }), /상태 'c형' 없음/));
test('상태가 정의된 분자를 상태 없이 쓰면 거부', () => rejectedFor(step({ inputs: [{ ref: '포스포릴레이스' }] }), /state 를 지정해야/));
test('pathway 가 아닌 곳에 단계를 묶으면 거부', () => rejectedFor(step({ inputs: [{ ref: 'ATP' }], part_of: ['효소#1'] }), /pathway 가 아님/));
test('개념(concept) 종류는 단계 참여자가 될 수 없음', () => rejectedFor(step({ inputs: [{ ref: '에너지' }] }), /참여자가 될 수 없음/));
test('states 구역으로 기존 분자에 상태 추가 (영문명 대상·활성 별칭 매핑)', () => {
  const res = passes({ states: { 'adenylyl cyclase': [{ key: 'test', label: '테스트 상태', activity: '활성형' }] } });
  assert.equal(res.db.senses[id('adenylyl cyclase')].states.find((s) => s.key === 'test').activity, 'active');
});
test('개념 종류에는 상태를 붙일 수 없음', () => rejectedFor({ states: { '에너지': [{ key: 'x', label: 'x', activity: 'active' }] } }, /상태를 가질 수 없음/));
test('잔기 표기 형식이 틀리면 거부', () => {
  rejectedFor({ states: { '포스포릴레이스': [{ key: 'a', label: 'a형(인산화)', activity: 'active', modifications: [{ type: 'phosphorylation', site: 'S14' }] }] } }, /잔기 'S14'/);
});
