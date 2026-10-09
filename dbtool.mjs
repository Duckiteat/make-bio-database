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
//   node dbtool.mjs compare   --state <세포 상태> --scenario A.json [--scenario-b B.json] [--patch p.json] [--hours h] [--ref-hours h]
//                                                           비교 검토: 복잡도·수치 L2(수렴 기준)·결과·판정 (Optimization-Negative 이면 종료 코드 1)
//   node dbtool.mjs validate  <patch.json>                  패치 검사: 관문 미리 보기 + 정제 점검(중복 규칙·화학량 모순)
//   node dbtool.mjs fate      <세포 상태> --scenario s.json [--t 시간(h)] [--fine] [--no-commitment] [--brief] [--report 파일.md] [--numerics h]
//                                                           세포 운명 (v9) + 과정 분석 보고서: 요약 · 변곡점·시계열·구간 · 무결성 증명서(원장·재생·신호·결정론·출처) · 인과 추적 · 부록
//                                                           (무결성 FAIL 이면 종료 코드 1; --brief 는 짧은 요약)
//   node dbtool.mjs simulate  <경로> [--until D…] [--from D…] [--amount N] [--rounds N] [--init "묶음키=N;…"]
//                                                           경로의 단계를 규칙대로 발화시켜 목표 도달·유도 경로 확인 (도달 못 하거나 유도 안 되면 종료 코드 1)
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, basename, relative } from 'node:path';
import { tmpdir } from 'node:os';
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
// 속도 기반 시뮬레이션·감사 공용 옵션
const rateOpt = () => ({ scenario: flags.scenario ? readJSON(flags.scenario) : null, t_end: +(flags.t || 60), dt: +(flags.dt || 1e-3),
  reservoirs: typeof flags.reservoirs === 'string' ? flags.reservoirs : undefined, stochastic: flags.stochastic ? true : undefined, seed: flags.seed != null ? +flags.seed : undefined,
  until_death: flags['until-death'] ? true : undefined, window: flags.window != null ? +flags.window : undefined, death_frac: flags['death-frac'] != null ? +flags['death-frac'] : undefined });
const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);

