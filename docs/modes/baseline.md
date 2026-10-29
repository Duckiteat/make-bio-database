# 모드: 기초시험 (`baseline` — 결정론장)

> 생성물 — `node rebuild/status.mjs --write` 가 `rebuild/rules/rules.jsonl · modes.json` 에서 만든다. 손으로 고치지 않는다 (규칙을 바꾸려면 원본을).

- **언제**: 지금 검증된 코어로 시뮬레이션을 돌려 관찰과 맞는지 볼 때
- **목표**: 지금 검증된 코어로 현실과 맞는지 본다
- **쓸 수 있는 곳**: 데이터·코드는 읽기만. 시나리오 숫자는 가정 원장(A…). 사전 등록 뒤 실행
- **가장 큰 위험**: 결과에 맞추려고 코드·데이터 고치기
- **끝내기 전**: 무결성 증명서 PASS · 사전 등록 해시 일치 · 우연 기준선과 함께 보고 · 쓴 값의 등급 표기
- **멈춤**: 무결성 FAIL · AUDIT_* → 고치지 말고 전환 기록

공통 규칙은 중심 문서(`CLAUDE.md`)에 있다.

## 지켜야 할 규칙 — 사람·AI (20)

### 관찰·측정값

- `RULE-0255` 규약엔 대응 실험의 종·세포·측정 시각·불확도·음성 대조가 있어야 한다 (없으면 그 공백을 한계로: TAP 사례 L000107).
- `RULE-0456` 판정 셋: CONSISTENT(FINDING — 가설 하나면 선언된 허용 차이 δ 안임을 동등성 검정(TOST)으로 보였을 때만, 가설 둘이면 이 가설만 기각되지 않음), CONFLICT(DOMAIN_CONFLICT — 모델과 관찰의 모순, 근거와 함께 데이터를 고칠 일), INDISTINGUISHABLE(DATA_GAP — 두 가설이 모두 맞아 가를 수 없음 → Observation_Gap …

### 한계

- `RULE-0081` 시뮬레이션 보고에 농도 공백(기본값·무한 풀) 명시 — 도달 여부만 말함 _(코드가 알림)_
- `RULE-0132` Audit Error 는 한계를 채우거나 등록
- `RULE-0134` 고갈은 결과로 보고 (결함 아님) _(코드가 알림)_
- `RULE-0137` 안정성 감사가 나오면 Δt 줄여 수렴할 때만 보고 _(코드가 알림)_
- `RULE-0159` 억제 힐 K = 임계값 −10 %
- `RULE-0161` 도달 시각은 Δ 바꿔 확인
- `RULE-0167` 기전은 세포 상태 mechanisms 에 걸어 운명 엔진으로 (따로 돌리는 길 금지)
- `RULE-0170` simulateRate 와 서로 기준 금지 (L000081)
- `RULE-0176` 확률은 앙상블로만 판정, 궤적 하나로 결론 금지
- `RULE-0183` 운명 결과는 fate --report 과정 보고서로만, 끝 상태만 말하지 않음
- `RULE-0184` 무결성 증명서 FAIL 이면 실패로 보고
- `RULE-0242` 억제는 경쟁·비경쟁을 가리지 않는 단순 배율

### 기전·시뮬레이션

- `RULE-0254` fate 인자는 시작 상태 — 끝 상태로 부르면 무결성 FAIL · rc=1
- `RULE-0256` `속도 상수 없음 → 즉시` — 그 단계는 순간에 끝난다(상수 미확인) — 시간 척도를 결론으로 쓰지 말라
- `RULE-0454` 쓸 수 없는 것: 라운드 수, 끝 풀의 양, 경쟁 결과(어느 표적이 먼저 차지했나 — 단계 순서에 좌우됨).
- `RULE-0455` 끝의 감사 목록이 비어 있지 않으면 결과보다 감사를 먼저 읽는다.

### 검증·판정

- `RULE-0496` 맞추기 금지 — 검증 세트를 보고 입력을 고치지 않음 — 틀리면 틀린 대로 보고 + 한계 — 사전 등록
- `RULE-0497` ④ 자유 매개변수: 3 개 이하 — 예측 9 개보다 충분히 적게 — 넘으면 "부분 실험" 으로 강등 · 가정 원장 번호로만 — 확정

## 컴퓨터가 막는 규칙

40 개 — 어기면 검사 오류에 그 번호(`RULE-…`)가 붙어 나온다. 이유·맥락은 규칙 장부(`rebuild/rules/rules.jsonl` · 맥락 `links.jsonl`)에서 번호로 찾는다.

## 형식 설명

3 개 — 칸의 모양·값의 뜻(SCHEMA). 쓸 때 찾는다: `node rebuild/read.mjs --list spec --mode baseline` · 하나는 `node rebuild/read.mjs RULE-…`

## 쓸 명령 (모든 모드의 명령은 중심 문서)

| 쓰는 명령 | 구역 | 무엇 |
|---|---|---|
| `dbtool assume` | registry | 가정 원장 보기·추가(add — 감사·봉인 뒤 서기) |
| `dbtool register` | registry | 모의 실험 규약 사전 등록 (실행 전) |
| `dbtool fate` | report | 운명 시뮬레이션 + 과정 보고서 |
| `mcp register` | registry | 사전 등록 |
| `mcp assume_add` | registry | 가정 원장 추가 |

읽기만: `dbtool map` · `dbtool mechanism` · `dbtool resolution` · `dbtool audit-run` · `dbtool simulate` · `dbtool grade` · `dbtool origin` · `dbtool compare` · `dbtool observe` · `mcp map` · `mcp mechanism` · `mcp origin` · `mcp assume_uses`
