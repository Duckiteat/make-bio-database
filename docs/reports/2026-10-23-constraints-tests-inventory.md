# 제약·시험 전수 목록 (2026-10-23)

> 코드에서 기계로 뽑은 목록 — 손으로 고르지 않았다. 거부·경고·예외를 내는 자리(제약)와 그것을 시험하는 자리(시험)를 하나씩. 분류는 이 목록 위에서 사람이 한다. 같은 메시지가 여러 자리에 있으면 자리마다 한 줄. 메시지가 `(전달)` 로 시작하면 그 자리는 고정 문구 없이 다른 검사의 결과(오류 목록·하위 함수의 error)를 넘기는 자리다 — 실제 문구는 넘겨받은 쪽의 줄에 있다.

## 0. 개수

| 무엇 | 개수 |
|---|---|
| 코드 제약 자리 | 819 |
| · 컴파일러 | 28 |
| · 공유(core.js) | 4 |
| · CLI | 77 |
| · 공유(dictionary.js) | 11 |
| · 행정(엔진) | 20 |
| · 사법 | 593 |
| · 입법·서기 | 34 |
| · MCP | 21 |
| · 공유(model.js) | 12 |
| · 조정자 | 18 |
| · 공유(scenarios.js) | 1 |
| 스키마 제약 | 262 |
| 쓰기 구역 | 7 |
| 물리 상한 | 8 |
| MCP 역할 | 3 |
| node:test 시험 | 314 |
| 스크립트 check | 22 |
| 스크립트 시험 | 6 |
| 거부 말뭉치 | 24 |
| CI 단계 | 16 |

종류별 (코드 제약):

| 종류 | 개수 |
|---|---|
| 오류 | 493 |
| 오류 반환 | 88 |
| 예외 | 55 |
| 사용 오류 | 69 |
| 문제 | 5 |
| 판정 | 24 |
| 규약 위반 | 40 |
| 경고 | 5 |
| 쓰기 거부 | 33 |
| 도구 거부 | 7 |

## 1. 코드 제약 — 컴파일러

| # | 파일:줄 | 함수·명령 | 종류 | 메시지 |
|---|---|---|---|---|
| 1 | compiler/assumptions.js:65 | resolve | 오류 | ${where}: 가정 ${id} 이 원장에 없음 |
| 2 | compiler/assumptions.js:66 | resolve | 오류 | ${where}: 가정 ${id} 은 다른 자리(${slotKey(rec.slot)})의 기록 — 번호를 옮겨 붙일 수 없음 |
| 3 | compiler/assumptions.js:67 | resolve | 오류 | ${where}: 단위가 다름 — 기록 ${rec.unit} · 시나리오 ${at.unit} |
| 4 | compiler/assumptions.js:71 | resolve | 오류 반환 | (전달) errors.join('\n') |
| 5 | compiler/ir_builder.js:25 | assemble | 오류 반환 | '${sourceId}' 는 세포 상태(cell_state) 정의항이 아님 |
| 6 | compiler/ir_builder.js:132 | 명령 hill | 예외 | 미분할 수 없는 노드 ${e.op} |
| 7 | compiler/ir_builder.js:159 | 명령 dhill | 예외 | 낮출 수 없는 노드 ${e.op} |
| 8 | compiler/ir_builder.js:186 | buildFateIR | 오류 반환 | (전달) A.error |
| 9 | compiler/perturb.js:23 | applyOne | 오류 반환 | (전달) A.error |
| 10 | compiler/perturb.js:27 | exclude | 오류 반환 | 교란에 type 이 없음 |
| 11 | compiler/perturb.js:29 | exclude | 오류 반환 | knockout 대상은 정의항 번호(D…) — '${p.target}' |
| 12 | compiler/perturb.js:31 | exclude | 오류 반환 | knockout 대상 ${p.target} 이 이 계에 없음 |
| 13 | compiler/perturb.js:36 | exclude | 오류 반환 | block 대상 규칙 ${p.target} 이 이 계에 없음 |
| 14 | compiler/perturb.js:39 | exclude | 오류 반환 | inhibit 대상 규칙 ${p.target} 이 이 계에 없음 |
| 15 | compiler/perturb.js:40 | exclude | 오류 반환 | inhibit 에는 Ki_M > 0, dose_M ≥ 0 (몰 농도) 필요 |
| 16 | compiler/perturb.js:44 | exclude | 오류 반환 | clamp 대상 묶음 ${p.target} 이 이 계에 없음 |
| 17 | compiler/perturb.js:45 | exclude | 오류 반환 | clamp 에는 conc_M ≥ 0 (몰 농도) 필요 |
| 18 | compiler/perturb.js:48 | exclude | 오류 반환 | set_amount 대상 묶음 ${p.target} 이 이 계에 없음 |
| 19 | compiler/perturb.js:49 | exclude | 오류 반환 | set_amount 에는 n ≥ 0 (분자 수) 필요 |
| 20 | compiler/perturb.js:51 | exclude | 오류 반환 | 알 수 없는 교란 '${p.type}' — knockout \| block \| inhibit \| clamp \| set_amount \| dose_series |
| 21 | compiler/perturb.js:64 | perturb | 오류 반환 | dose_series 에는 of { type: inhibit \| clamp \| set_amount, … } 와 doses [M 또는 분자 수, …] 가 필요 |
| 22 | compiler/perturb.js:68 | perturb | 오류 반환 | (전달) r.error |
| 23 | compiler/perturb.js:84 | perturbedIR | 오류 반환 | (전달) ir.error, record |
| 24 | compiler/perturb.js:99 | derive | 오류 반환 | 파생 시나리오는 기준 + 교란 한 줄만 — 받지 않는 필드: ${extra.join(', ')} (다른 값이 필요하면 기준을 새로 만든다) |
| 25 | compiler/perturb.js:100 | derive | 오류 반환 | 기준 시나리오 '${sc.base}' 를 읽지 못함 |
| 26 | compiler/perturb.js:101 | derive | 오류 반환 | 기준 '${sc.base}' 도 파생 시나리오 — 기준은 한 단계만 |
| 27 | compiler/perturb.js:102 | derive | 오류 반환 | 파생 시나리오의 perturbation 은 교란 하나 (dose_series 는 실행마다 하나씩) |
| 28 | compiler/tape.js:53 | evalTape | 예외 | 알 수 없는 테이프 명령 ${op} @ ${p - 1} |

## 2. 코드 제약 — 공유(core.js)

| # | 파일:줄 | 함수·명령 | 종류 | 메시지 |
|---|---|---|---|---|
| 1 | core.js:279 | simulate | 오류 반환 | (전달) tg.error |
| 2 | core.js:281 | simulate | 오류 반환 | '${target}' 에 속한 단계가 없음 |
| 3 | core.js:437 | simulateRate | 오류 반환 | (전달) tg.error |
| 4 | core.js:439 | simulateRate | 오류 반환 | 저장소 방식 '${mode}' — ${Object.keys(V.reservoirModes).join(' \| ')} |

## 3. 코드 제약 — CLI

