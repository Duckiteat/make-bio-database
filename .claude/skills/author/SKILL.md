---
name: author
description: "정보 작성 모드 — 정의·기전·관찰·외부 ID·한계를 데이터에 더하거나 고칠 때, 또는 문헌에서 값 후보를 모을 때. 세션을 이 모드로 시작할 때 연다 (한 세션 = 한 모드)."
---

# 모드: 정보 작성 (`author` — 수집가 포함)

> 생성물 — `node rebuild/status.mjs --write` 가 `rebuild/rules/rules.jsonl · modes.json` 에서 만든다. 손으로 고치지 않는다 (규칙을 바꾸려면 원본을).

- **언제**: 정의·기전·관찰·외부 ID·한계를 데이터에 더하거나 고칠 때, 또는 문헌에서 값 후보를 모을 때
- **목표**: 실측에 매인 사실을 늘린다
- **쓸 수 있는 곳**: 패치 → 관문(validate · augment apply / merge)만. 수집가는 핸드오프(workspace/handoff/)만. 코드 편집 금지
- **가장 큰 위험**: 지어내기 · 다른 종 값을 사람 값으로
- **끝내기 전**: node dbtool.mjs validate · node dbtool.mjs limitations --detect (후보 0) · 닿은 경로 audit-run · node --test tests/rejections.test.mjs
- **멈춤**: 어휘에 없는 값이 필요할 때 · 종이 다를 때 → 사람에게

공통 규칙은 중심 문서(`CLAUDE.md`)에 있다.

## 지켜야 할 규칙 — 사람·AI (62)

### 권한·쓰기 (삼권 분립)

- `RULE-0021` 유료 원천은 받지 않는다
- `RULE-0022` 계정 원천은 BRENDA 하나, fetch 의 brenda_kinetics 로만
- `RULE-0307` (서브에이전트면 파일에 쓰지 말고 반환, 상주 수집가 세션이면 `workspace/handoff/<과제>.jsonl` 에 붙이기만 — MCP clerk `put_handoff`, 수집가가 쓰는 자리는 이것 하나). 금지: `augment apply`·`merge`·
- `RULE-0308` "후보"다 — 베끼지 않는다). 통과분만 패치 → `validate` → `augment apply` → 커밋. 상태를 바꾼다.
- `RULE-0490` 패치 초안 — 저장소를 읽는 에이전트만 — 관문 — `validate` · `patchPolicy` · 정제 점검. 저장소 밖 AI 에게는 맡기지 않는다(PROMPTS §3)
- `RULE-0491` 적대적 검토 — 다른 AI — 대화 → 거부 시험 — 결론은 주지 않고 코드만 준다(PROMPTS §3)
- `RULE-0492` 사용자가 만드는 전문 에이전트 = `fetch`·`query` 도구를 부르는 클라이언트(역할: 수집가). 에이전트 안에 HTTP 코드를 두지 않는다.
- `RULE-0493` 금지 — db·원장·패치 쓰기 · 커밋 · 값 추정·환산(원문 숫자 그대로) · 그림에서 눈으로 읽은 값을 원문 숫자로 적기(적으면 "그림 전사"로 표시)

### 수집·위임 (다른 AI·수집가)

