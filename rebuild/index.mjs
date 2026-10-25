// 번호 사전 (rebuild/PLAN.md §4′) — 이름공간 표(원본 rebuild/index/namespaces.jsonl)를 읽고,
// 저장소의 번호 모양 토큰을 세어 참조 색인을 **계산**한다(저장하지 않음).
// 계약: 읽기만 한다. 형식은 가능하면 코드의 정의를 가리킨다(pattern_from) — 사본을 만들지 않는다.
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(import.meta.url);
const REG = join(ROOT, 'rebuild', 'index', 'namespaces.jsonl');
const EXC = join(ROOT, 'rebuild', 'index', 'exceptions.jsonl');

export const STATUS = ['active', 'planned', 'legacy', 'external'];
export const SHAPES = ['token', 'composite', 'chain', 'file', 'vocab'];
const FIELDS = ['ns', 'status', 'shape', 'examples', 'issuer', 'store', 'immutable', 'scan'];

// 저장소 파일 (추적 + 무시되지 않은 새 파일) — 관리 파일·번호 사전 자신은 뺀다
export function repoFiles() {
  let list;
  try { list = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 }).split('\0').filter(Boolean); }
  catch { const walk = (d) => readdirSync(join(ROOT, d), { withFileTypes: true }).flatMap((e) => (['.git', 'node_modules', 'target'].includes(e.name) ? [] : e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)])); list = walk(''); }
  return [...new Set(list)].filter((p) => !p.startsWith('rebuild/status/') && !p.endsWith('.part') && existsSync(join(ROOT, p))).sort();
}

const jsonl = (p) => (existsSync(p) ? readFileSync(p, 'utf8').split('\n').map((l, i) => [l, i + 1]).filter(([l]) => l.trim()) : []);

// pattern_from: 'model.ID_RE.T' · 'vocab.xrefs.UniProt.pattern' · 'vocab.fingerprints.InChIKey.pattern'
function resolvePattern(r) {
  if (r.pattern) return new RegExp(r.pattern);
  if (!r.pattern_from) return null;
  const [mod, ...path] = r.pattern_from.split('.');
  const src = { model: () => req('../model.js'), vocab: () => req('../vocab.js') }[mod];
  if (!src) throw new Error(`${r.ns}: pattern_from 모듈 '${mod}' 모름`);
  let v = src(); for (const k of path) v = v == null ? v : v[k];
  if (v instanceof RegExp) return v;
  if (typeof v === 'string') return new RegExp(v);
  throw new Error(`${r.ns}: pattern_from '${r.pattern_from}' 를 찾지 못함`);
}

export function registry() {
  const rows = [], bad = [], seen = new Set();
  for (const [ln, i] of jsonl(REG)) {
    let r; try { r = JSON.parse(ln); } catch { bad.push(`namespaces.jsonl:${i} JSON 아님`); continue; }
    const why = FIELDS.filter((f) => r[f] === undefined);
    if (seen.has(r.ns)) why.push('ns 중복'); seen.add(r.ns);
    if (!STATUS.includes(r.status)) why.push('status');
    if (!SHAPES.includes(r.shape)) why.push('shape');
    if (!Array.isArray(r.examples)) why.push('examples');
    if (r.shape !== 'vocab' && !r.pattern && !r.pattern_from) why.push('pattern|pattern_from');
    if (r.pattern && r.pattern_from) why.push('pattern 과 pattern_from 둘 다');
    if (r.scan && r.shape !== 'token') why.push('scan 은 token 만');
    try { r.re = resolvePattern(r); } catch (e) { why.push(e.message); }
    if (why.length) bad.push(`namespaces.jsonl:${i} ${r.ns || '?'}: ${why.join(', ')}`); else rows.push(r);
  }
  return { rows, bad };
}

// 번호 모양 (후보를 뽑는 그물) — 이 그물에 걸린 토큰은 이름공간 하나에 맞아야 한다
const NETS = [
  /\b[A-Z]{1,4}\d{4,8}\b/g,                                             // 글자 + 숫자 (T000001 · P04637 · PMC123)
  /(?<![A-Za-z0-9_])[A-Z]\+[A-Za-z0-9_]+/g,                             // 패치 임시 번호
  /\bAUDIT_[A-Z_]+\b/g,                                                 // 감사 코드
  /\b(?:TASK|RULE|DEC|CHG|PLAN|TEST|SW|EQ|MED|PMC)-\d+\b/g,             // 하이픈 번호
  /\btrig_[A-Za-z0-9]+/g,                                               // 예약 작업
];
const NET_MD = /(?<![\w.])(?:S[0-4]|D[0-4]|T|I)\.[a-z_]+\b/g;            // 신뢰 기준 번호 (문서에서만 — 코드에선 속성 접근과 겹침)
const SKIP = (p) => p.startsWith('data/fetched/') || p.startsWith('rebuild/index/') || /\.(wasm|png|jpg|gz)$/.test(p);

