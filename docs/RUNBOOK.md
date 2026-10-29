# 실행 설명서 — 이 시뮬레이션을 쓰는 법

이 파일 하나로 작업을 시작할 수 있게 쓴 것이다. **여기 적힌 명령은 전부 실제로 돌려 확인했다**(2026-10-10 · 수치 갱신 2026-10-16).
막히면 끝의 "더 읽을 곳" 으로 간다 — 교과서를 처음부터 읽지 않는다.

- 모든 명령은 **저장소 최상위**에서 돈다.
- 필요한 것은 **Node 22 이상 하나**. `npm install` 없음(의존성 0), Rust 없음(`.wasm` 이 저장소에 있음).
- 읽기·검증·시뮬레이션·시험은 허가를 묻지 않는다. 데이터를 바꾸는 명령과 `git push` 는 묻는다(`.claude/settings.json`).

---

## 0. 30 초 오리엔테이션

**이 저장소는 생명과학 지식을 "맥락과 함께" 저장하고, 그 지식만으로 기전을 적분하는 시스템이다.**
지식(정의항 D·단계 S·규칙)은 `data/db.json` 에, 측정값은 관찰 기록(O…)에, 못 하는 것은 한계(L…)에 있다.

권력이 넷으로 갈려 있고 **이 경계를 넘으면 시험이 실패한다**:

| 층 | 자리 | 할 수 있는 일 |
|---|---|---|
| 행정부 | `core.js` · `engine/*` | 읽기·적분. 원자료만 낸다. 판정·쓰기 없음 |
| 입법부 | `legislative/` | 데이터 정의·병합. **파일 쓰기는 `clerk.mjs` 하나** |
| 사법부 | `judicial/` | 검증·판정·도장. 데이터·엔진을 고치지 않는다 |
| 컴파일러 | `compiler/` | db + 시나리오 → 불변 IR. 순수 |

세 줄 요약: **`data/db.json` 을 직접 편집하지 않는다**(패치 → `validate` → `augment apply`).
**규칙을 느슨하게 해서 데이터를 통과시키지 않는다**(래칫이 잡는다).
**결과를 보고할 때 등급·가상 여부·농도 공백을 함께 말한다.**

---

## 1. 지금 무엇이 있나

```bash
node dbtool.mjs status          # 규모 한 줄 요약 (가장 싼 조회 — 개념·정의항·규칙·관찰·한계 수)
node dbtool.mjs map <이름>       # 개념이 이미 있나 — 번호(D…)를 찾는다
node dbtool.mjs context D000144 # 그 정의항의 부위·규칙·관찰 (map·context·mechanism·pattern 에 --audience en|both: 통제 토큰을 사전 영어로, 없으면 [en 미등록])
node dbtool.mjs mechanism 시트르산회로   # 단계 사슬·묶음 키
```

**`data/db.json` 을 직접 읽지 마라 — 660 KB(≈190 k 토큰)다.** 위 조회가 같은 답을 1/500 로 준다.
`CHANGES.md`(172 KB)·`limitations.md`(84 KB)·교과서 부록(100 KB)도 통째로 읽지 말고 `grep`·`sed -n` 으로 필요한 줄만 본다.

### 돌릴 수 있는 것

**경로 11 개** (`simulate`): `D000050` cAMP 신호 전달 · `D000051` 에피네프린에 의한 글리코겐 분해 ·
`D000102` LPS–TLR4–NF-κB 신호 전달 · `D000103` LPS 인식과 TLR4 활성화 · `D000104` MyD88 의존 신호 연쇄 ·
`D000105` NF-κB 활성화와 표적 유전자 전사 · `D000148` 시트르산 회로 · `D000170` 해당과정 ·
`D000172` 지방산 β-산화 · `D000177` MHC I 항원 처리·제시 · `D000178` MHC II 항원 처리·제시