- `RULE-0265` 저장소에 접근하지 못하는 AI(웹 챗 등)는 두 가지에만 쓴다. 나머지는 손해가 더 크다.
- `RULE-0266` 상수·외부 ID 를 "대충 아는 값" 으로 받기 — 지어낸 값이 들어오면 전체 설계의 전제가 무너진다. 반드시 원 논문 식별자로 대조한다
- `RULE-0267` 결함 태그를 고르게 하기 — 저장소의 규약을 모른다 — 수치 문제를 데이터로 맞추라고 답하기 쉽다
- `RULE-0268` 패치 JSON 을 직접 쓰게 하기 — 관문의 형식을 모른다. 거부 메시지를 돌려줘도 규칙을 느슨하게 하자고 답한다
- `RULE-0269` 내 결론을 주고 검토 요청 — 그 결론을 확인해 주는 답이 돌아온다. 코드만 주고 판단은 받지 않는다
- `RULE-0270` 다른 AI 에게서 온 값은 전부 후보 — 원 논문에서 직접 확인한 것만
- `RULE-0271` 확인하지 못하면 한계로 등록한다 — 그게 이 저장소가 다른 데이터베이스와 다른 점이다.
- `RULE-0272` 단위는 묶음(batch) — 항목마다 핑퐁하지 않는다.
- `RULE-0273` A (서브에이전트, 지금 기본): 보고만 — 구조적으로 apply·commit 불가. 설정 0. 묶음마다 통합가가 띄운다.
- `RULE-0288` 인용·값은 지정 1차 출처 API 응답에서만, 웹 검색 스니펫·2차 리뷰 금지 (TASK-002 교훈)
- `RULE-0301` 인용·값은 지정 1차 출처 API가 반환한 내용에서만 뽑는다. 웹 검색 스니펫·2차 리뷰·블로그를 값·인용
- `RULE-0302` 근거로 쓰지 마라. 못 찾으면 `not_found`, 접근 안 되면 `unreadable` — 지어내거나 스니펫으로 메우지 않는다.
- `RULE-0303` 나머지는 엔드포인트를 통합가가 확인해 이 표를 갱신하기 전까지 "통합가 필요"로 표시한다.

### 데이터 넣기

- `RULE-0057` --allow-warnings 는 사용자 허락 시만
- `RULE-0062` 외부 ID 는 확실한 것만, 모르면 unmapped (+Identity_Gap), 지어내지 않음
- `RULE-0065` 모호하면 unmapped + Identity_Gap 유지
- `RULE-0070` 인산화·활성형은 묶음 부위:특징 + 상태 의미 규칙 (새 개념 금지)
- `RULE-0075` 기존 정의항 패치는 적은 최상위 필드 통째 교체 — 유지할 항목도 적음
- `RULE-0076` 구조 지문(InChIKey·서열 해시)은 도구 계산값만 computed 로
- `RULE-0313` 단계는 규칙의 적용: 행위자 활성, 변화량 = 규칙 효과, 해리 구성 요소 개수, 수송 외 위치 변화 금지, 위치 조건, 공간 접촉.
- `RULE-0314` 규칙은 `tests/` 의 시험(개수는 `tests/fixtures/FLOOR.json` 이 센다)이 지키고, GitHub Actions 가 푸시마다 테스트와 전체 검사를 돌린다.

### 관찰·측정값

- `RULE-0487` 잡음 모형은 최소 집합: 정규 · 로그정규 · 계수(포아송). 쓰이지 않는 분기는 넣지 않는다.
- `RULE-0488` 층 사이 참조는 한 방향: 값 → 정의(대상) · 값 → 증거(`from`) · 증거 → 정의(측정량 대상). 정의는 값·증거를 가리키지 않는다.

### 한계

- `RULE-0077` 실패·우회·추정·단순화는 한계 데이터로 — 패치 limitations [Target — Type — Requirement]+needs
- `RULE-0080` 상위 개념 없는 패턴이 두 경로 이상이면 kind process + motif _(코드가 알림)_
- `RULE-0082` 해상도 structure(구조)는 속도 상수로 못 가르는 반응 중심만, 경쟁(competition)은 Kd·kcat·Km 먼저 _(코드가 알림)_
- `RULE-0091` 상수를 넣은 뒤 궤적 전후 비교 보고
- `RULE-0108` 반복 수가 원문에 없으면 null — 1 로 적지 않음 _(코드가 알림)_
- `RULE-0117` 교과서·추론은 정성 관찰이 아님 (한계·메모로)
- `RULE-0118` 같은 실험은 experiment 로 묶음
- `RULE-0122` 번호를 합치거나 나눌 땐 패치 moved (지우고 새로 만들지 않음) _(코드가 알림)_
- `RULE-0132` Audit Error 는 한계를 채우거나 등록
- `RULE-0134` 고갈은 결과로 보고 (결함 아님) _(코드가 알림)_
- `RULE-0135` 재생 경로 없으면 supply 정의 또는 Kinetic_Gap _(코드가 알림)_
- `RULE-0136` 제한 요인 등록: 고갈 → Resource_Gap, 평형·속도 → Kinetic_Gap _(코드가 알림)_
- `RULE-0137` 안정성 감사가 나오면 Δt 줄여 수렴할 때만 보고 _(코드가 알림)_
- `RULE-0152` 운명은 cell_state + modulation 사슬 (표지 직접 금지) _(코드가 알림)_
- `RULE-0157` 근거 없는 비생리 계통 경로 금지
- `RULE-0158` 분열 = 0차 supply 누적 진행량 (새 규칙 종류·가짜 분자 금지)
- `RULE-0159` 억제 힐 K = 임계값 −10 %
- `RULE-0160` 활성 힐 기준선 1 → 1/fmax 근사 + 한계
- `RULE-0161` 도달 시각은 Δ 바꿔 확인
- `RULE-0166` 의도한 단순화는 Structural_Gap
- `RULE-0167` 기전은 세포 상태 mechanisms 에 걸어 운명 엔진으로 (따로 돌리는 길 금지)
- `RULE-0170` simulateRate 와 서로 기준 금지 (L000081)
- `RULE-0183` 운명 결과는 fate --report 과정 보고서로만, 끝 상태만 말하지 않음
- `RULE-0187` source: true 는 원료가 모델 밖일 때만
- `RULE-0188` 반감기·공급 속도·서열 길이는 확인 값만
- `RULE-0222` 종이 다른 값(돼지·소 심장 효소)은 찾지 못한 것으로 한계 등록
- `RULE-0232` 지식(개념·기전)은 직접 패치, 측정은 포트

