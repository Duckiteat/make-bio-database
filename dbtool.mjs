#!/usr/bin/env node
// 데이터베이스 명령줄 도구 — AI 에이전트(Claude Code 등)가 직접 읽고 쓰기 위한 진입점.
// 기본 저장소는 data/db.json 이다. 다른 파일을 쓰려면 --db <경로>.
//
//   node dbtool.mjs status                                  저장소 요약
//   node dbtool.mjs validate                                전체 검사 (오류 있으면 종료 코드 1)
//   node dbtool.mjs merge     <patch.json...> [--dry] [--allow-warnings]
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
//   node dbtool.mjs audit-run <경로> [--scenario s.json] [--t 60] [--dt 0.001]
//                                                           감사: 스키마·해상도 일관성·속도 무결성·질량 보존 (Audit Error 가 있으면 종료 코드 1)
//   node dbtool.mjs simulate  <경로> --rate [--scenario s.json] [--t 60] [--dt 0.001]   속도 기반 시뮬레이션
//   node dbtool.mjs simulate  <경로> [--until D…] [--from D…] [--amount N] [--rounds N] [--init "묶음키=N;…"]
//                                                           경로의 단계를 규칙대로 발화시켜 목표 도달·유도 경로 확인 (도달 못 하거나 유도 안 되면 종료 코드 1)
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
    const sum = (f) => senses.reduce((n, d) => n + f(d), 0);
    const links = sum((d) => d.desc.reduce((m, x) => m + x.links.length, 0)), sites = sum((d) => Object.keys(d.site).length), rules = sum((d) => d.rule.length);
    const r = DefDB.validate(db), nx = db.meta.next;
    console.log(`저장소 ${rel(DB_PATH)} (형식 v${DefDB.VERSION}): 개념 ${Object.keys(db.terms).length}, 정의항 ${senses.length}, 연결 ${links}, 부위 ${sites}, 규칙 ${rules}, 관찰 ${sum((d) => d.obs.length)}, 기전 단계 ${Object.keys(db.steps).length}, 오류 ${r.errors.length}, 경고 ${r.warnings.length}`);
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
    const db = loadDB(), md = DefDB.limitationsMarkdown(db), file = join(HERE, 'limitations.md');
    if (flags.write) { writeFileSync(file, md); console.log('저장: ' + rel(file)); break; }
    if (flags.check) {
      const cur = existsSync(file) ? readFileSync(file, 'utf8') : '';
      if (cur !== md) die('limitations.md 가 data/db.json 과 다름 — node dbtool.mjs limitations --write');
      console.log('limitations.md 최신');
      break;
    }
    if (flags.detect) {
      const c = DefDB.detectGaps(db);
      console.log(c.length ? '등록되지 않은 한계 후보:\n' + c.map((x) => `  [${x.target} | ${x.type}] ${x.why}`).join('\n') : '등록되지 않은 한계 후보 없음');
      break;
    }
    console.log(DefDB.limitationsText(db, { open: !!flags.open }));
    break;
  }
  case 'pattern': {
    if (!args[0]) die('사용법: pattern <경로|상위 개념>');
    console.log(DefDB.patternText(loadDB(), args[0]));
    break;
  }
  case 'resolution': {
    if (!args[0]) die('사용법: resolution <경로>');
    console.log(DefDB.resolutionText(loadDB(), args[0]));
    break;
  }
  case 'audit-run': {
    if (!args[0]) die('사용법: audit-run <경로> [--scenario s.json]');
    const list = DefDB.auditRun(loadDB(), args[0], { scenario: flags.scenario ? readJSON(flags.scenario) : null, t_end: +(flags.t || 60), dt: +(flags.dt || 1e-3) });
    for (const a of list) console.log(`[${a.code}] ${a.where}: ${a.msg}\n    → 교정 제안: ${a.suggestion}`);
    console.log(`— Audit Error ${list.length}건`);
    process.exit(list.length ? 1 : 0);
  }
  case 'simulate': {
    if (flags.rate) {
      if (!args[0]) die('사용법: simulate <경로> --rate [--scenario s.json]');
      console.log(DefDB.simulateRateText(loadDB(), args[0], { scenario: flags.scenario ? readJSON(flags.scenario) : null, t_end: +(flags.t || 60), dt: +(flags.dt || 1e-3) }));
      break;
    }
    if (!args[0]) die('사용법: simulate <경로> [--until D…] [--from D…] [--amount N] [--rounds N] [--init "묶음키=N;…"]');
    const db = loadDB(), ix = DefDB.index(db), id = (r) => { if (!r || r === true) return undefined; const x = DefDB.resolveRef(ix, r); if (x.error) die(x.error); return x.id; };
    const init = {};
    for (const kv of String(flags.init || '').split(';').filter(Boolean)) { const i = kv.lastIndexOf('='); init[kv.slice(0, i).trim()] = +kv.slice(i + 1); }
    const opt = { until: id(flags.until), from: id(flags.from), amount: +(flags.amount || 10), rounds: +(flags.rounds || 60), init, cell: flags.cell && flags.cell !== true ? flags.cell : undefined };
    const txt = DefDB.simulateText(db, args[0], opt);
    console.log(txt);
    if (opt.until && (/✗/.test(txt))) process.exit(1);
    break;
  }
  case 'prompt': {
    console.log(DefDB.promptText(loadDB(), { material: args[0] ? readFileSync(args[0], 'utf8') : '' }));
    break;
  }
  default:
    die('명령: status | validate | merge | map | audit | vocab | context | mechanism | simulate | resolution | audit-run | pattern | limitations | prompt  (형식 변환은 migrations/, 파일 맨 위 주석 참고)');
}