**세포 상태 8 개** (`fate`): `D000174` 활성화된 CD8 T · `D000175` 효과기 CD8 T · `D000176` 기억 전구 CD8 T ·
`D000202` 미성숙 수지상 세포 · `D000203` 성숙 수지상 세포 · `D000210` 증식하는 섬유아세포 · `D000211` 복제 노화 섬유아세포 ·
`D000212` 대식세포 (LPS→NF-κB→TNF 를 기전으로 감쌈 — fate 성능 벽 L000113, 검증은 적분장 엔진 뒤로)

**시나리오 42 개**: `examples/scenarios/*.json` — 전부 `hypothetical: true`(상수가 가상). 검증용은 `*-validation-hypothetical.json`.

---

## 2. 돌리는 법 — 확인된 조합

### 운명 (세포 상태 전이)

```bash
node dbtool.mjs fate <시작 상태> --scenario examples/scenarios/<파일>.json [--report 보고서.md] [--workers 8]   # 파생 시나리오(base + perturbation)는 기준을 읽어 풀린다 — 예: mhc-*-null
```

**인자는 시작 상태다.** 끝 상태로 부르면 보고서는 나오지만 무결성이 FAIL 이고 종료 코드가 1 이다(아래 표).

| 시작 상태 | 시나리오 | 결과 | 무결성 |
|---|---|---|---|
| `D000174` | `fate-effector-il12` | 효과기 CD8 T 도달 2.00 h | PASS |
| `D000174` | `fate-memory-il15` | 기억 전구 도달 6.82 h | PASS |
| `D000174` | `fate-mixed-optimal` | 효과기 도달 2.01 h | PASS |
| `D000174` | `fate-effector-glucose-withheld` | **분화 정지** — 어느 상태에도 못 듦 | PASS |
| `D000202` | `mhc-dc-maturation-lps` | 성숙 수지상 세포 도달 0.84 h | PASS |
| `D000202` | `mhc-dc-immature-baseline` | 시작 상태에 머묾 (baseline) | PASS |
| `D000210` | `telomere-hayflick` | 복제 노화 도달 1880.95 h (= 분열 75 회) | PASS |
| `D000210` | `telomere-mitogen-withheld` | 시작 상태에 머묾 | PASS |
| `D000210` | `telomere-telomerase` | 시작 상태에 머묾 (requirement) | PASS |
| ~~`D000203`~~ | `mhc-dc-maturation-lps` | 이미 끝 상태 | **FAIL · rc=1** |
| ~~`D000211`~~ | `telomere-hayflick` | 미결정 | **FAIL · rc=1** |

`--workers 8` 은 결정 탐침을 코어 수만큼 병렬로 돈다(실행 시간의 85–93 %가 탐침이다). 결과는 lanes 와 무관하게 같다.

### 경로 (기전 적분)

```bash
node dbtool.mjs simulate 시트르산회로 --rate --scenario examples/scenarios/tca-nad-exhaustion-hypothetical.json
node dbtool.mjs simulate 시트르산회로 --rate --until-death     # 멈출 때까지
node dbtool.mjs simulate <경로>                                 # 도달 여부만 (속도 없이)
```

### 그 밖