switch (cmd) {
  case 'status': {
    const db = loadDB(), senses = Object.values(db.senses);
    const sum = (f) => senses.reduce((n, d) => n + f(d), 0);
    const links = sum((d) => d.desc.reduce((m, x) => m + x.links.length, 0)), sites = sum((d) => Object.keys(d.site).length), rules = sum((d) => d.rule.length);
    const r = DefDB.validate(db), nx = db.meta.next;
    console.log(`저장소 ${rel(DB_PATH)} (형식 v${DefDB.VERSION}): 개념 ${Object.keys(db.terms).length}, 정의항 ${senses.length}, 연결 ${links}, 부위 ${sites}, 규칙 ${rules}, 관찰 ${sum((d) => d.obs.length)}, 기전 단계 ${Object.keys(db.steps).length}, 한계 ${Object.keys(db.limitations).length}, 오류 ${r.errors.length}, 경고 ${r.warnings.length}`);
    console.log(`다음 번호: T${String(nx.T).padStart(6, '0')} D${String(nx.D).padStart(6, '0')} S${String(nx.S).padStart(6, '0')} L${String(nx.L).padStart(6, '0')}`);
    break;
  }
  case 'validate': {
    if (args[0]) { // 패치 검사: 관문 미리 보기 + 부분 구조 수지(ΣIn = ΣOut, 상대 1e-14 — validate 규칙) + 정제 점검의 새 문제
      const db = loadDB(), patch = readJSON(args[0]), res = DefDB.ingest(db, patch), g = DefDB.gate(db, res, {});
      printIssues(g.errors, g.warnings);
      const before = DefDB.refineCheck(db).issues.map((x) => x.type + x.where), ref = DefDB.refineCheck(res.db), fresh = ref.issues.filter((x) => !before.includes(x.type + x.where));
      for (const x of fresh) console.log(`  △ [${x.type}] ${x.msg}`);
      if (ref.refactor && fresh.some((x) => x.type === 'duplicate_rule')) console.log(`  → 리팩터링 패치 제안: ${ref.refactor.why}`);
      const bad = fresh.filter((x) => x.type === 'duplicate_rule' || (x.type === 'lumped_contradiction' && !x.known.length));
      console.log(`— 패치 ${args[0]}: 관문 ${g.ok ? '통과' : '거부'} (새 오류 ${g.errors.length}, 새 경고 ${g.warnings.length}) · 정제 점검 새 문제 ${fresh.length} (차단 ${bad.length})`);
      process.exit(g.ok && !bad.length ? 0 : 1);
    }
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
      const rep = DefDB.patchReport(db, res, patch, g);
      console.log(DefDB.patchReportText(rep, DefDB.index(res.db)));
      if (g.ok && !rep.why && !flags.dry) die('Patch Report: patch.why(변경 이유) 가 없음 — 거부했습니다. 패치 최상위에 "why": "…" 를 적으세요.');
      if (g.ok && rep.verification.undetected_gaps && !flags.dry) die(`Patch Report: 등록되지 않은 한계 후보 ${rep.verification.undetected_gaps}개 — limitations --detect 를 보고 같은 패치에 등록하세요.`);
      if (!g.ok) die(!g.changed ? '바뀐 것이 없음 — 저장하지 않았습니다.'
        : g.errors.length ? `오류 ${g.errors.length} — 패치를 거부했습니다. 위 메시지대로 패치를 고치세요.`
        : `패치가 새 경고 ${g.warnings.length}개를 만듦 — 거부했습니다. 고치거나 --allow-warnings 로 명시적으로 허용하세요.`);
      applied.push({ name: basename(p), patch, result: { added: r.added, updated: r.updated, removed: r.removed, mapped: r.mapped }, report: rep });
      db = res.db;
    }
    if (flags.dry) { console.log('관문 통과 (--dry: 저장하지 않음)'); break; }
    mkdirSync(PATCH_DIR, { recursive: true });
    for (const a of applied) {
      const out = join(PATCH_DIR, `${stamp()}-${a.name}`);
      writeFileSync(out, JSON.stringify({ applied_at: new Date().toISOString(), result: a.result, report: a.report, ...a.patch }, null, 2) + '\n');
      console.log('기록: ' + rel(out));
    }
    writeFileSync(DB_PATH, JSON.stringify(db, null, 2) + '\n');
    console.log('저장: ' + rel(DB_PATH));
    break;
  }
  case 'report': {
    // 기록된 패치의 Patch Report 다시 보기 (v7.1 이후 기록에만 report 가 있음)
    if (!args[0]) die('사용법: report <data/patches/….json>');
    const rec = readJSON(args[0]);
    if (!rec.report) die('이 기록에는 Patch Report 가 없음 (report 도입 이전 병합)');
    console.log(DefDB.patchReportText(rec.report, DefDB.index(loadDB())));
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
      process.exit(c.length ? 1 : 0); // CI: 미등록 공백(unmapped·속도 없는 공급/분해 …)이 있으면 실패
    }
    console.log(DefDB.limitationsText(db, { open: !!flags.open }));
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
    const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); if (['.git', 'node_modules'].includes(n)) return []; return statSync(p).isDirectory() ? walk(p) : [relative(HERE, p).split('\\').join('/')]; });
    const re = (g) => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$');
    const pats = map.files.map((f) => ({ f, re: re(f.path) }));
    const unclassified = walk(HERE).filter((p) => !pats.some((x) => x.re.test(p)));
    for (const f of map.files) if (!map.classes[f.class]) die(`storage-map: '${f.path}' 의 분류 '${f.class}' 가 classes 에 없음`);
    const md = textbookAppendix(loadDB(), map);
    if (flags.write) { mkdirSync(dir, { recursive: true }); writeFileSync(file, md); console.log('저장: ' + rel(file)); }
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
    console.log(DefDB.resolutionText(loadDB(), args[0]));
    break;
  }
  case 'audit-run': {
    // (rateOpt 는 아래 simulate 와 공용)
    if (!args[0]) die('사용법: audit-run <경로> [--scenario s.json]');
    const list = DefDB.auditRun(loadDB(), args[0], rateOpt());
    for (const a of list) console.log(`[${a.code}] ${a.where}: ${a.msg}\n    → 교정 제안: ${a.suggestion}`);
    console.log(`— Audit Error ${list.length}건`);
    process.exit(list.length ? 1 : 0);
  }
  case 'simulate': {
    if (flags.rate) {
      if (!args[0]) die('사용법: simulate <경로> --rate [--scenario s.json]');
      console.log(DefDB.simulateRateText(loadDB(), args[0], rateOpt()));
      console.log(DefDB.refineText(loadDB()).text);
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
  case 'augment': {
    const AUG = createRequire(import.meta.url)('./engine/augment.js');
    const sub = args[0] || 'plan', date = new Date().toISOString().slice(0, 10), dir = flags.dir && flags.dir !== true ? flags.dir : AUG.INBOX;
    const tasksMd = join(HERE, dir, 'RETRIEVAL_TASKS.md');
    const table = (tasks) => { for (const t of tasks) console.log(`  ${t.present ? '✓' : '·'} ${t.sense} ${t.label} — ${t.kind} ${t.key}: ${t.why}${t.gaps.length ? ` [${t.gaps.join(', ')}]` : ''}`); };
    if (sub === 'plan' || sub === 'fetch') {
      let tasks = AUG.plan(loadDB(), { dir });
      console.log(`자동 보강 과제 ${tasks.length}개 (수신함 ${dir}: 있음 ${tasks.filter((t) => t.present).length})`);
      let results = null;
      if (sub === 'fetch') {
        results = AUG.fetchTasks(tasks, { refetch: !!flags.refetch });
        const ok = results.filter((r) => r.ok && !r.cached).length, bad = results.filter((r) => !r.ok);
        console.log(`받음 ${ok} · 이미 있음 ${results.filter((r) => r.cached).length} · 실패 ${bad.length}${bad.length ? ` (${[...new Set(bad.map((r) => r.error))].join(' · ')})` : ''}`);
        tasks = AUG.plan(loadDB(), { dir }); // 검색 결과가 생기면 다음 단계 과제가 늘어난다
      }
      table(tasks);
      if (flags.write || sub === 'fetch') { mkdirSync(dirname(tasksMd), { recursive: true }); writeFileSync(tasksMd, AUG.retrievalTasksMarkdown(tasks, results, date)); console.log('수동 수집 과제: ' + rel(tasksMd) + (tasks.some((t) => !t.present) ? ` — 원본에 닿지 못한 ${tasks.filter((t) => !t.present).length}개는 이 파일대로 받아 수신함에 두고 'augment build'` : '')); }
      break;
    }
    if (sub === 'build' || sub === 'apply') {
      const db = loadDB(), drafted = args[1] ? readJSON(args[1]) : null;
      const b = drafted ? { patch: drafted, rows: [], empty: false } : AUG.build(db, { dir, sync: !!flags.sync, date });
      if (drafted && !drafted.why) die('초안 패치에 why 가 없음');
      const mark = { verified: '✓', rejected: '✗', ambiguous: '?', candidate: '→', missing: '·', unreadable: '!' };
      for (const r of b.rows) console.log(`  ${mark[r.outcome] || ' '} ${r.sense} ${r.label} [${r.kind} ${r.key}] ${r.outcome}: ${r.detail}`);
      if (b.empty) { console.log('바꿀 것이 없음 — 수신함 파일을 더하거나 (augment plan --write) 과제를 확인할 것'); process.exit(b.rows.some((r) => r.outcome === 'rejected') ? 1 : 0); }
      const out = flags.out && flags.out !== true ? flags.out : join(tmpdir(), `augment-${date}.json`);
      writeFileSync(out, JSON.stringify(b.patch, null, 2) + '\n');
      const res = DefDB.ingest(db, b.patch), g = DefDB.gate(db, res, {}), rep = DefDB.patchReport(db, res, b.patch, g);
      printIssues(g.errors, g.warnings);
      console.log(DefDB.patchReportText(rep, DefDB.index(res.db)));
      console.log('패치: ' + out);
      // 정제 점검: 이 패치가 만든 중복·등록되지 않은 화학량 모순은 병합을 막는다 (리팩터링 패치를 함께 제안)
      const before = DefDB.refineCheck(db).issues.map((x) => x.type + x.where), ref = DefDB.refineCheck(res.db), fresh = ref.issues.filter((x) => !before.includes(x.type + x.where));
      console.log(fresh.length ? ['정제 점검 — 이 패치가 만든 문제:', ...fresh.map((x) => `  △ [${x.type}] ${x.msg}`)].join('\n') : DefDB.refineText(res.db).text);
      if (fresh.some((x) => x.type === 'duplicate_rule' || (x.type === 'lumped_contradiction' && !x.known.length))) {
        if (ref.refactor) { const rp = join(tmpdir(), `refactor-${date}.json`); writeFileSync(rp, JSON.stringify(ref.refactor, null, 2) + '\n'); console.log('리팩터링 패치 제안: ' + rp); }
        die('정제 점검 — 중복 복잡도 또는 등록되지 않은 화학량 모순: 저장하지 않음 (Optimization-Negative)');
      }
      if (!g.ok) die('관문 거부 — 패치를 저장하지 않음');
      if (rep.verification.undetected_gaps) die(`등록되지 않은 한계 후보 ${rep.verification.undetected_gaps}개 — 저장하지 않음`);
      if (sub === 'build') { console.log(`관문 통과 — 병합하려면: node dbtool.mjs augment apply${flags.sync ? ' --sync' : ''}`); break; }
      mkdirSync(PATCH_DIR, { recursive: true });
      const recPath = join(PATCH_DIR, `${stamp()}-${drafted ? basename(args[1]).replace(/\.json$/, '') : 'auto-augmentation'}.json`), r = res.report;
      writeFileSync(recPath, JSON.stringify({ applied_at: new Date().toISOString(), result: { added: r.added, updated: r.updated, removed: r.removed, mapped: r.mapped }, report: rep, ...b.patch }, null, 2) + '\n');
      writeFileSync(DB_PATH, JSON.stringify(res.db, null, 2) + '\n');
      const ch = join(HERE, 'CHANGES.md'), txt = readFileSync(ch, 'utf8'), anchor = '|---|---|---|---|---|\n', i = txt.indexOf(anchor) + anchor.length;
      writeFileSync(ch, txt.slice(0, i) + AUG.changesRow(rel(recPath), rep, b.rows, date, !!drafted) + txt.slice(i));
      // 생성물 자동 갱신: limitations.md · 교과서 부록
      writeFileSync(join(HERE, 'limitations.md'), DefDB.limitationsMarkdown(res.db));
      const tdir = join(HERE, 'docs', 'textbook'); writeFileSync(join(tdir, '90-부록-자동생성.md'), textbookAppendix(res.db, readJSON(join(tdir, 'storage-map.json'))));
      console.log(`기록: ${rel(recPath)}\n저장: ${rel(DB_PATH)}\nCHANGES.md 에 한 행 추가 · limitations.md · 교과서 부록 갱신`);
      break;
    }
    die('사용법: augment plan [--write] | fetch [--refetch] | build [--sync] [--out patch.json] | apply [--sync] | apply <초안 patch.json>');
  }
  case 'compare': {
    // 비교 검토 (프로토콜 §5): 기준(A) 대 제안(B = 패치 적용 db 와/또는 다른 시나리오)
    if (!flags.state || !flags.scenario) die('사용법: compare --state <세포 상태> --scenario A.json [--scenario-b B.json] [--patch p.json] [--hours h] [--ref-hours h]');
    const CMP = createRequire(import.meta.url)('./engine/compare.js');
    const dbA = loadDB(), x = DefDB.resolveRef(DefDB.index(dbA), flags.state); if (x.error) die(x.error);
    let dbB = dbA;
    if (flags.patch) { const res = DefDB.ingest(dbA, readJSON(flags.patch)), g = DefDB.gate(dbA, res, {}); printIssues(g.errors, g.warnings); if (g.errors.length) die('패치가 관문을 통과하지 못함'); dbB = res.db; }
    const scA = readJSON(flags.scenario), scB = flags['scenario-b'] ? readJSON(flags['scenario-b']) : JSON.parse(JSON.stringify(scA));
    if (flags.hours) { scA.t_end = +flags.hours * 3600; scB.t_end = +flags.hours * 3600; }
    const r = CMP.compare(dbA, dbB, x.id, scA, scB, { refHours: +(flags['ref-hours'] || 3) });
    console.log(CMP.compareText(r));
    process.exit(r.verdict === 'Optimization-Negative' ? 1 : 0);
  }
  case 'fate': {
    if (!args[0] || !flags.scenario) die('사용법: fate <세포 상태 번호|이름> --scenario s.json [--t 시간(h)] [--fine] [--no-commitment] [--brief] [--report 파일.md] [--numerics 시간(h), 0 이면 끔]');
    const db = loadDB(), x = DefDB.resolveRef(DefDB.index(db), args[0]);
    if (x.error) die(x.error);
    const FATE = createRequire(import.meta.url)('./engine/fate_engine.js'), PR = createRequire(import.meta.url)('./engine/process_report.js');
    const scenarioText = readFileSync(flags.scenario, 'utf8'), scenario = JSON.parse(scenarioText);
    if (flags.t) scenario.t_end = +flags.t * 3600;
    const opt = { scenario, mode: flags.fine ? 'fine' : undefined, commitment: flags['no-commitment'] ? false : undefined };
    if (flags.brief) { const r = FATE.simulateFateText(db, x.id, opt); console.log(r.text); console.log(DefDB.refineText(db).text); process.exit(r.code); }
    const r = FATE.simulateFate(db, x.id, opt);
    if (r.error) die(r.error);
    // 결정론: 같은 입력으로 본 실행을 다시 (결정 탐침 없이 — 본 실행 궤적은 탐침과 무관)
    const again = FATE.simulateFate(db, x.id, { ...opt, scenario: JSON.parse(scenarioText), commitment: false });
    // 수치 확인: 처음 h 시간을 수렴 기준(명시 부분 단계 소비 1%)과 비교
    const nh = flags.numerics != null && flags.numerics !== true ? +flags.numerics : 1;
    let numerics = null;
    if (nh > 0) {
      const s2 = { ...JSON.parse(scenarioText), t_end: Math.min(r.t_end, nh * 3600) }, t0 = Date.now();
      const ref = FATE.simulateFate(db, x.id, { scenario: { ...s2, explicit_fraction: 0.01 }, mode: 'fine', commitment: false }), refMs = Date.now() - t0;
      let worst = 0; for (const b of r.markers) { const i = r.keys.indexOf(b); let n = 0, d = 0; for (let j = 0; j < ref.series.length; j++) { n += (r.series[j][i] - ref.series[j][i]) ** 2; d += ref.series[j][i] ** 2; } worst = Math.max(worst, d ? Math.sqrt(n / d) : 0); }
      numerics = { hours: s2.t_end / 3600, l2: worst, refMs };
    }
    const rep = PR.processReport(r, { scenario: JSON.parse(scenarioText), scenarioText, dbText: readFileSync(DB_PATH, 'utf8'), rerunHash: again.process.hash, numerics });
    const md = PR.processReportMarkdown(rep);
    console.log(md);
    console.log(DefDB.refineText(db).text);
    if (flags.report && flags.report !== true) { writeFileSync(flags.report, md); console.log('보고서: ' + flags.report); }
    process.exit(rep.pass ? 0 : 1);
  }
  case 'prompt': {
    console.log(DefDB.promptText(loadDB(), { material: args[0] ? readFileSync(args[0], 'utf8') : '' }));
    break;
  }
  default:
    die('명령: status | validate | merge | map | audit | vocab | context | mechanism | simulate | fate | compare | augment | resolution | audit-run | pattern | limitations | textbook | prompt  (형식 변환은 migrations/, 파일 맨 위 주석 참고)');
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
  const lim = Object.values(db.limitations).map((l) => [l.type, DefDB.limitationStatus(db, l).status]);
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
    const m = DefDB.findMotifs(db, pid, ix), rp = DefDB.resolutionPlan(db, pid);
    const need = [0, 1, 2].map((n) => rp.rows.filter((r) => r.need === n).length);
    prow.push([`${pid} ${ix.label(pid)}`, st.length, m.trajectory.join(' → '), Object.keys(m.found).join(', '), `R0 ${need[0]} · R1 ${need[1]} · R2 ${need[2]}`]);
  }
  out.push(...T(['경로', '단계', '위치 궤적', '찾은 패턴', '필요 해상도'], prow), '');
  // 3. 저장 지도
  out.push('## 9.3 저장 지도 (docs/textbook/storage-map.json)', '');
  for (const [k, c] of Object.entries(map.classes)) {
    const fs = map.files.filter((f) => f.class === k); if (!fs.length) continue;
    out.push(`### ${c.label} (\`${k}\`)`, '', c.rule, '', ...T(['경로', '형식', '쓰는 쪽', '읽는 쪽', '해석'], fs.map((f) => [`\`${f.path}\``, f.format, f.writer, f.readers, f.interpret])), '');
  }
  // 4. 식별자
  out.push('## 9.4 식별자 문법', '', ...T(['형태', '예', '뜻'], [
    ['T + 6자리', 'T000042', '개념(피정의항, 이름 묶음)'], ['D + 6자리', 'D000044', '정의항(뜻, 원천)'], ['S + 6자리', 'S000009', '기전 단계'], ['L + 6자리', 'L000004', '한계'],
    ['D…/site/키', 'D000044/site/reg_phos', '정의항이 소유한 부위'], ['D…/rule/키', 'D000085/rule/ikba_s32', '정의항이 소유한 규칙'], ['D…/desc/n · D…/obs/n', 'D000044/desc/1', '설명·관찰 (1부터)'],
    ['D…|부위:특징|…|위치', 'D000044|reg_phos:phosphorylated|cytosol', '묶음 — 번호가 아닌 파생 키, 부위 이름순 정렬'],
    ['임시 번호 (패치 안에서만)', 'T+1, D+gp, S+1, L+1', '병합 때 실제 번호로 바뀜'], ['이름 주소', '효소#2', '개념 안 뜻 번호'],
  ]), '', `예약 문자(이름에 금지): \`# @ | /\` · 부위·규칙 키 형식: \`${V.siteKeyPattern}\` · 잔기 형식: \`${V.residuePattern}\``, '');
  // 5. 어휘
  out.push('## 9.5 통제 어휘 (vocab.js)', '');
  const vt = { kinds: 'kind', fields: '분야', locations: '위치', faces: '막 면', associations: '막 결합 방식', siteTypes: '부위 종류', features: '특징', actions: '변화 종류', activity: '활성', effects: '조절 효과', taxa: '종', tissues: '조직', cells: '세포', obsProperties: '관찰 속성', evidenceLevels: '근거 수준', gapTypes: '한계 종류', kineticLaws: '속도 법칙', resolutionLevels: '해상도', resolutionThresholds: '전환 문턱' };
  for (const [t, name] of Object.entries(vt)) {
    out.push(`### ${name} (\`${t}\`)`, '', ...T(['키', '이름', '세부'], Object.entries(V[t]).map(([k, v]) => [k, v.label || v.name || '', [
      v.aliases && v.aliases.length ? '별칭 ' + v.aliases.join(', ') : '', v.dim ? `${v.dim}${v.parent ? ' ⊂' + v.parent : ''}${v.sides ? ' 면 ' + Object.entries(v.sides).map(([a, b]) => a + '→' + b).join(', ') : ''}` : '',
      v.effects ? `효과 ${v.effects.join('/')}${v.adds ? ' +' + v.adds : ''}${v.removes ? ' −' + v.removes : ''}` : '', v.species ? `종 ${v.species}` : '', v.participant ? '기전 참여' : '',
      v.xref && v.xref.required && v.xref.required.length ? `필수 ID ${v.xref.required.join(', ')}` : '', v.required ? `필수 ${v.required.join(', ')}` : '', v.requires ? `필요 ${v.requires}` : '',
      v.value ? `값 ${Array.isArray(v.value) ? v.value.join('/') : v.value}${v.speciesRequired ? ', 종 필수' : ''}` : '', v.up ? `→ ${v.up}` : '', v.when || v.note || '', v.parent && !v.dim ? `상위 ${v.parent}` : ''].filter(Boolean).join(' · ')])), '');
  }
  out.push('### 외부 ID 형식 (`xrefs`)', '', ...T(['종류', '형식(정규식)'], Object.entries(V.xrefs).map(([k, v]) => [k, '`' + v.pattern + '`'])), '');
  // 6. 엔진 상수
  out.push('## 9.6 엔진 상수 (core.js)', '', ...T(['이름', '값'], [
    ['효과 종류 EFFECT_TYPES', DefDB.EFFECT_TYPES.join(', ')], ['동일성 보존 검사 효과 CONSERVING', [...DefDB.CONSERVING].join(', ') + ' (+ partner 가 있는 modify)'],
    ['속도 상수 필드 KIN_FIELDS', DefDB.KIN_FIELDS.join(', ')], ['정의항 필드 SENSE_FIELDS', DefDB.SENSE_FIELDS.join(', ')],
    ['관계 REL', Object.entries(DefDB.REL).map(([k, v]) => `${k}(${v.label})`).join(', ')],
    ['패턴 MOTIFS', Object.entries(DefDB.MOTIFS).map(([k, v]) => `${k}(${v.label})`).join(', ')],
  ]), '');
  out.push('### 감사 코드', '', ...T(['코드', '뜻'], [
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
