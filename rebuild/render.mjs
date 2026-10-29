// 새 구조 문서 생성기 (rebuild/PLAN.md 6 단계) — 규칙 장부와 모드 원본에서 중심 문서·모드 문서·스킬을 만든다.
//   원본: rebuild/rules/rules.jsonl (규칙 하나 = 기록 하나) · rebuild/rules/modes.json (모드 머리말) · rebuild/rules/commands.jsonl (명령 장부) · rebuild/ledger/units.jsonl (규칙이 온 절)
//   결과: rebuild/draft/ 아래 — 8 단계에 제자리(CLAUDE.md · docs/modes/ · .claude/skills/)로 옮긴다. 그때까지 지금 문서는 그대로.
// 계약: 순수 — 같은 원본이면 같은 바이트. 쓰기는 rebuild/status.mjs 가 서기(writeDraftDoc)로. 손으로 고치지 않는다.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const MODE_KEYS = ['author', 'baseline', 'develop', 'field', 'inspect'];
const jsonl = (root, p) => readFileSync(join(root, p), 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
// 규칙 문장 다듬기: 강조 표시만 지운다 — 뜻은 원문 그대로
const clean = (t) => t.replace(/\*\*/g, '').split('|').map((x) => x.trim()).filter(Boolean).join(' — ').replace(/\s+/g, ' ').trim(); // 표 줄에서 온 규칙은 칸을 ' — ' 로 잇는다
const NOTE = (src) => `> 생성물 — \`node rebuild/status.mjs --write\` 가 \`${src}\` 에서 만든다. 손으로 고치지 않는다 (규칙을 바꾸려면 원본을).\n`;

export function build(root) {
  const rules = jsonl(root, 'rebuild/rules/rules.jsonl').filter((r) => !r.retired);
  const units = Object.fromEntries(jsonl(root, 'rebuild/ledger/units.jsonl').map((u) => [u.id, u]));
  const M = JSON.parse(readFileSync(join(root, 'rebuild/rules/modes.json'), 'utf8'));
  const cmds = jsonl(root, 'rebuild/rules/commands.jsonl'); // 명령 장부 (6c)
  const ALL = M.modes.map((m) => m.key), every = (c) => ALL.every((k) => c.modes.includes(k));
  // 쓰는 명령은 표(구역이 중요), 읽기만 하는 명령은 한 줄
  const cmdTable = (xs) => { const w = xs.filter((c) => c.writes), r = xs.filter((c) => !c.writes);
    return [w.length ? ['| 쓰는 명령 | 구역 | 무엇 |', '|---|---|---|', ...w.map((c) => `| \`${c.cmd}\` | ${c.writes} | ${c.what} |`)].join('\n') : '', r.length ? `읽기만: ${r.map((c) => '`' + c.cmd + '`').join(' · ')}` : ''].filter(Boolean).join('\n\n') || '없음'; };
  // 규칙이 온 절 — 단위의 자리 맥락(ctx.path)의 마지막 제목. 코드에서 찾은 규칙은 한 묶음
  // 주제 (modes.json topics — 원문 절 제목 경로에 열쇠말이 있으면 그 주제, 위에서부터 첫 일치)
  const section = (r) => { if (r.from_code) return '코드에서 찾은 검사'; const p = (((units[r.unit] || {}).ctx || {}).path || []).join(' > '); const t = (M.topics || []).find((x) => x.match.some((k) => p.includes(k))); return t ? t.topic : '기타'; };
  const line = (r) => `- \`${r.id}\` ${clean(r.text)}${r.flags ? ' _(코드가 알림)_' : ''}`;
  const grouped = (xs) => {
    const by = new Map();
    for (const r of [...xs].sort((a, b) => a.id.localeCompare(b.id))) { const s = section(r); if (!by.has(s)) by.set(s, []); by.get(s).push(r); }
    const order = [...(M.topics || []).map((t) => t.topic), '코드에서 찾은 검사', '기타'];
    return [...by].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0])).map(([s, rs]) => `### ${s}\n\n${rs.map(line).join('\n')}`).join('\n\n');
  };
  const isCommon = (r) => r.modes.includes('common');
  const text = (xs) => xs.filter((r) => r.enforce !== 'machine' && !r.spec), machine = (xs) => xs.filter((r) => r.enforce === 'machine'), spec = (xs) => xs.filter((r) => r.spec);
  const machineNote = (n) => `${n} 개 — 어기면 검사 오류에 그 번호(\`RULE-…\`)가 붙어 나온다. 이유·맥락은 규칙 장부(\`rebuild/rules/rules.jsonl\` · 맥락 \`links.jsonl\`)에서 번호로 찾는다.`;
  const out = {};

  // 중심 문서
  const common = rules.filter(isCommon);
  const modeRows = M.modes.map((m) => `| \`${m.key}\` ${m.name} | ${m.when} | 스킬 \`/${m.key}\` · \`docs/modes/${m.key}.md\` |`);
  out['CLAUDE.md'] = [`# make-bio-database — 중심 문서`, '', NOTE('rebuild/rules/rules.jsonl · modes.json'),
    '## 목적', '', ...M.purpose.map((x) => `- ${x}`), '',
    '## 세션', '', ...M.session.map((x) => `- ${x}`), '',
    '## 모드 — 하나를 골라 연다', '', '| 모드 | 언제 | 여는 법 |', '|---|---|---|', ...modeRows, '',
    `## 공통 규칙 — 사람·AI 가 지킨다 (${text(common).length})`, '', grouped(text(common)), '',
    `## 공통 규칙 — 컴퓨터가 막는다`, '', machineNote(machine(common).length), '',
    '## 모든 모드의 명령', '', cmdTable(cmds.filter(every)), '', '모드마다 쓸 명령은 그 모드 문서에 있다 (원본 `rebuild/rules/commands.jsonl`).', ''].join('\n');

  // 모드 문서 + 스킬 (같은 본문)
  for (const m of M.modes) {
    const xs = rules.filter((r) => r.modes.includes(m.key) && !isCommon(r));
    const body = [`# 모드: ${m.name} (\`${m.key}\`${m.role ? ' — ' + m.role : ''})`, '', NOTE('rebuild/rules/rules.jsonl · modes.json'),
      `- **언제**: ${m.when}`, `- **목표**: ${m.goal}`, `- **쓸 수 있는 곳**: ${m.writes}`, `- **가장 큰 위험**: ${m.risk}`,
      `- **끝내기 전**: ${m.finish.join(' · ')}`, `- **멈춤**: ${m.stop}`, '', '공통 규칙은 중심 문서(`CLAUDE.md`)에 있다.', '',
      `## 지켜야 할 규칙 — 사람·AI (${text(xs).length})`, '', text(xs).length ? grouped(text(xs)) : '없음 — 이 모드의 규칙은 모두 컴퓨터가 막는다.', '',
      `## 컴퓨터가 막는 규칙`, '', machineNote(machine(xs).length), '',
      `## 형식 설명`, '', `${spec(xs).length} 개 — 칸의 모양·값의 뜻(SCHEMA). 쓸 때 찾는다: \`node rebuild/read.mjs --list spec --mode ${m.key}\` · 하나는 \`node rebuild/read.mjs RULE-…\``, '',
      `## 쓸 명령 (모든 모드의 명령은 중심 문서)`, '', cmdTable(cmds.filter((c) => c.modes.includes(m.key) && !every(c))), ''].join('\n');
    out[`modes/${m.key}.md`] = body;
    out[`skills/${m.key}/SKILL.md`] = `---\nname: ${m.key}\ndescription: "${m.name} 모드 — ${m.when}. 세션을 이 모드로 시작할 때 연다 (한 세션 = 한 모드)."\n---\n\n${body}`;
  }
  return out;
}

export { MODE_KEYS };