```bash
node dbtool.mjs audit-run <경로>              # 감사 — Audit Error 가 있으면 종료 코드 1 (정상이다)
node dbtool.mjs resolution <경로>             # 단계마다 필요한 해상도 pool/site/structure
node dbtool.mjs pattern <경로>                # 상위 패턴 (motif 후보)
node dbtool.mjs grade [--min parameter]       # 쓰인 값의 신뢰 등급
node dbtool.mjs compare --state D000174 --scenario A.json [--scenario-b B.json | --patch p.json]
node dbtool.mjs observe <O…|관찰.json> --state <상태> --scenario A.json [--n 50]   # 가설 하나의 일치는 시나리오 equivalence 의 δ(근거 등급 parameter 이상)로만. 정성 관찰이면 정성 모의 판정 — 관찰의 교란을 --scenario(대조군)에 걸어 방향·유무·단조·순서 + 우연 기준선
node dbtool.mjs report data/patches/<기록>.json    # 지난 패치의 Patch Report
node dbtool.mjs register <시나리오.json>        # 모의 실험 규약 사전 등록 (검증에 쓰는 실행은 실행 전에 — 고치면 미등록)
node dbtool.mjs qualgraph [O…] [--json]         # 정성 그래프 0 층 판정: 교란 대상 → 읽을 거리 경로 부호 대 주장 (지지·경로 없음·모순 후보·부호 섞임) — 구조만, 일치 아님
node dbtool.mjs evidence <시나리오.json> [--target <경로|상태>] [--report 파일.md] [--json]   # 증거·방법 보고서: 인과·값표(등급·출처·닫는 방법)·판정 수준·실패(열린 한계)·사고패턴·얻은 것/다음/바닥의 불안정함 — 읽기만. --target 생략 시 examples/scenarios/subjects.json
node dbtool.mjs dictionary                         # 사전 봉인 판정 (사슬·revises·렌더 모호·vocab 덮임) — validate 에도 포함
node dbtool.mjs dictionary add <항목.json|.jsonl>  # 새 영어 항목: 사법부 검사 → 봉인 → 서기가 사슬에 추가 (고치기는 revises: 현재 root)
node dbtool.mjs evidence --recheck <보고서.md...>   # 보고서의 의존 지문을 지금 db 와 대조 — 값 내용 변경·근거 철회면 '재검증 필요' (종료 1)
node dbtool.mjs origin <시나리오.json> | --all   # 첫 장면 기원: 시작 입력·계의 db 숫자마다 실측·숫자출처없음·가상(한계 등록)·가상(기원 없음)
node dbtool.mjs evidence --all [--report 파일.md]   # 시나리오 전부의 판정 수준 색인 표 (새 시나리오는 subjects.json 에 대상을 같은 커밋에 등록)
node dbtool.mjs log                            # 델타 기록: 사슬 무결성 + 기원부터 재생 = 지금 db (기원은 log --genesis 로 한 번)
node dbtool.mjs verify-collection <핸드오프.jsonl> [--check-sources]   # 수집 작업 검증: 구조·구별·출처 형식·재사용 db 존재 → PASS/INCOMPLETE/BLOCKED/REJECTED/REVIEW_REQUIRED (읽기만). 값 후보는 자동 PASS 안 됨. --check-sources 는 출처(PMID)를 로컬 수신함(data/fetched/)과 대조(네트워크 금지 governance) — 없으면 통합가가 augment fetch 로 1차 출처 확인
node dbtool.mjs verify-run <transcript.output> --handoff <핸드오프.jsonl>   # 실행 기록 대조: 서브에이전트 실제 도구 호출 vs 주장(값/읽음인데 WebFetch·Read 0 이면 깃발). best-effort — 내 세션 서브에이전트 한정·과정 완전 증명 아님
```

### 검증 (관찰과의 일치) — 사전 등록된 규약 아래에서만

일치/불일치 **결론**은 사전 등록 규약 아래에서만 낸다. 규약 없는 실행은 **탐색 실행**(결론 불가).

```bash
# ① 선행조건 점검 (가장 먼저) — 어느 관찰이 규약을 세울 출처인가?
#    규약엔 대응 실험의 종·세포·측정 시각·불확도·음성 대조가 있어야 한다 (없으면 그 공백을 한계로: TAP 사례 L000107).
node dbtool.mjs grade              # 쓰인 값이 실측(anchor/parameter)인지 가상인지
#    정량 검증은 보류용 관찰이 use=validation 이어야 한다 — 지금은 정량 관찰이 전부 estimation(공백).
# ② 규약(protocol) 담은 시나리오를 실행 전에 등록 (등록 뒤 고치면 미등록)
node dbtool.mjs register examples/scenarios/<검증>-validation-hypothetical.json
# ③ 판정 — 정성(방향·유무·순서) 또는 정량(δ equivalence), 우연 기준선·음성 대조와 함께
node dbtool.mjs observe <O…> --state <상태> --scenario <대조군>.json
node dbtool.mjs evidence <검증>.json --target <경로|상태> --report <보고서>.md
```

