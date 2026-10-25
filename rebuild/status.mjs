#!/usr/bin/env node
// 재건 관리 파일 생성기 (rebuild/PLAN.md §6) — 저장소를 세어 rebuild/status/*.md 를 만든다.
//   node rebuild/status.mjs            요약을 화면에
//   node rebuild/status.mjs --write    관리 파일을 갱신 (서기 구역 rebuild 만, 바뀐 파일만)
//   node rebuild/status.mjs --check    관리 파일이 지금 저장소와 같은지 (다르면 종료 코드 1)
// 계약: 관리 파일은 읽기 점검용이다 — 다른 코드가 읽거나 입력으로 쓰지 않는다(tests/rebuild.test.mjs).
//       시각·난수를 넣지 않는다 — 같은 저장소면 같은 내용.
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as CLERK from '../legislative/clerk.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STATUS = 'rebuild/status/';
const LEDGER_DIR = join(ROOT, 'rebuild', 'ledger');

// 모드·종류·집행 (PLAN §2·§5) — 장부 검사와 표의 열 순서
const MODES = ['common', 'author', 'baseline', 'develop', 'field', 'inspect'];
const MODE_KO = { common: '공통', author: '정보 작성', baseline: '기초시험', develop: '디벨롭', field: '적분장', inspect: '점검·검증' };
const KINDS = ['rule', 'procedure', 'reason', 'value', 'history'];
const KIND_KO = { rule: '규칙', procedure: '절차', reason: '이유', value: '현재 숫자', history: '역사' };
const ENFORCE = ['machine', 'text', 'none'];
// 지금의 입구 문서 (각자 "먼저 읽어라" 라고 하는 곳) · direction 이 정한 부팅 읽기
const ENTRY = ['CLAUDE.md', 'docs/design/direction.md', 'docs/RUNBOOK.md', 'docs/textbook/00-목차.md', 'docs/PROMPTS.md', 'workspace/START-HERE.md'];
const BOOT = ['CLAUDE.md', 'docs/design/direction.md', 'docs/design/authority-and-comprehension.md', 'docs/design/tripartite-governance.md',
  'docs/design/dictionary-and-translation.md', 'docs/design/conservation-classes.md', 'docs/design/work-verification.md', 'docs/design/build-plan.md'];
// 생성물 (분류 대상이 아님 — 원천에서 다시 만든다)
const GENERATED = ['limitations.md', 'docs/textbook/90-부록-자동생성.md', 'index.html'];

// ── 저장소 파일 목록 (추적 + 무시되지 않은 새 파일, 관리 파일 자신은 뺌 — 자기 크기를 세면 고정점이 없다)
function files() {
  let list;
  try { list = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 }).split('\0').filter(Boolean); }
  catch { const walk = (d) => readdirSync(join(ROOT, d), { withFileTypes: true }).flatMap((e) => (['.git', 'node_modules', 'target'].includes(e.name) ? [] : e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)])); list = walk(''); }
  return [...new Set(list)].filter((p) => !p.startsWith(STATUS) && !p.endsWith('.part') && existsSync(join(ROOT, p))).sort()
    .map((p) => ({ path: p, bytes: statSync(join(ROOT, p)).size }));
}
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const lines = (p) => read(p).split('\n').length - (read(p).endsWith('\n') ? 1 : 0);
const kb = (n) => (n / 1024).toFixed(1);
const top = (p) => (p.includes('/') ? p.split('/')[0] : '(최상위)');
const table = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
const sum = (xs) => xs.reduce((a, b) => a + b, 0);

// ── 장부 (rebuild/ledger/*.jsonl)
function ledger() {
  const units = [], bad = [];
  const fs = existsSync(LEDGER_DIR) ? readdirSync(LEDGER_DIR).filter((f) => f.endsWith('.jsonl')).sort() : [];
  const seen = new Set();
  for (const f of fs) read(join('rebuild/ledger', f)).split('\n').forEach((ln, i) => {
    if (!ln.trim()) return;
    const at = `${f}:${i + 1}`;
    let u; try { u = JSON.parse(ln); } catch { bad.push(`${at} JSON 아님`); return; }
    const why = [];
    if (!/^U\d{4,}$/.test(u.id || '')) why.push('id');
    else if (seen.has(u.id)) why.push('id 중복'); else seen.add(u.id);
    if (!u.src || !/:\d+/.test(u.src)) why.push('src(파일:줄)');
    if (!u.text) why.push('text');
    if (!MODES.includes(u.mode)) why.push('mode');
    if (!KINDS.includes(u.kind)) why.push('kind');
    if (!ENFORCE.includes(u.enforce)) why.push('enforce');
    if (u.enforce === 'machine' && !u.where) why.push('where(집행 자리)');
    if (why.length) bad.push(`${at} ${u.id || '?'}: ${why.join(', ')}`); else units.push({ ...u, file: f });
  });
  return { units, bad, files: fs };
}

