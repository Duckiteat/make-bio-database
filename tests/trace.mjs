// 시험 추적 — `node --import tests/trace.mjs` 로 미리 실린다(NODE_OPTIONS 로 넘겨 하위 node 프로세스·워커까지).
// 시험 파일 하나가 실제로 읽은 저장소 파일을 모아, 파일 → 시험 지도(tests/affected.mjs)의 재료로 쓴다.
//   켜는 법: 환경 BIODB_TRACE_DIR(저장소 밖 기록 폴더) · BIODB_TRACE_ROOT(저장소 최상위). 둘 중 하나라도 없으면 아무것도 하지 않는다.
//   시험 이름: 시험 프로세스는 argv[1](…​.test.mjs)에서 정하고 BIODB_TRACE_TEST 로 내려 준다 — 그 시험이 띄운 하위 프로세스도 같은 시험에 붙는다.
// 기록하는 읽기: 모듈 적재(import · require) · fs 읽기·존재·상태·열기 · 폴더 목록(재귀면 '/**', glob 은 '**') · 하위 프로세스 인자 중 저장소 안 파일.
//   쓴 파일: 'w' (그 시험이 스스로 만든 파일 — 입력에서 뺀다).
//   저장소 안에서 부른 git: 'g' (git 역사를 읽음 — HEAD 가 바뀌면 다시) · 작업 트리를 읽는 git 명령(ls-files · status · diff …)은 저장소 전체 '**'.
// 계약: 읽기만 기록 — 저장소에 쓰지 않는다. 기록은 BIODB_TRACE_DIR 에 프로세스·스레드마다 한 파일, 새 항목마다 한 줄 덧붙임
//   (프로세스가 강제로 끝나도 그때까지 읽은 것은 남는다 — 지도에 구멍이 생기지 않게).
import fs from 'node:fs';
import cp from 'node:child_process';
import module from 'node:module';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { threadId } from 'node:worker_threads';

const DIR = process.env.BIODB_TRACE_DIR, ROOT = process.env.BIODB_TRACE_ROOT;
if (DIR && ROOT && !process.env.BIODB_TRACE_TEST) {
  const a = process.argv[1] ? relative(ROOT, resolve(process.argv[1])).split('\\').join('/') : '';
  if (/^tests\/[^/]+\.test\.mjs$/.test(a)) process.env.BIODB_TRACE_TEST = a;
}
const TEST = DIR && ROOT ? process.env.BIODB_TRACE_TEST : null;

