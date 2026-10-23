// 입법 서기 (Legislative Clerk) — 이 저장소에서 파일을 쓰는 유일한 과정. docs/design/tripartite-governance.md §1
//
// 쓰기 권한 분리:
//   · 행정부(core.js·engine/)는 아무것도 쓰지 않는다. 사법부(judicial/)도 쓰지 않는다 — 판결·도장을 계산해 넘길 뿐이다.
//   · 서기는 사법부 판결이 붙은 것만 쓴다:
//       data/db.json · data/patches/  ← 관문 봉인(sealVerdict)이 통과이고, 그 봉인의 db sha256 이 쓸 db 와 같을 때만
//       attestations/registry.json    ← 도장마다 digest·증거 재확인이 통과할 때만 (주장별로 신원 verifyStamp · 추세 verifyTrendStamp)
//   · 파생 문서(limitations.md · 교과서 부록 · CHANGES.md 한 행 · 수동 수집 과제 · 사용자가 요청한 보고서 파일)와
//     수신함(data/fetched/) 받기는 서기의 일이다 — 내용은 다른 모듈이 계산하고 서기는 정해진 위치에만 쓴다.
// 서기는 판결을 만들지 않는다(검사·관문 없음). 거부 사유가 생기면 예외로 멈추고 아무것도 쓰지 않는다.
//
// 구역 (Zone) — 경로를 경계로 쓰는 자리는 여기뿐이다 (ZONES).
//   쓰기는 모두 put(구역, 파일) 하나를 지나고, 그 파일이 구역의 허용 자리가 아니면 **거부**한다. 구역 없이 쓸 길은 없다.
//   저장소 **밖**(tmp·스크래치 사본, `--db` 로 가리킨 다른 저장소)은 구역 표가 다루지 않는다 — 저장소의 코드·데이터·증명을
//   건드리지 못하게 막는 것이 목적이고, 밖은 애초에 그것이 아니다. 막는 것은 '저장소 안인데 그 구역이 아닌 자리' 다
//   (예: 병합이 judicial/ 에, 받기가 engine/ 에 쓰려는 경우).
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, unlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, basename, relative, resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const require = createRequire(import.meta.url);
const ATT = require('../judicial/attestation.js');
const TR = require('../judicial/trend.js'); // 추세 도장(claim 'trend')의 검증은 이 쪽 — 주장마다 맞는 사법부 모듈로 보낸다
const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const sha = (x) => createHash('sha256').update(x).digest('hex');
const serialize = (db) => JSON.stringify(db, null, 2) + '\n';
const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
const refuse = (m) => { throw new Error('입법 서기 거부: ' + m); };
const log = [];

// 파생 문서가 놓일 수 있는 곳 (서기가 쓰는 위치 목록 — 이 밖으로는 쓰지 않는다; 보고서는 사용자가 지정)
const DERIVED = { limitations: 'limitations.md', textbook: 'docs/textbook/90-부록-자동생성.md', retrieval: 'data/fetched/RETRIEVAL_TASKS.md' };

