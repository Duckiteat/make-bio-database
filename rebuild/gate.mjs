#!/usr/bin/env node
// 문지기 · 영수증 (재건 7 단계 · DEC-0018 · 사용자 결정 2026-10-29) — '한 세션 = 한 모드' 를 사람의 기억이 아니라 구조가 막게 한다.
//   세션: node rebuild/gate.mjs open <모드>      (모드를 연다 — 세션 안에서 바꾸지 않는다. 다른 모드가 필요하면 node dbtool.mjs transition 뒤 끝낸다)
//         node rebuild/gate.mjs finish <모드>    (끝내기 전 시험 묶음 — 통과해야 git commit · push)
//         node rebuild/gate.mjs receipt [이름]   (영수증 읽기)
//   훅:   node rebuild/gate.mjs hook <session-start|pre|post|stop>  (.claude/settings.json — 입력은 표준 입력의 JSON)
// 정책은 rebuild/rules/modes.json 의 gate (모드별 쓰기 경로 · 막는 명령 · 끝내기 전 시험 · 수집가 역할). 이 파일은 판단과 입출력만.
// 영수증 = git 변경: 도구 호출마다 그 앞뒤로 저장소 파일의 크기·시각을 대조해, 바뀐 파일을 그 호출에 붙인다(Edit·Write 뿐 아니라 셸로 쓴 것도).
// 계약: 파일 쓰기는 입법 서기만(appendReceipt · writeReceiptDoc · writeDraft — 세션 상태는 저장소 밖). 훅은 막을 때만 종료 코드 2.
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, dirname, relative, resolve, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import * as CLERK from '../legislative/clerk.mjs';

const CODE = join(dirname(fileURLToPath(import.meta.url)), '..');
const sha = (x) => createHash('sha256').update(x).digest('hex');
const today = () => new Date().toISOString().slice(0, 10);
const now = () => new Date().toISOString();
export const MODES = ['author', 'baseline', 'develop', 'field', 'inspect'];
export const loadPolicy = (root = CODE) => JSON.parse(readFileSync(join(root, 'rebuild/rules/modes.json'), 'utf8')).gate;

