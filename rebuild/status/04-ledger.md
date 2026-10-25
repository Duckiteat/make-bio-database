# 분류 장부 (rebuild/ledger/*.jsonl)

> 생성물 — `node rebuild/status.mjs --write`(응답이 끝날 때 훅이 돌림). 손으로 고치지 않는다. 읽기 점검용이며 다른 코드가 읽지 않는다.

장부 파일: units.jsonl · 단위 2545

## 모드 × 종류

| 모드 | 규칙 | 절차 | 이유 | 현재 숫자 | 역사 | 합 |
|---|---|---|---|---|---|---|
| 공통 `common` | 80 | 76 | 86 | 39 | 97 | 378 |
| 정보 작성 `author` | 603 | 230 | 186 | 16 | 104 | 1139 |
| 기초시험 `baseline` | 168 | 51 | 22 | 22 | 2 | 265 |
| 디벨롭 `develop` | 387 | 30 | 99 | 9 | 7 | 532 |
| 적분장 `field` | 31 | 0 | 2 | 1 | 2 | 36 |
| 점검·검증 `inspect` | 69 | 66 | 17 | 7 | 36 | 195 |

규칙이 하나도 없는 모드: 없음

## 규칙의 집행

| 집행 | 규칙 수 |
|---|---|
| machine | 269 |
| text | 181 |
| none | 0 |
| unchecked | 888 |

집행 자리 확인 (machine 288): 파일·이름 확인 278 · 글로만 적힘 10 · 못 찾음 0

이 확인은 '자리가 있다' 까지다 — 그 자리가 정말 그 규칙을 집행하는지는 5 단계에서 거부 시험으로 확인한다.

## 출처 문서별

| 문서 | 단위 |
|---|---|
| `CLAUDE.md` | 241 |
| `README.md` | 153 |
| `SCHEMA.md` | 427 |
| `docs/PROMPTS.md` | 151 |
| `docs/RUNBOOK.md` | 180 |
| `docs/design/agent-rules.md` | 190 |
| `docs/textbook/01-원칙과-구조.md` | 55 |
| `docs/textbook/02-저장-위치와-방식.md` | 81 |
| `docs/textbook/03-데이터-모델.md` | 116 |
| `docs/textbook/04-알고리즘.md` | 232 |
| `docs/textbook/05-상호작용.md` | 94 |
| `docs/textbook/06-출력-해석.md` | 115 |
| `docs/textbook/07-AI-작업-절차.md` | 117 |
| `docs/textbook/08-한계와-진화.md` | 46 |
| `workspace/README.md` | 25 |
| `workspace/SOURCES.md` | 22 |
| `workspace/START-HERE.md` | 32 |
| `workspace/handoff/HANDOFF-ikba-halflife.md` | 54 |
| `workspace/handoff/HANDOFF-telomere-quantitative.md` | 30 |
| `workspace/handoff/HANDOFF-template.md` | 16 |
| `workspace/handoff/HANDOFF-tnf-mrna-halflife.md` | 17 |
| `workspace/handoff/HANDOFF-validation-precondition.md` | 19 |
| `workspace/handoff/NEXT-2026-10-23.md` | 11 |
| `workspace/handoff/NEXT-2026-10-25.md` | 26 |
| `workspace/tasks/README.md` | 8 |
| `workspace/tasks/TASK-001-tnf-mrna-halflife.md` | 11 |
| `workspace/tasks/TASK-002-ikba-halflife.md` | 10 |
| `workspace/tasks/TASK-003-tca-enzyme-kinetics.md` | 25 |
| `workspace/tasks/TASK-004-telomere-quantitative.md` | 15 |
| `workspace/tasks/TASK-005-tca-flux-validation.md` | 13 |
| `workspace/tasks/TASK-TYPES.md` | 13 |

## 사본

사본 단위(same_as) 183 · 사본이 있는 원래 단위 237 · 한 규칙이 적힌 곳 최대 9

매긴 방식: 판단 1262 · 휴리스틱 1283 (`by: heur` — 검토 전, 5 단계에서 규칙부터 다시 봄) · 수식 후보(EQ) 56

## 단위가 없는 줄 (제목·표 머리·빈 줄 제외 — 0 이어야 1 단계 끝)

| 문서 | 단위가 있는 줄 | 빠진 줄 |
|---|---|---|
| `CLAUDE.md` | 74 | 없음 |
| `README.md` | 153 | 없음 |
| `SCHEMA.md` | 427 | 없음 |
| `docs/PROMPTS.md` | 151 | 없음 |
| `docs/RUNBOOK.md` | 178 | 없음 |
| `docs/design/agent-rules.md` | 92 | 없음 |
| `docs/textbook/01-원칙과-구조.md` | 55 | 없음 |
| `docs/textbook/02-저장-위치와-방식.md` | 81 | 없음 |
| `docs/textbook/03-데이터-모델.md` | 116 | 없음 |
| `docs/textbook/04-알고리즘.md` | 232 | 없음 |
| `docs/textbook/05-상호작용.md` | 94 | 없음 |
| `docs/textbook/06-출력-해석.md` | 115 | 없음 |
| `docs/textbook/07-AI-작업-절차.md` | 117 | 없음 |
| `docs/textbook/08-한계와-진화.md` | 46 | 없음 |
| `workspace/README.md` | 25 | 없음 |
| `workspace/SOURCES.md` | 22 | 없음 |
| `workspace/START-HERE.md` | 31 | 없음 |
| `workspace/handoff/HANDOFF-ikba-halflife.md` | 54 | 없음 |
| `workspace/handoff/HANDOFF-telomere-quantitative.md` | 30 | 없음 |
| `workspace/handoff/HANDOFF-template.md` | 16 | 없음 |
| `workspace/handoff/HANDOFF-tnf-mrna-halflife.md` | 17 | 없음 |
| `workspace/handoff/HANDOFF-validation-precondition.md` | 19 | 없음 |
| `workspace/handoff/NEXT-2026-10-23.md` | 11 | 없음 |
| `workspace/handoff/NEXT-2026-10-25.md` | 26 | 없음 |
| `workspace/tasks/README.md` | 8 | 없음 |
| `workspace/tasks/TASK-001-tnf-mrna-halflife.md` | 11 | 없음 |
| `workspace/tasks/TASK-002-ikba-halflife.md` | 10 | 없음 |
| `workspace/tasks/TASK-003-tca-enzyme-kinetics.md` | 25 | 없음 |
| `workspace/tasks/TASK-004-telomere-quantitative.md` | 15 | 없음 |
| `workspace/tasks/TASK-005-tca-flux-validation.md` | 13 | 없음 |
| `workspace/tasks/TASK-TYPES.md` | 13 | 없음 |

## 형식 오류

없음
