#!/usr/bin/env node
// 가정 원장 (2026-10-23, build-plan 49 · 설계 docs/design/structure-realignment.md §3.5). 형식 변경:
//   시나리오의 인라인 가상 숫자 → data/assumptions.jsonl 의 번호 A… (추가만 하는 사슬) + 시나리오는 { "assume": "A…" } 로 가리킴.
//   · 숫자를 새로 정하지 않는다: 값은 시나리오 그대로, 기원(assumed·unrecorded)과 한계는 지금 첫 장면 기원 판정(scene_origin.scenarioRows) 그대로.
//   · 같은 자리·같은 값은 한 번호 (부피는 세포까지 자리). 같은 자리·같은 값인데 기원이 다르면 멈춘다(지어내지 않음).
//   · 등록된 검증 시나리오(protocol)와 파생 시나리오(base)는 다시 쓰지 않는다 — 등록 해시를 지킨다. 그 숫자는 내용 일치로 원장과 이어진다(assume uses).
//   · 무손실: 다시 쓴 시나리오를 원장으로 풀면 변환 전 객체와 정준 JSON 이 같아야 한다.
//   · at 은 고정 — 재실행 결정론. 원장이 이미 있으면 하지 않는다.
// 사용: node migrations/012-assumption-ledger.mjs [저장소 최상위]
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
const ROOT = process.argv[2] || new URL('..', import.meta.url).pathname;
const ATT = require(join(ROOT, 'judicial/attestation.js'));
const AS = require(join(ROOT, 'compiler/assumptions.js'));
const SO = require(join(ROOT, 'judicial/scene_origin.js'));
const AA = require(join(ROOT, 'judicial/assumption_audit.js'));
const sha = (x) => createHash('sha256').update(x).digest('hex');
const AT = '2026-10-23T00:00:00.000Z';
const BASIS = '변환 012 — 시나리오 인라인 값에서 옮김 (숫자를 새로 정하지 않음 · 숫자의 출처는 기록되지 않았다)';

const ledgerFile = join(ROOT, 'data/assumptions.jsonl');
if (existsSync(ledgerFile) && readFileSync(ledgerFile, 'utf8').trim()) { console.log('이미 원장이 있음 — 변환하지 않음'); process.exit(0); }
const db = JSON.parse(readFileSync(join(ROOT, 'data/db.json'), 'utf8'));
const dir = join(ROOT, 'examples/scenarios');
const files = readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'subjects.json').sort();

// 1. 자리마다 값·기원 모으기
const recs = new Map(), plan = [];
for (const f of files) {
  const text = readFileSync(join(dir, f), 'utf8'), sc = JSON.parse(text);
  if (sc.protocol || sc.base) continue;
  const sl = AS.slots(sc).filter((x) => typeof x.value === 'number');
  if (!sl.length) continue;
  const { rows } = SO.scenarioRows(db, sc);
  const originOf = new Map(rows.map((r) => [`${r.field}|${r.key}`, r]));
  for (const x of sl) {
    const row = originOf.get(`${x.kind}|${x.key}`);
    if (!row) throw new Error(`${f}: ${x.kind} ${x.key} 의 기원 행이 없음`);
    const slot = { kind: x.kind, key: x.key, param: x.param, ...(x.cell ? { cell: x.cell } : {}) };
    const k = `${AS.slotKey(x)}|${x.value}|${x.unit ?? ''}`;
    const rec = { slot, value: x.value, unit: x.unit ?? null, origin: row.origin, limitations: row.limitations, basis: BASIS, migrated: true };
    const had = recs.get(k);
    if (had && (had.origin !== rec.origin || had.limitations.join() !== rec.limitations.join())) throw new Error(`같은 자리·같은 값인데 기원이 다름 — ${k}: ${had.origin}(${had.limitations}) · ${rec.origin}(${rec.limitations}) (${f})`);
    recs.set(k, rec);
  }
  plan.push({ f, text, sc });
}

// 2. 번호 매기기 (결정론 순서) + 사슬
const order = (r) => [AS.KINDS.indexOf(r.slot.kind), r.slot.key, String(r.slot.param), r.slot.cell || '', r.value];
const list = [...recs.values()].sort((a, b) => { const x = order(a), y = order(b); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1; return 0; });
let prev = AA.GENESIS; const events = [], idOf = new Map();
list.forEach((r, i) => {
  const seq = i + 1, body = { seq, at: AT, id: 'A' + String(seq).padStart(6, '0'), ...r, prev };
  const ev = { ...body, root: sha(body.prev + '\n' + ATT.canon(body)) };
  events.push(ev); prev = ev.root;
  idOf.set(`${AS.slotKey(r.slot)}|${r.value}|${r.unit ?? ''}`, ev.id);
});

// 3. 시나리오 다시 쓰기 + 무손실 확인
const out = [];
for (const { f, sc } of plan) {
  const before = ATT.canon(sc), copy = JSON.parse(JSON.stringify(sc));
  for (const x of AS.slots(copy)) if (typeof x.value === 'number') x.holder[x.field] = { assume: idOf.get(`${AS.slotKey(x)}|${x.value}|${x.unit ?? ''}`) };
  const r = AS.resolve(copy, events);
  if (r.error) throw new Error(`${f}: ${r.error}`);
  if (ATT.canon(r.scenario) !== before) throw new Error(`${f}: 무손실 확인 실패 — 풀린 시나리오가 원래와 다름`);
  out.push({ f, text: JSON.stringify(copy, null, 2) + '\n', refs: r.used.length });
}
const chk = AA.verifyChain(events);
if (!chk.ok) throw new Error('사슬 확인 실패: ' + chk.errors.join('; '));
writeFileSync(ledgerFile, events.map((e) => JSON.stringify(e)).join('\n') + '\n');
for (const o of out) writeFileSync(join(dir, o.f), o.text);
const by = {}; for (const e of events) by[e.origin] = (by[e.origin] || 0) + 1;
console.log(`가정 원장: 기록 ${events.length} (${Object.entries(by).map(([k, n]) => `${k} ${n}`).join(' · ')}) · 시나리오 ${out.length} 다시 씀 · 번호 자리 ${out.reduce((s, o) => s + o.refs, 0)} · head ${prev.slice(0, 12)}…`);