// ── 판단 (순수) ───────────────────────────────────────────────────────────
const esc = (s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
export const globRe = (g) => new RegExp('^' + g.split('**').map((p) => p.split('*').map(esc).join('[^/]*')).join('.*') + '$');
const hit = (gs, rel) => (gs || []).some((g) => globRe(g).test(rel));
export function mayWrite(P, mode, role, rel) {
  if (hit(P.common.write, rel)) return true;
  const R = role && P.roles[role];
  if (R) return hit(R.write, rel);
  const M = P.modes[mode];
  return !!M && hit(M.write, rel) && !hit(M.except, rel);
}
export const protectedPath = (P, rel) => hit(P.common.protect, rel);
export function finishCmds(P, mode, role) {
  const R = role && P.roles[role];
  return { first: P.common.finish_first || [], cmds: [...(R ? R.finish : P.modes[mode].finish), ...P.common.finish] };
}
const denies = (P, mode, role) => [...(P.common.deny || []), ...((P.modes[mode] || {}).deny || []), ...(((role && P.roles[role]) || {}).deny || [])];
const RE = { open: /\bgate\.mjs\s+open\b(?:\s+([a-z]+))?/, finish: /\bgate\.mjs\s+finish\b(?:\s+([a-z]+))?/, commit: /\bgit\s+(?:-C\s+\S+\s+)?commit\b/, push: /\bgit\s+(?:-C\s+\S+\s+)?push\b/ };
// 명령에서 '실행되는 부분' 만 — heredoc 본문과 따옴표 속 글을 지운다. 글로 적은 명령 이름(커밋 메시지·기록 본문)을 실행으로 읽지 않으려고.
//   따옴표 속에 숨긴 실행(bash -c "…")은 여기서 못 보지만, 그 실행이 바꾼 파일은 도구 뒤 대조(violations)가 잡는다.
export function codeOf(cmd) {
  let s = String(cmd || ''), out = '', i = 0;
  const hd = [...s.matchAll(/<<-?\s*(['"]?)([A-Za-z_][\w]*)\1/g)];
  for (const m of hd) { const tag = m[2], from = s.indexOf('\n', m.index); if (from < 0) continue; const end = s.indexOf('\n' + tag, from); s = s.slice(0, from) + (end < 0 ? '' : s.slice(end + 1 + tag.length)); }
  while (i < s.length) {
    const c = s[i];
    if (c === "'") { const j = s.indexOf("'", i + 1); out += "''"; i = j < 0 ? s.length : j + 1; continue; }
    if (c === '"') { let j = i + 1; while (j < s.length && s[j] !== '"') j += s[j] === '\\' ? 2 : 1; out += '""'; i = j + 1; continue; }
    out += c; i++;
  }
  return out;
}
const rel0 = (root, f) => { if (!f) return null; const a = isAbsolute(f) ? f : resolve(root, f), r = relative(root, a); return r.startsWith('..') || isAbsolute(r) ? null : r.split('\\').join('/'); };

// st = { mode, role, finish(마지막 통과한 끝내기 전 시험), work()(지금 작업 지문), branch(), pushFiles() }
// 돌려줌: null(통과) 또는 { rule, msg } — 막는 규칙 번호와 까닭 (5d: 검사 자리는 번호를 낸다)
const B = (rule, msg) => ({ rule, msg });
export function decidePre(P, st, input, root) {
  const t = input.tool_name, x = input.tool_input || {};
  if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(t)) {
    const rel = rel0(root, x.file_path || x.notebook_path);
    if (rel == null) return null; // 저장소 밖 — 문지기가 다루지 않는다
    if (protectedPath(P, rel)) return B('RULE-0517', `${rel} 은 문지기만 쓴다 (영수증) — 손으로 고치지 않는다`);
    if (!st.mode) return B('RULE-0514', `모드를 먼저 연다: node rebuild/gate.mjs open <${MODES.join('|')}> — 한 세션 = 한 모드`);
    if (!mayWrite(P, st.mode, st.role, rel)) { const tail = `에서는 ${rel} 을 쓰지 않는다 — 다른 모드의 일이면 node dbtool.mjs transition 으로 전환 기록을 남기고 끝낸다`; return st.role ? B('RULE-0275', `${st.role} 역할 ${tail}`) : B('RULE-0515', `${st.mode} 모드 ${tail}`); }
    return null;
  }
  if (t !== 'Bash') return null;
  const cmd = codeOf(x.command);
  const o = cmd.match(RE.open);
  if (o) {
    const m = o[1];
    if (!MODES.includes(m)) return B('RULE-0514', `모드 '${m || ''}' — ${MODES.join(' | ')}`);
    if (st.mode && st.mode !== m) return B('RULE-0514', `이 세션은 이미 ${st.mode} 모드 — 세션 안에서 모드를 바꾸지 않는다. node dbtool.mjs transition 으로 전환 기록(${st.mode} → ${m})을 남기고 끝낸다`);
    if (st.role && P.roles[st.role] && P.roles[st.role].mode !== m) return B('RULE-0274', `${st.role} 역할은 ${P.roles[st.role].mode} 모드만`);
    return null;
  }
  const f = cmd.match(RE.finish);
  if (f && (!st.mode || f[1] !== st.mode)) return B('RULE-0516', `끝내기 전 시험은 이 세션의 모드로만: node rebuild/gate.mjs finish ${st.mode || '<모드 먼저 열기>'}`);
  if (st.mode) for (const { re, rule, why } of denies(P, st.mode, st.role)) if (new RegExp(re).test(cmd)) return B(rule, `${st.role || st.mode}: ${why}`); // 번호는 modes.json gate 의 deny 행이 정한다
  const isCommit = RE.commit.test(cmd), isPush = RE.push.test(cmd);
  if (isCommit || isPush) {
    if (!st.mode) return B('RULE-0514', `모드를 열지 않은 세션은 커밋·push 하지 않는다: node rebuild/gate.mjs open <모드>`);
    const R = st.role && P.roles[st.role];
    if (R && R.branch && !new RegExp(R.branch).test(st.branch())) return B('RULE-0299', `${st.role} 는 자기 브랜치(${R.branch})에만 커밋·push (결정 ②) — 지금 ${st.branch()}`);
    if (isPush && R && R.push_only) { const bad = st.pushFiles().filter((r) => !hit(R.push_only, r)); if (bad.length) return B('RULE-0299', `${st.role} push 는 ${R.push_only.join(' · ')} 만 — 그 밖의 변경: ${bad.slice(0, 5).join(' · ')}`); }
    const w = st.work();
    if (!st.finish || !st.finish.pass) return B('RULE-0516', `끝내기 전 시험이 통과하지 않았다: node rebuild/gate.mjs finish ${st.mode} — 통과해야 커밋·push`);
    if (st.finish.work !== w) return B('RULE-0516', `끝내기 전 시험 뒤에 파일이 바뀌었다 (시험 ${st.finish.work.slice(0, 8)} ≠ 지금 ${w.slice(0, 8)}): node rebuild/gate.mjs finish ${st.mode} 를 다시`);
  }
  return null;
}
// 도구가 바꾼 파일 중 이 모드에서 바뀌면 안 되는 것 (셸로 쓴 것도 여기서 잡힌다)
export const violations = (P, mode, role, changed) => changed.filter((r) => protectedPath(P, r) || !mode || !mayWrite(P, mode, role, r));

// ── 저장소 읽기 ───────────────────────────────────────────────────────────
const git = (root, ...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] });
const RECEIPTS = 'workspace/receipts/';
const files = (root) => git(root, 'ls-files', '-co', '--exclude-standard', '-z').split('\0').filter((f) => f && !f.startsWith(RECEIPTS));
// 빠른 지문(크기·시각) — 도구 호출 앞뒤 대조용 · 내용 지문 — 끝내기 전 시험과 커밋을 잇는 작업 지문
export function snapshot(root) { const o = {}; for (const f of files(root)) { try { const s = statSync(join(root, f)); o[f] = [s.size, Math.round(s.mtimeMs)]; } catch { o[f] = null; } } return o; }
export const diffSnap = (a, b) => [...new Set([...Object.keys(a || {}), ...Object.keys(b || {})])].filter((f) => JSON.stringify((a || {})[f] ?? null) !== JSON.stringify((b || {})[f] ?? null)).sort();
export function workHash(root) { const h = createHash('sha256'); for (const f of files(root).sort()) { h.update(f + '\0'); try { h.update(sha(readFileSync(join(root, f)))); } catch { h.update('deleted'); } h.update('\n'); } return h.digest('hex'); }
const branchOf = (root) => { try { return git(root, 'rev-parse', '--abbrev-ref', 'HEAD').trim(); } catch { return '?'; } };
const headOf = (root) => { try { return git(root, 'rev-parse', 'HEAD').trim(); } catch { return null; } };

// ── 세션 상태 (영수증에서 계산 · 앞뒤 대조용 지문만 저장소 밖에) ─────────────────
const sid8 = (sid) => String(sid || 'nosession').replace(/[^0-9a-zA-Z-]/g, '').slice(0, 12) || 'nosession';
function receiptName(root, sid) {
  const d = join(root, RECEIPTS), tail = '-' + sid8(sid) + '.jsonl';
  const have = existsSync(d) ? readdirSync(d).filter((f) => f.endsWith(tail)).sort() : [];
  return have.length ? have[0].slice(0, -'.jsonl'.length) : today() + '-' + sid8(sid);
}
export const readReceipt = (root, name) => { const f = join(root, RECEIPTS, name + '.jsonl'); return existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []; };
const scratch = (root, sid) => join(tmpdir(), `biodb-gate-${sha(resolve(root)).slice(0, 12)}-${sid8(sid)}.json`);
const finishFile = (root) => join(tmpdir(), `biodb-finish-${sha(resolve(root)).slice(0, 12)}.json`);
const readJson = (f) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; } };
function state(root, sid, P) {
  const name = receiptName(root, sid), evs = readReceipt(root, name), open = evs.find((e) => e.t === 'open');
  const role = process.env.BIODB_ROLE && P.roles[process.env.BIODB_ROLE] ? process.env.BIODB_ROLE : null;
  const fin = [...evs].reverse().find((e) => e.t === 'finish');
  return { name, evs, mode: open ? open.mode : null, role: open ? open.role : role, open, finish: fin || null,
    work: () => workHash(root), branch: () => branchOf(root),
    pushFiles: () => { try { return git(root, 'diff', '--name-only', `${open && open.head ? open.head : 'HEAD'}..HEAD`).split('\n').filter(Boolean); } catch { return []; } } };
}

