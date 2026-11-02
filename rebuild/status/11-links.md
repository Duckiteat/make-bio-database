# 자리 ↔ 연결

> 생성물 — `node rebuild/status.mjs --write`(응답이 끝날 때 훅이 돌림). 손으로 고치지 않는다. 읽기 점검용이며 다른 코드가 읽지 않는다.

원본: `docs/textbook/storage-map.json`(구역·자리) · `rebuild/rules/rules.jsonl`(규칙의 where) · `rebuild/state/plans.jsonl`(열린 작업). 이름 하나로 적힌 자리(* 없는 것 163)만 센다. **연결 없음**은 결함이 아니라 후보다 — 닿는 규칙이나 계획이 있으면 where·결과에 경로를 적는다. 자리마다 자세히: `node rebuild/probe.mjs <파일>` · 새 파일: `node rebuild/probe.mjs --new`

| 등급 | 구역 | 자리 | 규칙에 닿음 | 열린 계획에 닿음 | 연결 없음 |
|---|---|---|---|---|---|
| L2 | `code:compiler` | 7 | 3 | 4 | 2 |
| L2 | `code:config` | 2 | 0 | 0 | 2 |
| L2 | `code:core` | 6 | 4 | 2 | 2 |
| L2 | `code:engine` | 15 | 2 | 2 | 12 |
| L2 | `code:judicial` | 32 | 25 | 9 | 5 |
| L2 | `code:legislative` | 3 | 3 | 1 | 0 |
| L2 | `code:mcp` | 4 | 2 | 0 | 2 |
| L2 | `code:migration` | 2 | 0 | 0 | 2 |
| L2 | `code:tests` | 41 | 21 | 0 | 20 |
| L2 | `code:tools` | 15 | 4 | 1 | 10 |
| L2 | `doc:history` | 2 | 0 | 0 | 2 |
| L2 | `doc:scenario` | 1 | 0 | 0 | 1 |
| L2 | `doc:spec` | 7 | 0 | 0 | 7 |
| L3 | `gen:build` | 3 | 0 | 0 | 3 |
| L3 | `gen:derived` | 2 | 1 | 0 | 1 |
| L3 | `gen:hub` | 1 | 0 | 1 | 0 |
| L3 | `gen:textbook` | 1 | 0 | 0 | 1 |
| L4 | `ledger:changes` | 1 | 0 | 0 | 1 |
| L4 | `ledger:storage-map` | 1 | 1 | 0 | 0 |
| L4 | `ledger:transitions` | 1 | 0 | 0 | 1 |
| L5 | `attest:registry` | 1 | 0 | 0 | 1 |
| L5 | `data:assays` | 1 | 0 | 0 | 1 |
| L5 | `data:assumptions` | 1 | 0 | 0 | 1 |
| L5 | `data:db` | 1 | 1 | 0 | 0 |
| L5 | `data:dictionary` | 1 | 0 | 0 | 1 |
| L5 | `data:prereg` | 1 | 1 | 0 | 0 |
| L6 | `guard:gate` | 1 | 1 | 0 | 0 |
| L6 | `guard:self-tests` | 8 | 4 | 0 | 4 |
| L6 | `guard:settings` | 1 | 0 | 0 | 1 |

## 연결 없는 자리 (83)

- `code:compiler`: `compiler/obs_operator.js` · `compiler/tape.js`
- `code:config`: `.github/workflows/check.yml` · `.gitignore`
- `code:core`: `scenarios.js` · `inbox.js`
- `code:engine`: `engine/rng.js` · `engine/probe_pool.js` · `engine/probe_worker.js` · `engine/rust/src/engine.rs` · `engine/rust/src/tape.rs` · `engine/rust/src/rng.rs` · `engine/rust/src/lib.rs` · `engine/rust/src/bin/fate_cli.rs` · `engine/rust/Cargo.toml` · `engine/rust/Cargo.lock` · `engine/rust/.gitignore` · `engine/rust/build.sh`
- `code:judicial`: `judicial/dependency.js` · `judicial/fault.js` · `judicial/stats.js` · `judicial/qual_graph.js` · `judicial/stiffness.js`
- `code:mcp`: `mcp/query.mjs` · `mcp/fetch.mjs`
- `code:migration`: `migrations/010-v10-to-v12-values.js` · `migrations/002-id-map.json`
- `code:tests`: `tests/dictionary_seal.test.mjs` · `tests/enforcement_gaps.test.mjs` · `tests/transitions.test.mjs` · `tests/affected.test.mjs` · `tests/gap_schema.test.mjs` · `tests/retraction_propagation.test.mjs` · `tests/dose_slope.test.mjs` · `tests/qual_compare.test.mjs` · `tests/qual_graph.test.mjs` · `tests/qualitative.test.mjs` · `tests/telomere.test.mjs` · `tests/bench_engine.js` · `tests/collection_audit.test.mjs` · `tests/conservation.test.mjs` · `tests/bench_index.js` · `tests/runbook.test.mjs` · `tests/fixtures/brenda/km-sample.xml` · `tests/fixtures/FLOOR.json` · `tests/fixtures/augment/README.md` · `tests/probe.test.mjs`
- `code:tools`: `viewer.html` · `rebuild/index.mjs` · `rebuild/read.mjs` · `rebuild/render.mjs` · `rebuild/state.mjs` · `rebuild/precheck.mjs` · `rebuild/regen.mjs` · `rebuild/probe.mjs` · `rebuild/plan.mjs` · `rebuild/plan-import.mjs`
- `doc:history`: `DESIGN-v4.md` · `FEATURES.md`
- `doc:scenario`: `examples/scenarios/subjects.json`
- `doc:spec`: `SCHEMA.md` · `README.md` · `docs/design/scaling-limits.md` · `data/fetched/README.md` · `docs/PROMPTS.md` · `docs/RUNBOOK.md` · `docs/project-overview.md`
- `gen:build`: `engine/rust/pkg/fate_core.wasm` · `engine/rust/pkg/fate_core.wasm.json` · `index.html`
- `gen:derived`: `data/fetched/RETRIEVAL_TASKS.md`
- `gen:textbook`: `docs/textbook/90-부록-자동생성.md`
- `ledger:changes`: `CHANGES.md`
- `ledger:transitions`: `workspace/transitions.jsonl`
- `attest:registry`: `attestations/registry.json`
- `data:assays`: `data/assays.jsonl`
- `data:assumptions`: `data/assumptions.jsonl`
- `data:dictionary`: `data/dictionary.jsonl`
- `guard:self-tests`: `tests/affected.mjs` · `tests/trace.mjs` · `tests/snapshot.mjs` · `tests/mutation/run.mjs`
- `guard:settings`: `.claude/settings.json`
