#!/usr/bin/env node
// 계획 역사 가져오기 (손으로 쓰던 계획 문서의 git 역사 → 작업 사건 기록). 한 번 가져온 뒤 계획 문서는 생성물이 된다.
//   node rebuild/plan-import.mjs --check   저장된 사건 기록(source 'git')이 git 역사에서 다시 계산한 것과 같은지 (얕은 복제면 건너뜀)
// 계약: 읽기만 — git 과 파일을 읽고 결과를 돌려준다. 쓰기는 서기(writeState)만, 이 파일은 쓰지 않는다.
//   역사는 각 계획의 import.until 커밋에서 멈춘다 — 그 뒤 문서는 생성물이라 역사가 아니다.
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as STATE from './state.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const git = (root, ...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 });
export const shallow = (root) => git(root, 'rev-parse', '--is-shallow-repository').trim() === 'true';

const cellsOf = (line) => line.slice(2, -2).split(' | ');
// 상태 칸: 기호 [날짜] [— 결과]. 한 칸(16A)만 '—' 없이 날짜 뒤에 바로 결과가 온다 — 결과는 날짜 뒤 글 그대로
export function splitState(cell) {
  const m = String(cell).match(/^(\S+)(?: (\d{4}-\d{2}-\d{2}))?(?: — | )?([\s\S]*)$/);
  return { state: STATE.STATE_OF[m[1]] || null, mark: m[1], at: m[2] || null, result: m[3] || null };
}

// 옛 문서의 깨진 곳 — 손으로 고치다 생긴 것. 고친 곳은 repairs 로 돌려준다(생성 문서의 '근거 점검' 에 보임)
//   ① build 14 행 (65f2a3e 2026-10-15 – 3b0503f): '끝나는 조건' 과 '상태' 사이가 ' || ' 로 붙어 칸 하나가 사라짐 → ' | '
//   ② rebuild (0cdc8d1 2026-10-25 – 2026-10-29): 5b′ 단계 줄이 §5′ 표 ③ 줄 가운데에 끼고, ③ 줄의 끝 '| 5c |' 이 다음 줄로 밀림.
//      5b″·5b‴ 도 그 밑에 이어 붙어 §7 단계 표에 없었다 → ③ 줄 = 앞부분 + ' 5c |', 단계 줄 셋은 §7 의 5b 줄 바로 뒤로
export function repairLegacy(text, plan) {
  const lines = text.split('\n'), repairs = [];
  if (plan === 'build') lines.forEach((l, i) => { if (/^\| \d/.test(l) && / ?\|\| ?/.test(l)) { lines[i] = l.replace(/ ?\|\| ?/, ' | '); repairs.push(`${l.slice(2, l.indexOf(' |', 2))} 행: 칸 사이 '||' → ' | '`); } });
  if (plan === 'rebuild') {
    const i = lines.findIndex((l) => l.startsWith('| ③ 조건 맥락 |') && l.includes(' | 5b′ | '));
    if (i >= 0) {
      const cut = lines[i].indexOf(' | 5b′ | '), stages = ['| 5b′ | ' + lines[i].slice(cut + ' | 5b′ | '.length)];
      lines[i] = lines[i].slice(0, cut) + ' | 5c |';
      let j = i + 1;
      while (/^\| 5b[′″‴]+ \|/.test(lines[j] || '')) stages.push(lines[j++]);
      if (lines[j] === '| 5c |') j++;
      lines.splice(i + 1, j - i - 1);
      const at = lines.findIndex((l) => l.startsWith('| 5b | '));
      lines.splice(at + 1, 0, ...stages);
      repairs.push(`§5′ 표 ③ 줄에 붙은 단계 줄 ${stages.length} 개(${stages.map((x) => x.split(' | ')[0].slice(2)).join(' · ')})를 §7 의 5b 뒤로, ③ 줄 끝 '| 5c |' 복원`);
    }
  }
  return { text: lines.join('\n'), repairs };
}

// 옛 계획 문서 한 판 → 부·작업 (순서대로). 표 머리는 '| # |' 로 시작, 작업 줄은 칸 수가 머리와 같음
export function parseLegacy(text, plan) {
  const P = STATE.PLANS[plan], lines = repairLegacy(text, plan).text.split('\n'), parts = [], items = [];
  let head = null, part = null, hold = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^## /.test(l)) { part = l.slice(3); head = null; }
    if (/^\| # \|/.test(l) && /^\|---/.test(lines[i + 1] || '')) { head = cellsOf(l); if (!parts.some((p) => p.title === part)) parts.push({ title: part, cols: head.slice(1, -1) }); i++; continue; }
    if (head && /^\| /.test(l) && / \|$/.test(l)) {
      let c = cellsOf(l);
      if (c.length !== head.length) continue;
      const n = c[0], st = splitState(c[c.length - 1]);
      const fields = Object.fromEntries(head.slice(1, -1).map((h, j) => [h, c[j + 1]]));
      const isHold = n === '(보류)';
      let id = null; try { id = P.idOf(n, isHold ? ++hold : null); } catch { id = null; } // '(논의)' 같은 임시 줄은 번호 없이 이름(label)으로
      items.push({ id, n, part, fields, ...st });
      continue;
    }
    if (!/^\| /.test(l)) head = head && l === '' ? head : null;
  }
  return { parts, items };
}