판정 결과: **맞음 · 틀림 · 보이지 못함(불일치 아님) · 무효**. 결론은 등록 규약의 검증 세트 관찰만, 우연 기준선 P(K≥k) 와 함께.

### MCP 서버 (에이전트용, `docs/design/outsourcing-and-mcp.md` §4)

```
BIODB_ROLE=collector  node mcp/query.mjs    # 읽기 — map·context·limitations·origin·assume_uses·inbox·verify_collection …
BIODB_ROLE=collector  node mcp/fetch.mjs    # 받기 — resolve_access·fetch_abstract·fetch_fulltext (공개 전문만)·resolve_doi·brenda_kinetics(계정 = 환경 변수 BRENDA_EMAIL·BRENDA_PASSWORD_SHA256), 받기 기록 FETCH_LOG.jsonl
BIODB_ROLE=integrator node mcp/clerk.mjs    # 쓰기 — 수집가는 put_handoff 만, 통합가는 merge·register·assume_add … (하나만 뜸)
```

Claude Code 등 MCP 클라이언트 설정 예(`.mcp.json` — 저장소에 두지 않고 쓰는 쪽에서):
`{"mcpServers":{"biodb-query":{"command":"node","args":["mcp/query.mjs"],"env":{"BIODB_ROLE":"collector"}},"biodb-fetch":{"command":"node","args":["mcp/fetch.mjs"],"env":{"BIODB_ROLE":"collector"}},"biodb-clerk":{"command":"node","args":["mcp/clerk.mjs"],"env":{"BIODB_ROLE":"collector"}}}}`

---

## 3. 결과를 읽는 법

### 반드시 먼저 보는 세 줄

`fate` 보고서의 §1 표에서:

| 줄 | 뜻 | 이게 아니면 |
|---|---|---|
| `무결성` | **PASS** 여야 한다 (예: `PASS (11/11 확인)`) | **FAIL 이면 그 결과를 결론에 쓰지 않는다.** 실패로 보고한다 |
| `상수` | `가상 값 (hypothetical)` 인지 데이터인지 | 가상이면 "실제 세포의 시각을 예측하지 않는다" 를 함께 말한다 |
| `시나리오 맥락` | `원인`(cause) · `무엇이 없으면`(requirement) · `신호 없음`(baseline) | 결과를 맥락과 함께 말한다 — "이 실행은 X 의 원인을 보인다" |

`simulate --rate` 출력에서:

| 표시 | 뜻 |
|---|---|
| `· data: concentration 818 µM × volume 181 fL` | 시작량이 **데이터**에서 왔다 — 믿을 수 있다 |
| `· 시작량 기본값(농도 공백)` | 데이터가 없어 기본 1000 분자 — **그 결과는 도달 여부만 말한다** |
| `속도 상수 없음 → 즉시` | 그 단계는 순간에 끝난다(상수 미확인) — 시간 척도를 결론으로 쓰지 말라 |
| `[AUDIT_RESOURCE · DATA_GAP]` | 감사 항목. `fault` 태그대로 고친다(§5) |

### 종료 코드

**종료 코드 1 은 "명령을 잘못 썼다" 가 아니라 "판정이 났다" 는 뜻이다.** 메시지를 읽는다.

| 명령 | rc=1 의 뜻 |
|---|---|
| `fate` | 무결성 FAIL — 그 결과를 결론에 쓰지 않는다 |
| `validate <patch>` | 관문 거부 — §6 표에서 고칠 곳을 찾는다 |
| `audit-run` | Audit Error 가 있다 (정상 동작) |
| `grade --min <등급>` | 문턱 미달 항목이 있다 |
| `textbook --check` | 부록이 낡았거나 분류 안 된 파일이 있다 → `textbook --write` + `storage-map.json` |
| `limitations --check`/`--detect` | `limitations.md` 가 낡았거나 미등록 후보가 있다 |

