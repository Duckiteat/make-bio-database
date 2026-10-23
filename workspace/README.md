# workspace/ — AI 작업자 전용 공간 (격리)

> **작업자(AI)는 먼저 `START-HERE.md` 를 읽는다 — 그 한 파일이 첫 맥락이다**(약한 모델도 한 번에 붙여 시작).
> 이 README 는 공간의 설계·근거이고, START-HERE 는 작업자용 짧은 지침이다.
>
> Sonnet 등 **더 싼 모델(작업자·수집가)이 일하는 유일한 쓰기 공간**이다. 신뢰 저장소(db.json·규칙·엔진)와
> **아예 분리**돼 있다. 작업자는 저장소 전체를 **읽을** 수 있으나 **쓰기는 여기(`workspace/`)뿐**이고,
> 검증·적용·본체 병합은 **통합가(Opus/사람)**가 한다. 핸드오프 프로토콜: `docs/PROMPTS.md` §3′.

## 절대 선 (작업자가 깨면 안 되는 것)

1. **쓰기는 `workspace/` 안에서만.** `data/db.json`·`vocab.js`·`model.js`·`core.js`·`judicial/`·`legislative/`·
   `compiler/`·`engine/`·테스트·형식 파일을 수정하지 않는다(읽기만).
2. **적용·등록 금지.** `node dbtool.mjs augment apply`·`merge`·`register` 를 돌리지 않는다. 데이터는 통합가가
   1차 출처로 검증해 패치로 넣는다.
3. **본체(main) 금지.** 커밋·push 는 자기 작업 브랜치(`sonnet/*` 등)에만. `main` 에 쓰지 않는다
   (저장소 브랜치 보호가 구조적으로 막는다).
4. **수집은 후보다.** 값·외부 ID 를 지어내지 않는다 — 조회·1차 출처로 확인한 것만, 못 찾으면 "없음".

## 구조

- `handoff/` — 수집가가 모은 후보와 통합가의 검증·적용 상태(`collected → verified/rejected → applied`).
  복사용 틀은 `handoff/HANDOFF-template.md`.
- `tasks/` — 통합가가 작업자에게 맡기는 묶음(batch) 과제 명세. 한 번에 하나(핑퐁 아님).
- `collector.settings.json` — 작업자 세션용 권한 프로파일(아래). 작업자 세션의 `.claude/settings.json` 으로 복사.

## 두 역할 루프 (단위 = 묶음)

1. 통합가가 `tasks/` 에 과제 하나를 적고 작업자 세션을 띄운다(또는 서브에이전트로).
2. 작업자가 읽기·조회·문헌으로 후보를 모아 `handoff/HANDOFF-<주제>.md` 에 `collected` 로 남긴다(또는 반환).
3. 통합가가 **1차 출처로 재확인**(작업자 값은 전부 후보) → 통과분 패치 → `validate` → `augment apply` →
   본체 병합. 상태를 `verified`/`rejected`/`applied` 로.

## 왜 이렇게 (격리의 근거)

세 겹 안전: **db 는 관문**(나쁜 패치 거부)·**본체·규칙·적용은 권한·브랜치 보호**(작업자가 구조적으로 못 함)·
**통합가가 1차 출처 재확인**(지어낸 값이 안 들어감). 이 공간은 그 첫 겹 — "작업자는 여기서만 쓴다" 를 눈에
보이게 못박는다. `data/fetched/`(원본 수신함)는 별개로 쓰기 보호이며 `augment plan→fetch→build→apply`
고리로만 채운다.