// ── 영수증 보기 (사람용 · 생성물) ─────────────────────────────────────────
export function renderReceipt(evs, gitChanged) {
  const open = evs.find((e) => e.t === 'open'), tools = evs.filter((e) => e.t === 'tool'), fins = evs.filter((e) => e.t === 'finish');
  const by = {}; for (const e of evs) for (const f of e.changed || []) (by[f] = by[f] || []).push(e);
  const label = (e) => `${e.at.slice(11, 19)} ${e.t === 'tool' ? e.tool + (e.target ? ' ' + String(e.target).slice(0, 80).replace(/\|/g, '\\|').replace(/\n/g, ' ') : '') : e.what || e.t}`;
  const acc = gitChanged ? gitChanged.filter((f) => !by[f]) : null;
  return [`# 영수증 — ${evs[0] ? evs[0].at.slice(0, 10) : ''}`, '', '> 생성물 — 문지기(`rebuild/gate.mjs`)가 도구 호출마다 덧붙인 같은 이름의 `.jsonl` 에서 만든다. 손으로 고치지 않는다.', '',
    `| 모드 | 역할 | 브랜치 | 시작 커밋 | 도구 호출 | 막힘 |`, '|---|---|---|---|---|---|',
    `| ${open ? open.mode : '열지 않음'} | ${(open && open.role) || '—'} | ${open ? open.branch : '—'} | ${open && open.head ? '`' + open.head.slice(0, 7) + '`' : '—'} | ${tools.length} | ${evs.filter((e) => e.t === 'block').length} |`, '',
    '## 끝내기 전 시험', '', ...(fins.length ? fins.map((f) => `- ${f.at.slice(0, 19)} ${f.pass ? '**통과**' : '**실패**'} (작업 지문 \`${f.work.slice(0, 8)}\`): ${f.results.map((r) => `\`${r.cmd}\` ${r.code === 0 ? 'ok' : 'FAIL ' + r.code} ${Math.round(r.ms / 1000)}s`).join(' · ')}`) : ['- 돌리지 않음']), '',
    '## 막힌 것', '', ...(evs.some((e) => e.t === 'block') ? evs.filter((e) => e.t === 'block').map((e) => `- ${e.at.slice(11, 19)} ${e.tool} [${e.rule}]: ${e.why}`) : ['- 없음']), '',
    '## 모드 밖 변경 · 고친 흔적', '', ...(evs.some((e) => e.t === 'violation') ? evs.filter((e) => e.t === 'violation').map((e) => `- ${e.at.slice(11, 19)} ${e.files.join(' · ')} — ${e.why}`) : ['- 없음']), '',
    '## 바뀐 파일 — 어느 호출이 바꿨나', '', ...(Object.keys(by).length ? Object.keys(by).sort().map((f) => `- \`${f}\` ← ${by[f].map(label).join(' · ')}`) : ['- 없음']), '',
    '## 영수증 = git 변경', '', gitChanged == null ? '- git 대조 못 함' : `- git 이 본 변경(시작 커밋 이후 커밋 + 커밋 안 한 것) ${gitChanged.length} · 영수증에 붙은 파일 ${Object.keys(by).length} · **영수증에 없는 변경 ${acc.length}**${acc.length ? ': ' + acc.join(' · ') : ''}`, '',
    '## 실행한 명령', '', ...(tools.filter((e) => e.tool === 'Bash').map((e) => `- ${e.at.slice(11, 19)} \`${String(e.target).slice(0, 160).replace(/`/g, "'").replace(/\n/g, ' ')}\``)), ''].join('\n');
}
const gitChangedSince = (root, head) => { try { const a = head ? git(root, 'diff', '--name-only', `${head}..HEAD`).split('\n') : []; const b = git(root, 'status', '--porcelain', '-z', '-uall').split('\0').map((l) => l.slice(3)); return [...new Set([...a, ...b])].filter((f) => f && !f.startsWith(RECEIPTS)).sort(); } catch { return null; } };

