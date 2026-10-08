#!/usr/bin/env node
// 데이터베이스 명령줄 도구 — AI 에이전트(Claude Code 등)가 직접 읽고 쓰기 위한 진입점.
// 기본 저장소는 data/db.json 이다. 다른 파일을 쓰려면 --db <경로>.
//
//   node dbtool.mjs status                                  저장소 요약
//   node dbtool.mjs validate                                전체 검사 (오류 있으면 종료 코드 1)
//   node dbtool.mjs merge     <patch.json...> [--dry] [--allow-warnings]
//                                                           매핑 → 검사 → 관문 통과 시 저장, 적용한 패치는 data/patches/ 에 기록
//   node dbtool.mjs map       <번호|이름|이름#n|외부ID|지문>   참조가 어느 정의항(D…)으로 매핑되는지
//   node dbtool.mjs audit                                   매핑 현황 (외부 ID 대조 여부, 미매핑, 안 쓰인 상태)
//   node dbtool.mjs vocab     [표 이름]                     통제 어휘 보기 (kinds, fields, actions, compartments …)
//   node dbtool.mjs context   <번호|이름|이름#n> [--up N] [--down N]
//   node dbtool.mjs mechanism <S…|경로 번호·이름> [--up N] [--down N]
//   node dbtool.mjs prompt    [자료.txt]                     AI 에게 줄 작성 지침 + 현재 색인
//   node dbtool.mjs migrate   <bionote-v3.json...>          v3 개념 파일 → 패치 JSON (kind·field 는 채워야 병합됨)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DefDB = createRequire(import.meta.url)('./core.js');
const [cmd, ...rest] = process.argv.slice(2);
const flags = {}, args = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith('--')) { const k = rest[i].slice(2); flags[k] = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : true; }
  else args.push(rest[i]);
}
const DB_PATH = flags.db || join(HERE, 'data', 'db.json');
const PATCH_DIR = join(dirname(DB_PATH), 'patches');
const readJSON = (p) => DefDB.parseLoose(readFileSync(p, 'utf8'));
const loadDB = () => (existsSync(DB_PATH) ? DefDB.normalize(readJSON(DB_PATH)) : DefDB.emptyDB());
const rel = (p) => relative(process.cwd(), p) || p;
const printIssues = (errors, warnings) => {
  for (const e of errors) console.log(`오류  ${e.where}: ${e.msg}`);
  for (const w of warnings) console.log(`경고  ${w.where}: ${w.msg}`);
};
const die = (m) => { console.error(m); process.exit(1); };
const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);

switch (cmd) {
  case 'status': {
    const db = loadDB(), senses = Object.values(db.senses);
    const links = senses.reduce((n, d) => n + d.links.length, 0), states = senses.reduce((n, d) => n + d.states.length, 0);
    const r = DefDB.validate(db), nx = db.meta.next;
    console.log(`저장소 ${rel(DB_PATH)} (형식 v${DefDB.VERSION}): 개념 ${Object.keys(db.terms).length}, 정의항 ${senses.length}, 연결 ${links}, 상태 ${states}, 기전 단계 ${Object.keys(db.steps).length}, 오류 ${r.errors.length}, 경고 ${r.warnings.length}`);
    console.log(`다음 번호: T${String(nx.T).padStart(6, '0')} D${String(nx.D).padStart(6, '0')} S${String(nx.S).padStart(6, '0')}`);
    break;
  }
  case 'validate': {
    const r = DefDB.validate(loadDB());
    printIssues(r.errors, r.warnings);
    console.log(`— 오류 ${r.errors.length}, 경고 ${r.warnings.length}`);
    process.exit(r.errors.length ? 1 : 0);
  }
  case 'merge': {
    if (!args.length) die('사용법: merge <patch.json...> [--dry] [--allow-warnings]');
    let db = loadDB();
    const applied = [];
    for (const p of args) {
      const patch = readJSON(p);
      const res = DefDB.ingest(db, patch), g = DefDB.gate(db, res, { allowWarnings: !!flags['allow-warnings'] }), r = res.report;
      console.log(`${p}: 추가 ${r.added.length}, 수정 ${r.updated.length}, 삭제 ${r.removed.length}`);
      for (const [a, b] of Object.entries(r.idmap)) console.log(`  id   ${a} → ${b}`);
      for (const m of r.mapped) console.log(`  매핑 ${m.from} → ${m.to}  (${m.via})`);
      printIssues(g.errors, g.warnings);
      if (!g.ok) die(!g.changed ? '바뀐 것이 없음 — 저장하지 않았습니다.'
        : g.errors.length ? `오류 ${g.errors.length} — 패치를 거부했습니다. 위 메시지대로 패치를 고치세요.`
        : `패치가 새 경고 ${g.warnings.length}개를 만듦 — 거부했습니다. 고치거나 --allow-warnings 로 명시적으로 허용하세요.`);
      applied.push({ name: basename(p), patch, result: { added: r.added, updated: r.updated, removed: r.removed, mapped: r.mapped } });
      db = res.db;
    }
    if (flags.dry) { console.log('관문 통과 (--dry: 저장하지 않음)'); break; }
    mkdirSync(PATCH_DIR, { recursive: true });
    for (const a of applied) {
      const out = join(PATCH_DIR, `${stamp()}-${a.name}`);
      writeFileSync(out, JSON.stringify({ applied_at: new Date().toISOString(), result: a.result, ...a.patch }, null, 2) + '\n');
      console.log('기록: ' + rel(out));
    }
    writeFileSync(DB_PATH, JSON.stringify(db, null, 2) + '\n');
    console.log('저장: ' + rel(DB_PATH));
    break;
  }
  case 'map': {
    if (!args.length) die('사용법: map <번호|이름|이름#n|외부ID|지문>');
    const db = loadDB();
    for (const q of args) console.log(DefDB.mapText(db, q));
    break;
  }
  case 'audit': {
    console.log(DefDB.auditText(loadDB()));
    break;
  }
  case 'vocab': {
    const V = DefDB.VOCAB, tables = args.length ? args : ['kinds', 'fields', 'actions', 'compartments', 'activity', 'modifications', 'effects', 'xrefs'];
    for (const t of tables) {
      if (!V[t]) die(`어휘 표 '${t}' 없음`);
      console.log(`## ${t}`);
      for (const [k, v] of Object.entries(V[t])) console.log(`  ${k}${v.label ? ` — ${v.label}` : ''}${v.aliases && v.aliases.length ? `  (별칭: ${v.aliases.join(', ')})` : ''}${v.pattern ? `  형식: ${v.pattern}` : ''}`);
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
  case 'prompt': {
    console.log(DefDB.promptText(loadDB(), { material: args[0] ? readFileSync(args[0], 'utf8') : '' }));
    break;
  }
  case 'migrate': {
    if (!args.length) die('사용법: migrate <bionote-v3.json...>');
    console.log(JSON.stringify(DefDB.fromBionote(args.map(readJSON)), null, 2));
    break;
  }
  default:
    die('명령: status | validate | merge | map | audit | vocab | context | mechanism | prompt | migrate  (파일 맨 위 주석 참고)');
}