---

## 4. 데이터를 넣는 법 (4 단계, 이 순서로만)

```bash
# ① 이미 있나 확인
node dbtool.mjs map <이름>

# ② 패치를 저장소 밖에 쓴다 (스크래치 폴더) — why 는 필수
#    생성기(gen_*.mjs)로 쓰면 상수를 한 곳에 모아 둘 수 있다

# ③ 관문을 미리 본다 (쓰지 않는다)
node dbtool.mjs validate /tmp/.../patch.json

# ④ 통과하면 적용 — 병합 + 기록 + CHANGES 행 + limitations·교과서 갱신
node dbtool.mjs augment apply /tmp/.../patch.json
```

패치 모양 (최소):
```json
{ "format": "definition-db-patch",
  "why": "왜 넣는지 — 없으면 거부된다",
  "senses": [ { "id": "D000144", "obs": [ /* 유지할 항목까지 전부 */ ] } ],
  "observations": [ { "id": "O+1", "...": "…" } ],
  "limitations": [ { "id": "L+1", "target": "D000144", "type": "Concentration_Gap", "requirement": { "text": "…", "needs": [ … ] } } ] }
```

**배열은 통째로 교체된다.** `obs`·`rule`·`desc` 를 고칠 때는 **유지할 항목도 함께 적는다** — 빼면 지워진다
(측정의 파생값은 아예 거부된다, §5).

새 번호는 임시 번호로: `D+1`·`O+1`·`L+1`. 직접 번호를 지어내지 않는다. `meta.next` 를 손대지 않는다.

### 문헌에서 상수를 가져올 때

측정값은 **관찰 기록(O…)으로 먼저** 넣고 규칙이 `kinetics.from` 으로, 정의항 obs 는 `from` 으로 가리킨다.
그냥 상수만 적으면 관문이 거부한다. 자세한 절차는 교과서 7.5′.

---

## 5. 하면 안 되는 것 (이유와 함께)

| 금지 | 왜 | 대신 |
|---|---|---|
| `data/db.json` 직접 편집 | 관문·기록·도장을 건너뛴다. 도구가 **거부**한다 | 패치 → `validate` → `augment apply` |
| 거부를 통과시키려 규칙(`model.js`·`judicial/`·`vocab.js`) 고치기 | 래칫이 잡는다 — 거부 말뭉치가 통과해 버려 빨개진다 | 거부 메시지대로 **데이터**를 고친다 (§6) |
| 시험을 `skip`·`todo` 로 두기 | 건너뛴 시험은 없는 시험이다. 래칫이 실패한다 | 고치거나 지운다 |
| 수치 문제를 생물 상수로 맞추기 | `NUMERICAL` 결함은 솔버·결합점의 문제다 | `engine/coupling.js` 의 허용 오차·Δ. db.json 의 상수는 그대로 |
| 고갈·정지를 "버그" 로 고치기 | 유한 계는 멈추는 게 **결과**다 (`FINDING`) | 결과로 보고하고, 재생 경로가 없으면 `Kinetic_Gap` 등록 |
| 값을 지어내기 (외부 ID·상수·서열) | 전체 설계의 전제가 무너진다 | 모르면 `unmapped`·한계로 등록 |
| 다른 종의 값을 이 종의 값으로 | 관문이 종을 대조해 거부한다 | 같은 종 값을 찾거나 한계로 등록 |
| 무결성 FAIL 인 결과를 결론에 쓰기 | 보고서가 스스로 못 믿겠다고 말한 것이다 | 실패로 보고한다 |
| `--allow-warnings` | 경고를 눌러 끈다 | 사용자가 허락했을 때만 |
| PR 만들기 | | 사용자가 명시로 요청할 때만 |

### 결함 태그 고르기 (틀리면 가장 큰 사고)

