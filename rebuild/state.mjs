// 상태 기록 (rebuild/PLAN.md 6c) — build-plan 을 기록으로, 글은 생성. 표의 작업 한 줄 = 기록 하나, 산문은 원문 그대로 한 덩어리.
//   원본: rebuild/state/build-plan.jsonl · 생성: rebuild/draft/build-plan.md (8 단계에 docs/design/build-plan.md 를 대신한다)
//   그때까지는 지금 문서가 손으로 고쳐지므로, render(기록) 이 지금 문서와 바이트까지 같아야 한다(시험 ⑯) — 다르면 parse 로 다시 들인다.
// 계약: 순수 — parse(글) → 기록, render(기록) → 글. 파일을 쓰지 않는다.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const SOURCE = 'docs/design/build-plan.md', RECORDS = 'rebuild/state/build-plan.jsonl';
// 계획 번호: 원래 순번(n)에서 — 12 → PLAN-012 · 12A → PLAN-012a · 50′ → PLAN-050p · (보류) → PLAN-H01…
export const planId = (n, hold) => {
  if (hold != null) return 'PLAN-H' + String(hold).padStart(2, '0');
  const m = String(n).match(/^(\d+)(A|′)?$/);
  if (!m) throw new Error(`계획 순번 '${n}' 의 모양을 모름`);
  return 'PLAN-' + m[1].padStart(3, '0') + (m[2] === 'A' ? 'a' : m[2] === '′' ? 'p' : '');
};
const cellsOf = (line) => line.slice(2, -2).split(' | ');
const STATE = { '☑': 'done', '☐': 'open', '◐': 'partial', '✗': 'dropped' };

export function parse(text) {
  const lines = text.split('\n'), out = []; let head = null, part = null, hold = 0, buf = [];
  const flush = () => { if (buf.length) { out.push({ kind: 'text', text: buf.join('\n') }); buf = []; } };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^## /.test(l)) part = l.slice(3);
    if (/^\| # \|/.test(l) && /^\|---/.test(lines[i + 1] || '')) { flush(); head = cellsOf(l); out.push({ kind: 'head', cols: head, sep: lines[i + 1] }); i++; continue; }
    if (head && /^\| /.test(l) && / \|$/.test(l)) {
      const c = cellsOf(l);
      if (c.length === head.length) {
        const n = c[0], isHold = n === '(보류)', rec = { kind: 'item', id: planId(n, isHold ? ++hold : null), n, part };
        head.slice(1).forEach((h, j) => { rec[h] = c[j + 1]; });
        const st = (rec['상태'] || '').trim()[0]; rec.state = STATE[st] || null;
        out.push(rec); continue;
      }
      flush(); out.push({ kind: 'raw', text: l, why: `칸 수 ${c.length} ≠ 머리 ${head.length} — 표 줄이 깨져 있어 원문 그대로` }); continue;
    }
    if (!/^\| /.test(l)) head = head && l === '' ? head : null;
    buf.push(l);
  }
  flush();
  return out;
}

export function render(records) {
  const out = []; let head = null;
  for (const r of records) {
    if (r.kind === 'text' || r.kind === 'raw') out.push(r.text);
    else if (r.kind === 'head') { head = r.cols; out.push(`| ${r.cols.join(' | ')} |`, r.sep); }
    else out.push(`| ${[r.n, ...head.slice(1).map((h) => r[h])].join(' | ')} |`);
  }
  return out.join('\n');
}

export const load = (root) => readFileSync(join(root, RECORDS), 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
