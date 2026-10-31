---
name: develop
description: "디벨롭 모드 — 엔진·컴파일러·판정 규칙·도구 코드를 고칠 때 (사용자 요청이 있을 때만). 세션을 이 모드로 시작할 때 연다 (한 세션 = 한 모드)."
---

# 모드: 디벨롭 (`develop` — 기계 고치기)

> 생성물 — `node rebuild/status.mjs --write` 가 `rebuild/rules/rules.jsonl · modes.json` 에서 만든다. 손으로 고치지 않는다 (규칙을 바꾸려면 원본을).

- **언제**: 엔진·컴파일러·판정 규칙·도구 코드를 고칠 때 (사용자 요청이 있을 때만)
- **목표**: 기계(엔진·컴파일러·판정 규칙·도구)를 고친다
- **쓸 수 있는 곳**: 코드 — 사용자 요청 필수. 삼권 경계(쓰기는 서기 put 만, 행정부 순수, 사법부 비실행)
- **가장 큰 위험**: 데이터를 통과시키려고 규칙 완화
- **끝내기 전**: node rebuild/gate.mjs finish develop — 커밋은 바뀐 것에 닿는 시험만, push 는 --full (전체) · 해당 엔진 시험 · 래칫(FLOOR) 내리지 않음 · CHANGES.md 맨 위 한 행
- **멈춤**: 완화가 유일한 길일 때 → 사람에게

공통 규칙은 중심 문서(`CLAUDE.md`)에 있다.

## 지켜야 할 규칙 — 사람·AI (36)

### 권한·쓰기 (삼권 분립)

- `RULE-0009` 엔진은 분자·위치·부분 구조 이름을 모른다 — 사실은 데이터·어휘에
- `RULE-0030` 엔진 이득은 node tests/bench_engine.js 기준선과 함께 보고
- `RULE-0036` simulateRate 결과는 IR 전후 비트 동일
- `RULE-0045` 토큰 → 동작·숫자·정책 표와 규칙 설명은 로직 곁
- `RULE-0047` 결함은 storage-map.json 노드 안에서 고친다 — 래퍼·임시 플래그·사후 잘라내기 금지
- `RULE-0048` 비교용 경로는 판정 뒤 삭제
- `RULE-0214` 수치 문제를 데이터로 맞추지 않는다
- `RULE-0215` 같은 문구를 코드에 복사하지 않는다 (모듈은 M.labelsOf 보기만)
- `RULE-0472` 사용자가 지정한 보고서(`fate --report`) — 데이터·코드·증명 위치는 거부
- `RULE-0473` 패치 초안·리팩터링 제안 — 저장소 밖(임시 폴더)에만
- `RULE-0474` 구역 검사는 조건 검사와 직교한다. 봉인·도장 재확인이 "쓸 자격" 이라면 구역은 "쓸 자리" 다. 둘 다 통과해야 쓴다.
- `RULE-0475` `judicial/process_report.js` 는 판결된 보기만 읽는다.
- `RULE-0476` `judicial/compare.js` 는 조정자가 돌린 두 변형의 원자료로 판정만 한다.
- `RULE-0477` `engine/hmse.js`·`engine/devs_scheduler.js` 의 실행 전 조건 검사(잘못된 입력에 대한 예외)는 판정이 아니라 함수의 정의역 검사다. 이 검사들은 감사 코드를 내지 않는다.
- `RULE-0478` `core.mapText` 는 외부 ID 의 status 를 표시한다(읽기). 선언하지는 않는다.
- `RULE-0479` `viewer.html` 은 브라우저 안에서만 병합(입법 함수)하고 관문(사법 함수)을 보여 준다. 저장은 사용자가 내려받아 한다. 저장소 파일을 쓰지 않는다.

### 관찰·측정값

- `RULE-0495` 범위와 판정 규칙은 사전 등록 때 함께 고정한다(사후에 좁히기 금지).

### 한계

