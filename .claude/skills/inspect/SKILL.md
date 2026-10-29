---
name: inspect
description: "점검·검증 모드 — 상태를 읽거나(L0·L1·L2), 모은 후보를 판정하거나, 승인 도장을 남길 때. 세션을 이 모드로 시작할 때 연다 (한 세션 = 한 모드)."
---

# 모드: 점검·검증 (`inspect` — 사람의 유일한 입구)

> 생성물 — `node rebuild/status.mjs --write` 가 `rebuild/rules/rules.jsonl · modes.json` 에서 만든다. 손으로 고치지 않는다 (규칙을 바꾸려면 원본을).

- **언제**: 상태를 읽거나(L0·L1·L2), 모은 후보를 판정하거나, 승인 도장을 남길 때
- **목표**: 상태를 읽고, 모은 후보를 판정한다
- **쓸 수 있는 곳**: db 쓰기 금지. 판정 결과(통과·거부·재검토)와 승인 도장(증명 구역)만 (결정 ①)
- **가장 큰 위험**: 자기가 모은 것을 자기가 통과
- **끝내기 전**: verify-collection · 인용–원문 대조 · node dbtool.mjs attest
- **멈춤**: 1차 출처를 열 수 없음 → 사람

공통 규칙은 중심 문서(`CLAUDE.md`)에 있다.

## 지켜야 할 규칙 — 사람·AI (32)

### 수집·위임 (다른 AI·수집가)

