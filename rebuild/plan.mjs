#!/usr/bin/env node
// 계획 고치기 — 계획 문서는 생성물이라 손으로 고치지 않고 이것으로만 바꾼다 (DEC-0027)
//   node rebuild/plan.mjs apply <ops.json> [--dry]   변경 묶음 { at, why, ops[] } — 형식은 rebuild/state.mjs apply 머리말
//   node rebuild/plan.mjs check                      계획 기록의 정확성 검사만
// 계약: 검사(state.check)를 통과해야 서기 writeState 로 쓴다. 그 뒤 문서는 node rebuild/status.mjs --write 가 다시 만든다.
import { readFileSync } from 'node:fs';
import * as STATE from './state.mjs';
import * as CLERK from '../legislative/clerk.mjs';
import { ROOT, planCtx } from './status.mjs';

const [cmd, file, ...rest] = process.argv.slice(2);
const S = STATE.load(ROOT);
if (cmd === 'check') { const e = STATE.check(S, planCtx(S)); console.log(e.length ? e.join('\n') : '계획 기록 정확 — 오류 0'); process.exit(e.length ? 1 : 0); }
if (cmd !== 'apply' || !file) { console.error('사용: node rebuild/plan.mjs apply <ops.json> [--dry] · check'); process.exit(2); }
const { errs, S: N } = STATE.apply(S, JSON.parse(readFileSync(file, 'utf8')));
const all = [...errs, ...STATE.check(N, planCtx(N))];
if (all.length) { console.error(`거부 — ${all.length}:\n- ${all.join('\n- ')}`); process.exit(1); }
console.log(`통과 — 사건 ${S.log.length} → ${N.log.length}`);
if (!rest.includes('--dry')) { const o = STATE.serialize(N); CLERK.writeState('plans.jsonl', o.plans, ROOT); CLERK.writeState('plan-log.jsonl', o.log, ROOT); console.log('씀 — 문서는 node rebuild/status.mjs --write'); }