감사 항목마다 `fault` 가 붙어 있다. **그 태그가 고칠 자리를 정한다**:

`FINDING` 결과 — 고치지 않음 · `DATA_GAP` 한계 등록(확인된 값만) · `DOMAIN_CONFLICT` 근거와 함께 데이터 패치 ·
`NUMERICAL` 결합점·솔버(**db.json 의 생물 상수를 바꾸지 않는다**) · `ENGINE_DEFECT` 엔진 코드 · `COMPILER_DEFECT` `compiler/`

---

## 6. 관문이 거부할 때 — 메시지 → 고칠 곳

실제로 나온 거부들이다. **메시지가 고칠 곳을 말해 준다.**

| 거부 메시지 | 뜻 | 고칠 곳 |
|---|---|---|
| `문헌(curated) 속도 상수 … 에 관찰 기록(kinetics.from)이 없음` | 상수만 적었다 | 관찰 기록(O…)을 먼저 넣고 `kinetics.from` 으로 참조 |
| `'kcat' 값 40 이 관찰 값 26.7 와 다름` | 파생값이 측정과 어긋남 | 값을 관찰에서 그대로 쓴다 |
| `문헌(curated) 'concentration' 에 관찰 기록 참조(from)가 없음` | 정의항 obs 에 출처가 없다 | `from: 'O…'` 를 단다 |
| `종이 다름 — obs 는 '10090', 관찰은 '9606'` | 다른 종의 측정을 가져왔다 | 같은 종 값을 찾거나 한계 등록 |
| `값 818 이 물리적 상한 100 를 넘음` | 단위를 잘못 적었다 | 단위·값을 확인 (818 µM ≠ 818 M) |
| `단위 'unit_x' 은 어휘의 환산표에 없음` | 모르는 단위 | `vocab.unitFactors` 에 있는 단위로 |
| `측정의 파생값은 지울 수 없음` | 배열을 교체하며 측정값을 빠뜨렸다 | 유지할 항목을 함께 적는다 |
| `관찰 기록은 바꿀 수 없음 — retracted 만` | 관찰은 불변이다 | 잘못이면 `retracted` 를 더한다 |
| `측정 대상 … 는 기전에 참여할 수 없음` | 관찰 대상이 묶음이 아니다 | `D…|위치` 묶음 키로 |
| `종(species/taxa) '9823' 은 어휘 목록에 없음` | 통제 어휘 밖 | 어휘에 있는 값으로 (어휘 추가는 사용자 요청) |
| `없는 정의항 번호 — 새 정의항은 임시 번호(D+1)` | 번호를 지어냈다 | `D+1` 로 |
| `미등록 한계 후보가 있음` | 공백을 등록하지 않았다 | `limitations` 에 등록하고 다시 |

---

## 7. 바꾼 뒤 반드시 돌리는 것

```bash
node --test tests/*.test.mjs          # 384/384 (약 120 초) — 바닥값은 tests/fixtures/FLOOR.json
node dbtool.mjs validate              # 오류 0 · 경고 0 · 유효한 증명 도장 178
node dbtool.mjs limitations --check    # limitations.md 최신
node dbtool.mjs limitations --detect   # 등록되지 않은 한계 후보 없음 (+ '다시 볼 한계': 재검토 조건 충족 — 종료 코드에 안 들어감)
node dbtool.mjs attest                 # 도장 재검증
node dbtool.mjs textbook --check       # 부록 최신 · 모든 파일 분류됨
node tests/fate_suite.js --quick       # 54/54
cmp index.html viewer.html             # 화면 두 파일이 같은지
```

- **코드·형식·어휘·문서 구조**를 바꿨으면 `CHANGES.md` 맨 위에 한 행(Scope·Why·Impact·Verification). **행을 고치거나 지우지 않는다** — 정정은 새 행.
- **형식**을 바꿨으면 `SCHEMA.md` 변경 기록 + `migrations/` 변환 스크립트.
- **파일을 더했으면** `docs/textbook/storage-map.json` 에 분류(`textbook --check` 가 잡는다).
- **새 방어 규칙을 더했으면** 거부 말뭉치(`tests/fixtures/rejections/`)와 바닥값(`tests/fixtures/FLOOR.json`)을 같이 올린다.