### 검증·판정

- `RULE-0197` vocab·model·core·judicial·legislative 규칙은 사용자 요청 시만
- `RULE-0205` 새 규칙 → 말뭉치·바닥값 올림, 의도적 완화는 바닥값 내리는 별도 커밋

### 규칙·코드·시험

- `RULE-0248` 남는 위험: 같은 환경의 셸은 환경 변수를 읽을 수 있다 — BRENDA 전용 비밀번호
- `RULE-0249` 받기는 도구의 기록이 증거 — 유료·PMC 무료 열람본은 저작권 때문에 받지 않음

## 컴퓨터가 막는 규칙

187 개 — 어기면 검사 오류에 그 번호(`RULE-…`)가 붙어 나온다. 주제별 번호는 아래 — 한 줄 제목은 `node rebuild/read.mjs RULE-… --depth 0`, 이유·맥락은 깊이 1·2.

- 권한·쓰기 (삼권 분립): RULE-0018 · RULE-0019 · RULE-0023 · RULE-0026 · RULE-0027 · RULE-0435 · RULE-0436
- 수집·위임 (다른 AI·수집가): RULE-0274 · RULE-0275 · RULE-0285 · RULE-0286 · RULE-0287 · RULE-0289 · RULE-0290 · RULE-0291 · RULE-0293 · RULE-0295 · RULE-0296 · RULE-0297 · RULE-0299 · RULE-0300 · RULE-0460
- 데이터 넣기: RULE-0058 · RULE-0059 · RULE-0060 · RULE-0061 · RULE-0063 · RULE-0064 · RULE-0066 · RULE-0068 · RULE-0069 · RULE-0071 · RULE-0072 · RULE-0073 · RULE-0074 · RULE-0309 · RULE-0310 · RULE-0311 · RULE-0312 · RULE-0319 · RULE-0323 · RULE-0324 · RULE-0325 · RULE-0327 · RULE-0330 · RULE-0331 · RULE-0332 · RULE-0333 · RULE-0334 · RULE-0337 · RULE-0339 · RULE-0340 · RULE-0341 · RULE-0342 · RULE-0343 · RULE-0344 · RULE-0345 · RULE-0346 · RULE-0348 · RULE-0349 · RULE-0350 · RULE-0351 · RULE-0352 · RULE-0353 · RULE-0354 · RULE-0355 · RULE-0356 · RULE-0357 · RULE-0358 · RULE-0359 · RULE-0360 · RULE-0361 · RULE-0362 · RULE-0363 · RULE-0364 · RULE-0365 · RULE-0366 · RULE-0369 · RULE-0370 · RULE-0371 · RULE-0372 · RULE-0377 · RULE-0378 · RULE-0379 · RULE-0382 · RULE-0383 · RULE-0384 · RULE-0385 · RULE-0387 · RULE-0389 · RULE-0396 · RULE-0397 · RULE-0398 · RULE-0399 · RULE-0400 · RULE-0402 · RULE-0404 · RULE-0405 · RULE-0406 · RULE-0414 · RULE-0417 · RULE-0418 · RULE-0421 · RULE-0422 · RULE-0440 · RULE-0441 · RULE-0442 · RULE-0444 · RULE-0446 · RULE-0447 · RULE-0448 · RULE-0451 · RULE-0452
- 관찰·측정값: RULE-0486 · RULE-0489
- 한계: RULE-0078 · RULE-0079 · RULE-0083 · RULE-0084 · RULE-0085 · RULE-0086 · RULE-0087 · RULE-0088 · RULE-0089 · RULE-0090 · RULE-0104 · RULE-0107 · RULE-0110 · RULE-0111 · RULE-0112 · RULE-0113 · RULE-0114 · RULE-0115 · RULE-0116 · RULE-0119 · RULE-0121 · RULE-0123 · RULE-0124 · RULE-0125 · RULE-0126 · RULE-0127 · RULE-0128 · RULE-0129 · RULE-0130 · RULE-0131 · RULE-0133 · RULE-0138 · RULE-0139 · RULE-0140 · RULE-0141 · RULE-0153 · RULE-0154 · RULE-0155 · RULE-0156 · RULE-0162 · RULE-0165 · RULE-0168 · RULE-0169 · RULE-0171 · RULE-0172 · RULE-0174 · RULE-0182 · RULE-0186 · RULE-0219 · RULE-0220 · RULE-0233
- 검증·판정: RULE-0189 · RULE-0190 · RULE-0202 · RULE-0203
- 규칙·코드·시험: RULE-0247 · RULE-0250 · RULE-0251
- 코드에서 찾은 검사: RULE-0498 · RULE-0499 · RULE-0500 · RULE-0501 · RULE-0502 · RULE-0503 · RULE-0504 · RULE-0505 · RULE-0510 · RULE-0511
- 기타: RULE-0216 · RULE-0217 · RULE-0218 · RULE-0246

