#!/usr/bin/env node
// 규칙 장부 고치기 — rebuild/rules/ 의 .jsonl 여섯은 이것으로만 바꾼다 (plan.mjs 와 같은 방식: 변경 묶음 · 고칠 때마다 왜 · 검사 통과 뒤 서기만 씀)
//   node rebuild/rules.mjs apply <ops.json> [--dry]   변경 묶음 { at, why, ops[] }
//   node rebuild/rules.mjs check                      장부 검사만 (모양 · 칸 · 열쇠 · 참조 · 봉인)
//   op: add {file, row} · set {file, key, fields}(칸을 덮어씀 — null 이면 그 칸을 지움) · remove {file, key}
//       seal {file} — 봉인이 아직 없는 장부에 첫 봉인 (줄 모양을 하나로 맞춘다 — 값은 그대로)
//   file: LEDGERS 의 이름(새 장부는 파일 없이 시작 — seal 이 첫 글) · key: 그 장부의 열쇠 칸 값 (여럿이면 '|' 로 이음)
// 줄 모양 하나 (canon): 칸 순서는 적힌 그대로, 구분자 ', ' · ': ', 숫자는 JSON 표기. 칸은 장부마다 허용 목록 안, 필수 칸이 있고, 열쇠는 겹치지 않는다.
// 봉인: 바꿀 때마다 rebuild/rules/changes.jsonl 에 사건 { seq, at, why, file, op, key, before, after, sha } — sha 는 바꾼 뒤 장부 파일의 sha256.
//   장부의 지금 sha256 이 그 장부의 마지막 사건 sha 와 다르면 도구 밖에서 고친 것이다 → 검사 거부 (RULE-0519).
// 계약: load 는 읽기만, canon · check · apply 는 값만 돌려준다. 파일 쓰기는 서기(writeLedger)만.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import * as CLERK from '../legislative/clerk.mjs';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const sha = (x) => createHash('sha256').update(x).digest('hex');
const RULE = 'RULE-0519';
const DATE = /^\d{4}-\d{2}-\d{2}$/;
// 장부마다: 열쇠 칸 · 필수 칸 · 허용 칸 (필수 포함) · 규칙 번호를 가리키는 칸 (참조 검사)
export const LEDGERS = {
  rules: { key: ['id'], need: ['id', 'text', 'modes', 'enforce'], may: ['unit', 'copies', 'retired', 'where', 'note', 'flags', 'reserved', 'moved_from_common', 'spec', 'from_code', 'text_why'] },
  review: { key: ['rule', 'issue'], need: ['rule', 'issue', 'evidence', 'proposal', 'decision'], may: [], refs: ['rule'] },
  formulas: { key: ['id'], need: ['id', 'name', 'expr', 'vars', 'code', 'check', 'test', 'rules', 'basis', 'basis_kind'], may: ['example'], refs: ['rules'] },
  enforcement: { key: ['rule'], need: ['rule', 'op', 'result', 'at'], may: ['tests', 'note', 'file', 'code', 'red', 'find', 'repl', 'contains'], refs: ['rule'] },
  links: { key: ['from', 'rel', 'to'], need: ['from', 'rel', 'by'], may: ['to', 'note', 'anchor', 'basis'], refs: ['from'] },
  commands: { key: ['cmd'], need: ['cmd', 'kind', 'modes', 'writes', 'what'], may: ['writes_on', 'collector'] },
  // 상시 권한 (10g · RULE-0521): layer settings(.claude/settings.json 의 list allow·ask) · gate(modes.json 의 모드 mode 의 list write·also)
  permissions: { key: ['id'], need: ['id', 'layer', 'list', 'what', 'why', 'by', 'at', 'revoke'], may: ['mode', 'wide', 'src'] },
};
export const LOG = 'changes.jsonl';
// 글 규칙이 글로 남는 까닭 (10h · DEC-0038 ①) — 글 규칙(enforce text · spec 아님)마다 하나. candidate 는 기계 규칙으로 올릴 차례(0 이 목표)
export const TEXT_WHY = {
  work: '일하는 방식 — 언제 묻나 · 권한 · 보고 형식 · 작업 순서 (판정할 산출물이 없음)',
  judgment: '사람·통합가의 판단 — 원문 대조 · 출처 확인 · 결함 태그 고르기',
  delegation: '다른 AI · 수집가에게 맡기는 법 — 대화 속 지시',
  notify: '코드가 알림만 — 거부로 바꾸면 기존 데이터가 막힌다 (사람이 판단)',
  principle: '설계 원칙 — 여러 검사의 근거라 하나의 검사로 판정하지 않음',
  candidate: '판정 가능 — 기계 규칙으로 올릴 차례',
};

