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
import * as IDX from './index.mjs'; // 번호 사전 — 파일 목록·이름공간을 한 곳에서
import * as RENDER from './render.mjs'; // 6 단계 새 구조 초안 (rebuild/draft)

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STATUS = 'rebuild/status/';
const LEDGER_DIR = join(ROOT, 'rebuild', 'ledger');

// 모드·종류·집행 (PLAN §2·§5) — 장부 검사와 표의 열 순서
const MODES = ['common', 'author', 'baseline', 'develop', 'field', 'inspect'];
const MODE_KO = { common: '공통', author: '정보 작성', baseline: '기초시험', develop: '디벨롭', field: '적분장', inspect: '점검·검증' };
const KINDS = ['rule', 'procedure', 'reason', 'value', 'history'];
const KIND_KO = { rule: '규칙', procedure: '절차', reason: '이유', value: '현재 숫자', history: '역사' };
const ENFORCE = ['machine', 'text', 'none', 'unchecked']; // unchecked = 집행 자리를 아직 확인하지 못함 (5 단계에서 확정)
// 지금의 입구 문서 (각자 "먼저 읽어라" 라고 하는 곳) · direction 이 정한 부팅 읽기
const ENTRY = ['CLAUDE.md', 'docs/design/direction.md', 'docs/RUNBOOK.md', 'docs/textbook/00-목차.md', 'docs/PROMPTS.md', 'workspace/START-HERE.md'];
const BOOT = ['CLAUDE.md', 'docs/design/direction.md', 'docs/design/authority-and-comprehension.md', 'docs/design/tripartite-governance.md',
  'docs/design/dictionary-and-translation.md', 'docs/design/conservation-classes.md', 'docs/design/work-verification.md', 'docs/design/build-plan.md'];
// 생성물 (분류 대상이 아님 — 원천에서 다시 만든다)
const GENERATED = ['limitations.md', 'docs/textbook/90-부록-자동생성.md', 'index.html'];

// ── 저장소 파일 목록 (추적 + 무시되지 않은 새 파일, 관리 파일 자신은 뺌 — 자기 크기를 세면 고정점이 없다)
function files() {
  return IDX.repoFiles().map((p) => ({ path: p, bytes: statSync(join(ROOT, p)).size }));
}
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const lines = (p) => read(p).split('\n').length - (read(p).endsWith('\n') ? 1 : 0);
const kb = (n) => (n / 1024).toFixed(1);
const top = (p) => (p.includes('/') ? p.split('/')[0] : '(최상위)');
const table = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
const sum = (xs) => xs.reduce((a, b) => a + b, 0);