const key = (x) => x.id || x.n;
// 두 판 사이의 사건. 결과가 앞 글에 덧붙은 것이면 덧붙은 글만(append), 아니면 새 글 전체(set)
function diff(prev, cur, at, commit, why, plan) {
  const out = [], P = new Map(prev.map((x) => [key(x), x])), C = new Map(cur.map((x) => [key(x), x]));
  const ev = (x, change, rest) => out.push({ plan, at, item: x.id, label: x.n, change, ...rest, commit, why, source: 'git' });
  for (const x of cur) {
    const p = P.get(key(x));
    if (!p) { ev(x, 'added', { part: x.part, fields: x.fields, state: x.state, mark: x.mark, state_at: x.at, result: x.result }); continue; }
    if (p.part !== x.part) ev(x, 'moved', { from: p.part, to: x.part });
    for (const f of new Set([...Object.keys(p.fields), ...Object.keys(x.fields)])) if (p.fields[f] !== x.fields[f]) ev(x, 'scope', { field: f, from: p.fields[f] ?? null, to: x.fields[f] ?? null });
    if (p.mark !== x.mark || p.at !== x.at) ev(x, 'state', { from: { state: p.state, mark: p.mark, at: p.at }, to: { state: x.state, mark: x.mark, at: x.at } });
    if (p.result !== x.result) {
      if (p.result && x.result && x.result.startsWith(p.result)) ev(x, 'result', { append: x.result.slice(p.result.length) });
      else ev(x, 'result', { set: x.result });
    }
  }
  for (const p of prev) if (!C.has(key(p))) ev(p, 'removed', {});
  return out;
}

// 한 계획의 역사: 첫 판부터 until 까지 (until 포함)
export function importHistory(root, plan, until) {
  const file = STATE.PLANS[plan].legacy;
  const commits = git(root, 'log', '--reverse', '--format=%H%x09%ad%x09%s', '--date=short', until, '--', file).trim().split('\n').map((l) => l.split('\t'));
  let prev = [], out = [], last = null; const fixed = new Map();
  for (const [h, at, subject] of commits) {
    const text = git(root, 'show', `${h}:${file}`), now = parseLegacy(text, plan);
    for (const r of repairLegacy(text, plan).repairs) { const f = fixed.get(r) || { r, from: [at, h], to: null }; f.to = [at, h]; fixed.set(r, f); }
    out.push(...diff(prev, now.items, at, h.slice(0, 10), subject, plan));
    prev = now.items; last = now;
  }
  const repairs = [...fixed.values()].map((f) => `${f.r} (${f.from[0]} \`${f.from[1].slice(0, 7)}\` – ${f.to[0]} \`${f.to[1].slice(0, 7)}\` 판에서)`);
  return { events: out, last, commits: commits.length, repairs };
}

// 결정의 원문이 그 판에 글자 그대로 있나 — 지금 글은 import.until 판에, 처음 글(first)은 그 커밋 판에
export function checkDecisionSources(root, S) {
  const errs = [], until = S.plans[0].import.until, show = (h, f) => { try { return repairLegacy(git(root, 'show', `${h}:${f}`), f === STATE.PLANS.rebuild.legacy ? 'rebuild' : 'build').text; } catch { return null; } };
  for (const d of S.decisions.filter((x) => x.src && x.src.file)) {
    const now = show(until, d.src.file);
    if (now == null || !now.includes(d.text)) errs.push(`${d.id}: 원문이 ${d.src.file} (${until.slice(0, 7)} 판)에 그대로 없음`);
    const first = show(d.src.commit, d.src.file);
    if (first == null || !first.includes(d.first && d.first.text ? d.first.text : d.text.split('\n')[0])) errs.push(`${d.id}: 처음 적힌 판 ${d.src.commit.slice(0, 7)} 에 그 글이 없음`);
  }
  return errs;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv[2] !== '--check') { console.error('사용: node rebuild/plan-import.mjs --check'); process.exit(2); }
  if (shallow(ROOT)) { console.log('얕은 복제 — git 역사 대조를 건너뜀 (git fetch --unshallow 뒤 다시)'); process.exit(0); }
  const S = STATE.load(ROOT); let bad = 0;
  for (const p of S.plans) {
    const want = importHistory(ROOT, p.plan, p.import.until).events.map((e) => JSON.stringify(e));
    const have = S.log.filter((e) => e.plan === p.plan && e.source === 'git').map(({ seq, ...e }) => JSON.stringify(e));
    const same = want.length === have.length && want.every((x, i) => x === have[i]);
    console.log(`${p.plan}: git 사건 ${want.length} · 저장 ${have.length} — ${same ? '같음' : '다름'}`);
    if (!same) { bad++; const i = want.findIndex((x, j) => x !== have[j]); console.log(`  처음 다른 곳 #${i}\n  git:  ${want[i]}\n  저장: ${have[i]}`); }
  }
  const de = checkDecisionSources(ROOT, S); console.log(`결정 원문 대조: ${de.length ? de.join(' · ') : '모두 그 판에 그대로'}`);
  process.exit(bad || de.length ? 1 : 0);
}
