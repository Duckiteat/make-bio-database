# 모드: 적분장 (`field` — T3 확률장 · T4 스파크 · T5 핵 기억)

> 생성물 — `node rebuild/status.mjs --write` 가 `rebuild/rules/rules.jsonl · modes.json` 에서 만든다. 손으로 고치지 않는다 (규칙을 바꾸려면 원본을).

- **언제**: 다음 엔진(공간·확률 장)의 설계와 시제품을 만들 때
- **목표**: 다음 엔진의 설계·시제품
- **쓸 수 있는 곳**: 엔진 시제품 + 그 시험. db 에 장 상태 금지
- **가장 큰 위험**: 검증보다 능력이 앞섬 (direction §2)
- **끝내기 전**: 종단 시험 · 전이 수지 정확 0 · 벤치 기준선과 비교
- **멈춤**: "반박할 공간 관찰이 있나?" 가 아니오면 결론 금지

공통 규칙은 중심 문서(`CLAUDE.md`)에 있다.

## 지켜야 할 규칙 — 사람·AI (0)

없음 — 이 모드의 규칙은 모두 컴퓨터가 막는다.

## 컴퓨터가 막는 규칙

8 개 — 어기면 검사 오류에 그 번호(`RULE-…`)가 붙어 나온다. 주제별 번호는 아래 — 한 줄 제목은 `node rebuild/read.mjs RULE-… --depth 0`, 이유·맥락은 깊이 1·2.

- 권한·쓰기 (삼권 분립): RULE-0049 · RULE-0050 · RULE-0051 · RULE-0052 · RULE-0053 · RULE-0054 · RULE-0055
- 한계: RULE-0138

## 형식 설명

0 개 — 칸의 모양·값의 뜻(SCHEMA). 쓸 때 찾는다: `node rebuild/read.mjs --list spec --mode field` · 하나는 `node rebuild/read.mjs RULE-…`

## 쓸 명령 (모든 모드의 명령은 중심 문서)

없음
