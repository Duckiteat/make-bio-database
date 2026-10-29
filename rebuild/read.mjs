#!/usr/bin/env node
// 읽기 모드 (rebuild/PLAN.md §2′ · 6d) — 사람은 원본을 읽지 않고 이것으로 읽는다. 조회만 하고 지어내지 않는다.
//   node rebuild/read.mjs <RULE-…|EQ-…> [--depth 0|1|2]    L0 한 줄 · L1 연결 · L2 수식 (기본 2)
//   node rebuild/read.mjs --list spec [--mode author]       형식 설명 규칙(spec) 목록 — 모드 문서에서 빠진 것
// 계약: 출력은 원본(규칙 장부·단위 장부·맥락·집행 변이·검토·수식 기록)에서만 — 같은 원본이면 같은 바이트.
//   원본에 없는 것은 '… 기록 없음' 으로 드러낸다(수식·근거·예시를 그 자리에서 만들지 않는다). 파일을 쓰지 않는다.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const jsonl = (p) => (existsSync(join(ROOT, p)) ? readFileSync(join(ROOT, p), 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)) : []);
const byId = (xs, k = 'id') => Object.fromEntries(xs.map((x) => [x[k], x]));

export function load() {
  return {
    rules: byId(jsonl('rebuild/rules/rules.jsonl')), units: byId(jsonl('rebuild/ledger/units.jsonl')), links: jsonl('rebuild/rules/links.jsonl'),
    enf: byId(jsonl('rebuild/rules/enforcement.jsonl'), 'rule'), review: jsonl('rebuild/rules/review.jsonl'), formulas: byId(jsonl('rebuild/rules/formulas.jsonl')),
    changes: readFileSync(join(ROOT, 'CHANGES.md'), 'utf8').split('\n').filter((l) => l.startsWith('| 20')),
    limitations: JSON.parse(readFileSync(join(ROOT, 'data/db.json'), 'utf8')).limitations || {},
  };
}

