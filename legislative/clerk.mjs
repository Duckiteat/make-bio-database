// 입법 서기 (Legislative Clerk) — 이 저장소에서 파일을 쓰는 유일한 과정. docs/design/tripartite-governance.md §1
//
// 쓰기 권한 분리:
//   · 행정부(core.js·engine/)는 아무것도 쓰지 않는다. 사법부(judicial/)도 쓰지 않는다 — 판결·도장을 계산해 넘길 뿐이다.
//   · 서기는 사법부 판결이 붙은 것만 쓴다:
//       data/db.json · data/patches/  ← 관문 봉인(sealVerdict)이 통과이고, 그 봉인의 db sha256 이 쓸 db 와 같을 때만
//       attestations/registry.json    ← 도장마다 digest·증거 재확인(verifyStamp)이 통과할 때만
//   · 파생 문서(limitations.md · 교과서 부록 · CHANGES.md 한 행 · 수동 수집 과제 · 사용자가 요청한 보고서 파일)와
//     수신함(data/fetched/) 받기는 서기의 일이다 — 내용은 다른 모듈이 계산하고 서기는 정해진 위치에만 쓴다.
// 서기는 판결을 만들지 않는다(검사·관문 없음). 거부 사유가 생기면 예외로 멈추고 아무것도 쓰지 않는다.
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, unlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, basename, relative, resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const require = createRequire(import.meta.url);
const ATT = require('../judicial/attestation.js');
const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const sha = (x) => createHash('sha256').update(x).digest('hex');
const serialize = (db) => JSON.stringify(db, null, 2) + '\n';
const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
const refuse = (m) => { throw new Error('입법 서기 거부: ' + m); };
const log = [];
const put = (file, text) => { mkdirSync(dirname(file), { recursive: true }); const tmp = file + '.part'; writeFileSync(tmp, text); renameSync(tmp, file); log.push(relative(process.cwd(), file) || file); return file; };

// 파생 문서가 놓일 수 있는 곳 (서기가 쓰는 위치 목록 — 이 밖으로는 쓰지 않는다; 보고서는 사용자가 지정)
const DERIVED = { limitations: 'limitations.md', textbook: 'docs/textbook/90-부록-자동생성.md', retrieval: 'data/fetched/RETRIEVAL_TASKS.md' };

// ① 병합 기록: 관문 봉인이 통과이고 봉인의 db 가 쓸 db 와 같을 때만 data/patches/ 기록 + data/db.json
export function commitMerge({ dbPath, db, records, seal }) {
  if (!ATT.checkSeal(seal)) refuse('관문 봉인이 없거나 변조됨');
  if (!seal.ok) refuse(`관문 판결이 거부 (오류 ${seal.errors}, 경고 ${seal.warnings})`);
  const text = serialize(db);
  if (sha(text) !== seal.db_sha256) refuse('봉인된 db 와 쓰려는 db 가 다름 — 판결을 다른 데이터에 재사용할 수 없음');
  const patchDir = join(dirname(dbPath), 'patches'), written = [];
  for (const r of records) written.push(put(join(patchDir, `${stamp()}-${r.name.replace(/\.json$/, '')}.json`), JSON.stringify({ applied_at: new Date().toISOString(), ...r.record }, null, 2) + '\n'));
  put(dbPath, text);
  return { records: written, db: dbPath };
}

// ② 증명 등록부: 도장마다 사법부 검증(digest + 증거 재확인)을 다시 거친 뒤에만 추가
export function appendAttestations({ root, stamps, db }) {
  root = root || ROOT;
  const reg = ATT.readRegistry(root);
  for (const st of stamps) {
    const v = ATT.verifyStamp(st, db, { root, reverify: true });
    if (!v.ok) refuse(`도장 ${v.key}: ${v.reasons.join(' · ')}`);
    reg.stamps = reg.stamps.filter((x) => ATT.subjectKey(x.subject) !== v.key);
    reg.stamps.push(st);
  }
  reg.stamps.sort((a, b) => ATT.subjectKey(a.subject).localeCompare(ATT.subjectKey(b.subject)));
  return put(join(root, ATT.REGISTRY), JSON.stringify(reg, null, 2) + '\n');
}

// ③ 파생 문서 (limitations.md · 교과서 부록 · 수동 수집 과제)
export function writeDerived(kind, content, root) {
  if (!DERIVED[kind]) refuse(`알 수 없는 파생 문서 '${kind}'`);
  return put(join(root || ROOT, DERIVED[kind]), content);
}
// 수동 수집 과제 (수신함 폴더 안에만)
export function writeRetrievalTasks(dir, content) {
  const rel = relative(ROOT, resolve(dir));
  if (!rel.startsWith('..') && !(rel === 'data/fetched' || rel.startsWith('data/fetched' + sep) || rel.startsWith('tests' + sep + 'fixtures'))) refuse(`수동 수집 과제는 수신함(data/fetched/) 안에만 (${rel})`);
  return put(join(resolve(dir), 'RETRIEVAL_TASKS.md'), content);
}
export const derivedPath = (kind, root) => join(root || ROOT, DERIVED[kind]);

// ④ CHANGES.md 맨 위 표에 한 행
export function insertChangesRow(row, root) {
  const ch = join(root || ROOT, 'CHANGES.md'), txt = readFileSync(ch, 'utf8'), anchor = '|---|---|---|---|---|\n', i = txt.indexOf(anchor);
  if (i < 0) refuse('CHANGES.md 표 머리를 찾지 못함');
  return put(ch, txt.slice(0, i + anchor.length) + row + txt.slice(i + anchor.length));
}

// ⑤ 사용자가 요청한 보고서 파일 (예: fate --report 파일.md) — 저장소의 데이터·코드·증명 위치에는 쓰지 않는다
export function writeReport(file, content) {
  const abs = resolve(file), rel = relative(ROOT, abs);
  const guarded = ['data', 'attestations', 'judicial', 'legislative', 'engine', 'migrations', 'schemas', 'tests'].some((d) => rel === d || rel.startsWith(d + sep));
  if (!rel.startsWith('..') && (guarded || /\.(js|mjs|json)$/.test(abs) || ['core.js', 'model.js', 'vocab.js', 'dbtool.mjs', 'CHANGES.md', 'limitations.md'].includes(rel))) refuse(`보고서를 저장소의 보호된 위치(${rel})에 쓸 수 없음`);
  return put(abs, content);
}

// ⑥ 임시 산출물 (패치 초안·리팩터링 제안) — 저장소 밖 임시 폴더에만
export function writeDraft(file, obj) {
  if (!relative(ROOT, resolve(file)).startsWith('..')) refuse('초안은 저장소 밖(스크래치·임시 폴더)에만');
  return put(resolve(file), JSON.stringify(obj, null, 2) + '\n');
}

// ⑦ 수신함 받기 (curl, 프록시 설정을 따름) — 원본을 그대로 data/fetched/ 에. 해석·실행하지 않음
export function fetchToInbox(tasks, opt) {
  opt = Object.assign({ timeout: 20 }, opt || {});
  const out = [];
  for (const t of tasks) {
    if (t.present && !opt.refetch) { out.push({ task: t, ok: true, cached: true, file: t.present }); continue; }
    let res = null;
    for (const url of t.urls) {
      const ext = /\.fasta$/.test(url) ? '.fasta' : /\.txt$/.test(url) ? '.txt' : '.json', dest = t.file + ext, tmp = dest + '.part';
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
