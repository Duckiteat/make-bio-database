#!/usr/bin/env node
// 데이터베이스 명령줄 도구 — AI 에이전트(Claude Code 등)가 직접 읽고 쓰기 위한 진입점.
// 기본 저장소는 data/db.json 이다. 다른 파일을 쓰려면 --db <경로>.
//
//   node dbtool.mjs status                                  저장소 요약
//   node dbtool.mjs validate                                전체 검사 (오류 있으면 종료 코드 1)
//   node dbtool.mjs merge     <patch.json...> [--dry] [--allow-warnings]
//                                                           병합 + Patch Report(Scope·Why·Impact·Verification). patch.why 필수, 미등록 한계 후보가 있으면 거부
//                                                           매핑 → 검사 → 관문 통과 시 저장, 적용한 패치는 data/patches/ 에 기록
//   node dbtool.mjs map       <번호|이름|이름#n|외부ID|지문>   참조가 어느 정의항(D…)으로 매핑되는지
//   node dbtool.mjs audit                                   매핑·채움 현황 (외부 ID 대조 여부, 미매핑, 잔기 모름, 구조 지문)
//   node dbtool.mjs vocab     [표 이름]                     통제 어휘 보기 (kinds, locations, features, actions …)
//   node dbtool.mjs context   <번호|이름|이름#n> [--up N] [--down N]
//   node dbtool.mjs mechanism <S…|경로 번호·이름> [--up N] [--down N]
//   node dbtool.mjs prompt    [자료.txt]                     AI 에게 줄 작성 지침 + 현재 색인
//   node dbtool.mjs limitations [--open] [--write | --check] [--detect]
//                                                           한계 등록부: 출력 / limitations.md 생성 / 최신인지 검사 / 미등록 후보 찾기
//   node dbtool.mjs pattern   <경로|상위 개념>              경로에서 상위 패턴(모티프) 찾기, 또는 상위 개념이 나타나는 경로
//   node dbtool.mjs resolution <경로>                        혼합 해상도 계획: 단계마다 필요한/갖춘 해상도(R0 위상·R1 부위·R2 구조)와 전환 문턱
//   node dbtool.mjs audit-run <경로> [--scenario s.json] [--t 60] [--dt 0.001] [--reservoirs finite|infinite] [--stochastic] [--seed N]
//                                                           감사: 스키마·해상도 일관성·속도 무결성·질량 보존 (Audit Error 가 있으면 종료 코드 1)
//   node dbtool.mjs report    <data/patches/….json>          기록된 병합의 Patch Report (Scope·Why·Impact·Verification)
//   node dbtool.mjs textbook  [--write | --check]            교과서 부록(docs/textbook/90-부록-자동생성.md) 생성 / 최신·파일 분류 검사
//   node dbtool.mjs simulate  <경로> --rate [--scenario s.json] [--t 60] [--dt 0.001] [--reservoirs finite|infinite] [--stochastic] [--seed N] [--until-death] [--window s] [--death-frac f]
//                                                           속도 기반 시뮬레이션 (유한 대사물 저장소·공급·분해·매 Δt 질량 감사·정지까지 실행·사후 분석)
//   node dbtool.mjs augment   plan [--write] | fetch [--refetch] | build [--sync] [--out patch.json] | apply [--sync] | apply <초안 patch.json>
//                                                           자동 보강 고리: unmapped·Identity_Gap·asserted 외부 ID → UniProt·ChEBI 원본(data/fetched/) → 확인 → 패치 → 관문 → CHANGES.md
//                                                           네트워크가 막히면 data/fetched/RETRIEVAL_TASKS.md 에 수동 수집 과제를 쓴다
//   node dbtool.mjs grade     [<D…>] [--min <등급>] [--limit N]  신뢰 지표: 도장·근거·관찰에서 (S, D) 를 계산해 등급 분포·미달 목록 (--min 미달이면 종료 코드 1)
//   node dbtool.mjs trend     [<D…>] [--fetch] [--write] [--all] [--limit N]
//                                                           추세 점검(시간 축): 더 새 원본을 합의 수신함에 받아 같은 확인을 다시 돌림 — match 면 anchor 가 열리고
//                                                           mismatch 면 등급이 legacy 로 내려가며 Consensus_Gap 후보가 된다 (후보가 있으면 종료 코드 1)
//   node dbtool.mjs attest    [--quick]                     증명 등록부 검사: 도장마다 digest·증거 sha256·같은 확인 재실행 (무효 도장이 있으면 종료 코드 1)
//   node dbtool.mjs compare   --state <세포 상태> --scenario A.json [--scenario-b B.json] [--patch p.json] [--hours h] [--ref-hours h]
//                                                           비교 검토: 복잡도·수치 L2(수렴 기준)·결과·판정 (Optimization-Negative 이면 종료 코드 1)
//   node dbtool.mjs validate  <patch.json>                  패치 검사: 관문 미리 보기 + 정제 점검(중복 규칙·화학량 모순)
//   node dbtool.mjs fate      <세포 상태> --scenario s.json [--t 시간(h)] [--no-commitment] [--brief] [--report 파일.md] [--numerics h] [--engine rust|js] [--workers n]
//                                                           세포 운명 (v9) + 과정 분석 보고서: 요약 · 변곡점·시계열·구간 · 무결성 증명서(원장·재생·신호·결정론·출처) · 인과 추적 · 부록
//                                                           (무결성 FAIL 이면 종료 코드 1; --brief 는 짧은 요약)
//   node dbtool.mjs fate      <세포 상태> --scenario s.json --ensemble N   (시나리오 stochastic { seed } 필요, 4단계 ④·⑤)
//                                                           확률 앙상블: 운명 비율(Wilson 구간)·도달 시각 분포·표지 퍼짐(Fano) · 궤적마다 원장 감사 · seed 재현 · 결정론 대비
//                                                           (결함 ENGINE_DEFECT 나 재현 실패면 종료 코드 1)
//   node dbtool.mjs observe   <O…|관찰.json> --state <세포 상태> --scenario A.json [--scenario-b B.json] [--n 50]
//                                                           관찰 판정 (4단계 ②): 계약·관문 검사 → 예측(결정론 또는 앙상블) ⊛ 측정 잡음 ↔ 관찰
//                                                           → CONSISTENT | CONFLICT | INDISTINGUISHABLE(Observation_Gap 후보 + 필요 정밀도). 쓰지 않는다
//   node dbtool.mjs simulate  <경로> [--until D…] [--from D…] [--amount N] [--rounds N] [--init "묶음키=N;…"]
//                                                           경로의 단계를 규칙대로 발화시켜 목표 도달·유도 경로 확인 (도달 못 하거나 유도 안 되면 종료 코드 1)
//
// 삼권 분립 (docs/design/tripartite-governance.md): 이 도구는 조정만 한다 — 행정부(core.js·engine/)를 부르고, 판정은 사법부(judicial/)에,
//   파일 쓰기는 입법 서기(legislative/clerk.mjs)에 맡긴다. 이 파일 안에는 파일을 쓰는 코드가 없다.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, basename, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import * as CLERK from './legislative/clerk.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const req = createRequire(import.meta.url);
const DefDB = req('./core.js'), J = req('./judicial/judicial.js'), LEG = req('./legislative/legislative.js'), ORCH = req('./orchestrator.js'), ATT = req('./judicial/attestation.js');
const [cmd, ...rest] = process.argv.slice(2);
const flags = {}, args = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith('--')) { const k = rest[i].slice(2); flags[k] = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : true; }
  else args.push(rest[i]);
}
const DB_PATH = flags.db || join(HERE, 'data', 'db.json');
const PATCH_DIR = join(dirname(DB_PATH), 'patches');
const readJSON = (p) => DefDB.parseLoose(readFileSync(p, 'utf8'));
// 형식 v12: 값이 바뀌는 병합의 기록 시각 — 병합 전에 패치에 찍어 관문이 봉인한다(패치 기록에 남아 재생해도 같다). 이미 있으면 그대로
const stamped = (patch) => (patch && typeof patch === 'object' && !patch.recorded_at ? { ...patch, recorded_at: new Date().toISOString() } : patch);
// 시나리오 읽기: 파생 시나리오(기준 + 교란 한 줄, build-plan 9)는 같은 폴더의 기준을 읽어 교란을 건 실제 입력으로 푼다 (컴파일러 derive)
const loadScenario = (path, sid, db) => {
  const sc = readJSON(path), PT = req('./compiler/perturb.js');
  if (!PT.isDerived(sc)) return { scenario: sc, text: readFileSync(path, 'utf8') };
  if (!sid) die(`파생 시나리오 ${path} 는 세포 상태가 있는 실행(fate · observe · compare)에서만 — 교란이 그 계의 규칙·묶음을 보고 풀린다`);
  const bp = join(dirname(path), String(sc.base));
  if (!existsSync(bp)) die(`파생 시나리오 ${path}: 기준 '${sc.base}' 이 없음`);
  const v = PT.derive(db, sid, sc, readJSON(bp));
  if (v.error) die(`파생 시나리오 ${path}: ${v.error}`);
  console.log(`※ 파생 시나리오: 기준 ${sc.base} + 교란 ${JSON.stringify(sc.perturbation)} (교란 기록 ${v.record.hash.slice(0, 12)}…)`);
  return { scenario: v.scenario, text: JSON.stringify(v.scenario, null, 2) + '\n', derived: v };
};
const loadDB = () => (existsSync(DB_PATH) ? DefDB.normalize(readJSON(DB_PATH)) : DefDB.emptyDB());
const rel = (p) => relative(process.cwd(), p) || p;
const printIssues = (errors, warnings) => {
  for (const e of errors) console.log(`오류  ${e.where}: ${e.msg}`);
  for (const w of warnings) console.log(`경고  ${w.where}: ${w.msg}`);
};
const die = (m) => { console.error(m); process.exit(1); };
// 속도 기반 시뮬레이션·감사 공용 옵션
const rateOpt = () => ({ scenario: flags.scenario ? loadScenario(flags.scenario).scenario : null, t_end: +(flags.t || 60), dt: +(flags.dt || 1e-3),
  reservoirs: typeof flags.reservoirs === 'string' ? flags.reservoirs : undefined, stochastic: flags.stochastic ? true : undefined, seed: flags.seed != null ? +flags.seed : undefined,
  until_death: flags['until-death'] ? true : undefined, window: flags.window != null ? +flags.window : undefined, death_frac: flags['death-frac'] != null ? +flags['death-frac'] : undefined });