---

## 8. 사용자에게 보고하는 형식

산문 요약 금지. **네 칸 표**로 쓴다:

| Scope | Why | Impact | Verification |
|---|---|---|---|
| 건드린 파일·정의항 | 왜 | 하류에 뭐가 바뀌나 | 시험 수·validate·확인한 숫자 |

함께 밝힐 것: 쓴 값의 **등급**(`anchor`/`parameter`/…) · **가상 상수**인지 · **농도 공백**이 있는지 · **무결성 판정**.

---

## 9. 사람(또는 더 큰 모델)에게 넘길 신호

아래는 혼자 밀지 말고 물어본다 — 틀리면 되돌리기 어렵거나, 규약상 사용자 요청이 필요하다.

1. **숫자가 설명되지 않을 때** — 멈춤·늦음·NaN·`AUDIT_*`·무결성 FAIL 의 원인을 모를 때
2. **결함 태그가 갈릴 때** — "데이터를 고칠까 코드를 고칠까" 가 애매하면 `NUMERICAL` 로 가정하고 묻는다
3. **통제 어휘·규칙을 건드려야 할 때** — `vocab.js`·`model.js`·`core.js`·`judicial/`·`legislative/` 는 **사용자 요청이 있을 때만**
4. **형식(SCHEMA)을 바꿔야 할 때** — 이관 스크립트·계약·시험이 함께 움직인다
5. **거부를 통과시킬 길이 규칙을 고치는 것뿐일 때** — 그건 막혀 있다. 보고하고 멈춘다
6. **관문이 통과시켰는데 결과가 이상할 때** — 새 구멍일 수 있다. 재현 절차와 함께 보고한다

---

## 10. 더 읽을 곳 (막혔을 때만)

| 찾는 것 | 파일 |
|---|---|
| 세션마다 지킬 규칙 전체 | `CLAUDE.md` |
| 무엇이 허용되나 (필드·규칙 명세) | `SCHEMA.md` — 특히 §8L 분열·소모, §8M 측정값 사슬과 래칫 |
| 출력·표시를 어떻게 읽나 | `docs/textbook/06-출력-해석.md` |
| 데이터 넣는 절차 상세 | `docs/textbook/07-AI-작업-절차.md` (§7.5′ 문헌에서 상수 찾기) |
| 알고리즘이 어떻게 계산하나 | `docs/textbook/04-알고리즘.md` (§4.9F 분열·소모, §4.9G 안전장치) |
| 지금 못 하는 것 | `limitations.md` (`grep` 으로 필요한 줄만) |
| 최근에 무엇이 바뀌었나 | `CHANGES.md` 맨 위 몇 행만 |
| 내 임무의 경계가 어디까지인지 | `docs/PROMPTS.md` (프롬프트 묶음 — 작업 종류별 경계·검증·멈춤 조건) |
| 권력 분리의 이유 | `docs/design/tripartite-governance.md` |
| 관찰 포트 설계 | `docs/design/observation-port.md` |
| 사전·번역기(기계어↔사람말, 영한 병기) | `docs/design/dictionary-and-translation.md` (`dictionary.js`·`data/dictionary.jsonl`) |
| 보존/비보존 분류(오차 3채널 기저) | `docs/design/conservation-classes.md` (`vocab.conservationClasses`·`conservationReasons`) |
| 색인·파싱 비용 문턱 | `tests/bench_index.js` (`node tests/bench_index.js`) |
| 수집가·통합가 핸드오프(싼 모델에 수집 위임) | `docs/PROMPTS.md` §3′ |
| AI 작업자 전용 공간(격리) | `workspace/README.md` · 핸드오프 `workspace/handoff/` · 권한 프로파일 `workspace/collector.settings.json` |
