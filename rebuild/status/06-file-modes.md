# 파일 → 모드

> 생성물 — `node rebuild/status.mjs --write`(응답이 끝날 때 훅이 돌림). 손으로 고치지 않는다. 읽기 점검용이며 다른 코드가 읽지 않는다.

원본: `rebuild/index/file-modes.jsonl` (규칙 45, 위에서부터 첫 규칙이 이긴다). 파일마다 어느 모드가 주로 건드리는지.

## 모드별

| 모드 | 파일 | KB |
|---|---|---|
| 공통 `common` | 80 | 6914.9 |
| 정보 작성 `author` | 449 | 16512.0 |
| 기초시험 `baseline` | 45 | 287.8 |
| 디벨롭 `develop` | 169 | 2183.6 |
| 적분장 `field` | 0 | 0.0 |
| 점검·검증 `inspect` | 33 | 748.4 |

## 규칙별

| 형식 | 모드 | 파일 | KB | 왜 |
|---|---|---|---|---|
| `rebuild/**` | common | 29 | 5826.3 | 재건 관리 — 모든 모드가 읽기만 |
| `data/fetched/**` | author | 357 | 13649.0 | 수신함 — 정보 작성·수집이 받는다 (점검·검증이 대조) |
| `data/db.json` | author | 1 | 676.4 | 지식 원본 — 패치·관문으로만 |
| `data/patches/**` | author | 69 | 1032.5 | 병합 기록 |
| `data/log/**` | author | 3 | 707.5 | 델타 기록 |
| `data/assumptions.jsonl` | author | 1 | 182.3 | 가정 원장 |
| `data/dictionary.jsonl` | develop | 1 | 45.5 | 말 사전 — 통제 토큰의 영어 |
| `data/preregistrations.jsonl` | baseline | 1 | 2.8 | 사전 등록부 |
| `attestations/**` | inspect | 1 | 299.0 | 증명 도장 — 승인 도장은 점검·검증이 남긴다 |
| `workspace/tasks/**` | inspect | 7 | 15.0 | 과제 — 통합가가 쓴다 |
| `workspace/handoff/NEXT-*` | common | 2 | 6.5 | 세션 넘김 — 전환 기록이 대신할 것 |
| `workspace/**` | author | 12 | 53.1 | 수집가 작업 공간 |
| `examples/scenarios/**` | baseline | 44 | 285.0 | 시나리오 — 기초시험이 돌린다 |
| `examples/**` | author | 3 | 4.6 | 예시 패치·합성 관찰 |
| `engine/**` | develop | 17 | 200.3 | 운명 엔진·Rust·결합점 |
| `compiler/**` | develop | 7 | 49.0 | 컴파일러 |
| `judicial/**` | develop | 29 | 543.9 | 사법부 코드 |
| `legislative/**` | develop | 3 | 73.8 | 입법부 코드 |
| `mcp/**` | develop | 4 | 34.7 | MCP 서버 |
| `migrations/**` | develop | 13 | 59.8 | 형식 변환 |
| `schemas/obs/**` | author | 1 | 13.4 | 관찰 포트 계약 |
| `schemas/**` | develop | 1 | 22.8 | 원자료 계약 |
| `core.js` | develop | 1 | 63.2 | 행정 |
| `model.js` | develop | 1 | 67.3 | 공유 |
| `vocab.js` | develop | 1 | 55.6 | 통제 어휘 — 사용자 요청 시만 |
| `dictionary.js` | develop | 1 | 7.6 | 번역기 |
| `orchestrator.js` | develop | 1 | 23.3 | 조정자 |
| `dbtool.mjs` | develop | 1 | 78.1 | 명령줄 |
| `scenarios.js` | develop | 1 | 1.6 | 시나리오 읽기 |
| `inbox.js` | develop | 1 | 5.4 | 수신함 해석 |
| `tests/fixtures/rejections/**` | develop | 26 | 33.7 | 거부 말뭉치 |
| `tests/**` | develop | 57 | 536.1 | 시험 |
| `viewer.html` | inspect | 1 | 33.7 | 화면 — 사람이 읽는 자리 |
| `index.html` | inspect | 1 | 33.7 | 화면 복사본 |
| `docs/reports/**` | inspect | 23 | 367.0 | 보고서 — 읽기·점검 |
| `docs/textbook/**` | common | 11 | 403.2 | 교과서 — 재건으로 읽기 모드가 대신할 글 |
| `docs/design/**` | common | 20 | 510.0 | 설계 문서 — 장부 단위가 모드를 따로 가짐 |
| `docs/**` | common | 8 | 71.5 | 안내 문서 |
| `limitations.md` | author | 1 | 92.3 | 한계 등록부 (생성물) |
| `CHANGES.md` | develop | 1 | 279.8 | 변경 기록 |
| `SCHEMA.md` | author | 1 | 100.8 | 형식 |
| `*.md` | common | 4 | 64.0 | 최상위 문서 |
| `.claude/**` | common | 6 | 33.5 | 도구 설정 |
| `.github/**` | develop | 1 | 2.1 | CI |
| `.gitignore` | develop | 1 | 0.0 | 설정 |

## 규칙에 맞지 않는 파일 (0 이어야 함)

없음

## 아무 파일에도 맞지 않는 규칙 · 모르는 모드

없음