// 구역 표: allow = 저장소 안에서 허용되는 자리(접두사) · deny = 보호 목록(사용자가 위치를 정하는 보고서) · outsideOnly = 저장소 밖에만
export const ZONES = {
  registry:    { label: '입법 구역 (정의·병합 기록·델타 기록)', allow: ['data/db.json', 'data/patches/', 'data/log/', 'data/preregistrations.jsonl', 'data/dictionary.jsonl', 'data/assumptions.jsonl'], rule: '관문 봉인 통과 + 봉인의 db sha256 이 쓸 db 와 같을 때만' },
  attestation: { label: '증명 구역 (도장 등록부)', allow: [ATT.REGISTRY], rule: '도장마다 digest·증거 재확인(주장별 사법부 모듈)이 통과할 때만' },
  evidence:    { label: '증거 구역 (원본 수신함)', allow: ['data/fetched/', 'tests/fixtures/'], rule: '원본을 그대로 — 해석·실행하지 않는다' },
  derived:     { label: '파생 문서 구역', allow: [...Object.values(DERIVED), 'CHANGES.md'], rule: '내용은 다른 모듈이 계산하고 서기는 정해진 파일에만' },
  report:      { label: '사용자 보고서', deny: ['data', 'attestations', 'judicial', 'legislative', 'engine', 'compiler', 'migrations', 'schemas', 'tests'], rule: '위치는 사용자가 정한다 — 저장소의 코드·데이터·증명 위치에는 쓰지 않는다' },
  draft:       { label: '초안 (패치·리팩터링 제안)', outsideOnly: true, rule: '저장소 밖(스크래치·임시 폴더)에만' },
};
const GUARDED_FILES = ['core.js', 'model.js', 'vocab.js', 'dbtool.mjs', 'orchestrator.js', 'CHANGES.md', 'limitations.md', 'SCHEMA.md', 'CLAUDE.md'];
// 구역 검사 — 통과한 절대 경로를 돌려준다. 저장소 밖은 구역 표가 다루지 않는다(위 머리말).
function zoned(zone, file) {
  const z = ZONES[zone];
  if (!z) refuse(`알 수 없는 구역 '${zone}'`);
  const abs = resolve(file), rel = relative(ROOT, abs), outside = rel === '' || rel.startsWith('..');
  if (z.outsideOnly) { if (!outside) refuse(`${z.label} 는 ${z.rule} (${rel})`); return abs; }
  if (outside) return abs;
  if (z.allow && !z.allow.some((a) => rel === a || rel.startsWith(a.endsWith('/') ? a : a + sep))) refuse(`${z.label} 가 아닌 자리에 쓰려 함: ${rel} — 허용 ${z.allow.join(', ')}`);
  if (z.deny && (z.deny.some((d) => rel === d || rel.startsWith(d + sep)) || /\.(js|mjs|json)$/.test(abs) || GUARDED_FILES.includes(rel))) refuse(`보고서를 저장소의 보호된 위치(${rel})에 쓸 수 없음`);
  return abs;
}
// 이 저장소에서 파일에 쓰는 단 하나의 함수 — 구역을 반드시 지난다
const put = (zone, file, text) => { const abs = zoned(zone, file); mkdirSync(dirname(abs), { recursive: true }); const tmp = abs + '.part'; writeFileSync(tmp, text); renameSync(tmp, abs); log.push(relative(process.cwd(), abs) || abs); return abs; };

// ① 병합 기록: 관문 봉인이 통과이고 봉인의 db 가 쓸 db 와 같을 때만 data/patches/ 기록 + data/db.json
export function commitMerge({ dbPath, db, records, seal }) {
  if (!ATT.checkSeal(seal)) refuse('관문 봉인이 없거나 변조됨');
  if (!seal.ok) refuse(`관문 판결이 거부 (오류 ${seal.errors}, 경고 ${seal.warnings})`);
  const text = serialize(db);
  if (sha(text) !== seal.db_sha256) refuse('봉인된 db 와 쓰려는 db 가 다름 — 판결을 다른 데이터에 재사용할 수 없음');
  const patchDir = join(dirname(dbPath), 'patches'), written = [];
  for (const r of records) written.push(put('registry', join(patchDir, `${stamp()}-${r.name.replace(/\.json$/, '')}.json`), JSON.stringify({ applied_at: new Date().toISOString(), ...r.record }, null, 2) + '\n'));
  const event = appendEvent(dirname(dbPath), records, seal);
  put('registry', dbPath, text);
  return { records: written, db: dbPath, event };
}