- `RULE-0265` 저장소에 접근하지 못하는 AI(웹 챗 등)는 두 가지에만 쓴다. 나머지는 손해가 더 크다.
- `RULE-0266` 상수·외부 ID 를 "대충 아는 값" 으로 받기 — 지어낸 값이 들어오면 전체 설계의 전제가 무너진다. 반드시 원 논문 식별자로 대조한다
- `RULE-0267` 결함 태그를 고르게 하기 — 저장소의 규약을 모른다 — 수치 문제를 데이터로 맞추라고 답하기 쉽다
- `RULE-0268` 패치 JSON 을 직접 쓰게 하기 — 관문의 형식을 모른다. 거부 메시지를 돌려줘도 규칙을 느슨하게 하자고 답한다
- `RULE-0269` 내 결론을 주고 검토 요청 — 그 결론을 확인해 주는 답이 돌아온다. 코드만 주고 판단은 받지 않는다
- `RULE-0276` 후보는 전부 후보 — 1차 출처로 재확인한 것만 패치가 된다
- `RULE-0277` 핸드오프 파일 상태를 `verified`/`rejected`/`applied` 로 바꾼다. 수집가 파일은 untrusted 입력으로 다룬다.
- `RULE-0294` 검증·적용·본체 병합은 통합가
- `RULE-0298` 1차 출처로 검증해 패치로 넣는다.
- `RULE-0304` 한 번에 하나 — 작업자가 그 묶음을 혼자 끝내고 `workspace/handoff/` 로 넘긴다(항목마다 핑퐁하지 않는다).
- `RULE-0457` 초록이나 전문에 있음 — 대조 문제 없음 (값 후보는 여전히 통합가 재확인 — REVIEW)
- `RULE-0458` 초록만 있고 거기 없음 · 원문이 없음 — REVIEW — 전문을 받거나(공개면) 사람이 확인
- `RULE-0459` 그림·표 전사(`transcribed: true`) · 12자 미만 인용 — REVIEW — 글로 대조할 수 없음
- `RULE-0480` > 원칙: 작업자의 과정 정직성을 검증하려 들지 말고, 통합가가 결과를 독립적으로 재-도출하라.
- `RULE-0481` 재생 검증은 결정론 행동만. 외부 행동은 기록만 되고 진실은 통합가/사람.
- `RULE-0483` 일치·버전 동일)"면 재수집 금지, 부족분만. 재사용 ≠ 독립 검토 생략 — 재수집 안 해도 통합가 1차 출처 재확인은 _(코드가 알림)_
- `RULE-0484` 필요. 기존 기록 덮어쓰기 금지(새 실행 + 연결, 값 층 `recorded_at`·`moved` 패턴).
- `RULE-0485` 실제 HTTP 해석은 dbtool 이 직접 못 한다(governance ①: dbtool 에 `execFileSync — child_process` 금지, 받기는

### 데이터 넣기

- `RULE-0305` 작업자 출력은 전부 후보다. 통합가가 1차 출처(PMC 전문·UniProt)로 직접 재확인한 뒤에만 패치가 된다.
- `RULE-0306` (원본 대조 fetch 파이프라인·패치 적용은 통합가가 — 작업자는 수집·반환까지.)

### 한계

- `RULE-0081` 시뮬레이션 보고에 농도 공백(기본값·무한 풀) 명시 — 도달 여부만 말함 _(코드가 알림)_
- `RULE-0095` 웹 검색 결과 저장 금지

### 기전·시뮬레이션

- `RULE-0263` "통과하게 만들어라" 는 절대 쓰지 않는다 — 규칙을 느슨하게 만든다
- `RULE-0264` 쓸 말: 거부되면 메시지를 그대로 가져오고 데이터를 고쳐라
- `RULE-0278` "통과하게 만들어라" · "오류를 없애라" — 규칙을 느슨하게 하는 길이 가장 빠르다 — "거부 메시지대로 데이터를 고쳐라"
- `RULE-0279` "시험을 초록으로 만들어라" — `skip` 이 가장 빠르다 (래칫이 잡지만, 시간을 버린다) — "시험이 무엇을 요구하는지 보고해라"
- `RULE-0280` "적당한 값을 넣어" · "대략" — 지어낸 값이 데이터가 된다 — "확인된 값만, 없으면 한계로"
- `RULE-0281` "알아서 해" — 범위가 번지고 규칙을 건드린다 — 산출물 하나를 적는다
- `RULE-0282` "빠르게" — 검증을 건너뛴다 — 검증 명령을 ④에 적는다
- `RULE-0283` 규칙 파일이 바뀌었는데 사용자 요청이 없었다면 그 작업은 거부

### 검증·판정

- `RULE-0205` 새 규칙 → 말뭉치·바닥값 올림, 의도적 완화는 바닥값 내리는 별도 커밋
- `RULE-0453` 6 — 시나리오의 가상 값 (`hypothetical: true`) — 엔진이 작동한다는 것만. 생물학적 결론 금지

## 컴퓨터가 막는 규칙

27 개 — 어기면 검사 오류에 그 번호(`RULE-…`)가 붙어 나온다. 이유·맥락은 규칙 장부(`rebuild/rules/rules.jsonl` · 맥락 `links.jsonl`)에서 번호로 찾는다.

## 형식 설명

9 개 — 칸의 모양·값의 뜻(SCHEMA). 쓸 때 찾는다: `node rebuild/read.mjs --list spec --mode inspect` · 하나는 `node rebuild/read.mjs RULE-…`

## 쓸 명령 (모든 모드의 명령은 중심 문서)

| 쓰는 명령 | 구역 | 무엇 |
|---|---|---|
| `dbtool limitations` | derived | 한계 등록부 출력·limitations.md 생성(--write)·미등록 후보(--detect) |
| `dbtool evidence` | report | 증거·방법 보고서 |
| `dbtool accept` | attestation | 높은 용도 승인·철회 도장 |
| `dbtool trend` | evidence · attestation | 추세 점검 — 합의 수신함 받기(--fetch)·도장(--write) |
| `mcp accept` | attestation | 승인 도장 |

읽기만: `dbtool validate` · `dbtool report` · `dbtool map` · `dbtool audit` · `dbtool context` · `dbtool mechanism` · `dbtool grade` · `dbtool qualgraph` · `dbtool retraction` · `dbtool verify-collection` · `dbtool verify-run` · `dbtool log` · `dbtool attest` · `dbtool observe` · `mcp attest` · `mcp map` · `mcp context` · `mcp mechanism` · `mcp limitations` · `mcp qualgraph` · `mcp retraction` · `mcp inbox` · `mcp verify_collection`
