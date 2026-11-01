// 상시 권한 대조 (재건 10g · RULE-0521) — 권한이 적힌 두 곳이 상시 권한 장부(rebuild/rules/permissions.jsonl)와 같아야 한다:
//   .claude/settings.json 의 permissions.allow · ask (Claude Code 가 묻지 않고 / 물어서 여는 도구 호출)
//   rebuild/rules/modes.json 의 gate — 모드마다 write · also (문지기가 여는 쓰기 자리), 모든 모드 공통(common) · 수집가 역할(role:collector)
// 장부 줄마다 무엇(what) · 누가(by) · 언제(at) · 왜(why) · 철회 방법(revoke). 장부 밖 권한 · 두 곳에 없는 장부 줄은 거부.
// 장부로도 열 수 없는 것: 보호 자리(문지기 · 자기 검사 장치 · 권한 원본)를 이름으로 여는 줄 · 전부 허용(마스터 권한) — RULE-0461.
// 계약: load 는 읽기만, check 는 값만 돌려준다. 파일을 쓰지 않는다. settings.json 은 사람이 고친다(이 파일은 대조만).
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const RULE = 'RULE-0521';
export const PROTECTED = ['.claude/settings.json', '.claude/settings.local.json', '.claude/settings', 'rebuild/gate.mjs', 'rebuild/rules/modes.json', 'rebuild/rules/permissions.jsonl'];
export const MASTER = [/^\*$/, /^Bash$/, /^Bash\(\*\)$/, /^Bash\(:\*\)$/, /^mcp__.*\*/, /^Bash\(sudo\b/, /dangerously|bypass/i];
const LISTS = { settings: ['allow', 'ask'], gate: ['write', 'also'] };

// 두 곳에서 지금 권한을 읽는다 — { settings: { allow, ask }, gate: { 모드: { write, also } } }
export function load(root) {
  const S = JSON.parse(readFileSync(join(root, '.claude/settings.json'), 'utf8')).permissions || {};
  const G = JSON.parse(readFileSync(join(root, 'rebuild/rules/modes.json'), 'utf8')).gate;
  const gate = { common: { write: G.common.write || [], also: [] } };
  for (const [m, x] of Object.entries(G.modes)) gate[m] = { write: x.write || [], also: x.also || [] };
  for (const [r, x] of Object.entries(G.roles || {})) gate[`role:${r}`] = { write: x.write || [], also: [] };
  const f = join(root, 'rebuild/rules/permissions.jsonl');
  const rows = existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  return { rows, settings: { allow: S.allow || [], ask: S.ask || [] }, gate };
}

// 대조 — 오류 문장 목록 (모두 RULE-0521 로 시작)
export function check({ rows, settings, gate }) {
  const errs = [], E = (m) => errs.push(`${RULE} ${m}`), granted = new Map();
  const slot = (r) => (r.layer === 'gate' ? `gate ${r.mode} ${r.list}` : `settings ${r.list}`);
  for (const r of rows) {
    if (!LISTS[r.layer]) { E(`${r.id}: 모르는 층 '${r.layer}' — settings · gate`); continue; }
    if (!LISTS[r.layer].includes(r.list)) { E(`${r.id}: ${r.layer} 의 목록은 ${LISTS[r.layer].join(' · ')} — '${r.list}'`); continue; }
    if (r.layer === 'gate' && !gate[r.mode]) { E(`${r.id}: 모르는 모드 '${r.mode}'`); continue; }
    if (!Array.isArray(r.what) || !r.what.length || r.what.some((w) => typeof w !== 'string' || !w)) { E(`${r.id}: what 은 비지 않은 글 목록`); continue; }
    for (const k of ['why', 'by', 'at', 'revoke']) if (!String(r[k] || '').trim()) E(`${r.id}: '${k}' 가 비었음`);
    for (const w of r.what) {
      const p = PROTECTED.find((x) => w.includes(x));
      if (p) E(`${r.id}: '${w}' 는 보호 자리(${p})를 연다 — 문지기·자기 검사 장치·권한 원본은 장부로도 열 수 없다`);
      if (r.layer === 'settings' && MASTER.some((re) => re.test(w))) E(`${r.id}: '${w}' 는 전부 허용(마스터 권한) — 좁고 철회할 수 있는 권한만 (RULE-0461)`);
      const k = `${slot(r)}\0${w}`;
      if (granted.has(k)) E(`${r.id}: '${w}' 가 ${granted.get(k)} 에도 있음 (${slot(r)})`);
      granted.set(k, r.id);
    }
  }
  const compare = (name, actual, layer, list, mode) => {
    const want = new Set(rows.filter((r) => r.layer === layer && r.list === list && (layer !== 'gate' || r.mode === mode)).flatMap((r) => r.what || []));
    for (const w of actual) if (!want.has(w)) E(`${name}: '${w}' 는 장부 밖 권한 — 장부 줄(무엇 · 누가 · 언제 · 왜 · 철회)을 먼저 (node rebuild/rules.mjs apply)`);
    for (const w of want) if (!actual.includes(w)) E(`${name}: 장부 줄의 '${w}' 가 ${name} 에 없음 — 철회했으면 장부 줄도 지운다`);
  };
  for (const list of LISTS.settings) compare(`.claude/settings.json ${list}`, settings[list] || [], 'settings', list);
  for (const [m, x] of Object.entries(gate)) for (const list of LISTS.gate) compare(`modes.json gate ${m} ${list}`, x[list] || [], 'gate', list, m);
  return errs;
}