// ── 장부 (rebuild/ledger/*.jsonl)
function ledger(reg) {
  const units = [], bad = [], U = (reg.find((r) => r.ns === 'ledger_unit') || {}).re || /^U\d{4,}$/;
  const fs = existsSync(LEDGER_DIR) ? readdirSync(LEDGER_DIR).filter((f) => f.endsWith('.jsonl')).sort() : [];
  const seen = new Set();
  for (const f of fs) read(join('rebuild/ledger', f)).split('\n').forEach((ln, i) => {
    if (!ln.trim()) return;
    const at = `${f}:${i + 1}`;
    let u; try { u = JSON.parse(ln); } catch { bad.push(`${at} JSON 아님`); return; }
    const why = [];
    if (!U.test(u.id || '')) why.push('id');
    else if (seen.has(u.id)) why.push('id 중복'); else seen.add(u.id);
    if (!u.src || !/:(\d+|\*)$/.test(u.src.replace(/:\d+.*$/, (m) => m.split(' ')[0]))) why.push('src(파일:줄 또는 파일:* — 자라는 기록은 파일 전체)');
    if (!u.text) why.push('text');
    if (!MODES.includes(u.mode)) why.push('mode');
    if (!KINDS.includes(u.kind)) why.push('kind');
    if (!ENFORCE.includes(u.enforce)) why.push('enforce');
    if (u.enforce === 'machine' && !u.where) why.push('where(집행 자리)');
    if (why.length) bad.push(`${at} ${u.id || '?'}: ${why.join(', ')}`); else units.push({ ...u, file: f });
  });
  // 집행 자리 확인: where 에 적힌 파일이 있고, 파일 뒤에 적은 이름(함수·시험 번호)이 그 파일에 나오나 — 이름이 없으면 파일만 본다
  for (const x of units) {
    if (x.enforce !== 'machine') continue;
    const parts = x.where.split(' · ').map((w) => w.trim()), miss = [];
    for (const w of parts) {
      const m = w.match(/^([\w./-]+\.(?:jsonl|json|mjs|js|yml|md))(?:\s+([^\s(]+))?/);
      if (!m) continue; // 'CI …' · '시나리오 입력 해시' 같은 글 — 확인 못 함
      const f = m[1].replace(/^\.github\/workflows\//, '.github/workflows/');
      if (!existsSync(join(ROOT, f))) { miss.push(`파일 없음 ${f}`); continue; }
      const name = m[2];
      if (name && !/^[①-⑳]/.test(name) && !read(f).includes(name)) miss.push(`${f} 에 '${name}' 없음`);
    }
    x.whereCheck = miss.length ? miss : parts.some((w) => /\.(js|mjs|json|jsonl|yml|md)\b/.test(w)) ? 'ok' : 'text_only';
  }
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
  const X = IDX.build(), all = files(), by = Object.fromEntries(all.map((f) => [f.path, f.bytes])), L = ledger(X.rows), C = codeCounts(all);
  const docs = all.filter((f) => f.path.endsWith('.md') && !/^(data|rebuild|tests)\//.test(f.path));
  const classified = new Set(L.units.map((u) => u.src.replace(/:(\d+.*|\*)$/, '')));
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
    ['번호 이름공간', `${X.rows.length} (${IDX.STATUS.map((st) => `${st} ${X.rows.filter((r) => r.status === st).length}`).join(' · ')})`],
    ['미등록 번호 모양 / 겹침 / 예외', `${X.unknown.length} / ${X.overlap.length} / ${X.exceptions}`],
    ['같은 번호 형식을 코드에 따로 적은 곳', String(X.duplicates.length)],
    ['규칙 장부 RULE', String(existsSync(join(ROOT, 'rebuild/rules/rules.jsonl')) ? read('rebuild/rules/rules.jsonl').split('\n').filter((l) => l.trim()).length : 0)],
  ];
  // 요약(00)은 08 맥락까지 계산한 뒤 아래에서 만든다

  // 01 파일
  const dirs = {};
  for (const f of all) { const d = (dirs[top(f.path)] ||= { n: 0, b: 0 }); d.n++; d.b += f.bytes; }
  const dirRows = Object.entries(dirs).sort((a, b) => b[1].b - a[1].b || (a[0] < b[0] ? -1 : 1)).map(([d, v]) => [d, String(v.n), kb(v.b)]);
  const big = [...all].sort((a, b) => b.bytes - a.bytes || (a.path < b.path ? -1 : 1)).slice(0, 25).map((f) => [`\`${f.path}\``, kb(f.bytes)]);
  out['01-files.md'] = `# 파일\n\n${note}\n## 최상위 폴더별\n\n${table(['폴더', '파일', 'KB'], dirRows)}\n\n## 큰 파일 25\n\n${table(['파일', 'KB'], big)}\n`;

  // 02 문서
  const unitsBy = {}; for (const u of L.units) { const s = u.src.replace(/:(\d+.*|\*)$/, ''); unitsBy[s] = (unitsBy[s] || 0) + 1; }
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
  const mach = L.units.filter((u) => u.enforce === 'machine'), wbad = mach.filter((u) => Array.isArray(u.whereCheck));
  const wtext = `집행 자리 확인 (machine ${mach.length}): 파일·이름 확인 ${mach.filter((u) => u.whereCheck === 'ok').length} · 글로만 적힘 ${mach.filter((u) => u.whereCheck === 'text_only').length} · 못 찾음 ${wbad.length}${wbad.length ? '\n\n' + wbad.map((u) => `- ${u.id} (${u.src}): ${u.whereCheck.join(' · ')}`).join('\n') : ''}\n\n이 확인은 '자리가 있다' 까지다 — 그 자리가 정말 그 규칙을 집행하는지는 5 단계에서 거부 시험으로 확인한다.`;
  // 사본(same_as)과 빠진 줄 — 1 단계 끝 조건 '모든 문장이 단위 하나 이상'
  const ids = new Set(L.units.map((u) => u.id)), copies = L.units.filter((u) => Array.isArray(u.same_as) && u.same_as.length);
  const badRef = copies.flatMap((u) => u.same_as.filter((r) => !ids.has(r)).map((r) => `${u.id} → ${r}`));
  const refd = {}; for (const u of copies) for (const r of u.same_as) refd[r] = (refd[r] || 0) + 1;
  const places = Object.values(refd), multi = places.length;
  const covRows = Object.keys(unitsBy).sort().map((s) => {
    if (L.units.some((u) => u.src === s + ':*')) return [`\`${s}\``, '파일 전체', '없음'];
    const have = new Set(L.units.filter((u) => u.src.replace(/:\d+.*$/, '') === s).map((u) => +u.src.split(':')[1]));
    const ls = read(s).split('\n');
    const miss = ls.map((l, i) => [l, i + 1]).filter(([l, n]) => l.trim() && !/^\|?\s*:?-{3}/.test(ls[n] || '') && !/^#{1,6} /.test(l) && !/^\|?\s*-{3}/.test(l) && !/^\|[^|]*\|\s*$/.test(l) && !/^```/.test(l) && !/^>\s*$/.test(l) && !have.has(n)).map(([, n]) => n);
    return [`\`${s}\``, String(have.size), miss.length ? miss.join(' · ') : '없음'];
  });
  const heur = L.units.filter((u) => u.by === 'heur').length, eqs = L.units.filter((u) => /수식 후보/.test(u.note || '')).length;
  const byText = `매긴 방식: 판단 ${L.units.length - heur} · 휴리스틱 ${heur} (\`by: heur\` — 검토 전, 5 단계에서 규칙부터 다시 봄) · 수식 후보(EQ) ${eqs}`;
  const dupText = `사본 단위(same_as) ${copies.length} · 사본이 있는 원래 단위 ${multi} · 한 규칙이 적힌 곳 최대 ${multi ? Math.max(...places) + 1 : 1}${badRef.length ? ' · 없는 단위를 가리킴: ' + badRef.join(', ') : ''}`;
  const src = Object.entries(unitsBy).sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([s, n]) => [`\`${s}\``, String(n)]);
  out['04-ledger.md'] = `# 분류 장부 (rebuild/ledger/*.jsonl)\n\n${note}\n장부 파일: ${L.files.join(' · ') || '없음'} · 단위 ${L.units.length}\n\n## 모드 × 종류\n\n${table(['모드', ...KINDS.map((k) => KIND_KO[k]), '합'], mk)}\n\n규칙이 하나도 없는 모드: ${empty.join(' · ') || '없음'}\n\n## 규칙의 집행\n\n${table(['집행', '규칙 수'], enf)}\n\n${wtext}\n\n## 출처 문서별\n\n${src.length ? table(['문서', '단위'], src) : '(아직 없음)'}\n\n## 사본\n\n${dupText}\n\n${byText}\n\n## 단위가 없는 줄 (제목·표 머리·빈 줄 제외 — 0 이어야 1 단계 끝)\n\n${covRows.length ? table(['문서', '단위가 있는 줄', '빠진 줄'], covRows) : '(아직 없음)'}\n\n## 형식 오류\n\n${L.bad.length ? L.bad.map((b) => '- ' + b).join('\n') : '없음'}\n`;
  // 05 번호 사전 (rebuild/index/namespaces.jsonl + 계산된 참조 색인)
  const nsRows = X.rows.map((r) => { const st = X.stats[r.ns], d = X.dangling[r.ns];
    return [`\`${r.ns}\``, r.status, r.shape, `\`${r.pattern || r.pattern_from || '—'}\``.replace(/\|/g, '\\|'), r.issuer, `\`${r.store}\``, r.scan ? `${st.n} · ${st.distinct} · ${st.files}` : '—',
      d ? `${d.defined} · 없음 ${d.missing.length}${d.moved.length ? ` · 옮김 ${d.moved.length}` : ''}` : '—']; });
  const dl = Object.entries(X.dangling).filter(([, d]) => d.missing.length).map(([ns, d]) => `- \`${ns}\`: ${d.missing.join(' · ')}`);
  const li = (xs) => (xs.length ? xs.map((x) => '- ' + x).join('\n') : '없음');
  out['05-index.md'] = `# 번호 사전\n\n${note}\n원본: \`rebuild/index/namespaces.jsonl\` (이름공간 ${X.rows.length}) · 예외 \`rebuild/index/exceptions.jsonl\` (${X.exceptions}). 참조 색인은 저장하지 않고 계산한다.\n\n## 이름공간\n\n토큰 = 저장소에 나온 수 · 고유 · 파일 / 정의 = 정의된 수 · 가리켜졌는데 정의 안 됨\n\n${table(['이름공간', '상태', '모양', '형식', '발급', '자리', '토큰', '정의'], nsRows)}\n\n## 미등록 번호 모양 (0 이어야 함)\n\n${li(X.unknown)}\n\n## 겹침 (0 이어야 함)\n\n${li([...X.overlap, ...X.exampleIssues])}\n\n## 가리켜졌는데 정의되지 않은 번호 (지운 번호·시험용 가짜 번호·다음 번호 포함 — 정보)\n\n${dl.length ? dl.join('\n') : '없음'}\n\n## 같은 번호 형식을 코드에 따로 적은 곳 (5·9 단계에서 하나로)\n\n${li(X.duplicates)}\n\n## 이름공간 표 형식 오류\n\n${li(X.bad)}\n`;
  // 07 규칙 장부 (rebuild/rules/rules.jsonl) — 판단으로 매긴 원래 규칙 단위마다 RULE 하나, 사본은 copies
  const RP = 'rebuild/rules/rules.jsonl', rules7 = existsSync(join(ROOT, RP)) ? read(RP).split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)) : [];
  const uid = Object.fromEntries(L.units.map((u) => [u.id, u])), rbad = [], seenR = new Set(), seenU = new Map(), bundle = {};
  const RULE_RE = (X.rows.find((r) => r.ns === 'rule') || {}).re || /^RULE-\d{4}$/;
  for (const r of rules7) {
    if (!RULE_RE.test(r.id) || seenR.has(r.id)) rbad.push(`${r.id}: 번호`); seenR.add(r.id);
    if (r.from_code) { if (r.unit) rbad.push(`${r.id}: 코드에서 찾은 규칙(from_code)인데 단위가 있음`); if (r.enforce !== 'machine' || !r.where) rbad.push(`${r.id}: 코드에서 찾은 규칙은 machine + where`); if (!(r.modes || []).every((m) => MODES.includes(m))) rbad.push(`${r.id}: 모드`); continue; } // 5d — 문서 단위 없이 코드의 검사 자리에서 온 규칙
    const u = uid[r.unit];
    if (!u) { rbad.push(`${r.id}: 없는 단위 ${r.unit}`); continue; }
    if (u.kind !== 'rule') rbad.push(`${r.id}: ${r.unit} 는 규칙 단위가 아님`);
    if (seenU.has(r.unit)) rbad.push(`원래 단위 ${r.unit} 가 ${seenU.get(r.unit)} · ${r.id} 둘에`); seenU.set(r.unit, r.id);
    for (const x of r.copies || []) { if (!uid[x]) rbad.push(`${r.id}: 없는 단위 ${x}`); bundle[x] = (bundle[x] || 0) + 1; }
    if (!(r.modes || []).every((m) => MODES.includes(m))) rbad.push(`${r.id}: 모드`);
  }
  const judged = L.units.filter((u) => u.kind === 'rule' && u.by !== 'heur' && !u.same_as).map((u) => u.id), noRule = judged.filter((x) => !seenU.has(x));
  // 은퇴(retired)·예약(reserved) — 은퇴 규칙은 보관 파일에 있어야 하고, 예약은 이유(note)가 있어야 한다
  for (const r of rules7) {
    if (r.retired) { const a = r.retired.archive; if (!a || !existsSync(join(ROOT, a))) rbad.push(`${r.id}: 은퇴 보관 파일 '${a}' 없음`); else if (!read(a).includes(`"${r.id}"`)) rbad.push(`${r.id}: 보관 파일 ${a} 에 이 규칙이 없음`); }
    if (r.reserved && !(r.reserved.note && r.reserved.for)) rbad.push(`${r.id}: 예약에 note·for 가 없음`);
  }
  const retired7 = rules7.filter((r) => r.retired), reserved7 = rules7.filter((r) => r.reserved);
  const lifeText = `살아 있는 규칙 ${rules7.length - retired7.length} · 은퇴 ${retired7.length}${retired7.length ? ' (' + [...new Set(retired7.map((r) => r.retired.archive))].map((a) => `\`${a}\``).join(' · ') + ')' : ''} · 예약 ${reserved7.length}${reserved7.length ? '\n\n' + table(['규칙', '예약 대상', '맥락'], reserved7.map((r) => [r.id, r.reserved.for, r.reserved.note.replace(/\|/g, '\\|')])) : ''}`;
  const enf7 = ENFORCE.map((e) => [e, String(rules7.filter((r) => r.enforce === e).length)]);
  const multi7 = rules7.filter((r) => r.modes.length > 1), places7 = rules7.map((r) => 1 + (r.copies || []).length);
  const hist = [1, 2, 3, 4, 5].map((k) => [k === 5 ? '5 곳 이상' : `${k} 곳`, String(places7.filter((p) => (k === 5 ? p >= 5 : p === k)).length)]);
  const heurRules = L.units.filter((u) => u.kind === 'rule' && u.by === 'heur').length;
  const bundled = Object.entries(bundle).filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
  out['07-rules.md'] = `# 규칙 장부\n\n${note}\n원본: \`${RP}\` · 규칙 ${rules7.length} (판단으로 매긴 원래 규칙 단위마다 하나, 사본은 copies). 휴리스틱으로 매긴 규칙 단위 ${heurRules} 은 아직 장부에 묶지 않음.\n\n## 은퇴 · 예약\n\n${lifeText}\n\n## 집행\n\n${table(['집행', '규칙'], enf7)}\n\n## 한 규칙이 적힌 곳\n\n${table(['곳', '규칙'], hist)}\n\n## 여러 모드에 걸친 규칙 ${multi7.length} (6 단계 모드 문서에서 빠지면 안 되는 것)\n\n${multi7.length ? table(['규칙', '모드', '내용'], multi7.map((r) => [r.id, r.modes.join(' · '), r.text.replace(/\|/g, '\\|').slice(0, 120)])) : '없음'}\n\n## 규칙 여러 개를 한 문장에 묶은 사본 ${bundled.length} (나누면 6 단계 모드 문서가 정확해짐)\n\n${bundled.length ? bundled.slice(0, 30).map(([u, n]) => `${u} (${uid[u].src}) → 규칙 ${n}`).join(' · ') + (bundled.length > 30 ? ' · …' : '') : '없음'}\n\n## 장부에 없는 판단 규칙 단위 (0 이어야 함)\n\n${noRule.length ? noRule.join(' · ') : '없음'}\n\n## 형식 오류\n\n${rbad.length ? rbad.map((x) => '- ' + x).join('\n') : '없음'}\n`;

  // 08 맥락 (PLAN §5′) — ① 자리 맥락(단위 ctx, 원문에서 계산) ② 관계 맥락(rebuild/rules/links.jsonl, 규칙마다 판정 행 하나 이상)
  const LP = 'rebuild/rules/links.jsonl', links = existsSync(join(ROOT, LP)) ? read(LP).split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)) : [];
  const ruleId = new Set(rules7.map((r) => r.id)), lbad = [];
  // 먼 곳 대상: CHG-…(CHANGES.md 행, 아래부터 순번 — anchor 가 그 행 첫 칸과 같아야) · code:경로(머리 주석이 있는 코드 파일) · L…(한계)
  const chgRows = read('CHANGES.md').split('\n').filter((l) => l.startsWith('| 20'));
  const chgHead = (t) => { const k = +t.slice(4); return k >= 1 && k <= chgRows.length ? chgRows[chgRows.length - k].split('|')[1].trim() : null; };
  const lims = new Set(Object.keys(JSON.parse(read('data/db.json')).limitations || {}));
  const codeHead = (t) => { const f = t.slice(5); return existsSync(join(ROOT, f)) && /^\s*(\/\/|\/\*)/.test(read(f)); };
  const isReport = (t) => /^docs\/reports\//.test(uid[t]?.src || ''); // 보고서 문장은 휴리스틱으로 대부분 history — 이유로도 경위로도 이을 수 있다
  const isPatch = (t) => /^patch:[^/]+\.json$/.test(t) && existsSync(join(ROOT, 'data', 'patches', t.slice(6)));
  const far = (t) => (/^CHG-\d{4}$/.test(t) && chgHead(t) !== null) || (/^code:/.test(t) && codeHead(t)) || lims.has(t) || isReport(t) || isPatch(t);
  const TARGET = { because: (t) => uid[t]?.kind === 'reason' || far(t), decided_by: (t) => uid[t]?.kind === 'history' || /^TASK-\d{3}$/.test(t) || far(t), contradicts: (t) => ruleId.has(t), supersedes: (t) => ruleId.has(t) || !!uid[t], exception_of: (t) => ruleId.has(t) };
  const srcOf = (t) => (!t ? '규칙 문장 안' : isReport(t) ? '보고서' : /^patch:/.test(t) ? '패치 why' : /^U/.test(t) ? '문서' : /^CHG-/.test(t) ? '변경 기록' : /^code:/.test(t) ? '코드 머리 주석' : /^L\d/.test(t) ? '한계' : '과제');
  const NO_TARGET = ['inline', 'none'], BY = ['judged', 'auto'];
  const judgedR = new Set();
  links.forEach((l, i) => {
    const at = `links.jsonl:${i + 1}`;
    if (!ruleId.has(l.from)) lbad.push(`${at} 없는 규칙 ${l.from}`);
    if (!BY.includes(l.by)) lbad.push(`${at} by '${l.by}'`);
    if (NO_TARGET.includes(l.rel)) { if (l.to !== undefined) lbad.push(`${at} ${l.rel} 는 to 가 없다`); }
    else if (!TARGET[l.rel]) lbad.push(`${at} 모르는 관계 '${l.rel}'`);
    else if (!TARGET[l.rel](l.to)) lbad.push(`${at} ${l.rel} → ${l.to} (대상 종류가 맞지 않음)`);
    if (/^CHG-/.test(l.to || '') && l.anchor !== chgHead(l.to)) lbad.push(`${at} ${l.to} 의 anchor '${l.anchor}' ≠ 그 행 '${chgHead(l.to)}' (행이 바뀌었거나 번호가 밀림)`);
    if (l.by === 'auto' && l.basis !== 'in_text') lbad.push(`${at} 자동 연결은 본문 번호(in_text)만 — 문단 근처는 판정한다`);
    judgedR.add(l.from);
  });
  const noJudge = rules7.filter((r) => !judgedR.has(r.id)).map((r) => r.id);
  const relOf = (r) => new Set(links.filter((l) => l.from === r.id).map((l) => l.rel));
  const why = rules7.filter((r) => { const s = relOf(r); return s.has('because') || s.has('inline'); });
  const onlyHist = rules7.filter((r) => { const s = relOf(r); return s.has('decided_by') && !s.has('because') && !s.has('inline'); });
  const none = rules7.filter((r) => relOf(r).has('none') && !r.retired);
  const relRows = ['because', 'inline', 'decided_by', 'none', 'contradicts', 'supersedes', 'exception_of'].map((k) => [k, String(links.filter((l) => l.rel === k).length), String(new Set(links.filter((l) => l.rel === k).map((l) => l.from)).size)]);
  const srcRows = ['문서', '규칙 문장 안', '변경 기록', '코드 머리 주석', '한계', '보고서', '패치 why', '과제'].map((k) => { const ls = links.filter((l) => ['because', 'inline', 'decided_by'].includes(l.rel) && srcOf(l.to) === k); return [k, String(ls.length), String(new Set(ls.map((l) => l.from)).size)]; });
  const dupL = Object.entries(links.reduce((a, l) => { const k = `${l.from}|${l.rel}|${l.to || ''}`; a[k] = (a[k] || 0) + 1; return a; }, {})).filter(([, n]) => n > 1).map(([k]) => '겹친 연결 ' + k);
  lbad.push(...dupL);
  const noneByMode = MODES.map((m) => [MODE_KO[m] + ` \`${m}\``, String(rules7.filter((r) => r.modes.includes(m)).length), String(why.filter((r) => r.modes.includes(m)).length), String(none.filter((r) => r.modes.includes(m)).length)]);
  // 자리 맥락: 규칙의 원래 단위 기준
  const ru = rules7.map((r) => uid[r.unit]).filter(Boolean), cbad = [];
  for (const u of L.units) for (const k of ['lead', 'sentence_of']) { const v = u.ctx?.[k]; if (v && !uid[v] && !/:\d+$/.test(v)) cbad.push(`${u.id}: ctx.${k} '${v}'`); }
  const tableNoHead = ru.filter((u) => /^\s*\|/.test(read(u.src.replace(/:\d+$/, '')).split('\n')[+u.src.split(':')[1] - 1] || '') && !u.ctx?.table).map((u) => u.id);
  const frag = rules7.filter((r) => uid[r.unit]?.ctx?.sentence_of);
  const posRows = [
    ['절 경로(path)', String(ru.filter((u) => u.ctx?.path?.length).length)],
    ['표 줄 — 머리와 칸(table)', String(ru.filter((u) => u.ctx?.table).length)],
    ['목록 항목 — 머리 문장(lead)', String(ru.filter((u) => u.ctx?.lead).length)],
    ['여러 줄 문장의 첫 줄 — 문장 전체(sentence)', String(ru.filter((u) => u.ctx?.sentence).length)],
    ['문장 조각 — 앞 줄에서 이어짐(sentence_of)', String(frag.length)],
    ['코드 블록 안(code)', String(ru.filter((u) => u.ctx?.code).length)],
  ];
  const contra = links.filter((l) => l.rel === 'contradicts').map((l) => `${l.from} ↔ ${l.to} — ${l.basis || ''}`);
  out['08-context.md'] = `# 맥락\n\n${note}\n규칙 ${rules7.length} 의 맥락. ① 자리 맥락은 원문에서 계산해 단위의 \`ctx\` 에 둔다. ② 관계 맥락은 \`${LP}\` (${links.length} 행) — 규칙마다 판정 행이 하나 이상이다. 대상은 문서 단위(U…, 보고서 문장 포함)·변경 기록 행(CHG-…, 아래부터 순번)·코드 머리 주석(code:경로)·한계(L…)·패치 why(patch:파일). 근처 문단의 이유는 자동으로 잇지 않는다(시험해 보니 대부분 다른 규칙의 이유였다) — 판정만 잇는다. ③ 조건 맥락(when·must·unless·else)은 5c 에서.\n\n## ① 자리 맥락 (규칙의 원래 단위)\n\n${table(['무엇', '규칙'], posRows)}\n\n## ② 관계 맥락\n\n${table(['관계', '행', '규칙'], relRows)}\n\n이유가 있는 규칙 ${why.length} · 경위만 있는 규칙 ${onlyHist.length} · 이유를 찾지 못한 규칙 ${none.length} (문서 근처·변경 기록·코드 머리 주석·한계·보고서·패치 why 를 모두 본 뒤, 은퇴 규칙 제외)\n\n## 이유가 있던 자리\n\n${table(['자리', '연결', '규칙'], srcRows)}\n\n## 모드별 — 이유를 찾지 못한 규칙 (6 단계 모드 문서에서 이유를 채울 곳)\n\n${table(['모드', '규칙', '이유 있음', '이유 없음'], noneByMode)}\n\n## 모순\n\n${li(contra)}\n\n## 문장 조각인 규칙 ${frag.length} (앞 줄과 함께 읽어야 뜻이 선다)\n\n${frag.length ? frag.map((r) => `${r.id} ← ${uid[r.unit].ctx.sentence_of}`).join(' · ') : '없음'}\n\n## 판정 행이 없는 규칙 (0 이어야 함)\n\n${noJudge.length ? noJudge.join(' · ') : '없음'}\n\n## 표 줄인데 머리가 없는 규칙 (0 이어야 함)\n\n${tableNoHead.length ? tableNoHead.join(' · ') : '없음'}\n\n## 형식 오류\n\n${li([...lbad, ...cbad])}\n`;

  // 09 규칙 검토 (rebuild/rules/review.jsonl) — 현실과 안 맞거나 존재 의의가 흐린 규칙. 6 단계 옛 규칙 대조의 확인 목록
  const VP = 'rebuild/rules/review.jsonl', review = existsSync(join(ROOT, VP)) ? read(VP).split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)) : [];
  const ISSUE = { stale: '현실과 안 맞음', obsolete_by_design: '재건이 없앨 것', unused_layer: '쓰이지 않는 층', no_consumer: '검사만 하고 쓰는 곳 없음', naming_collision: '이름이 두 뜻', unreachable: '아직 닿을 대상이 없음', unclear: '뜻이 서지 않음', number_unexplained: '숫자 근거 없음', loosely_followed: '느슨하게 지켜짐', weakness_reported: '보고서가 지적한 약점', broken_before: '실제로 구멍이 났던 규칙', enforcement_gap: '망가뜨려도 시험이 못 잡음' };
  const vbad = review.flatMap((x, i) => [!ruleId.has(x.rule) && `review.jsonl:${i + 1} 없는 규칙 ${x.rule}`, !ISSUE[x.issue] && `review.jsonl:${i + 1} 모르는 종류 '${x.issue}'`, !(x.evidence && x.proposal) && `review.jsonl:${i + 1} 근거·제안이 없음`, x.decision && !(x.decision.at && x.decision.by && x.decision.choice) && `review.jsonl:${i + 1} 결정에 at·by·choice 가 없음`].filter(Boolean));
  const rmap = Object.fromEntries(rules7.map((r) => [r.id, r]));
  const vSec = Object.entries(ISSUE).map(([k, ko]) => { const xs = review.filter((x) => x.issue === k); if (!xs.length) return '';
    return `## ${ko} \`${k}\` — ${new Set(xs.map((x) => x.rule)).size}\n\n${table(['규칙', '집행', '내용', '근거', '제안', '결정'], xs.map((x) => [x.rule, rmap[x.rule]?.enforce || '?', (rmap[x.rule]?.text || '').replace(/\|/g, '\\|').slice(0, 70), x.evidence.replace(/\|/g, '\\|'), x.proposal.replace(/\|/g, '\\|'), x.decision ? `${x.decision.at} ${x.decision.by}: ${x.decision.choice}`.replace(/\|/g, '\\|') : '—']))}\n\n`; }).join('');
  out['09-review.md'] = `# 규칙 검토\n\n${note}\n원본: \`${VP}\` (${review.length} 행 · 규칙 ${new Set(review.map((x) => x.rule)).size}). 규칙이 가리키는 파일·명령·이름·숫자를 지금 저장소와 대조하고, 실제로 쓰이는지·뜻이 서는지 본 결과. 6 단계 옛 규칙 대조에서 사용자가 확인할 목록이다 — 여기서 규칙을 고치지 않는다. 결정된 것 ${review.filter((x) => x.decision).length} 행.\n\n${table(['종류', '규칙'], Object.entries(ISSUE).map(([k, ko]) => [ko, String(new Set(review.filter((x) => x.issue === k).map((x) => x.rule)).size)]))}\n\n${vSec}## 형식 오류\n\n${li(vbad)}\n`;
  // 10 집행 변이 시험 (rebuild/rules/enforcement.jsonl · tests/mutation/run.mjs) — machine 규칙의 집행 자리를 망가뜨려 시험이 빨개지는지
  const EP = 'rebuild/rules/enforcement.jsonl', mut = existsSync(join(ROOT, EP)) ? read(EP).split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)) : [];
  const OPS = ['disable', 'replace', 'inject', 'delete', 'static', 'test_only'];
  const RES = { caught: '잡음', missed: '놓침 (집행 구멍)', present: '설정에 있음', present_template: '본보기에만 있음 (켜지지 않음)', absent: '설정에 없음', test_passes: '시험 통과 (자리 변이 없음)', test_fails: '시험 실패', error: '변이 자리 못 찾음' };
  const gapRev = new Set(review.filter((x) => x.issue === 'enforcement_gap').map((x) => x.rule)), seenE = new Set();
  const ebad = mut.flatMap((x, i) => { const at = `enforcement.jsonl:${i + 1}`, dup = seenE.has(x.rule); seenE.add(x.rule);
    return [!ruleId.has(x.rule) && `${at} 없는 규칙 ${x.rule}`, ruleId.has(x.rule) && rmap[x.rule].enforce !== 'machine' && `${at} ${x.rule} 은 machine 이 아님`, dup && `${at} ${x.rule} 이 두 번`,
      !OPS.includes(x.op) && `${at} 모르는 op '${x.op}'`, !RES[x.result] && `${at} 모르는 결과 '${x.result}'`, !x.at && `${at} at(시험한 날) 없음`,
      x.op !== 'test_only' && !(x.file && existsSync(join(ROOT, x.file))) && `${at} 파일 없음 ${x.file}`,
      x.result === 'missed' && !gapRev.has(x.rule) && `${at} ${x.rule} 놓침인데 review.jsonl 에 enforcement_gap 이 없음`].filter(Boolean); });
  const machine = rules7.filter((r) => r.enforce === 'machine' && !r.retired), untested = machine.filter((r) => !seenE.has(r.id));
  const eRows = Object.entries(RES).map(([k, ko]) => [ko + ` \`${k}\``, String(mut.filter((x) => x.result === k).length)]).filter((r) => r[1] !== '0');
  const eSec = Object.keys(RES).map((k) => { const xs = mut.filter((x) => x.result === k); if (!xs.length) return '';
    return `## ${RES[k]} \`${k}\` — ${xs.length}\n\n${table(['규칙', '내용', '변이', '파일', '빨개진 시험 · 메모'], xs.map((x) => [x.rule, (rmap[x.rule]?.text || '').replace(/\|/g, '\\|').slice(0, 60), x.op, x.file || (x.tests || []).join(' '), (x.red || x.error || x.note || '').replace(/\|/g, '\\|').slice(0, 90)]))}\n\n`; }).join('');
  out['10-enforcement.md'] = `# 집행 변이 시험\n\n${note}\n원본: \`${EP}\` (${mut.length} 행) · 다시 돌리기: \`node tests/mutation/run.mjs --spec ${EP} --check --jobs 3\`. "기계가 막는다(machine)" 는 규칙의 집행 자리를 저장소 밖 사본에서 일부러 망가뜨리고, 시험이 하나라도 빨개지면 잡음, 모두 통과하면 놓침이다. 놓침은 \`rebuild/rules/review.jsonl\` 의 \`enforcement_gap\` 으로 사용자 확인을 기다린다.\n\n${table(['결과', '규칙'], [...eRows, ['아직 시험 안 함 (machine)', String(untested.length)]])}\n\n## 형식 오류\n\n${ebad.length ? ebad.map((x) => '- ' + x).join('\n') : '없음'}\n\n${eSec}## 아직 시험 안 함 — ${untested.length}\n\n${untested.length ? table(['규칙', '집행 자리'], untested.map((r) => [r.id, (r.where || '').replace(/\|/g, '\\|').slice(0, 100)])) : '없음'}\n`;
  rows.push(['집행 변이 시험 — 잡음 / 놓침 / 아직 안 함', `${mut.filter((x) => x.result === 'caught').length} / ${mut.filter((x) => x.result === 'missed').length} / ${untested.length}`]);
  rows.push(['규칙 검토 — 결정 남은 규칙 / 전체', `${new Set(review.filter((x) => !x.decision).map((x) => x.rule)).size} / ${new Set(review.map((x) => x.rule)).size}`]);
  rows.push(['규칙 맥락 — 이유 있음 / 경위만 / 찾지 못함', `${why.length} / ${onlyHist.length} / ${none.length}`]);
  out['00-summary.md'] = `# 재건 관리 — 요약\n\n${note}\n${table(['무엇', '지금'], rows)}\n\n자세히: [01 파일](01-files.md) · [02 문서](02-docs.md) · [03 명령·판정·시험](03-commands-checks.md) · [04 분류 장부](04-ledger.md) · [05 번호 사전](05-index.md) · [06 파일 → 모드](06-file-modes.md) · [07 규칙 장부](07-rules.md) · [08 맥락](08-context.md) · [09 규칙 검토](09-review.md) · [10 집행 시험](10-enforcement.md)\n`;

  // 06 파일 → 모드 (rebuild/index/file-modes.jsonl, 첫 규칙이 이긴다)
  const fm = read('rebuild/index/file-modes.jsonl').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
  const glob = (p) => new RegExp('^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*') + '$');
  const rules = fm.map((r) => ({ ...r, re: glob(r.pattern), n: 0, b: 0 })), unmatched = [], badMode = fm.filter((r) => !MODES.includes(r.mode)).map((r) => r.pattern);
  const perMode = Object.fromEntries(MODES.map((m) => [m, { n: 0, b: 0 }]));
  for (const f of all) { const r = rules.find((x) => x.re.test(f.path)); if (!r) { unmatched.push(f.path); continue; } r.n++; r.b += f.bytes; if (perMode[r.mode]) { perMode[r.mode].n++; perMode[r.mode].b += f.bytes; } }
  const unused = rules.filter((r) => !r.n).map((r) => r.pattern);
  out['06-file-modes.md'] = `# 파일 → 모드\n\n${note}\n원본: \`rebuild/index/file-modes.jsonl\` (규칙 ${fm.length}, 위에서부터 첫 규칙이 이긴다). 파일마다 어느 모드가 주로 건드리는지.\n\n## 모드별\n\n${table(['모드', '파일', 'KB'], MODES.map((m) => [MODE_KO[m] + ` \`${m}\``, String(perMode[m].n), kb(perMode[m].b)]))}\n\n## 규칙별\n\n${table(['형식', '모드', '파일', 'KB', '왜'], rules.map((r) => [`\`${r.pattern}\``, r.mode, String(r.n), kb(r.b), r.why]))}\n\n## 규칙에 맞지 않는 파일 (0 이어야 함)\n\n${unmatched.length ? unmatched.map((x) => '- ' + x).join('\n') : '없음'}\n\n## 아무 파일에도 맞지 않는 규칙 · 모르는 모드\n\n${[...unused, ...badMode.map((x) => x + ' (모드)')].map((x) => '- ' + x).join('\n') || '없음'}\n`;
  return out;
}

// 직접 실행할 때만 (시험이 build 를 불러도 쓰거나 출력하지 않게)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const flag = process.argv[2], out = build(), drafts = RENDER.build(ROOT);
  const staleIn = (dir, o) => Object.entries(o).filter(([name, text]) => { const p = join(ROOT, dir, name); return !existsSync(p) || readFileSync(p, 'utf8') !== text; });
  const stale = () => [...staleIn(STATUS, out), ...staleIn('rebuild/draft/', drafts).map(([n, t]) => ['../draft/' + n, t])];
  if (flag === '--write') { for (const [name, text] of staleIn(STATUS, out)) CLERK.writeStatus(name, text, ROOT); for (const [name, text] of staleIn('rebuild/draft/', drafts)) CLERK.writeDraftDoc(name, text, ROOT); }
  else if (flag === '--check') {
    const s = stale().map(([n]) => n);
    if (s.length) { console.error(`관리 파일이 낡음: ${s.join(', ')} — node rebuild/status.mjs --write`); process.exit(1); }
    console.log('관리 파일 최신');
  } else console.log(out['00-summary.md']);
}
export { build, ROOT, STATUS }; // 시험용 — 다른 코드는 쓰지 않는다