// 사법부가 검증한 증명 도장 열쇠 (validate·관문에 넘김)
const attestations = (db) => ATT.validStamps(db, ATT.readRegistry(HERE), { root: HERE });
const REL = req('./judicial/reliability.js'); // 사법부 — 신뢰 지표 (S·D 쌍 → 등급)
const TR = req('./judicial/trend.js');        // 사법부 — 추세 점검 (시간 축: 합의와 같은가)
// 추세 축: 창 안의 유효한 추세 도장만 (없으면 'unchecked' — anchor 가 나오지 않는다)
const trendMap = (db, reg) => TR.verdicts(db, reg, { root: HERE }).map;

switch (cmd) {
  case 'status': {
    const db = loadDB(), senses = Object.values(db.senses);
    const sum = (f) => senses.reduce((n, d) => n + f(d), 0);
    const links = sum((d) => d.desc.reduce((m, x) => m + x.links.length, 0)), sites = sum((d) => Object.keys(d.site).length), rules = sum((d) => d.rule.length);
    const r = ORCH.validateWithRegistry(db, HERE), nx = db.meta.next;
    console.log(`저장소 ${rel(DB_PATH)} (형식 v${DefDB.VERSION}): 개념 ${Object.keys(db.terms).length}, 정의항 ${senses.length}, 연결 ${links}, 부위 ${sites}, 규칙 ${rules}, 관찰 ${sum((d) => d.obs.length)}, 기전 단계 ${Object.keys(db.steps).length}, 한계 ${Object.keys(db.limitations).length}, 관찰 기록 ${Object.keys(db.observations).length}, 오류 ${r.errors.length}, 경고 ${r.warnings.length}`);
    console.log(`다음 번호: T${String(nx.T).padStart(6, '0')} D${String(nx.D).padStart(6, '0')} S${String(nx.S).padStart(6, '0')} L${String(nx.L).padStart(6, '0')} O${String(nx.O).padStart(6, '0')}`);
    break;
  }
  case 'validate': {
    if (args[0]) { // 패치 검사: 관문 미리 보기 + 부분 구조 수지(ΣIn = ΣOut, 상대 1e-14 — validate 규칙) + 정제 점검의 새 문제
      const db = loadDB(), patch = stamped(readJSON(args[0])), res = LEG.ingest(db, patch), g = J.gate(db, res, { attestations: attestations(db).keys });
      printIssues(g.errors, g.warnings);
      const before = J.refineCheck(db).issues.map((x) => x.type + x.where), ref = J.refineCheck(res.db), fresh = ref.issues.filter((x) => !before.includes(x.type + x.where));
      for (const x of fresh) console.log(`  △ [${x.type}] ${x.msg}`);
      const refactor = LEG.draftRefactor(res.db, ref.issues);
      if (refactor && fresh.some((x) => x.type === 'duplicate_rule')) console.log(`  → 리팩터링 패치 제안 (입법 초안): ${refactor.why}`);
      // 차단 판정(why · 미등록 한계 · 정제 점검)은 관문(judicial patchPolicy)이 한다 — 여기서는 보여 주기만
      console.log(`— 패치 ${args[0]}: 관문 ${g.ok ? '통과' : '거부'} (새 오류 ${g.errors.length}, 새 경고 ${g.warnings.length}) · 정제 점검 새 문제 ${fresh.length}`);
      process.exit(g.ok ? 0 : 1);
    }
    const r = ORCH.validateWithRegistry(loadDB(), HERE);
    printIssues(r.errors, r.warnings);
    for (const f of r.attestations.failed) console.log(`오류  증명 ${f.key}: ${f.reasons.join(' · ')}`);
    console.log(`— 오류 ${r.errors.length}, 경고 ${r.warnings.length} · 유효한 증명 도장 ${r.attestations.keys.length}${r.attestations.failed.length ? `, 무효 ${r.attestations.failed.length}` : ''}${(r.attestations.stale || []).length ? `, 지난 도장 ${r.attestations.stale.length}` : ''}`);
    if (r.attestations.failed.length) process.exit(1);
    process.exit(r.errors.length ? 1 : 0);
  }
  case 'merge': {
    if (!args.length) die('사용법: merge <patch.json...> [--dry] [--allow-warnings]');
    let db = loadDB(), seal = null;
    const applied = [], att = attestations(db).keys;
    for (const p of args) {
      const patch = stamped(readJSON(p));
      const res = LEG.ingest(db, patch), g = J.gate(db, res, { allowWarnings: !!flags['allow-warnings'], attestations: att }), r = res.report;
      console.log(`${p}: 추가 ${r.added.length}, 수정 ${r.updated.length}, 삭제 ${r.removed.length}`);
      for (const [a, b] of Object.entries(r.idmap)) console.log(`  id   ${a} → ${b}`);
      for (const m of r.mapped) console.log(`  매핑 ${m.from} → ${m.to}  (${m.via})`);
      printIssues(g.errors, g.warnings);
      const rep = J.patchReport(db, res, patch, g);
      console.log(J.patchReportText(rep, DefDB.index(res.db)));
      if (!g.ok) die(!g.changed ? '바뀐 것이 없음 — 저장하지 않았습니다.'
        : g.errors.length ? `오류 ${g.errors.length} — 패치를 거부했습니다. 위 메시지대로 패치를 고치세요.`
        : `패치가 새 경고 ${g.warnings.length}개를 만듦 — 거부했습니다. 고치거나 --allow-warnings 로 명시적으로 허용하세요.`);
      applied.push({ name: basename(p), record: { result: { added: r.added, updated: r.updated, removed: r.removed, mapped: r.mapped }, report: rep, ...patch } });
      db = res.db; seal = ATT.sealVerdict(g, db); // 사법부 판결 봉인 — 서기는 이 봉인의 db 만 쓴다
    }
    if (flags.dry) { console.log('관문 통과 (--dry: 저장하지 않음)'); break; }
    const w = CLERK.commitMerge({ dbPath: DB_PATH, db, records: applied, seal });
    for (const f of w.records) console.log('기록: ' + rel(f));
    console.log('저장 (입법 서기): ' + rel(DB_PATH));
    break;
  }
  case 'report': {
    // 기록된 패치의 Patch Report 다시 보기 (v7.1 이후 기록에만 report 가 있음)
    if (!args[0]) die('사용법: report <data/patches/….json>');
    const rec = readJSON(args[0]);
    if (!rec.report) die('이 기록에는 Patch Report 가 없음 (report 도입 이전 병합)');
    console.log(J.patchReportText(rec.report, DefDB.index(loadDB())));
    break;
  }
  case 'map': {
    if (!args.length) die('사용법: map <번호|이름|이름#n|외부ID|지문>');
    const db = loadDB();
    for (const q of args) console.log(DefDB.mapText(db, q));
    break;
  }
  case 'audit': {
    console.log(J.auditText(loadDB()));
    break;
  }
  case 'vocab': {
    const V = DefDB.VOCAB, tables = args.length ? args : ['kinds', 'fields', 'locations', 'faces', 'associations', 'siteTypes', 'features', 'actions', 'activity', 'effects', 'taxa', 'obsProperties', 'evidenceLevels', 'xrefs'];
    for (const t of tables) {
      if (!V[t]) die(`어휘 표 '${t}' 없음`);
      console.log(`## ${t}`);
      for (const [k, v] of Object.entries(V[t])) console.log(`  ${k}${v.label ? ` — ${v.label}` : ''}${v.aliases && v.aliases.length ? `  (별칭: ${v.aliases.join(', ')})` : ''}${v.pattern ? `  형식: ${v.pattern}` : ''}${v.dim ? `  [${v.dim}${v.parent ? ' ⊂' + v.parent : ''}${v.sides ? ' 면: ' + Object.entries(v.sides).map(([f, l]) => f + '→' + l).join(', ') : ''}]` : ''}${v.effects ? `  [효과 ${v.effects.join('/')}${v.adds ? ' +' + v.adds : ''}${v.removes ? ' −' + v.removes : ''}]` : ''}${v.name ? `  ${v.name}` : ''}`);
    }
    break;
  }
  case 'context': {
    if (!args[0]) die('사용법: context <번호|이름|이름#n> [--up N] [--down N]');
    console.log(DefDB.contextText(loadDB(), args[0], { up: +(flags.up || 4), down: +(flags.down || 1) }));
    break;
  }
  case 'mechanism': {
    if (!args[0]) die('사용법: mechanism <S…|경로 번호·이름> [--up N] [--down N]');
    console.log(DefDB.mechanismText(loadDB(), args[0], { up: +(flags.up || 3), down: +(flags.down || 3) }));
    break;
  }
  case 'limitations': {
    const db = loadDB(), md = J.limitationsMarkdown(db), file = CLERK.derivedPath('limitations', HERE);
    if (flags.coverage) { console.log(J.coverageMapText(db)); break; } // 48: 관측 커버리지 지도 (어떤 측정량이 현실 검증 사각인가)
    if (flags.write) { CLERK.writeDerived('limitations', md, HERE); console.log('저장 (입법 서기): ' + rel(file)); break; }
    if (flags.check) {
      const cur = existsSync(file) ? readFileSync(file, 'utf8') : '';
      if (cur !== md) die('limitations.md 가 data/db.json 과 다름 — node dbtool.mjs limitations --write');
      console.log('limitations.md 최신');
      break;
    }
    if (flags.detect) {
      // 추세 mismatch(합의와 다름)도 등록해야 하는 공백이다. 데이터만으로는 알 수 없으므로(합의 수신함·등록부가 필요) 여기서 더한다 —
      // 관문(gate)의 detectGaps 는 db.json 만 보므로 병합의 재현성은 그대로다.
      const reg0 = ATT.readRegistry(HERE);
      const tcand = reg0.stamps.some((x) => x.claim === 'trend') ? TR.gapCandidates(db, TR.check(db, { registry: reg0, root: HERE }).rows) : [];
      const c = [...J.detectGaps(db), ...tcand];
      console.log(c.length ? '등록되지 않은 한계 후보:\n' + c.map((x) => `  [${x.target} | ${x.type}] ${x.why}`).join('\n') : '등록되지 않은 한계 후보 없음');
      process.exit(c.length ? 1 : 0); // CI: 미등록 공백(unmapped·속도 없는 공급/분해 …)이 있으면 실패
    }
    console.log(J.limitationsText(db, { open: !!flags.open }));
    break;
  }
  case 'pattern': {
    if (!args[0]) die('사용법: pattern <경로|상위 개념>');
    console.log(DefDB.patternText(loadDB(), args[0]));
    break;
  }
  case 'textbook': {
    const dir = join(HERE, 'docs', 'textbook'), file = join(dir, '90-부록-자동생성.md');
    const map = readJSON(join(dir, 'storage-map.json'));
    // 파일 분류 검사: 저장소의 모든 파일이 storage-map 의 경로 패턴 하나에 맞아야 한다
    const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); if (['.git', 'node_modules', 'target'].includes(n)) return []; /* target = cargo 빌드 산출물 (gitignore) */ return statSync(p).isDirectory() ? walk(p) : [relative(HERE, p).split('\\').join('/')]; });
    const re = (g) => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$');
    const pats = map.files.map((f) => ({ f, re: re(f.path) }));
    const unclassified = walk(HERE).filter((p) => !pats.some((x) => x.re.test(p)));
    for (const f of map.files) if (!map.classes[f.class]) die(`storage-map: '${f.path}' 의 분류 '${f.class}' 가 classes 에 없음`);
    // 저장 구역 (용광로): 분류마다 구역 하나, 파일의 덮어쓰기도 열거값 안
    const zones = (map.zones || {}).enum || {};
    for (const [k, c] of Object.entries(map.classes)) if (!zones[c.zone]) die(`storage-map: 분류 '${k}' 의 구역 '${c.zone}' 가 zones 에 없음`);
    for (const f of map.files) if (f.zone && !zones[f.zone]) die(`storage-map: '${f.path}' 의 구역 '${f.zone}' 가 zones 에 없음`);
    // 아키텍처 노드: 이름 하나에 파일 하나, 권한은 열거값, 경로는 실제 파일
    const nodeNames = new Set();
    for (const f of map.files.filter((x) => x.node)) {
      if (nodeNames.has(f.node)) die(`storage-map: 노드 '${f.node}' 가 둘 이상`);
      nodeNames.add(f.node);
      if (!(map.governance || { enum: [] }).enum.includes(f.governance)) die(`storage-map: 노드 '${f.node}' 의 권한 '${f.governance}' 가 열거값에 없음`);
      if (!f.refactor_strategy) die(`storage-map: 노드 '${f.node}' 에 refactor_strategy 없음`);
      if (!existsSync(join(HERE, f.path))) die(`storage-map: 노드 '${f.node}' 의 경로 ${f.path} 가 없음`);
    }
    const md = textbookAppendix(loadDB(), map);
    if (flags.write) { CLERK.writeDerived('textbook', md, HERE); console.log('저장 (입법 서기): ' + rel(file)); }
    if (unclassified.length) die('storage-map.json 에 분류되지 않은 파일:\n' + unclassified.map((p) => '  ' + p).join('\n'));
    if (flags.check) {
      if ((existsSync(file) ? readFileSync(file, 'utf8') : '') !== md) die('교과서 부록이 현재 코드·데이터와 다름 — node dbtool.mjs textbook --write');
      console.log('교과서 부록 최신, 모든 파일 분류됨');
    }
    if (!flags.write && !flags.check) console.log(md);
    break;
  }
  case 'resolution': {
    if (!args[0]) die('사용법: resolution <경로>');
    console.log(ORCH.resolutionText(loadDB(), args[0]));
    break;
  }
  case 'audit-run': {
    // (rateOpt 는 아래 simulate 와 공용)
    if (!args[0]) die('사용법: audit-run <경로> [--scenario s.json]');
    const list = ORCH.auditRun(loadDB(), args[0], rateOpt());
    const FT = req('./judicial/fault.js');
    for (const a of list) console.log(`[${a.code} · ${a.fault}] ${a.where}: ${a.msg}\n    → 교정 제안: ${a.suggestion}\n    → 고치는 곳: ${FT.routeText(a.fault)}`);
    console.log(`— Audit Error ${list.length}건`);
    process.exit(list.length ? 1 : 0);
  }
  case 'simulate': {
    if (flags.rate) {
      if (!args[0]) die('사용법: simulate <경로> --rate [--scenario s.json]');
      console.log(ORCH.simulateRateText(loadDB(), args[0], rateOpt()));
      console.log(J.refineText(loadDB()).text);
      break;
    }
    if (!args[0]) die('사용법: simulate <경로> [--until D…] [--from D…] [--amount N] [--rounds N] [--init "묶음키=N;…"]');
    const db = loadDB(), ix = DefDB.index(db), id = (r) => { if (!r || r === true) return undefined; const x = DefDB.resolveRef(ix, r); if (x.error) die(x.error); return x.id; };
    const init = {};
    for (const kv of String(flags.init || '').split(';').filter(Boolean)) { const i = kv.lastIndexOf('='); init[kv.slice(0, i).trim()] = +kv.slice(i + 1); }
    const opt = { until: id(flags.until), from: id(flags.from), amount: +(flags.amount || 10), rounds: +(flags.rounds || 60), init, cell: flags.cell && flags.cell !== true ? flags.cell : undefined };
    const txt = ORCH.simulateText(db, args[0], opt);
    console.log(txt);
    if (opt.until && (/✗/.test(txt))) process.exit(1);
    break;
  }
  case 'augment': {
    // 자동 보강: 과제·신원 판결·도장은 사법부(judicial/identity.js·attestation.js), 패치 초안은 입법부(legislative/augment_draft.js),
    //   받기·병합·등록부·CHANGES·파생 문서 쓰기는 입법 서기(legislative/clerk.mjs)
    const ID = req('./judicial/identity.js'), DRAFT = req('./legislative/augment_draft.js');
    const sub = args[0] || 'plan', date = new Date().toISOString().slice(0, 10), dir = flags.dir && flags.dir !== true ? flags.dir : ID.INBOX;
    const table = (tasks) => { for (const t of tasks) console.log(`  ${t.present ? '✓' : '·'} ${t.sense} ${t.label} — ${t.kind} ${t.key}: ${t.why}${t.gaps.length ? ` [${t.gaps.join(', ')}]` : ''}`); };
    if (sub === 'plan' || sub === 'fetch') {
      let tasks = ID.plan(loadDB(), { dir });
      console.log(`자동 보강 과제 ${tasks.length}개 (수신함 ${dir}: 있음 ${tasks.filter((t) => t.present).length})`);
      let results = null;
      if (sub === 'fetch') {
        results = CLERK.fetchToInbox(tasks, { refetch: !!flags.refetch });
        const ok = results.filter((r) => r.ok && !r.cached).length, bad = results.filter((r) => !r.ok);
        console.log(`받음 ${ok} · 이미 있음 ${results.filter((r) => r.cached).length} · 실패 ${bad.length}${bad.length ? ` (${[...new Set(bad.map((r) => r.error))].join(' · ')})` : ''}`);
        tasks = ID.plan(loadDB(), { dir }); // 검색 결과가 생기면 다음 단계 과제가 늘어난다
      }
      table(tasks);
      if (flags.write || sub === 'fetch') { const f = CLERK.writeRetrievalTasks(join(HERE, dir), ID.retrievalTasksMarkdown(tasks, results, date)); console.log('수동 수집 과제 (입법 서기): ' + rel(f) + (tasks.some((t) => !t.present) ? ` — ${tasks.filter((t) => !t.present).length}개를 사람이 받아 두어야 함 (UniProt·ChEBI 에 닿지 못함)` : '')); }
      break;
    }
    if (sub === 'build' || sub === 'apply') {
      const db = loadDB(), drafted = args[1] ? readJSON(args[1]) : null;
      const b = drafted ? { patch: drafted, rows: [], stamps: [], empty: false } : ORCH.augmentBuild(db, { dir, sync: !!flags.sync, date });
      if (drafted && !drafted.why) die('초안 패치에 why 가 없음');
      const mark = { verified: '✓', rejected: '✗', ambiguous: '?', candidate: '→', missing: '·', unreadable: '!' };
      for (const r of b.rows) console.log(`  ${mark[r.outcome] || ' '} ${r.sense} ${r.label} [${r.kind} ${r.key}] ${r.outcome}: ${r.detail}`);
      if (b.empty) { console.log('바꿀 것이 없음 — 수신함 파일을 더하거나 (augment plan --write) 과제를 확인할 것'); process.exit(b.rows.some((r) => r.outcome === 'rejected') ? 1 : 0); }
      const out = flags.out && flags.out !== true ? flags.out : join(tmpdir(), `augment-${date}.json`);
      CLERK.writeDraft(out, b.patch);
      b.patch = stamped(b.patch);
      const res = LEG.ingest(db, b.patch);
      // 새 도장: 사법부가 병합 뒤 데이터로 다시 확인한 것만 관문에 넘긴다 (데이터는 스스로 verified 를 만들 수 없음)
      const fresh = b.stamps.map((st) => ATT.verifyStamp(st, res.db, { root: HERE })), badSt = fresh.filter((v) => !v.ok);
      for (const v of badSt) console.log(`  ✗ 도장 ${v.key}: ${v.reasons.join(' · ')}`);
      const att = [...attestations(db).keys, ...fresh.filter((v) => v.ok).map((v) => v.key)];
      const g = J.gate(db, res, { attestations: att }), rep = J.patchReport(db, res, b.patch, g);
      printIssues(g.errors, g.warnings);
      console.log(J.patchReportText(rep, DefDB.index(res.db)));
      console.log(`패치 초안 (입법 서기): ${out} · 증명 도장 ${b.stamps.length} (유효 ${fresh.length - badSt.length})`);
      // 정제 점검: 이 패치가 만든 중복·등록되지 않은 화학량 모순은 병합을 막는다 (리팩터링 패치 초안을 함께 제안)
      const before = J.refineCheck(db).issues.map((x) => x.type + x.where), ref = J.refineCheck(res.db), freshI = ref.issues.filter((x) => !before.includes(x.type + x.where));
      console.log(freshI.length ? ['정제 점검 — 이 패치가 만든 문제:', ...freshI.map((x) => `  △ [${x.type}] ${x.msg}`)].join('\n') : J.refineText(res.db).text);
      // 정제 점검의 차단은 관문(judicial patchPolicy)이 한다 — 여기서는 리팩터링 초안만 써 둔다
      if (freshI.some((x) => x.type === 'duplicate_rule')) {
        const refactor = LEG.draftRefactor(res.db, ref.issues);
        if (refactor) { const rp = join(tmpdir(), `refactor-${date}.json`); CLERK.writeDraft(rp, refactor); console.log('리팩터링 패치 제안 (입법 초안): ' + rp); }
      }
      if (!g.ok || badSt.length) die('관문 거부 — 패치를 저장하지 않음');
      if (sub === 'build') { console.log(`관문 통과 — 병합하려면: node dbtool.mjs augment apply${flags.sync ? ' --sync' : ''}`); break; }
      const r = res.report, name = drafted ? basename(args[1]).replace(/\.json$/, '') : 'auto-augmentation';
      const w = CLERK.commitMerge({ dbPath: DB_PATH, db: res.db, records: [{ name, record: { result: { added: r.added, updated: r.updated, removed: r.removed, mapped: r.mapped }, report: rep, ...b.patch } }], seal: ATT.sealVerdict(g, res.db) });
      if (b.stamps.length) console.log('증명 등록부 (입법 서기): ' + rel(CLERK.appendAttestations({ root: HERE, stamps: b.stamps, db: res.db })));
      CLERK.insertChangesRow(DRAFT.changesRow(rel(w.records[0]), rep, b.rows, date, !!drafted), HERE);
      // 생성물 자동 갱신: limitations.md · 교과서 부록
      CLERK.writeDerived('limitations', J.limitationsMarkdown(res.db), HERE);
      CLERK.writeDerived('textbook', textbookAppendix(res.db, readJSON(join(HERE, 'docs', 'textbook', 'storage-map.json'))), HERE);
      console.log(`기록: ${rel(w.records[0])}\n저장 (입법 서기): ${rel(DB_PATH)}\nCHANGES.md 에 한 행 추가 · limitations.md · 교과서 부록 갱신`);
      break;
    }
    die('사용법: augment plan [--write] | fetch [--refetch] | build [--sync] [--out patch.json] | apply [--sync] | apply <초안 patch.json>');
  }
  case 'grade': {
    // 신뢰 지표 (사법부 judicial/reliability.js): 도장·근거·관찰에서 (S, D) 를 계산해 등급을 낸다 — 저장하지 않는다
    const db = loadDB(), reg = ATT.readRegistry(HERE), v = ATT.validStamps(db, reg, { root: HERE, reverify: !flags.quick });
    const rows = REL.items(db, { attestations: v.keys, stale: v.stale, stamps: reg.stamps, trend: flags.quick ? {} : trendMap(db, reg) });
    const target = args[0] ? DefDB.resolveRef(DefDB.index(DefDB.normalize(db)), args[0]) : null;
    if (target && target.error) die(target.error);
    const pick = target ? rows.filter((r) => r.sense === target.id) : rows;
    if (target) {
      console.log(`# 신뢰 지표 — ${target.id} (항목 ${pick.length})`, '');
      console.log('| 항목 | 대상 | 등급 | S | D | 근거 |', '\n|---|---|---|---|---|---|');
      for (const r of pick) console.log(`| ${r.what} | ${r.target} | ${r.grade} ${REL.GRADES[r.grade].label} | ${r.s} ${REL.S_LABEL[r.s]} | ${r.d} ${REL.D_LABEL[r.d] || '—'} | ${r.why} |`);
    } else console.log(REL.gradeText(rows, { min: flags.min && flags.min !== true ? flags.min : undefined, limit: +(flags.limit || 40) }));
    const min = flags.min && flags.min !== true ? flags.min : null;
    if (min && !REL.ORDER.includes(min)) die(`등급 '${min}' — ${REL.ORDER.join(' | ')}`);
    if (min) process.exit(pick.every((r) => REL.meets(r, min)) ? 0 : 1);
    break;
  }
  case 'register': { // 사전 등록 (build-plan 3): 검증에 쓸 시나리오를 실행 전에 — 사법부 규약 구조 판정이 통과한 것만 서기가 사슬에 남긴다
    if (!args[0]) die('사용법: register <시나리오.json>');
    const PROTO = req('./judicial/protocol.js'), db = loadDB(), sc = JSON.parse(readFileSync(args[0], 'utf8')), v = PROTO.protocolStructure(db, sc);
    console.log(v.declared ? (v.ok ? '규약 구조: 통과' : `규약 구조: 위반 ${v.problems.length}\n` + v.problems.map((x) => '  ✗ ' + x).join('\n')) : '규약(protocol) 없음 — 등록할 수 없음');
    if (!v.ok) process.exit(1);
    const e = CLERK.registerPrereg({ dataDir: dirname(DB_PATH), scenario: sc, seal: ATT.sealVerdict({ ok: true, errors: [], warnings: [] }, sc, { issuer: 'judicial/protocol.js#protocolStructure' }) });
    console.log(`사전 등록 #${e.seq} (입법 서기): ${e.at} · 시나리오 sha256 ${e.scenario_sha256.slice(0, 12)}… — 이 시나리오를 고치면 미등록이 된다`);
    break;
  }
  case 'qualgraph': { // 정성 그래프 0 층 판정 (build-plan 7): 기전 그래프 경로 부호 대 정성 관찰의 주장 — 읽기만
    const QG = req('./judicial/qual_graph.js'), ids = args.filter((a) => /^O\d{6}$/.test(a));
    const v = QG.qualGraphVerdict(loadDB(), ids.length ? { ids } : {});
    if (flags.json) console.log(JSON.stringify({ rows: v.rows, counts: v.counts, index: v.index, graph: v.graph }, null, 2));
    else console.log(QG.qualGraphText(v));
    break;
  }
  case 'retraction': { // 파생 그래프 · 철회 전파 (build-plan 13): 철회된(또는 <O…> 로 철회를 가정한) 관찰에 기댄 현재 값·상수·단계·경로 — 읽기만, db 불변
    const db = loadDB(), ids = args.filter((a) => /^O\d{6}$/.test(a));
    const opt = ids.length ? { assume: ids } : {};
    if (flags.json) console.log(JSON.stringify(J.retractionImpact(db, opt), null, 2));
    else console.log(J.retractionText(db, opt));
    break;
  }
  case 'evidence': { // 증거·방법 보고서 (build-plan 12): 시나리오 + 대상 경로 → 인과·값표·닫는 방법·판정 수준·실패·사고패턴·삼각 결론 (읽기만)
    if (!args[0] || !flags.target) die('사용법: evidence <시나리오.json> --target <경로|상태 번호·이름> [--report 파일.md]');
    const ER = req('./judicial/evidence_report.js'), db = loadDB();
    const ix = DefDB.index(DefDB.normalize(db)), tg = DefDB.resolveRef(ix, flags.target === true ? '' : flags.target);
    if (tg.error) die(tg.error);
    // 파생 시나리오는 세포 상태 계에서 풀린다 (교란이 그 계의 규칙·묶음을 본다)
    const { scenario, text: scenarioText, derived } = loadScenario(args[0], (db.senses[tg.id] || {}).kind === 'cell_state' ? tg.id : null, db);
    // 흐름 비교용 원자료는 조정자가 돌린다 (사법부 evidence_report 는 읽기만) — 경로 대상일 때만
    let sim = null;
    if ((db.senses[tg.id] || {}).kind === 'pathway') {
      try { const raw = ORCH.runRate(db, tg.id, { scenario, t_end: scenario.window || 1, dt: scenario.dt || 0.001 }); sim = { cum: raw.cum, window: scenario.window || 1 }; }
      catch (e) { console.error('⚠ 흐름 비교용 속도 실행 실패(보고서는 흐름 표 없이 계속): ' + e.message); }
    }
    const rep = ER.evidenceReport(db, scenario, { target: tg.id, scenarioText, dbText: readFileSync(DB_PATH, 'utf8'), sim, derived, prereg: CLERK.readPrereg(dirname(DB_PATH)) });
    const md = ER.evidenceReportMarkdown(rep);
    if (flags.json) console.log(JSON.stringify(rep, null, 2));
    else console.log(md);
    if (flags.report && flags.report !== true) { CLERK.writeReport(flags.report, md); console.log('\n보고서 (입법 서기): ' + flags.report); }
    break;
  }
  case 'verify-collection': { // 수집 작업 검증 (작업 검증 설계): 핸드오프 JSONL → 구조·구별·형식·재사용 db 존재 판정 (읽기만, db 불변). 작업자 자기선언 무시 — 판정기가 완료를 정함
    if (!args[0]) die('사용법: verify-collection <핸드오프.jsonl> [--json]');
    const CA = req('./judicial/collection_audit.js'), db = loadDB();
    const lines = readFileSync(args[0], 'utf8').split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('//'));
    const objs = lines.map((s, i) => { try { return JSON.parse(s); } catch (e) { die(`${i + 1}행이 JSON 이 아님: ${e.message}`); } });
    const entries = objs.filter((o) => o && typeof o === 'object' && !('_task' in o) && !('_meta' in o)); // _task/_meta 줄은 메타
    let sourceChecks;
    if (flags['check-sources']) { // 로컬 수신함 대조만 — 네트워크·child_process 금지(governance ①). 실제 받기는 sanctioned 고리(augment fetch)
      sourceChecks = {};
      const epDir = join(dirname(DB_PATH), 'fetched', 'europepmc');
      for (const s of CA.sourcesOf(entries)) {
        if (sourceChecks[s.key] != null) continue;
        // 수신함(sanctioned 받기 고리가 채운다)에 있으면 confirmed, 없으면 통합가가 augment fetch 로 1차 출처 가져와 확인
        if (s.db === 'PMID') sourceChecks[s.key] = existsSync(join(epDir, `MED-${s.id}.json`)) ? 'resolves' : 'error';
        else sourceChecks[s.key] = 'error'; // DOI 등은 수신함으로 로컬 확인 불가 → 통합가 재확인
      }
    }
    const res = CA.auditCollection(db, entries, { sourceChecks });
    if (flags.json) console.log(JSON.stringify(res, null, 2));
    else console.log(CA.auditText(res));
    if (res.verdict === 'REJECTED' || res.verdict === 'INCOMPLETE' || res.verdict === 'BLOCKED') process.exitCode = 1; // PASS·REVIEW_REQUIRED 는 0
    break;
  }
  case 'verify-run': { // 실행 기록 대조 (작업 검증 #1): 서브에이전트 transcript 의 실제 도구 호출 vs 핸드오프 주장 (읽기만, best-effort)
    if (!args[0]) die('사용법: verify-run <transcript.output> --handoff <핸드오프.jsonl>  (실행 기록은 harness 가 찍은 것·내 세션 서브에이전트 한정·형식 미보장)');
    const CA = req('./judicial/collection_audit.js');
    const stats = CA.parseRunlog(readFileSync(args[0], 'utf8'));
    let entries = [];
    if (flags.handoff && flags.handoff !== true) {
      entries = readFileSync(flags.handoff, 'utf8').split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('//'))
        .map((s) => { try { return JSON.parse(s); } catch { return null; } }).filter((o) => o && !('_task' in o) && !('_meta' in o));
    }
    const issues = CA.crossCheckRun(entries, stats);
    console.log(`실행 기록: 도구 호출 ${stats.uses} · WebFetch ${stats.tools.WebFetch} · WebSearch ${stats.tools.WebSearch} · Read ${stats.tools.Read}`);
    console.log(issues.length ? issues.map((x) => `  · (${x.sev}) ${x.msg}`).join('\n') : '  주장과 실행 기록에 뚜렷한 모순 없음 (best-effort — 과정 완전 증명 아님)');
    break;
  }
  case 'log': { // 델타 기록 (S1): --genesis 기원 체크포인트 봉인(한 번) · 기본 = 사슬 무결성 + 재생 일치 판정
    const dataDir = dirname(DB_PATH);
    if (flags.genesis) {
      const db = loadDB(), r = ORCH.validateWithRegistry(db, HERE);
      printIssues(r.errors, r.warnings);
      if (r.errors.length || r.attestations.failed.length) die('검사를 통과하지 못한 db 는 기원으로 봉인하지 않는다');
      const seal = ATT.sealVerdict({ ok: true, errors: [], warnings: r.warnings }, db, { issuer: 'judicial/judicial.js#validate (기원)' });
      const g = CLERK.sealGenesis({ dbPath: DB_PATH, db, seal, note: flags.note && flags.note !== true ? flags.note : '' });
      console.log(`기원 체크포인트 (입법 서기): db sha256 ${g.db_sha256.slice(0, 12)}…, 루트 ${g.root.slice(0, 12)}… — 이후 병합은 data/log/events.jsonl 에 사건으로 추가된다`);
      break;
    }
    const log = CLERK.readLog(dataDir);
    if (!log) die('기원 체크포인트가 없음 — node dbtool.mjs log --genesis');
    const v = ORCH.replayLog(log, readFileSync(DB_PATH, 'utf8'));
    console.log(req('./judicial/log_audit.js').logText(v));
    process.exit(v.ok ? 0 : 1);
  }
  case 'attest': {
    // 증명 등록부 검사: 도장마다 digest(변조)·증거 파일 sha256·같은 확인 재실행 — 사법부 판정만, 쓰기 없음
    const db = loadDB(), reg = ATT.readRegistry(HERE), v = ATT.validStamps(db, reg, { root: HERE, reverify: !flags.quick });
    for (const k of v.keys) console.log(`  ✓ ${k}`);
    for (const f of v.failed) console.log(`  ✗ ${f.key}: ${f.reasons.join(' · ')}`);
    for (const f of v.stale || []) console.log(`  · 지난 도장 ${f.key}: ${f.reasons.join(' · ')}`);
    // 추세 도장(claim 'trend')은 다른 주장이므로 사법부의 추세 모듈이 검증한다 — 창을 넘긴 것은 무효가 아니라 '만료'
    let tbad = 0;
    if (v.trend.length) {
      const tv = TR.verdicts(db, reg, { root: HERE });
      for (const st of v.trend) {
        const r = TR.verifyTrendStamp(st, db, { root: HERE, registry: reg });
        if (r.ok) console.log(`  ✓ ${r.key} (추세 ${st.verdict}, ${st.issued_at})`);
        else if (r.stale) console.log(`  · 지난 추세 도장 ${r.key}: ${r.reasons.join(' · ')}`);
        else { console.log(`  ✗ ${r.key}: ${r.reasons.join(' · ')}`); tbad++; }
      }
      for (const e of tv.expired) console.log(`  ⌛ 만료 ${e.key}: 점검 ${e.age}일 전 > 합의 창 ${tv.window}일 — 다시 받아 점검할 것`);
      console.log(`— 추세 도장 ${v.trend.length}: 유효 ${Object.keys(tv.map).length}, 만료 ${tv.expired.length}, 무효 ${tbad}`);
    }
    console.log(`— 증명 도장 ${reg.stamps.length - v.trend.length}: 유효 ${v.keys.length}, 무효 ${v.failed.length}${(v.stale || []).length ? `, 지난 도장 ${v.stale.length} (데이터에서 빠진 주체 — 계보 기록)` : ''}`);
    process.exit(v.failed.length + tbad ? 1 : 0);
  }
  case 'trend': {
    // 추세 점검 (사법부 judicial/trend.js): 더 새 원본에 같은 확인을 다시 돌려 합의와 같은지 — 받기·등록부 쓰기는 입법 서기
    const db = loadDB(), reg = ATT.readRegistry(HERE), dir = flags.dir || TR.CONSENSUS; // 저장소 최상위 기준 (도장의 증거 경로가 상대 경로여야 재검증된다)
    if (flags.fetch) {
      const tasks = TR.plan(db, { dir, registry: reg, root: HERE });
      const res = CLERK.fetchToInbox(tasks, { refetch: !!flags.refetch });
      const ok = res.filter((r) => r.ok).length;
      console.log(`합의 수신함 (입법 서기): 과제 ${tasks.length}, 받음 ${ok}, 실패 ${res.length - ok}`);
      for (const r of res.filter((x) => !x.ok)) console.log(`  ✗ ${r.task.sense} ${r.task.kind} ${r.task.key}: ${r.error}`);
    }
    const r = TR.check(db, { dir, registry: reg, root: HERE });
    const target = args[0] ? DefDB.resolveRef(DefDB.index(db), args[0]) : null;
    if (target && target.error) die(target.error);
    const pick = target ? { ...r, rows: r.rows.filter((x) => x.sense === target.id), n: r.rows.filter((x) => x.sense === target.id).length } : r;
    console.log(TR.text(pick, { all: !!flags.all || !!target, limit: +(flags.limit || 60) }));
    const cand = TR.gapCandidates(db, r.rows);
    if (cand.length) {
      console.log('', `## 등록되지 않은 Consensus_Gap 후보 ${cand.length}`, '');
      for (const c of cand) console.log(`  · ${c.target} ${c.type}: ${c.why}`);
      console.log('', '한계로 등록할 것 (값은 지우지 않는다 — 지난값은 비교에 쓴다).');
    }
    if (flags.write) {
      const stamps = TR.issue(r.rows, new Date().toISOString().slice(0, 10));
      if (!stamps.length) die('기록할 추세 도장이 없음 — 먼저 `trend --fetch` 로 더 새 원본을 받을 것');
      const f = CLERK.appendAttestations({ root: HERE, stamps, db });
      console.log(`추세 도장 ${stamps.length} 기록 (입법 서기): ${rel(f)}`);
    }
    process.exit(cand.length ? 1 : 0);
  }
  case 'compare': {
    // 비교 검토 (프로토콜 §5): 기준(A) 대 제안(B = 패치 적용 db 와/또는 다른 시나리오) — 실행은 조정자가, 판정은 사법부(judicial/compare.js)
    if (!flags.state || !flags.scenario) die('사용법: compare --state <세포 상태> --scenario A.json [--scenario-b B.json] [--patch p.json] [--hours h] [--ref-hours h]');
    const CMP = req('./judicial/compare.js');
    const dbA = loadDB(), x = DefDB.resolveRef(DefDB.index(dbA), flags.state); if (x.error) die(x.error);
    let dbB = dbA;
    if (flags.patch) { const res = LEG.ingest(dbA, readJSON(flags.patch)), g = J.gate(dbA, res, { attestations: attestations(dbA).keys }); printIssues(g.errors, g.warnings); if (g.errors.length) die('패치가 관문을 통과하지 못함'); dbB = res.db; }
    const scA = loadScenario(flags.scenario, x.id, dbA).scenario, scB = flags['scenario-b'] ? loadScenario(flags['scenario-b'], x.id, dbA).scenario : JSON.parse(JSON.stringify(scA));
    if (flags.hours) { scA.t_end = +flags.hours * 3600; scB.t_end = +flags.hours * 3600; }
    const r = ORCH.compare(dbA, dbB, x.id, scA, scB, { refHours: +(flags['ref-hours'] || 3) });
    console.log(CMP.compareText(r));
    process.exit(r.verdict === 'Optimization-Negative' ? 1 : 0);
  }
  case 'fate': {
    if (!args[0] || !flags.scenario) die('사용법: fate <세포 상태 번호|이름> --scenario s.json [--t 시간(h)] [--no-commitment] [--brief] [--report 파일.md] [--numerics 시간(h), 0 이면 끔]');
    const db = loadDB(), x = DefDB.resolveRef(DefDB.index(db), args[0]);
    if (x.error) die(x.error);
    const FATE = req('./engine/fate_engine.js'), FA = req('./judicial/fate_audit.js'), PR = req('./judicial/process_report.js');
    const loaded = loadScenario(flags.scenario, x.id, db), scenarioText = loaded.text, scenario = JSON.parse(scenarioText);
    if (flags.t) scenario.t_end = +flags.t * 3600;
    const opt = { scenario, commitment: flags['no-commitment'] ? false : undefined, engine: flags.engine && flags.engine !== true ? flags.engine : 'rust', workers: flags.workers != null && flags.workers !== true ? +flags.workers : undefined };
    if (flags.brief) { const r = ORCH.fateBrief(db, x.id, opt); console.log(r.text); console.log(J.refineText(db).text); process.exit(r.code); }
    if (flags.ensemble) { // 4단계 ④·⑤: 확률 앙상블 — 실행은 조정자(행정부), 판정은 사법부(stoch_audit)
      const SA = req('./judicial/stoch_audit.js'), n = +flags.ensemble;
      if (!scenario.stochastic) die('--ensemble 에는 시나리오 stochastic { seed } 가 필요함 (seed 는 실행 전에 — 입력 해시)');
      const raws = ORCH.runEnsemble(db, x.id, scenario, n, { engine: opt.engine, commitment: false });
      if (raws.error) die(raws.error);
      const audits = raws.map((r) => SA.auditTrajectory(db, r, { scenario })), bad = audits.flatMap((a, i) => (a.error ? [{ i, msg: a.error }] : a.audit.filter((z) => z.fault === 'ENGINE_DEFECT' || z.fault === 'COMPILER_DEFECT').map((z) => ({ i, msg: `[${z.code}] ${z.where}: ${z.msg}` }))));
      const rep0 = SA.reproducible(raws[0], ORCH.runEnsemble(db, x.id, scenario, 1, { engine: opt.engine, commitment: false })[0]);
      const { stochastic, ...detSc } = scenario, det = FATE.simulateFate(db, x.id, { scenario: detSc, engine: opt.engine, commitment: false });
      const sum = SA.ensembleSummary(raws), L = (s) => { const t = db.terms[(db.senses[s] || {}).term]; return t ? `${s} ${t.names.ko}` : s; };
      console.log(`# 앙상블 판정 — ${scenario.name || flags.scenario} (seed ${stochastic.seed}, ${n} 궤적, ${opt.engine})`, '');
      console.log(SA.ensembleText(sum).replace(/\| (D\d{6}) \|/g, (m0, s) => `| ${L(s)} |`), '');
      console.log('| 무결성 | 결과 |', '|---|---|');
      console.log(`| 궤적별 원장·재생·음수·발화 정수 (사법부) | ${bad.length ? `**FAIL** ${bad.length}건 — ${bad.slice(0, 3).map((b) => `궤적 ${b.i}: ${b.msg}`).join(' · ')}` : `PASS (${n}/${n})`} |`);
      console.log(`| seed 재현 (궤적 0 다시) | ${rep0.ok ? 'PASS' : '**FAIL**'} (${rep0.a.slice(0, 12)}) |`);
      console.log(`| 결정론 대비 | 결정론 끝 상태 ${det.final.state ? L(det.final.state) : '없음'}${Object.entries(det.firstReach).filter(([s]) => s !== det.source).map(([s, t]) => ` · 도달 ${L(s)} ${(t / 3600).toFixed(2)} h`).join('')} |`);
      console.log(`| 상수 | ${scenario.hypothetical ? '**가상 값** — 분포는 기전이 그 값에서 어떻게 흔들리는지를 말할 뿐 실제 세포의 비율을 예측하지 않는다' : '데이터·시나리오 값'} |`);
      process.exit(bad.length || !rep0.ok ? 1 : 0);
    }
    const r = ORCH.runFate(db, x.id, opt); // 행정부 원자료 → 사법부 판결된 보기
    if (r.error) die(r.error);
    // 결정론: 같은 입력으로 본 실행을 다시 (결정 탐침 없이 — 본 실행 궤적은 탐침과 무관) — 해시는 사법부가 계산
    const again = FA.trajectoryHash(FATE.simulateFate(db, x.id, { ...opt, scenario: JSON.parse(scenarioText), commitment: false })); // 같은 엔진으로 다시
    // 수치 확인: 처음 h 시간을 수렴 기준(같은 적분기, 허용 오차 1/1000 — 조정자 refScenario)과 비교
    const nh = flags.numerics != null && flags.numerics !== true ? +flags.numerics : 1;
    let numerics = null;
    if (nh > 0 && !scenario.stochastic) { // 확률 실행은 수렴 기준과 경로가 달라 L2 가 의미 없음 — 결정론 극한·방식 비교는 앙상블 판정(stoch_audit)
      const s2 = { ...JSON.parse(scenarioText), t_end: Math.min(r.t_end, nh * 3600) }, t0 = Date.now();
      const ref = FATE.simulateFate(db, x.id, { scenario: ORCH.refScenario(s2), commitment: false, engine: opt.engine }), refMs = Date.now() - t0;
      numerics = { hours: s2.t_end / 3600, l2: FA.markerL2(r, ref), refMs };
    }
    const protocol = req('./judicial/protocol.js').protocolVerdict(db, JSON.parse(scenarioText), { prereg: CLERK.readPrereg(dirname(DB_PATH)), runAt: new Date().toISOString() });
    const rep = PR.processReport(r, { scenario: JSON.parse(scenarioText), scenarioText, dbText: readFileSync(DB_PATH, 'utf8'), rerunHash: again, numerics, protocol });
    const md = PR.processReportMarkdown(rep);
    console.log(md);
    console.log(J.refineText(db).text);
    if (flags.report && flags.report !== true) { CLERK.writeReport(flags.report, md); console.log('보고서 (입법 서기): ' + flags.report); }
    process.exit(rep.pass ? 0 : 1);
  }
  case 'observe': { // 관찰 포트 (4단계 ②): 판정만 — 관찰을 데이터베이스에 넣는 것은 패치(observations)·관문·서기
    const db = loadDB(), K = req('./judicial/contract.js'), OC = req('./judicial/obs_compare.js');
    if (!args[0] || !flags.state || !flags.scenario) die('사용법: observe <O…|관찰.json> --state <세포 상태> --scenario A.json [--scenario-b B.json] [--n 50]');
    let o;
    if (/^O\d{6}$/.test(args[0])) { o = db.observations[args[0]]; if (!o) die(`관찰 기록 ${args[0]} 없음`); }
    else {
      const rawO = readJSON(args[0]), shape = K.checkObservation(rawO);
      if (!shape.ok) die('관찰 계약 위반 (schemas/obs/observation.schema.json):\n' + shape.violations.map((v) => `  ${v.path}: ${v.msg}`).join('\n'));
      o = DefDB.normalize({ ...db, observations: { O999999: rawO } }).observations.O999999;
      const E = [], ix = DefDB.index(db); J.validateObservation(db, ix, 'O999999', o, (w, msg) => E.push(msg), () => {});
      const real = E.filter((m) => !/합성\(hypothetical\)/.test(m));
      if (real.length) die('관찰 의미 검사 실패:\n' + real.map((m) => '  ' + m).join('\n'));
      if (o.hypothetical) console.log('※ 합성(hypothetical) 관찰 — 판정 시험용. 데이터베이스에는 넣을 수 없다.\n');
    }
    const x = DefDB.resolveRef(DefDB.index(db), flags.state); if (x.error) die(x.error);
    const scA = loadScenario(flags.scenario, x.id, db).scenario, scB = flags['scenario-b'] && flags['scenario-b'] !== true ? loadScenario(flags['scenario-b'], x.id, db).scenario : null;
    if (o.kind === 'qualitative') { // 정성 모의 판정 (build-plan 8): 교란은 관찰이 선언, 대조군 = --scenario
      const QC = req('./judicial/qual_compare.js'), oid = /^O\d{6}$/.test(args[0]) ? args[0] : null;
      const q = ORCH.observeQualitative(db, o, x.id, scA, { n: flags.n && flags.n !== true ? +flags.n : undefined, prereg: CLERK.readPrereg(dirname(DB_PATH)), observationId: oid });
      if (q.error) die('오류: ' + q.error);
      console.log(req('./judicial/protocol.js').protocolText(q.protocol) + '\n');
      console.log(QC.qualCompareText([Object.assign(q, { id: oid || '(파일)' })], QC.chanceBaseline([q])));
      process.exit(q.outcome === 'invalid' ? 1 : 0);
    }
    const v = ORCH.observeFate(db, o, x.id, scA, scB, { n: flags.n && flags.n !== true ? +flags.n : undefined, prereg: CLERK.readPrereg(dirname(DB_PATH)), observationId: /^O\d{6}$/.test(args[0]) ? args[0] : null });
    console.log(req('./judicial/protocol.js').protocolText(req('./judicial/protocol.js').protocolVerdict(db, scA, { prereg: CLERK.readPrereg(dirname(DB_PATH)), runAt: new Date().toISOString() })) + '\n');
    console.log(OC.verdictText(v));
    process.exit(v.error ? 1 : 0);
  }
  case 'prompt': {
    console.log(DefDB.promptText(loadDB(), { material: args[0] ? readFileSync(args[0], 'utf8') : '' }));
    break;
  }
  default:
    die('명령: status | validate | merge | map | audit | vocab | context | mechanism | simulate | fate | observe | compare | augment | attest | trend | resolution | audit-run | pattern | limitations | textbook | grade | report | log | register | qualgraph | retraction | evidence | verify-collection | verify-run | prompt  (형식 변환은 migrations/, 파일 맨 위 주석 참고)');
}