// ── 훅 ───────────────────────────────────────────────────────────────────
// 영수증이 고쳐졌나 — 사슬(prev)과, 저장소 밖에 둔 마지막 줄 수·지문(rc)으로
export function receiptIntact(root, name, rc) {
  const f = join(root, RECEIPTS, name + '.jsonl'), lines = existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean) : [];
  for (let i = 1; i < lines.length; i++) if (JSON.parse(lines[i]).prev !== sha(lines[i - 1])) return `사슬이 ${i + 1} 째 줄에서 끊김`;
  if (rc && (lines.length < rc.n || (rc.n && sha(lines[rc.n - 1]) !== rc.last))) return `문지기가 쓴 ${rc.n} 줄이 지금 ${lines.length} 줄 — 지워지거나 고쳐짐`;
  return null;
}
function hook(event, input, root) {
  const P = loadPolicy(), sc = scratch(root, input.session_id), S = readJson(sc) || {};
  let st = state(root, input.session_id, P);
  const save = () => CLERK.writeDraft(sc, S);
  const add = (ev) => { CLERK.appendReceipt(root, st.name, { at: now(), ...ev }); const ls = readFileSync(join(root, RECEIPTS, st.name + '.jsonl'), 'utf8').split('\n').filter(Boolean); S.rc = { name: st.name, n: ls.length, last: sha(ls[ls.length - 1]) }; };
  const say = (rule, msg) => { process.stderr.write(`문지기 [${rule}]: ${msg}\n`); return 2; };
  const broken = receiptIntact(root, (S.rc && S.rc.name) || st.name, S.rc);
  if (broken) {
    if (event === 'session-start') { process.stdout.write(`문지기: 이 세션의 영수증이 고쳐졌다 (${broken}) — 사람에게 알린다. 쓰는 도구는 막힌다.\n`); return 0; }
    return event === 'pre' ? say('RULE-0517', `영수증이 고쳐졌다 (${broken}) — 쓰는 도구를 막는다. 사람에게 알린다 (영수증은 문지기만 쓴다)`) : 0;
  }
  if (event === 'session-start') {
    const tr = existsSync(join(root, 'workspace/transitions.jsonl')) ? readFileSync(join(root, 'workspace/transitions.jsonl'), 'utf8').split('\n').filter(Boolean).slice(-3).map((l) => JSON.parse(l)) : [];
    process.stdout.write([`문지기 (재건 7 단계): 이 세션은 모드 하나로 시작한다 — node rebuild/gate.mjs open <${MODES.join('|')}>.`, st.mode ? `이미 열린 모드: ${st.mode}` : '아직 연 모드 없음 — 열기 전에는 저장소 파일을 쓰지 않는다.',
      st.role ? `역할: ${st.role} (${P.roles[st.role].mode} 모드만)` : '', '끝내기 전: node rebuild/gate.mjs finish <모드> — 통과해야 git commit · push.',
      tr.length ? '최근 전환 기록: ' + tr.map((r) => `#${r.seq} ${r.from}→${r.to} (${r.at}) ${r.why.slice(0, 80)}`).join(' / ') : ''].filter(Boolean).join('\n') + '\n');
    return 0;
  }
  if (event === 'pre') {
    const snap = snapshot(root), outside = S.snap ? diffSnap(S.snap, snap) : [];
    if (outside.length) add({ t: 'outside', what: '도구 호출 밖에서 바뀜', changed: outside });
    const why = decidePre(P, st, input, root);
    S.snap = snap; S.pre_at = Date.now();
    if (why) add({ t: 'block', tool: input.tool_name, target: target(input), rule: why.rule, why: why.msg });
    save();
    return why ? say(why.rule, why.msg) : 0;
  }
  if (event === 'post') {
    const snap = snapshot(root), changed = diffSnap(S.snap || snap, snap), cmd = String((input.tool_input || {}).command || '');
    const ok = !(input.tool_response && (input.tool_response.is_error || input.tool_response.interrupted));
    const o = input.tool_name === 'Bash' && codeOf(cmd).match(RE.open);
    if (o && ok && !st.mode && MODES.includes(o[1])) add({ t: 'open', mode: o[1], role: st.role, branch: branchOf(root), head: headOf(root) });
    add({ t: 'tool', tool: input.tool_name, target: target(input), changed });
    st = state(root, input.session_id, P);
    if (input.tool_name === 'Bash' && RE.finish.test(codeOf(cmd))) { const F = readJson(finishFile(root)); if (F && F.at_ms >= (S.pre_at || 0) && F.mode === st.mode) add({ t: 'finish', mode: F.mode, role: F.role, work: F.work, pass: F.pass, results: F.results }); }
    S.snap = snap;
    const bad = violations(P, st.mode, st.role, changed);
    let code = 0;
    if (bad.length) { const why = st.mode ? `${st.role || st.mode} 에서 바뀌면 안 되는 파일` : '모드를 열기 전에 저장소 파일이 바뀜'; add({ t: 'violation', rule: st.mode ? 'RULE-0515' : 'RULE-0514', files: bad, why }); code = say(st.mode ? 'RULE-0515' : 'RULE-0514', `${why}: ${bad.join(' · ')} — 되돌리거나(git checkout -- <파일>) 전환 기록을 남기고 끝낸다`); }
    save();
    return code;
  }
  if (event === 'stop') {
    // 관리 파일 생성(예전 Stop 훅)을 여기서 — 그 변경도 영수증에 붙는다
    const before = snapshot(root);
    if (existsSync(join(root, 'rebuild/status.mjs'))) spawnSync(process.execPath, [join(root, 'rebuild/status.mjs'), '--write'], { cwd: root, stdio: 'ignore' });
    const after = snapshot(root), gen = diffSnap(before, after);
    if (gen.length && st.evs.length) add({ t: 'hook', what: 'status --write (응답 끝 훅)', changed: gen });
    st = state(root, input.session_id, P);
    if (st.evs.length) CLERK.writeReceiptDoc(root, st.name, renderReceipt(st.evs, gitChangedSince(root, st.open && st.open.head)));
    S.snap = after;
    const dirty = gitChangedSince(root, null) || [];
    let code = 0;
    if (st.mode && dirty.length && !input.stop_hook_active) {
      const w = workHash(root);
      if (!(st.finish && st.finish.pass && st.finish.work === w) && S.reminded !== w) { // 같은 상태로는 한 번만 알린다
        S.reminded = w;
        code = say('RULE-0516', `커밋 안 한 변경 ${dirty.length} 이 끝내기 전 시험을 지나지 않았다 — node rebuild/gate.mjs finish ${st.mode} (통과해야 커밋·push). 일부러 멈추는 거면 그대로 둬도 된다 (한 번만 알림)`);
      }
    }
    save();
    return code;
  }
  return 0;
}
const target = (input) => { const x = input.tool_input || {}; return x.file_path || x.notebook_path || (x.command ? String(x.command).slice(0, 400) : null); };

