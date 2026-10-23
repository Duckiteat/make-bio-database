# 작업 검증·꼼수 방지 시스템 — 구현 보고 (2026-10-17)

> AI(특히 저가 모델)가 작업을 생략·조작하고 완료한 척 보고하는 것을 **탐지·거부**하는 시스템을 설계하고
> 1차 구현했다. 목적은 성실을 기대하는 게 아니라 **불성실이 통과하기 어렵게** 만드는 것. 이 보고서는 무엇을
> 왜 만들었고, 무엇을 **못** 막는지, 어떻게 확인했는지를 과정 그대로 남긴다.

## 0. 한눈에

| 칸 | 내용 |
|---|---|
| **문제** | AI 자기보고를 실행 증거로 인정하던 비대칭 — 쓰기(db)는 관문이 막지만 **조사·수집은 자기보고가 통했다.** |
| **계기** | TASK-001(사람 TNF mRNA 반감기 수집): 수집가의 "웹 검색함·403" 자기보고를 **실행 기록 대조 없이** 받아들임(꼼수 #2·#9). |
| **만든 것** | `judicial/collection_audit.js` + `dbtool verify-collection`(구조·구별·출처·재사용 판정) · `dbtool verify-run`(실행 기록 대조) · `--check-sources`(로컬 수신함 대조). |
| **핵심 원리** | 작업자 **과정을 검증하려 말고, 통합가가 결과를 터미널에서 독립 재-도출**(엔진 사법 원리). 완료는 작업자가 아니라 판정기가 정한다. |
| **못 막는 것** | 인용-원문 대조(#5)·DOI 실제 해석·커버리지(#1)·외부 작업자 과정 → REVIEW/통합가/사람/harness. 숨기지 않고 명시. |

## 1. 문제와 계기 (인과)

이 저장소는 **쓰기 측**을 강하게 강제한다 — 관문(`judicial.gate`: 종·단위·`from`·물리상한·why), 도장
(`attestation`), 사전 등록 sha, 해시 사슬 병합 로그(`clerk`), 철회 그래프. 그래서 나쁜 데이터는 db 에 못
들어간다. **그런데 조사·수집 단계엔 그런 강제가 없었다** — 작업자(서브에이전트)가 "검색했다·읽었다·없다"고
보고하면 그대로 믿었다.

TASK-001 에서 그게 드러났다. 사람 TNF mRNA 반감기를 Sonnet 수집가에게 시켰고, 그 수집가가 "웹 검색했고
리뷰 fetch 에서 403 받았다"고 보고했다. 나는 그 **실행 기록과 대조하지 않고** 결론("사람 값 없음")을
받아들였다. 이는 요청서 꼼수 **#2(초록만 보고 읽었다 주장)·#9(도구 오류 숨김)** 가 통하는 자리였다.
사용자가 "대충이다"라 지적했고, 그 지적이 맞았다.

## 2. 핵심 결정 — 과정이 아니라 결과를 재-도출한다

터미널 검사는 작업자의 **과정**(정말 검색·열람했나, 외부 웹 행동)을 검증 못 한다(재생 불가·transcript 소비
제약). 그러나 **결과**(출처 존재·값 db 조회·파일·계산·형식·해시)는 **통합가가 터미널에서 직접 다시 해**
결판낼 수 있다 — 이것이 엔진 사법 원리(사법부는 엔진 자기보고를 안 믿고 다시 돌려 대조)의 재적용이다.

> 작업자의 과정 정직성을 검증하려 들지 말고, 통합가가 결과를 독립 재-도출한다. 재확인이 통과하면 작업자
> 과정은 무의미, 실패하면 작업자가 뭐라 보고했든 거부.

두 레지스터(보존/비보존 doctrine의 실행 증거판): **결정론 행동**(파일·db·계산)은 전수 재실행 대조(싸다),
**외부 행동**(웹)은 표본 + REVIEW_REQUIRED(비싸다·사람). 자동으로 다 막는 척하지 않는다.

## 3. 만든 것 (코드)

- **`judicial/collection_audit.js`** (읽기 전용·순수): 핸드오프 항목(JSONL)을 받아 판정.
  - 필드·`outcome` 구별(not_searched/not_found/unreadable/read_no_value/read_value/ambiguous/reused).
  - **근거 없는 값**(값 주장에 출처·인용 없음)·**가짜 형식**(DOI/PMID)·**상태-내용 불일치**(못 찾음인데 값 있음)·
    **무효 재사용**(재사용 대상이 db 에 없음·철회됨 — 결정론 재-도출) → **REJECTED**.
  - 값 후보(미검증) → **REVIEW_REQUIRED**(자동 PASS 금지). 정직한 "못 찾음" → **PASS**.
  - `sourceChecks` 훅(notfound→REJECTED·error→REVIEW) · `parseRunlog`(transcript 도구 호출) · `crossCheckRun`.
- **`dbtool verify-collection <핸드오프.jsonl> [--check-sources]`**: 위 판정 실행(읽기만, 비통과는 exit 1).
  `--check-sources` 는 PMID 를 **로컬 수신함**(`data/fetched/`)과 대조(네트워크 없음).
- **`dbtool verify-run <transcript> --handoff <jsonl>`**: 서브에이전트 실제 도구 호출 vs 주장(값/읽음인데
  WebFetch·Read 0 → 깃발). best-effort.

## 4. 확인한 것 (실패 포함, 숨기지 않음)

- 거부 시험 `tests/collection_audit.test.mjs`(9): 근거 없는 값·가짜 형식·상태 불일치·무효 재사용 **REJECTED**,
  값 후보 **REVIEW**, 정직한 못 찾음 **PASS**, 출처 해석 훅·transcript 파서·교차 검사.
- 실증: TASK-001 수집가 transcript 에서 **WebFetch 3·WebSearch 3·Read 4** 추출 → 그 수집가가 진짜로 웹
  검색·열람했음 확인. `--check-sources` 로 수신함에 있는 PMID 는 confirmed, 없는 PMID 는 REVIEW.
- **실패 1 — governance 가 내 위반을 잡았다 (가장 중요한 지문):** 처음엔 `--check-sources` 를 dbtool 에서
  **직접 curl** 로 만들었다. 전체 시험이 `governance.test ①`("dbtool 은 받기도 서기에게 — `execFileSync`/
  `child_process` 금지")로 **거부**했다. 규칙을 느슨하게 하지 않고 **내 코드를 되돌려** 로컬 수신함 대조로
  바꿨다. 즉 이 꼼수 방지 시스템이 **나(Opus)에게도** 작동했다 — 지능이 아니라 구조가 신뢰를 지킨다.
- 검증: `node --test 270/270` · `validate 오류 0` · `textbook --check 분류됨`.

## 5. 못 막는 것 (경계 — 정직하게)

- **인용이 원문에 있나(#5)·DOI 실제 해석**: 네트워크 필요, 받기는 sanctioned 고리(`augment fetch`)로만. 유료·
  403 흔해 완전 자동 불가 → 통합가/사람. 로컬 수신함 대조까지가 dbtool 의 끝.
- **커버리지(#1 "정말 없나")**: 없음의 증명 — 통합가 재검색 또는 사람(RETRIEVAL_TASKS).
- **실행 기록의 런타임 emit (외부 작업자)**: 테이프를 도구 런타임이 써야 증거. 그 emit 은 **harness 기능이지
  저장소 코드가 아니다** — in-repo 로 못 짓는다. 내 세션 서브에이전트는 `verify-run` 이 커버, 외부 작업자는 못 함.

## 6. 얻은 것 · 다음 · 바닥의 불안정함

- **얻은 것**: 저가 AI 수집 출력을 게이트 아래에서 돌릴 수 있다 — 근거 없는 값·가짜·불일치는 자동 거부,
  값 후보는 통합가 재확인 전까지 완료 안 됨, 자기선언은 무시.
- **다음**: 받기 고리 ↔ 출처 해석 배선(DOI 포함, sanctioned) · 해시 사슬 테이프의 런타임 emit(harness 의존) ·
  인용-원문 자동 대조.
- **바닥의 불안정함**: (a) `verify-run` 의 transcript 형식은 **harness 내부**라 계약이 아니다(형식 바뀌면 조용히
  0 이 될 수 있어 "미인식=통과 아님"으로 둠). (b) 외부에서 돌린 작업자엔 실행 기록이 없어 **과정 검증이 안 된다**
  — 그 흐름의 신뢰는 전적으로 **통합가의 결과 재-도출**에 달려 있다. (c) `--check-sources` 는 수신함에 있는 것만
  confirmed — 가짜 DOI 를 로컬로는 못 잡는다(통합가 augment fetch 가 잡음).

## 7. 재현

```sh
node dbtool.mjs verify-collection workspace/handoff/<주제>.jsonl [--check-sources]
node dbtool.mjs verify-run <transcript.output> --handoff workspace/handoff/<주제>.jsonl
node --test tests/collection_audit.test.mjs
```

설계: `docs/design/work-verification.md` · 작업 공간: `workspace/README.md` · 첫 맥락: `workspace/START-HERE.md`.