export function build() {
  const R = registry(), files = repoFiles();
  const exc = jsonl(EXC).map(([l]) => JSON.parse(l));
  const scanNs = R.rows.filter((r) => r.scan);
  const per = Object.fromEntries(R.rows.map((r) => [r.ns, { n: 0, tokens: new Set(), files: new Set() }]));
  const unknown = [], overlap = [];
  for (const p of files) {
    if (SKIP(p)) continue;
    let text; try { const b = readFileSync(join(ROOT, p)); if (b.includes(0)) continue; text = b.toString('utf8'); } catch { continue; }
    const md = p.endsWith('.md'), toks = [];
    for (const net of NETS) for (const m of text.matchAll(net)) toks.push(m[0]);
    if (md) for (const m of text.matchAll(NET_MD)) toks.push(m[0]);
    for (const t of toks) {
      const hit = scanNs.filter((r) => (r.scan_in !== 'md' || md) && r.re.test(t));
      if (!hit.length) { if (!exc.some((e) => e.file === p && e.token === t)) unknown.push(`${p}: ${t}`); continue; }
      if (hit.length > 1) overlap.push(`${p}: ${t} → ${hit.map((r) => r.ns).join(' · ')}`);
      const s = per[hit[0].ns]; s.n++; s.tokens.add(t); s.files.add(p);
    }
  }
  // 정의된 것 — 참조됐는데 정의되지 않은 번호(지운·옮긴 번호 포함)를 드러낸다
  const db = JSON.parse(readFileSync(join(ROOT, 'data', 'db.json'), 'utf8'));
  const moved = new Set(Object.keys(db.moved || {}));
  const defined = {};
  for (const r of R.rows) {
    if (!r.defined_by && !r.members_from) continue;
    const [kind, arg, field] = String(r.defined_by || '').split(':');
    let set = null;
    if (kind === 'db') set = new Set(Object.keys(db[arg] || {}));
    else if (kind === 'jsonl') set = new Set(jsonl(join(ROOT, arg)).map(([l]) => JSON.parse(l)[field]));
    else if (kind === 'files') set = new Set(files.filter((f) => f.startsWith(arg.replace(/\*$/, ''))).map((f) => (f.match(/TASK-\d{3}/) || [])[0]).filter(Boolean));
    if (r.members_from === 'reliability.CRITERIA') set = new Set(Object.keys(req('../judicial/reliability.js').CRITERIA));
    if (r.members_from && r.members_from.startsWith('code:')) {
      set = new Set();
      const dir = r.members_from.slice(5) + '/'; // 그 폴더 코드의 문자열 상수로 내는 코드
      for (const f of files.filter((x) => x.startsWith(dir) && /\.(js|mjs)$/.test(x))) for (const m of readFileSync(join(ROOT, f), 'utf8').matchAll(/['`](AUDIT_[A-Z_]+)['`]/g)) set.add(m[1]);
    }
    if (set) defined[r.ns] = set;
  }
  const dangling = {};
  for (const [ns, set] of Object.entries(defined)) {
    const d = [...per[ns].tokens].filter((t) => !set.has(t)).sort();
    dangling[ns] = { missing: d.filter((t) => !moved.has(t)), moved: d.filter((t) => moved.has(t)), defined: set.size };
  }
  // 예시 겹침 — 예시는 자기 이름공간에만 맞아야 한다 (정규식이 서로 갈린다는 증거)
  const shaped = R.rows.filter((r) => r.re && r.shape !== 'chain' && r.shape !== 'file');
  const exampleIssues = [];
  for (const r of R.rows) for (const ex of r.examples) {
    if (!r.re || !r.re.test(ex)) exampleIssues.push(`${r.ns}: 예시 '${ex}' 가 자기 형식에 맞지 않음`);
    const others = shaped.filter((o) => o !== r && o.re.test(ex)).map((o) => o.ns);
    if (others.length) exampleIssues.push(`${r.ns}: 예시 '${ex}' 가 다른 이름공간에도 맞음 — ${others.join(' · ')}`);
  }
  // 같은 번호 형식을 코드에 따로 적은 곳 (5·9 단계에서 하나로)
  const duplicates = [];
  for (const f of files.filter((x) => /\.(js|mjs)$/.test(x) && !x.startsWith('rebuild/'))) {
    readFileSync(join(ROOT, f), 'utf8').split('\n').forEach((l, i) => { for (const m of l.matchAll(/\/\^\[?[A-Z]+\]?\\d\{6\}\$\//g)) duplicates.push(`${f}:${i + 1} ${m[0]}`); });
  }
  const stats = Object.fromEntries(Object.entries(per).map(([k, v]) => [k, { n: v.n, distinct: v.tokens.size, files: v.files.size }]));
  return { rows: R.rows, bad: R.bad, stats, unknown: [...new Set(unknown)].sort(), overlap: [...new Set(overlap)].sort(), dangling, exampleIssues, duplicates, exceptions: exc.length };
}