// ── 명령 ─────────────────────────────────────────────────────────────────
function finish(mode, root) {
  const P = loadPolicy(), role = process.env.BIODB_ROLE && P.roles[process.env.BIODB_ROLE] ? process.env.BIODB_ROLE : null;
  if (!MODES.includes(mode)) { console.error(`모드 '${mode || ''}' — ${MODES.join(' | ')}`); return 2; }
  const { first, cmds } = finishCmds(P, mode, role), results = [];
  for (const c of first) spawnSync(c, { cwd: root, shell: true, stdio: 'ignore' });
  for (const c of cmds) {
    const t0 = Date.now(), r = spawnSync(c, { cwd: root, shell: true, encoding: 'utf8', maxBuffer: 1 << 28 });
    results.push({ cmd: c, code: r.status ?? 1, ms: Date.now() - t0 });
    console.log(`${r.status === 0 ? 'ok  ' : 'FAIL'} ${c} (${Math.round((Date.now() - t0) / 1000)}s)`);
    if (r.status !== 0) process.stdout.write(String(r.stdout || '').split('\n').slice(-25).join('\n') + String(r.stderr || '').split('\n').slice(-10).join('\n') + '\n');
  }
  const pass = results.every((r) => r.code === 0), work = workHash(root);
  CLERK.writeDraft(finishFile(root), { mode, role, at_ms: Date.now(), work, pass, results });
  console.log(`${pass ? '통과' : '실패'} — 작업 지문 ${work.slice(0, 8)} (${mode}${role ? ' · ' + role : ''}). ${pass ? '이 상태 그대로면 커밋·push 가 열린다' : '고친 뒤 다시'}`);
  return pass ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [cmd, arg] = process.argv.slice(2);
  const root = (() => { try { return git(process.env.CLAUDE_PROJECT_DIR || process.cwd(), 'rev-parse', '--show-toplevel').trim(); } catch { return process.env.CLAUDE_PROJECT_DIR || process.cwd(); } })();
  if (cmd === 'hook') {
    let input = {}; try { input = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { /* 빈 입력 */ }
    let code = 0; try { code = hook(arg, input, root); } catch (e) { process.stderr.write(`문지기 오류 (통과시킴 — 영수증에 남지 않았을 수 있음): ${e.message}\n`); code = 0; }
    process.exit(code);
  } else if (cmd === 'open') {
    if (!MODES.includes(arg)) { console.error(`모드 '${arg || ''}' — ${MODES.join(' | ')}`); process.exit(2); }
    const P = loadPolicy(), M = P.modes[arg];
    console.log(`${arg} 모드 — 모드 문서: docs/modes/${arg}.md (8 단계 전에는 rebuild/draft/modes/${arg}.md)\n쓸 수 있는 곳: ${[...P.common.write, ...M.write].join(' · ')}${M.except ? ' (빼고: ' + M.except.join(' · ') + ')' : ''}\n끝내기 전: node rebuild/gate.mjs finish ${arg} → ${[...M.finish, ...P.common.finish].join(' · ')}\n(문지기 훅이 이 명령을 영수증에 '열림' 으로 남긴다 — 훅이 꺼져 있으면 아무것도 막히지 않는다)`);
  } else if (cmd === 'finish') process.exit(finish(arg, root));
  else if (cmd === 'receipt') {
    const d = join(root, RECEIPTS), names = existsSync(d) ? readdirSync(d).filter((f) => f.endsWith('.jsonl')).map((f) => f.slice(0, -6)).sort() : [];
    const name = arg || names[names.length - 1];
    if (!name) { console.log('영수증 없음'); process.exit(0); }
    const evs = readReceipt(root, name), open = evs.find((e) => e.t === 'open');
    process.stdout.write(renderReceipt(evs, gitChangedSince(root, open && open.head)));
  } else { console.error('사용: node rebuild/gate.mjs open <모드> · finish <모드> · receipt [이름] · hook <session-start|pre|post|stop>'); process.exit(2); }
}
