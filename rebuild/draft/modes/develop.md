# 모드: 디벨롭 (`develop` — 기계 고치기)

> 생성물 — `node rebuild/status.mjs --write` 가 `rebuild/rules/rules.jsonl · modes.json` 에서 만든다. 손으로 고치지 않는다 (규칙을 바꾸려면 원본을).

- **언제**: 엔진·컴파일러·판정 규칙·도구 코드를 고칠 때 (사용자 요청이 있을 때만)
- **목표**: 기계(엔진·컴파일러·판정 규칙·도구)를 고친다
- **쓸 수 있는 곳**: 코드 — 사용자 요청 필수. 삼권 경계(쓰기는 서기 put 만, 행정부 순수, 사법부 비실행)
- **가장 큰 위험**: 데이터를 통과시키려고 규칙 완화
- **끝내기 전**: node --test tests/*.test.mjs · 해당 엔진 시험 · 래칫(FLOOR) 내리지 않음 · CHANGES.md 맨 위 한 행
- **멈춤**: 완화가 유일한 길일 때 → 사람에게

공통 규칙은 중심 문서(`CLAUDE.md`)에 있다.

## 지켜야 할 규칙 — 사람·AI (41)

### 에이전트 점검표

- `RULE-0001` 규칙을 바꾸면 CLAUDE.md 와 agent-rules.md 를 같은 커밋에서

### 삼권 분립 (docs/design/tripartite-governance.md) — 바꾸면 node --test tests/*.test.mjs(특히 governance)

- `RULE-0009` 엔진은 분자·위치·부분 구조 이름을 모른다 — 사실은 데이터·어휘에
- `RULE-0030` 엔진 이득은 node tests/bench_engine.js 기준선과 함께 보고
- `RULE-0036` simulateRate 결과는 IR 전후 비트 동일
- `RULE-0045` 토큰 → 동작·숫자·정책 표와 규칙 설명은 로직 곁
- `RULE-0047` 결함은 storage-map.json 노드 안에서 고친다 — 래퍼·임시 플래그·사후 잘라내기 금지
- `RULE-0048` 비교용 경로는 판정 뒤 삭제

### 한계·진화

- `RULE-0131` 환산표는 하나 (엔진과 사법부가 같은 것)
- `RULE-0163` 결과가 바뀌면 관찰로 고르고, 없으면 Gap note
- `RULE-0164` 기존 supply·modulation 으로 되면 새 규칙 종류 금지

### 기록 (추적 가능한 진화)

- `RULE-0191` 코드·형식·어휘·문서 구조 변경은 CHANGES.md 맨 위 한 행 (Scope·Why·Impact·Verification), 같은 커밋 _(코드가 알림)_
- `RULE-0193` 구조 변경 → SCHEMA.md, 작업 규칙 → CLAUDE.md + agent-rules.md, 실패·공백 → limitations.md
- `RULE-0194` 문서는 해당 절만 고침
- `RULE-0196` 주석은 계약·이유만, 이력은 CHANGES.md

### 규칙·코드 바꾸기

- `RULE-0197` vocab·model·core·judicial·legislative 규칙은 사용자 요청 시만
- `RULE-0205` 새 규칙 → 말뭉치·바닥값 올림, 의도적 완화는 바닥값 내리는 별도 커밋
- `RULE-0208` 알고리즘·형식·상호작용 변경 → docs/textbook/ 해당 장 같은 커밋

### 삼권 분립 (반드시 — 어기면 무결성 규약 위반, docs/design/tripartite-governance.md)

- `RULE-0214` 수치 문제를 데이터로 맞추지 않는다
- `RULE-0215` 같은 문구를 코드에 복사하지 않는다 (모듈은 M.labelsOf 보기만)

### 한계와 개념 진화 (반드시)

- `RULE-0228` 판정은 하나 — 용도별 판정 함수는 reliability.accept 하나, 관문·observe·fate·증거 보고서가 모두 부름 (74·75·76)
- `RULE-0239` 화학·생물 사실(부분 구조 원자 수 elements, 기본 위치 defaultVolumeLocation)은 데이터나 어휘에

### 9. 사람(또는 더 큰 모델)에게 넘길 신호

- `RULE-0261` 형식(SCHEMA)을 바꿔야 할 때 — 이관 스크립트·계약·시험이 함께 움직인다

### 13. 형식 버전과 변환

- `RULE-0425` `data/db.json` 의 `version` 이 `core.js` 의 `VERSION` 과 다르면 검사가 오류를 낸다.

### 3. 핵심 규칙 — 번역기는 조회하지 추론하지 않는다

- `RULE-0463` R2: 한 번 사람이(근거 달아) 쓰고 그대로 저장, 번역기는 원문을 통째로 끼워 넣기만 한다 (생성 금지).

### 6. 저장·규모 — 권위는 정준 텍스트, SQL 은 파생

- `RULE-0464` 수만 단어 규모에서도 권위(source of truth)는 정준 직렬화 텍스트로 유지한다. 신뢰 전체가 거기 걸려 있다:
- `RULE-0465` 한 줄: 정준 텍스트 = 권위(봉인·감사) · SQLite 색인(16) = 파생 질의 · 뷰어(19) = 렌더. 셋을 섞지 않는다.

### 7. 번역기 설계

- `RULE-0466` 읽기·표현만 (행정/사법 권한 밖). 쓰기·판정 없음.

### 8. 방어 테스트 (실패 모드를 막는 것)

- `RULE-0467` 미등록 토큰 거부: 사전에 없는 키 → 관문 거부 픽스처 (`tests/fixtures/rejections/` + `EXPECT.json`).

### 9. 범위·비용 (정직하게)

- `RULE-0468` 하지 말 것: 한계·db 서술문을 영어로 일괄 이관 금지(반경 크고 신뢰 이득 작음) · 병기를 레코드마다
- `RULE-0469` 병기(ko·en 을 나란히 적기)를 레코드마다 손으로 뿌리지 않는다 — 손으로 뿌린 병기는 사전과 어긋난다(drift). 병기는 렌더러가 사전에서 만든다.

### 11. 단계

- `RULE-0470` 이관은 점진 — 새 레코드부터 적용, 기존은 닿을 때. 일괄 이관 금지.

### 1. 쓰기 권한 분리 (Legislative Clerk)

- `RULE-0472` 사용자가 지정한 보고서(`fate --report`) — 데이터·코드·증명 위치는 거부
- `RULE-0473` 패치 초안·리팩터링 제안 — 저장소 밖(임시 폴더)에만

### 1.1 구역 (Zone) — 경로가 경계로 작동하는 단 하나의 자리

- `RULE-0474` 구역 검사는 조건 검사와 직교한다. 봉인·도장 재확인이 "쓸 자격" 이라면 구역은 "쓸 자리" 다. 둘 다 통과해야 쓴다.

### 2. 검증 논리 격리

- `RULE-0475` `judicial/process_report.js` 는 판결된 보기만 읽는다.
- `RULE-0476` `judicial/compare.js` 는 조정자가 돌린 두 변형의 원자료로 판정만 한다.

### 6. 문서화된 예외

- `RULE-0477` `engine/hmse.js`·`engine/devs_scheduler.js` 의 실행 전 조건 검사(잘못된 입력에 대한 예외)는 판정이 아니라 함수의 정의역 검사다. 이 검사들은 감사 코드를 내지 않는다.
- `RULE-0478` `core.mapText` 는 외부 ID 의 status 를 표시한다(읽기). 선언하지는 않는다.
- `RULE-0479` `viewer.html` 은 브라우저 안에서만 병합(입법 함수)하고 관문(사법 함수)을 보여 준다. 저장은 사용자가 내려받아 한다. 저장소 파일을 쓰지 않는다.

### 6. 제안 — "생화학적으로 맞다" 의 기준 (세 층, 위로 갈수록 강함)

- `RULE-0494` 에이전트의 지식은 기준이 아니다 — 기준은 출처가 있는 관찰로만. 에이전트 지식은 §5 처럼 "후보" 를 만드는 데까지.

### 6. 입력 귀속 (TIER A, ①을 쓰는 첫 기능)

- `RULE-0495` 범위와 판정 규칙은 사전 등록 때 함께 고정한다(사후에 좁히기 금지).

## 컴퓨터가 막는 규칙

59 개 — 어기면 검사 오류에 그 번호(`RULE-…`)가 붙어 나온다. 이유·맥락은 규칙 장부(`rebuild/rules/rules.jsonl` · 맥락 `links.jsonl`)에서 번호로 찾는다.

## 쓸 명령 (모든 모드의 명령은 중심 문서)

| 명령 | 쓰는 구역 | 무엇 |
|---|---|---|
| `dbtool validate` | 읽기만 | 전체 검사 (오류면 종료 코드 1) |
| `dbtool vocab` | 읽기만 | 통제 어휘 보기 |
| `dbtool textbook` | derived | 교과서 부록 생성(--write)·최신·파일 분류 검사 |
| `dbtool dictionary` | registry | 사전(en) 보기·추가 |
| `dbtool compare` | 읽기만 | 비교 검토 — 복잡도·수치 L2·결과 |
| `mcp dictionary_add` | registry | 사전 항목 추가 |
| `mcp write_derived` | derived | 파생 문서 다시 쓰기 |