export const canon = (v) => (Array.isArray(v) ? '[' + v.map(canon).join(', ') + ']' : v && typeof v === 'object' ? '{' + Object.entries(v).map(([k, x]) => JSON.stringify(k) + ': ' + canon(x)).join(', ') + '}' : JSON.stringify(v));
export const keyOf = (name, row) => LEDGERS[name].key.map((k) => (row[k] == null ? '' : String(row[k]))).join('|');
const text = (rows) => rows.map(canon).join('\n') + (rows.length ? '\n' : '');
const rowsOf = (t) => t.split('\n').filter(Boolean).map((l) => JSON.parse(l));

// S = { files: { 이름: 글 }, log: [사건] }
export function load(root = ROOT) {
  const d = join(root, 'rebuild', 'rules'), files = {};
  for (const n of Object.keys(LEDGERS)) files[n] = existsSync(join(d, n + '.jsonl')) ? readFileSync(join(d, n + '.jsonl'), 'utf8') : ''; // 새 장부는 빈 채로 시작해 첫 봉인
  const lf = join(d, LOG);
  return { files, log: existsSync(lf) ? rowsOf(readFileSync(lf, 'utf8')) : [] };
}
const lastSeal = (log, name) => [...log].reverse().find((e) => e.file === name);

// 정확성 검사 — 오류 문장 목록 (모두 RULE-0519 로 시작)
export function check(S) {
  const errs = [], E = (m) => errs.push(`${RULE} ${m}`), rows = {};
  for (const [n, L] of Object.entries(LEDGERS)) {
    const t = S.files[n] || '', lines = t.split('\n');
    if (t && !t.endsWith('\n')) E(`${n}: 끝 줄바꿈이 없음`);
    rows[n] = [];
    lines.filter(Boolean).forEach((l, i) => {
      let o; try { o = JSON.parse(l); } catch { return E(`${n} ${i + 1} 째 줄: JSON 이 아님`); }
      if (canon(o) !== l) E(`${n} ${i + 1} 째 줄: 줄 모양이 다름 (구분자 ', ' · ': ', 숫자는 JSON 표기 — 도구가 쓴 모양)`);
      rows[n].push(o);
    });
    const seen = new Set();
    for (const o of rows[n]) {
      const k = keyOf(n, o);
      for (const f of L.need) if (!(f in o)) E(`${n} ${k}: 필수 칸 '${f}' 이 없음`);
      for (const f of Object.keys(o)) if (!L.need.includes(f) && !L.may.includes(f)) E(`${n} ${k}: 모르는 칸 '${f}' (허용: ${[...L.need, ...L.may].join(' · ')})`);
      if (seen.has(k)) E(`${n}: 열쇠 '${k}' 가 겹침`);
      seen.add(k);
    }
  }
  for (const o of rows.rules) { // 글 규칙의 까닭 (10h)
    const text = o.enforce === 'text' && !o.spec && !o.retired && !o.reserved;
    if (text && !o.text_why) E(`rules ${o.id}: 글 규칙인데 text_why(글로 남는 까닭)가 없음 — ${Object.keys(TEXT_WHY).join(' · ')}`);
    if (o.text_why && !TEXT_WHY[o.text_why]) E(`rules ${o.id}: 모르는 text_why '${o.text_why}' — ${Object.keys(TEXT_WHY).join(' · ')}`);
    if (o.text_why && !text) E(`rules ${o.id}: text_why 는 글 규칙에만 (기계 규칙 · 형식 설명은 없음)`);
  }
  const ids = new Set(rows.rules.map((o) => o.id));
  for (const [n, L] of Object.entries(LEDGERS)) for (const o of rows[n]) for (const f of L.refs || []) for (const r of [].concat(o[f] ?? [])) if (/^RULE-/.test(r) && !ids.has(r)) E(`${n} ${keyOf(n, o)}: 없는 규칙 '${r}' 을 가리킴`);
  for (const o of rows.formulas) for (const r of o.rules || []) if (!/^RULE-\d{4}$/.test(r)) E(`formulas ${o.id}: rules 칸의 '${r}' 이 규칙 번호가 아님`);
  for (const n of Object.keys(LEDGERS)) {
    const s = lastSeal(S.log, n);
    if (!s) E(`${n}: 봉인이 없음 — node rebuild/rules.mjs apply 로 첫 봉인(op seal)`);
    else if (s.sha !== sha(S.files[n] || '')) E(`${n}: 장부가 마지막 봉인(사건 ${s.seq})과 다름 — 도구 밖에서 고쳤다. 되돌리고 node rebuild/rules.mjs apply 로`);
  }
  S.log.forEach((e, i) => { if (e.seq !== i + 1) E(`${LOG}: 사건 순번이 ${i + 1} 째에서 끊김`); });
  return errs;
}

