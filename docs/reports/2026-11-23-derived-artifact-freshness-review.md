# 생성물 · 빌드 의존 · 최신성 — 일반화 검토 (DEC-0076 뒤, 검토만)

> 2026-11-23 · develop 모드 · 사용자 요청 "이번 문제를 개별 명령의 예외로 끝내지 말고 … 일반화할 수 있는지 검토하되, 이번 작업의 범위를 임의로 확대하지 않는다". **검토만** — 장부 · 모드 표 · 명령 · 시험은 이 보고서로 바뀌지 않았다. 바꾼 것은 DEC-0076 의 한 줄(`dbtool limitations` modes 에 develop)뿐.
> 표기: **[사실]** 저장소에서 확인 · **[제안]** 결정 전.

## 1. 이번 문제의 모양 [사실]

판정 코드(`needMet`)를 바꾼 커밋은 그 판정의 **생성물**(`limitations.md`)도 같은 커밋에서 맞아야 끝내기 시험을 통과한다. 그런데 그 생성물을 만드는 명령의 허락이 **명령 단위** 로 모드에 묶여 있어, 원인을 바꾼 모드(develop)가 결과를 맞출 수 없었다. 같은 재생성이 MCP(`write_derived`, author · develop)로는 열려 있었다 — 같은 일을 두 장부 줄이 다르게 허락하고 있었다.

## 2. 생성물 목록 — 원천 · 만드는 명령 · 누가 · 최신성 검사 [사실]

| 생성물 | 원천 (빌드 의존) | 만드는 것 | 쓸 수 있는 모드 | 최신성 검사 |
|---|---|---|---|---|
| `limitations.md` | `data/db.json` + `judicial/judicial.js` limitationsMarkdown · needMet | `dbtool limitations --write` · MCP `write_derived` | author · inspect · develop (DEC-0076) · MCP author · develop | 시험 `tests/rules.test.mjs` "최신 상태" · CI `limitations --check` |
| `docs/textbook/90-부록-자동생성.md` | 저장소 코드 · `storage-map.json` · db | `dbtool textbook --write` · MCP `write_derived` | author · develop | develop · field finish `textbook --check` · CI |
| `rebuild/status/*` · `CLAUDE.md` · `docs/modes/*` · `.claude/skills/*` · `docs/plan/**` | 규칙 · 계획 · 명령 장부 · 모드 표 | `node rebuild/status.mjs --write` (문지기 stop 훅이 매 세션 끝에 돌림) | 모든 모드 (공통 구역 rebuild) | 공통 finish `status.mjs --check` · `plan.mjs check` · CI |
| `data/fetched/RETRIEVAL_TASKS.md` | 보강 고리 결과 | `dbtool augment … --write` | augment 의 모드 | 없음 (수동 과제 목록) |
| `workspace/receipts/*.md` | 같은 이름 `.jsonl` (해시 사슬) | 문지기 훅 (커밋 때 실음) | 문지기만 | 사슬 검사 (문지기) |
| `viewer.html` | `index.html` | (복사) | — | CI `cmp index.html viewer.html` |

## 3. 일반화 원칙 초안 [제안 — 결정 전]

| 원칙 | 뜻 | 지금 | 틈 |
|---|---|---|---|
| **P1 생성물은 손으로 고치지 않는다 (Derived Artifact)** | 생성물의 권위는 원천 + 생성기. 사람 · AI 는 원천만 고친다 | 문서 머리말 "생성물 — 손으로 고치지 않는다" · 최신성 시험이 손 고침을 거부 | 경로 구역(modes.json)은 생성물 파일에도 develop 쓰기를 허락(`**`) — 막는 것은 시험뿐 |
| **P2 원천을 바꿀 수 있는 모드는 그 생성물을 다시 만들 수 있다 (Build Dependency)** | 재생성 허락을 명령이 아니라 **의존** 에서 계산: 생성물 G 의 원천 중 하나라도 모드 m 의 쓰기 구역에 있으면 m 은 G 의 생성기를 돌릴 수 있다 | 명령 장부 줄마다 손으로 modes 를 적음 — 이번처럼 원천(judicial.js)을 쓰는 develop 이 빠질 수 있음 | 그 계산을 하려면 생성물 → 원천 목록(위 표의 둘째 칸)이 장부여야 함 |
| **P3 같은 커밋에서 최신 (Artifact Freshness)** | 원천을 바꾼 커밋은 그 생성물이 최신이어야 열린다 | limitations · textbook · status 는 시험 · finish · CI 로 됨 | RETRIEVAL_TASKS 는 검사 없음 · 생성물마다 검사 자리가 다름(시험 · finish · CI) |
| **P4 재생성은 판정 데이터를 바꾸지 않는다** | 생성기는 원천을 읽기만, 서기의 파생 구역(`derived`)에만 쓴다 | `writeDerived` 의 구역이 세 파일로 닫혀 있음(`legislative/clerk.mjs` DERIVED) | 생성기가 읽기만 하는지는 코드 검토로만 — 기계 확인 없음 (이번에는 509 파일 지문 전후 대조로 손 확인) |

## 4. 이번에 하지 않은 것 · 하려면 필요한 결정 [제안]

- P2 를 기계로 하려면 생성물 목록(위 표)을 장부로 만들고, 명령 장부의 해당 줄 modes 를 그 장부에서 **계산** 하도록 바꿔야 한다 — 명령 장부 형식 변경이라 별도 결정. 그 전에는 이번처럼 줄마다 DEC 로.
- P1 의 경로 막기(develop 의 `**` 에서 생성물 빼기)는 모드 표(L6, 사람 커밋) 변경 — 시험이 이미 막고 있어 급하지 않다.
- P4 의 기계 확인은 "재생성 명령 전후로 data/ · attestations/ 지문 동일" 시험 하나로 될 수 있다 — 생성기가 늘 때.

권고: 지금은 원칙 문장(P1–P4)만 사용자 확인을 받고, 장부화(P2)는 생성기가 하나 더 생기거나 같은 틈이 다시 생길 때(RULE-0462 — 가장 세게 무는 곳에서 켠다).
