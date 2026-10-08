// 매핑·검사 규칙 테스트: 규칙이 느슨해지면 여기서 실패한다.   실행: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const DefDB = createRequire(import.meta.url)('../core.js');
const BASE = DefDB.normalize(JSON.parse(readFileSync(new URL('../data/db.json', import.meta.url), 'utf8')));
const P = (o) => Object.assign({ format: 'definition-db-patch', version: 2 }, o);
const run = (patch, opt) => { const res = DefDB.merge(BASE, P(patch)); return { res, g: DefDB.gate(BASE, res, opt) }; };
const rejectedFor = (patch, re) => {
  const { g } = run(patch);
  assert.equal(g.ok, false, '거부되어야 함');
  assert.ok([...g.errors, ...g.warnings].some((e) => re.test(e.msg)), `기대한 사유(${re})가 없음:\n` + [...g.errors, ...g.warnings].map((e) => `${e.where}: ${e.msg}`).join('\n'));
};
const def = (o) => Object.assign({ id: 'X#+1', kind: 'concept', field: '생화학', text: '테스트 정의', context: '테스트' }, o);

test('현재 저장소는 오류·경고 없음', () => {
  const r = DefDB.validate(BASE);
  assert.deepEqual([r.errors, r.warnings], [[], []]);
});

