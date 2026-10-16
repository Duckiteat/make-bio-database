#!/usr/bin/env node
// 색인·파싱 고정 비용 벤치 (build-plan 16A·15–19 문턱 실측) — 읽기 전용, 쓰기 없음.
//
// 왜: 지금은 매 명령이 콜드 프로세스라 db.json 을 통째 읽어 JSON.parse → normalize → index(db) 를
//     매번 다시 한다 (O(전체 db)). 규모가 커지면 이 고정 비용이 명령마다 붙는다. 영속 색인(파생·sha 도장,
//     건드린 것만)이 무엇을 되돌려 주는지, 언제 켜야 이득인지(문턱)를 직감이 아니라 숫자로 보인다.
//
// 재는 것: ① readFile+JSON.parse(전체 파싱) ② normalize ③ index(db) ④ 점 조회 resolveRef.
//          ①②③ 는 O(전체) 라 규모에 비례 — 합성 N× 로 곡선을 뜬다. ④ 는 조회라 규모 무관해야 정상.
// 실행: node tests/bench_index.js [--repeat 5] [--max 50]
'use strict';
const { readFileSync } = require('fs');
const path = require('path');
const C = require('../core.js');

const ROOT = path.join(__dirname, '..');
const DB = path.join(ROOT, 'data/db.json');
const rep = +(process.argv[process.argv.indexOf('--repeat') + 1] || 5) || 5;
const MAXN = +(process.argv[process.argv.indexOf('--max') + 1] || 50) || 50;
const THRESH_MS = 200; // "명령이 느리게 느껴지는" 대략 문턱

const best = (f) => { let ms = Infinity, r; for (let i = 0; i < rep; i++) { const t0 = process.hrtime.bigint(); r = f(); ms = Math.min(ms, Number(process.hrtime.bigint() - t0) / 1e6); } return { r, ms }; };
const clone = (x) => JSON.parse(JSON.stringify(x));

const baseText = readFileSync(DB, 'utf8');
const baseBytes = Buffer.byteLength(baseText);
const baseRaw = JSON.parse(baseText);
const base = C.normalize(clone(baseRaw));
const nSenses = Object.keys(base.senses).length, nTerms = Object.keys(base.terms).length;

// 합성 N× : terms·senses 를 접미사로 복제. index() 가 읽는 필드(names·aliases·term·xrefs·fingerprint·n)만
// 일관되면 됨 — sense.term 을 같은 복제의 term 으로 맞춰 내부 참조를 유효하게 둔다.
function scaled(N) {
  if (N === 1) return base;
  const terms = { ...base.terms }, senses = { ...base.senses };
  for (let c = 1; c < N; c++) {
    for (const [tid, t] of Object.entries(base.terms)) terms[tid + '~' + c] = clone(t);
    for (const [sid, d] of Object.entries(base.senses)) { const nd = clone(d); nd.term = d.term + '~' + c; senses[sid + '~' + c] = nd; }
  }
  return { ...base, terms, senses };
}

// normalize·index 비용을 1× 에서 측정 (둘 다 O(전체))
const normCost = best(() => C.normalize(clone(baseRaw))).ms;
const firstId = Object.keys(base.senses)[0];
const lookupCost = (() => { const ix = C.index(base); return best(() => C.resolveRef(ix, firstId)).ms; })();

console.log(`\n현재 db: senses ${nSenses} · terms ${nTerms} · ${(baseBytes / 1024).toFixed(0)} KiB`);
console.log(`1회 측정: normalize ${normCost.toFixed(1)} ms · 점 조회 resolveRef ${(lookupCost * 1000).toFixed(1)} µs (규모 무관해야 정상)\n`);
console.log('배수 │ senses │  크기   │ JSON.parse │ index(db) │ parse+index │ (parse% / index%)');
console.log('─────┼────────┼─────────┼────────────┼───────────┼─────────────┼──────────────────');

const Ns = [1, 2, 5, 10, 25, 50].filter((n) => n <= MAXN);
const rows = [];
for (const N of Ns) {
  const db = scaled(N);
  const txt = JSON.stringify(db);
  const mb = Buffer.byteLength(txt) / (1024 * 1024);
  const parseMs = best(() => JSON.parse(txt)).ms;
  const idxMs = best(() => C.index(db)).ms;
  const sum = parseMs + idxMs;
  rows.push({ N, sens: nSenses * N, mb, parseMs, idxMs, sum });
  console.log(
    `${String(N).padStart(4)}× │ ${String(nSenses * N).padStart(6)} │ ${mb.toFixed(1).padStart(5)} MB │ ` +
    `${parseMs.toFixed(1).padStart(8)} ms │ ${idxMs.toFixed(1).padStart(7)} ms │ ${sum.toFixed(1).padStart(9)} ms │ ` +
    `(${((parseMs / sum) * 100).toFixed(0)}% / ${((idxMs / sum) * 100).toFixed(0)}%)`);
}

// 선형 외삽으로 문턱 추정 (parse+index 는 대략 O(n))
const a = rows[0], b = rows[rows.length - 1];
const slope = (b.sum - a.sum) / (b.sens - a.sens); // ms per sense
const atThresh = a.sens + (THRESH_MS - a.sum) / slope;
console.log('─────┴────────┴─────────┴────────────┴───────────┴─────────────┴──────────────────');
console.log(`\n외삽(선형): parse+index 가 ${THRESH_MS} ms 를 넘는 지점 ≈ senses ${Math.round(atThresh).toLocaleString()} ` +
  `(현재의 ${(atThresh / nSenses).toFixed(0)}배, ≈ ${((atThresh / nSenses) * baseBytes / (1024 * 1024)).toFixed(0)} MB db)`);
console.log(`되돌림 가늠 — 영속 색인(index 생략): parse 만 남음 · 오프셋/샤딩(건드린 것만): parse 대부분 사라짐.`);
console.log(`지금(1×) parse+index = ${a.sum.toFixed(1)} ms → 이 규모에선 영속 색인 오버헤드가 안 갚아짐(전체 파싱이 최적).\n`);