- `RULE-0131` 환산표는 하나 (엔진과 사법부가 같은 것)
- `RULE-0163` 결과가 바뀌면 관찰로 고르고, 없으면 Gap note
- `RULE-0164` 기존 supply·modulation 으로 되면 새 규칙 종류 금지
- `RULE-0239` 화학·생물 사실(부분 구조 원자 수 elements, 기본 위치 defaultVolumeLocation)은 데이터나 어휘에

### 기전·시뮬레이션

- `RULE-0261` 형식(SCHEMA)을 바꿔야 할 때 — 이관 스크립트·계약·시험이 함께 움직인다
- `RULE-0463` R2: 한 번 사람이(근거 달아) 쓰고 그대로 저장, 번역기는 원문을 통째로 끼워 넣기만 한다 (생성 금지).
- `RULE-0464` 수만 단어 규모에서도 권위(source of truth)는 정준 직렬화 텍스트로 유지한다. 신뢰 전체가 거기 걸려 있다:
- `RULE-0465` 한 줄: 정준 텍스트 = 권위(봉인·감사) · SQLite 색인(16) = 파생 질의 · 뷰어(19) = 렌더. 셋을 섞지 않는다.
- `RULE-0466` 읽기·표현만 (행정/사법 권한 밖). 쓰기·판정 없음.
- `RULE-0467` 미등록 토큰 거부: 사전에 없는 키 → 관문 거부 픽스처 (`tests/fixtures/rejections/` + `EXPECT.json`).
- `RULE-0468` 하지 말 것: 한계·db 서술문을 영어로 일괄 이관 금지(반경 크고 신뢰 이득 작음) · 병기를 레코드마다
- `RULE-0469` 병기(ko·en 을 나란히 적기)를 레코드마다 손으로 뿌리지 않는다 — 손으로 뿌린 병기는 사전과 어긋난다(drift). 병기는 렌더러가 사전에서 만든다.
- `RULE-0470` 이관은 점진 — 새 레코드부터 적용, 기존은 닿을 때. 일괄 이관 금지.
- `RULE-0494` 에이전트의 지식은 기준이 아니다 — 기준은 출처가 있는 관찰로만. 에이전트 지식은 §5 처럼 "후보" 를 만드는 데까지.

### 검증·판정

- `RULE-0191` 코드·형식·어휘·문서 구조 변경은 CHANGES.md 맨 위 한 행 (Scope·Why·Impact·Verification), 같은 커밋 _(코드가 알림)_
- `RULE-0194` 문서는 해당 절만 고침
- `RULE-0197` vocab·model·core·judicial·legislative 규칙은 사용자 요청 시만
- `RULE-0205` 새 규칙 → 말뭉치·바닥값 올림, 의도적 완화는 바닥값 내리는 별도 커밋
- `RULE-0208` 알고리즘·형식·상호작용 변경 → docs/textbook/ 해당 장 같은 커밋

## 컴퓨터가 막는 규칙

63 개 — 어기면 검사 오류에 그 번호(`RULE-…`)가 붙어 나온다. 이유·맥락은 규칙 장부(`rebuild/rules/rules.jsonl` · 맥락 `links.jsonl`)에서 번호로 찾는다.

## 형식 설명

1 개 — 칸의 모양·값의 뜻(SCHEMA). 쓸 때 찾는다: `node rebuild/read.mjs --list spec --mode develop` · 하나는 `node rebuild/read.mjs RULE-…`

## 쓸 명령 (모든 모드의 명령은 중심 문서)

| 쓰는 명령 | 구역 | 무엇 |
|---|---|---|
| `dbtool textbook` | derived | 교과서 부록 생성(--write)·최신·파일 분류 검사 |
| `dbtool dictionary` | registry | 사전(en) 보기·추가 |
| `mcp dictionary_add` | registry | 사전 항목 추가 |
| `mcp write_derived` | derived | 파생 문서 다시 쓰기 |

읽기만: `dbtool validate` · `dbtool vocab` · `dbtool compare`