| # | 파일:줄 | 함수·명령 | 종류 | 메시지 |
|---|---|---|---|---|
| 1 | dbtool.mjs:77 | resolveScenario | 오류 반환 | (전달) e.message |
| 2 | dbtool.mjs:80 | resolveScenario | 오류 반환 | 파생 시나리오 ${path} 는 세포 상태가 있는 실행(fate · observe · compare)에서만 — 교란이 그 계의 규칙·묶음을 보고 풀린다 |
| 3 | dbtool.mjs:82 | resolveScenario | 오류 반환 | 파생 시나리오 ${path}: 기준 '${sc.base}' 이 없음 |
| 4 | dbtool.mjs:83 | resolveScenario | 오류 반환 | 파생 시나리오 ${path}: ${e.message} |
| 5 | dbtool.mjs:85 | resolveScenario | 오류 반환 | 파생 시나리오 ${path}: ${v.error} |
| 6 | dbtool.mjs:90 | loadScenario | 사용 오류 | (전달) r.error |
| 7 | dbtool.mjs:99 | audienceOpt | 사용 오류 | (전달) e.message |
| 8 | dbtool.mjs:151 | 명령 validate | 오류 | (전달) e |
| 9 | dbtool.mjs:158 | 명령 merge | 사용 오류 | 사용법: merge <patch.json...> [--dry] [--allow-warnings] |
| 10 | dbtool.mjs:170 | 명령 merge | 사용 오류 | (전달) !g.changed ? '바뀐 것이 없음 — 저장하지 않았습니다.' : g.errors.length ? `오류 ${g.errors.length} — |
| 11 | dbtool.mjs:184 | 명령 report | 사용 오류 | 사용법: report <data/patches/….json> |
| 12 | dbtool.mjs:186 | 명령 report | 사용 오류 | 이 기록에는 Patch Report 가 없음 (report 도입 이전 병합) |
| 13 | dbtool.mjs:191 | 명령 map | 사용 오류 | 사용법: map <번호\|이름\|이름#n\|외부ID\|지문> |
| 14 | dbtool.mjs:203 | 명령 vocab | 사용 오류 | 어휘 표 '${t}' 없음 |
| 15 | dbtool.mjs:210 | 명령 context | 사용 오류 | 사용법: context <번호\|이름\|이름#n> [--up N] [--down N] |
| 16 | dbtool.mjs:215 | 명령 mechanism | 사용 오류 | 사용법: mechanism <S…\|경로 번호·이름> [--up N] [--down N] |
| 17 | dbtool.mjs:225 | 명령 limitations | 사용 오류 | limitations.md 가 data/db.json 과 다름 — node dbtool.mjs limitations --write |
| 18 | dbtool.mjs:245 | 명령 pattern | 사용 오류 | 사용법: pattern <경로\|상위 개념> |
| 19 | dbtool.mjs:257 | re | 사용 오류 | storage-map: '${f.path}' 의 분류 '${f.class}' 가 classes 에 없음 |
| 20 | dbtool.mjs:260 | re | 사용 오류 | storage-map: 분류 '${k}' 의 구역 '${c.zone}' 가 zones 에 없음 |
| 21 | dbtool.mjs:261 | re | 사용 오류 | storage-map: '${f.path}' 의 구역 '${f.zone}' 가 zones 에 없음 |
| 22 | dbtool.mjs:265 | re | 사용 오류 | storage-map: 노드 '${f.node}' 가 둘 이상 |
| 23 | dbtool.mjs:267 | re | 사용 오류 | storage-map: 노드 '${f.node}' 의 권한 '${f.governance}' 가 열거값에 없음 |
| 24 | dbtool.mjs:268 | re | 사용 오류 | storage-map: 노드 '${f.node}' 에 refactor_strategy 없음 |
| 25 | dbtool.mjs:269 | re | 사용 오류 | storage-map: 노드 '${f.node}' 의 경로 ${f.path} 가 없음 |
| 26 | dbtool.mjs:273 | re | 사용 오류 | storage-map.json 에 분류되지 않은 파일:\n |
| 27 | dbtool.mjs:275 | re | 사용 오류 | 교과서 부록이 현재 코드·데이터와 다름 — node dbtool.mjs textbook --write |
| 28 | dbtool.mjs:282 | 명령 resolution | 사용 오류 | 사용법: resolution <경로> |
| 29 | dbtool.mjs:288 | 명령 audit-run | 사용 오류 | 사용법: audit-run <경로> [--scenario s.json] |
| 30 | dbtool.mjs:297 | 명령 simulate | 사용 오류 | 사용법: simulate <경로> --rate [--scenario s.json] |
| 31 | dbtool.mjs:302 | 명령 simulate | 사용 오류 | 사용법: simulate <경로> [--until D…] [--from D…] [--amount N] [--rounds N] [--init "묶음키=N;…"] |
| 32 | dbtool.mjs:303 | 명령 simulate | 사용 오류 | (전달) x.error |
| 33 | dbtool.mjs:335 | table | 사용 오류 | 초안 패치에 why 가 없음 |
| 34 | dbtool.mjs:359 | table | 사용 오류 | 관문 거부 — 패치를 저장하지 않음 |
| 35 | dbtool.mjs:371 | table | 사용 오류 | 사용법: augment plan [--write] \| fetch [--refetch] \| build [--sync] [--out patch.json] \| apply [--sync] \| apply <초안 patch.json> |
| 36 | dbtool.mjs:378 | 명령 grade | 사용 오류 | (전달) target.error |
| 37 | dbtool.mjs:386 | 명령 grade | 사용 오류 | 등급 '${min}' — ${REL.ORDER.join(' \| ')} |
| 38 | dbtool.mjs:393 | 명령 origin | 사용 오류 | 사용법: origin <시나리오.json> [--target <상태\|경로>] · origin --all |
| 39 | dbtool.mjs:397 | 명령 origin | 사용 오류 | 대상 없음 — --target 을 주거나 ${rel(SUBJECTS)} 에 등록 |
| 40 | dbtool.mjs:398 | 명령 origin | 사용 오류 | (전달) tg.error |
| 41 | dbtool.mjs:399 | 명령 origin | 사용 오류 | (전달) r.error |
| 42 | dbtool.mjs:400 | 명령 origin | 사용 오류 | (전달) v.error |
| 43 | dbtool.mjs:415 | 명령 assume | 사용 오류 | 사용법: assume uses <A…> |
| 44 | dbtool.mjs:416 | 명령 assume | 사용 오류 | (전달) u.error |
| 45 | dbtool.mjs:425 | 명령 assume | 사용 오류 | 사용법: assume [uses <A…> \| add <기록.json\|.jsonl>] — 기록 칸: |
| 46 | dbtool.mjs:437 | 명령 dictionary | 사용 오류 | 사용법: dictionary [add <항목.json\|.jsonl>] — 항목 칸: |
| 47 | dbtool.mjs:447 | 명령 register | 사용 오류 | 사용법: register <시나리오.json> |
| 48 | dbtool.mjs:450 | 명령 register | 사용 오류 | 등록 거부: 인라인 가상 숫자 ${inl.length}개 (${inl.slice(0, 3).map((x) => |
| 49 | dbtool.mjs:451 | 명령 register | 사용 오류 | (전달) e.message |
| 50 | dbtool.mjs:481 | one | 오류 반환 | (전달) tg.error |
| 51 | dbtool.mjs:484 | one | 오류 반환 | (전달) r.error |
| 52 | dbtool.mjs:496 | one | 사용 오류 | 사용법: evidence --recheck <보고서.md...> |
| 53 | dbtool.mjs:509 | one | 사용 오류 | 사용법: evidence <시나리오.json> [--target <경로\|상태 번호·이름>] [--report 파일.md] · evidence --all [--report 파일.md] |
| 54 | dbtool.mjs:511 | one | 사용 오류 | 대상 없음 — --target 을 주거나 ${rel(SUBJECTS)} 에 '${basename(args[0])}' 를 등록한다 |
| 55 | dbtool.mjs:513 | one | 사용 오류 | (전달) x.error |
| 56 | dbtool.mjs:522 | 명령 verify-collection | 사용 오류 | 사용법: verify-collection <핸드오프.jsonl> [--json] |
| 57 | dbtool.mjs:525 | 명령 verify-collection | 사용 오류 | ${i + 1}행이 JSON 이 아님: ${e.message} |
| 58 | dbtool.mjs:546 | 명령 verify-run | 사용 오류 | 사용법: verify-run <transcript.output> --handoff <핸드오프.jsonl> (실행 기록은 harness 가 찍은 것·내 세션 서브에이전트 한정·형식 미보장) |
| 59 | dbtool.mjs:564 | 명령 log | 사용 오류 | 검사를 통과하지 못한 db 는 기원으로 봉인하지 않는다 |
| 60 | dbtool.mjs:571 | 명령 log | 사용 오류 | 기원 체크포인트가 없음 — node dbtool.mjs log --genesis |
| 61 | dbtool.mjs:610 | 명령 trend | 사용 오류 | (전달) target.error |
| 62 | dbtool.mjs:621 | 명령 trend | 사용 오류 | 기록할 추세 도장이 없음 — 먼저 `trend --fetch` 로 더 새 원본을 받을 것 |
| 63 | dbtool.mjs:629 | 명령 compare | 사용 오류 | 사용법: compare --state <세포 상태> --scenario A.json [--scenario-b B.json] [--patch p.json] [--hours h] [--ref-hours h] |
| 64 | dbtool.mjs:631 | 명령 compare | 사용 오류 | (전달) x.error |
| 65 | dbtool.mjs:633 | 명령 compare | 사용 오류 | 패치가 관문을 통과하지 못함 |
| 66 | dbtool.mjs:641 | 명령 fate | 사용 오류 | 사용법: fate <세포 상태 번호\|이름> --scenario s.json [--t 시간(h)] [--no-commitment] [--brief] [--report 파일.md] [--numerics 시간(h), 0 이면 끔] |
| 67 | dbtool.mjs:643 | 명령 fate | 사용 오류 | (전달) x.error |
| 68 | dbtool.mjs:651 | 명령 fate | 사용 오류 | --ensemble 에는 시나리오 stochastic { seed } 가 필요함 (seed 는 실행 전에 — 입력 해시) |
| 69 | dbtool.mjs:653 | 명령 fate | 사용 오류 | (전달) raws.error |
| 70 | dbtool.mjs:668 | 명령 fate | 사용 오류 | (전달) r.error |
| 71 | dbtool.mjs:689 | 명령 observe | 사용 오류 | 사용법: observe <O…\|관찰.json> --state <세포 상태> --scenario A.json [--scenario-b B.json] [--n 50] |
| 72 | dbtool.mjs:691 | 명령 observe | 사용 오류 | 관찰 기록 ${args[0]} 없음 |
| 73 | dbtool.mjs:694 | 명령 observe | 사용 오류 | 관찰 계약 위반 (schemas/obs/observation.schema.json):\n |
| 74 | dbtool.mjs:698 | 명령 observe | 사용 오류 | 관찰 의미 검사 실패:\n |
| 75 | dbtool.mjs:701 | 명령 observe | 사용 오류 | (전달) x.error |
| 76 | dbtool.mjs:706 | 명령 observe | 사용 오류 | 오류: |
| 77 | dbtool.mjs:721 | 명령 prompt | 사용 오류 | 명령: status \| validate \| merge \| map \| audit \| vocab \| context \| mechanism \| simulate \| fate \| observe \| compare \| augment \| attest \| trend \| resolution \| audit-run \| pattern \| limitations \| textbook \| |

## 4. 코드 제약 — 공유(dictionary.js)

| # | 파일:줄 | 함수·명령 | 종류 | 메시지 |
|---|---|---|---|---|
| 1 | dictionary.js:37 | loadOverlay | 예외 | 사전 overlay 의 register 어휘 밖: '${o.register}' (${o.key}) |
| 2 | dictionary.js:50 | resolve | 오류 반환 | 사전 미등록 통제 토큰: '${key}' |
| 3 | dictionary.js:51 | resolve | 오류 반환 | 모호한 통제 토큰 '${key}' — register 를 지정한다 (${hits.map((r) => qid(r, key)).join(' · ')}) |
| 4 | dictionary.js:58 | entry | 오류 반환 | (전달) r.error |
| 5 | dictionary.js:60 | entry | 오류 반환 | 사전 overlay 없음 (en 라벨·의미 미등록): '${qid(r.reg, r.key)}' |
| 6 | dictionary.js:80 | renderToken | 예외 | (전달) e.error |
| 7 | dictionary.js:82 | renderToken | 예외 | audience 어휘 밖: '${opt.audience}' (both·en·ko) |
| 8 | dictionary.js:99 | parseToken | 예외 | 모호한 렌더 문자열: '${str}' — 두 토큰이 같은 라벨을 쓴다 |
| 9 | dictionary.js:101 | parseToken | 예외 | 사전에 없는 렌더 문자열: '${str}' |
| 10 | dictionary.js:110 | labeler | 예외 | audience 어휘 밖: '${aud}' (both·en·ko) |
| 11 | dictionary.js:129 | translate | 예외 | (전달) e.error |

## 5. 코드 제약 — 행정(엔진)

| # | 파일:줄 | 함수·명령 | 종류 | 메시지 |
|---|---|---|---|---|
| 1 | engine/devs_scheduler.js:27 | commit | 예외 | 경계 거래 실패 ${r.status}: ${(r.errors \|\| []).join('; ')} |
| 2 | engine/devs_scheduler.js:29 | commit | 예외 | 경계 거래 재시도 한도 초과 |
| 3 | engine/devs_scheduler.js:61 | run | 예외 | 시간 역행 ${tNext} < ${t} — 롤백 금지 위반 |
| 4 | engine/devs_scheduler.js:65 | run | 예외 | 보수적 동기화 위반: ${m.id} 가 safeTime ${safeTime(m)} 를 넘어 ${t} 로 |
| 5 | engine/devs_scheduler.js:76 | run | 예외 | 모델 시각 역행 |
| 6 | engine/devs_scheduler.js:207 | fire | 예외 | 노드 반응 거래 실패: ${res.status} ${res.errors \|\| ''} |
| 7 | engine/fate_rust.js:54 | open | 예외 | Rust 엔진 IR 덩어리 거부 (${rc}) |
| 8 | engine/fate_rust.js:82 | copy | 예외 | 탐침 스냅숏 ${k} 없음 |
| 9 | engine/fno_surrogate.js:37 | makeDCT | 예외 | 격자 n=${n} 은 2 의 거듭제곱이어야 함 (FFT) |
| 10 | engine/fno_surrogate.js:123 | createSurrogate | 예외 | 대리 모델은 기준 경계 box 에서만 학습·추론 (그 밖은 FV) |
| 11 | engine/fno_surrogate.js:124 | createSurrogate | 예외 | 반응 쌍이 겹침 — 대리 모델 분포 밖 (FV) |
| 12 | engine/fno_surrogate.js:170 | integrate | 예외 | 학습되지 않은 대리 모델 |
| 13 | engine/fv_solver.js:21 | templateMask | 예외 | 기준 경계가 아님: '${template}' — ${HMSE.TEMPLATES.join(' \| ')} |
| 14 | engine/fv_solver.js:43 | idx | 예외 | 활성 칸 없음 |
| 15 | engine/fv_solver.js:166 | reconcile | 예외 | FV 반응 지역 거래 실패: ${res.status} ${res.errors \|\| ''} |
| 16 | engine/hmse.js:47 | makeLedgerState | 예외 | 원장 ${id}/${k}: 음이 아닌 정수가 아님 (${v}) |
| 17 | engine/hmse.js:78 | sum | 예외 | 보존 위반 — 엔진 오류 |
| 18 | engine/p5_dynamic_gate.js:62 | createGate | 예외 | 관문 설정: K_down < K_up, M ≥ 1, W ≥ 0 |
| 19 | engine/probe_pool.js:42 | dispatch | 예외 | 탐침 워커 ${i} 응답 없음 |
| 20 | engine/probe_pool.js:44 | dispatch | 예외 | 탐침 워커 ${i} 실패${P.errors[i] ? ': ' + P.errors[i] : ''} |

## 6. 코드 제약 — 사법

| # | 파일:줄 | 함수·명령 | 종류 | 메시지 |
|---|---|---|---|---|
| 1 | judicial/assumption_audit.js:25 | verifyChain | 오류 | 사건 ${i + 1}: seq ${e.seq} — 빠지거나 끼운 사건 |
| 2 | judicial/assumption_audit.js:26 | verifyChain | 오류 | 사건 ${i + 1}: prev 가 직전 root 와 다름 — 사슬이 끊김 |
| 3 | judicial/assumption_audit.js:27 | verifyChain | 오류 | 사건 ${i + 1} (${e.id}): root 재계산 불일치 — 내용이 바뀜 |
| 4 | judicial/assumption_audit.js:28 | verifyChain | 오류 | 사건 ${i + 1}: 번호 '${e.id}' 가 A + 여섯 자리가 아님 |
| 5 | judicial/assumption_audit.js:29 | verifyChain | 오류 | 사건 ${i + 1}: 번호 ${e.id} 가 순번 ${e.seq} 과 맞지 않음 — 번호는 서기가 순번으로 붙인다 |
| 6 | judicial/assumption_audit.js:30 | verifyChain | 오류 | 사건 ${i + 1}: 번호 ${e.id} 가 두 번 — 번호는 재사용하지 않는다 |
| 7 | judicial/assumption_audit.js:42 | E | 오류 | (전달) |
| 8 | judicial/assumption_audit.js:43 | E | 오류 | (전달) |
| 9 | judicial/assumption_audit.js:44 | E | 오류 | (전달) |
| 10 | judicial/assumption_audit.js:45 | E | 오류 | (전달) |
| 11 | judicial/assumption_audit.js:46 | E | 오류 | (전달) |
| 12 | judicial/assumption_audit.js:47 | E | 오류 | (전달) |
| 13 | judicial/assumption_audit.js:48 | E | 오류 | (전달) |
| 14 | judicial/assumption_audit.js:49 | E | 오류 | (전달) |
| 15 | judicial/assumption_audit.js:50 | E | 오류 | (전달) |
| 16 | judicial/assumption_audit.js:51 | E | 오류 | (전달) |
| 17 | judicial/assumption_audit.js:52 | E | 오류 | (전달) |
| 18 | judicial/assumption_audit.js:53 | E | 오류 | (전달) |
| 19 | judicial/assumption_audit.js:56 | E | 오류 | (전달) |
| 20 | judicial/assumption_audit.js:57 | E | 오류 | (전달) |
| 21 | judicial/assumption_audit.js:59 | E | 오류 | (전달) |
| 22 | judicial/assumption_audit.js:62 | E | 오류 | (전달) |
| 23 | judicial/assumption_audit.js:67 | E | 오류 | (전달) |
| 24 | judicial/assumption_audit.js:68 | E | 오류 | (전달) |
| 25 | judicial/assumption_audit.js:70 | E | 오류 | (전달) |
| 26 | judicial/assumption_audit.js:71 | E | 오류 | (전달) |
| 27 | judicial/assumption_audit.js:80 | checkProposals | 오류 | 기록 ${i + 1}: 객체가 아님 |
| 28 | judicial/assumption_audit.js:81 | checkProposals | 오류 | 기록 ${i + 1}: 번호·순번은 서기가 붙인다 — id·seq 를 적지 않는다 |
| 29 | judicial/assumption_audit.js:82 | checkProposals | 오류 | 기록 ${i + 1}: migrated 는 변환(012)만 |
| 30 | judicial/assumption_audit.js:83 | checkProposals | 오류 | (전달) ...checkRecord(p, db, ix, before) |
| 31 | judicial/assumption_audit.js:94 | resolveAll | 오류 | ${file}: ${l} |
| 32 | judicial/assumption_audit.js:106 | audit | 오류 | (전달) ...checkRecord(e, db, ix, events.slice(0, i), { chain: true }) |
| 33 | judicial/assumption_audit.js:108 | audit | 오류 | (전달) ...rs.errors |
| 34 | judicial/assumption_audit.js:116 | uses | 오류 반환 | 가정 ${id} 이 원장에 없음 |
| 35 | judicial/collection_audit.js:33 | push | 문제 | (전달) { sev, msg } |
| 36 | judicial/collection_audit.js:36 | push | 판정 | (전달) , `outcome 미선언/어휘 밖 (${OUTCOMES.join('\|')})` |
| 37 | judicial/collection_audit.js:37 | push | 판정 | (전달) , `use 어휘 밖 (${USES.join('\|')})` |
| 38 | judicial/collection_audit.js:45 | push | 판정 | (전달) , 'read_value 인데 값(value) 없음' |
| 39 | judicial/collection_audit.js:46 | push | 판정 | (전달) , '값을 주장하는데 출처(source.db+id) 없음 — 근거 없는 값' |
| 40 | judicial/collection_audit.js:47 | push | 판정 | (전달) , '값을 주장하는데 원문 인용(quote) 없음' |
| 41 | judicial/collection_audit.js:51 | push | 판정 | (전달) , `DOI 형식 아님: ${src.id}` |
| 42 | judicial/collection_audit.js:52 | push | 판정 | (전달) , `PMID 형식 아님: ${src.id}` |
| 43 | judicial/collection_audit.js:55 | push | 판정 | (전달) , `출처가 해석되지 않음 — 존재하지 않는 ${src.db}: ${src.id} (가짜/오기)` |
| 44 | judicial/collection_audit.js:56 | push | 판정 | (전달) , `출처 해석 확인 실패(네트워크·접근) — 통합가 재확인: ${src.db} ${src.id}` |
| 45 | judicial/collection_audit.js:59 | push | 판정 | (전달) , `${e.outcome} 인데 값이 있음 — 상태와 내용 불일치` |
| 46 | judicial/collection_audit.js:68 | push | 판정 | (전달) , '값 후보 — 1차 출처 재확인 필요(통합가)' |
| 47 | judicial/collection_audit.js:73 | push | 판정 | (전달) , 'reused 인데 재사용 대상(reuse.ref) 없음' |
| 48 | judicial/collection_audit.js:76 | push | 판정 | (전달) , `재사용 대상 ${ref} 가 db 에 없음 — 무효 재사용` |
| 49 | judicial/collection_audit.js:77 | push | 판정 | (전달) , `재사용 대상 ${ref} 는 철회됨 — 무효 재사용` |
| 50 | judicial/collection_audit.js:165 | crossCheckRun | 문제 | (전달) { sev: 'review', msg: '값/읽음 주장인데 실행 기록에 WebFetch·WebSearch·Read 가 0 — 실제 열람 여부 확인 필요(꼼수 #2 |
| 51 | judicial/collection_audit.js:166 | crossCheckRun | 문제 | (전달) { sev: 'review', msg: '실행 기록에 도구 호출 0 — transcript 가 비었거나 형식 미인식(검증 불가, 통과로 치지 않음)' } |
| 52 | judicial/collection_audit.js:180 | verifyFetchLog | 오류 | 사건 ${i + 1}: seq ${e.seq} — 빠지거나 끼운 사건 |
| 53 | judicial/collection_audit.js:181 | verifyFetchLog | 오류 | 사건 ${i + 1}: prev 가 직전 root 와 다름 — 사슬이 끊김 |
| 54 | judicial/collection_audit.js:182 | verifyFetchLog | 오류 | 사건 ${i + 1}: root 재계산 불일치 — 기록이 바뀜 |
| 55 | judicial/collection_audit.js:188 | verifyFetchLog | 오류 | ${file}: 받기 기록에 있는데 파일이 없음 (사건 ${e.seq}) |
| 56 | judicial/collection_audit.js:189 | verifyFetchLog | 오류 | ${file}: 받은 뒤 내용이 바뀜 — 기록 ${e.sha256.slice(0, 12)}… · 지금 ${now.slice(0, 12)}… (사건 ${e.seq}) |
| 57 | judicial/compare.js:16 | variant | 오류 반환 | (전달) raw.error |
| 58 | judicial/compare.js:28 | compare | 오류 반환 | (전달) a.error \|\| b.error |
| 59 | judicial/contract.js:55 | dimensionsFate | 오류 | (전달) |
| 60 | judicial/contract.js:56 | rowLen | 오류 | (전달) |
| 61 | judicial/contract.js:58 | rowLen | 오류 | (전달) |
| 62 | judicial/contract.js:59 | rowLen | 오류 | (전달) |
| 63 | judicial/contract.js:60 | rowLen | 오류 | (전달) |
| 64 | judicial/contract.js:61 | rowLen | 오류 | (전달) |
| 65 | judicial/contract.js:62 | rowLen | 오류 | (전달) |
| 66 | judicial/contract.js:63 | rowLen | 오류 | (전달) |
| 67 | judicial/contract.js:64 | rowLen | 오류 | (전달) |
| 68 | judicial/derivative.js:46 | c | 예외 | 알 수 없는 명령 ${op} |
| 69 | judicial/derivative.js:59 | kinOf | 규약 위반 | saturation_K ${Ksat} ≠ 시나리오 ${sc.saturation_K} |
| 70 | judicial/derivative.js:60 | kinOf | 규약 위반 | saturation_K ${Ksat} ≠ 기본값 ${M.SAT_K} |
| 71 | judicial/derivative.js:63 | kinOf | 규약 위반 | 묶음 ${ir.keys[i]} 의 부피·완충 값이 시나리오와 다름 |
| 72 | judicial/derivative.js:64 | kinOf | 규약 위반 | 묶음 ${ir.keys[i]} 의 접은 상수 cinv ${s.cinv} ≠ 1/(N_A·V) ${sp.cinv[i]} |
| 73 | judicial/derivative.js:68 | kinOf | 규약 위반 | ${R.ref}: db 에 없음 |
| 74 | judicial/derivative.js:70 | same | 규약 위반 | ${R.ref}: IR 속도 상수 ≠ db·시나리오 |
| 75 | judicial/derivative.js:72 | same | 규약 위반 | ${R.ref}: IR 교란 배율 ${R.scale} ≠ 시나리오 rule_scale ${sc0} |
| 76 | judicial/derivative.js:74 | same | 규약 위반 | ${R.ref}: 시나리오가 뺀(exclude_rules) 규칙이 IR 에 있음 |
| 77 | judicial/derivative.js:75 | same | 규약 위반 | ${R.ref}: 소비 묶음이 IR 에 없음 |
| 78 | judicial/derivative.js:76 | same | 규약 위반 | ${R.ref}: 분해 대상 묶음이 소유자의 것이 아님 |
| 79 | judicial/derivative.js:80 | same | 규약 위반 | ${R.ref}: 단계 ${R.step} 가 이 규칙을 쓰지 않음 |
| 80 | judicial/derivative.js:89 | eq | 규약 위반 | ${R.ref} (${R.step} ${R.dir}): IR 화학량 ≠ 단계의 입력·출력 |
| 81 | judicial/derivative.js:92 | eq | 규약 위반 | ${R.ref}: 가역 결합의 방향 표시가 없음 |
| 82 | judicial/derivative.js:94 | eq | 규약 위반 | ${R.ref}: 공급·분해·단계 규칙이 아님 |
| 83 | judicial/derivative.js:141 | checkLU | 규약 위반 | 희소 LU 순서가 순열이 아님 |
| 84 | judicial/derivative.js:148 | rowOf | 규약 위반 | 희소 LU 행 ${r} 의 대각 위치가 틀림 |
| 85 | judicial/derivative.js:149 | rowOf | 규약 위반 | 희소 LU 행 ${r} 의 열이 정렬되지 않음 |
| 86 | judicial/derivative.js:151 | rowOf | 규약 위반 | 희소 LU 채움 누락: 행 ${r} 이 행 ${k} 의 열 ${c} 를 받아야 함 |
| 87 | judicial/derivative.js:157 | rowOf | 규약 위반 | 값 위치 목록 길이 틀림 (규칙 ${k} ${kind} ${di}) |
| 88 | judicial/derivative.js:158 | rowOf | 규약 위반 | 값 위치 틀림 (규칙 ${k} ${kind} ${di} 열 ${c}) |
| 89 | judicial/derivative.js:160 | rowOf | 규약 위반 | 대각 값 위치 틀림 (규칙 ${k}) |
| 90 | judicial/derivative.js:170 | verifyIR | 규약 위반 | IR 해시가 내용과 다름 — 컴파일 뒤 바뀜(변조) |
| 91 | judicial/derivative.js:172 | verifyIR | 규약 위반 | (전달) ...problems |
| 92 | judicial/derivative.js:219 | verifyIR | 규약 위반 | (전달) m |
| 93 | judicial/dictionary_audit.js:21 | verifyChain | 오류 | 사건 ${i + 1}: seq ${e.seq} — 빠지거나 끼운 사건 |
| 94 | judicial/dictionary_audit.js:22 | verifyChain | 오류 | 사건 ${i + 1}: prev 가 직전 root 와 다름 — 사슬이 끊김 |
| 95 | judicial/dictionary_audit.js:23 | verifyChain | 오류 | 사건 ${i + 1} (${qid(e)}): root 재계산 불일치 — 내용이 바뀜 |
| 96 | judicial/dictionary_audit.js:34 | current | 오류 | ${qid(e)} 사건 ${e.seq}: 이미 있는 토큰인데 revises 가 현재 root 가 아님 |
| 97 | judicial/dictionary_audit.js:35 | current | 오류 | ${qid(e)} 사건 ${e.seq}: 없는 토큰을 revises |
| 98 | judicial/dictionary_audit.js:60 | checkProposals | 오류 | ${at}: 객체가 아님 |
| 99 | judicial/dictionary_audit.js:62 | checkProposals | 오류 | ${at}: 받지 않는 칸 ${extra.join(', ')} (사슬 칸 seq·at·prev·root 는 서기가 붙인다) |
| 100 | judicial/dictionary_audit.js:63 | checkProposals | 오류 | ${at}: register 어휘 밖 '${p.register}' — ${D.registers.join(' \| ')} |
| 101 | judicial/dictionary_audit.js:64 | checkProposals | 오류 | ${at}: vocab.${p.register} 에 없는 키 '${p.key}' — 토큰은 vocab 이 먼저 정한다 |
| 102 | judicial/dictionary_audit.js:65 | checkProposals | 오류 | ${at}: label_en·meaning_en 은 비지 않은 문자열 |
| 103 | judicial/dictionary_audit.js:66 | checkProposals | 오류 | ${at}: since 는 YYYY-MM-DD |
| 104 | judicial/dictionary_audit.js:69 | checkProposals | 오류 | ${at}: xref 는 null 또는 vocab.xrefs 형식의 { db, id } — 외부 대조가 확인된 것만 |
| 105 | judicial/dictionary_audit.js:72 | checkProposals | 오류 | ${at}: 같은 묶음에 같은 토큰이 둘 |
| 106 | judicial/dictionary_audit.js:74 | checkProposals | 오류 | ${at}: 이미 있는 토큰 — 고치려면 revises 에 현재 root (${String(had.root).slice(0, 12)}…) |
| 107 | judicial/dictionary_audit.js:75 | checkProposals | 오류 | ${at}: 없는 토큰을 revises |
| 108 | judicial/dictionary_audit.js:78 | checkProposals | 오류 | (전달) ...ambiguity(next) |
| 109 | judicial/evidence_report.js:59 | evidenceReport | 오류 반환 | (전달) tg.error |
| 110 | judicial/evidence_report.js:72 | kinUse | 오류 반환 | (전달) A.error |
| 111 | judicial/fate_audit.js:39 | judgeFate | 오류 반환 | 원자료 계약 위반 ${contract.violations.length}건 — 판정하지 않음 (${contract.violations.slice(0, 3).map((x) => |
| 112 | judicial/fate_audit.js:221 | contextVerdict | 규약 위반 | 맥락 role '${role}' — cause \| requirement \| baseline |
| 113 | judicial/fate_audit.js:222 | contextVerdict | 규약 위반 | 맥락 상태 '${state}' 가 이 실행의 상태 집합에 없음 |
| 114 | judicial/fate_audit.js:225 | contextVerdict | 규약 위반 | ${role} 의 대상은 시작 상태가 아니라 전이의 목표여야 함 |
| 115 | judicial/fate_audit.js:226 | contextVerdict | 규약 위반 | '${state}' 로 가는 전이의 신호가 일정에서 켜지지 않음 — ${role === 'cause' ? '원인' : '필수성'}을 보이는 실행이 아님 |
| 116 | judicial/fate_audit.js:229 | contextVerdict | 규약 위반 | baseline 의 대상은 시작 상태여야 함 |
| 117 | judicial/fate_audit.js:230 | contextVerdict | 규약 위반 | 전이 신호가 켜짐 (${driven.map((t) => t.to).join(', ')}) — 일반 상황이 아님 |
| 118 | judicial/identity.js:111 | parseUniProt | 예외 | FASTA 머리줄 형식을 알 수 없음 |
| 119 | judicial/identity.js:123 | parseUniProt | 예외 | ${path.basename(file)}: UniProt JSON·FASTA·평문 어느 것도 아님 |
| 120 | judicial/identity.js:152 | firstStr | 예외 | ChEBI 번호(CHEBI:…)를 찾을 수 없음 |
| 121 | judicial/identity.js:178 | parseRhea | 예외 | Rhea TSV 머리글이 아님 |
| 122 | judicial/judicial.js:58 | checkEvidence | 오류 | 근거 수준 '${e.level}' 은(는) 어휘에 없음 (${Object.keys(V.evidenceLevels).join(', ')}) |
| 123 | judicial/judicial.js:61 | checkEvidence | 오류 | 근거 수준 curated 는 출처(source: DOI 또는 PMID)가 필요함 — 출처가 없으면 asserted, 추론이면 abstracted |
| 124 | judicial/judicial.js:62 | checkEvidence | 오류 | 출처 ${x.db}:${x.id} 에 citation("저자, 연도")이 없음 |
| 125 | judicial/judicial.js:64 | checkEvidence | 오류 | ${lv.label} 은(는) 무엇에서 추론했는지(basis)를 적어야 함 |
| 126 | judicial/judicial.js:65 | checkEvidence | 오류 | 근거 수준 computed 는 도구(tool)가 필요함 |
| 127 | judicial/judicial.js:66 | checkEvidence | 오류 | 근거 수준 predicted 는 0–1 의 confidence 가 필요함 |
| 128 | judicial/judicial.js:67 | checkEvidence | 오류 | confidence 는 predicted 에만 |
| 129 | judicial/judicial.js:69 | checkEvidence | 오류 | 출처 종류 '${x.db}' — 문헌 출처는 DOI 또는 PMID |
| 130 | judicial/judicial.js:70 | checkEvidence | 오류 | 출처 ${x.db} '${x.id}' 형식 틀림 |
| 131 | judicial/judicial.js:74 | checkContext | 오류 | 종 '${c.species}' 은(는) 종 어휘에 없음 |
| 132 | judicial/judicial.js:75 | checkContext | 오류 | 조직 '${c.tissue}' 은(는) 어휘에 없음 |
| 133 | judicial/judicial.js:76 | checkContext | 오류 | 세포 '${c.cell}' 은(는) 어휘에 없음 |
| 134 | judicial/judicial.js:77 | checkContext | 오류 | 위치 '${c.location}' 은(는) 위치 어휘에 없음 |
| 135 | judicial/judicial.js:83 | E | 오류 | 형식 버전 ${db._version} — 버전 ${VERSION} 로 변환해야 함 (migrations/ 참고) |
| 136 | judicial/judicial.js:87 | E | 오류 | ${p} 다음 번호(${db.meta.next[p]})가 이미 쓰인 번호(${max}) 이하 — 번호 재사용 위험 |
| 137 | judicial/judicial.js:91 | E | 오류 | 이름 충돌 '${hits.map((h) => h.name).join("' ≈ '")}' — 같은 개념이면 합치고, 다른 개념이면 이름을 구별해야 함 |
| 138 | judicial/judicial.js:93 | E | 오류 | 외부 ID ${k.slice(k.indexOf(':') + 1)} 가 여러 정의항에 붙음 — 같은 실체면 합칠 것 |
| 139 | judicial/judicial.js:94 | E | 오류 | 구조 지문 ${k} 가 여러 정의항에 붙음 — 같은 실체면 합칠 것 |
| 140 | judicial/judicial.js:97 | E | 오류 | 개념 번호는 'T' + 숫자 6자리 |
| 141 | judicial/judicial.js:98 | E | 오류 | 한국어 이름(names.ko) 없음 |
| 142 | judicial/judicial.js:99 | E | 오류 | 이름 '${n}' 에 # @ \| / 를 쓸 수 없음 |
| 143 | judicial/judicial.js:100 | E | 오류 | 정의항(뜻)이 없는 개념 |
| 144 | judicial/judicial.js:108 | dfs | 오류 | 위계 순환: |
| 145 | judicial/judicial.js:133 | checkAttestations | 경고 | status 'verified' 항목을 증명 등록부와 대조하지 않음 — node dbtool.mjs validate (attestations/registry.json) 로 확인할 것 |
| 146 | judicial/judicial.js:135 | checkAttestations | 오류 | status 'verified' 인데 사법부 증명(attestations/registry.json 의 유효한 도장)이 없음 — 데이터는 스스로 verified 를 선언할 수 없음 (augment apply 가 판결과 함께 도장을 발급) |
| 147 | judicial/judicial.js:146 | checkBound | 오류 | ${what}: 값 ${si} 은(는) 정수여야 함 |
| 148 | judicial/judicial.js:148 | checkBound | 오류 | ${what}: 값 ${si} 이(가) 물리적 하한 ${B.min} ${B.exclusiveMin ? '초과' : '이상'} 이 아님 — ${B.why} |
| 149 | judicial/judicial.js:149 | checkBound | 오류 | ${what}: 값 ${si} 이(가) 물리적 상한 ${B.max} 를 넘음 — ${B.why} (단위를 잘못 적었는지 확인) |
| 150 | judicial/judicial.js:184 | validateValues | 오류 | 같은 열쇠(대상·속성·맥락)의 현재 값이 둘 — ${keys.get(k)} 과 겹침 (새 값은 supersedes 로) |
| 151 | judicial/judicial.js:188 | validateValues | 오류 | (전달) isRule ? '대상 규칙이 없거나 법칙 모양(kinetic_law)이 없음' : '대상 정의항이 없음' |
| 152 | judicial/judicial.js:189 | validateValues | 오류 | 속성 '${v.property}' 이 ${isRule ? '속도 칸' : '관찰 속성 어휘'}에 없음 |
| 153 | judicial/judicial.js:190 | validateValues | 오류 | 분포 '${v.value.dist}' — ${VALUE_DISTS.join(' \| ')} |
| 154 | judicial/judicial.js:191 | validateValues | 오류 | 분포에 값(mean 또는 level)이 없음 |
| 155 | judicial/judicial.js:192 | validateValues | 오류 | ${v.value.dist} 분포에 sd ≥ 0 이 없음 |
| 156 | judicial/judicial.js:193 | validateValues | 오류 | 구간 low ≤ high 가 아님 |
| 157 | judicial/judicial.js:194 | validateValues | 오류 | 유도 방식 '${v.derivation}' — ${DERIVATIONS.join(' \| ')} |
| 158 | judicial/judicial.js:195 | validateValues | 오류 | 기록 시각(recorded_at)이 없음 — 값은 언제 들어왔는지가 데이터다 (두 시간) |
| 159 | judicial/judicial.js:196 | validateValues | 오류 | 근거 관찰 ${o} 이 없음 |
| 160 | judicial/judicial.js:199 | validateValues | 오류 | 대체 대상 ${v.supersedes} 이 없음 |
| 161 | judicial/judicial.js:201 | validateValues | 오류 | 대체 대상 ${v.supersedes} 의 대상·속성이 다름 |
| 162 | judicial/judicial.js:202 | validateValues | 오류 | 대체 대상 ${v.supersedes} 이 이 기록보다 뒤 — 대체는 앞선 기록만 |
| 163 | judicial/judicial.js:203 | validateValues | 오류 | ${v.supersedes} 을 ${superseders.get(v.supersedes)} 도 대체함 — 갈래 이력 |
| 164 | judicial/judicial.js:214 | valueImmutability | 판정 | 값 기록은 지울 수 없음 — 바뀌면 새 기록이 대체(supersedes), 틀리면 retracted |
| 165 | judicial/judicial.js:216 | strip | 판정 | 값 기록은 바꿀 수 없음 — 새 값은 새 기록(supersedes)으로 |
| 166 | judicial/judicial.js:217 | strip | 판정 | 값의 철회 표시는 바꾸거나 지울 수 없음 |
| 167 | judicial/judicial.js:228 | validateMoved | 오류 | 이동할 수 있는 번호는 개념(T)·정의항(D)·단계(S) |
| 168 | judicial/judicial.js:229 | validateMoved | 오류 | 이동된 번호가 아직 표에 있음 — 번호는 재사용하지 않음 |
| 169 | judicial/judicial.js:230 | validateMoved | 오류 | 이동 종류 '${m.kind}' — ${Object.keys(V.moveKinds).join(' \| ')} |
| 170 | judicial/judicial.js:231 | validateMoved | 오류 | ${m.kind} 대상 수 ${m.to.length} — ${mk.label} |
| 171 | judicial/judicial.js:232 | validateMoved | 오류 | 이동 대상 '${t}' 은(는) 같은 종류의 지금 있는 번호가 아님 (사슬이면 마지막 번호를) |
| 172 | judicial/judicial.js:233 | validateMoved | 오류 | 이동 사유(why)가 없음 |
| 173 | judicial/judicial.js:234 | validateMoved | 오류 | 이동 시각(at)이 없음 |
| 174 | judicial/judicial.js:238 | validateMoved | 오류 | 이동된 번호를 가리킴 (${mv[x].kind}) — ${mv[x].to.join('·')} 를 쓸 것 |
| 175 | judicial/judicial.js:243 | checkContextKeys | 오류 | 조건(condition)은 정의항 번호 목록 — 문장 '${String(c.condition).slice(0, 40)}' 은(는) scope(맥락 설명)·note 로 (맥락 열쇠에 자유 문장을 넣지 않음) |
| 176 | judicial/judicial.js:245 | checkContextKeys | 오류 | 조건 ${d} 은(는) 이동된 번호 — ${db.moved[d].to.join('·')} 를 쓸 것 |
| 177 | judicial/judicial.js:246 | checkContextKeys | 오류 | 조건 '${d}' 은(는) 있는 정의항 번호가 아님 |
| 178 | judicial/judicial.js:249 | checkContextKeys | 오류 | 온도(K)는 0 보다 커야 함 |
| 179 | judicial/judicial.js:250 | checkContextKeys | 오류 | pH 는 0–14 |
| 180 | judicial/judicial.js:257 | checkObsTarget | 오류 | '${t}' 은(는) 세포 상태(cell_state) 정의항이 아님 |
| 181 | judicial/judicial.js:261 | validateQualitative | 오류 | 읽을 거리(readout.kind) '${rk}' — ${Object.keys(V.observables).filter((k) => V.observables[k].qualitative).join(' \| ')} (부피·속도 상수는 정성으로 말하지 않음) |
| 182 | judicial/judicial.js:264 | validateQualitative | 오류 | 순서 기대(expect.order)는 서로 다른 대상 둘 이상 |
| 183 | judicial/judicial.js:265 | validateQualitative | 오류 | 순서 기대에서는 readout.target 을 쓰지 않음 — 대상은 expect.order 에 |
| 184 | judicial/judicial.js:269 | validateQualitative | 오류 | 기대(expect) '${ex}' — ${Object.keys(V.qualitativeExpectations).filter((k) => k !== 'order').join(' \| ')} \| { order: [대상, …] } |
| 185 | judicial/judicial.js:270 | validateQualitative | 오류 | 기대 '${ex}' 는 대조군과의 비교 — 교란(perturbation)이 필요함 |
| 186 | judicial/judicial.js:271 | validateQualitative | 오류 | 읽을 거리 대상(readout.target)이 없음 |
| 187 | judicial/judicial.js:277 | validateQualitative | 오류 | 교란 종류 '${p.type}' — ${Object.keys(PERTURB_TARGET).join(' \| ')} |
| 188 | judicial/judicial.js:278 | validateQualitative | 오류 | knockout 대상 '${p.target}' 은(는) 있는 정의항 번호가 아님 |
| 189 | judicial/judicial.js:280 | validateQualitative | 오류 | ${p.type} 대상 규칙 '${p.target}' 없음 — D…/rule/키 |
| 190 | judicial/judicial.js:281 | validateQualitative | 오류 | inhibit 에는 Ki_M > 0, dose_M ≥ 0 (몰 농도) — 모르면 block |
| 191 | judicial/judicial.js:282 | validateQualitative | 오류 | clamp 에는 conc_M ≥ 0 (몰 농도) |
| 192 | judicial/judicial.js:284 | validateQualitative | 오류 | 반복 수(replicates)는 1 이상의 정수 |
| 193 | judicial/judicial.js:286 | validateQualitative | 오류 | 원문 구절(quote)이 없음 — 정성 관찰은 논문의 해당 문장을 그대로 적는다 |
| 194 | judicial/judicial.js:288 | validateQualitative | 오류 | 출처(provenance.source.db)는 ${V.qualitativeSources.join(' \| ')} — 교과서·추론은 정성 관찰이 될 수 없음 (한계·메모로) |
| 195 | judicial/judicial.js:289 | validateQualitative | 오류 | 출처 ${src.db} 식별자 '${src.id}' 형식 틀림 |
| 196 | judicial/judicial.js:290 | validateQualitative | 오류 | 정성 관찰 근거는 curated(문헌) — 지금 ${o.evidence.level} |
| 197 | judicial/judicial.js:291 | validateQualitative | 오류 | 정성 관찰의 용도는 validation — 상수 추정에 쓰지 않음 |
| 198 | judicial/judicial.js:295 | validateObservation | 오류 | 관찰 번호는 'O' + 숫자 6자리 |
| 199 | judicial/judicial.js:296 | validateObservation | 오류 | 합성(hypothetical) 관찰은 데이터베이스에 넣지 않음 — examples/observations/ 에만 (실측값을 지어내지 않음) |
| 200 | judicial/judicial.js:297 | validateObservation | 오류 | 근거 시각(evidence_at) '${o.evidence_at}' — YYYY · YYYY-MM · YYYY-MM-DD |
| 201 | judicial/judicial.js:298 | validateObservation | 오류 | 기록 시각(recorded_at) '${o.recorded_at}' 을 읽을 수 없음 |
| 202 | judicial/judicial.js:301 | validateObservation | 오류 | 조건에 종(condition.species)이 없음 |
| 203 | judicial/judicial.js:304 | validateObservation | 오류 | 시각(time_s)은 0 이상 |
| 204 | judicial/judicial.js:306 | validateObservation | 오류 | 철회(retracted)에 사유(note) 없음 |
| 205 | judicial/judicial.js:310 | validateObservation | 오류 | 측정량 '${ob.kind}' — ${Object.keys(V.observables).join(' \| ')} |
| 206 | judicial/judicial.js:312 | validateObservation | 오류 | 측정 대상 '${ob.target}' 은(는) 세포 상태(cell_state) 정의항이 아님 |
| 207 | judicial/judicial.js:313 | validateObservation | 오류 | 측정 대상 위치 '${ob.target}' 은(는) 위치 어휘에 없음 |
| 208 | judicial/judicial.js:316 | validateObservation | 오류 | 측정 대상 규칙 '${ob.target}' 없음 — D…/rule/키 |
| 209 | judicial/judicial.js:317 | validateObservation | 오류 | 속도 상수 칸 '${ob.param \|\| ''}' — ${KIN_FIELDS.filter((f) => f !== 'order').join(', ')} |
| 210 | judicial/judicial.js:319 | validateObservation | 오류 | ratio 측정에는 분모 묶음(observable.denominator)이 필요함 |
| 211 | judicial/judicial.js:320 | validateObservation | 오류 | fraction_above 측정에는 게이팅 문턱(threshold ≥ 0, 분자 수)이 필요함 |
| 212 | judicial/judicial.js:323 | validateObservation | 오류 | 진행량을 읽을 규칙 '${ob.target}' 없음 — D…/rule/키 |
| 213 | judicial/judicial.js:325 | validateObservation | 오류 | dose_slope 측정에는 용량 축 observable.dose { target: 묶음, values: [분자 수…] } 이 필요함 |
| 214 | judicial/judicial.js:329 | validateObservation | 오류 | dose.values 는 서로 다른 0 이상의 분자 수 두 개 이상 (기울기를 정할 수 있게) |
| 215 | judicial/judicial.js:332 | validateObservation | 오류 | 값(value)이 수가 아님 |
| 216 | judicial/judicial.js:334 | validateObservation | 오류 | 단위 '${o.unit}' — 이 측정량의 SI 정준 단위는 '${want}' (값은 SI 로 환산해 저장) |
| 217 | judicial/judicial.js:335 | validateObservation | 오류 | 이 측정량의 단위를 정할 수 없음 (대상 규칙의 kinetics.order 필요) |
| 218 | judicial/judicial.js:336 | validateObservation | 오류 | 비율은 0–1 |
| 219 | judicial/judicial.js:337 | validateObservation | 오류 | 분자 수·농도·시각·비는 0 이상 |
| 220 | judicial/judicial.js:340 | validateObservation | 오류 | 불확도 유형 '${u.kind}' — ${Object.keys(V.uncertaintyKinds).join(' \| ')} (값만 있는 관찰은 받지 않음) |
| 221 | judicial/judicial.js:341 | validateObservation | 오류 | 잡음 모형 '${u.model}' — ${Object.keys(V.noiseModels).join(' \| ')} |
| 222 | judicial/judicial.js:343 | validateObservation | 오류 | 잡음 모형 ${u.model} 은(는) ${nm.observables.join('·')} 에만 |
| 223 | judicial/judicial.js:344 | validateObservation | 오류 | 잡음 모형 ${u.model} 은(는) 값 > 0 에만 |
| 224 | judicial/judicial.js:346 | validateObservation | 오류 | 불확도 크기(uncertainty.sd)가 0 이상의 수가 아님 |
| 225 | judicial/judicial.js:347 | validateObservation | 오류 | 반복 수(replicates)는 1 이상의 정수 |
| 226 | judicial/judicial.js:348 | validateObservation | 오류 | ${k} 는 0 이상 |
| 227 | judicial/judicial.js:350 | validateObservation | 오류 | 조건에 종(condition.species)이 없음 |
| 228 | judicial/judicial.js:353 | validateObservation | 오류 | 시각(time_s)은 0 이상 |
| 229 | judicial/judicial.js:357 | validateObservation | 오류 | 보정 종류 '${cal.kind}' — ${Object.keys(V.calibrationKinds).join(' \| ')} |
| 230 | judicial/judicial.js:359 | validateObservation | 오류 | 보정 ${cal.kind} 에는 읽은 값(raw)이 필요함 — 값은 보정으로 다시 계산되어야 함 |
| 231 | judicial/judicial.js:360 | validateObservation | 오류 | 선형 보정에는 a·b |
| 232 | judicial/judicial.js:361 | validateObservation | 오류 | 보정 표는 raw 오름차순 [raw, 값] 점 두 개 이상 |
| 233 | judicial/judicial.js:364 | validateObservation | 오류 | 읽은 값 ${o.raw} 이(가) 보정 범위 밖 |
| 234 | judicial/judicial.js:365 | validateObservation | 오류 | 값 ${o.value} 이(가) 보정 결과 ${v} 와 다름 — 관찰 값은 보정으로 다시 계산되어야 함 |
| 235 | judicial/judicial.js:369 | validateObservation | 오류 | 원본 sha256 형식 틀림 (16진 64자리) |
| 236 | judicial/judicial.js:370 | validateObservation | 오류 | 용도 '${o.use}' — estimation \| validation (추정에 쓴 관찰을 검증에 쓰지 않음) |
| 237 | judicial/judicial.js:372 | validateObservation | 오류 | 관찰 근거는 curated(문헌) \| computed(포트 변환 도구) — 지금 ${o.evidence.level} |
| 238 | judicial/judicial.js:373 | validateObservation | 오류 | 철회(retracted)에 사유(note) 없음 |
| 239 | judicial/judicial.js:380 | checkKineticsFrom | 오류 | 관찰 기록 없음 |
| 240 | judicial/judicial.js:381 | checkKineticsFrom | 오류 | 정성 관찰은 수치의 근거가 될 수 없음 |
| 241 | judicial/judicial.js:382 | checkKineticsFrom | 오류 | 용도가 ${o.use} 인 관찰은 상수 추정에 쓸 수 없음 — 검증용 관찰은 판정에만 (순환 판정 방지) |
| 242 | judicial/judicial.js:383 | checkKineticsFrom | 오류 | 철회된 관찰을 참조함 |
| 243 | judicial/judicial.js:385 | checkKineticsFrom | 오류 | 관찰이 이 규칙(${ref})의 '${f.param}' 을(를) 잰 것이 아님 |
| 244 | judicial/judicial.js:386 | checkKineticsFrom | 오류 | '${f.param}' 값 ${k[f.param]} 이(가) 관찰 값 ${o.value} 와 다름 — 실측 상수는 관찰에서 그대로 |
| 245 | judicial/judicial.js:390 | checkKineticsFrom | 오류 | 종이 다름 — 상수의 맥락은 '${kc.species}', 관찰은 '${oc.species}' (다른 종의 측정을 이 종의 상수로 적지 않는다) |
| 246 | judicial/judicial.js:392 | checkKineticsFrom | 오류 | 위치가 다름 — 상수의 맥락은 '${kc.location}', 관찰은 '${oc.location}' |
| 247 | judicial/judicial.js:394 | checkKineticsFrom | 오류 | 묶은 상수(lumped)에는 원 관찰 참조(from)가 필요함 — 기전을 세분할 때 다시 재지 않고 다시 계산하려고 |
| 248 | judicial/judicial.js:398 | checkKineticsFrom | 오류 | 문헌(curated) 속도 상수 ${miss.join('·')} 에 관찰 기록(kinetics.from)이 없음 — 실측값은 관찰 기록으로 넣고 상수는 그것을 참조 (observation-port.md §1) |
| 249 | judicial/judicial.js:404 | checkSenseObsFrom | 오류 | 관찰 기록 없음 |
| 250 | judicial/judicial.js:405 | checkSenseObsFrom | 오류 | 정성 관찰은 수치의 근거가 될 수 없음 |
| 251 | judicial/judicial.js:406 | checkSenseObsFrom | 오류 | '${b.property}' 에는 대응하는 측정량이 없어 관찰 기록을 가리킬 수 없음 |
| 252 | judicial/judicial.js:407 | checkSenseObsFrom | 오류 | 철회된 관찰을 참조함 |
| 253 | judicial/judicial.js:408 | checkSenseObsFrom | 오류 | 용도가 ${o.use} 인 관찰은 모델 값의 출처로 쓸 수 없음 — 검증용 관찰은 판정에만 (순환 판정 방지) |
| 254 | judicial/judicial.js:409 | checkSenseObsFrom | 오류 | 관찰이 '${P.observable}' 을(를) 잰 것이 아님 (측정량 ${o.observable.kind}) |
| 255 | judicial/judicial.js:414 | checkSenseObsFrom | 오류 | 관찰 대상 '${o.observable.target}' 이(가) 이 정의항(${sid})의 묶음이 아님 |
| 256 | judicial/judicial.js:416 | checkSenseObsFrom | 오류 | 관찰 대상 위치 '${o.observable.target}' 이(가) obs 의 위치 '${b.context.location}' 와 다름 |
| 257 | judicial/judicial.js:419 | checkSenseObsFrom | 오류 | 값 ${b.value} ${b.unit} (= ${si} 정준) 이(가) 관찰 값 ${o.value} ${o.unit} 와 다름 — 파생값은 관찰에서 그대로 환산한다 |
| 258 | judicial/judicial.js:422 | checkSenseObsFrom | 오류 | 종이 다름 — obs 는 '${b.context.species}', 관찰은 '${c.species}' (다른 종의 측정을 이 종의 값으로 적지 않는다) |
| 259 | judicial/judicial.js:424 | checkSenseObsFrom | 오류 | 세포 유형이 다름 — obs 는 '${b.context.cell}', 관찰은 '${c.cell}' |
| 260 | judicial/judicial.js:426 | checkSenseObsFrom | 오류 | 위치가 다름 — obs 는 '${b.context.location}', 관찰은 '${c.location}' |
| 261 | judicial/judicial.js:430 | validateLimitation | 오류 | 한계 번호는 'L' + 숫자 6자리 |
| 262 | judicial/judicial.js:432 | validateLimitation | 오류 | 대상 '${l.target}' 형식 — D…, D…/site/키, D…/rule/키, S… |
| 263 | judicial/judicial.js:433 | validateLimitation | 오류 | 대상 '${t.base}' 없음 |
| 264 | judicial/judicial.js:434 | validateLimitation | 오류 | 대상 부위 '${l.target}' 없음 |
| 265 | judicial/judicial.js:435 | validateLimitation | 오류 | 대상 규칙 '${l.target}' 없음 |
| 266 | judicial/judicial.js:436 | validateLimitation | 오류 | 한계 종류 '${l.type}' — ${Object.keys(V.gapTypes).join(' \| ')} |
| 267 | judicial/judicial.js:437 | validateLimitation | 오류 | 요구 사항(requirement.text) 없음 — 무엇이 있어야 해결되는지 |
| 268 | judicial/judicial.js:438 | validateLimitation | 오류 | 해결 경로(requirement.needs) 없음 — 필요한 데이터를 하나 이상 |
| 269 | judicial/judicial.js:441 | validateLimitation | 오류 | 증상 키 '${k}' — 소문자·숫자·밑줄(단위는 키 끝에, 예: wall_time_s) |
| 270 | judicial/judicial.js:442 | validateLimitation | 오류 | 증상 '${k}' 의 값은 유한한 수 — 설명은 requirement.text 에 |
| 271 | judicial/judicial.js:446 | validateLimitation | 오류 | 막힌 하류 '${ref}' 형식 — D…, D…/site/키, D…/rule/키, S… |
| 272 | judicial/judicial.js:447 | validateLimitation | 오류 | 막힌 하류 '${ref}' 없음 |
| 273 | judicial/judicial.js:448 | validateLimitation | 오류 | 막힌 하류 '${ref}' 가 대상 자신 |
| 274 | judicial/judicial.js:451 | validateLimitation | 오류 | 재검토 조건 '${l.resolution_trigger}' — ${Object.keys(V.resolutionTriggers).join(' \| ')} |
| 275 | judicial/judicial.js:452 | validateLimitation | 오류 | 재검토 조건 '${l.resolution_trigger}' 은 한계의 등록 시각 at(ISO) 이 있어야 비교할 수 있음 |
| 276 | judicial/judicial.js:454 | validateLimitation | 오류 | 금지된 우회(prohibited_bypasses)는 비지 않은 문장 목록 |
| 277 | judicial/judicial.js:458 | validateLimitation | 오류 | 관찰 속성 '${n.property}' 은(는) 어휘에 없음 |
| 278 | judicial/judicial.js:459 | validateLimitation | 오류 | 관찰을 받을 정의항 '${n.on \|\| ''}' 없음 |
| 279 | judicial/judicial.js:460 | validateLimitation | 오류 | 세포 '${n.cell}' 은(는) 어휘에 없음 |
| 280 | judicial/judicial.js:461 | validateLimitation | 오류 | 위치 '${n.location}' 은(는) 어휘에 없음 |
| 281 | judicial/judicial.js:464 | validateLimitation | 오류 | 잔기를 채울 부위 '${n.site \|\| ''}' 없음 — D…/site/키 |
| 282 | judicial/judicial.js:466 | validateLimitation | 오류 | 외부 ID 종류 '${n.db}' 없음 |
| 283 | judicial/judicial.js:468 | validateLimitation | 오류 | 외부 ID 를 받을 정의항 '${n.on \|\| ''}' 없음 |
| 284 | judicial/judicial.js:469 | validateLimitation | 오류 | kind '${d.kind}' 에는 ${n.db} ID 를 붙일 수 없어 이 경로로는 해결되지 않음 |
| 285 | judicial/judicial.js:472 | validateLimitation | 오류 | 속도 상수를 받을 규칙 '${n.rule \|\| ''}' 없음 — D…/rule/키 |
| 286 | judicial/judicial.js:473 | validateLimitation | 오류 | 필요한 속도 상수(params) 없음 |
| 287 | judicial/judicial.js:474 | validateLimitation | 오류 | 속도 상수 '${f}' — ${KIN_FIELDS.join(', ')} |
| 288 | judicial/judicial.js:475 | validateLimitation | 오류 | manual 해결 경로에 설명(text) 없음 |
| 289 | judicial/judicial.js:476 | validateLimitation | 오류 | 해결 경로 종류 '${n.kind}' — obs \| residue \| xref \| kinetics \| manual |
| 290 | judicial/judicial.js:478 | validateLimitation | 오류 | resolution 에 해결 설명(note) 없음 |
| 291 | judicial/judicial.js:483 | validateSense | 오류 | 정의항 번호는 'D' + 숫자 6자리 |
| 292 | judicial/judicial.js:484 | validateSense | 오류 | 소속 개념 '${d.term}' 없음 |
| 293 | judicial/judicial.js:485 | validateSense | 오류 | 뜻 번호(n) 없음 |
| 294 | judicial/judicial.js:486 | validateSense | 오류 | 같은 개념 안에 뜻 번호 ${d.n} 이 겹침 |
| 295 | judicial/judicial.js:487 | validateSense | 오류 | kind '${d.kind}' 은(는) 어휘 목록에 없음 |
| 296 | judicial/judicial.js:489 | validateSense | 오류 | kind '${d.kind}' 는 기준 종(reference_species)이 필요함 (기본 ${V.defaultReferenceSpecies}) |
| 297 | judicial/judicial.js:490 | validateSense | 오류 | kind '${d.kind}' 는 종과 무관 — reference_species 를 두지 않음 |
| 298 | judicial/judicial.js:491 | validateSense | 오류 | 기준 종 '${d.reference_species}' 은(는) 종 어휘에 없음 |
| 299 | judicial/judicial.js:496 | validateSense | 오류 | 외부 ID 종류 '${x.db}' 없음 |
| 300 | judicial/judicial.js:497 | validateSense | 오류 | ${x.db} ID '${x.id}' 형식이 틀림 |
| 301 | judicial/judicial.js:498 | validateSense | 오류 | kind '${d.kind}' 에는 ${x.db} ID 를 붙일 수 없음 (허용: ${K.xref.allowed.join(', ') \|\| '없음'}) |
| 302 | judicial/judicial.js:499 | validateSense | 오류 | 외부 ID 상태 '${x.status}' — ${V.xrefStatus.join(' \| ')} |
| 303 | judicial/judicial.js:500 | validateSense | 오류 | 외부 ID 역할 '${x.role}' — ${Object.keys(V.xrefRoles).join(' \| ')} |
| 304 | judicial/judicial.js:501 | validateSense | 오류 | 외부 ID ${x.db}:${x.id} 가 두 번 |
| 305 | judicial/judicial.js:513 | validateSense | 오류 | ${dbName} ID 가 ${list.length}개인데 역할(role)이 없는 것이 있음 — ${Object.keys(V.xrefRoles).join(' \| ')} 로 규약을 선언할 것 |
| 306 | judicial/judicial.js:514 | validateSense | 오류 | ${dbName} ID 의 역할이 겹침 (${roles.join(', ')}) |
| 307 | judicial/judicial.js:515 | validateSense | 오류 | ${dbName} ID 가 여러 개면 엔진이 읽을 physiological(pH 7.3 우세 종)을 하나 정해야 함 |
| 308 | judicial/judicial.js:517 | validateSense | 오류 | kind '${d.kind}' 는 셀 수 있는 분자 — 분류(class) 항목 ${dbName}:${x.id} 을 번호로 쓸 수 없음 (화학식이 없어 수지 대조가 건너뛰어진다). pH 7.3 우세 종을 physiological 로 적을 것 |
| 309 | judicial/judicial.js:518 | validateSense | 경고 | ${dbName}:${list[0].id} 이 중성 모체만 적혀 있음 — 반응 참여자(physiological)를 함께 적는 것이 규약 |
| 310 | judicial/judicial.js:520 | validateSense | 오류 | kind '${d.kind}' 는 ${req} ID 가 필요함 — 확실한 ID 를 모르면 unmapped 에 사유를 적을 것 (추측 금지) |
| 311 | judicial/judicial.js:523 | validateSense | 오류 | 지문 방식 '${f.scheme}' 없음 |
| 312 | judicial/judicial.js:525 | validateSense | 오류 | ${f.scheme} 지문 '${f.value}' 형식이 틀림 |
| 313 | judicial/judicial.js:526 | validateSense | 오류 | kind '${d.kind}' 에는 ${f.scheme} 지문을 붙일 수 없음 |
| 314 | judicial/judicial.js:528 | validateSense | 오류 | 지문 상태 '${f.status}' |
| 315 | judicial/judicial.js:533 | validateSense | 오류 | 층 '${d.tier}' 은(는) 어휘에 없음 (T1 \| T2) |
| 316 | judicial/judicial.js:534 | validateSense | 오류 | T3(공간 영역)은 영역의 동적 상태 — 정의항의 기본 층은 T1 \| T2 |
| 317 | judicial/judicial.js:535 | validateSense | 오류 | 층(tier)은 분자 종류 정의항만 |
| 318 | judicial/judicial.js:536 | validateSense | 오류 | kind '${d.kind}' 는 부위 상태를 가진 행위자 — T2 |
| 319 | judicial/judicial.js:537 | validateSense | 오류 | T1(연속 장) 분자는 부위 상태를 갖지 않음 — 부위가 있으면 T2 |
| 320 | judicial/judicial.js:538 | validateSense | 오류 | 분자 종류는 기본 층(tier: T1 \| T2)이 필요함 (형식 v8) |
| 321 | judicial/judicial.js:542 | validateSense | 오류 | 막 위상은 분자 종류만 가질 수 있음 |
| 322 | judicial/judicial.js:543 | validateSense | 오류 | 막 결합 방식 '${m.association}' 은(는) 어휘에 없음 |
| 323 | judicial/judicial.js:545 | validateSense | 오류 | 막 결합 분자는 막(2D 위치)을 membrane.location 으로 가져야 함 |
| 324 | judicial/judicial.js:546 | validateSense | 오류 | ${vlabel('associations', m.association)} 분자는 붙어 있는 막 면(membrane.side)이 필요함 |
| 325 | judicial/judicial.js:548 | validateSense | 오류 | 막 이동 경로의 '${l}' 은(는) 막(2D) 위치가 아님 |
| 326 | judicial/judicial.js:549 | validateSense | 오류 | 수용성 분자에는 membrane.location/side 를 두지 않음 |
| 327 | judicial/judicial.js:553 | validateSense | 오류 | 구성 요소(components)는 kind complex 만 가질 수 있음 (현재 ${d.kind}) |
| 328 | judicial/judicial.js:556 | validateSense | 오류 | 구성 요소 '${c.ref}' 없음 |
| 329 | judicial/judicial.js:557 | validateSense | 오류 | 구성 요소 '${L(c.ref)}' 는 분자 종류가 아님 |
| 330 | judicial/judicial.js:558 | validateSense | 오류 | 자기 자신을 구성 요소로 가질 수 없음 |
| 331 | judicial/judicial.js:559 | validateSense | 오류 | 구성 요소 개수 틀림 |
| 332 | judicial/judicial.js:561 | validateSense | 경고 | 복합체인데 구성 요소(components)가 없음 — 구조 계층을 채울 것 |
| 333 | judicial/judicial.js:563 | validateSense | 오류 | 설명(desc)이 하나도 없음 |
| 334 | judicial/judicial.js:566 | validateSense | 오류 | 정의 문장(text) 없음 |
| 335 | judicial/judicial.js:567 | validateSense | 오류 | field '${ds.field}' 은(는) 어휘 목록에 없음 |
| 336 | judicial/judicial.js:568 | validateSense | 오류 | 맥락 범위(context.scope) 없음 |
| 337 | judicial/judicial.js:571 | validateSense | 오류 | genus '${ds.genus}' 는 이 설명의 is_a 연결 대상이어야 함 |
| 338 | judicial/judicial.js:574 | validateSense | 오류 | 알 수 없는 관계 '${l.rel}' |
| 339 | judicial/judicial.js:575 | validateSense | 오류 | 자기 자신을 가리킴 |
| 340 | judicial/judicial.js:577 | validateSense | 오류 | 대상 '${l.to}' 가 정의항 번호가 아니거나 없음 |
| 341 | judicial/judicial.js:580 | validateSense | 오류 | ${l.rel}: kind '${d.kind}' → '${tg.kind}'(${L(l.to)}) 는 허용되지 않음 |
| 342 | judicial/judicial.js:581 | validateSense | 오류 | 근거 구절 '${l.span}' 이 정의 문장에 없음 |
| 343 | judicial/judicial.js:582 | validateSense | 경고 | (→${L(l.to)}) 근거 구절(span) 없음 |
| 344 | judicial/judicial.js:587 | validateSense | 오류 | 부위(site)는 분자 종류만 가질 수 있음 |
| 345 | judicial/judicial.js:591 | validateSense | 오류 | 부위 키는 영문 소문자·숫자·_ (예: reg_phos) |
| 346 | judicial/judicial.js:592 | validateSense | 오류 | 부위 종류 '${s.type}' 은(는) 어휘에 없음 |
| 347 | judicial/judicial.js:593 | validateSense | 오류 | 허용 특징(features)이 없음 |
| 348 | judicial/judicial.js:594 | validateSense | 오류 | 특징 '${f}' 은(는) 특징 어휘에 없음 |
| 349 | judicial/judicial.js:596 | validateSense | 오류 | 잔기 번호의 종 '${t}' 은(는) 종 어휘에 없음 |
| 350 | judicial/judicial.js:597 | validateSense | 오류 | 잔기 '${r}' 형식 틀림 (예: Ser14) |
| 351 | judicial/judicial.js:601 | validateSense | 오류 | 기준 종(${ref}) 잔기 번호가 없음 — 모르면 residue_unknown: true 로 명시(지어내지 않음) |
| 352 | judicial/judicial.js:604 | validateSense | 오류 | 막 면 '${s.face}' 은(는) 어휘에 없음 |
| 353 | judicial/judicial.js:605 | validateSense | 오류 | 막 면(face)은 막 결합 분자의 부위에만 |
| 354 | judicial/judicial.js:606 | validateSense | 오류 | ${vlabel('locations', d.membrane.location)}에는 '${s.face}' 면이 없음 |
| 355 | judicial/judicial.js:608 | validateSense | 오류 | 부위가 있는 구성 요소 '${s.on}' 는 이 복합체의 구성 요소가 아님 |
| 356 | judicial/judicial.js:609 | validateSense | 오류 | 리간드 '${s.ligand}' 없음 |
| 357 | judicial/judicial.js:611 | validateSense | 오류 | ligands: 특징 '${f}' 는 이 부위의 특징이 아님 |
| 358 | judicial/judicial.js:612 | validateSense | 오류 | ligands: 리간드 '${g}' 없음 |
| 359 | judicial/judicial.js:614 | validateSense | 오류 | 종 조건 '${t}' 은(는) 종 어휘에 없음 |
| 360 | judicial/judicial.js:616 | validateSense | 오류 | 구조 참조는 PDB ID 여야 함 ('${s.structure.db}:${s.structure.id}') |
| 361 | judicial/judicial.js:617 | validateSense | 오류 | 해상도 일관성: 부위의 구조 ${s.structure.id} 가 정의항의 PDB 외부 ID 에 없음 — 정의항 xrefs 에도 같은 구조를 둘 것 |
| 362 | judicial/judicial.js:624 | validateSense | 오류 | 규칙 id 는 영문 소문자·숫자·_ |
| 363 | judicial/judicial.js:625 | validateSense | 오류 | 규칙 id 중복 |
| 364 | judicial/judicial.js:627 | validateSense | 오류 | 규칙 이름(label) 없음 |
| 365 | judicial/judicial.js:628 | validateSense | 오류 | 규칙은 분자 종류 정의항만 가질 수 있음 (경로·과정·원리는 공급 규칙 supply 만) |
| 366 | judicial/judicial.js:629 | validateSense | 오류 | (전달) r.type === 'modulation' ? `조절 규칙의 속도 법칙은 hill (지금 ${r.kinetics.law})` : 'hill 법칙은 조절 규칙(mo |
| 367 | judicial/judicial.js:631 | validateSense | 오류 | 종 조건 '${t}' 은(는) 종 어휘에 없음 |
| 368 | judicial/judicial.js:632 | validateSense | 오류 | (전달) m |
| 369 | judicial/judicial.js:637 | validateSense | 오류 | 활성 '${r.activity}' 은(는) 어휘에 없음 |
| 370 | judicial/judicial.js:639 | validateSense | 오류 | 조건의 부위 '${s}' 가 이 정의항에 없음 |
| 371 | judicial/judicial.js:640 | validateSense | 오류 | 부위 '${s}' 는 특징 '${f}' 를 가질 수 없음 |
| 372 | judicial/judicial.js:644 | validateSense | 오류 | 규칙 종류 '${r.type}' — ${Object.keys(V.ruleTypes).join(' \| ')} |
| 373 | judicial/judicial.js:646 | validateSense | 오류 | 변화 종류 '${r.action}' 은(는) 어휘에 없음 |
| 374 | judicial/judicial.js:647 | validateSense | 오류 | 효과 종류 '${e.type}' — ${EFFECT_TYPES.join(' \| ')} |
| 375 | judicial/judicial.js:648 | validateSense | 오류 | 변화 종류 '${r.action}' 에는 효과 '${e.type}' 를 쓸 수 없음 (허용: ${A.effects.join(', ')}) |
| 376 | judicial/judicial.js:649 | validateSense | 오류 | 행위 부위 '${r.via_site}' 가 이 정의항에 없음 |
| 377 | judicial/judicial.js:650 | validateSense | 오류 | 행위 구성 요소 '${r.via_component}' 는 구성 요소가 아님 |
| 378 | judicial/judicial.js:651 | validateSense | 경고 | agent 가 아닌 규칙에 via_site 가 있음 |
| 379 | judicial/judicial.js:652 | validateSense | 오류 | 위치 조건 '${l}' 은(는) 위치 어휘에 없음 |
| 380 | judicial/judicial.js:654 | validateSense | 오류 | 조절자 '${g.ref}' 없음 |
| 381 | judicial/judicial.js:655 | validateSense | 오류 | 조절 효과 '${g.effect}' 은(는) 어휘에 없음 |
| 382 | judicial/judicial.js:657 | validateSense | 오류 | 보조 기질 '${x}' 없음 |
| 383 | judicial/judicial.js:658 | need | 오류 | ${what} '${ref}' 없음 |
| 384 | judicial/judicial.js:663 | need | 오류 | 대상 '${L(e.target \|\| id)}' 에 부위 '${e.site}' 가 없음 |
| 385 | judicial/judicial.js:664 | need | 오류 | 부위 '${e.site}' 는 특징 '${f}' 를 가질 수 없음 |
| 386 | judicial/judicial.js:665 | need | 오류 | 한 부위에는 특징이 하나 — add/remove 는 각각 하나까지 |
| 387 | judicial/judicial.js:666 | need | 오류 | modify 효과에 add/remove 가 없음 |
| 388 | judicial/judicial.js:667 | need | 오류 | '${r.action}' 은(는) 특징 '${A.adds}' 를 추가해야 함 |
| 389 | judicial/judicial.js:668 | need | 오류 | '${r.action}' 은(는) 특징 '${A.removes}' 를 제거해야 함 |
| 390 | judicial/judicial.js:669 | need | 오류 | 부위 '${e.site}' 의 리간드(${L(s.ligand)})와 결합 상대가 다름 |
| 391 | judicial/judicial.js:672 | need | 오류 | convert 효과는 consumes 와 produces 가 필요함 |
| 392 | judicial/judicial.js:676 | need | 오류 | '${L(e.complex \|\| id)}' 는 구성 요소가 정의되지 않은 복합체 |
| 393 | judicial/judicial.js:680 | need | 오류 | partner_site 의 구성 요소는 복합체의 구성 요소여야 함 |
| 394 | judicial/judicial.js:681 | need | 오류 | partner_site 에 부위(sites)가 없음 |
| 395 | judicial/judicial.js:682 | need | 오류 | 구성 요소 '${L(e.partner_site.component)}' 에 'bound' 를 받는 부위 '${ps}' 가 없음 |
| 396 | judicial/judicial.js:686 | need | 오류 | 수송 효과는 위치 어휘의 from/to 가 필요함 |
| 397 | judicial/judicial.js:690 | need | 오류 | 넘겨줄 부위 from_site '${e.from_site \|\| ''}' 가 이 정의항에 없거나 'bound' 를 받지 않음 |
| 398 | judicial/judicial.js:691 | need | 오류 | from_site '${e.from_site}' 의 리간드와 넘기는 상대(partner)가 다름 |
| 399 | judicial/judicial.js:692 | need | 오류 | transfer 효과는 넘기는 리간드(partner)가 필요함 |
| 400 | judicial/judicial.js:694 | need | 오류 | transfer 효과는 받는 대상(target)이 필요함 |
| 401 | judicial/judicial.js:695 | need | 오류 | 대상 '${L(e.target)}' 에 'bound' 를 받는 부위 '${e.site \|\| ''}' 가 없음 |
| 402 | judicial/judicial.js:698 | need | 오류 | 분해할 구성 요소 '${e.component \|\| ''}' 는 '${L(e.complex \|\| id)}' 의 구성 요소가 아님 |
| 403 | judicial/judicial.js:700 | need | 오류 | degrade 효과는 분해 산물(produces)이 필요함 — 질량이 사라지지 않게 |
| 404 | judicial/judicial.js:707 | need | 오류 | 부분 구조 수지가 맞지 않음 — ${bad} (빠진 산물·보조 기질을 정의하고 규칙에 적을 것) |
| 405 | judicial/judicial.js:711 | need | 오류 | 전제 조건의 대상 '${ref}' 없음 |
| 406 | judicial/judicial.js:712 | need | 오류 | 전제 조건의 부위 '${q.site}' 가 '${L(ref)}' 에 없음 |
| 407 | judicial/judicial.js:713 | need | 오류 | 전제 조건: 부위 '${q.site}' 는 특징 '${q.feature}' 를 가질 수 없음 |
| 408 | judicial/judicial.js:718 | need | 오류 | motif '${d.motif}' — 가능한 값: ${Object.keys(MOTIFS).join(', ')} |
| 409 | judicial/judicial.js:719 | need | 오류 | motif(경로에서 찾는 패턴)는 kind process 정의항만 가질 수 있음 |
| 410 | judicial/judicial.js:721 | need | 오류 | 상위 개념(motif)은 한계 등록부를 검토해 addresses(해결하는 한계와 방법) 또는 gap_review(해결하지 않는 이유)를 적어야 함 |
| 411 | judicial/judicial.js:724 | need | 오류 | addresses: 한계 '${a.limitation}' 없음 |
| 412 | judicial/judicial.js:725 | need | 오류 | addresses: 한계 ${a.limitation} 를 어떻게 해결하는지(how) 없음 |
| 413 | judicial/judicial.js:729 | need | 오류 | 원자 수(elements)는 부분 구조(kind structure_feature)만 |
| 414 | judicial/judicial.js:730 | need | 오류 | 원소 기호 '${e}' 형식 틀림 (예: C, N, P, S) |
| 415 | judicial/judicial.js:735 | need | 오류 | 부분 구조(moieties)는 분자 종류만 가질 수 있음 |
| 416 | judicial/judicial.js:736 | need | 오류 | 부분 구조 '${m.ref}' 없음 |
| 417 | judicial/judicial.js:737 | need | 오류 | 부분 구조 '${L(m.ref)}' 는 kind structure_feature 여야 함 |
| 418 | judicial/judicial.js:738 | need | 오류 | 부분 구조 '${m.ref}' 의 개수는 1 이상의 정수 |
| 419 | judicial/judicial.js:743 | need | 오류 | 관찰 속성 '${b.property}' 은(는) 어휘에 없음 |
| 420 | judicial/judicial.js:746 | need | 오류 | '${b.property}' 는 종에 따라 달라짐 — context.species 필수 |
| 421 | judicial/judicial.js:747 | need | 오류 | 값은 숫자여야 함 |
| 422 | judicial/judicial.js:748 | need | 오류 | 단위(unit) 필요 |
| 423 | judicial/judicial.js:749 | need | 오류 | '${b.property}' 의 단위는 SI 정준 ${P.units.join(' \| ')} 만 (지금 '${b.unit}') |
| 424 | judicial/judicial.js:750 | need | 오류 | '${b.property}' 는 위치마다 다름 — context.location 필수 |
| 425 | judicial/judicial.js:751 | need | 오류 | pH 는 0–14 |
| 426 | judicial/judicial.js:752 | need | 오류 | '${b.property}' 는 양수 |
| 427 | judicial/judicial.js:753 | need | 오류 | 값 '${b.value}' 은(는) 위치 어휘에 없음 |
| 428 | judicial/judicial.js:754 | need | 오류 | 값은 ${P.value.join(' \| ')} 중 하나 |
| 429 | judicial/judicial.js:755 | need | 오류 | 외부 ID '${b.value}' 형식 틀림 |
| 430 | judicial/judicial.js:760 | need | 오류 | '${b.property}' 의 단위 '${b.unit}' 은(는) 어휘의 환산표에 없음 — ${Object.keys(V.unitFactors[P.dim] \|\| {}).join(' \| ')} |
| 431 | judicial/judicial.js:764 | need | 오류 | 문헌(curated) '${b.property}' 에 관찰 기록 참조(from)가 없음 — 측정값은 관찰 기록(O…)으로 넣고 정의항 obs 는 그것을 가리킨다 (observation-port.md §1, kinetics.from 과 같은 계약) |
| 432 | judicial/judicial.js:783 | validateSupply | 오류 | 공급 규칙은 생성물(produces)이 필요함 |
| 433 | judicial/judicial.js:784 | validateSupply | 오류 | 소비하는 것이 없는 공급은 계 밖에서 들어오는 것 — source: true 로 명시할 것 |
| 434 | judicial/judicial.js:785 | validateSupply | 오류 | 공급 규칙은 위치(where)가 정확히 하나 (저장소 묶음 = 정의항\|위치) |
| 435 | judicial/judicial.js:788 | memOK | 오류 | 위치 '${l}' 은(는) 위치 어휘에 없음 |
| 436 | judicial/judicial.js:791 | memOK | 오류 | 저장소 분자 '${q.ref}' 없음 |
| 437 | judicial/judicial.js:792 | memOK | 오류 | 저장소 분자 '${L(q.ref)}' 는 분자 종류가 아님 |
| 438 | judicial/judicial.js:793 | memOK | 오류 | '${L(q.ref)}' 의 화학량 n 은 양수 |
| 439 | judicial/judicial.js:795 | memOK | 오류 | 공급 규칙의 속도 법칙은 zero_order \| mass_action (지금 ${r.kinetics.law}) |
| 440 | judicial/judicial.js:797 | memOK | 오류 | saturating 은 소비(consumes)에만 — 생성물 '${L(q.ref)}' |
| 441 | judicial/judicial.js:799 | memOK | 오류 | 모든 소비가 saturating 이면 속도 법칙의 기질이 없음 — 하나 이상은 속도를 정하는 기질로 |
| 442 | judicial/judicial.js:800 | memOK | 오류 | 질량 작용 차수 ${r.kinetics.order} 가 소비 분자 수(${lawN}${r.consumes.some((q) => q.saturating) ? ', saturating 제외' : ''})와 다름 |
| 443 | judicial/judicial.js:801 | memOK | 오류 | 소비하는 것이 없는 공급은 zero_order 로 |
| 444 | judicial/judicial.js:803 | memOK | 오류 | 부분 구조 수지가 맞지 않음 — ${bad} (계 밖에서 들어오는 공급이면 source: true) |
| 445 | judicial/judicial.js:808 | validateDegradation | 오류 | 분해 산물의 운명(fate) '${r.fate}' — ${Object.keys(V.lifecycleFates).join(' \| ')} |
| 446 | judicial/judicial.js:809 | validateDegradation | 오류 | 재활용(recycled)이면 recycle_to 에 돌아갈 구성 단위가 필요함 |
| 447 | judicial/judicial.js:810 | validateDegradation | 오류 | 소실(lost)인데 recycle_to 가 있음 |
| 448 | judicial/judicial.js:813 | validateDegradation | 오류 | 재활용 단위 '${q.ref}' 없음 |
| 449 | judicial/judicial.js:815 | validateDegradation | 오류 | 재활용 단위 '${L(q.ref)}' 의 화학량 n 은 양수 또는 'sequence_length' |
| 450 | judicial/judicial.js:816 | validateDegradation | 오류 | 위치 '${q.location}' 은(는) 위치 어휘에 없음 |
| 451 | judicial/judicial.js:818 | validateDegradation | 오류 | 조건의 부위 '${s}' 가 이 정의항에 없음 |
| 452 | judicial/judicial.js:819 | validateDegradation | 오류 | 위치 조건 '${l}' 은(는) 위치 어휘에 없음 |
| 453 | judicial/judicial.js:825 | validateModulation | 오류 | 조절 대상 '${r.target}' — 'D…/rule/키' 형식의 규칙이어야 함 |
| 454 | judicial/judicial.js:826 | validateModulation | 오류 | 조절 대상 규칙 '${r.target}' 없음 |
| 455 | judicial/judicial.js:827 | validateModulation | 오류 | 조절 대상은 속도가 있는 규칙(supply · transition · degradation) — '${L(t.base)}' 의 '${tr.id}' 는 ${tr.type} |
| 456 | judicial/judicial.js:828 | validateModulation | 오류 | 자기 자신을 조절할 수 없음 |
| 457 | judicial/judicial.js:829 | validateModulation | 오류 | 조절 효과 '${r.effect}' — ${Object.keys(V.effects).join(' \| ')} |
| 458 | judicial/judicial.js:830 | validateModulation | 오류 | 조절자 위치(at) '${r.at}' 은(는) 위치 어휘에 없음 — 조절자 묶음 = 소유자\|at |
| 459 | judicial/judicial.js:831 | validateModulation | 오류 | 조절자 위치 '${vlabel('locations', r.at)}' 는 부피(3D) 구획이어야 함 (농도로 배율을 계산) |
| 460 | judicial/judicial.js:832 | validateModulation | 오류 | 매개 분자(via) '${v}' 없음 |
| 461 | judicial/judicial.js:835 | validateModulation | 오류 | 활성화 조절은 fmax > 1 (최대 배율)이 필요함 |
| 462 | judicial/judicial.js:836 | validateModulation | 오류 | 억제 조절은 0 ≤ fmin < 1 (최소 배율)이 필요함 |
| 463 | judicial/judicial.js:837 | validateModulation | 오류 | 활성화 조절에는 fmin 을 두지 않음 |
| 464 | judicial/judicial.js:838 | validateModulation | 오류 | 억제 조절에는 fmax 를 두지 않음 |
| 465 | judicial/judicial.js:844 | validateCellState | 오류 | 표지 서명·대사 프로그램·기전 프로그램·전이(signature · metabolome · mechanisms · transitions)는 kind cell_state 만 |
| 466 | judicial/judicial.js:845 | validateCellState | 오류 | 세포 상태는 표지 서명(signature)이 필요함 — 어떤 분자가 높고 낮은지로 상태를 정의 |
| 467 | judicial/judicial.js:846 | validateCellState | 오류 | 세포 상태는 분자가 아님 — 규칙·부위·부분 구조·구성 요소를 두지 않음 |
| 468 | judicial/judicial.js:850 | validateCellState | 오류 | 표지 '${m.ref}' 없음 |
| 469 | judicial/judicial.js:851 | validateCellState | 오류 | 표지 '${L(m.ref)}' 의 수준 '${m.level}' — ${Object.keys(V.signatureLevels).join(' \| ')} |
| 470 | judicial/judicial.js:853 | validateCellState | 오류 | 표지 '${L(m.ref)}' 의 위치 '${m.location}' 은(는) 위치 어휘에 없음 |
| 471 | judicial/judicial.js:854 | validateCellState | 오류 | 표지 '${L(m.ref)}' 는 막 '${m.location}' 에 있을 수 없음 — 막 위상(membrane)이 그 막이어야 함 |
| 472 | judicial/judicial.js:855 | validateCellState | 오류 | 표지 '${L(m.ref)}' 는 막 분자 — 부피(3D) 위치 '${m.location}' 에 있을 수 없음 |
| 473 | judicial/judicial.js:856 | validateCellState | 오류 | 표지 '${L(m.ref)}' 가 같은 위치에 두 번 |
| 474 | judicial/judicial.js:860 | validateCellState | 오류 | 대사 프로그램의 규칙 '${m.ref}' 없음 — 'D…/rule/키' |
| 475 | judicial/judicial.js:861 | validateCellState | 오류 | 대사 프로그램은 공급 규칙(supply)만 — '${m.ref}' 는 ${r.type} |
| 476 | judicial/judicial.js:862 | validateCellState | 오류 | 대사 프로그램 '${m.ref}' 의 수준 '${m.level}' — ${Object.keys(V.signatureLevels).join(' \| ')} |
| 477 | judicial/judicial.js:866 | validateCellState | 오류 | 기전 프로그램 '${m.ref}' 없음 |
| 478 | judicial/judicial.js:867 | validateCellState | 오류 | 기전 프로그램 '${L(m.ref)}' 에 속한 단계(part_of)가 없음 |
| 479 | judicial/judicial.js:871 | validateCellState | 오류 | 전이 대상 상태 '${tr.to}' 없음 |
| 480 | judicial/judicial.js:872 | validateCellState | 오류 | 자기 자신으로의 전이 |
| 481 | judicial/judicial.js:873 | validateCellState | 오류 | '${L(tr.to)}' 로의 전이에 신호(signals)가 없음 — 무엇이 분화를 일으키는지 |
| 482 | judicial/judicial.js:874 | validateCellState | 오류 | 신호 '${g}' 없음 |
| 483 | judicial/judicial.js:875 | validateCellState | 오류 | 결정 기준 '${tr.commitment.criterion}' — ${Object.keys(V.commitmentCriteria).join(' \| ')} |
| 484 | judicial/judicial.js:883 | checkBundle | 오류 | (전달) b.error |
| 485 | judicial/judicial.js:884 | checkBundle | 오류 | 묶음 키 '${key}' 는 정렬된 표준 형식이 아님 (${bundleKey(b)}) |
| 486 | judicial/judicial.js:886 | checkBundle | 오류 | 묶음 바탕 '${b.base}' 없음 |
| 487 | judicial/judicial.js:887 | checkBundle | 오류 | '${ix.label(b.base)}'(${d.kind}) 는 기전에 참여할 수 없음 |
| 488 | judicial/judicial.js:889 | checkBundle | 오류 | 위치 '${b.location}' 은(는) 위치 어휘에 없음 |
| 489 | judicial/judicial.js:892 | checkBundle | 오류 | ${ix.label(b.base)} 은(는) 수용성 — 막(2D) 위치 '${L.label}' 에 있을 수 없음 |
| 490 | judicial/judicial.js:893 | checkBundle | 오류 | ${ix.label(b.base)} 은(는) ${vlabel('locations', d.membrane.location)}에 박힌 분자 — '${L.label}' 에 있을 수 없음 |
| 491 | judicial/judicial.js:898 | checkBundle | 오류 | '${ix.label(b.base)}' 에 부위 '${f.site}' 가 없음 |
| 492 | judicial/judicial.js:899 | checkBundle | 오류 | 부위 '${f.site}' 는 특징 '${f.feature}' 를 가질 수 없음 (허용: ${s.features.join(', ')}) |
| 493 | judicial/judicial.js:900 | checkBundle | 오류 | 부위 '${f.site}' 에 특징이 둘 |
| 494 | judicial/judicial.js:909 | validateStep | 오류 | 단계 번호는 'S' + 숫자 6자리 |
| 495 | judicial/judicial.js:911 | validateStep | 오류 | 규칙 '${st.rule}' 없음 — 'D…/rule/키' 로 원천의 전이 규칙을 가리킬 것 |
| 496 | judicial/judicial.js:913 | validateStep | 오류 | 단계는 전이(transition) 규칙만 적용할 수 있음 |
| 497 | judicial/judicial.js:914 | validateStep | 오류 | part_of 없음 — 어느 경로에 속하는지 적어야 함 |
| 498 | judicial/judicial.js:915 | validateStep | 오류 | 소속 경로 '${p}' 없음 |
| 499 | judicial/judicial.js:918 | validateStep | 오류 | ${role} 참여자가 묶음 키가 아님 |
| 500 | judicial/judicial.js:925 | findOne | 오류 | ${what}에 '${L(base)}' 묶음이 ${xs.length}개 (정확히 1개여야 함) |
| 501 | judicial/judicial.js:932 | findOne | 오류 | 규칙 '${rule.label}' 의 행위자 '${L(owner)}' 묶음이 agents 에 없음 |
| 502 | judicial/judicial.js:935 | findOne | 오류 | 행위자 ${ix.bundleLabel(ag.key)} 은(는) 원천 규칙상 비활성 — 이 전이를 일으킬 수 없음 |
| 503 | judicial/judicial.js:938 | findOne | 오류 | 행위자가 없는 규칙인데 agents 가 있음 |
| 504 | judicial/judicial.js:946 | inF | 오류 | 규칙이 바꾸지 않는 부위 '${s}' 가 바뀜 |
| 505 | judicial/judicial.js:948 | inF | 오류 | 입력의 부위 '${e.site}' 는 ${expIn ? |
| 506 | judicial/judicial.js:949 | inF | 오류 | 출력의 부위 '${e.site}' 는 ${expOut ? |
| 507 | judicial/judicial.js:950 | inF | 오류 | 수송이 아닌 단계에서 위치가 바뀜 |
| 508 | judicial/judicial.js:953 | inF | 오류 | 결합 상대 '${L(e.partner)}' 묶음이 입력에 없음 |
| 509 | judicial/judicial.js:954 | inF | 오류 | 결합 상대 '${L(e.partner)}' 는 대상 부위에 흡수되므로 출력에 따로 남지 않음 |
| 510 | judicial/judicial.js:957 | inF | 오류 | 기질 '${L(x)}' 묶음이 입력에 없음 |
| 511 | judicial/judicial.js:958 | inF | 오류 | 생성물 '${L(x)}' 묶음이 출력에 없음 |
| 512 | judicial/judicial.js:968 | inF | 오류 | ${pName}의 구성 요소 '${L(c.ref)}' 개수 ${got} — 복합체 정의상 ${c.n * cx.n}개 |
| 513 | judicial/judicial.js:970 | inF | 오류 | '${L(x.base)}' 는 '${L(C)}' 의 구성 요소가 아님 |
| 514 | judicial/judicial.js:973 | touches | 오류 | 해리·결합 단계에서 위치가 바뀜 |
| 515 | judicial/judicial.js:976 | touches | 오류 | 결합 상대 '${L(e.partner)}' 묶음이 입력에 없음 |
| 516 | judicial/judicial.js:977 | touches | 오류 | 결합 상대 '${L(e.partner)}' 는 구성 요소 '${L(e.partner_site.component)}' 의 부위에 흡수되므로 출력에 따로 남지 않음 |
| 517 | judicial/judicial.js:980 | touches | 오류 | 구성 요소 '${L(e.partner_site.component)}' 의 부위 '${ps}' 가 'bound' 여야 함 (결합 상대가 흡수된 곳) |
| 518 | judicial/judicial.js:987 | touches | 오류 | 수송 규칙은 ${vlabel('locations', e.from)} → ${vlabel('locations', e.to)} (실제 ${vlabel('locations', tin.location)} → ${vlabel('locations', tout.location)}) |
| 519 | judicial/judicial.js:988 | touches | 오류 | 수송 단계에서 특징이 바뀜 |
| 520 | judicial/judicial.js:993 | same | 오류 | ${what}의 규칙이 바꾸지 않는 부위 '${k}' 가 바뀜 |
| 521 | judicial/judicial.js:995 | same | 오류 | 넘겨주는 '${L(owner)}' 입력의 부위 '${e.from_site}' 는 'bound' 여야 함 |
| 522 | judicial/judicial.js:996 | same | 오류 | 넘겨준 뒤 '${L(owner)}' 의 부위 '${e.from_site}' 는 빈 상태여야 함 |
| 523 | judicial/judicial.js:998 | same | 오류 | 수송이 아닌 단계에서 위치가 바뀜 |
| 524 | judicial/judicial.js:1003 | same | 오류 | 받는 '${L(e.target)}' 입력의 부위 '${e.site}' 는 빈 상태여야 함 |
| 525 | judicial/judicial.js:1004 | same | 오류 | 받은 뒤 '${L(e.target)}' 의 부위 '${e.site}' 는 'bound' 여야 함 |
| 526 | judicial/judicial.js:1006 | same | 오류 | 수송이 아닌 단계에서 위치가 바뀜 |
| 527 | judicial/judicial.js:1008 | same | 오류 | 리간드 '${L(e.partner)}' 는 부위 안에서 넘겨지므로 따로 입력·출력에 두지 않음 |
| 528 | judicial/judicial.js:1016 | same | 오류 | (전달) c.ref === e.component ? `분해된 구성 요소 '${L(c.ref)}' 가 출력에 남아 있음` : `출력의 구성 요소 '${L(c.ref)}' 개 |
| 529 | judicial/judicial.js:1018 | same | 오류 | 분해 단계에서 위치가 바뀜 |
| 530 | judicial/judicial.js:1020 | same | 오류 | 분해 산물 '${L(x)}' 묶음이 출력에 없음 |
| 531 | judicial/judicial.js:1025 | same | 오류 | 전제 조건의 대상 '${L(ref)}' 묶음이 입력에 없음 |
| 532 | judicial/judicial.js:1026 | same | 오류 | 전제 조건 불충족: ${ix.bundleLabel(x.key)} 의 부위 '${q.site}' 는 '${vlabel('features', q.feature)}' 여야 함 |
| 533 | judicial/judicial.js:1029 | same | 오류 | 보조 기질 '${L(x)}' 가 입력에 없음 |
| 534 | judicial/judicial.js:1030 | same | 오류 | 보조 생성물 '${L(x)}' 가 출력에 없음 |
| 535 | judicial/judicial.js:1032 | same | 오류 | '${L(g.base)}' 는 규칙 '${rule.label}' 에 정의된 조절자가 아님 |
| 536 | judicial/judicial.js:1040 | same | 오류 | 동일성 보존 위반: ${diff.map((k) => |
| 537 | judicial/judicial.js:1044 | same | 오류 | 규칙 '${rule.label}' 은(는) ${rule.where.map((l) => vlabel('locations', l)).join(', ')}에서만 작동 — 실제 ${vlabel('locations', center.b.location)} |
| 538 | judicial/judicial.js:1060 | same | 오류 | ${ix.bundleLabel(cb.key)} 의 작용 면(${vlabel('faces', cf)})과 ${ix.bundleLabel(x.key)} 가 붙은 면(${vlabel('faces', side)})이 다름 |
| 539 | judicial/judicial.js:1063 | same | 오류 | 공간 접촉 불가: ${ix.bundleLabel(cb.key)} ↔ ${ix.bundleLabel(x.key)} — ${c.why} |
| 540 | judicial/judicial.js:1066 | same | 오류 | (전달) m |
| 541 | judicial/judicial.js:1086 | patchPolicy | 판정 | 변경 이유(why)가 없음 — 패치 최상위에 "why": "…" 를 적을 것 (Traceable Evolution Protocol) |
| 542 | judicial/judicial.js:1087 | patchPolicy | 판정 | 미등록 한계 후보 [${g.type}] ${g.why} — 같은 패치의 limitations 에 등록할 것 |
| 543 | judicial/judicial.js:1090 | patchPolicy | 판정 | 정제 점검 [${x.type}] ${x.msg} — 의도한 단순화면 Structural_Gap 으로 등록, 중복이면 리팩터링 초안(legislative draftRefactor)대로 |
| 544 | judicial/judicial.js:1098 | observationImmutability | 판정 | 관찰 기록은 지울 수 없음 — 잘못된 관찰은 retracted 로 표시 |
| 545 | judicial/judicial.js:1100 | strip | 판정 | 관찰 기록은 바꿀 수 없음 — 새 측정은 새 관찰(O+1), 잘못된 관찰은 retracted 로 표시 |
| 546 | judicial/judicial.js:1101 | strip | 판정 | 철회 표시는 바꾸거나 지울 수 없음 |
| 547 | judicial/judicial.js:1104 | strip | 판정 | 새 관찰에 기록 시각(recorded_at)이 없음 — 병합 전에 dbtool 이 패치에 찍는다 |
| 548 | judicial/judicial.js:1204 | knownFor | 문제 | (전달) { type: 'duplicate_rule', where: ref, same_as: sig.get(key), msg: `${ref} 는 ${sig.get(key) |
| 549 | judicial/judicial.js:1219 | knownFor | 문제 | (전달) { type: 'lumped_contradiction', where: ref, known, diff, msg: `${ref} (순 반응) ↔ ${ix.label( |
| 550 | judicial/judicial.js:1488 | thermoLoops | 오류 반환 | (전달) tg.error |
| 551 | judicial/judicial.js:1569 | resolutionPlan | 오류 반환 | (전달) tg.error |
| 552 | judicial/log_audit.js:16 | verifyChain | 오류 | 기원 루트가 기원 db sha256 과 맞지 않음 |
| 553 | judicial/log_audit.js:20 | verifyChain | 오류 | 사건 ${i + 1}: seq ${ev.seq} — 빠지거나 끼운 사건 |
| 554 | judicial/log_audit.js:21 | verifyChain | 오류 | 사건 ${i + 1}: prev 가 직전 루트와 다름 — 사슬이 끊김 |
| 555 | judicial/log_audit.js:22 | verifyChain | 오류 | 사건 ${i + 1}: root 재계산 불일치 — 내용이 바뀜 |
| 556 | judicial/log_audit.js:23 | verifyChain | 오류 | 사건 ${i + 1}: 형식 변환 사건에 스크립트·해시가 없음 |
| 557 | judicial/log_audit.js:24 | verifyChain | 오류 | 사건 ${i + 1}: 패치가 없음 |
| 558 | judicial/log_audit.js:34 | replayVerdict | 오류 | 사건 ${i + 1}: 형식 변환 스크립트가 기록된 것과 다름 (${ev.script}) |
| 559 | judicial/log_audit.js:35 | replayVerdict | 오류 | 재생 실패: |
| 560 | judicial/log_audit.js:36 | replayVerdict | 오류 | 기원 스냅숏 파일이 기원이 적은 sha256 과 다름 — 스냅숏이 바뀜 |
| 561 | judicial/log_audit.js:37 | replayVerdict | 오류 | 사건 ${i + 1}: 재생한 db 가 봉인된 db 와 다름 — 병합이 결정론적이지 않거나 기록이 바뀜 |
| 562 | judicial/log_audit.js:39 | replayVerdict | 오류 | 지금 db.json 이 기록의 마지막 상태와 다름 — 기록을 거치지 않은 쓰기(직접 편집 등) |
| 563 | judicial/obs_compare.js:113 | verdict | 오류 반환 | 관찰의 용도가 ${o.use} — 추정용 관찰은 판정하지 않음 (상수를 맞춘 관찰로 그 상수를 검증하면 순환) |
| 564 | judicial/obs_compare.js:114 | verdict | 오류 반환 | 철회된 관찰 — 판정하지 않음 |
| 565 | judicial/perturb_audit.js:23 | expectedChange | 오류 반환 | 교란 선언이 없음 |
| 566 | judicial/perturb_audit.js:26 | expectedChange | 오류 반환 | knockout 대상 ${p.target} 이 기준 IR 에 없음 |
| 567 | judicial/perturb_audit.js:31 | expectedChange | 오류 반환 | block 대상 ${p.target} 이 기준 IR 에 없음 |
| 568 | judicial/perturb_audit.js:34 | expectedChange | 오류 반환 | inhibit 선언이 기준 IR·값 조건에 맞지 않음 |
| 569 | judicial/perturb_audit.js:38 | expectedChange | 오류 반환 | clamp 선언이 기준 IR·값 조건에 맞지 않음 |
| 570 | judicial/perturb_audit.js:41 | expectedChange | 오류 반환 | set_amount 선언이 기준 IR·값 조건에 맞지 않음 |
| 571 | judicial/perturb_audit.js:43 | expectedChange | 오류 반환 | 판정할 수 없는 교란 '${p.type}' |
| 572 | judicial/perturb_audit.js:48 | verifyPerturbation | 규약 위반 | (전달) m |
| 573 | judicial/protocol.js:41 | need | 규약 위반 | (전달) msg |
| 574 | judicial/protocol.js:68 | need | 규약 위반 | validation ${id}: 관찰 기록이 없음 |
| 575 | judicial/protocol.js:69 | need | 규약 위반 | validation ${id}: 용도가 ${o.use} — 추정용 관찰로 검증하면 순환 |
| 576 | judicial/protocol.js:70 | need | 규약 위반 | validation ${id}: 철회된 관찰 |
| 577 | judicial/protocol.js:71 | need | 규약 위반 | validation ${id}: 어떤 값의 근거(from)로 쓰이고 있음 — 추정·검증 분리 위반 |
| 578 | judicial/protocol.js:74 | need | 규약 위반 | equivalence 는 protocol 안에만 둔다 (최상위 equivalence 는 쓰지 않음) |
| 579 | judicial/protocol.js:83 | verifyPreregChain | 오류 | 등록 ${i + 1}: seq ${e.seq} — 빠지거나 끼운 등록 |
| 580 | judicial/protocol.js:84 | verifyPreregChain | 오류 | 등록 ${i + 1}: prev 가 직전 루트와 다름 — 사슬이 끊김 |
| 581 | judicial/protocol.js:85 | verifyPreregChain | 오류 | 등록 ${i + 1}: root 재계산 불일치 — 내용이 바뀜 |
| 582 | judicial/protocol.js:97 | protocolVerdict | 규약 위반 | (전달) ...chain.errors.map((e) => '사전 등록부: ' + e) |
| 583 | judicial/protocol.js:99 | protocolVerdict | 규약 위반 | 사전 등록되지 않은 시나리오 — 등록 뒤 고쳤거나 등록하지 않음 (node dbtool.mjs register <시나리오>) |
| 584 | judicial/protocol.js:100 | protocolVerdict | 규약 위반 | 등록 시각 ${hit.at} 이 실행 시각 ${ctx.runAt} 보다 앞서지 않음 |
| 585 | judicial/reliability.js:168 | constantVerdict | 오류 반환 | 등급 문턱 '${min}' — ${ORDER.join(' \| ')} |
| 586 | judicial/scene_origin.js:60 | sceneOrigin | 오류 반환 | (전달) A.error |
| 587 | judicial/stoch_audit.js:15 | auditTrajectory | 오류 반환 | (전달) v.error, audit: v.audit |
| 588 | judicial/verifier.js:25 | stoichFromDB | 오류 반환 | 규칙이 데이터베이스에 없음 |
| 589 | judicial/verifier.js:32 | stoichFromDB | 오류 반환 | 분해 대상 묶음 ${b} 가 규칙 소유자 ${owner} 의 것이 아님 |
| 590 | judicial/verifier.js:33 | stoichFromDB | 오류 반환 | 분해 위치 ${b.split('\|').pop()} 가 규칙 where 밖 |
| 591 | judicial/verifier.js:39 | stoichFromDB | 오류 반환 | 단계 ${info.step} 가 데이터베이스에 없음 |
| 592 | judicial/verifier.js:40 | stoichFromDB | 오류 반환 | 단계 ${info.step} 는 규칙 ${st.rule} 을 쓰는데 엔진은 ${info.ref} 라고 함 |
| 593 | judicial/verifier.js:45 | sum | 오류 반환 | 공급·분해 규칙이 아님 (${r.type}) |

## 7. 코드 제약 — 입법·서기

| # | 파일:줄 | 함수·명령 | 종류 | 메시지 |
|---|---|---|---|---|
| 1 | legislative/clerk.mjs:51 | zoned | 쓰기 거부 | 알 수 없는 구역 '${zone}' |
| 2 | legislative/clerk.mjs:53 | zoned | 쓰기 거부 | ${z.label} 는 ${z.rule} (${rel}) |
| 3 | legislative/clerk.mjs:55 | zoned | 쓰기 거부 | ${z.label} 가 아닌 자리에 쓰려 함: ${rel} — 허용 ${z.allow.join(', ')} |
| 4 | legislative/clerk.mjs:56 | zoned | 쓰기 거부 | 보고서를 저장소의 보호된 위치(${rel})에 쓸 수 없음 |
| 5 | legislative/clerk.mjs:64 | commitMerge | 쓰기 거부 | 관문 봉인이 없거나 변조됨 |
| 6 | legislative/clerk.mjs:65 | commitMerge | 쓰기 거부 | 관문 판결이 거부 (오류 ${seal.errors}, 경고 ${seal.warnings}) |
| 7 | legislative/clerk.mjs:67 | commitMerge | 쓰기 거부 | 봉인된 db 와 쓰려는 db 가 다름 — 판결을 다른 데이터에 재사용할 수 없음 |
| 8 | legislative/clerk.mjs:95 | commitMigration | 쓰기 거부 | 검사 봉인이 없거나 변조됨 |
| 9 | legislative/clerk.mjs:96 | commitMigration | 쓰기 거부 | 검사 판결이 거부 |
| 10 | legislative/clerk.mjs:98 | commitMigration | 쓰기 거부 | 봉인된 db 와 쓰려는 db 가 다름 |
| 11 | legislative/clerk.mjs:99 | commitMigration | 쓰기 거부 | 형식 변환 스크립트는 migrations/ 의 CommonJS 파일이어야 함 (${script}) |
| 12 | legislative/clerk.mjs:114 | sealGenesis | 쓰기 거부 | 관문 봉인이 없거나 변조됨 |
| 13 | legislative/clerk.mjs:115 | sealGenesis | 쓰기 거부 | 검사 판결이 거부 (오류 ${seal.errors}, 경고 ${seal.warnings}) |
| 14 | legislative/clerk.mjs:117 | sealGenesis | 쓰기 거부 | 봉인된 db 와 기원으로 쓰려는 db 가 다름 |
| 15 | legislative/clerk.mjs:119 | sealGenesis | 쓰기 거부 | 기원 체크포인트가 이미 있음 — 기원은 한 번만 만든다 |
| 16 | legislative/clerk.mjs:130 | registerPrereg | 쓰기 거부 | 규약 판정 봉인이 없거나 변조됨 |
| 17 | legislative/clerk.mjs:131 | registerPrereg | 쓰기 거부 | 규약 판정이 거부 (위반 ${seal.errors}) |
| 18 | legislative/clerk.mjs:132 | registerPrereg | 쓰기 거부 | 봉인된 시나리오와 등록하려는 시나리오가 다름 |
| 19 | legislative/clerk.mjs:135 | registerPrereg | 쓰기 거부 | 이미 등록된 시나리오 (#${dup.seq}, ${dup.at}) |
| 20 | legislative/clerk.mjs:148 | appendDictionary | 쓰기 거부 | 사전 판정 봉인이 없거나 변조됨 |
| 21 | legislative/clerk.mjs:149 | appendDictionary | 쓰기 거부 | 사전 판정이 거부 (위반 ${seal.errors}) |
| 22 | legislative/clerk.mjs:150 | appendDictionary | 쓰기 거부 | 봉인된 항목과 쓰려는 항목이 다름 |
| 23 | legislative/clerk.mjs:167 | appendAssumptions | 쓰기 거부 | 가정 판정 봉인이 없거나 변조됨 |
| 24 | legislative/clerk.mjs:168 | appendAssumptions | 쓰기 거부 | 가정 판정이 거부 (위반 ${seal.errors}) |
| 25 | legislative/clerk.mjs:169 | appendAssumptions | 쓰기 거부 | 봉인된 기록과 쓰려는 기록이 다름 |
| 26 | legislative/clerk.mjs:195 | appendAttestations | 쓰기 거부 | 도장 ${v.key}: ${v.reasons.join(' · ')} |
| 27 | legislative/clerk.mjs:205 | writeDerived | 쓰기 거부 | 알 수 없는 파생 문서 '${kind}' |
| 28 | legislative/clerk.mjs:217 | insertChangesRow | 쓰기 거부 | CHANGES.md 표 머리를 찾지 못함 |
| 29 | legislative/clerk.mjs:271 | appendHandoff | 쓰기 거부 | 핸드오프 이름 '${name}' — 소문자·숫자·하이픈만 |
| 30 | legislative/clerk.mjs:272 | appendHandoff | 쓰기 거부 | 붙일 후보 줄이 없음 |
| 31 | legislative/clerk.mjs:273 | appendHandoff | 쓰기 거부 | ${i + 1}번째 후보가 JSON 객체가 아님 |
| 32 | legislative/clerk.mjs:283 | alive | 쓰기 거부 | 입출력기가 이미 떠 있음 (pid ${pid}) — 작성자는 하나 |
| 33 | legislative/clerk.mjs:285 | alive | 쓰기 거부 | 입출력기 잠금을 다른 작성자가 먼저 잡음 |
| 34 | legislative/legislative.js:30 | ERR | 오류 | (전달) { where, msg } |

## 8. 코드 제약 — MCP

| # | 파일:줄 | 함수·명령 | 종류 | 메시지 |
|---|---|---|---|---|
| 1 | mcp/clerk.mjs:25 | dbtool | 도구 거부 | (전달) |
| 2 | mcp/clerk.mjs:28 | outside | 예외 | 절대 경로가 필요함 |
| 3 | mcp/clerk.mjs:38 | outside | 도구 거부 | (전달) |
| 4 | mcp/clerk.mjs:39 | outside | 예외 | paths 가 필요함 |
| 5 | mcp/fetch.mjs:39 | abstract | 예외 | 초록 받기 실패 (${r.error \|\| '형식'}) — 받기 기록 #${r.log.seq} |
| 6 | mcp/fetch.mjs:41 | abstract | 예외 | PMID ${pmid} 결과 없음 — 받기 기록 #${r.log.seq} |
| 7 | mcp/fetch.mjs:55 | abstract | 도구 거부 | (전달) |
| 8 | mcp/fetch.mjs:56 | abstract | 도구 거부 | (전달) |
| 9 | mcp/fetch.mjs:58 | abstract | 도구 거부 | (전달) |
| 10 | mcp/protocol.mjs:12 | roleOf | 예외 | BIODB_ROLE '${r}' — ${ROLES.join(' \| ')} |
| 11 | mcp/protocol.mjs:34 | fail | 도구 거부 | (전달) |
| 12 | mcp/protocol.mjs:39 | fail | 도구 거부 | (전달) |
| 13 | mcp/protocol.mjs:56 | need | 예외 | 인자 '${key}' 가 필요함 |
| 14 | mcp/protocol.mjs:57 | need | 예외 | 인자 '${key}' 형식이 아님: ${v} |
| 15 | mcp/query.mjs:33 | inRepo | 예외 | 저장소 밖 경로: ${p} |
| 16 | mcp/query.mjs:56 | str | 예외 | 대상 없음 — target 을 주거나 subjects.json 에 등록 |
| 17 | mcp/query.mjs:57 | str | 예외 | (전달) tg.error |
| 18 | mcp/query.mjs:58 | str | 예외 | (전달) v.error |
| 19 | mcp/query.mjs:61 | str | 예외 | (전달) u.error |
| 20 | mcp/query.mjs:71 | str | 예외 | pmid 또는 pmcid 가 필요함 |
| 21 | mcp/query.mjs:76 | str | 예외 | ${i + 1}행이 JSON 이 아님 |

## 9. 코드 제약 — 공유(model.js)

| # | 파일:줄 | 함수·명령 | 종류 | 메시지 |
|---|---|---|---|---|
| 1 | model.js:95 | mapVocab | 오류 반환 | ${VNAME[table]} 없음 |
| 2 | model.js:100 | mapVocab | 오류 반환 | ${VNAME[table]} '${v}' 은(는) 어휘 목록에 없음 — 가능한 값: ${(sug.length ? sug : Object.keys(V[table])).join(', ')} |
| 3 | model.js:135 | parseBundle | 오류 반환 | 묶음 키 '${key}' 형식 틀림 — 'D…\|부위:특징\|위치' |
| 4 | model.js:139 | parseBundle | 오류 반환 | 묶음 키 '${key}' 의 특징 '${f}' 형식 틀림 — '부위:특징' |
| 5 | model.js:766 | resolveRef | 오류 반환 | 참조가 비어 있음 |
| 6 | model.js:768 | resolveRef | 오류 반환 | 임시 번호 '${r}' 가 이 패치 안에 없음 |
| 7 | model.js:772 | resolveRef | 오류 반환 | ${r} 은(는) 나뉘었음 (${m.kind}) — 하나를 지정할 것: ${to.map((x) => |
| 8 | model.js:774 | resolveRef | 오류 반환 | 정의항 ${r} 없음 |
| 9 | model.js:778 | fromTerm | 오류 반환 | '${r}' 은(는) 뜻이 여러 개 — 하나를 지정할 것: ${ds.map((x) => |
| 10 | model.js:785 | fromTerm | 오류 반환 | '${r}' 정의항 없음 |
| 11 | model.js:792 | fromTerm | 오류 반환 | '${r}' 은(는) 데이터베이스에 없음 |
| 12 | model.js:884 | parseLoose | 예외 | JSON 을 찾을 수 없음 |

## 10. 코드 제약 — 조정자

| # | 파일:줄 | 함수·명령 | 종류 | 메시지 |
|---|---|---|---|---|
| 1 | orchestrator.js:58 | runVariant | 오류 반환 | (전달) A.error |
| 2 | orchestrator.js:60 | runVariant | 오류 반환 | (전달) main.r.error |
| 3 | orchestrator.js:76 | runEnsemble | 오류 반환 | 앙상블에는 시나리오 stochastic { seed } 가 필요함 |
| 4 | orchestrator.js:120 | reductionCheck | 오류 반환 | (전달) full.error \|\| reduced.error |
| 5 | orchestrator.js:148 | observeFateRaw | 오류 반환 | 정성 관찰은 observeQualitative 로 (build-plan 8) |
| 6 | orchestrator.js:150 | runs | 예외 | (전달) rs.error |
| 7 | orchestrator.js:151 | runs | 예외 | (전달) r.error |
| 8 | orchestrator.js:159 | runs | 오류 반환 | dose_slope 는 가설 하나(scA)로만 — 가설 비교는 시나리오마다 따로 |
| 9 | orchestrator.js:162 | runs | 오류 반환 | (전달) v.error |
| 10 | orchestrator.js:165 | runs | 오류 반환 | (전달) x.error |
| 11 | orchestrator.js:167 | runs | 오류 반환 | 용량 ${x.record.perturbation.n}: 교란 차이 검사 실패 — ${(a.problems \|\| []).join('; ')} |
| 12 | orchestrator.js:168 | runs | 오류 반환 | (전달) e.message |
| 13 | orchestrator.js:176 | runs | 오류 반환 | (전달) e.message |
| 14 | orchestrator.js:188 | observeQualitative | 오류 반환 | (전달) v.error |
| 15 | orchestrator.js:190 | observeQualitative | 오류 반환 | (전달) v.variants[0].error |
| 16 | orchestrator.js:197 | run | 예외 | (전달) rs.error |
| 17 | orchestrator.js:198 | run | 예외 | (전달) r.error |
| 18 | orchestrator.js:262 | evs | 오류 반환 | (전달) e.message |

## 11. 코드 제약 — 공유(scenarios.js)

| # | 파일:줄 | 함수·명령 | 종류 | 메시지 |
|---|---|---|---|---|
| 1 | scenarios.js:20 | load | 예외 | 시나리오 ${path.basename(file)}: ${r.error} |

## 12. 표로 된 제약

### 쓰기 구역 (`legislative/clerk.mjs` ZONES)

| 구역 | 뜻 | 허용 | 규칙 |
|---|---|---|---|
| registry | 입법 구역 (정의·병합 기록·델타 기록) | data/db.json, data/patches/, data/log/, data/preregistrations.jsonl, data/dictionary.jsonl, data/assumptions.jsonl | 관문 봉인 통과 + 봉인의 db sha256 이 쓸 db 와 같을 때만 |
| attestation | 증명 구역 (도장 등록부) | attestations/registry.json | 도장마다 digest·증거 재확인(주장별 사법부 모듈)이 통과할 때만 |
| evidence | 증거 구역 (원본 수신함) | data/fetched/, tests/fixtures/ | 원본을 그대로 — 해석·실행하지 않는다 |
| derived | 파생 문서 구역 | limitations.md, docs/textbook/90-부록-자동생성.md, data/fetched/RETRIEVAL_TASKS.md, CHANGES.md | 내용은 다른 모듈이 계산하고 서기는 정해진 파일에만 |
| report | 사용자 보고서 | 보호 목록 밖: data, attestations, judicial, legislative, engine, compiler, migrations, schemas, tests | 위치는 사용자가 정한다 — 저장소의 코드·데이터·증명 위치에는 쓰지 않는다 |
| draft | 초안 (패치·리팩터링 제안) | 저장소 밖만 | 저장소 밖(스크래치·임시 폴더)에만 |
| handoff | 핸드오프 (수집 후보) | workspace/handoff/ | 후보만 — 추가만 한다, 사실이 아니다 (통합가가 1차 출처로 재확인한 것만 패치) |

### 물리 상한 (`vocab.physicalBounds`)

| 차원 | 최소 | 최대 | 이유 |
|---|---|---|---|
| concentration | 0 | 100 | 순수한 물이 55.5 M — 그보다 큰 농도는 물리적으로 불가능 |
| volume | 0 (초과) | 0.000001 | 1 µL = 1e9 µm³ — 어떤 세포 구획도 그보다 크지 않다 |
| count | 0 | 100000000000000000000 | 1 몰 = 6.02e23 개 — 한 세포가 그 규모를 담지 못한다 |
| residue | 1 | 1000000 | 가장 긴 사람 단백질 타이틴이 34,350 aa · 1 번 염색체가 2.5e8 bp 이지만 정의항의 서열은 그 아래 |
| time | 0 (초과) | 1000000000000 | 1e12 s ≈ 3만 년 |
| per_time | 0 | 1000000000 | 가장 빠른 효소 전환수가 ~1e6 s⁻¹ |
| energy_molar | -10000000 | 10000000 | ±1e7 J/mol 은 공유 결합 에너지의 수십 배 |
| diffusion | 0 (초과) | 0.000001 | 물의 자기 확산 2.3e-9 m²/s |

### MCP 역할 (`mcp/protocol.mjs`)

| 역할 | 보이는 쓰기 |
|---|---|
| collector (기본) | put_handoff 만 |
| integrator | 권위 쓰기 (merge·register·assume_add …), allow_warnings 없음 |
| human | 전부 + allow_warnings |

## 13. 스키마 제약

| # | 파일 | 경로 | 키 | 값 |
|---|---|---|---|---|
| 1 | schemas/ffi/fate-raw.schema.json | / | required | source, states, dt, t_end, keys, markers, signals, rules, final, trajectory, series, firstReach, transitions, commitment, target, integrator, mass, reservoirs, volumes, buffered, coupling, process, events, facts, kineticGaps, modulationGaps, stats, irHash |
| 2 | schemas/ffi/fate-raw.schema.json | / | additionalProperties | false |
| 3 | schemas/ffi/fate-raw.schema.json | /properties/states | minItems | 1 |
| 4 | schemas/ffi/fate-raw.schema.json | /properties/dt | exclusiveMinimum | 0 |
| 5 | schemas/ffi/fate-raw.schema.json | /properties/t_end | exclusiveMinimum | 0 |
| 6 | schemas/ffi/fate-raw.schema.json | /properties/keys | minItems | 1 |
| 7 | schemas/ffi/fate-raw.schema.json | /properties/rules/items | required | ref, kind, layer, active, modulators |
| 8 | schemas/ffi/fate-raw.schema.json | /properties/rules/items | additionalProperties | false |
| 9 | schemas/ffi/fate-raw.schema.json | /properties/rules/items/properties/kind | enum | supply, degradation, step |
| 10 | schemas/ffi/fate-raw.schema.json | /properties/rules/items/properties/layer | enum | fast, slow |
| 11 | schemas/ffi/fate-raw.schema.json | /properties/rules/items/properties/src | enum | data, scenario, |
| 12 | schemas/ffi/fate-raw.schema.json | /properties/rules/items/properties/modulators/items | required | ref, bundle, effect, active |
| 13 | schemas/ffi/fate-raw.schema.json | /properties/rules/items/properties/modulators/items | additionalProperties | false |
| 14 | schemas/ffi/fate-raw.schema.json | /properties/rules/items/properties/modulators/items/properties/effect | enum | activates, inhibits |
| 15 | schemas/ffi/fate-raw.schema.json | /properties/rules/items/properties/step | pattern | ^S\d{6}$ |
| 16 | schemas/ffi/fate-raw.schema.json | /properties/rules/items/properties/dir | enum | f, r |
| 17 | schemas/ffi/fate-raw.schema.json | /properties/final | required | state, d, N |
| 18 | schemas/ffi/fate-raw.schema.json | /properties/final | additionalProperties | false |
| 19 | schemas/ffi/fate-raw.schema.json | /properties/final/properties/state | anyOf | 2 갈래 |
| 20 | schemas/ffi/fate-raw.schema.json | /properties/final/properties/nearest | anyOf | 2 갈래 |
| 21 | schemas/ffi/fate-raw.schema.json | /properties/final/properties/d | minimum | 0 |
| 22 | schemas/ffi/fate-raw.schema.json | /properties/trajectory/items | required | t, d, cls, steps, rejects |
| 23 | schemas/ffi/fate-raw.schema.json | /properties/trajectory/items/properties/steps | minimum | 1 |
| 24 | schemas/ffi/fate-raw.schema.json | /properties/trajectory/items/properties/rejects | minimum | 0 |
| 25 | schemas/ffi/fate-raw.schema.json | /properties/transitions/items | required | to, signals, criterion, driven |
| 26 | schemas/ffi/fate-raw.schema.json | /properties/transitions/items/properties/criterion | enum | withdrawal, threshold |
| 27 | schemas/ffi/fate-raw.schema.json | /properties/commitment/items | required | to, criterion, driven |
| 28 | schemas/ffi/fate-raw.schema.json | /properties/commitment/items/properties/criterion | enum | withdrawal, threshold |
| 29 | schemas/ffi/fate-raw.schema.json | /properties/commitment/items/properties/grid/items | required | t, pass |
| 30 | schemas/ffi/fate-raw.schema.json | /properties/target | anyOf | 2 갈래 |
| 31 | schemas/ffi/fate-raw.schema.json | /properties/integrator | required | method, rtol, atol, steps, rejected, rejectedNeg, hMinHits, h, perInterval |
| 32 | schemas/ffi/fate-raw.schema.json | /properties/integrator | additionalProperties | false |
| 33 | schemas/ffi/fate-raw.schema.json | /properties/integrator/properties/method | const | rodas3 |
| 34 | schemas/ffi/fate-raw.schema.json | /properties/integrator/properties/rtol | exclusiveMinimum | 0 |
| 35 | schemas/ffi/fate-raw.schema.json | /properties/integrator/properties/atol | exclusiveMinimum | 0 |
| 36 | schemas/ffi/fate-raw.schema.json | /properties/integrator/properties/steps | minimum | 1 |
| 37 | schemas/ffi/fate-raw.schema.json | /properties/integrator/properties/rejected | minimum | 0 |
| 38 | schemas/ffi/fate-raw.schema.json | /properties/integrator/properties/rejectedNeg | minimum | 0 |
| 39 | schemas/ffi/fate-raw.schema.json | /properties/integrator/properties/hMinHits | minimum | 0 |
| 40 | schemas/ffi/fate-raw.schema.json | /properties/integrator/properties/h | required | min, max |
| 41 | schemas/ffi/fate-raw.schema.json | /properties/integrator/properties/h/properties/min | exclusiveMinimum | 0 |
| 42 | schemas/ffi/fate-raw.schema.json | /properties/integrator/properties/h/properties/max | exclusiveMinimum | 0 |
| 43 | schemas/ffi/fate-raw.schema.json | /properties/integrator/properties/perInterval | required | min, max |
| 44 | schemas/ffi/fate-raw.schema.json | /properties/integrator/properties/perInterval/properties/min | minimum | 1 |
| 45 | schemas/ffi/fate-raw.schema.json | /properties/integrator/properties/perInterval/properties/max | minimum | 1 |
| 46 | schemas/ffi/fate-raw.schema.json | /properties/mass | required | moieties, start, end, channels |
| 47 | schemas/ffi/fate-raw.schema.json | /properties/mass | additionalProperties | false |
| 48 | schemas/ffi/fate-raw.schema.json | /properties/mass/properties/channels | required | lost, source, violation |
| 49 | schemas/ffi/fate-raw.schema.json | /properties/mass/properties/channels | additionalProperties | false |
| 50 | schemas/ffi/fate-raw.schema.json | /properties/reservoirs/additionalProperties | required | start, min, end, state, watched, buffered |
| 51 | schemas/ffi/fate-raw.schema.json | /properties/reservoirs/additionalProperties | additionalProperties | false |
| 52 | schemas/ffi/fate-raw.schema.json | /properties/reservoirs/additionalProperties/properties/state | enum | ok, empty |
| 53 | schemas/ffi/fate-raw.schema.json | /properties/volumes/additionalProperties | exclusiveMinimum | 0 |
| 54 | schemas/ffi/fate-raw.schema.json | /properties/buffered/additionalProperties | required | conc_M, total |
| 55 | schemas/ffi/fate-raw.schema.json | /properties/buffered/additionalProperties/properties/conc_M | minimum | 0 |
| 56 | schemas/ffi/fate-raw.schema.json | /properties/buffered/additionalProperties/properties/total | minimum | 0 |
| 57 | schemas/ffi/fate-raw.schema.json | /properties/coupling | required | _source, saturation_K, commitment_horizon, commitment_coarse, hill_s_floor, rtol, atol, h0, h_min, safety, fac_min, fac_max, neg_shrink, pivot_rel, commitment_tol, event_tol |
| 58 | schemas/ffi/fate-raw.schema.json | /properties/process | required | lo, cumDD, times, sig, cum, schedule, signalIdx, thresholds, N0, ruleInfo |
| 59 | schemas/ffi/fate-raw.schema.json | /properties/process | additionalProperties | false |
| 60 | schemas/ffi/fate-raw.schema.json | /properties/process/properties/schedule/items | required | bundle, list |
| 61 | schemas/ffi/fate-raw.schema.json | /properties/process/properties/schedule/items/properties/list/items | required | t, n |
| 62 | schemas/ffi/fate-raw.schema.json | /properties/process/properties/schedule/items/properties/list/items/properties/n | minimum | 0 |
| 63 | schemas/ffi/fate-raw.schema.json | /properties/process/properties/signalIdx/items | minimum | 0 |
| 64 | schemas/ffi/fate-raw.schema.json | /properties/process/properties/thresholds/additionalProperties | required | low, high |
| 65 | schemas/ffi/fate-raw.schema.json | /properties/process/properties/ruleInfo/items | required | ref, kind, layer, cons, prods, src, kin, mods |
| 66 | schemas/ffi/fate-raw.schema.json | /properties/process/properties/ruleInfo/items | additionalProperties | false |
| 67 | schemas/ffi/fate-raw.schema.json | /properties/process/properties/ruleInfo/items/properties/kind | enum | supply, degradation, step |
| 68 | schemas/ffi/fate-raw.schema.json | /properties/process/properties/ruleInfo/items/properties/layer | enum | fast, slow |
| 69 | schemas/ffi/fate-raw.schema.json | /properties/process/properties/ruleInfo/items/properties/src | enum | data, scenario, |
| 70 | schemas/ffi/fate-raw.schema.json | /properties/process/properties/ruleInfo/items/properties/mods/items | required | ref, bundle, effect, kin |
| 71 | schemas/ffi/fate-raw.schema.json | /properties/process/properties/ruleInfo/items/properties/mods/items/properties/effect | enum | activates, inhibits |
| 72 | schemas/ffi/fate-raw.schema.json | /properties/process/properties/ruleInfo/items/properties/step | pattern | ^S\d{6}$ |
| 73 | schemas/ffi/fate-raw.schema.json | /properties/process/properties/ruleInfo/items/properties/dir | enum | f, r |
| 74 | schemas/ffi/fate-raw.schema.json | /properties/events/items | required | t, type, bundle |
| 75 | schemas/ffi/fate-raw.schema.json | /properties/events/items | additionalProperties | false |
| 76 | schemas/ffi/fate-raw.schema.json | /properties/events/items/properties/type | enum | exhausted, regenerated |
| 77 | schemas/ffi/fate-raw.schema.json | /properties/facts/items | required | kind |
| 78 | schemas/ffi/fate-raw.schema.json | /properties/facts/items/properties/kind | enum | not_supply, recycle_ignored, volume_unknown, threshold_missing |
| 79 | schemas/ffi/fate-raw.schema.json | /properties/stats | required | rhs, jac, steps, rejected, rejectedNeg, hMinHits, singular, probes, probeRounds, probeLanes |
| 80 | schemas/ffi/fate-raw.schema.json | /properties/stats/additionalProperties | minimum | 0 |
| 81 | schemas/ffi/fate-raw.schema.json | /properties/irHash | pattern | ^[0-9a-f]{64}$ |
| 82 | schemas/ffi/fate-raw.schema.json | /properties/engine | enum | js, rust |
| 83 | schemas/ffi/fate-raw.schema.json | /properties/stochastic | required | seed, trajectory, method, draws, switches, ssaFires, ssaBlocked, leapRejects, rootEvals, rules |
| 84 | schemas/ffi/fate-raw.schema.json | /properties/stochastic | additionalProperties | false |
| 85 | schemas/ffi/fate-raw.schema.json | /properties/stochastic/properties/trajectory | minimum | 0 |
| 86 | schemas/ffi/fate-raw.schema.json | /properties/stochastic/properties/draws | minimum | 0 |
| 87 | schemas/ffi/fate-raw.schema.json | /properties/stochastic/properties/switches | minimum | 0 |
| 88 | schemas/ffi/fate-raw.schema.json | /properties/stochastic/properties/ssaFires | minimum | 0 |
| 89 | schemas/ffi/fate-raw.schema.json | /properties/stochastic/properties/ssaBlocked | minimum | 0 |
| 90 | schemas/ffi/fate-raw.schema.json | /properties/stochastic/properties/leapRejects | minimum | 0 |
| 91 | schemas/ffi/fate-raw.schema.json | /properties/stochastic/properties/rootEvals | minimum | 0 |
| 92 | schemas/ffi/fate-raw.schema.json | /properties/stochastic/properties/rules/items | required | ref, mode, ssa, leap |
| 93 | schemas/ffi/fate-raw.schema.json | /properties/stochastic/properties/rules/items | additionalProperties | false |
| 94 | schemas/ffi/fate-raw.schema.json | /properties/stochastic/properties/rules/items/properties/mode | enum | ode, leap, ssa |
| 95 | schemas/ffi/fate-raw.schema.json | /properties/stochastic/properties/rules/items/properties/ssa | minimum | 0 |
| 96 | schemas/ffi/fate-raw.schema.json | /properties/stochastic/properties/rules/items/properties/leap | minimum | 0 |
| 97 | schemas/ffi/fate-raw.schema.json | /$defs/senseId | pattern | ^D\d{6}$ |
| 98 | schemas/ffi/fate-raw.schema.json | /$defs/bundle | pattern | ^D\d{6}(\\|[^\|]+)+$ |
| 99 | schemas/ffi/fate-raw.schema.json | /$defs/ruleRef | pattern | ^D\d{6}/rule/[a-z0-9_]+$ |
| 100 | schemas/ffi/fate-raw.schema.json | /$defs/stoich/items/prefixItems/1 | exclusiveMinimum | 0 |
| 101 | schemas/ffi/fate-raw.schema.json | /$defs/stoich/items | minItems | 2 |
| 102 | schemas/ffi/fate-raw.schema.json | /$defs/stoich/items | maxItems | 2 |
| 103 | schemas/obs/observation.schema.json | /$defs/quantitative | required | observable, value, unit, uncertainty, replicates, condition, use, evidence |
| 104 | schemas/obs/observation.schema.json | /$defs/quantitative | additionalProperties | false |
| 105 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/id | pattern | ^O(\d{6}\|\+.*)$ |
| 106 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/observable | required | kind, target |
| 107 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/observable | additionalProperties | false |
| 108 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/observable/properties/kind | enum | amount, concentration, fraction, event_time, volume, kinetic_constant, ratio, fraction_above, dose_slope |
| 109 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/observable/properties/target | minLength | 1 |
| 110 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/observable/properties/also/items | minLength | 1 |
| 111 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/observable/properties/denominator | minLength | 1 |
| 112 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/observable/properties/threshold | minimum | 0 |
| 113 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/observable/properties/dose | required | target, values |
| 114 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/observable/properties/dose | additionalProperties | false |
| 115 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/observable/properties/dose/properties/target | minLength | 1 |
| 116 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/observable/properties/dose/properties/values | minItems | 2 |
| 117 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/observable/properties/dose/properties/values/items | minimum | 0 |
| 118 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/uncertainty | required | kind, model, sd |
| 119 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/uncertainty | additionalProperties | false |
| 120 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/uncertainty/properties/kind | enum | measurement, biological, combined |
| 121 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/uncertainty/properties/model | enum | normal, lognormal, poisson |
| 122 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/uncertainty/properties/sd | minimum | 0 |
| 123 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/precision | minimum | 0 |
| 124 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/detection_limit | minimum | 0 |
| 125 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/saturation | minimum | 0 |
| 126 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/replicates | minimum | 1 |
| 127 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/condition | required | species |
| 128 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/condition | additionalProperties | false |
| 129 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/condition/properties/temperature_K | exclusiveMinimum | 0 |
| 130 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/condition/properties/pH | minimum | 0 |
| 131 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/condition/properties/pH | maximum | 14 |
| 132 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/condition/properties/time_s | minimum | 0 |
| 133 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/condition/properties/condition/items | pattern | ^D(\d{6}\|\+.*)$ |
| 134 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/condition/properties/condition | minItems | 1 |
| 135 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/calibration | required | kind |
| 136 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/calibration | additionalProperties | false |
| 137 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/calibration/properties/kind | enum | identity, linear, table |
| 138 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/calibration/properties/points | minItems | 2 |
| 139 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/calibration/properties/points/items | minItems | 2 |
| 140 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/calibration/properties/points/items | maxItems | 2 |
| 141 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/provenance | additionalProperties | false |
| 142 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/provenance/properties/sha256 | pattern | ^[0-9a-fA-F]{64}$ |
| 143 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/provenance/properties/source | required | db, id |
| 144 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/provenance/properties/source | additionalProperties | false |
| 145 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/provenance/properties/source/properties/id | minLength | 1 |
| 146 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/use | enum | estimation, validation |
| 147 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/retracted | required | note, evidence |
| 148 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/kind | const | quantitative |
| 149 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/experiment | minLength | 1 |
| 150 | schemas/obs/observation.schema.json | /$defs/quantitative/properties/evidence_at | pattern | ^\d{4}(-\d{2}(-\d{2})?)?$ |
| 151 | schemas/obs/observation.schema.json | /$defs/qualitative | required | kind, readout, expect, condition, quote, provenance, use, evidence |
| 152 | schemas/obs/observation.schema.json | /$defs/qualitative | additionalProperties | false |
| 153 | schemas/obs/observation.schema.json | /$defs/qualitative/properties/id | pattern | ^O(\d{6}\|\+.*)$ |
| 154 | schemas/obs/observation.schema.json | /$defs/qualitative/properties/condition | required | species |
| 155 | schemas/obs/observation.schema.json | /$defs/qualitative/properties/condition | additionalProperties | false |
| 156 | schemas/obs/observation.schema.json | /$defs/qualitative/properties/condition/properties/temperature_K | exclusiveMinimum | 0 |
| 157 | schemas/obs/observation.schema.json | /$defs/qualitative/properties/condition/properties/pH | minimum | 0 |
| 158 | schemas/obs/observation.schema.json | /$defs/qualitative/properties/condition/properties/pH | maximum | 14 |
| 159 | schemas/obs/observation.schema.json | /$defs/qualitative/properties/condition/properties/time_s | minimum | 0 |
| 160 | schemas/obs/observation.schema.json | /$defs/qualitative/properties/condition/properties/condition/items | pattern | ^D(\d{6}\|\+.*)$ |
| 161 | schemas/obs/observation.schema.json | /$defs/qualitative/properties/condition/properties/condition | minItems | 1 |
| 162 | schemas/obs/observation.schema.json | /$defs/qualitative/properties/provenance | required | source |
| 163 | schemas/obs/observation.schema.json | /$defs/qualitative/properties/provenance | additionalProperties | false |
| 164 | schemas/obs/observation.schema.json | /$defs/qualitative/properties/provenance/properties/sha256 | pattern | ^[0-9a-fA-F]{64}$ |
| 165 | schemas/obs/observation.schema.json | /$defs/qualitative/properties/provenance/properties/source | required | db, id |
| 166 | schemas/obs/observation.schema.json | /$defs/qualitative/properties/provenance/properties/source | additionalProperties | false |
| 167 | schemas/obs/observation.schema.json | /$defs/qualitative/properties/provenance/properties/source/properties/db | enum | DOI, PMID |
| 168 | schemas/obs/observation.schema.json | /$defs/qualitative/properties/provenance/properties/source/properties/id | minLength | 1 |
| 169 | schemas/obs/observation.schema.json | /$defs/qualitative/properties/use | const | validation |
| 170 | schemas/obs/observation.schema.json | /$defs/qualitative/properties/retracted | required | note, evidence |
| 171 | schemas/obs/observation.schema.json | /$defs/qualitative/properties/experiment | minLength | 1 |
| 172 | schemas/obs/observation.schema.json | /$defs/qualitative/properties/evidence_at | pattern | ^\d{4}(-\d{2}(-\d{2})?)?$ |
| 173 | schemas/obs/observation.schema.json | /$defs/qualitative/properties/replicates | minimum | 1 |
| 174 | schemas/obs/observation.schema.json | /$defs/qualitative/properties/kind | const | qualitative |
| 175 | schemas/obs/observation.schema.json | /$defs/qualitative/properties/perturbation | required | type, target |
| 176 | schemas/obs/observation.schema.json | /$defs/qualitative/properties/perturbation | additionalProperties | false |
| 177 | schemas/obs/observation.schema.json | /$defs/qualitative/properties/perturbation/properties/type | enum | knockout, block, inhibit, clamp |
| 178 | schemas/obs/observation.schema.json | /$defs/qualitative/properties/perturbation/properties/target | minLength | 1 |
| 179 | schemas/obs/observation.schema.json | /$defs/qualitative/properties/perturbation/properties/Ki_M | exclusiveMinimum | 0 |
| 180 | schemas/obs/observation.schema.json | /$defs/qualitative/properties/perturbation/properties/dose_M | minimum | 0 |
| 181 | schemas/obs/observation.schema.json | /$defs/qualitative/properties/perturbation/properties/conc_M | minimum | 0 |
| 182 | schemas/obs/observation.schema.json | /$defs/qualitative/properties/readout | required | kind |
| 183 | schemas/obs/observation.schema.json | /$defs/qualitative/properties/readout | additionalProperties | false |
| 184 | schemas/obs/observation.schema.json | /$defs/qualitative/properties/readout/properties/kind | enum | amount, concentration, fraction, event_time |
| 185 | schemas/obs/observation.schema.json | /$defs/qualitative/properties/readout/properties/target | minLength | 1 |
| 186 | schemas/obs/observation.schema.json | /$defs/qualitative/properties/readout/properties/instrument_resolution | minimum | 0 |
| 187 | schemas/obs/observation.schema.json | /$defs/qualitative/properties/readout/properties/also/items | minLength | 1 |
| 188 | schemas/obs/observation.schema.json | /$defs/qualitative/properties/expect | anyOf | 2 갈래 |
| 189 | schemas/obs/observation.schema.json | /$defs/qualitative/properties/expect/anyOf/0 | enum | increase, decrease, no_change, present, absent, monotone_increase, monotone_decrease |
| 190 | schemas/obs/observation.schema.json | /$defs/qualitative/properties/expect/anyOf/1 | required | order |
| 191 | schemas/obs/observation.schema.json | /$defs/qualitative/properties/expect/anyOf/1 | additionalProperties | false |
| 192 | schemas/obs/observation.schema.json | /$defs/qualitative/properties/expect/anyOf/1/properties/order | minItems | 2 |
| 193 | schemas/obs/observation.schema.json | /$defs/qualitative/properties/expect/anyOf/1/properties/order/items | minLength | 1 |
| 194 | schemas/obs/observation.schema.json | /$defs/qualitative/properties/quote | minLength | 1 |
| 195 | schemas/v8/boundary-flux-packet.schema.json | / | required | region_id, node_id, face_set, interval, seq, flux, mode |
| 196 | schemas/v8/boundary-flux-packet.schema.json | / | additionalProperties | false |
| 197 | schemas/v8/boundary-flux-packet.schema.json | /properties/interval | required | t0, t1 |
| 198 | schemas/v8/boundary-flux-packet.schema.json | /properties/interval/properties/t0 | minimum | 0 |
| 199 | schemas/v8/boundary-flux-packet.schema.json | /properties/interval/properties/t1 | minimum | 0 |
| 200 | schemas/v8/boundary-flux-packet.schema.json | /properties/seq | minimum | 1 |
| 201 | schemas/v8/boundary-flux-packet.schema.json | /properties/mode | enum | stochastic, residual |
| 202 | schemas/v8/boundary-flux-packet.schema.json | /properties/flux/items | required | key, mu_out, mu_in |
| 203 | schemas/v8/boundary-flux-packet.schema.json | /properties/flux/items | additionalProperties | false |
| 204 | schemas/v8/boundary-flux-packet.schema.json | /properties/flux/items/properties/mu_out | minimum | 0 |
| 205 | schemas/v8/boundary-flux-packet.schema.json | /properties/flux/items/properties/mu_in | minimum | 0 |
| 206 | schemas/v8/boundary-flux-packet.schema.json | /properties/flux/items/properties/var_c_boundary | minimum | 0 |
| 207 | schemas/v8/boundary-flux-packet.schema.json | /properties/flux/items/properties/k_out | minimum | 0 |
| 208 | schemas/v8/boundary-flux-packet.schema.json | /properties/flux/items/properties/k_in | minimum | 0 |
| 209 | schemas/v8/boundary-flux-packet.schema.json | /properties/flux/items/properties/residual | exclusiveMinimum | -1 |
| 210 | schemas/v8/boundary-flux-packet.schema.json | /properties/flux/items/properties/pending | minimum | 0 |
| 211 | schemas/v8/boundary-flux-packet.schema.json | /$defs/digest | required | total_entities, hash |
| 212 | schemas/v8/domain-config.schema.json | / | required | domains, metrics, solver |
| 213 | schemas/v8/domain-config.schema.json | /properties/domains | minItems | 1 |
| 214 | schemas/v8/domain-config.schema.json | /properties/domains/items | required | id, tier, location, volume_fL |
| 215 | schemas/v8/domain-config.schema.json | /properties/domains/items/properties/tier | enum | T1, T2, T3 |
| 216 | schemas/v8/domain-config.schema.json | /properties/domains/items/properties/volume_fL | exclusiveMinimum | 0 |
| 217 | schemas/v8/domain-config.schema.json | /properties/domains/items/properties/geometry_template | enum | box, slab, sphere, spherical_shell, cylinder |
| 218 | schemas/v8/domain-config.schema.json | /properties/domains/items/properties/grid | required | n, h_m |
| 219 | schemas/v8/domain-config.schema.json | /properties/domains/items/properties/grid/properties/n | minimum | 4 |
| 220 | schemas/v8/domain-config.schema.json | /properties/domains/items/properties/grid/properties/h_m | exclusiveMinimum | 0 |
| 221 | schemas/v8/domain-config.schema.json | /properties/domains/items/if/properties/tier | const | T3 |
| 222 | schemas/v8/domain-config.schema.json | /properties/domains/items/then | required | geometry_template, grid |
| 223 | schemas/v8/domain-config.schema.json | /properties/adjacency/items | minItems | 2 |
| 224 | schemas/v8/domain-config.schema.json | /properties/adjacency/items | maxItems | 2 |
| 225 | schemas/v8/domain-config.schema.json | /properties/metrics | required | w1, w2, tau_high, tau_low, t_min |
| 226 | schemas/v8/domain-config.schema.json | /properties/metrics/properties/w1 | minimum | 0 |
| 227 | schemas/v8/domain-config.schema.json | /properties/metrics/properties/w2 | minimum | 0 |
| 228 | schemas/v8/domain-config.schema.json | /properties/metrics/properties/tau_high | exclusiveMinimum | 0 |
| 229 | schemas/v8/domain-config.schema.json | /properties/metrics/properties/tau_low | minimum | 0 |
| 230 | schemas/v8/domain-config.schema.json | /properties/metrics/properties/t_min | exclusiveMinimum | 0 |
| 231 | schemas/v8/domain-config.schema.json | /properties/metrics/properties/gp_length_scale_m | exclusiveMinimum | 0 |
| 232 | schemas/v8/domain-config.schema.json | /properties/solver | required | epsilon_max, fallback, window_min_s |
| 233 | schemas/v8/domain-config.schema.json | /properties/solver/properties/epsilon_max | exclusiveMinimum | 0 |
| 234 | schemas/v8/domain-config.schema.json | /properties/solver/properties/fallback | const | fv3d |
| 235 | schemas/v8/domain-config.schema.json | /properties/solver/properties/window_min_s | exclusiveMinimum | 0 |
| 236 | schemas/v8/domain-config.schema.json | /properties/solver/properties/cle_threshold | minimum | 0 |
| 237 | schemas/v8/domain-metrics.schema.json | / | required | domain_id, t, score, laplacian, entropy, dSdt, action |
| 238 | schemas/v8/domain-metrics.schema.json | /properties/t | minimum | 0 |
| 239 | schemas/v8/domain-metrics.schema.json | /properties/score | minimum | 0 |
| 240 | schemas/v8/domain-metrics.schema.json | /properties/laplacian | minimum | 0 |
| 241 | schemas/v8/domain-metrics.schema.json | /properties/entropy | minimum | 0 |
| 242 | schemas/v8/domain-metrics.schema.json | /properties/entropy | maximum | 1 |
| 243 | schemas/v8/domain-metrics.schema.json | /properties/dSdt | minimum | 0 |
| 244 | schemas/v8/domain-metrics.schema.json | /properties/action | enum | hold, promote, demote |
| 245 | schemas/v8/domain-metrics.schema.json | /properties/tier_before | enum | T1, T2, T3 |
| 246 | schemas/v8/domain-metrics.schema.json | /properties/tier_after | enum | T1, T2, T3 |
| 247 | schemas/v8/domain-metrics.schema.json | /properties/elevation | enum | gpr, inverse_diffusion, none |
| 248 | schemas/v8/domain-metrics.schema.json | /properties/surrogate/properties/error | minimum | 0 |
| 249 | schemas/v8/ledger-transaction.schema.json | / | required | from, to, seq, t, base_version, items |
| 250 | schemas/v8/ledger-transaction.schema.json | / | additionalProperties | false |
| 251 | schemas/v8/ledger-transaction.schema.json | /properties/from | minLength | 1 |
| 252 | schemas/v8/ledger-transaction.schema.json | /properties/to | minLength | 1 |
| 253 | schemas/v8/ledger-transaction.schema.json | /properties/seq | minimum | 1 |
| 254 | schemas/v8/ledger-transaction.schema.json | /properties/t | minimum | 0 |
| 255 | schemas/v8/ledger-transaction.schema.json | /properties/base_version/additionalProperties | minimum | 0 |
| 256 | schemas/v8/ledger-transaction.schema.json | /properties/items | minItems | 1 |
| 257 | schemas/v8/ledger-transaction.schema.json | /properties/items/items | required | key, dn |
| 258 | schemas/v8/ledger-transaction.schema.json | /properties/items/items | additionalProperties | false |
| 259 | schemas/v8/ledger-transaction.schema.json | /properties/items/items/properties/dn/not | const | 0 |
| 260 | schemas/v8/ledger-transaction.schema.json | /properties/residual/additionalProperties | exclusiveMinimum | -1 |
| 261 | schemas/v8/ledger-transaction.schema.json | /properties/pending/additionalProperties | minimum | 0 |
| 262 | schemas/v8/ledger-transaction.schema.json | /properties/mode | enum | stochastic, residual |

## 14. 시험 — node:test 와 스크립트 check

| # | 파일:줄 | 종류 | 이름 |
|---|---|---|---|
| 1 | tests/assumptions.test.mjs:23 | node:test | ① 사슬: 지금 원장은 통과 — 값 하나 바꾸기·사건 빼기·번호 바꾸기는 잡힌다 |
| 2 | tests/assumptions.test.mjs:33 | node:test | ② 풀기: 번호를 다른 자리에 옮겨 붙이면·없는 번호면 거부 · 번호 없는 시나리오는 같은 객체와 같은 글자 |
| 3 | tests/assumptions.test.mjs:47 | node:test | ③ 최신 따라가기 없음: 고친 새 번호가 있어도 옛 번호를 가리킨 시나리오는 옛 숫자 |
| 4 | tests/assumptions.test.mjs:58 | node:test | ④ 새 기록 검사: 통과 1 + 거부 사유별 |
| 5 | tests/assumptions.test.mjs:78 | node:test | ⑤ 서기: 봉인이 없으면 못 쓰고, 번호는 순번으로 붙는다 · 사슬이 이어진다 |
| 6 | tests/assumptions.test.mjs:91 | node:test | ⑥ 등록은 번호로만: 인라인 가상 숫자가 있는 시나리오는 등록 거부 (쓰기 전에) |
| 7 | tests/assumptions.test.mjs:97 | node:test | ⑦ 거꾸로 색인: 번호로 가리킨 시나리오 + 등록된 인라인 시나리오의 내용 일치 |
| 8 | tests/assumptions.test.mjs:105 | node:test | ⑧ 변환 결과: 모든 시나리오가 풀리고 같은 자리·같은 값은 한 번호 · 원장 감사 통과 |
| 9 | tests/collection_audit.test.mjs:11 | node:test | ① 제대로 조사·값 없음 → PASS (못 찾음을 정직히 표시) |
| 10 | tests/collection_audit.test.mjs:15 | node:test | ② 값 후보(출처+인용) 미검증 → REVIEW_REQUIRED (자동 PASS 금지) |
| 11 | tests/collection_audit.test.mjs:19 | node:test | ③ 근거 없는 값 → REJECTED (꼼수: 미확인을 사실처럼) |
| 12 | tests/collection_audit.test.mjs:24 | node:test | ④ 가짜/틀린 출처 형식 → REJECTED |
| 13 | tests/collection_audit.test.mjs:29 | node:test | ⑤ 상태-내용 불일치 → REJECTED (못 찾음인데 값 있음) |
| 14 | tests/collection_audit.test.mjs:33 | node:test | ⑥ 재사용: db 에 없는 대상 → REJECTED · 있는 대상 → 통과 |
| 15 | tests/collection_audit.test.mjs:39 | node:test | ⑦ outcome 누락·빈 입력 → INCOMPLETE |
| 16 | tests/collection_audit.test.mjs:45 | node:test | ⑧ 출처 해석 확인(#4): 해석 안 됨 → REJECTED · 됨 → 통과 |
| 17 | tests/collection_audit.test.mjs:52 | node:test | ⑨ 실행 기록 파서 + 교차 검사(#2) |
| 18 | tests/collection_audit.test.mjs:69 | node:test | ⑩ 인용–원문: 전문·초록에 있으면 대조 문제 없음 (엔터티·± 기호 정규화 포함) |
| 19 | tests/collection_audit.test.mjs:75 | node:test | ⑪ 인용–원문: 전문이 있는데 없는 인용 → REJECTED · 참고문헌 목록의 남의 제목은 이 논문의 문장이 아니다 |
| 20 | tests/collection_audit.test.mjs:80 | node:test | ⑫ 인용–원문: 초록만 있고 거기 없음·원문 없음·그림 전사·너무 짧은 인용 → 사람 확인 (거부 아님) |
| 21 | tests/collection_audit.test.mjs:88 | node:test | ⑬ 수신함 실물: Henderson 1996 공개 전문(PMC2120915)에서 인용을 찾는다 · 초록 기록의 pmcid 로 전문을 잇는다 |
| 22 | tests/conservation.test.mjs:12 | node:test | ⓐ 모든 observable 이 유효한 conservation.{class,reason} 를 가진다 |
| 23 | tests/conservation.test.mjs:21 | node:test | ⓑ 분류가 doctrine 과 맞는다 — 카운트=보존, 나머지=비보존 |
| 24 | tests/conservation.test.mjs:29 | node:test | ⓒ class·reason 이 사전 register 로 노출된다 (나중 적분장이 참조) |
| 25 | tests/dictionary.test.mjs:14 | node:test | ① R1 왕복 — 렌더 → 회수가 모든 키·청중에서 동일 |
| 26 | tests/dictionary.test.mjs:29 | node:test | ② R2 통과 — 자유 서술은 바이트 동일로 통과(생성 아님) |
| 27 | tests/dictionary.test.mjs:39 | node:test | ③ 미등록 토큰 거부 — 조회·렌더·번역 모두 오류(추론으로 메우지 않음) |
| 28 | tests/dictionary.test.mjs:48 | node:test | ④ 병합 형태 — ko(vocab 권위) + en(overlay) 한 항목, 사실 복제 없음 |
| 29 | tests/dictionary.test.mjs:65 | node:test | ⑤ register 확장 — gapTypes·observables·qualitativeExpectations 일반화(모든 키 overlay·왕복) |
| 30 | tests/dictionary.test.mjs:79 | node:test | ⑥ 이름공간 — 같은 키가 두 register 에 있으면 맨 키는 모호(오류), register/key 로만 (고르지 않는다) |
| 31 | tests/dictionary.test.mjs:89 | node:test | ⑦ 판결 모듈의 라벨 = vocab 표 (코드에 문구 복사본 없음) |
| 32 | tests/dictionary.test.mjs:97 | node:test | ⑧ core.js 번역 함수 + 주입 라벨러 — ko 는 기본과 바이트 동일, en 은 지어내지 않음, 행정부는 사전을 부르지 않음 |
| 33 | tests/dictionary_seal.test.mjs:21 | node:test | ① 지금 사슬은 통과 — vocab 의 모든 토큰에 영어 항목 |
| 34 | tests/dictionary_seal.test.mjs:27 | node:test | ② 변조·삭제는 거부 |
| 35 | tests/dictionary_seal.test.mjs:35 | node:test | ③ 잘못된 새 항목은 거부 |
| 36 | tests/dictionary_seal.test.mjs:51 | node:test | ④ 고치기는 revises 로 — 서기는 봉인 있을 때만 사슬 끝에 붙인다 |
| 37 | tests/dose_slope.test.mjs:18 | node:test | ① set_amount 교란 — 시작량만 바꾸고 사법부 재구성이 통과, 잘못된 선언은 거부 |
| 38 | tests/dose_slope.test.mjs:30 | node:test | ② 관찰 검사 — 용량 축 없음·값 하나·없는 규칙 거부 |
| 39 | tests/dose_slope.test.mjs:39 | node:test | ③ 결정론 모델의 기울기 ≈ 1/ΔL — 동어반복을 숫자로 (L000116) |
| 40 | tests/dose_slope.test.mjs:49 | node:test | ④ 추정용 기울기는 판정하지 않음 (순환 방지) |
| 41 | tests/dose_slope.test.mjs:54 | node:test | ⑤ 첫 장면 기원 — ΔL 은 숫자 출처 없음, 핵질 부피는 한계 경로로, 성장 인자 신호는 기원 없음 |
| 42 | tests/dose_slope.test.mjs:68 | node:test | ⑥ 정량 맥락 이전: 생쥐 측정을 사람 모델로 판정하면 표시 · 같은 종이면 종은 같음 · 글에도 나온다 (판정은 막지 않음) |
| 43 | tests/fate_suite.js:42 | 스크립트 check | A 계통 충실도 — ${name}: 최종 ${tgt} |
| 44 | tests/fate_suite.js:43 | 스크립트 check | A 계통 충실도 — ${name}: 결정 시점 존재·격자 단조·도달보다 먼저 |
| 45 | tests/fate_suite.js:44 | 스크립트 check | A 계통 충실도 — ${name}: 정지·사후 분석 없음 |
| 46 | tests/fate_suite.js:48 | 스크립트 check | B 경쟁 — IL-12 + IL-15 + 자원 충분 → 효과기 우세 (IL-12 가 Eomes 를 누름) |
| 47 | tests/fate_suite.js:55 | 스크립트 check | C 결정 비가역성 — 결정 전 철회 (1 h < 결정 ${h(tC)}) → 시작 상태로 되돌아감 |
| 48 | tests/fate_suite.js:56 | 스크립트 check | C 결정 비가역성 — 철회(경계 조건 불연속) → 단계 제어가 다시 잘게 (철회 구간 단계 > 직전 구간), 수렴 기준과 같은 최종 상태·L2 < 1e-6 |
| 49 | tests/fate_suite.js:58 | 스크립트 check | C 결정 비가역성 — 결정 후 철회 (2 h > 결정 ${h(tC)}) → 효과기 유지 |
| 50 | tests/fate_suite.js:61 | 스크립트 check | D 분화 정지 — IL-12 + 포도당 결핍 → 효과기 도달 못 함, 원인 resource_exhaustion |
| 51 | tests/fate_suite.js:62 | 스크립트 check | D 분화 정지 — 사후 분석: 표지 T-bet → 피루브산 허가 → 해당과정 → 고갈 저장소 포도당@세포질 (고갈 시각 < 정지 시각) |
| 52 | tests/fate_suite.js:63 | 스크립트 check | D 분화 정지 — 교정 제안이 등록된 Resource_Gap(포도당 흡수)을 가리킴 |
| 53 | tests/fate_suite.js:65 | 스크립트 check | D 분화 정지 — IL-15 + 지방산 결핍 → 시작 상태에서 정지, 제한 팔미토일-CoA |
| 54 | tests/fate_suite.js:68 | 스크립트 check | E 다른 운명 — IL-12 + IL-15 + 포도당 결핍 → 효과기 대신 기억 전구 (최적 조건과 다른 운명) |
| 55 | tests/fate_suite.js:69 | 스크립트 check | E 다른 운명 — 다른 운명의 원인 사슬이 고갈된 포도당까지 |
| 56 | tests/fate_suite.js:80 | 스크립트 check | F 다중 규모 정확도 — ${name} ${hours} h: 표지 궤적 상대 L2 < 1e-6 (수렴 기준 대비), 같은 최종 상태 |
| 57 | tests/fate_suite.js:81 | 스크립트 check | F 다중 규모 정확도 — ${name} ${hours} h: 강성(단계 크기 범위 ≥ 10³)을 L-안정 단계가 흡수, 수렴 기준보다 빠름 |
| 58 | tests/fate_suite.js:82 | 스크립트 check | G 질량 — ${name} 수렴 기준 실행: 원장 상대 편차 ≤ 1e-14 |
| 59 | tests/fate_suite.js:94 | 스크립트 check | H 과정 보고서 — ${k}: 무결성 증명서 PASS (${rep.checks.length} 확인) |
| 60 | tests/fate_suite.js:95 | 스크립트 check | H 과정 보고서 — ${k}: 실행 전 예측(expect)과 관찰이 같음 |
| 61 | tests/fate_suite.js:97 | 스크립트 check | H 과정 보고서 — ${k}: 구간이 0 – 끝을 빈틈없이 덮고 변곡점 ≥ 3 (끝 상태만이 아님) |
| 62 | tests/fate_suite.js:104 | 스크립트 check | I 확률 앙상블 — 혼합-최적: 결정론 끝 상태(${det.final.state})의 앙상블 비율 구간이 1 을 포함 |
| 63 | tests/fate_suite.js:105 | 스크립트 check | I 확률 앙상블 — 도달 시각 분포가 결정론 도달 시각을 감쌈 (10–90%) |
| 64 | tests/fate_suite.js:106 | 스크립트 check | I 확률 앙상블 — 모든 궤적 원장·재생 ≤ 1e-14, 발화 정수, 엔진 결함 없음 |
| 65 | tests/gap_schema.test.mjs:14 | node:test | ① 정규화가 구조 필드를 보존 — 없으면 그대로 |
| 66 | tests/gap_schema.test.mjs:28 | node:test | ② 재검토 후보 — at 이후 대상·하류에 새 관찰·값 |
| 67 | tests/gap_schema.test.mjs:51 | node:test | ③ 재검토 후보는 병합 관문을 막지 않는다 |
| 68 | tests/governance.test.mjs:43 | node:test | ① 쓰기 권한: 파일 쓰기 코드는 legislative/clerk.mjs 와 migrations/ 에만 |
| 69 | tests/governance.test.mjs:53 | node:test | ② 행정부: 사법·입법·조정자를 부르지 않고, 감사 코드·verified 선언이 없다 |
| 70 | tests/governance.test.mjs:64 | node:test | ② 행정부는 관찰을 모른다: 관찰 기록·관찰 연산자·관찰 판정을 읽지 않음 (4단계 — 관찰에 맞추느라 결함을 덮는 순환 방지) |
| 71 | tests/governance.test.mjs:77 | node:test | ② 행정부 결과에는 판결 필드가 없다 (원자료만) |
| 72 | tests/governance.test.mjs:92 | node:test | ③ 사법부: 엔진을 실행하지 않고 쓰지 않는다 · 입법 초안은 검사하지 않는다 |
| 73 | tests/governance.test.mjs:106 | node:test | ④ 증명 등록부: 도장 없는 verified 는 오류, 변조·위조 도장은 무효 |
| 74 | tests/governance.test.mjs:130 | node:test | ④ 입법 서기: 봉인 없는·변조된·다른 db 의 판결로는 쓰지 않는다 · 보호 위치에 보고서를 쓰지 않는다 |
| 75 | tests/governance.test.mjs:145 | node:test | ④‴ 봉인 = 병합 규약: dbtool 을 거치지 않아도 why·미등록 한계·정제 점검이 관문에서 막힌다 (판정이 CLI 에만 있으면 서기 경로가 건너뛴다) |
| 76 | tests/governance.test.mjs:164 | node:test | ④′ 구역(Zone): 쓰기는 모두 구역을 지나고, 저장소 안의 다른 구역에 쓰려 하면 거부된다 |
| 77 | tests/governance.test.mjs:197 | node:test | ④″ CI 설정이 실제로 파싱되는가 — 검사가 조용히 죽지 않게 |
| 78 | tests/governance.test.mjs:216 | node:test | ⑤ 독립 검증: 엔진 원자료를 몰래 바꾸면 사법부 검증기·판결이 잡는다 |
| 79 | tests/governance.test.mjs:231 | node:test | ⑥ 결합점 등록부: 시나리오 → 데이터(params) → 기본값, 엔진 코드를 고치지 않고 값이 바뀐다 |
| 80 | tests/governance.test.mjs:244 | node:test | ⑦ 원자료 계약 (FFI): 엔진 출력은 schemas/ffi/fate-raw.schema.json 을 지키고, 어기면 사법부가 판정하지 않는다 |
| 81 | tests/governance.test.mjs:264 | node:test | ⑧ 컴파일러 IR (0.5단계): 순수 · 엔진은 IR 만 먹음 · 사법부가 해시·법칙·기호 도함수를 독립 검증 |
| 82 | tests/governance.test.mjs:303 | node:test | ⑨ 결함 출처 태그: 모든 감사 항목이 6 분류 중 하나 — 결과는 FINDING, 엔진·컴파일러·수치·데이터 결함은 각자의 층으로 |
| 83 | tests/governance.test.mjs:330 | node:test | ⑩ 델타 기록 (S1): 기원 봉인 → 병합마다 사건 추가 → 재생 = db · 사건·스냅숏·db 변조를 사법부가 잡는다 |
| 84 | tests/governance.test.mjs:369 | node:test | ⑬ 사법부: 철회 전파 — 관찰에 기댄 값·단계·경로를 드러낸다 (읽기만) |
| 85 | tests/governance.test.mjs:404 | node:test | ⑭ 사법부: 증거·방법 보고서 — 측정/가정을 가르고, 실패를 숨기지 않는다 (읽기만, db 불변) |
| 86 | tests/governance.test.mjs:449 | node:test | ⑭′ 사법부: 증거 보고서 — 세포 상태 계 · 파생(교란) 시나리오 · 사전 등록 판정 수준 |
| 87 | tests/governance.test.mjs:481 | node:test | ⑮ 표·로직 분리 — 사전은 vocab 만 읽고, 결함 표는 vocab.faultChannels 에만 |
| 88 | tests/governance.test.mjs:492 | node:test | ⑭″ 시나리오 대상 색인 subjects.json — 빠짐·남음·잘못된 대상 없음, 42개 모두 보고서 |
| 89 | tests/mcp.test.mjs:27 | node:test | ① 프로토콜: initialize 답 · 알림에는 답하지 않음 · 모르는 메서드는 -32601 |
| 90 | tests/mcp.test.mjs:35 | node:test | ② query: dbtool map 과 같은 글 · 같은 파일이면 다시 읽지 않음 · db 가 바뀌면 다시 읽음 |
| 91 | tests/mcp.test.mjs:62 | node:test | ③ 역할: 기본 collector 는 clerk 의 권위 쓰기를 못 보고, 불러도 거부 · 모르는 역할은 시작 거부 |
| 92 | tests/mcp.test.mjs:75 | node:test | ④ clerk 단일 작성자: 하나가 떠 있으면 둘째는 시작하지 않는다 |
| 93 | tests/mcp.test.mjs:85 | node:test | ⑤ 핸드오프: 이름 검사 · 붙이기만 (앞 줄 그대로) |
| 94 | tests/mcp.test.mjs:96 | node:test | ⑥ 받기 기록 검사: 통과 · 사슬 변조 · 받은 뒤 파일이 바뀜 · 파일이 사라짐 |
| 95 | tests/mcp.test.mjs:107 | node:test | ⑦ 삼권: query·fetch 는 파일을 직접 쓰지 않는다 — 쓰기는 입법 서기(clerk.mjs)를 지난다 |
| 96 | tests/mcp.test.mjs:114 | node:test | ⑧ fetch 인자 검사 (네트워크 없음): PMID 형식이 아니면 받기 전에 거부 |
| 97 | tests/mhc.test.mjs:35 | node:test | MHC ①: 기전 프로그램의 단계가 모두 반응 규칙이 되고 가역 결합은 정·역 두 채널 |
| 98 | tests/mhc.test.mjs:55 | node:test | MHC ②: 사법부가 단계 법칙을 독립으로 다시 세움 — 속도·도함수 ≤ 1e-14, 유한차분 ≤ 1e-6 |
| 99 | tests/mhc.test.mjs:67 | node:test | MHC ③: 무결성 — 원장·재생 1e-14, 단계 화학량을 db.steps 에서 다시 셈, LPS 가 성숙의 원인 |
| 100 | tests/mhc.test.mjs:81 | node:test | MHC ⑨: 상수 등급 관문 — 가상 상수는 hypothetical 선언 아래에서만, 선언을 빼면 운명 판정이 거부한다 |
| 101 | tests/mhc.test.mjs:99 | node:test | MHC ④: 맥락 선언(원인·필수성·일반 상황)이 실행과 맞아야 한다 — 틀린 선언은 판정 실패 |
| 102 | tests/mhc.test.mjs:121 | node:test | MHC ⑤: 사건 시각이 관찰 격자 Δ 에 묶이지 않음 (30–300 s 에서 0.01 s 안) |
| 103 | tests/mhc.test.mjs:127 | node:test | MHC ⑥: JS 기준 구현 = Rust 백엔드 (궤적 ≤ rtol, 끝 상태·도달 시각 같음) |
| 104 | tests/mhc.test.mjs:137 | node:test | MHC ⑦: 확률 실행 — 같은 (seed, 궤적) 재현, 발화 수는 음이 아닌 정수 |
| 105 | tests/mhc.test.mjs:151 | node:test | MHC ⑧: 경계 — 모든 저장소가 0 에서 시작해도 음수가 생기지 않고 합성으로 채워진다 |
| 106 | tests/mhc.test.mjs:162 | node:test | MHC ⑩: null 시나리오 = 기준 + 교란 한 줄 (build-plan 9) — 교란 차이 검사 통과 · 필수성은 같은 대조군과 비교 |
| 107 | tests/mhc.test.mjs:185 | node:test | MHC ⑪: 접은 상수 cinv = 1/(N_A·V) (엔진 단계 0) — 사법부가 부피에서 따로 계산해 비트까지 대조, 꾸민 값은 거부 |
| 108 | tests/observations.test.mjs:24 | node:test | ① 계약: 합성 예시는 모양을 지키고, 값만 있는 관찰은 모양에서 거부 |
| 109 | tests/observations.test.mjs:32 | node:test | ② 관문: 올바른 관찰은 통과(O 번호 배정), 합성·불확도 없음·SI 아님·보정 불일치는 거부 |
| 110 | tests/observations.test.mjs:57 | node:test | ③ 실측 상수 = 관찰의 파생값: from 이 같은 규칙·칸·값을 가리켜야 하고, 검증용 관찰은 추정에 못 씀 |
| 111 | tests/observations.test.mjs:69 | node:test | ④ 변경 불가: 관찰은 바꾸거나 지울 수 없고, 철회 표시만 더할 수 있음 |
| 112 | tests/observations.test.mjs:88 | node:test | ⑤ 무손실: 정규화 멱등, 저장소는 v12, 관찰 밖 필드는 형식 변환에서 그대로 |
| 113 | tests/observations.test.mjs:98 | node:test | ⑥ 관측 커버리지 지도 (48): 예측 가능한 측정량마다 검증 관찰, 정량 검증 0 = 사각 |
| 114 | tests/perturb.test.mjs:22 | node:test | ① knockout: 시작량 0 · 생성 규칙 제외 · 묶음 번호 그대로 · 실행 내내 0 |
| 115 | tests/perturb.test.mjs:37 | node:test | ② block · inhibit · clamp · dose_series |
| 116 | tests/perturb.test.mjs:57 | node:test | ③ 교란 IR 해시 · 없는 대상 · 잘못된 선언 |
| 117 | tests/perturb.test.mjs:74 | node:test | ④ 교란 차이 검사: 교란 외에는 대조군과 같다 — 사법부 독립 재구성 |
| 118 | tests/protocol.test.mjs:23 | node:test | ① 규약 구조: 완결하면 통과, 빠지면 사유 |
| 119 | tests/protocol.test.mjs:42 | node:test | ① 반복 수: 확률 실행은 n ≥ ⌈(z₁₋α/₂ + z_power)²σ²/Δ²⌉, 결정론은 1 |
| 120 | tests/protocol.test.mjs:53 | node:test | ② 사전 등록: 봉인·중복·사후 수정·실행 시각·사슬 변조 |
| 121 | tests/qual_compare.test.mjs:20 | node:test | ① 방향: 결정론은 분해능, 앙상블은 z 검정 — 못 보이면 불일치가 아니라 보이지 못함 |
| 122 | tests/qual_compare.test.mjs:35 | node:test | ① 유무 · 단조 · 순서 · 무효 · 결론 조건 |
| 123 | tests/qual_compare.test.mjs:60 | node:test | ② 우연 기준선: 포아송 이항 P(K ≥ k) |
| 124 | tests/qual_compare.test.mjs:70 | node:test | ② 증거 독립 (M3·L4): 같은 실험·출처는 한 단위로 묶고 비독립 표시 |
| 125 | tests/qual_compare.test.mjs:83 | node:test | ② 경험적 우연 확률: 같은 실행의 다른 읽을 거리에 같은 규칙 — 방향은 비율, 순서는 오름 사슬 / 순서쌍 |
| 126 | tests/qual_compare.test.mjs:93 | node:test | ③ 조정자 결정론: 합성 규칙을 막으면 산물이 줄어듦 — 교란 차이 검사 통과, 분해능 = 수치 오차 + 분자 1 개 |
| 127 | tests/qual_compare.test.mjs:111 | node:test | ④ 조정자 앙상블: 출생–사멸 해석해 — 합성 절반이면 평균이 E(t)/2 줄어듦, 거의 0 인 교란은 δ 로 효과 없음 |
| 128 | tests/qual_graph.test.mjs:31 | node:test | 지지 · 모순 후보 · 경로 없음 (교란 부호 × 경로 부호 = 예측 변화) |
| 129 | tests/qual_graph.test.mjs:43 | node:test | 부호 섞임: 부호가 다른 경로 · 효과를 모르는 조절 간선 |
| 130 | tests/qual_graph.test.mjs:50 | node:test | 음성 되먹임(B ⊣ r1)은 직접 효과의 부호를 뒤집지 않는다 · knockout 은 대상의 다른 형태를 지나지 않는다 |
| 131 | tests/qual_graph.test.mjs:58 | node:test | 세포 상태: 표지 서명(high +)으로 상태 비율에 닿음 |
| 132 | tests/qual_graph.test.mjs:64 | node:test | 효과 없음 주장 · 0 층 판정 대상이 아닌 것 |
| 133 | tests/qual_graph.test.mjs:72 | node:test | 양방향 색인: 교란 대상 · 읽을 거리(묶음과 정의항) · 맥락 열쇠 — 철회된 것은 빠짐 |
| 134 | tests/qual_graph.test.mjs:89 | node:test | 지금 저장소: 기전 그래프가 서고, 정성 관찰이 없으면 판정 행도 없다 |
| 135 | tests/qual_graph.test.mjs:96 | node:test | 정확 탐색: 첫 도달 너비 우선이 놓치던 부호를 찾는다 · 지금 db 는 탐색 상한에 닿지 않는다 |
| 136 | tests/qualitative.test.mjs:30 | node:test | ① 정성 관찰: 맞는 모양은 관문 통과 · 기록 시각이 찍힘 |
| 137 | tests/qualitative.test.mjs:42 | node:test | ① 정성 관찰: 구절·1차 문헌·교란·읽을 거리·용도 위반은 거부 |
| 138 | tests/qualitative.test.mjs:63 | node:test | ① 정성 관찰은 수치(속도 상수·정의항 obs)의 근거가 될 수 없다 |
| 139 | tests/qualitative.test.mjs:72 | node:test | ② 관찰 입력 계약: kind 로 모양을 고른다 |
| 140 | tests/qualitative.test.mjs:82 | node:test | ③ 맥락 열쇠: 여섯 칸 · 빈 칸 null · 조건 정렬 · 자유 문장은 열쇠 밖 |
| 141 | tests/qualitative.test.mjs:99 | node:test | ③ 같은 열쇠의 현재 값이 둘이면 거부 (새 값은 supersedes 로) |
| 142 | tests/qualitative.test.mjs:106 | node:test | ④ 새 관찰은 기록 시각을 가진다 |
| 143 | tests/qualitative.test.mjs:112 | node:test | ⑤ 번호 이동: 병합이 옛 번호를 지우고 기록 · 조회는 따라감 · 이동된 번호를 가리키면 거부 |
| 144 | tests/qualitative.test.mjs:139 | node:test | ⑥ V8 맥락 이전: 추정·판정 세포가 다르면 깃발 · 같으면 없음 · 한쪽만 선언은 비교 못 함 |
| 145 | tests/rejections.test.mjs:19 | node:test | ① 거부 말뭉치: 나쁜 패치가 모두 거부되고, 사유가 그대로다 |
| 146 | tests/rejections.test.mjs:31 | node:test | ② 래칫: 말뭉치 수·검사 자리 수·시험 수가 바닥값 아래로 내려가지 않는다 |
| 147 | tests/rejections.test.mjs:42 | node:test | ③ 건너뛴 시험이 없다 (규칙을 느슨하게 하면서 시험만 skip 하는 수를 막는다) |
| 148 | tests/retraction_propagation.test.mjs:21 | node:test | ① 검증 세트 관찰 철회 → 등록된 결론은 재검증 필요 (라벨) |
| 149 | tests/retraction_propagation.test.mjs:32 | node:test | ② 철회 파생 그래프가 사전 등록 결론까지 |
| 150 | tests/retraction_propagation.test.mjs:42 | node:test | ③ 재검증은 내용에 키잉 — 메모 대체는 같음, 값 변경·철회는 재검증 |
| 151 | tests/retraction_propagation.test.mjs:63 | node:test | ④ 보고서의 의존 블록 왕복 |
| 152 | tests/rules.test.mjs:54 | node:test | 현재 저장소는 오류·경고 없음 |
| 153 | tests/rules.test.mjs:60 | node:test | 예시 패치는 관문을 통과 |
| 154 | tests/rules.test.mjs:67 | node:test | 새 항목은 다음 번호를 받고, 임시 번호 참조도 함께 바뀜 |
| 155 | tests/rules.test.mjs:77 | node:test | 삭제한 번호는 다시 쓰지 않음 |
| 156 | tests/rules.test.mjs:85 | node:test | 번호 배정기가 쓰인 번호보다 작으면 오류 |
| 157 | tests/rules.test.mjs:86 | node:test | 이름을 바꿔도 번호와 연결은 그대로, 옛 이름은 별칭으로 남음 |
| 158 | tests/rules.test.mjs:93 | node:test | 없는 번호로 수정하면 거부 |
| 159 | tests/rules.test.mjs:97 | node:test | 정의항을 다른 개념으로 옮길 수 없음 |
| 160 | tests/rules.test.mjs:100 | node:test | 이전 형식 패치(v2·v3)는 거부 |
| 161 | tests/rules.test.mjs:104 | node:test | 저장소 형식 버전이 다르면 오류 |
| 162 | tests/rules.test.mjs:110 | node:test | 기존 정의항 수정은 적은 최상위 필드만 바꾸고 나머지(부위·규칙·설명)는 유지 |
| 163 | tests/rules.test.mjs:116 | node:test | 설명(desc)을 추가하면 설명 전체를 교체 (맥락별 설명은 여러 개) |
| 164 | tests/rules.test.mjs:124 | node:test | 별칭이 기존 개념의 이름과 겹치는 새 개념은 거부 |
| 165 | tests/rules.test.mjs:127 | node:test | 띄어쓰기만 다른 이름은 기존 개념으로 매핑되고, 설명 없는 새 뜻 추가는 거부 |
| 166 | tests/rules.test.mjs:133 | node:test | 영문 이름·그리스 문자 표기 차이도 같은 개념 |
| 167 | tests/rules.test.mjs:138 | node:test | 뜻이 여러 개인 이름으로 연결하면 거부, "이름#n" 은 통과 |
| 168 | tests/rules.test.mjs:143 | node:test | 외부 ID 로 연결하면 정의항 번호로 매핑 |
| 169 | tests/rules.test.mjs:147 | node:test | 없는 개념으로 연결하면 거부 |
| 170 | tests/rules.test.mjs:150 | node:test | 예약 문자(# @ \| /)가 든 이름은 거부 |
| 171 | tests/rules.test.mjs:156 | node:test | 어휘에 없는 kind·field·위치·특징은 거부 |
| 172 | tests/rules.test.mjs:162 | node:test | 어휘 별칭은 표준 키로 바뀜 |
| 173 | tests/rules.test.mjs:169 | node:test | 필수 외부 ID 가 없고 미매핑 사유도 없으면 거부, 사유가 있으면 통과 |
| 174 | tests/rules.test.mjs:173 | node:test | 형식이 틀리거나 kind 에 허용되지 않은 외부 ID 는 거부 |
| 175 | tests/rules.test.mjs:177 | node:test | 이미 다른 정의항에 붙은 외부 ID 는 거부 |
| 176 | tests/rules.test.mjs:180 | node:test | 지문: 형식·kind 검사, 중복 거부, 지문으로 찾기 |
| 177 | tests/rules.test.mjs:190 | node:test | 근거 수준: curated 는 출처, computed 는 도구, predicted 는 confidence 필요 |
| 178 | tests/rules.test.mjs:198 | node:test | 추론은 [Abstracted Logic] 으로 표시하고 무엇에서 추론했는지(basis) 필수 |
| 179 | tests/rules.test.mjs:205 | node:test | kind 제약을 어긴 관계는 거부 |
| 180 | tests/rules.test.mjs:208 | node:test | 정의 문장에 없는 근거 구절은 거부 |
| 181 | tests/rules.test.mjs:211 | node:test | 새 경고를 만드는 패치는 기본 거부, allowWarnings 로만 통과 |
| 182 | tests/rules.test.mjs:216 | node:test | 구성 요소는 복합체의 has_part 위계로 색인됨 (경로 범위 계산에는 빠짐) |
| 183 | tests/rules.test.mjs:223 | node:test | 단백질은 기준 종 필수(패치에서 생략하면 기본 9606), 저분자에는 종 금지 |
| 184 | tests/rules.test.mjs:229 | node:test | 종에 따라 달라지는 관찰은 context.species 필수, 종 별칭은 번호로 |
| 185 | tests/rules.test.mjs:237 | node:test | 단백질·핵산의 수식 부위는 기준 종 잔기 번호, 모르면 residue_unknown 명시 |
| 186 | tests/rules.test.mjs:244 | node:test | 부위 키·특징·막 면 검사 |
| 187 | tests/rules.test.mjs:250 | node:test | 막 위상: 막 결합 분자는 2D 위치, 지질 고정·주변성은 면 필요 |
| 188 | tests/rules.test.mjs:254 | node:test | 복합체 구성 요소: 복합체만, 분자 종류만, 없으면 경고 |
| 189 | tests/rules.test.mjs:260 | node:test | 부위의 on 은 그 복합체의 구성 요소여야 함 |
| 190 | tests/rules.test.mjs:263 | node:test | 규칙: 상태 의미의 부위·특징, 변화 종류의 효과·추가/제거 특징 |
| 191 | tests/rules.test.mjs:271 | node:test | 묶음 객체 { ref, features, location } 은 정렬된 키로 매핑, 단계는 기존 사슬에 자동 연결 |
| 192 | tests/rules.test.mjs:282 | node:test | 묶음 키는 정렬된 표준 형식이어야 함, 부위에 특징은 하나 |
| 193 | tests/rules.test.mjs:287 | node:test | 공간 접촉: 세포 밖 에피네프린은 세포질의 분자와 반응할 수 없음 |
| 194 | tests/rules.test.mjs:293 | node:test | 특수 위치는 부모 안으로 본다 (글리코겐 과립 ⊂ 세포질), 막 위치는 막 분자만 |
| 195 | tests/rules.test.mjs:301 | node:test | 변화량은 규칙 효과와 같아야 함 — 다른 부위가 바뀌거나 빈 상태가 틀리면 거부 |
| 196 | tests/rules.test.mjs:305 | node:test | 수송이 아닌 단계에서 위치가 바뀌면 거부 |
| 197 | tests/rules.test.mjs:308 | node:test | 행위자는 원천 상태 의미 규칙상 비활성이면 안 됨 |
| 198 | tests/rules.test.mjs:312 | node:test | 규칙의 위치 조건(where): 세포막에서만 작동하는 결합 |
| 199 | tests/rules.test.mjs:315 | node:test | 해리: 구성 요소 개수와 결합 상대가 흡수된 부위가 복합체 정의와 맞아야 함 |
| 200 | tests/rules.test.mjs:321 | node:test | 규칙 참조·보조 기질·조절자는 원천 규칙에 정의된 것만 |
| 201 | tests/rules.test.mjs:327 | node:test | 경로(pathway)가 아닌 곳에 단계를 묶으면 거부, 개념은 묶음 바탕이 될 수 없음 |
| 202 | tests/rules.test.mjs:331 | node:test | 행위자 활성은 원천 규칙으로 계산 (첫 번째로 맞는 규칙, when 이 비면 기본값) |
| 203 | tests/rules.test.mjs:343 | node:test | 공간 제약: LPS 는 세포 밖에서만 LBP 와 결합 (세포질 LPS 거부) |
| 204 | tests/rules.test.mjs:347 | node:test | 전달(transfer): 넘겨주는 쪽은 결합 → 빈 상태, 받는 쪽은 빈 상태 → 결합, 리간드는 따로 나타나지 않음 |
| 205 | tests/rules.test.mjs:353 | node:test | 전제 조건(requires): Ser32·Ser36 이 인산화되지 않은 IκBα 는 βTrCP 가 유비퀴틴화하지 못함 |
| 206 | tests/rules.test.mjs:358 | node:test | 분해(degrade): 분해된 IκBα 는 출력에 남지 않고, 나머지 구성 요소와 분해 산물이 나와야 함 |
| 207 | tests/rules.test.mjs:365 | node:test | 동일성 보존: 결합·해리·전달·분해에서 실체(구성 요소·부위의 리간드)가 사라지거나 생기면 거부 |
| 208 | tests/rules.test.mjs:370 | node:test | 수송: 위치를 바꾸는 유일한 방법 — 출발·도착 위치가 규칙과 맞아야 하고, 도착한 대상은 접촉 검사에서 빠짐 |
| 209 | tests/rules.test.mjs:376 | node:test | 시뮬레이션: LPS 에서 시작해 TNF mRNA 까지 도달하고, 유도 경로의 뿌리에 LPS 가 있음 |
| 210 | tests/rules.test.mjs:383 | node:test | 시뮬레이션 음성 대조: LPS 가 없으면 TNF 전사에 이르지 못함 |
| 211 | tests/rules.test.mjs:388 | node:test | 시뮬레이션: 기존 경로도 에피네프린에서 포도당-1-인산까지 유도됨 |
| 212 | tests/rules.test.mjs:393 | node:test | 시뮬레이션: 만들어지지 않는 변환 기질(뉴클레오타이드)은 대사물 풀로 넉넉히, 만들어지는 기질(cAMP)은 보충하지 않음 |
| 213 | tests/rules.test.mjs:402 | node:test | 한계: [Target \| Type \| Requirement] — 대상·종류·해결 경로가 없거나 틀리면 거부 |
| 214 | tests/rules.test.mjs:411 | node:test | 한계는 저장된 상태가 아니라 계산된 상태 — 필요한 데이터가 들어오면 자동으로 resolved |
| 215 | tests/rules.test.mjs:423 | node:test | limitations.md 는 data/db.json 에서 생성된 최신 상태여야 함 |
| 216 | tests/rules.test.mjs:427 | node:test | 상위 개념(motif): kind process 만, 한계 검토(addresses 또는 gap_review) 필수, 없는 한계를 가리키면 거부 |
| 217 | tests/rules.test.mjs:436 | node:test | 패턴 검출: 막–핵 연쇄는 LPS 경로에만, 키네이스 연쇄는 두 경로 모두에 |
| 218 | tests/rules.test.mjs:443 | node:test | 구획 농도 모델: copy_number 관찰 → 시작량, 농도 × 구획 부피 → 분자 수, 없으면 기본값으로 표시 |
| 219 | tests/rules.test.mjs:460 | node:test | 속도 무결성: 법칙·필수 상수·Kd = k_off/k_on·두 분자 결합·효소 규칙 |
| 220 | tests/rules.test.mjs:471 | node:test | 한계 해결 경로 kinetics: 규칙에 속도 상수가 들어오면 Kinetic_Gap 이 자동으로 resolved |
| 221 | tests/rules.test.mjs:477 | node:test | 반응 중심 구조(R2): PDB 만, 정의항 xrefs 에도 같은 구조가 있어야 함 — 3FXI 는 LPS 주머니에 |
| 222 | tests/rules.test.mjs:482 | node:test | 혼합 해상도 계획: LPS 경로는 3차원 0단계, 글리코겐 경로는 cAMP 경쟁(T3) 두 단계만 R2 — 속도 상수가 들어오면 R1 로 해결 |
| 223 | tests/rules.test.mjs:491 | node:test | 속도 기반 시뮬레이션(가상 시나리오): TNF mRNA 에 시간 순서대로 도달, 질량 보존 위반 없음 |
| 224 | tests/rules.test.mjs:501 | node:test | 감사: 잘못된 속도 법칙·Kd 불일치를 잡고, 이중 계산(Gs)은 한계 등록부의 교정 제안으로 연결 |
| 225 | tests/rules.test.mjs:518 | node:test | 공급 규칙(Metabolic_Supply_Rule): 위치 하나·생성물·부분 구조 수지·속도 법칙 |
| 226 | tests/rules.test.mjs:529 | node:test | 공급 외의 규칙은 분자 종류만, zero_order 는 공급 규칙만 |
| 227 | tests/rules.test.mjs:533 | node:test | 분해 규칙(Degradation_Rule): 운명·재활용 단위·1차 속도(k_deg ↔ 반감기) |
| 228 | tests/rules.test.mjs:543 | node:test | 부분 구조 수지: 변환·분해 규칙에서 빠진 산물을 잡는다 (cAMP 만 만들고 피로인산을 빼면 거부) |
| 229 | tests/rules.test.mjs:551 | node:test | 부위의 특징별 리간드(ligands): 특징은 그 부위의 것, 리간드는 분자 |
| 230 | tests/rules.test.mjs:560 | node:test | 기질 고갈(Substrate Exhaustion): 공급이 없으면 GTP 가 바닥나고 Gs 활성화가 멈춘다 — 무너지지 않음 |
| 231 | tests/rules.test.mjs:570 | node:test | 순환 재생(Cycle-driven Regeneration): NDPK·ATP 재생 공급이 GTP–GDP 순환과 ATP 순환을 닫는다 |
| 232 | tests/rules.test.mjs:582 | node:test | 매 단계 질량 감사: 단계에서 부산물(피로인산)을 빼면 첫 발화 시각과 함께 부분 구조 위반 |
| 233 | tests/rules.test.mjs:593 | node:test | 분해(결정론·확률적): 1차 원장, 재활용 화학량을 모르면 소실로 처리하고 한계를 제안, seed 가 같으면 같은 결과 |
| 234 | tests/rules.test.mjs:606 | node:test | 재활용: 서열 길이 관찰이 있으면 분해된 사슬이 단위체 n 개로 저장소에 돌아간다 (IκBα 317 aa) |
| 235 | tests/rules.test.mjs:617 | node:test | 무한 풀 방식(v6 동작)도 그대로: 저장소 감사 없음, 교환 원장으로 질량 수지 |
| 236 | tests/rules.test.mjs:624 | node:test | 한계 후보 탐지: 속도 없는 공급·분해 규칙과 서열 길이 없는 재활용이 등록되지 않으면 후보로 |
| 237 | tests/rules.test.mjs:635 | node:test | Patch Report: 바뀐 필드·하류 규칙·단계·경로·한계 상태 변화를 계산한다 |
| 238 | tests/rules.test.mjs:654 | node:test | Identity_Gap: unmapped 외부 ID 는 한계로 등록되어야 하고, 확인된 ID 가 들어오면 닫힌다 |
| 239 | tests/rules.test.mjs:680 | node:test | 시트르산 회로: 탄소·CoA·NAD 부분 구조 수지 — 탈카복실화에서 CO₂ 를 빼면 거부 |
| 240 | tests/rules.test.mjs:686 | node:test | 소진 시험 1: 아세틸-CoA 1000 → 정확히 1000 바퀴 뒤 아세틸-CoA 고갈로 정지, CO₂ 2000·GTP 1000 축적 |
| 241 | tests/rules.test.mjs:702 | node:test | 소진 시험 2: NAD⁺ 3002 → 1000 바퀴 + 부분 바퀴 뒤 NAD⁺ 고갈, NADH 3002 축적 (바퀴당 NAD⁺ 3) |
| 242 | tests/rules.test.mjs:709 | node:test | 소진 시험 3: 기질이 남아도 CO₂ 축적이 가역 IDH 를 평형에 묶어 정지 — 병목과 역/정 비를 보고 |
| 243 | tests/rules.test.mjs:721 | node:test | 재생이 있으면 죽지 않는다: 아세틸-CoA 공급을 켜면 정지 없이 계속 돈다 · 시동 중에는 정지로 보지 않음 |
| 244 | tests/rules.test.mjs:734 | node:test | v8 층(tier): 분자 종류는 T1\|T2 필수, 기본값은 kind 로, T1 은 부위 없음, T3 는 정의항에 못 씀 |
| 245 | tests/rules.test.mjs:743 | node:test | v8 관찰: 확산 계수·pH·이온 세기·유전율은 위치 필수, SI 단위, 값 범위 |
| 246 | tests/rules.test.mjs:750 | node:test | v8 열역학: 전이 상태 이론 일치, 미시적 가역성(k/k_r = exp(−ΔG°/RT)), dG_act ≥ 0 |
| 247 | tests/rules.test.mjs:759 | node:test | v8 Tier 1: 환경(pH·ε)이 장벽을 옮겨도 k_f/k_r 는 exp(−ΔG°/RT) 로 유지 (상세 균형) |
| 248 | tests/rules.test.mjs:772 | node:test | v8 Wegscheider: 닫힌 고리의 ΣΔG° ≠ 0 이면 AUDIT_THERMO |
| 249 | tests/rules.test.mjs:790 | node:test | v8 영역 구성: T3 는 기준 경계·격자 필수, 히스테리시스 tau_low < tau_high |
| 250 | tests/rules.test.mjs:796 | node:test | v8 정수 원장·인접 경계 거래: 보존, 멱등, 낙관적 버전 충돌, 인접성, 실현 가능성, 정수만 |
| 251 | tests/rules.test.mjs:811 | node:test | v8 경계 이동 표본: 나머지 이월은 누적 오차 < 1, 부족분은 pending 으로 이월, 포아송 평균·분산 |
| 252 | tests/rules.test.mjs:819 | node:test | v8 영역 점수·깜빡임 방지·보존적 투영·정수 분배 |
| 253 | tests/rules.test.mjs:830 | node:test | v8 스키마 파일: 파싱되고 참조 구현의 필수 필드와 일치 |
| 254 | tests/rules.test.mjs:839 | node:test | P3 종단: T3 영역 + T2 노드 10,000 단계 — \|N_initial − N_final\| < 1, 부분 구조 정수 불변, 장 = 원장 |
| 255 | tests/rules.test.mjs:849 | node:test | P3 계면 평형: 이류가 없으면 영역·인터페이스·노드 농도가 같아진다 |
| 256 | tests/rules.test.mjs:853 | node:test | P3 FV: 다섯 기준 경계 모두 보존(확산·제한된 이류·반응), 음수 없음, 기준 경계 밖 모양은 거부 |
| 257 | tests/rules.test.mjs:864 | node:test | P3 스케줄러: 동시 패킷 결정론적 정렬, 보수적 동기화 위반·시간 역행은 오류, 충돌 재시도 |
| 258 | tests/rules.test.mjs:883 | node:test | P3 고정 소수점 나머지: 10^6 번 이월해도 Σk 와 Σμ_q 의 차가 정확히 r/1e9 (< 1), 표류 없음 |
| 259 | tests/rules.test.mjs:893 | node:test | P3 강성 정체 방지: 매우 빠른 통로도 시간축이 멈추지 않고(Δt_min) 큰 수에서는 CLE, 평형 비 유지 |
| 260 | tests/rules.test.mjs:909 | node:test | P4 DCT: 직접 합과 일치하고 정확히 되돌아옴 (O(n log n) Makhoul), 3차원 분리형도 왕복 |
| 261 | tests/rules.test.mjs:920 | node:test | P4 학습: P3 FV 궤적에서 모드별 이득을 최소 제곱으로 — FV 확산 연산자 재현(잔차 < 1e-12), 반응 포함 100 단계 L2 < 2% |
| 262 | tests/rules.test.mjs:931 | node:test | P4 질량 조정 연산자: max(0,·) 투영 → Σ = N_ledger 재척도, Σ = 0 이면 균일 정수 분배 |
| 263 | tests/rules.test.mjs:937 | node:test | P4 OOD 탐지: 디랙 스파이크·수치 비정상·분포 밖 구성(구·이류·겹친 반응·열역학 표류)은 즉시, 매끄러운 장은 통과 |
| 264 | tests/rules.test.mjs:950 | node:test | P4 종단: 10,000 단계 \|ΔN\| = 0, 충격 탐지 지연 ≤ 1 단계, 대부분 대리 모델, 분포 안 오탐 0 |
| 265 | tests/rules.test.mjs:958 | node:test | P4 비동기 대체: worker_threads 일꾼 결과 = inline 결과 (원장 정확히 같음), 분포 밖 모양(구)은 대리 없이 FV 로 보존 |
| 266 | tests/rules.test.mjs:964 | node:test | P4 속도·정확도: FV 가 안정 조건으로 부분 단계를 많이 쓰는 강성 영역에서 ≥ 10× (Δt 와 무관한 O(N log N)), 모든 경우 L2 < 2% |
| 267 | tests/rules.test.mjs:973 | node:test | P5 강성 지표: N_sub = ⌈C_CFL·K_est⌉ 가 FV 가 실제로 쓰는 부분 단계 수와 경계값까지 같다 |
| 268 | tests/rules.test.mjs:980 | node:test | P5 상태 기계: M 단계 연속이어야 승격, K_down 미만이면 강등, 대역 안에서는 유지, 충격·OOD 는 같은 단계 강등 + W 냉각 |
| 269 | tests/rules.test.mjs:995 | node:test | P5 정밀 닻: 음수를 잘라내고 Σu = N_ledger 를 1e-15 안에서 (보상 합), Σ = 0 이면 균일 |
| 270 | tests/rules.test.mjs:1003 | node:test | P5 닫힌 꼴 이득: 이산 라플라시안 고윳값으로 구한 이득 = 최소 제곱으로 배운 이득 (D 가 바뀌면 O(N) 재계산) |
| 271 | tests/rules.test.mjs:1012 | node:test | P5 사전 필터 γ: 매끄러운 장은 낮고 국소 충격은 학습 최댓값 × 여유를 넘는다 |
| 272 | tests/rules.test.mjs:1017 | node:test | P5 P3 보존: mode fv 영역 모형 = FV.step 직접 반복 (비트 단위), 동적 관문의 FV 경로는 FV.step + 정밀 닻뿐 (원장 같음, 장 차 ≤ 1e-12) |
| 273 | tests/rules.test.mjs:1030 | node:test | P5 종단: 10,000 동적 단계 \|ΔN\| = 0, 장–원장 ≤ 1e-15, 음수 0, L2 < 2%, 충격 같은 단계 강등 → W 뒤 재승격, 강성 ≥ 10× |
| 274 | tests/rules.test.mjs:1043 | node:test | v9 조절 규칙: 대상은 속도가 있는 규칙, 조절자 위치는 3D, 활성화 fmax > 1 · 억제 0 ≤ fmin < 1, hill 은 조절에만 |
| 275 | tests/rules.test.mjs:1054 | node:test | v9 세포 상태: 서명 필수(분자·수준·위치 — 수용성은 3D, 막 분자는 그 막), 대사 프로그램은 공급 규칙, 전이는 cell_state·신호·결정 기준, 다른 kind 는 못 씀 |
| 276 | tests/rules.test.mjs:1068 | node:test | v9 포화 보조 기질: 화학량대로 소비하지만 질량 작용 차수에서 빠짐, 생성물에는 못 씀, 모두 포화면 거부 |
| 277 | tests/rules.test.mjs:1075 | node:test | v9 힐 배율: 활성화 1 → fmax, 억제 1 → fmin, s = K 에서 절반 |
| 278 | tests/rules.test.mjs:1082 | node:test | v9 계 조립: 상태 전이로 닿는 세 상태, 빠른 층(대사)·느린 층(표지 합성·분해), 조절 12 개, 신호 묶음 |
| 279 | tests/rules.test.mjs:1092 | node:test | v9 Fate-Test: 계통 충실도·경쟁·결정 비가역성(관문 충격 강등)·분화 정지 사후 분석·다른 운명·다중 규모 정확도·질량 |
| 280 | tests/rules.test.mjs:1117 | node:test | 자동 보강 plan: unmapped → 이름 검색, asserted UniProt·ChEBI → 직접 조회, 서열 길이 한계 연결, 막히면 수동 수집 과제 |
| 281 | tests/rules.test.mjs:1126 | node:test | 자동 보강 해석: UniProt JSON·FASTA·평문, ChEBI 단순·OLS·중첩 JSON, 화학식 원자 수 |
| 282 | tests/rules.test.mjs:1138 | node:test | 자동 보강 build: 검증만 verified·출처·서열 길이·지문, 종·번호·이름·화학식·중복 위반은 거부, 모호하면 unmapped 유지 + 후보 메모, asserted 는 덮어쓰지 않음 |
| 283 | tests/rules.test.mjs:1169 | node:test | 외부 ID 역할: 분류 항목은 셀 수 있는 분자의 번호가 될 수 없고, 역할이 겹치거나 physiological 이 없으면 거부 |
| 284 | tests/rules.test.mjs:1183 | node:test | 외부 ID 역할: 신원 확인이 켤레 관계(수소·전하만 차이)와 반응 참여(Rhea ≥ 3)를 요구한다 |
| 285 | tests/rules.test.mjs:1207 | node:test | 신뢰 지표: 등급은 쌍을 사전식으로 — 곱이 같아도 뜻이 다르면 등급이 다르다 |
| 286 | tests/rules.test.mjs:1220 | node:test | 신뢰 지표: S 는 도장·문헌 식별자에서, D 는 실측·도구 계산에서 계산된다 |
| 287 | tests/rules.test.mjs:1231 | node:test | 신뢰 지표: 데이터가 스스로 등급을 올릴 수 없다 (도장 없는 verified 는 차단) |
| 288 | tests/rules.test.mjs:1254 | node:test | 신뢰 지표 ②: 관문은 쓰인 상수의 등급을 보고 미달을 거부한다 (가상 값은 hypothetical 선언 아래에서만) |
| 289 | tests/rules.test.mjs:1271 | node:test | 신뢰 지표 ②: 속도 감사가 같은 판정을 낸다 — 가상 상수를 선언 없이 쓰면 Audit Error |
| 290 | tests/rules.test.mjs:1290 | node:test | 도장 재검증: 주체 하나로 좁혀도 중복 검사는 전체 db 로 한다 (좁히기가 검증을 약하게 만들지 않는다) |
| 291 | tests/rules.test.mjs:1310 | node:test | 도장 재검증: 등록부 전체 검증이 도장 수에 비례해 느려지지 않는다 (정규화·색인을 한 번만) |
| 292 | tests/rules.test.mjs:1326 | node:test | 추세 점검 ③: 더 새 원본에 같은 확인을 다시 돌린 결과만 추세다 — 원본이 없으면 unchecked, anchor 는 나오지 않는다 |
| 293 | tests/rules.test.mjs:1337 | node:test | 추세 점검 ③: 합의 수신함의 새 원본으로 판정하고, 창을 넘긴 도장은 다시 unchecked (anchor 는 영구하지 않다) |
| 294 | tests/rules.test.mjs:1354 | node:test | 추세 점검 ③: 도장을 손대면 거부 — digest 변조·판정 뒤집기·증거 파일 바뀜 |
| 295 | tests/rules.test.mjs:1375 | node:test | 추세 점검 ③: mismatch 는 값을 지우지 않고 지난값(legacy)으로 내리고 Consensus_Gap 으로 등록한다 |
| 296 | tests/rules.test.mjs:1396 | node:test | 정제 점검: 경로 순 반응 ↔ 단계 화학량 차이는 등록된 Structural_Gap 이 있으면 known, 중복 조절·공급은 잡고 참조 없는 쪽을 지우는 리팩터링 패치 |
| 297 | tests/rules.test.mjs:1414 | node:test | 원자 수(elements)는 구조 요소만·원소 기호·0 이상 정수, 부분 구조 수지는 상대 1e-14 |
| 298 | tests/rules.test.mjs:1422 | node:test | 비교 검토: 같은 조절을 하나 더 넣는 패치는 결과가 같고 복잡도만 늘어 Optimization-Negative (질량 ≤ 1e-14) |
| 299 | tests/rules.test.mjs:1435 | node:test | 과정 보고서: 변곡점(신호·결정·도달·고갈·비율 교차·운명 전환)·구간 [기간\|원인\|우세 표지\|비용]·무결성 증명서·인과 추적, 원장은 매 단계 ≤ 1e-14 |
| 300 | tests/rules.test.mjs:1450 | node:test | 과정 보고서: 규칙 밖 개입은 FAIL — 저장소를 몰래 바꾸면 재생 검사가, 신호를 일정 밖에서 바꾸면 신호 검사가, 해시가 다르면 결정론이 잡는다 |
| 301 | tests/runbook.test.mjs:19 | node:test | ① 설명서가 적는 dbtool 명령이 모두 실재한다 |
| 302 | tests/runbook.test.mjs:32 | node:test | ② 운명 표의 상태×시나리오 짝이 실재하고, 상태는 cell_state 다 |
| 303 | tests/runbook.test.mjs:44 | node:test | ③ 경로·상태 목록의 번호가 실재하고 kind 가 맞다 |
| 304 | tests/runbook.test.mjs:58 | node:test | ⑤ 설명서가 적는 시험 수가 지금 수와 같다 (숫자가 썩지 않게) |
| 305 | tests/runbook.test.mjs:66 | node:test | ④ 설명서가 가리키는 문서·파일 경로가 모두 있다 |
| 306 | tests/rust_engine.test.mjs:26 | node:test | ① WASM 은 지금 소스로 빌드된 것 (engine/rust/build.sh 의 소스 해시) |
| 307 | tests/rust_engine.test.mjs:34 | node:test | ② JS 기준 구현과 동등 — 8 시나리오 (결정 탐침 포함) |
| 308 | tests/rust_engine.test.mjs:53 | node:test | ③ 할당 0 — WASM 선형 메모리가 실행·탐침 동안 자라지 않음 |
| 309 | tests/rust_engine.test.mjs:72 | node:test | ④ 결정론 — Rust 를 다시 돌리면 비트 단위로 같은 궤적 |
| 310 | tests/rust_engine.test.mjs:78 | node:test | ⑤ 네이티브 = WASM (비트 단위) · 네이티브 루프 할당 0 · 네이티브 스레드 병렬 탐침 = 직렬 (비트) |
| 311 | tests/rust_engine.test.mjs:102 | node:test | ⑦ 병렬 탐침 (WASM 워커): lanes 1·2·4 에서 결정 시각·격자·궤적 해시가 같고 탐침 끝 상태가 비트 단위로 같음 |
| 312 | tests/rust_engine.test.mjs:123 | node:test | ⑥ 사법부는 Rust 원자료도 같은 기준으로 판정 — 계약·독립 질량 검증 ≤ 1e-14·IR 검사·증명서 PASS |
| 313 | tests/rust_engine.test.mjs:134 | node:test | ⑧ 확률 층 (4단계 ⑤): 출생–사멸은 JS = Rust 비트 · 운명 프로그램은 같은 분포 · 네이티브 = WASM 비트 · 루프 할당 0 |
| 314 | tests/stats.test.mjs:14 | node:test | ① 특수 함수: χ²·정규·KS·F·lnΓ 의 알려진 값 |
| 315 | tests/stats.test.mjs:26 | node:test | ② 보정: 귀무 가설 아래 기각률 ≈ α (χ² 적합도·분할표·이산 AD 두 표본·KS) |
| 316 | tests/stats.test.mjs:47 | node:test | ③ 검정력: 비중심 χ² 공식 = 모의 기각률, z 검정 필요 표준 오차 |
| 317 | tests/stats.test.mjs:57 | node:test | ④ 관찰 판정: 세 판정·필요 정밀도·추정용 거부·결정론의 퍼짐 공백 |
| 318 | tests/stats.test.mjs:103 | node:test | ④′ 동등성(TOST, M1): δ 근거 등급 · 정밀도 부족 · 차가 δ 이상 · 척도 |
| 319 | tests/stats.test.mjs:142 | node:test | ⑤ 관찰 연산자: 운명 원자료(결정론) → 분자 수(격자 보간)·농도·비율·도달 시각 |
| 320 | tests/stochastic.test.mjs:28 | node:test | ① 해석해: 출생–사멸 — 정확 SSA 영역(λ 50, N₀ 0)·τ-도약 영역(λ 2000, N₀ 1000) |
| 321 | tests/stochastic.test.mjs:40 | node:test | ② 방식 비교: 정확 SSA 대 τ-도약 (같은 계, 결합점으로 방식 강제) — 같은 분포 |
| 322 | tests/stochastic.test.mjs:49 | node:test | ③ 결정론 극한: Ω 1·4·16 — 앙상블 평균과 결정론 궤적의 상대 차가 줄어듦 |
| 323 | tests/stochastic.test.mjs:82 | node:test | ④ 재현·정수 발화·원장: 같은 (seed, 궤적) → 같은 해시, 다른 궤적 → 다름, 사법부 감사 결함 없음 |
| 324 | tests/stochastic.test.mjs:95 | node:test | ⑤ 결정론 경로: stochastic 이 없으면 확률 원자료가 없고 결정 탐침이 돈다 · 확률 실행은 결정 탐침을 하지 않음 |
| 325 | tests/stochastic.test.mjs:105 | node:test | ⑥ 구간 안 승격: 0 에서 시작해 구간 안에서 빨라지는 이산 규칙이 결정론으로 올라감 (SSA 폭주 없음) |
| 326 | tests/telomere.test.mjs:37 | node:test | 텔로미어 ①: 새 규칙 종류 없이 계가 조립되고 공급 규칙의 진행량이 곧 분열 횟수 |
| 327 | tests/telomere.test.mjs:54 | node:test | 텔로미어 ②③④: 되먹임을 끈 소모 법칙 — 임계 통과 시각 = 산술 분열 한계, Δt 와 무관, 궤적은 선형 |
| 328 | tests/telomere.test.mjs:67 | node:test | 텔로미어 ⑤: 전체 모형 — 임계 통과는 산술값 그대로, 그 뒤 분열이 멈추고 되돌아오지 않는다 |
| 329 | tests/telomere.test.mjs:89 | node:test | 텔로미어 ⑥: 급격한 문턱 (손상 반응 힐 n = 96) 에서도 결합 Rodas3 가 음수 거부 없이 넘고 법칙 충실도가 통과한다 |
| 330 | tests/telomere.test.mjs:104 | node:test | 텔로미어 ⑦: JS 기준 구현 = Rust/WASM (궤적·끝 상태·도달 시각) |
| 331 | tests/telomere.test.mjs:115 | node:test | 텔로미어 ⑧: 필수성 — 성장 인자를 끊거나 순 소모를 0 으로 만들면 분열 한계에 이르지 못한다 |
| 332 | tests/telomere.test.mjs:132 | node:test | 텔로미어 ⑨: 상수 등급 관문 — 가상 상수는 hypothetical 선언 아래에서만 |
| 333 | tests/values.test.mjs:20 | node:test | ① 저장은 값 층만, 메모리 보기는 그대로 · 정규화 멱등 |
| 334 | tests/values.test.mjs:31 | node:test | ② 병합: 바뀌면 대체, 빠지면 철회, 이전 기록은 그대로 |
| 335 | tests/values.test.mjs:57 | node:test | ④ 사법부: 값 기록 모양 · 값은 바꾸거나 지울 수 없다 |
| 336 | tests/values.test.mjs:72 | node:test | ⑤ 형식 변환 재현: 기원 스냅숏(v10) → transform = 지금 db 의 값 층 |

## 15. 스크립트 시험

| 파일 | 머리말 | 통과 조건 (코드에서) |
|---|---|---|
| tests/p3_end_to_end.js | Phase P3 종단 시험: Tier 3 영역 1개(3차원 FV) + Tier 2 규칙 노드 1개를 Parallel-DEVS 로 결합해 영역 10,000 단계를 돌리고 모든 원장 + 경계 버퍼의 질량(부분 구조 A·R 총량)이 정확히 보존되는지(\|N_initial − N_final\| < 1) 확인한다. 실행: node tests/p3_end_to_end.js [--steps 10000] [--every 1000] [--mode residual\|stochastic] [--template sphere] | pass: (opt.integer !== false ? Math.abs(NA0 - NAf) === 0 && worst.field === 0 : Math.abs(NA0 - NAf) < 1 && worst.field < 1e-6) && worst.moiety === 0 && reg.steps >= opt.steps } |
| tests/p4_end_to_end.js | Phase P4 종단 시험: Tier 3 상자 영역을 스펙트럼 신경 연산자 대리 모델로, T2 노드는 P3 와 같이, 영역 10,000 단계. 중간(기본 5,000 단계)에 디랙 충격(영역 A 질량의 30% 를 한 칸으로 — 원장은 그대로)을 넣어 OOD 탐지 → 같은 단계 FV 대체를 확인하고, 원장 + 경계 버퍼 질량이 정확히 보존되는지(\|ΔN\| = 0) 본다. 실행: node tests/p4_end_to_end.js [--steps 10000] [--every 1000] [--fallback inline\|worker] [--shock 5000] | pass: Math.abs(NA0 - NAf) < 1 && worst.moiety === 0 && worst.field < 1e-6 && reg.steps >= opt.steps && (shockInjected == null \|\| latency <= 1) } |
| tests/p4_benchmark.js | Phase P4 성능·정확도 측정: 같은 초기 장(저주파 + 경계층)에서 P3 FV 와 P4 대리 모델(+탐지기)을 K 단계 진행해 단계당 시간(속도 향상)과 상대 L2 오차를 격자 n·거시 Δt 별로 표로 낸다. FV 부분 단계 수 ns = ⌈Δt / (0.4 h²/6D)⌉ 가 강성의 척도. 실행: node tests/p4_benchmark.js [--quick] | — |
| tests/p5_dynamic_promotion.js | Phase P5 시험: 동적 승격·강등 관문 — 확산 계수 D(t) 를 Tier 1 환경 변화처럼 단계별로 바꿔 강성(N_sub)이 오르내리게 하고, 히스테리시스·냉각·사전 필터·전이 질량 협정과 5 불변식을 10,000 단계에서 확인한다. 실행: node tests/p5_dynamic_promotion.js [--steps 10000] [--every 1000] (가상 값 — 엔진 시험용) | pass = out.massError === 0 && out.moietyExact && out.fieldParity <= 1e-15 && out.negatives === 0 && out.maxL2 < 0.02 |
| tests/bench_engine.js | 0단계 기준선 측정 (docs/design/engine-port-roadmap.md §0) — Rust/WASM 이식과 기호 야코비안의 이득을 판정할 기준. 운명 엔진 (1.5단계 결합 Rodas3): 본 실행 대 결정 탐침 시간 · 받아들인·거부한 단계 · 속도·야코비안 평가 · 활성 규칙 수 nA (0단계 분할 엔진 기준선·0.5단계 유한차분 대 해석적·1단계 JS 대 Rust 결과는 docs/design/engine-port-roadmap.md §3·§4·§6 에 기록) | — |
| tests/bench_index.js | 색인·파싱 고정 비용 벤치 (build-plan 16A·15–19 문턱 실측) — 읽기 전용, 쓰기 없음. 왜: 지금은 매 명령이 콜드 프로세스라 db.json 을 통째 읽어 JSON.parse → normalize → index(db) 를 | — |

## 16. 거부 말뭉치 (`tests/fixtures/rejections/EXPECT.json`)

| # | 파일 | 기대 거부 |
|---|---|---|
| 1 | 2a-상수만-바꾸기.json | 관찰 값 26.7 와 다름 |
| 2 | 2a2-from-떼고-바꾸기.json | 관찰 기록(kinetics.from)이 없음 |
| 3 | 2a3-from-을-딴-관찰로.json | 을(를) 잰 것이 아님 |
| 4 | 2b-정의항obs-파생값만.json | 관찰 값 0.000817999999 |
| 5 | 3-obs-배열-비우기.json | 측정의 파생값은 지울 수 없음 |
| 6 | 3b-관찰기록-값-바꾸기.json | 관찰 기록은 바꿀 수 없음 |
| 7 | 4a-가상-단위.json | 어휘의 환산표에 없음 |
| 8 | 4b-종-바꿔치기.json | 종이 다름 |
| 9 | 4c-단위맞고-값-터무니없음.json | 물리적 상한 100 를 넘음 |
| 10 | 4d-상수-종-바꿔치기.json | 종 어휘에 없음 |
| 11 | 4e-상수-종-생쥐로.json | 종이 다름 |
| 12 | 5a-why-없음.json | 변경 이유(why)가 없음 |
| 13 | 5b-미등록-한계.json | 미등록 한계 후보 [Identity_Gap] |
| 14 | 5c-중복-공급-규칙.json | 정제 점검 [duplicate_rule] |
| 15 | 6a-값층-직접쓰기.json | 값 층(values)은 패치가 직접 쓰지 않는다 |
| 16 | 6b-기록시각-없음.json | recorded_at 이 없음 |
| 17 | 6c-정성-구절-없음.json | 원문 구절(quote)이 없음 |
| 18 | 6d-맥락-조건-문장.json | 조건(condition)은 정의항 번호 목록 |
| 19 | 6e-이동-번호-참조.json | 이동된 번호를 가리킴 |
| 20 | 6a-한계-재검토-at-없음.json | 은 한계의 등록 시각 at(ISO) 이 있어야 비교할 수 있음 |
| 21 | 6b-한계-증상-글자값.json | 의 값은 유한한 수 |
| 22 | 6c-한계-막힌하류-없는번호.json | 막힌 하류 'D999999' 없음 |
| 23 | 6d-한계-재검토-어휘밖.json | 재검토 조건 'whenever' |
| 24 | 6e-기울기-용량축-없음.json | 용량 축 |

## 17. 래칫 바닥값 (`FLOOR.json`)

| 값 | 바닥 |
|---|---|
| rejection_fixtures | 24 |
| judicial_check_sites | 426 |
| tests | 314 |

## 18. CI 단계 (`.github/workflows/check.yml`)

| # | 단계 |
|---|---|
| 1 | Rust 도구 사슬 (1단계 엔진 — 네이티브 = WASM 대조) |
| 2 | 규칙 테스트 |
| 3 | 저장소 전체 검사 |
| 4 | node dbtool.mjs limitations --check |
| 5 | 증명 등록부 (사법부 도장: digest · 증거 sha256 · 재확인) |
| 6 | 미등록 한계 후보 0 (unmapped 포함) |
| 7 | 추세 점검 (시간 축 — 합의 수신함으로, 미등록 Consensus_Gap 후보 0) |
| 8 | 신뢰 지표 분포 (등급이 계산되는지 — 저장되지 않는지) |
| 9 | P3 종단 시험 (영역 10,000 단계 질량 보존) |
| 10 | P4 종단 시험 (대리 모델 + OOD 대체, 10,000 단계 질량 보존) |
| 11 | P5 동적 승격·강등 (10,000 단계, 질량·장 정합·충격 강등) |
| 12 | Fate-Test (세포 운명 — 충실도·비가역성·분화 정지·다른 운명·질량) |
| 13 | Fate-Test (Rust 엔진) |
| 14 | v8 인터페이스 — Python 자체 시험·C++ 구문 |
| 15 | 교과서 부록 최신·모든 파일 분류 |
| 16 | index.html 이 viewer.html 과 같은지 |