// ===== 교과서 부록 생성 (결정적: 같은 코드·데이터면 같은 결과) =====
function textbookAppendix(db, map) {
  const V = DefDB.VOCAB, ix = DefDB.index(db), out = [], cell = (x) => String(x == null ? '' : x).replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const T = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`)];
  out.push('# 부록 — 자동 생성 (지금 값)', '', '> `node dbtool.mjs textbook --write` 로 만든다. 손으로 고치지 말 것. CI 가 `--check` 로 최신인지 본다.', '');
  // 1. 규모
  const senses = Object.values(db.senses), rules = senses.flatMap((d) => d.rule), sites = senses.flatMap((d) => Object.values(d.site));
  const byKind = {}; for (const d of senses) byKind[d.kind] = (byKind[d.kind] || 0) + 1;
  const ev = {}; for (const d of senses) for (const x of [...d.desc, ...d.rule, ...d.obs]) ev[x.evidence.level] = (ev[x.evidence.level] || 0) + 1;
  const lim = Object.values(db.limitations).map((l) => [l.type, J.limitationStatus(db, l).status]);
  out.push('## 9.1 규모', '', ...T(['항목', '값'], [
    ['형식 버전', db.version], ['개념 T', Object.keys(db.terms).length], ['정의항 D', senses.length], ['기전 단계 S', Object.keys(db.steps).length], ['한계 L', lim.length],
    ['다음 번호 (meta.next)', Object.entries(db.meta.next).map(([k, v]) => `${k}${String(v).padStart(6, '0')}`).join(' ')],
    ['정의항 종류별', Object.entries(byKind).sort().map(([k, n]) => `${k} ${n}`).join(', ')],
    ['부위 / 구조 참조(R2) 있는 부위', `${sites.length} / ${sites.filter((x) => x.structure).length}`],
    ['규칙 (상태 의미 / 전이 / 속도 상수 있음)', `${rules.filter((r) => r.type === 'meaning').length} / ${rules.filter((r) => r.type === 'transition').length} / ${rules.filter((r) => r.kinetics).length}`],
    ['관찰(obs)', senses.reduce((n, d) => n + d.obs.length, 0)],
    ['근거 수준 (설명·규칙·관찰)', Object.entries(ev).sort().map(([k, n]) => `${k} ${n}`).join(', ')],
    ['한계 (종류: 열림/전체)', Object.keys(V.gapTypes).map((t) => `${t} ${lim.filter(([a, b]) => a === t && b === 'open').length}/${lim.filter(([a]) => a === t).length}`).join(', ')],
    ['상위 개념(motif)', senses.filter((d) => d.motif).length],
  ]), '');
  // 2. 경로
  out.push('## 9.2 경로 (단계·패턴·해상도)', '');
  const prow = [];
  for (const [pid, d] of ix.senses) if (d.kind === 'pathway') {
    const st = ix.stepsIn(pid); if (!st.length) continue;
    const m = DefDB.findMotifs(db, pid, ix), rp = ORCH.resolutionPlan(db, pid);
    const need = [0, 1, 2].map((n) => rp.rows.filter((r) => r.need === n).length);
    prow.push([`${pid} ${ix.label(pid)}`, st.length, m.trajectory.join(' → '), Object.keys(m.found).join(', '), `R0 ${need[0]} · R1 ${need[1]} · R2 ${need[2]}`]);
  }
  out.push(...T(['경로', '단계', '위치 궤적', '찾은 패턴', '필요 해상도'], prow), '');
  // 3. 저장 지도
  out.push('## 9.3 저장 지도 (docs/textbook/storage-map.json)', '');
  const Z = (map.zones || {}).enum || {}, zoneOf = (f) => f.zone || map.classes[f.class].zone;
  out.push('### 저장 구역 (용광로)', '', (map.zones || {})._설명 || '', '', ...T(['구역', '뜻', '분류', '덮어쓴 파일'], Object.entries(Z).map(([z, t]) => [z, t, Object.entries(map.classes).filter(([, c]) => c.zone === z).map(([k]) => `\`${k}\``).join(' · ') || '—', map.files.filter((f) => f.zone === z).map((f) => `\`${f.path}\``).join(' · ') || '—'])), '');
  for (const [k, c] of Object.entries(map.classes)) {
    const fs = map.files.filter((f) => f.class === k); if (!fs.length) continue;
    out.push(`### ${c.label} (\`${k}\` · 구역 ${c.zone})`, '', c.rule, '', ...T(['경로', '형식', '쓰는 쪽', '읽는 쪽', '해석'], fs.map((f) => [`\`${f.path}\`${f.zone ? ` (구역 ${zoneOf(f)})` : ''}`, f.format, f.writer, f.readers, f.interpret])), '');
  }
  out.push('### 아키텍처 노드 (삼권 분립 — 고칠 때 노드의 전략을 따른다)', '', (map.governance || {}).rule || '', '', ...T(['노드', '경로', '권한', '고치는 전략'], map.files.filter((f) => f.node).map((f) => [f.node, `\`${f.path}\``, f.governance, f.refactor_strategy])), '');
  // 4. 식별자
  out.push('## 9.4 식별자 문법', '', ...T(['형태', '예', '뜻'], [
    ['T + 6자리', 'T000042', '개념(피정의항, 이름 묶음)'], ['D + 6자리', 'D000044', '정의항(뜻, 원천)'], ['S + 6자리', 'S000009', '기전 단계'], ['L + 6자리', 'L000004', '한계'], ['O + 6자리', 'O000001', '관찰 기록 (v10 — 바뀌지 않음, 철회 표시만)'],
    ['D…/site/키', 'D000044/site/reg_phos', '정의항이 소유한 부위'], ['D…/rule/키', 'D000085/rule/ikba_s32', '정의항이 소유한 규칙'], ['D…/desc/n · D…/obs/n', 'D000044/desc/1', '설명·관찰 (1부터)'],
    ['D…|부위:특징|…|위치', 'D000044|reg_phos:phosphorylated|cytosol', '묶음 — 번호가 아닌 파생 키, 부위 이름순 정렬'],
    ['임시 번호 (패치 안에서만)', 'T+1, D+gp, S+1, L+1, O+1', '병합 때 실제 번호로 바뀜'], ['이름 주소', '효소#2', '개념 안 뜻 번호'],
  ]), '', `예약 문자(이름에 금지): \`# @ | /\` · 부위·규칙 키 형식: \`${V.siteKeyPattern}\` · 잔기 형식: \`${V.residuePattern}\``, '');
  // 5. 어휘
  out.push('## 9.5 통제 어휘 (vocab.js)', '');
  const vt = { kinds: 'kind', fields: '분야', locations: '위치', faces: '막 면', associations: '막 결합 방식', siteTypes: '부위 종류', features: '특징', actions: '변화 종류', activity: '활성', effects: '조절 효과', taxa: '종', tissues: '조직', cells: '세포', obsProperties: '관찰 속성', evidenceLevels: '근거 수준', gapTypes: '한계 종류', kineticLaws: '속도 법칙', resolutionLevels: '해상도', resolutionThresholds: '전환 문턱', observables: '측정량 (관찰 기록 v10)', uncertaintyKinds: '불확도 유형', noiseModels: '잡음 모형', calibrationKinds: '보정 종류', obsUses: '관찰 용도' };
  for (const [t, name] of Object.entries(vt)) {
    out.push(`### ${name} (\`${t}\`)`, '', ...T(['키', '이름', '세부'], Object.entries(V[t]).map(([k, v]) => [k, v.label || v.name || '', [
      v.aliases && v.aliases.length ? '별칭 ' + v.aliases.join(', ') : '', v.dim ? `${v.dim}${v.parent ? ' ⊂' + v.parent : ''}${v.sides ? ' 면 ' + Object.entries(v.sides).map(([a, b]) => a + '→' + b).join(', ') : ''}` : '',
      v.effects ? `효과 ${v.effects.join('/')}${v.adds ? ' +' + v.adds : ''}${v.removes ? ' −' + v.removes : ''}` : '', v.species ? `종 ${v.species}` : '', v.participant ? '기전 참여' : '',
      v.xref && v.xref.required && v.xref.required.length ? `필수 ID ${v.xref.required.join(', ')}` : '', v.required ? `필수 ${v.required.join(', ')}` : '', v.requires ? `필요 ${v.requires}` : '',
      v.value ? `값 ${Array.isArray(v.value) ? v.value.join('/') : v.value}${v.speciesRequired ? ', 종 필수' : ''}` : '', v.up ? `→ ${v.up}` : '', v.when || v.note || '', v.parent && !v.dim ? `상위 ${v.parent}` : ''].filter(Boolean).join(' · ')])), '');
  }
  out.push('### 외부 ID 형식 (`xrefs`)', '', ...T(['종류', '형식(정규식)'], Object.entries(V.xrefs).map(([k, v]) => [k, '`' + v.pattern + '`'])), '');
  // 6. 엔진 상수
  out.push('## 9.6 엔진 상수 (model.js·core.js)', '', ...T(['이름', '값'], [
    ['효과 종류 EFFECT_TYPES', DefDB.EFFECT_TYPES.join(', ')], ['동일성 보존 검사 효과 CONSERVING', [...DefDB.CONSERVING].join(', ') + ' (+ partner 가 있는 modify)'],
    ['속도 상수 필드 KIN_FIELDS', DefDB.KIN_FIELDS.join(', ')], ['정의항 필드 SENSE_FIELDS', DefDB.SENSE_FIELDS.join(', ')],
    ['관계 REL', Object.entries(DefDB.REL).map(([k, v]) => `${k}(${v.label})`).join(', ')],
    ['패턴 MOTIFS', Object.entries(DefDB.MOTIFS).map(([k, v]) => `${k}(${v.label})`).join(', ')],
  ]), '');
  const CPL = req('./engine/coupling.js');
  out.push('### 수치 결합점 (engine/coupling.js — 시나리오 → 데이터(params) → 기본값)', '', ...T(['열쇠', '시나리오 경로', '기본값', '단위', '층', '뜻'], CPL.REGISTRY.map((e) => [e.key, e.scenario, e.default, e.unit, e.layer, e.meaning])), '');
  out.push('### 감사 코드 (사법부가 판정 — judicial/)', '', ...T(['코드', '뜻'], [
    ['AUDIT_SCHEMA', '저장소 검사(validate) 오류'], ['AUDIT_RESOLUTION', '필요 해상도 > 갖춘 해상도, 또는 2D 를 3D 농도로 환산'], ['AUDIT_KINETIC', '속도 무결성(법칙·상수·Kd=k_off/k_on·차수·평형) 위반'],
    ['AUDIT_KINETIC_GAP', '속도 상수가 없어 즉시(사건 기반)로 처리한 단계'], ['AUDIT_CONCENTRATION', '반응 부피를 몰라 농도 계산 불가'], ['AUDIT_MASS', '질량·동일성·부분 구조 보존 위반 — 단계 국소(첫 발화 시각)·매 Δt 전역 (분해·재활용·공급 원장, 무한 풀이면 교환 반영)'],
    ['AUDIT_RESOURCE', '재생 경로 없는 저장소(소비만), 재활용 화학량(서열 길이)을 모름, 사후 분석(정지 원인·제한 요인)'],
    ['AUDIT_THERMO', '닫힌 고리의 ΣΔG° ≠ 0 (Wegscheider·미시적 가역성 위반)'],
  ]), '');
  // 7. 명령
  const cmds = readFileSync(join(HERE, 'dbtool.mjs'), 'utf8').split('\n').filter((l) => l.startsWith('//   node dbtool.mjs') || /^\/\/\s{20,}\S/.test(l)).map((l) => l.replace(/^\/\/\s?/, ''));
  out.push('## 9.7 명령 (dbtool.mjs 머리 주석)', '', '```', ...cmds, '```', '');
  return out.join('\n');
}