// 맥락 연결 대상 → 원문 한 조각 (원본에서 그대로)
function target(S, t) {
  if (!t) return '';
  if (S.units[t]) return `${t} (${S.units[t].src}) — ${S.units[t].text}`;
  if (S.rules[t]) return `${t} — ${S.rules[t].text}`;
  const chg = t.match(/^CHG-(\d{4})$/);
  if (chg) { const row = S.changes[S.changes.length - Number(chg[1])]; return row ? `${t} — ${row.split('|')[1].trim()} · Why: ${(row.split('|')[3] || '').trim().slice(0, 300)}` : `${t} — 변경 기록 행 없음`; }
  if (S.limitations[t]) { const l = S.limitations[t], q = l.requirement || {}; return `${t} [${l.type}] ${l.target} — ${typeof q === 'string' ? q : q.text || ''}`.slice(0, 400); }
  if (t.startsWith('code:')) { const f = t.slice(5), s = existsSync(join(ROOT, f)) ? readFileSync(join(ROOT, f), 'utf8').split('\n').filter((l) => /^\s*\/\//.test(l)).slice(0, 3).map((l) => l.replace(/^\s*\/\/\s?/, '')).join(' ') : '파일 없음'; return `${f} 머리 — ${s}`; }
  return t;
}

function readFormula(S, f, depth, out) {
  out.push(`${f.id} ${f.name}: ${f.expr}`);
  if (depth < 1) return;
  out.push(`  계산하는 코드: ${f.code || '기록 없음'}`, `  독립 재계산(사법부): ${f.check || '기록 없음'}`, `  지키는 시험: ${f.test || '기록 없음'}`, `  규칙: ${(f.rules || []).join(' · ') || '없음'}`);
  if (depth < 2) return;
  out.push('  변수:', ...(f.vars || []).map((v) => `    ${v.sym} — ${v.means}${v.unit ? ` [${v.unit}]` : ''}${v.from ? ` (출처 ${v.from})` : ''}`));
  out.push(`  근거: ${f.basis ? `${f.basis} (${f.basis_kind})` : '근거 기록 없음 — 이 숫자·식을 왜 골랐는지 원본에 없다'}`);
  if (f.example) {
    const [mod, fn] = f.example.fn.split('.'), M = require(join(ROOT, mod + '.js'));
    out.push(`  예시 계산 (코드 ${f.example.fn} 를 그대로 부름): ${fn}(${f.example.args.map((a) => JSON.stringify(a)).join(', ')}) = ${JSON.stringify(M[fn](...f.example.args))}`);
  } else out.push('  예시 계산 기록 없음');
}

export function read(id, depth = 2, S = load()) {
  const out = [];
  if (S.formulas[id]) { readFormula(S, S.formulas[id], depth, out); return out.join('\n') + '\n'; }
  const r = S.rules[id];
  if (!r) return `${id} — 규칙 장부·수식 기록에 없음\n`;
  out.push(`${r.id} — ${r.text}`, `  모드 ${r.modes.join(' · ')} · ${r.enforce === 'machine' ? '컴퓨터가 막음' : r.flags ? '글 규칙 — 코드가 알림' : '글 규칙'}${r.spec ? ' · 형식 설명' : ''}${r.retired ? ` · 은퇴 (${r.retired.at}, ${r.retired.archive})` : ''}${r.reserved ? ` · 예약 (${r.reserved.for})` : ''}`);
  if (depth < 1) return out.join('\n') + '\n';
  const src = r.from_code ? `코드에서 찾음 — ${r.from_code}` : [r.unit, ...(r.copies || [])].map((u) => (S.units[u] ? S.units[u].src : u)).join(' · ');
  out.push(`  적힌 곳: ${src}`);
  if (r.where) out.push(`  집행 자리: ${r.where}`);
  if (r.flags) out.push(`  알리는 자리: ${r.flags}`);
  const e = S.enf[r.id];
  out.push(`  변이 시험: ${e ? `${e.result}${e.red ? ` — '${e.red}'` : ''} (${e.at})` : '기록 없음'}`);
  const ls = S.links.filter((l) => l.from === r.id);
  out.push('  맥락:', ...(ls.length ? ls.map((l) => `    ${l.rel}${l.to ? ' → ' + target(S, l.to) : ''}${l.note ? ` (${l.note})` : ''}`) : ['    기록 없음']));
  const rv = S.review.filter((x) => x.rule === r.id);
  if (rv.length) out.push('  검토:', ...rv.map((x) => `    [${x.issue}] ${x.evidence} → ${x.decision ? `결정 ${x.decision.at} ${x.decision.by}: ${x.decision.choice}` : '결정 남음'}`));
  if (depth < 2) return out.join('\n') + '\n';
  const fs = Object.values(S.formulas).filter((f) => (f.rules || []).includes(r.id));
  if (!fs.length) out.push('  수식 기록 없음');
  for (const f of fs) { const o = []; readFormula(S, f, 2, o); out.push(...o.map((l) => '  ' + l)); }
  return out.join('\n') + '\n';
}

export function listSpec(mode, S = load()) {
  const xs = Object.values(S.rules).filter((r) => r.spec && !r.retired && (!mode || r.modes.includes(mode))).sort((a, b) => a.id.localeCompare(b.id));
  return xs.map((r) => `${r.id} ${r.text}`).join('\n') + '\n';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const a = process.argv.slice(2), opt = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
  if (a[0] === '--list') { if (a[1] !== 'spec') { console.error('--list spec 만'); process.exit(2); } process.stdout.write(listSpec(opt('--mode'))); }
  else if (a[0]) process.stdout.write(read(a[0], opt('--depth') != null ? Number(opt('--depth')) : 2));
  else { console.error('사용: node rebuild/read.mjs <RULE-…|EQ-…> [--depth 0|1|2] · --list spec [--mode 모드]'); process.exit(2); }
}