// ===== 이름 매핑 =====
test('별칭이 기존 개념과 겹치는 새 피정의항은 거부', () => {
  rejectedFor({ terms: { '아데닐레이트 사이클레이스': { aliases: ['adenylyl cyclase'], definientia: [def({ id: '아데닐레이트 사이클레이스#+1' })] } } }, /이미 '아데닐산 고리화효소' 의 이름/);
});
test('띄어쓰기만 다른 이름은 기존 피정의항으로 매핑되고, 설명 없는 새 뜻 추가는 거부', () => {
  const { res, g } = run({ terms: { '아데닐산고리화효소': { definientia: [def({ id: '아데닐산고리화효소#+1', kind: 'molecule_class' })] } } });
  assert.ok(res.report.mapped.some((m) => m.to === '아데닐산 고리화효소'));
  assert.equal(g.ok, false);
  assert.ok(g.errors.some((e) => /distinction/.test(e.msg)));
});
test('뜻이 여러 개인 이름으로 연결하면 거부', () => {
  rejectedFor({ terms: { '테스트': { definientia: [def({ id: '테스트#+1', kind: 'molecule_class', text: '효소 관련', links: [{ to: '효소', rel: 'is_a', span: '효소' }] })] } } }, /뜻이 여러 개/);
});
test('이름·외부 ID 로 연결하면 정의항 id 로 매핑', () => {
  const { res, g } = run({ terms: { '테스트 뉴클레오타이드': { definientia: [def({ id: '테스트 뉴클레오타이드#+1', kind: 'molecule_class', text: 'ATP 와 adenosine 관련', links: [{ to: 'CHEBI:15422', rel: 'refers', span: 'ATP' }] })] } } });
  assert.ok(g.ok, g.errors.map((e) => e.msg).join('\n'));
  assert.equal(res.db.terms['테스트 뉴클레오타이드'].definientia[0].links[0].to, 'ATP#1');
});
test('없는 개념으로 연결하면 거부', () => {
  rejectedFor({ terms: { '테스트': { definientia: [def({ id: '테스트#+1', text: '없는개념 관련', links: [{ to: '없는개념', rel: 'refers', span: '없는개념' }] })] } } }, /데이터베이스에 없음/);
});
test('예약 문자가 든 이름은 거부', () => {
  rejectedFor({ terms: { 'A|B': { definientia: [def({ id: 'A|B#+1' })] } } }, /# @ \|/);
});
test('없는 기존 id 로 수정하면 거부', () => {
  rejectedFor({ terms: { 'ATP': { definientia: [def({ id: 'ATP#5', kind: 'small_molecule', unmapped: 'x' })] } } }, /없는 id/);
});

// ===== 통제 어휘 =====
test('어휘에 없는 kind·field 는 거부', () => {
  rejectedFor({ terms: { '테스트': { definientia: [def({ id: '테스트#+1', kind: 'enzyme' })] } } }, /kind 'enzyme'/);
  rejectedFor({ terms: { '테스트': { definientia: [def({ id: '테스트#+1', field: '생물' })] } } }, /분야\(field\) '생물'/);
});
test('어휘 별칭은 표준 키로 바뀜', () => {
  const { res, g } = run({ terms: { '테스트': { definientia: [def({ id: '테스트#+1', field: 'biochemistry', kind: '개념' })] } } });
  assert.ok(g.ok, g.errors.map((e) => e.msg).join('\n'));
  const d = res.db.terms['테스트'].definientia[0];
  assert.deepEqual([d.field, d.kind], ['생화학', 'concept']);
});

// ===== 외부 ID =====
test('필수 외부 ID 가 없고 미매핑 사유도 없으면 거부', () => {
  rejectedFor({ terms: { '테스트 단백질': { definientia: [def({ id: '테스트 단백질#+1', kind: 'protein' })] } } }, /UniProt ID 가 필요/);
});
test('미매핑 사유가 있으면 통과', () => {
  const { g } = run({ terms: { '테스트 단백질': { definientia: [def({ id: '테스트 단백질#+1', kind: 'protein', unmapped: '테스트' })] } } });
  assert.ok(g.ok, g.errors.map((e) => e.msg).join('\n'));
});
test('형식이 틀린 외부 ID 는 거부', () => {
  rejectedFor({ terms: { '테스트 분자': { definientia: [def({ id: '테스트 분자#+1', kind: 'small_molecule', xrefs: [{ db: 'ChEBI', id: '15422' }] })] } } }, /ChEBI ID '15422' 형식/);
});
test('kind 에 허용되지 않은 외부 ID 는 거부', () => {
  rejectedFor({ terms: { '테스트': { definientia: [def({ id: '테스트#+1', xrefs: ['GO:0000001'] })] } } }, /붙일 수 없음/);
});
test('이미 다른 정의항에 붙은 외부 ID 는 거부', () => {
  rejectedFor({ terms: { '테스트 분자': { definientia: [def({ id: '테스트 분자#+1', kind: 'small_molecule', xrefs: ['CHEBI:15422'] })] } } }, /여러 정의항/);
});

// ===== 관계 =====
test('kind 제약을 어긴 관계는 거부', () => {
  rejectedFor({ terms: { '테스트': { definientia: [def({ id: '테스트#+1', text: '단백질 관련', links: [{ to: '단백질#1', rel: 'is_a', span: '단백질' }] })] } } }, /허용되지 않음/);
});
test('정의 문장에 없는 근거 구절은 거부', () => {
  rejectedFor({ terms: { '테스트': { definientia: [def({ id: '테스트#+1', links: [{ to: '에너지#1', rel: 'refers', span: '없는 구절' }] })] } } }, /근거 구절/);
});
test('새 경고를 만드는 패치는 기본 거부, allowWarnings 로만 통과', () => {
  const patch = { terms: { '테스트': { definientia: [def({ id: '테스트#+1', links: [{ to: '에너지#1', rel: 'refers' }] })] } } };
  assert.equal(run(patch).g.ok, false);
  assert.equal(run(patch, { allowWarnings: true }).g.ok, true);
});

// ===== 상태·기전 =====
test('상태 이름·별칭으로 쓰면 상태 키로 매핑, 단계는 기존 사슬에 자동 연결', () => {
  const { res, g } = run({
    terms: { '테스트 탈인산화효소': { definientia: [def({ id: '테스트 탈인산화효소#+1', kind: 'protein', unmapped: '테스트' })] } },
    steps: [{ id: 'step:+1', label: '포스포릴레이스 비활성화', action: 'dephosphorylation', compartment: 'cytosol',
      agents: [{ ref: '테스트 탈인산화효소#+1' }],
      inputs: [{ ref: '포스포릴레이스', state: '포스포릴레이스 a' }], outputs: [{ ref: '글리코겐 인산화효소#1', state: 'b형(비인산화)' }, { ref: '무기 인산#1', minor: true }],
      part_of: ['에피네프린에 의한 글리코겐 분해#1'] }],
  });
  assert.ok(g.ok, g.errors.map((e) => `${e.where}: ${e.msg}`).join('\n'));
  const st = Object.values(res.db.steps).find((x) => x.label === '포스포릴레이스 비활성화');
  assert.deepEqual([st.action, st.compartment, st.inputs[0].ref, st.inputs[0].state, st.outputs[0].state], ['탈인산화', '세포질', '글리코겐 인산화효소#1', 'a', 'b']);
  assert.ok(DefDB.index(res.db).next('step:9').some((n) => n.id === st.id), 'step:9 의 출력(a형)을 쓰므로 이어져야 함');
});
test('정의되지 않은 상태를 쓰면 거부', () => {
  rejectedFor({ steps: [{ id: 'step:+1', label: 't', action: '인산화', compartment: '세포질', inputs: [{ ref: '글리코겐 인산화효소#1', state: 'c형' }], outputs: [{ ref: '포도당#1' }], part_of: ['cAMP 신호 전달#1'] }] }, /상태 'c형' 없음/);
});
test('상태가 정의된 분자를 상태 없이 쓰면 거부', () => {
  rejectedFor({ steps: [{ id: 'step:+1', label: 't', action: '인산화', compartment: '세포질', inputs: [{ ref: '글리코겐 인산화효소#1' }], outputs: [{ ref: '포도당#1' }], part_of: ['cAMP 신호 전달#1'] }] }, /state 를 지정해야/);
});
test('pathway 가 아닌 곳에 단계를 묶으면 거부', () => {
  rejectedFor({ steps: [{ id: 'step:+1', label: 't', action: '결합', compartment: '세포질', inputs: [{ ref: 'ATP#1' }], outputs: [{ ref: 'ADP#1' }], part_of: ['효소#1'] }] }, /pathway 가 아님/);
});
test('개념(concept) 종류는 단계 참여자가 될 수 없음', () => {
  rejectedFor({ steps: [{ id: 'step:+1', label: 't', action: '결합', compartment: '세포질', inputs: [{ ref: '에너지#1' }], outputs: [{ ref: 'ADP#1' }], part_of: ['cAMP 신호 전달#1'] }] }, /참여자가 될 수 없음/);
});
test('states 구역으로 기존 분자에 상태 추가 (별칭 대상·활성 별칭 매핑)', () => {
  const { res, g } = run({ states: { 'adenylyl cyclase': [{ key: 'test', label: '테스트 상태', activity: '활성형' }] } });
  assert.ok(g.ok, g.errors.map((e) => e.msg).join('\n'));
  assert.equal(res.db.terms['아데닐산 고리화효소'].definientia[0].states.find((s) => s.key === 'test').activity, 'active');
});
test('개념 종류에는 상태를 붙일 수 없음', () => {
  rejectedFor({ states: { '에너지#1': [{ key: 'x', label: 'x', activity: 'active' }] } }, /상태를 가질 수 없음/);
});
test('잔기 표기 형식이 틀리면 거부', () => {
  rejectedFor({ states: { '글리코겐 인산화효소#1': [{ key: 'a', label: 'a형(인산화)', activity: 'active', modifications: [{ type: 'phosphorylation', site: 'S14' }] }] } }, /잔기 'S14'/);
});