// 고치기 — 변경 묶음 → { errs, S } (새 장부 글 · 덧붙은 사건). 작업마다 그 장부의 새 sha 를 사건에 남긴다
export function apply(S, change) {
  const errs = [], at = change && change.at, why = String((change && change.why) || '').trim();
  if (!DATE.test(at || '')) errs.push(`${RULE} 변경 묶음 at 은 YYYY-MM-DD`);
  if (!why) errs.push(`${RULE} 변경 묶음 why 가 없음 — 왜 바꾸는지 한 줄`);
  if (!Array.isArray(change && change.ops) || !change.ops.length) errs.push(`${RULE} 변경 묶음 ops 가 비었음`);
  if (errs.length) return { errs, S };
  const files = { ...S.files }, log = [...S.log];
  for (const [i, op] of change.ops.entries()) {
    const n = op.file, where = `ops[${i}] (${op.op} ${n || '?'})`;
    if (!LEDGERS[n]) { errs.push(`${RULE} ${where}: 모르는 장부 — ${Object.keys(LEDGERS).join(' · ')}`); continue; }
    const rows = rowsOf(files[n]), idx = op.key != null ? rows.findIndex((o) => keyOf(n, o) === String(op.key)) : -1;
    let before = null, after = null;
    if (op.op === 'seal') {
      if (lastSeal(log, n)) { errs.push(`${RULE} ${where}: 이미 봉인된 장부 — 첫 봉인만 (고치려면 add · set · remove)`); continue; }
    } else if (op.op === 'add') {
      if (!op.row || typeof op.row !== 'object') { errs.push(`${RULE} ${where}: row 가 없음`); continue; }
      if (rows.some((o) => keyOf(n, o) === keyOf(n, op.row))) { errs.push(`${RULE} ${where}: 열쇠 '${keyOf(n, op.row)}' 가 이미 있음`); continue; }
      rows.push((after = op.row));
    } else if (op.op === 'set' || op.op === 'remove') {
      if (idx < 0) { errs.push(`${RULE} ${where}: 열쇠 '${op.key}' 인 줄이 없음`); continue; }
      before = rows[idx];
      if (op.op === 'remove') rows.splice(idx, 1);
      else {
        if (!op.fields || typeof op.fields !== 'object' || !Object.keys(op.fields).length) { errs.push(`${RULE} ${where}: fields 가 없음`); continue; }
        const o = { ...before };
        for (const [k, v] of Object.entries(op.fields)) { if (v === null) delete o[k]; else o[k] = v; }
        rows[idx] = after = o;
      }
    } else { errs.push(`${RULE} ${where}: 모르는 op — add · set · remove · seal`); continue; }
    files[n] = text(rows);
    log.push({ seq: log.length + 1, at, why, file: n, op: op.op, key: op.op === 'seal' ? null : keyOf(n, after || before), before, after, sha: sha(files[n]) });
  }
  const N = { files, log };
  return { errs: [...errs, ...(errs.length ? [] : check(N))], S: N };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [cmd, file, ...rest] = process.argv.slice(2), S = load(ROOT);
  if (cmd === 'check') { const e = check(S); console.log(e.length ? e.join('\n') : '규칙 장부 정확 — 오류 0'); process.exit(e.length ? 1 : 0); }
  if (cmd !== 'apply' || !file) { console.error('사용: node rebuild/rules.mjs apply <ops.json> [--dry] · check'); process.exit(2); }
  const { errs, S: N } = apply(S, JSON.parse(readFileSync(file, 'utf8')));
  if (errs.length) { console.error(`거부 — ${errs.length}:\n- ${errs.join('\n- ')}`); process.exit(1); }
  const changed = Object.keys(LEDGERS).filter((n) => N.files[n] !== S.files[n] || N.log.slice(S.log.length).some((e) => e.file === n));
  console.log(`통과 — 사건 ${S.log.length} → ${N.log.length} · 장부 ${changed.join(' · ')}`);
  if (!rest.includes('--dry')) {
    for (const n of changed) CLERK.writeLedger(n + '.jsonl', N.files[n], ROOT);
    CLERK.writeLedger(LOG, N.log.map(canon).join('\n') + '\n', ROOT);
    console.log('씀 — 생성 문서는 node rebuild/status.mjs --write');
  }
}