if (TEST) {
  const real = { openSync: fs.openSync, writeSync: fs.writeSync, existsSync: fs.existsSync };
  const fd = real.openSync(join(DIR, `${process.pid}-${threadId}.trace`), 'a');
  real.writeSync(fd, `t\t${TEST}\n`);
  const seen = new Set();
  const rel = (p, base) => {
    try {
      if (p instanceof URL) p = fileURLToPath(p);
      else if (Buffer.isBuffer(p)) p = p.toString();
      if (typeof p !== 'string' || !p || p.includes('\0')) return null;
      const r = relative(ROOT, resolve(base || process.cwd(), p)).split('\\').join('/');
      if (r.startsWith('..') || isAbsolute(r) || r === '.git' || r.startsWith('.git/') || r.startsWith('node_modules/')) return null;
      return r || '.';
    } catch { return null; }
  };
  const note = (kind, r) => { if (r == null) return; const k = kind + '\t' + r; if (!seen.has(k)) { seen.add(k); real.writeSync(fd, k + '\n'); } };
  const file = (p, base) => { const r = rel(p, base); if (r && r !== '.') note('f', r); };
  const dir = (p, opt) => { const r = rel(p); if (r != null) note('d', r === '.' ? (opt && opt.recursive ? '**' : '.') : r + (opt && opt.recursive ? '/**' : '')); };

  const wrap = (obj, names, see) => { for (const n of names) { const f = obj[n]; if (typeof f !== 'function') continue; obj[n] = function (...a) { see(a); return f.apply(this, a); }; } };
  const ONE = ['readFileSync', 'readFile', 'existsSync', 'statSync', 'stat', 'lstatSync', 'lstat', 'openSync', 'open', 'accessSync', 'access', 'createReadStream', 'realpathSync', 'readlinkSync', 'copyFileSync', 'copyFile', 'cpSync', 'cp'];
  wrap(fs, ONE, (a) => file(a[0]));
  wrap(fs, ['readdirSync', 'readdir', 'opendirSync', 'opendir'], (a) => dir(a[0], a[1]));
  // 시험이 스스로 쓴 파일은 입력이 아니다 (임시 파일 등) — 'w' 로 적어 두고 고르는 쪽이 입력에서 뺀다
  const wrote = (p, base) => { const r = rel(p, base); if (r && r !== '.') note('w', r); };
  wrap(fs, ['writeFileSync', 'writeFile', 'appendFileSync', 'appendFile', 'mkdirSync', 'mkdir', 'createWriteStream'], (a) => wrote(a[0]));
  wrap(fs, ['renameSync', 'rename', 'copyFileSync', 'copyFile', 'linkSync', 'symlinkSync'], (a) => wrote(a[1]));
  wrap(fs.promises, ['writeFile', 'appendFile', 'mkdir'], (a) => wrote(a[0]));
  wrap(fs.promises, ['rename', 'copyFile'], (a) => wrote(a[1]));
  wrap(fs.promises, ['readFile', 'stat', 'lstat', 'open', 'access', 'realpath', 'readlink', 'copyFile', 'cp'], (a) => file(a[0]));
  wrap(fs.promises, ['readdir', 'opendir'], (a) => dir(a[0], a[1]));
  // 하위 프로세스: 실행 파일과 인자 중 저장소 안에 있는 파일 (node 하위 프로세스는 스스로도 추적된다 — NODE_OPTIONS)
  const argsOf = (a) => { const out = []; for (const x of a) { if (typeof x === 'string') out.push(x); else if (Array.isArray(x)) out.push(...x.filter((y) => typeof y === 'string')); } return out; };
  const cwdOf = (a) => { const o = a.find((x) => x && typeof x === 'object' && !Array.isArray(x)); return o && o.cwd ? String(o.cwd) : process.cwd(); };
  const spawned = (a) => { const base = cwdOf(a); for (const s of argsOf(a)) for (const tok of s.split(/\s+/)) { const r = rel(tok, base); if (r && r !== '.' && real.existsSync(join(ROOT, r))) note('f', r); } };
  const WORKTREE_GIT = new Set(['ls-files', 'status', 'diff', 'add', 'grep', 'stash', 'clone', 'worktree', 'hash-object', 'archive', 'checkout', 'restore', 'commit', 'apply', 'clean', 'reset']);
  const gitCall = (a) => {
    const tok = argsOf(a).flatMap((s) => s.split(/\s+/)).filter(Boolean);
    for (let i = 0; i < tok.length; i++) {
      if (!/(^|\/)git$/.test(tok[i])) continue;
      let cwd = cwdOf(a), j = i + 1;
      for (; j < tok.length && tok[j].startsWith('-'); j++) { if (tok[j] === '-C') cwd = resolve(cwd, tok[++j] || '.'); else if (tok[j] === '-c') j++; }
      if (rel(cwd) == null) continue;
      note('g', 'HEAD');
      if (WORKTREE_GIT.has(tok[j])) note('d', '**');
    }
  };
  wrap(cp, ['spawn', 'spawnSync', 'execFile', 'execFileSync', 'exec', 'execSync', 'fork'], (a) => { spawned(a); gitCall(a); });
  wrap(fs, ['globSync', 'glob'], () => note('d', '**'));
  wrap(fs.promises, ['glob'], () => note('d', '**'));
  module.syncBuiltinESMExports();
  module.registerHooks({ load(url, ctx, next) { if (url.startsWith('file:')) file(fileURLToPath(url)); return next(url, ctx); } });
}