// ── 코드에서 세는 것
function codeCounts(all) {
  const dbtool = read('dbtool.mjs');
  const cmds = [...new Set([...dbtool.matchAll(/^\s*case '([a-z-]+)':/gm)].map((m) => m[1]))];
  const head = dbtool.split(/^import /m)[0];
  const documented = new Set([...head.matchAll(/node dbtool\.mjs ([a-z-]+)/g)].map((m) => m[1]));
  const mcp = all.filter((f) => /^mcp\/[^/]+\.mjs$/.test(f.path)).map((f) => ({ file: f.path, tools: [...read(f.path).matchAll(/\bname: '([a-z_]+)'/g)].map((m) => m[1]) })).filter((x) => x.tools.length);
  const judicial = all.filter((f) => /^(judicial|legislative)\/[^/]+\.(js|mjs)$/.test(f.path)).map((f) => ({ file: f.path, sites: (read(f.path).match(/\bE\(/g) || []).length })).filter((x) => x.sites);
  const tests = all.filter((f) => /^tests\/[^/]+\.test\.mjs$/.test(f.path)).map((f) => ({ file: f.path, n: (read(f.path).match(/^\s*(test|it)\(/gm) || []).length }));
  const fixtures = all.filter((f) => /^tests\/fixtures\/rejections\/[^/]+\.json$/.test(f.path) && !f.path.endsWith('EXPECT.json')).length;
  return { cmds, documented, mcp, judicial, tests, fixtures };
}

function build() {
  const all = files(), by = Object.fromEntries(all.map((f) => [f.path, f.bytes])), L = ledger(), C = codeCounts(all);
  const docs = all.filter((f) => f.path.endsWith('.md') && !/^(data|rebuild|tests)\//.test(f.path));
  const classified = new Set(L.units.map((u) => u.src.replace(/:\d+.*$/, '')));
  const todo = docs.filter((d) => !GENERATED.includes(d.path) && !classified.has(d.path));
  const out = {};
  const note = '> 생성물 — `node rebuild/status.mjs --write`(응답이 끝날 때 훅이 돌림). 손으로 고치지 않는다. 읽기 점검용이며 다른 코드가 읽지 않는다.\n';

  // 00 요약
  const rows = [
    ['저장소 파일 (관리 파일 제외)', `${all.length} 개 · ${kb(sum(all.map((f) => f.bytes)))} KB`],
    ['입구 문서 6 곳 합', `${kb(sum(ENTRY.map((p) => by[p] || 0)))} KB`],
    ['direction 부팅 읽기 합', `${kb(sum(BOOT.map((p) => by[p] || 0)))} KB`],
    ['문서(.md, data·tests·rebuild 밖)', `${docs.length} 개 · ${kb(sum(docs.map((d) => d.bytes)))} KB`],
    ['아직 분류하지 않은 문서', `${todo.length} 개 · ${kb(sum(todo.map((d) => d.bytes)))} KB`],
    ['장부 단위', `${L.units.length} (형식 오류 ${L.bad.length})`],
    ['글뿐인 규칙 (rule · enforce text)', String(L.units.filter((u) => u.kind === 'rule' && u.enforce === 'text').length)],
    ['dbtool 명령 / 머리 주석에 적힌 것', `${C.cmds.length} / ${C.cmds.filter((c) => C.documented.has(c)).length}`],
    ['MCP 도구', `${sum(C.mcp.map((m) => m.tools.length))} (${C.mcp.map((m) => `${m.file.replace(/^mcp\/|\.mjs$/g, '')} ${m.tools.length}`).join(' · ')})`],
    ['판정 거부 자리 E( (규칙 번호 없음)', String(sum(C.judicial.map((j) => j.sites)))],
    ['시험 (test·it) / 거부 말뭉치', `${sum(C.tests.map((t) => t.n))} / ${C.fixtures}`],
  ];
  out['00-summary.md'] = `# 재건 관리 — 요약\n\n${note}\n${table(['무엇', '지금'], rows)}\n\n자세히: [01 파일](01-files.md) · [02 문서](02-docs.md) · [03 명령·판정·시험](03-commands-checks.md) · [04 분류 장부](04-ledger.md)\n`;

  // 01 파일
  const dirs = {};
  for (const f of all) { const d = (dirs[top(f.path)] ||= { n: 0, b: 0 }); d.n++; d.b += f.bytes; }
  const dirRows = Object.entries(dirs).sort((a, b) => b[1].b - a[1].b || (a[0] < b[0] ? -1 : 1)).map(([d, v]) => [d, String(v.n), kb(v.b)]);
  const big = [...all].sort((a, b) => b.bytes - a.bytes || (a.path < b.path ? -1 : 1)).slice(0, 25).map((f) => [`\`${f.path}\``, kb(f.bytes)]);
  out['01-files.md'] = `# 파일\n\n${note}\n## 최상위 폴더별\n\n${table(['폴더', '파일', 'KB'], dirRows)}\n\n## 큰 파일 25\n\n${table(['파일', 'KB'], big)}\n`;

  // 02 문서
  const unitsBy = {}; for (const u of L.units) { const s = u.src.replace(/:\d+.*$/, ''); unitsBy[s] = (unitsBy[s] || 0) + 1; }
  const docRows = docs.map((d) => [`\`${d.path}\``, kb(d.bytes), String(lines(d.path)), ENTRY.includes(d.path) ? '입구' : '', GENERATED.includes(d.path) ? '생성물' : unitsBy[d.path] ? `분류됨 ${unitsBy[d.path]}` : '미분류']);
  out['02-docs.md'] = `# 문서 (.md)\n\n${note}\n${table(['문서', 'KB', '줄', '입구', '분류'], docRows)}\n`;

  // 03 명령·판정·시험
  const cmdRows = C.cmds.map((c) => [`\`${c}\``, C.documented.has(c) ? '적힘' : '**빠짐**']);
  const mcpRows = C.mcp.map((m) => [`\`${m.file}\``, String(m.tools.length), m.tools.join(' · ')]);
  const judRows = C.judicial.map((j) => [`\`${j.file}\``, String(j.sites)]);
  const testRows = C.tests.map((t) => [`\`${t.file}\``, String(t.n)]);
  out['03-commands-checks.md'] = `# 명령 · 판정 · 시험\n\n${note}\n## dbtool 명령 (머리 주석에 적혔나)\n\n${table(['명령', '머리 주석'], cmdRows)}\n\n## MCP 도구\n\n${table(['서버', '수', '도구'], mcpRows)}\n\n## 판정 거부 자리 (E( — 규칙 번호 없이 문장만)\n\n${table(['파일', '자리'], judRows)}\n\n## 시험\n\n${table(['파일', '시험'], testRows)}\n\n거부 말뭉치: ${C.fixtures}\n`;

  // 04 분류 장부
  const cell = (m, k) => String(L.units.filter((u) => u.mode === m && u.kind === k).length);
  const mk = MODES.map((m) => [MODE_KO[m] + ` \`${m}\``, ...KINDS.map((k) => cell(m, k)), String(L.units.filter((u) => u.mode === m).length)]);
  const empty = MODES.filter((m) => !L.units.some((u) => u.mode === m && u.kind === 'rule')).map((m) => MODE_KO[m]);
  const enf = ENFORCE.map((e) => [e, String(L.units.filter((u) => u.kind === 'rule' && u.enforce === e).length)]);
  const src = Object.entries(unitsBy).sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([s, n]) => [`\`${s}\``, String(n)]);
  out['04-ledger.md'] = `# 분류 장부 (rebuild/ledger/*.jsonl)\n\n${note}\n장부 파일: ${L.files.join(' · ') || '없음'} · 단위 ${L.units.length}\n\n## 모드 × 종류\n\n${table(['모드', ...KINDS.map((k) => KIND_KO[k]), '합'], mk)}\n\n규칙이 하나도 없는 모드: ${empty.join(' · ') || '없음'}\n\n## 규칙의 집행\n\n${table(['집행', '규칙 수'], enf)}\n\n## 출처 문서별\n\n${src.length ? table(['문서', '단위'], src) : '(아직 없음)'}\n\n## 형식 오류\n\n${L.bad.length ? L.bad.map((b) => '- ' + b).join('\n') : '없음'}\n`;
  return out;
}

// 직접 실행할 때만 (시험이 build 를 불러도 쓰거나 출력하지 않게)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const flag = process.argv[2], out = build();
  const stale = () => Object.entries(out).filter(([name, text]) => { const p = join(ROOT, STATUS, name); return !existsSync(p) || readFileSync(p, 'utf8') !== text; });
  if (flag === '--write') for (const [name, text] of stale()) CLERK.writeStatus(name, text, ROOT);
  else if (flag === '--check') {
    const s = stale().map(([n]) => n);
    if (s.length) { console.error(`관리 파일이 낡음: ${s.join(', ')} — node rebuild/status.mjs --write`); process.exit(1); }
    console.log('관리 파일 최신');
  } else console.log(out['00-summary.md']);
}
export { build, ROOT, STATUS }; // 시험용 — 다른 코드는 쓰지 않는다
