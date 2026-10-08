#!/usr/bin/env node
// 형식 버전 1 → 2 변환 (2026-10-08, 1회성 — 기록용으로 보관)
//
// 바뀐 점
//   - 정의항에 kind·field·xrefs·unmapped·states 추가
//   - 기전 단계의 자유 문자열 상태 → 정의항에 정의된 상태 키
//   - 기전 단계 action 은 통제 어휘로, context 는 compartment(어휘) + cell + context 로 분리
//
// 외부 ID 는 작성자가 확실하다고 판단한 것만 넣었고 모두 status "asserted"(원본 대조 전) 이다.
// 확실하지 않은 필수 ID 는 unmapped 에 사유를 적었다.
//
// 사용: node migrations/001-v1-to-v2.mjs data/db.json   (제자리 변환, 검사 통과 시에만 저장)
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const DefDB = createRequire(import.meta.url)('../core.js');
const path = process.argv[2] || 'data/db.json';
const v1 = JSON.parse(readFileSync(path, 'utf8'));
if (v1.version !== 1) { console.error(`버전 ${v1.version} — 1 이 아니라 변환하지 않음`); process.exit(1); }

// [kind, field]
const KF = {
  '촉매#1': ['molecule_class', '화학'], '물질#1': ['molecule_class', '화학'],
  '활성화 에너지#1': ['concept', '화학'], '에너지#1': ['concept', '물리학'],
  '단백질#1': ['molecule_class', '생화학'], '생체 고분자#1': ['molecule_class', '생화학'], '아미노산#1': ['molecule_class', '생화학'],
  'RNA#1': ['molecule_class', '분자생물학'], '효소#1': ['molecule_class', '생명과학 교육'], '효소#2': ['molecule_class', '생화학'],
  '리보자임#1': ['molecule_class', '분자생물학'], '아밀레이스#1': ['molecule_class', '생화학'],
  '뉴클레오타이드#1': ['molecule_class', '생화학'], '핵산#1': ['molecule_class', '생화학'], 'DNA#1': ['molecule_class', '분자생물학'],
  '유전 정보#1': ['concept', '분자생물학'], '유전자#1': ['nucleic_acid', '분자생물학'], '유전자#2': ['concept', '유전학'], '형질#1': ['concept', '유전학'],
  '기질#1': ['molecule_class', '생화학'], '활성 부위#1': ['structure_feature', '생화학'], '보조인자#1': ['molecule_class', '생화학'], '조효소#1': ['molecule_class', '생화학'],
  '신호 전달 경로#1': ['process', '세포생물학'], '수용체#1': ['molecule_class', '세포생물학'], '호르몬#1': ['molecule_class', '생리학'],
  '에피네프린#1': ['small_molecule', '생리학'], 'G 단백질#1': ['molecule_class', '세포생물학'], 'Gs 단백질#1': ['complex', '세포생물학'],
  'β-아드레날린 수용체#1': ['molecule_class', '세포생물학'], '아데닐산 고리화효소#1': ['molecule_class', '생화학'],
  'ATP#1': ['small_molecule', '생화학'], 'ADP#1': ['small_molecule', '생화학'], 'AMP#1': ['small_molecule', '생화학'],
  'GTP#1': ['small_molecule', '생화학'], 'GDP#1': ['small_molecule', '생화학'], '무기 인산#1': ['ion', '생화학'],
  '2차 전령#1': ['molecule_class', '세포생물학'], 'cAMP#1': ['small_molecule', '세포생물학'], '인산화#1': ['process', '생화학'],
  '단백질 키네이스#1': ['molecule_class', '생화학'], '단백질 키네이스 A#1': ['complex', '생화학'], '인산화효소 키네이스#1': ['complex', '생화학'],
  '글리코겐 인산화효소#1': ['molecule_class', '생화학'], '다당류#1': ['molecule_class', '생화학'], '포도당#1': ['small_molecule', '생화학'],
  '글리코겐#1': ['macromolecule', '생화학'], '포도당-1-인산#1': ['small_molecule', '생화학'], '포스포다이에스터레이스#1': ['molecule_class', '생화학'],
  'cAMP 신호 전달#1': ['pathway', '세포생물학'], '에피네프린에 의한 글리코겐 분해#1': ['pathway', '생화학'],
};
const X = (db, id) => ({ db, id, status: 'asserted' });
const XREFS = {
  'ATP#1': [X('ChEBI', 'CHEBI:15422')], 'ADP#1': [X('ChEBI', 'CHEBI:16761')], 'AMP#1': [X('ChEBI', 'CHEBI:16027')],
  'GTP#1': [X('ChEBI', 'CHEBI:15996')], 'GDP#1': [X('ChEBI', 'CHEBI:17552')], 'cAMP#1': [X('ChEBI', 'CHEBI:17489')],
  '포도당#1': [X('ChEBI', 'CHEBI:4167')], '글리코겐#1': [X('ChEBI', 'CHEBI:28087')],
  '아데닐산 고리화효소#1': [X('EC', 'EC 4.6.1.1')], '단백질 키네이스 A#1': [X('EC', 'EC 2.7.11.11')],
  '인산화효소 키네이스#1': [X('EC', 'EC 2.7.11.19')], '글리코겐 인산화효소#1': [X('EC', 'EC 2.4.1.1')],
  '포스포다이에스터레이스#1': [X('EC', 'EC 3.1.4.17')],
  '신호 전달 경로#1': [X('GO', 'GO:0007165')], 'cAMP 신호 전달#1': [X('GO', 'GO:0019933')],
};
const UNMAPPED = {
  '에피네프린#1': 'ChEBI 에 adrenaline 과 (R)-adrenaline 항목이 따로 있어 어느 것인지·번호를 원본에서 확인해야 함',
  '포도당-1-인산#1': 'ChEBI 항목(α-D-포도당 1-인산 등) 선택·번호 미확인',
  '무기 인산#1': 'Pi 는 pH 에 따라 H2PO4⁻/HPO4²⁻ 가 섞인 표기 — 특정 ChEBI 종을 정하지 않음',
};
const STATES = {
  'β-아드레날린 수용체#1': [
    { key: 'inactive', label: '비활성', activity: 'inactive' },
    { key: 'active', label: '활성(에피네프린 결합)', activity: 'active', bound: ['에피네프린#1'] },
  ],
  'Gs 단백질#1': [
    { key: 'GDP', label: 'GDP 결합(비활성)', activity: 'inactive', bound: ['GDP#1'], note: 'α 소단위에 GDP 가 결합한 상태' },
    { key: 'GTP', label: 'GTP 결합(활성)', activity: 'active', bound: ['GTP#1'], note: 'α 소단위에 GTP 가 결합한 상태' },
  ],
  '아데닐산 고리화효소#1': [
    { key: 'inactive', label: '비활성', activity: 'inactive' },
    { key: 'active', label: '활성', activity: 'active', bound: ['Gs 단백질#1'], note: 'GTP 가 붙은 Gsα 가 결합한 상태' },
  ],
  '단백질 키네이스 A#1': [
    { key: 'R2C2', label: '비활성(R2C2)', activity: 'inactive', note: '조절 소단위 2 + 촉매 소단위 2 의 4량체' },
    { key: 'C_free', label: '활성(촉매 소단위 해리)', activity: 'active', note: 'cAMP 가 조절 소단위에 붙어 촉매 소단위가 떨어져 나온 상태' },
  ],
  '인산화효소 키네이스#1': [
    { key: 'unphos', label: '비인산화(비활성)', activity: 'inactive' },
    { key: 'phos', label: '인산화(활성)', activity: 'active', modifications: [{ type: 'phosphorylation' }], note: 'PKA 에 의한 인산화 — 잔기는 기록하지 않음' },
  ],
  '글리코겐 인산화효소#1': [
    { key: 'b', label: 'b형(비인산화)', activity: 'partial', aliases: ['포스포릴레이스 b'] },
    { key: 'a', label: 'a형(인산화)', activity: 'active', aliases: ['포스포릴레이스 a'], modifications: [{ type: 'phosphorylation', site: 'Ser14' }] },
  ],
};
// 기전 단계: 이전 context → compartment / cell / context
const PLACE = {
  '간세포 세포막': { compartment: '세포막', cell: '간세포' },
  '간세포 세포막 안쪽': { compartment: '세포막', cell: '간세포', context: '세포막 안쪽(세포질 쪽)' },
  '간세포 세포질': { compartment: '세포질', cell: '간세포' },
};