// ①′ 델타 기록 (S1, docs/design/integral-field-engine.md §17): 기원 체크포인트가 있으면 병합마다 사건 하나를 **추가만** 한다.
//   사건 = { seq, at, names, patches(관문에 들어간 그대로), db_sha256(봉인의 db), prev(직전 루트) } · root = sha256(prev + '\n' + 정준 JSON)
//   이 사슬이 원본이고 db.json 은 그 재생 결과(스냅숏)다 — 재생 일치·사슬 무결성은 사법부(judicial/log_audit.js)가 판정한다.
//   기원이 없는 db(시험용 임시 db 등)에서는 기록하지 않는다.
const LOG = { dir: 'log', genesis: 'genesis.json', snapshot: 'genesis-db.json', events: 'events.jsonl' };
const readEvents = (dir) => { const f = join(dir, LOG.events); return existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []; };
function appendEvent(dataDir, records, seal) {
  const dir = join(dataDir, LOG.dir), gf = join(dir, LOG.genesis);
  if (!existsSync(gf)) return null;
  const genesis = JSON.parse(readFileSync(gf, 'utf8')), events = readEvents(dir), last = events[events.length - 1];
  const body = { seq: events.length + 1, at: new Date().toISOString(), names: records.map((r) => r.name),
    patches: records.map((r) => { const { result, report, applied_at, ...patch } = r.record; return patch; }), db_sha256: seal.db_sha256, prev: last ? last.root : genesis.root };
  const ev = { ...body, root: sha(body.prev + '\n' + ATT.canon(body)) };
  const f = join(dir, LOG.events), old = existsSync(f) ? readFileSync(f, 'utf8') : '';
  put('registry', f, old + JSON.stringify(ev) + '\n');
  return ev;
}
// ①″ 형식 변환 (migrations/): 사법부 검사 봉인이 있을 때만 db 를 쓰고, 기원이 있으면 사건 종류 'migration' 으로 사슬에 남긴다.
//   사건 = { seq, at, kind: 'migration', script, script_sha256, from_sha256, recorded_at, db_sha256, prev } — 재생은 그 스크립트의 transform 을 다시 돌린다.
export function commitMigration({ dbPath, db, seal, script, scriptText, fromSha, recorded_at }) {
  if (!ATT.checkSeal(seal)) refuse('검사 봉인이 없거나 변조됨');
  if (!seal.ok) refuse('검사 판결이 거부');
  const text = serialize(db);
  if (sha(text) !== seal.db_sha256) refuse('봉인된 db 와 쓰려는 db 가 다름');
  if (!/^migrations\/[^/]+\.js$/.test(script)) refuse(`형식 변환 스크립트는 migrations/ 의 CommonJS 파일이어야 함 (${script})`);
  const dir = join(dirname(dbPath), LOG.dir), gf = join(dir, LOG.genesis);
  let event = null;
  if (existsSync(gf)) {
    const genesis = JSON.parse(readFileSync(gf, 'utf8')), events = readEvents(dir), last = events[events.length - 1];
    const body = { seq: events.length + 1, at: new Date().toISOString(), kind: 'migration', script, script_sha256: sha(scriptText), from_sha256: fromSha, recorded_at, db_sha256: seal.db_sha256, prev: last ? last.root : genesis.root };
    event = { ...body, root: sha(body.prev + '\n' + ATT.canon(body)) };
    const f = join(dir, LOG.events);
    put('registry', f, (existsSync(f) ? readFileSync(f, 'utf8') : '') + JSON.stringify(event) + '\n');
  }
  put('registry', dbPath, text);
  return { db: dbPath, event };
}
// 기원 체크포인트: 지금 db 를 사법부가 검사해 봉인한 것만 기원으로 쓴다. 한 번만 — 이미 있으면 거부.
export function sealGenesis({ dbPath, db, seal, note }) {
  if (!ATT.checkSeal(seal)) refuse('관문 봉인이 없거나 변조됨');
  if (!seal.ok) refuse(`검사 판결이 거부 (오류 ${seal.errors}, 경고 ${seal.warnings})`);
  const text = serialize(db);
  if (sha(text) !== seal.db_sha256) refuse('봉인된 db 와 기원으로 쓰려는 db 가 다름');
  const dir = join(dirname(dbPath), LOG.dir);
  if (existsSync(join(dir, LOG.genesis))) refuse('기원 체크포인트가 이미 있음 — 기원은 한 번만 만든다');
  const g = { format: 'definition-db-log', version: 1, at: new Date().toISOString(), db_sha256: seal.db_sha256, root: sha('genesis\n' + seal.db_sha256), snapshot: LOG.snapshot, note: note || '' };
  put('registry', join(dir, LOG.snapshot), text);
  put('registry', join(dir, LOG.genesis), JSON.stringify(g, null, 2) + '\n');
  return g;
}
// 사전 등록 (build-plan 3, L3): 검증에 쓸 시나리오를 **실행 전에** 정준 해시·시각으로 사슬에 남긴다.
//   사법부(judicial/protocol.js protocolStructure)가 규약 구조를 통과시킨 봉인이 있을 때만 쓴다. 판정(실행보다 앞선 등록인가)은 사법부.
const PREREG = 'preregistrations.jsonl', PREREG_GENESIS = sha('preregistration\n');
export function readPrereg(dataDir) { const f = join(dataDir, PREREG); return existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []; }
export function registerPrereg({ dataDir, scenario, seal, assumptions }) {
  if (!ATT.checkSeal(seal)) refuse('규약 판정 봉인이 없거나 변조됨');
  if (!seal.ok) refuse(`규약 판정이 거부 (위반 ${seal.errors})`);
  if (sha(JSON.stringify(scenario, null, 2) + '\n') !== seal.db_sha256) refuse('봉인된 시나리오와 등록하려는 시나리오가 다름');
  const entries = readPrereg(dataDir), h = sha(ATT.canon(scenario)); // 시나리오는 가정 번호를 푼 내용 — 해시가 번호의 숫자까지 고정한다 (가정 번호 목록은 assumptions 로 함께)
  const dup = entries.find((e) => e.scenario_sha256 === h);
  if (dup) refuse(`이미 등록된 시나리오 (#${dup.seq}, ${dup.at})`);
  const last = entries[entries.length - 1];
  const body = { seq: entries.length + 1, at: new Date().toISOString(), scenario_sha256: h, name: scenario.name || '', question: (scenario.protocol || {}).question || '', ...(assumptions && assumptions.length ? { assumptions } : {}), prev: last ? last.root : PREREG_GENESIS };
  const ev = { ...body, root: sha(body.prev + '\n' + ATT.canon(body)) }, f = join(dataDir, PREREG);
  put('registry', f, (existsSync(f) ? readFileSync(f, 'utf8') : '') + JSON.stringify(ev) + '\n');
  return ev;
}