## 형식 설명

46 개 — 칸의 모양·값의 뜻(SCHEMA). 쓸 때 찾는다: `node rebuild/read.mjs --list spec --mode author` · 하나는 `node rebuild/read.mjs RULE-…`

## 쓸 명령 (모든 모드의 명령은 중심 문서)

| 쓰는 명령 | 구역 | 무엇 |
|---|---|---|
| `dbtool merge` | registry | 패치 병합 — 관문 통과 + 봉인 뒤 서기가 db.json·patches |
| `dbtool limitations` | derived | 한계 등록부 출력·limitations.md 생성(--write)·미등록 후보(--detect) |
| `dbtool textbook` | derived | 교과서 부록 생성(--write)·최신·파일 분류 검사 |
| `dbtool augment` | evidence · registry | 자동 보강 고리 plan → fetch → build → apply (원본 대조) |
| `dbtool assume` | registry | 가정 원장 보기·추가(add — 감사·봉인 뒤 서기) |
| `dbtool trend` | evidence · attestation | 추세 점검 — 합의 수신함 받기(--fetch)·도장(--write) |
| `mcp put_handoff` | handoff | 핸드오프에 후보 추가 (수집가) |
| `mcp merge` | registry | 패치 병합 |
| `mcp augment_apply` | registry | 원본 대조 적용 |
| `mcp assume_add` | registry | 가정 원장 추가 |
| `mcp write_derived` | derived | 파생 문서 다시 쓰기 |
| `mcp fetch_abstract` | evidence | 초록 받기 |
| `mcp fetch_fulltext` | evidence | 공개 전문 받기 |
| `mcp resolve_doi` | evidence | DOI → Europe PMC |
| `mcp brenda_kinetics` | evidence | BRENDA Km·kcat 받기 (계정 = 환경 변수) |

읽기만: `dbtool validate` · `dbtool report` · `dbtool map` · `dbtool audit` · `dbtool vocab` · `dbtool context` · `dbtool mechanism` · `dbtool pattern` · `dbtool resolution` · `dbtool audit-run` · `dbtool grade` · `dbtool qualgraph` · `dbtool retraction` · `dbtool prompt` · `mcp validate_patch` · `mcp resolve_access` · `mcp map` · `mcp context` · `mcp mechanism` · `mcp pattern` · `mcp limitations` · `mcp assume_uses` · `mcp qualgraph` · `mcp retraction` · `mcp inbox`