const v2 = { format: 'definition-db', version: 2, terms: {}, steps: {} };
for (const [key, t] of Object.entries(v1.terms)) {
  v2.terms[key] = { ...t, definientia: t.definientia.map((d) => {
    if (!KF[d.id]) throw new Error('분류 표에 없음: ' + d.id);
    const [kind, field] = KF[d.id];
    const out = { id: d.id, kind, field, text: d.text, context: d.context, links: d.links, xrefs: XREFS[d.id] || [] };
    if (UNMAPPED[d.id]) out.unmapped = UNMAPPED[d.id];
    out.states = (STATES[d.id] || []).map((s) => ({ aliases: [], modifications: [], bound: [], ...s }));
    for (const k of ['examples', 'distinction', 'note', 'source', 'by', 'at']) if (d[k] !== undefined) out[k] = d[k];
    return out;
  }) };
}
const stateKey = (ref, text) => {
  const s = (STATES[ref] || []).find((x) => x.label === text);
  if (!s) throw new Error(`상태 표에 없음: ${ref} '${text}'`);
  return s.key;
};
for (const [id, st] of Object.entries(v1.steps || {})) {
  const place = PLACE[st.context];
  if (!place) throw new Error('위치 표에 없음: ' + st.context);
  const action = DefDB.mapVocab('actions', st.action);
  if (action.error) throw new Error(id + ': ' + action.error);
  const part = (p) => {
    const o = { ...p };
    if (o.state) {
      if (!STATES[o.ref] && o.minor) { o.note = `${o.state}`; delete o.state; }   // 부산물에 붙은 설명용 상태는 note 로
      else o.state = stateKey(o.ref, o.state);
    }
    if (o.after) o.after = stateKey(o.ref, o.after);
    return o;
  };
  v2.steps[id] = { id, label: st.label, action: action.key, ...place, text: st.text,
    agents: st.agents.map(part), inputs: st.inputs.map(part), outputs: st.outputs.map(part), regulators: st.regulators.map(part),
    part_of: st.part_of, ...(st.source ? { source: st.source } : {}), by: st.by, at: st.at };
}

const db = DefDB.normalize(v2);
const r = DefDB.validate(db);
for (const e of r.errors) console.log(`오류  ${e.where}: ${e.msg}`);
for (const w of r.warnings) console.log(`경고  ${w.where}: ${w.msg}`);
if (r.errors.length) { console.error(`오류 ${r.errors.length} — 저장하지 않음`); process.exit(1); }
writeFileSync(path, JSON.stringify(db, null, 2) + '\n');
console.log(`변환 완료: ${path} (경고 ${r.warnings.length})`);