// 사전 (build-plan 16A): data/dictionary.jsonl 은 추가만 하는 사슬. 사법부(judicial/dictionary_audit.js checkProposals)가 새 항목을
//   통과시킨 봉인이 있을 때만 사건을 붙인다 — 지우거나 고쳐 쓰지 않는다(고치기는 revises 단 새 사건).
const DICT = 'dictionary.jsonl', DICT_GENESIS = sha('dictionary\n');
export function readDictionary(dataDir) { const f = join(dataDir, DICT); return existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter((l) => l.trim() && !l.trim().startsWith('//')).map((l) => JSON.parse(l)) : []; }
export function appendDictionary({ dataDir, proposals, seal }) {
  if (!ATT.checkSeal(seal)) refuse('사전 판정 봉인이 없거나 변조됨');
  if (!seal.ok) refuse(`사전 판정이 거부 (위반 ${seal.errors})`);
  if (sha(JSON.stringify(proposals, null, 2) + '\n') !== seal.db_sha256) refuse('봉인된 항목과 쓰려는 항목이 다름');
  const events = readDictionary(dataDir), f = join(dataDir, DICT), at = new Date().toISOString(), out = [];
  let prev = events.length ? events[events.length - 1].root : DICT_GENESIS;
  for (const p of proposals) {
    const body = { seq: events.length + out.length + 1, at, ...p, prev };
    const ev = { ...body, root: sha(body.prev + '\n' + ATT.canon(body)) };
    out.push(ev); prev = ev.root;
  }
  put('registry', f, (existsSync(f) ? readFileSync(f, 'utf8') : '') + out.map((e) => JSON.stringify(e)).join('\n') + '\n');
  return out;
}

// 가정 원장 (build-plan 49): data/assumptions.jsonl 은 추가만 하는 사슬. 사법부(judicial/assumption_audit.js checkProposals)가 새 기록을
//   통과시킨 봉인이 있을 때만 붙인다. 번호 A… 는 서기가 차례로 붙인다 — 지우거나 고쳐 쓰지 않는다(고치기는 revises 단 새 번호).
const ASSUME = 'assumptions.jsonl', ASSUME_GENESIS = sha('assumptions\n');
export function readAssumptions(dataDir) { const f = join(dataDir, ASSUME); return existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)) : []; }
export function appendAssumptions({ dataDir, proposals, seal }) {
  if (!ATT.checkSeal(seal)) refuse('가정 판정 봉인이 없거나 변조됨');
  if (!seal.ok) refuse(`가정 판정이 거부 (위반 ${seal.errors})`);
  if (sha(JSON.stringify(proposals, null, 2) + '\n') !== seal.db_sha256) refuse('봉인된 기록과 쓰려는 기록이 다름');
  const events = readAssumptions(dataDir), f = join(dataDir, ASSUME), at = new Date().toISOString(), out = [];
  let prev = events.length ? events[events.length - 1].root : ASSUME_GENESIS;
  for (const p of proposals) {
    const seq = events.length + out.length + 1;
    const body = { seq, at, id: 'A' + String(seq).padStart(6, '0'), ...p, prev };
    const ev = { ...body, root: sha(body.prev + '\n' + ATT.canon(body)) };
    out.push(ev); prev = ev.root;
  }
  put('registry', f, (existsSync(f) ? readFileSync(f, 'utf8') : '') + out.map((e) => JSON.stringify(e)).join('\n') + '\n');
  return out;
}

export function readLog(dataDir) {
  const dir = join(dataDir, LOG.dir), gf = join(dir, LOG.genesis);
  if (!existsSync(gf)) return null;
  return { genesis: JSON.parse(readFileSync(gf, 'utf8')), snapshotText: readFileSync(join(dir, LOG.snapshot), 'utf8'), events: readEvents(dir) };
}

// ② 증명 등록부: 도장마다 사법부 검증(digest + 증거 재확인)을 다시 거친 뒤에만 추가.
//    주장(claim)에 따라 검증 모듈이 다르다 — 'verified' 는 신원(attestation), 'trend' 는 추세(trend). 검증 함수를 부르는 쪽이 고르게 하지 않는다.
export function appendAttestations({ root, stamps, db }) {
  root = root || ROOT;
  const reg = ATT.readRegistry(root);
  for (const st of stamps) {
    const v = st.claim === 'trend' ? TR.verifyTrendStamp(st, db, { root, reverify: true, registry: reg }) : ATT.verifyStamp(st, db, { root, reverify: true });
    if (!v.ok) refuse(`도장 ${v.key}: ${v.reasons.join(' · ')}`);
    reg.stamps = reg.stamps.filter((x) => ATT.subjectKey(x.subject) !== v.key);
    reg.stamps.push(st);
  }
  reg.stamps.sort((a, b) => ATT.subjectKey(a.subject).localeCompare(ATT.subjectKey(b.subject)));
  return put('attestation', join(root, ATT.REGISTRY), JSON.stringify(reg, null, 2) + '\n');
}

// ③ 파생 문서 (limitations.md · 교과서 부록 · 수동 수집 과제)
export function writeDerived(kind, content, root) {
  if (!DERIVED[kind]) refuse(`알 수 없는 파생 문서 '${kind}'`);
  return put('derived', join(root || ROOT, DERIVED[kind]), content);
}
// 수동 수집 과제 (증거 구역 = 수신함 안에만 — 자리 검사는 구역이 한다)
export function writeRetrievalTasks(dir, content) {
  return put('evidence', join(resolve(dir), 'RETRIEVAL_TASKS.md'), content);
}
export const derivedPath = (kind, root) => join(root || ROOT, DERIVED[kind]);

// ④ CHANGES.md 맨 위 표에 한 행
export function insertChangesRow(row, root) {
  const ch = join(root || ROOT, 'CHANGES.md'), txt = readFileSync(ch, 'utf8'), anchor = '|---|---|---|---|---|\n', i = txt.indexOf(anchor);
  if (i < 0) refuse('CHANGES.md 표 머리를 찾지 못함');
  return put('derived', ch, txt.slice(0, i + anchor.length) + row + txt.slice(i + anchor.length));
}

// ⑤ 사용자가 요청한 보고서 파일 (예: fate --report 파일.md) — 저장소의 데이터·코드·증명 위치에는 쓰지 않는다
export function writeReport(file, content) {
  return put('report', resolve(file), content);
}

// ⑥ 임시 산출물 (패치 초안·리팩터링 제안) — 저장소 밖 임시 폴더에만
export function writeDraft(file, obj) {
  return put('draft', resolve(file), JSON.stringify(obj, null, 2) + '\n');
}

// ⑦ 수신함 받기 (curl, 프록시 설정을 따름) — 원본을 그대로 data/fetched/ 에. 해석·실행하지 않음
export function fetchToInbox(tasks, opt) {
  opt = Object.assign({ timeout: 20 }, opt || {});
  const out = [];
  for (const t of tasks) {
    if (t.present && !opt.refetch) { out.push({ task: t, ok: true, cached: true, file: t.present }); continue; }
    let res = null;
    for (const url of t.urls) {
      // curl 이 직접 쓰므로 put 을 지나지 않는다 — 같은 구역 검사를 여기서 받는다 (받기도 증거 구역 안에만)
      const ext = /\.fasta$/.test(url) ? '.fasta' : /\.txt$/.test(url) ? '.txt' : '.json', dest = zoned('evidence', t.file + ext), tmp = dest + '.part';
      mkdirSync(dirname(dest), { recursive: true });
      try {
        execFileSync('curl', ['-sS', '-f', '-L', '-m', String(opt.timeout), '-o', tmp, url], { stdio: ['ignore', 'ignore', 'pipe'] });
        renameSync(tmp, dest); log.push(dest); res = { task: t, ok: true, file: dest, url }; break;
      } catch (e) { try { unlinkSync(tmp); } catch (_) { /* 없음 */ } res = { task: t, ok: false, url, error: String(e.stderr || e.message).trim().split('\n').pop() }; }
    }
    out.push(res);
  }
  return out;
}

export const writtenFiles = () => log.slice();
export { basename, existsSync };
