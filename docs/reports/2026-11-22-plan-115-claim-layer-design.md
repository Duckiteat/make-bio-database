# PLAN-115 설계 보고서 — 주장 층 (Claim · Evidence · Provenance)

> 2026-11-22 · develop 모드 · 전환 기록 #16 을 받은 세션 · **조사 · 설계만 — 사용자 결정 전.** 데이터 · 스키마 · 코드 · 장부 · 기준 파일은 바꾸지 않았다. 구현은 별도 승인 뒤(RULE-0261).
> 입력: 지시서 원문 `docs/reports/2026-11-22-plan-115-design-brief.md` · PLAN-115 · DEC-0073 · 독립 검토 `docs/reports/2026-11-22-sup-0001-r1-p1-review.md` · 이전 판정 설계 `docs/design/transfer-judgment.md` v0.1.
> 표기: **[사실]** 저장소 코드 · 데이터에서 확인 · **[외부]** 외부 연구 · 표준의 개념 · **[제안]** 설계자의 제안 · **[가정]** 아직 검증되지 않은 가정 · **[결정 필요]** 사용자.
> 빠진 입력: SCH-0212 · SCH-0214 · SCH-0164 · SCH-0186 · SCH-0074 · SCH-0213 · SCHEMA_DATA 카드는 이 저장소에도 세션에도 없다. 그래서 그 카드들의 내용은 **확인 불가**이고, 같은 개념(N 항 관계 · 마이크로 이론 · TMS · 인용 선택자 · PROV · 관계 특성)은 외부 원천으로 대신 조사했다(§4). 카드를 받으면 §6 · §7 · §8 을 다시 맞춰 봐야 한다.

---

## 1. 요약 (Executive Summary)

1. **문제는 실재한다 [사실].** 지금 근거는 규칙 하나에 `evidence` 하나다. `level: curated` 는 "이 규칙에 확인한 문헌이 붙어 있다" 는 뜻일 뿐, `via_component` · `regulators[].note` · `effect.site` 같은 개별 칸까지 보증하지 않는다. 칸별 사정은 사람이 읽는 `evidence.note` 의 산문에만 있다. 예: S000009 `D000043/rule/gp_phos` 는 curated 인데, note 에 "γ 촉매 소단위가 한다는 귀속(via_component)은 이 초록들이 말하지 않음" 이라고 적혀 있다. 기계는 이 문장을 읽지 못한다.
2. **엔진은 근거를 보지 않는다 [사실].** `compiler/` · `engine/` 에는 `evidence` 참조가 없다. 근거 관문(`judicial/reliability.js` `constantVerdict`, 기본 문턱 `parameter`)은 **속도 상수에만** 걸린다. 규칙 구조(어떤 간선이 그물에 있는가)는 asserted 30 · abstracted 64 · curated 66(규칙 160)이 모두 그대로 시뮬레이션에 들어간다.
3. **권고 = C 혼합형의 최소판 [제안].** 주장(Claim) 모음 하나만 새로 만든다(`claims.C…`, 관찰 O… 처럼 덧붙이기만 하고 철회는 한 번). 주장 하나는 **대상 칸 경로 하나 + 근거 줄 여러 개**다. 근거 줄 하나 = 출처 · 인용 위치(받은 파일 해시 + 인용 문구) · 방향(지지 · 반박 · 한정) · 종류(직접 측정 · 배경 문장 · 해석) · 맥락이다. 새 생물 관계 어휘는 만들지 않는다 — "PKA 가 PhK 를 인산화한다" 는 이미 규칙 칸(`action` · `effect`)이 표현하고, 주장은 그 칸을 **가리킬** 뿐이다.
4. **재사용 [사실 → 제안].** 철회 전파(`retractionImpact`)는 관찰 → 값 → 규칙 → 단계 → 경로의 한 홉을 이미 한다. 여기에 "출처 · 관찰 → 주장 → 규칙 칸" 홉을 붙인다. 인용 문구 대조는 `judicial/collection_audit.js` `quoteCheck` 를, 받은 원문과 해시는 `data/fetched/europepmc/` + `FETCH_LOG.jsonl`(해시 사슬)을, 맥락 칸은 관찰 `condition` 의 열쇠를 그대로 쓴다. 정성 그래프(`qual_graph.js`)는 주장 층과 겹치지 않는다(관찰 대 기전 그래프의 부호 판정) — 그대로 둔다.
5. **새 TMS · ATMS 는 만들지 않는다 [제안].** 필요한 것은 "근거 줄이 철회되면 주장 상태를 다시 계산" 이고, 이것은 **저장하지 않고 매번 계산하는 함수**(등급 계산과 같은 방식)로 충분하다. ATMS 의 맥락 꼬리표는 매력적이지만, 지금 규모(주장 수백)에서는 비용만 늘린다.
6. **이관은 보존형 [제안].** 기존 규칙 `evidence` 는 **"규칙 전체를 덮는 주장 1 건"(`scope: '*'`, 종류 `legacy`)** 으로 옮긴다. curated 를 새 구조의 "지지됨" 으로 올리지 않는다. 이관 전후로 등급표(`dbtool grade`)와 시뮬레이션 결과가 비트 동일해야 한다(RULE-0036).
7. **같이 고칠 결함 하나 [사실].** `judicial/judicial.js:32` `needMet` 의 xref 조건은 `d.xrefs.some((x) => x.db === n.db)` 로 **상태를 보지 않는다.** 그래서 asserted 인 `CHEBI:58601` 하나로 L000030(G1P 의 ChEBI Identity_Gap)이 해소로 나온다. 고치는 방법은 둘(§13.4) — 사용자 결정.
8. **가장 큰 비용 · 위험.** (a) 입력 비용: 칸마다 인용 문구를 적는 일은 논문 한 편에 author 시간 기준 몇 배가 든다(§11). (b) 규칙 등급이 "가장 약한 핵심 칸" 으로 계산되면 S000009 처럼 **지금 curated 로 보이는 규칙이 내려간다** — 그것이 이 설계의 목적이지만, 핵심 칸 목록을 사람이 정해야 한다. (c) 주장 층이 "누가 판정하나" 경계를 새로 만든다 — PLAN-116(거버넌스)과 같이 봐야 한다(§14).

---

## 2. 기존 저장소 구조 조사

분류: **구현 확인** · **일부 구현** · **문서에만 존재** · **미구현** · **확인 불가**.

| # | 항목 | 실제 자리 [사실] | 분류 | 비고 |
|---|---|---|---|---|
| 1 | Entity ID · 구조 | `data/db.json` `terms.T…`(이름) · `senses.D…`(정의항: `kind` · `xrefs` · `components` · `site` · `desc` · `rule` · `obs`), 번호 발급 `meta.next` | 구현 확인 | 지금 T 210 · D 212 · S 57 · O 28 · V 68 · L 127. 정의항 종류는 `vocab.js` `kinds` |
| 2 | Reaction · 참여자 | 규칙 = 정의항 안 `rule[]`(`type: meaning \| transition \| supply \| degradation …`), 단계 = `steps.S…` `{ rule, agents, inputs, outputs, regulators, part_of }`, 묶음 문자열 `D…\|부위:특징\|위치` | 구현 확인 | 화학양론은 단계 입력 · 출력(`n`)과 규칙 `with.consumes/produces`. SCHEMA.md §7 |
| 3 | Source · Evidence 저장 | `evidence { level, sources[{db: DOI\|PMID, id, citation}], basis, tool, confidence, note }` 를 설명 · 규칙 · 속도 상수 · 정의항 obs 마다 **안에** 붙임. 받은 초록 원문 `data/fetched/europepmc/MED-*.json` + `FETCH_LOG.jsonl`(sha256 · prev 해시 사슬) | 일부 구현 | 출처 **목록**은 있으나 출처 **안의 위치**(문장 · 그림 · 표)는 규칙 근거에 없다 — `note` 산문뿐. 관찰 O… 에는 `quote` + `provenance { sha256, source }` 가 있다 |
| 4 | asserted / curated 의미 · 판정 | SCHEMA.md §근거: curated = 실제로 확인한 문헌(DOI · PMID + citation 필수) · abstracted = 기전 흐름에서 추론(`basis` 필수) · computed · asserted · predicted. 판정 `judicial/reliability.js` `scoreEvidence` → S 축(출처) · D 축(성질) → 등급 anchor · parameter · bounded · legacy · reference · blocked | 구현 확인 | **curated 의 단위는 규칙 전체.** 칸 단위 판정 없음 |
| 5 | 맥락 | 설명 `desc[].context { scope, species, tissue, cell, condition }` · 관찰 `condition { species, location, cell, temperature_K, pH, … }` · 규칙 `taxa` · `where` · 종 계층 `vocab.taxa`(parent) | 일부 구현 | 규칙 근거에는 맥락 칸이 없다 — 출처별 종 · 조직은 `note` 에 산문으로("토끼 골격근, 정제 효소, 시험관"). 관찰에 조직 칸 없음(transfer-judgment §5.3) |
| 6 | 출처 추적 · 변경 이력 | `data/log/events.jsonl`(사건) · `data/patches/*.json`(패치) · `CHANGES.md` · `attestations/registry.json`(사법부 도장: subject · evidence sha256 · issuer code_sha256) · 수신함 확인(S3.confirmed) | 구현 확인 | 패치 단위의 이력은 있다. **칸 단위로 "이 칸은 어느 근거로 바뀌었나"** 는 패치 diff 를 사람이 읽어야 안다 |
| 7 | retraction | `judicial/judicial.js:1426` `retractionImpact` · `dbtool retraction [O…]` — 철회된(또는 가정한) 관찰 → 그 관찰을 `from` 으로 쓰는 현재 값 V → 값의 대상 규칙 → 그 규칙의 단계 → 경로 → 사전 등록 검증 결론. 읽기 전용 | 일부 구현 | **관찰(O…)만** 출발점이다. 논문 철회는 등급에서 `S0.retracted` 로만 드러나고, 그 논문을 쓰는 규칙 · 설명으로 전파하는 보고는 없다. "다른 근거가 남았나" 를 보지 않는다(한 홉이라 그럴 필요가 없었음) |
| 8 | qualgraph | `judicial/qual_graph.js` · `dbtool qualgraph` — 정성 관찰(`kind: qualitative`, `quote` 필수 RULE-0115)을 "주장 간선" 으로 보고, 기전 그래프의 경로 부호 곱과 비교(지지 · 경로 없음 · 모순 후보 · 부호 섞임) | 구현 확인 | 이름은 "주장" 이지만 대상은 **실험 결과(교란 → 읽을 거리)** 이지 기전 칸이 아니다. 주장 층과 역할이 다르다 — 재사용 대상은 "관찰이 기전을 반박하는지 계산으로 본다" 는 방식 |
| 9 | 감사 · 검증 | `judicial/judicial.js` 관문(validate · gate · patchPolicy · audit) · `reliability.js` 등급 · `collection_audit.js`(수집 후보: quote 없으면 거부 RULE-0291, `quoteCheck` 로 원문 대조) · `identity.js`(외부 ID 원본 대조 → 도장) · inspect 모드 독립 검토 보고서 | 구현 확인 | `quoteCheck` 는 **수집 후보**에만 쓰이고, db 안의 규칙 근거에는 쓰이지 않는다 |
| 10 | 엔진의 데이터 소비 | `compiler/ir_builder.js` · `rate_ir.js` 가 정규화된 db(규칙 · 단계 · 속도 상수)로 IR 을 만들고 `engine/` 이 적분. 근거 관문 `reliability.constantVerdict` 는 IR 의 상수만 등급 판정 | 구현 확인 | `grep evidence compiler/ engine/` = 0. **규칙 구조는 근거 등급과 무관하게 들어간다.** 결론의 자격은 `mcp/run.mjs` mode(protocol · exploration)와 상수 관문이 정한다 |
| — | 한계의 needs 해소 | `judicial/judicial.js:22–40` `needMet` — xref 는 `db` 일치만 봄(32 행) | 구현 확인(결함) | L000030 이 asserted xref 로 해소됨 |
| — | SCH-… 카드 | 저장소 · 세션 어디에도 없음 | 확인 불가 | 사용자가 붙여야 함 |

retraction · qualgraph 재사용 판단 (지시서 §1 끝):

| 기능 | 새 구조에서 | 판단 |
|---|---|---|
| `retractionImpact` | 출발점을 "관찰" 에서 "관찰 · 출처 · 근거 줄" 로 넓히고, 주장 → 규칙 칸 홉을 더한다. 규칙 → 단계 → 경로 → 결론 부분은 그대로 | **재사용 (확장)** |
| `qual_graph` | 정성 관찰이 기전 칸 주장을 **반박하는 근거 줄** 이 될 수 있다(모순 후보 → 근거 줄 `contradicts` 후보). 그래프 · 판정 코드는 그대로 | **그대로 두고 입력만 연결** |
| `quoteCheck` | 근거 줄의 인용 문구를 받은 원문과 대조 | **재사용 (그대로)** |
| `scoreEvidence` · 등급 | 근거 줄 하나의 S · D 를 계산하는 데 그대로. 규칙 등급은 근거 줄들에서 계산 | **재사용** |
| 가정 원장 · 이전 판정 | 다른 맥락의 주장을 쓸 때 | transfer-judgment 쪽에서 |

---

## 3. 기존 구조의 한계

| # | 한계 | 확인 [사실] | 결과 |
|---|---|---|---|
| H1 | 근거 단위 = 규칙 전체 | 규칙마다 `evidence` 하나 | curated 가 구조 칸까지 보증하는 것처럼 읽힘(PLAN-115 의 원인) |
| H2 | 칸별 사정이 산문 | `note` 에 "직접 · 해석 · 초록에 없음" | 계산 · 검사 · 철회 전파 불가 |
| H3 | 출처별 맥락 칸 없음 | 규칙 근거 sources 에 종 · 조직 없음 | 같은 규칙이 토끼 근육(1975) · 토끼 간(1980) · 사람 적혈구(1975) 근거를 섞어 가짐 — 어느 근거가 어느 맥락인지 기계가 모름 |
| H4 | 반박 근거를 둘 자리 없음 | sources 는 지지만 | 검토가 찾은 반박(§12 C3)은 한계나 note 로만 |
| H5 | 인용 위치 없음 | 규칙 근거에 quote · sha256 없음 | "초록에 정말 그 말이 있나" 를 다시 확인하려면 사람이 다시 읽음 |
| H6 | 논문 철회 전파 없음 | retraction 은 관찰만 | 규칙 근거 논문이 철회되면 등급만 S0 로 내려가고, 영향 받는 단계 · 결론 보고가 없음 |
| H7 | 구조 관문 없음 | 상수만 관문 | 근거 없는 간선으로도 시뮬레이션 결론 — 결론 문서가 이를 알리지 않음 |
| H8 | needs xref 가 상태 무시 | `needMet` 32 행 | L000030 오판 |

---

## 4. 외부 연구 · 표준 조사

확인 수준: **초록** = Europe PMC REST(www.ebi.ac.uk)에서 받은 서지 · 초록을 이 세션이 읽음 · **서지** = 웹 검색으로 존재 · 서지만 확인, 원문 · 초록 미확인. **전문을 읽은 자료는 없다.** 웹 검색은 설계 참고에만 썼고, db 값 · 인용으로는 쓰지 않는다(RULE-0288 · RULE-0301).

### 4.1 채택 후보 (깊게)

| 자료 | 확인 | 입증한 것 (자료가 말한 것) | 이 설계에 쓰는 것 [외부 → 제안] | 한계 |
|---|---|---|---|---|
| Clark T, Ciccarese PN, Goble CA. **Micropublications: a semantic model for claims, evidence, arguments and annotations in biomedical communications.** J Biomed Semantics 2014 · doi:10.1186/2041-1480-5-28 · PMID 26261718 | 초록 | 최소형 = "statement with its attribution", 최대형 = 지지 · 반대 근거 · 해석 · 반론까지. 출판물에 stand-off 메타데이터로 붙일 수 있음. OWL 2 어휘 있음 | **최소형에서 시작해 늘리는 구조** — 이관된 주장(출처만)이 최소형, 칸 단위 근거 줄이 늘어난 형. 반박(challenge)을 같은 주장 안에 둠 | 모델 평가 · 채택 규모는 초록에서 확인 못 함 |
| Groth P, Gibson A, Velterop J. **The anatomy of a nanopublication.** Inf Serv Use 2010;30:51–56 · doi:10.3233/ISU-2010-0613 | 서지 | 핵심 과학 진술을 출처 · 귀속과 함께 묶는 모델, Named Graph 직렬화. (assertion · provenance · publication info 세 부분은 2022 년 2 차 설명 — 원문 미확인) | 주장(assertion) · 근거 출처(provenance) · 기록 출처(누가 · 언제 적었나)를 **분리** | 원문 미확인. RDF 직렬화는 이 저장소(JSON 정준 텍스트, RULE-0464)에 맞지 않음 |
| Menotti L, Marchesin S, Giachelle F, Silvello G. **Provenance-driven nanopublications: representing source lineage and trust networks for multi-source assertions.** Int J Digit Libr 2025;26(4):24 · doi:10.1007/s00799-025-00431-x · 온톨로지 PROV-K(prov-k.dei.unipd.it/ontology) | 서지 | **PROV-K 는 실재한다** (받은 세션 메모 ⑤ 해소). PROV-O 위에 여러 출처를 모은 주장의 출처(knowledge provenance)를 넷째 그래프로. 유전자-암 연관 197,511 건에 적용, 여러 LLM 으로 신뢰값 평가 | "여러 근거를 모은 주장" 의 출처 계보 — 주장 상태가 **근거 줄들에서 계산된다** 는 점을 기록 | 원문 미확인. 신뢰값(truth value)을 LLM 이 매기는 부분은 RULE-0494 와 충돌 — 쓰지 않음 |
| W3C. **PROV-O: The PROV Ontology.** Recommendation 2013-04-30 · https://www.w3.org/TR/2013/REC-prov-o-20130430/ | 서지 | Entity · Activity · Agent, `wasDerivedFrom` · `wasGeneratedBy` 등 | 최소 셋만: **유래(derived_from) · 생성자(generated_by: 누가 · 어떤 세션) · 승인(approved_by)** | 원문 미확인(접속 차단: www.w3.org 403). 전체 도입 안 함 |
| W3C. **Web Annotation Data Model.** Recommendation 2017-02-23 · https://www.w3.org/TR/2017/REC-annotation-model-20170223/ — TextQuoteSelector | 서지 | `exact`(필수) + `prefix` · `suffix`(선택)로 원문 구간을 가리키고 반복 문자열을 구별 | 근거 줄의 인용 위치 = `{ exact, prefix?, suffix? }` + 원문 파일 sha256 | 원문 미확인(2 차 구현 코드 · 메일링 리스트로만 확인) |
| Unni DR et al. **Biolink Model: A universal schema for knowledge graphs in clinical, biomedical, and translational science.** Clin Transl Sci 2022 · doi:10.1111/cts.13302 · PMID 36125173 | 초록 + 문서 서지 | 클래스 · 술어 계층 + 연관(association) 객체에 속성. (문서: 연관에 `knowledge_level` — knowledge_assertion · logical_entailment · prediction · statistical_association · observation · not_provided — 와 `agent_type` — manual_agent · automated_agent · text_mining_agent 등) | **"관찰" 과 "주장(해석)" 을 다른 수준으로 적는다** 는 구분, 그리고 **주장을 만든 행위자 종류**(사람 · AI · 도구)를 필수로 | 열거값 목록은 웹 문서끼리 다름(검색 결과가 지적) — 채택 시 판을 고정해 원문 확인 필요. 번역 의학용 술어 집합은 이 저장소 기전 칸과 맞지 않음 |
| Nadendla S et al. **ECO: the Evidence and Conclusion Ontology, an update for 2022.** Nucleic Acids Res 2022 · doi:10.1093/nar/gkab1025 · PMID 34986598 | 초록 | 주석 · 주장을 뒷받침하는 **근거 종류** 의 온톨로지, 수십 저장소가 사용, CC0 | 근거 줄 `kind`(직접 측정 · 배경 · 해석) 위에 필요하면 ECO 번호를 **선택** 칸으로 | 우리 종류 셋은 ECO 보다 훨씬 거칠다 — 처음부터 ECO 를 요구하면 입력 비용 큼 |
| de Kleer J. **An assumption-based TMS.** Artif Intell 1986;28:127–162 · Doyle J. **A truth maintenance system.** Artif Intell 1979;12(3):251–272 | 서지 | 신념과 그 정당화(근거)를 기록해, 근거가 빠지면 신념을 다시 계산(JTMS) · 가정 집합(환경)마다 동시에(ATMS) | **정당화 기록 + 재계산** 만 — 주장 상태 = 근거 줄들의 함수 | 원문 미확인. 일반 TMS 엔진은 도입하지 않음(§10) |

### 4.2 한 줄 비교 (채택하지 않음 · 참고만)

| 자료 | 확인 | 한 줄 |
|---|---|---|
| Moxon SAT et al. **LinkML: an open data modeling framework.** GigaScience 2026 · doi:10.1093/gigascience/giaf152 | 초록 | 스키마 언어. 이 저장소는 이미 `schemas/*.schema.json` + `vocab.js` + 관문이 같은 일을 함 — 바꿀 이유 없음 |
| Keating SM et al. **SBML Level 3.** Mol Syst Biol 2020 · doi:10.15252/msb.20199110 · Malik-Sheriff RS et al. **BioModels — 15 years.** NAR 2020 · doi:10.1093/nar/gkz1055 · Le Novère N et al. **MIRIAM.** Nat Biotechnol 2005 · doi:10.1038/nbt1156 | 서지(초록 미독) | 반응 · 모형 교환 형식과 모형 주석의 최소 정보. 반응은 이미 규칙 · 단계로 — 주장 층은 반응을 대신하지 않고 가리킨다. 모형 요소에 출처를 붙이는 MIRIAM 의 방식은 "칸 경로에 주장을 붙인다" 와 같은 방향 |
| Bandrowski A et al. **The Ontology for Biomedical Investigations.** PLoS One 2016 · doi:10.1371/journal.pone.0154556 · Sansone SA et al. **Toward interoperable bioscience data** (ISA). Nat Genet 2012 · doi:10.1038/ng.1054 | 서지(초록 미독) | 실험 · 조사 설계 기술. 이 저장소의 관찰 `condition` · `method` · `experiment` 가 최소판 — Study 객체를 따로 두지 않는다(§5) |
| Luo L et al. **BioRED: a rich biomedical relation extraction dataset.** Brief Bioinform 2022 · doi:10.1093/bib/bbac282 | 서지(초록 미독) | 관계 추출 자료집 — 자동 추출을 할 때 평가 자료 후보 |
| Smith N et al. **FuncFetch: an LLM-assisted workflow …** Bioinformatics 2024 · doi:10.1093/bioinformatics/btae756 | 초록 | GPT-4 로 초록 선별 · 효소 활성 추출, 기질 정밀도/재현율 0.86/0.64, **잘못된 연관 · 비대상 효소 · 환각** 을 발견해 수동 큐레이션이 필요하다고 결론 — AI 추출은 **후보** 까지(RULE-0494) 라는 이 저장소 원칙의 외부 근거 |
| Park JS et al. **GeneReL …** Database 2026 · doi:10.1093/database/baag062 | 초록 | 선별 · 추출 · 검증을 서로 다른 모델로 나눈 단계형 파이프라인 + 공동체 투표. "확신도" 를 원문의 언어적 확실성 표지로 분류 — 우리 근거 줄 `kind`(직접 · 해석)와 비슷한 축 |
| Bakker C et al. **Reducing the residue of retractions in evidence synthesis.** BMJ Evid Based Med 2024 · doi:10.1136/bmjebm-2022-111921 | 초록 | 체계적 고찰이 철회 논문을 모르고 인용하는 문제가 실재 — 논문 철회 → 주장 → 결론 전파(H6)의 필요 |
| Biolink · RDF-star · N 항 관계 물화 | — | 물화(관계를 객체로)는 우리 "주장 = 칸 경로를 가리키는 객체" 와 같은 일. RDF-star 는 직렬화 문제라 해당 없음 |

연구 결과와 해석의 분리: 위 표의 "입증한 것" 칸만 자료가 말한 것이다. "쓰는 것" 칸은 설계자의 해석이다.

---

## 5. 논리 모델 — Claim · Evidence · Observation · Assessment · Decision

### 5.1 지시서의 객체 ↔ 저장소 대응 [사실 → 제안]

| 지시서 객체 | 이미 있는 것 [사실] | 제안 |
|---|---|---|
| Entity | 정의항 D…(분자 · 단백질 · 복합체 · 경로 …) · Reaction = 규칙 + 단계 | 그대로 |
| Claim | 없음 (규칙 · 설명 자체가 주장이지만 칸 단위 객체 없음) | **새 모음 `claims.C…`** — 유일한 새 최상위 모음 |
| Source | 출처 식별자(DOI · PMID) + 받은 원문 파일 + FETCH_LOG | 그대로 — 출처 등록부 모음을 따로 만들지 않음. 식별자가 열쇠 |
| Evidence Fragment | 관찰 `quote` + `provenance.sha256` | 근거 줄 안의 `locator { file_sha256, exact, prefix?, suffix?, part: abstract\|full_text\|figure\|table\|supplement\|db_record }`. 따로 모으지 않고 **내용 주소(출처+exact 의 해시)를 계산** 해 재사용을 찾음 [제안] |
| Study / Experiment | 관찰 `experiment` · `method` · `condition` | 새 객체 없음 — 근거 줄이 관찰 O… 를 가리키면 그 관찰의 실험 칸을 씀 |
| Observation | O… (정량 · 정성), 불변 · 철회 한 번 | 그대로. 근거 줄은 출처 문장 **또는** 관찰 O… 를 가리킴. 관찰 ≠ 주장 |
| Assessment | 없음 (inspect 보고서의 표 — 확인 · 부분 · 반박) | **근거 줄 = 평가 하나.** `stance` · `kind` · `by` 를 근거 줄에 둠 — 별도 객체를 두지 않음 [제안] |
| Decision | 계획의 DEC-… (이름 겹침!) · 패치 승인 = PR 병합(DEC-0069) · 사법부 도장 | 새 Decision 객체 **만들지 않음.** "반영 결정" = 주장 · 근거 줄을 넣은 **패치가 병합된 것**. 높은 위험(근거 줄을 반박으로 바꿈 등)은 도장 · 사람 서명(DEC-0069 다) 쪽 [제안] |
| Context | 관찰 `condition` · 설명 `context` · `vocab.taxa` | 근거 줄 `context` = 관찰 `condition` 과 **같은 열쇠** + `system: in_vivo\|ex_vivo\|cell_free\|purified\|recombinant` [제안] |

### 5.2 주장 기록 (초안) [제안]

```jsonc
// claims.<새 번호 — 이름공간은 구현 때 등록> — 덧붙이기만, 고치지 않음. 할 수 있는 것: 근거 줄 덧붙이기 · retracted 한 번
{
  "target": "D000043/rule/gp_phos#via_component",   // 칸 경로 하나. '#*' = 규칙 전체(이관용)
  "says": "인산화효소 키네이스의 γ 소단위가 이 인산화를 촉매한다",  // 사람 문장(선택)
  "context": { "species": "9606" },                  // 주장이 말하려는 대상 맥락 (모델의 맥락)
  "evidence": [                                       // 근거 줄 = 평가 하나
    {
      "source": { "db": "PMID", "id": "6245074" },
      "locator": { "file_sha256": "…", "part": "abstract", "exact": "…", "prefix": "…" },
      "from": ["O000031"],                            // 또는 관찰을 가리킴 (선택)
      "stance": "supports | contradicts | qualifies",
      "kind": "direct | background | interpretation | absent",   // absent = 초록에 없음(확인했으나 말하지 않음)
      "context": { "species": "9986", "tissue": "liver", "system": "cell_free" },
      "by": { "agent": "human | ai | tool", "who": "…", "session": "…" },
      "at": "2026-11-22",
      "note": "…"
    }
  ],
  "recorded_at": "…",
  "retracted": null
}
```

- **방향 [사실 RULE-0488]:** 주장 → 정의(칸 경로)만. 규칙은 주장을 가리키지 않는다. 규칙의 근거 수준은 "이 규칙을 가리키는 주장들" 을 사법부가 모아 **계산** 한다.
- **`kind: absent`** 는 지금 note 의 "이 초록은 말하지 않음" 을 기계가 읽는 꼴로 — 지지도 반박도 아니고, "확인했으나 없음" 이다. 근거 없음(줄 0)과 구별된다.
- **AI 제안 · 사람 승인 구분:** `by.agent` 필수(Biolink `agent_type` 개념). 승인 여부는 기록 칸이 아니라 **병합 사실**(git) — 데이터가 스스로 승인을 주장할 수 없게(도장 원칙과 같음).

### 5.3 칸 상태 계산 (저장하지 않음) [제안]

칸 하나(같은 target 을 가리키는 주장들의 살아 있는 근거 줄 전부)에서:

| 상태 | 조건 |
|---|---|
| `supported` | 철회되지 않은 `supports` + `direct` 줄 ≥ 1, 반박 없음 |
| `inferred` | 지지 줄이 `interpretation` · `background` 뿐 |
| `contested` | 지지 ≥ 1 이고 `contradicts` ≥ 1 — **둘 다 남김**, 합치지 않음 |
| `refuted` | 반박만 | 
| `unsupported` | 줄 0, 또는 `absent` 뿐, 또는 지지 줄이 모두 철회 |
| `legacy` | 이관된 `#*` 주장만 있음 — 옛 level 을 그대로 보고 |

규칙의 계산 수준 = **핵심 칸** 상태 중 가장 약한 것(`contested` 는 따로 표시). 핵심 칸 목록은 규칙 종류마다 `vocab` 표 하나로(RULE-0045 · 0215):

| 규칙 종류 | 핵심 칸 [가정 — 결정 필요] | 보조 칸 |
|---|---|---|
| transition | `#exists`(A 가 B 를 바꾼다) · `effect.target` · `effect.site` · `effect.add/remove` | `via_component` · `via_site` · `with` · `regulators[i]` · `regulators[i].note` |
| meaning | `when` → `activity` | — |
| supply · degradation | `#exists` | 위치 |

맥락 맞춤: 근거 줄 맥락이 주장 맥락과 다르면 그 줄은 **이 맥락에서 `supported` 를 만들지 못한다** — 표시만 `supported_elsewhere(9986)`. 넘겨 쓰는지는 transfer-judgment 의 이전 판정(K3 · K4)이 정한다(자동 승격 없음 — §7).

---

## 6. 혼합형 관계 모델

| 관계 | 지금 자리 [사실] | 주장 객체? [제안] | 이유 |
|---|---|---|---|
| `is_a` · `part_of` · `has_part` · `refers` · `contrasts`(설명 links: 58 · 14 · 4 · 152 · 1) | `desc[].links` | **아니오 — 단순 간선** | 분류 · 소속. 근거는 설명 단위 `evidence` 로 충분. 틀리면 설명을 고침 |
| 복합체 구성(`components[]`) · 부위 소속(`site.on`) | 정의항 | 아니오 (필요하면 나중에) | 구조 사실, 대개 원천 DB(외부 ID 도장)가 근거 |
| 외부 ID | `xrefs[]` + 도장 | 아니오 | 이미 칸 단위 근거(도장)가 있음 — 가장 잘 된 부분 |
| 효소 반응 · 인산화 · 탈인산화 · 수송(전이 규칙) | `rule[type=transition]` + 단계 | **예 — 칸마다** | 여러 출처 · 종 · 조건 · 반박 · 수치 모델 영향 — 지시서 §3 의 조건 전부 |
| 조절(`regulators[]`) | 규칙 안 | **예** | 조직 · 아형마다 다름(AMP · 포도당 · Ca²⁺) |
| 상태 의미(meaning: 인산화 → 활성) | `rule[type=meaning]` | **예** | 근거가 "활성 2–3 배" 같은 관찰 + "인산화 때문" 해석으로 갈림 |
| 정성 관찰(교란 → 결과) | O… | 아니오 — **근거 줄의 출처** 가 됨 | 관찰 ≠ 주장 |

여러 참여자 · 화학양론이 있는 반응은 **주장 간선으로 다시 쓰지 않는다** (지시서 §3 끝). 주장은 규칙 칸을 가리키기만 하므로 화학양론은 규칙 · 단계에 한 번만 있다.

---

## 7. 맥락 모델

| 질문 (지시서 §5) | 답 [제안] |
|---|---|
| 1. 종이 다른 근거 | 근거 줄 `context.species`. 주장 맥락(모델의 종)과 다르면 `supported_elsewhere` |
| 2. 조직이 다른 근거 | `context.tissue`(관찰 condition 에 새 열쇠 — transfer-judgment §5.3 의 빈칸과 같은 것, 한 번에) |
| 3. in vitro / in vivo | `context.system` 다섯 값(in_vivo · ex_vivo · cell_free · purified · recombinant) — 기존 `method` 산문과 별개 |
| 4. 조건이 다르면 별개 주장? | **아니오** — 같은 칸 경로의 같은 주장에 조건이 다른 근거 줄을 둔다. 주장을 나누는 기준은 "대상 칸이 다르다" 뿐. 조건 차이가 기전을 바꾸면(예: 포도당 있을 때만 PP1 이 잘 듦) 그것은 **조절자 칸**(`regulators`)의 주장이다 |
| 5. 일반화 기준 | 이전 판정(transfer-judgment K1–K6)이 정함. 주장 층은 판정 결과를 저장하지 않고 판정의 입력만 준다 |
| 6. 자동화? | 맥락 일치 계산(같음 · 상위 · 다름)만 자동. **상위 맥락 근거가 하위를 증명하지 않음** — `vocab.taxa` 계층은 검색 · 표시에만 |

SCH-0214(마이크로 이론)는 카드가 없어 **확인 불가**. 위 방식은 "맥락 = 근거 줄의 꼬리표, 주장 상태는 맥락마다 계산" 이고, 마이크로 이론처럼 맥락마다 별도 지식 공간을 만들지 않는다 [제안 — 카드를 받으면 대조].

---

## 8. 관계 어휘 · 스키마 규칙

새 생물 술어(phosphorylates · binds_to · …)를 **만들지 않는다** [제안]. 이유: 같은 뜻이 이미 규칙 칸에 있다 — `action: 인산화` + `effect { type: modify, site, add: [phosphorylated] }` 가 "phosphorylates" 이고, `regulators[].effect: inhibits` 가 "inhibits" 다. 술어 어휘를 따로 두면 같은 사실이 두 곳에 생겨 어긋난다(RULE-0215 · RULE-0164 와 같은 이유).

필요한 어휘는 **근거 쪽** 셋뿐이다 (`vocab.js` 한 표, 로직 곁 — RULE-0045):

| 어휘 | 값 | 방향 | 대칭 | 역 | 주체 → 객체 |
|---|---|---|---|---|---|
| `claimStances` | supports · contradicts · qualifies | 근거 줄 → 주장 | 아니오 | (없음 — 역은 계산된 색인) | 출처 · 관찰 → 주장 |
| `evidenceKinds` | direct · background · interpretation · absent | — | — | — | — |
| `contextSystems` | in_vivo · ex_vivo · cell_free · purified · recombinant | — | — | — | — |
| `claimCoreFields` | 규칙 종류 → 핵심 칸 목록 (§5.3) | — | — | — | — |
| (기존) `relationRules` | is_a · part_of · instance_of | 그대로 | | | |

`derived_from` 은 근거 줄의 `from`(관찰) · 주장끼리의 파생(해석 주장 → 그 해석이 기대는 직접 주장)으로 [제안]. 주장 → 주장 파생은 **2 단계에서만**(지금 필요 사례 없음 — 빈 장치를 미리 짓지 않음 RULE-0462).

검사(관문, 구현 때 — 거부 말뭉치에 하나씩):
- 칸 경로가 실제로 있는 칸인가 · 핵심 칸 표에 있는 이름인가
- `kind: direct` 인데 `locator.exact` 없음 → 거부 (RULE-0291 과 같은 뜻)
- `locator.exact` 가 `file_sha256` 원문에 없음 → 거부 (`quoteCheck`)
- `file_sha256` 가 FETCH_LOG 에 없음 → 거부
- 주장 · 근거 줄 고침 · 지움 → 거부 (덧붙이기 · 철회만, `observationImmutability` 와 같은 관문)
- `by.agent` 없음 → 거부

SCH-0212 · SCH-0213(N 항 관계 · OWL 2 속성 특성) 카드는 **확인 불가**. 위 표의 방향 · 대칭 · 역 칸은 그 개념을 근거 어휘에만 적용한 것이다.

---

## 9. Provenance 모델 (최소)

지시서 §7 의 계보 각 단계가 저장소의 어디에 있는가:

| 단계 | 자리 [사실 / 제안] | 열쇠 |
|---|---|---|
| 원본 Source | `data/fetched/europepmc/MED-*.json` + `FETCH_LOG.jsonl` (sha256 · prev 사슬) [사실] | sha256 |
| 수집된 Evidence | 근거 줄 `locator` [제안] | file_sha256 + exact |
| Observation | O… `provenance { sha256, source }` [사실] | O… |
| Claim | C… [제안] | C… |
| Assessment | 근거 줄 `stance` · `kind` · `by` [제안] | C…#줄 순번 |
| Decision | 패치 파일 + 병합 커밋 (DEC-0069 · PLAN-102 승인 증거 판정) [사실] | 패치 id · 커밋 |
| Computational Model | IR — 규칙마다 `ref` [사실]. 주장 상태는 IR 에 넣지 않음(RULE-0036 비트 동일) | 규칙 ref |
| Simulation Result | `judicial/evidence_report.js` 의 실행 보고(문턱 · 상수 등급) [사실] + **규칙 구조 상태 요약 한 칸** [제안] | 실행 보고 |

PROV-O 에서 가져오는 것 셋: `derived_from`(근거 줄 `from` · `source`) · `generated_by`(`by`) · `approved_by`(병합 — 기록 칸이 아니라 git 사실). 나머지(Activity · Plan · Delegation …)는 도입하지 않는다.

인용 문구 자동 검증 [제안]: (1) **존재 확인** = 기계 — `quoteCheck(exact, 원문)`, 정규화(공백 · 대소문자 · 태그)는 기존 `normText`. (2) **의미 적합성** = 사람 · inspect — "이 문장이 이 칸을 지지하는가". 둘을 같은 칸에 두지 않는다: (1)은 관문 오류, (2)는 근거 줄 `stance` 와 inspect 검토.

---

## 10. TMS / ATMS 와 기존 기능

지시서 §8 의 다섯 시나리오를 계산 함수 `claimStatus(db, retracted?)` + 확장한 `retractionImpact` 로 [제안]:

| # | 시나리오 | 재평가 대상 | 유지 |
|---|---|---|---|
| 1 | 지지 근거(출처 P)가 철회 | P 를 쓰는 근거 줄 → 그 주장들의 칸 상태 → 규칙 계산 수준 → 단계 → 경로 → 결론 | P 를 쓰지 않는 주장 전부 |
| 2 | 다른 독립 근거가 남음 | 칸 상태 재계산 — 남은 `direct` 지지 줄이 있으면 `supported` 유지. **주장 전체를 철회하지 않음** | 주장 · 다른 줄 |
| 3 | 새 근거가 충돌 | 근거 줄 `contradicts` 덧붙임 → 칸 `contested` → 규칙 표시. 지지 줄을 지우지 않음 | 둘 다 |
| 4 | 파생 해석 존재 | (2 단계) 해석 주장의 `from` 이 가리키는 직접 주장 상태가 내려가면 해석도 재계산 대상으로 **표시** | — |
| 5 | 파생이 모델에 반영 | 규칙 → 단계 → 경로 → 사전 등록 결론(이미 `retractionImpact` 가 함) | IR · 엔진은 그대로 |

독립성: "남은 근거" 는 **서로 다른 출처**(PMID)로 센다 — 같은 실험실의 같은 자료를 두 번 세지 않는 것은 I 축(PLAN-071 · ASY-16) 몫이고, 여기서는 출처 수만 [가정].

새 TMS 를 짓지 않는 이유 [제안]: JTMS 의 핵심(정당화를 기록하고 빠지면 다시 계산)은 "근거 줄 = 정당화, 상태 = 계산" 으로 이미 된다. 상태를 **저장하지 않으므로** 갱신 전파 코드가 필요 없다(등급 계산과 같음). ATMS 의 장점(여러 가정 집합을 동시에)은 맥락마다 상태를 계산하는 것으로 대신하고, 가정 조합 폭발 관리는 지금 규모(주장 예상 수백)에서 필요 없다. 규모가 수만이 되면 SQLite 색인(RULE-0465)에 역색인을 두는 것으로 — 그때 다시 본다.

SCH-0164(진리 유지 체계) 카드는 **확인 불가**.

---

## 11. 효율성 비교

규모 기준 [사실]: 규칙 160(근거 curated 66 · abstracted 64 · asserted 30) · 설명 212 · 규칙 근거 PMID 36 종 · D000051 네 규칙: 근거 PMID 2 · 2 · 2 · 3, 구조 칸(effect 외) 1 · 2 · 3 · 2, 조절자 0 · 0 · 1 · 1.
추정 [가정]: 규칙 하나 핵심 칸 4 + 보조 칸 평균 2 · 칸마다 근거 줄 평균 2 · 근거 줄 하나 ~400 B(인용 문구 포함).

| 항목 | A 지금 (규칙 + 출처) | B 전부 주장 (설명 links · 구성 · 외부 ID 까지) | C 혼합 (전이 · 조절 · 의미 칸만) |
|---|---|---|---|
| 저장 | 0 추가 | links 229 + 구성 + xref 119 + 규칙 칸 ~960 → 주장 ~1,500 · 근거 줄 ~3,000 · ~1.2 MB (db 708 KB 의 ~1.7 배) | 이관 주장 160(줄 160, ~50 KB) + 시범 D000051 주장 ~20 · 줄 ~40(~16 KB). 전부 채우면 규칙 칸 ~960 · 줄 ~1,900 · ~0.75 MB |
| 입력 (논문 한 편) | 출처 2 줄 + note 산문 | 칸마다 줄 · 인용 · 맥락 — 설명 링크까지 | 칸마다 줄 · 인용 · 맥락 — 규칙 칸만. 인용 문구는 이미 받은 초록에서 복사(원문은 `data/fetched/`) |
| 검수 (주장 하나) | 규칙 전체를 다시 읽고 note 와 대조 (P1 검토가 이랬음 — 보고서 118 줄) | 줄 하나 = 문장 하나 대조 · 기계가 존재 확인 | C 와 같음 — 존재는 기계, 사람은 의미만 |
| 중복 | 같은 논문이 규칙마다 반복 (6245074 가 세 규칙에) | 내용 주소로 같은 인용을 찾음 | 같음 |
| 조회 (분자 하나의 근거) | 정의항 · 규칙 훑기 | 주장 역색인 | 주장 역색인 (계산, 저장 안 함) |
| 영향 분석 | 관찰 철회만 자동, 논문 철회는 손 | 출처 → 줄 → 주장 → 칸 → 규칙 → 단계 | 같음 |
| 계산 (시뮬레이터) | IR 그대로 | IR 그대로 (주장은 IR 밖) | IR 그대로 · 구조 관문은 선택 |
| 유지보수 | — | 형식 변경 큼 · 설명 링크 계약까지 바뀜 · 이관 검사 큼 | 새 모음 하나 · 어휘 표 넷 · 이관 1 회(기존 근거 → `#*` 주장) |
| AI 비용 | — | 단순 관계까지 문장 추출 · 검토 — 토큰 대부분이 가치 낮은 분류 관계에 | 근거가 다툼이 되는 칸에만. FuncFetch(2024)의 오류 유형(잘못된 연관 · 환각)을 생각하면 AI 는 **후보 줄** 까지 |

판단 [제안]: B 는 저장 · 입력 비용이 가장 크고, 늘어난 대부분(분류 링크 152 개의 `refers` 등)은 다툼이 없는 관계다. A 는 비용 0 이지만 H1–H7 을 못 푼다. **C 가 이 저장소의 실제 사용 사례(규칙 칸이 다투어짐 — P1 검토)에 맞는다.** 단, C 의 입력 비용은 A 의 몇 배다 [가정 — 시범에서 시간을 재야 함]. 그래서 **채우기는 다투어지는 칸부터 · 닿을 때(RULE-0470)** 만 하고, 나머지는 이관된 `#*` 주장으로 둔다.

---

## 12. 글리코겐 인산화효소 시범 (D000051 네 단계)

아래는 저장소 데이터 · 독립 검토 보고서에서 **확인된 것만** 칸 단위로 옮긴 것이다. 새 사실을 채우지 않았다. 인용 문구(`exact`)는 시범 구현 때 받은 초록에서 복사한다 — 여기서는 출처와 판정만.

| 단계 · 규칙 | 칸 | 근거 줄 (출처 · 맥락 · 종류 · 방향) [사실: db note · 검토 보고서] | 계산 상태 [제안] |
|---|---|---|---|
| S000008 `D000057/rule/phk_phos` | `#exists` | 164350 Cohen 1975 · 토끼 골격근 · purified · direct · supports / 6245074 Chrisman 1980 · 토끼 간 · cell_free · direct(활성화 2–3 배) · supports | supported_elsewhere(토끼) — 사람 맥락 근거 없음 |
| | `effect.site`(β 소단위 세린) | 164350 · α·β 소단위 세린 인산화 · direct · supports / 6245074 · 간 효소 인산화 자체는 초록이 보이지 않음 · absent | supported_elsewhere |
| S000009 `D000043/rule/gp_phos` | `#exists` | 6245074 · 토끼 간 PhK 가 토끼 근육 인산화효소 b 를 인산화 · direct · supports / 168880 Lederer 1975 · 사람 적혈구 · direct · supports | **supported (9606, 적혈구)** — 기질은 근육형 · 간형 아님(qualifies) |
| | `via_component`(γ) | 두 출처 모두 · absent | **unsupported** → 규칙 계산 수준이 이 칸에 묶임(보조 칸이면 표시만) |
| | `effect.site`(Ser14) | absent (Q6) | unsupported |
| D000043 `rule/active`(meaning) | `when→activity` | 6245074 · 활성 2–3 배 · direct(관찰) / "인산화 때문" · interpretation | inferred |
| D000043 `rule/basal`(meaning, asserted) | `when→activity`(비인산화 = inactive) | 6245074 · MgATP 의존 활성화가 PKA 억제제에 영향 없음(PKA 없이도 활성, Ca²⁺) · **contradicts(부분)** · 165358 (검토 보고서 §2) | **contested** — 지금은 asserted 라 아무 경고 없음 |
| S000010 `D000044/rule/phosphorolysis` | `#exists` | 12067839 · 10949035 (db note — 시범 때 대조) | (시범에서 계산) |
| | `regulators[D000046 inhibits]` | (db note — 간에서 포도당 결합) | (시범에서 계산) |
| S000011 `D000052/rule/gp_dephos` | `#exists` | 3007140 Alemany 1986 · 쥐 간 분획 · direct + interpretation / 10417316 Wang 1999 · 시험관 · 종 초록에 없음 · direct | supported_elsewhere(쥐) |
| | `regulators[D000046 activates]` | 6794883 Kasvinsky 1981 · 쥐 분리 간세포 · 포도당이 a → b 전환 촉진, **카페인 + 포도당 대 포도당 단독 1.7 배** (원칙 ⑤) · direct · supports / 효소가 PP1 이라는 것은 초록에 없음 · interpretation | inferred (조건 qualifies: 카페인) |
| D000044 `rule/a_form` · `b_form` | `when→activity` | 1008826 · 사람 간 · direct / 168880 · 사람 적혈구 · direct / "a 형 = 인산화형" · background(관례) | supported(9606) · 대응은 background |

지시서 §10 상황 일곱의 재현:

| 상황 | 시범에서 | 확인 |
|---|---|---|
| 1 같은 주장 · 여러 논문 | S000009 `#exists` (6245074 · 168880) | [사실] |
| 2 다른 종 | S000008 토끼 대 모델 사람 | [사실] |
| 3 같은 종 · 다른 조직 | 토끼 근육(164350) · 토끼 간(6245074) | [사실] |
| 4 조건에 따라 다름 | Kasvinsky 1.7 배 = 카페인 조건 | [사실] |
| 5 직접 관찰 + 해석 | D000043 active (2–3 배 직접 · 인산화 때문 해석) | [사실] |
| 6 상충 근거 | D000043 basal 대 6245074 · 165358 | [사실 — 검토 보고서 "반박(부분)"] |
| 7 근거 철회 → 파생 | **가정** 철회 6245074 → S000008 `#exists` 는 164350 으로 남음(독립 근거) · D000043 active 는 유일 근거 상실 → unsupported · S000009 `#exists` 는 168880 으로 남음 · basal 의 반박도 사라짐. 실제 철회는 없음 | [가정 시나리오] |

시범이 보여 주는 것: S000009 는 지금 등급표에서 curated(S3 · D3 → parameter 급)로 보이지만, 칸 단위로는 `via_component` · Ser14 가 unsupported 이고, D000043 basal 은 asserted 인데 실제로는 **다툼(contested)** 이다. 이 두 가지가 PLAN-115 가 겨냥한 신호다.

---

## 13. 이관 방안

### 13.1 규칙

| 항목 | 방안 [제안] |
|---|---|
| ID 보존 | 정의항 D… · 단계 S… · 관찰 O… · 값 V… · 출처 식별자 **모두 그대로**. 새 번호는 C… 만 (`meta.next.C`) |
| 기존 규칙 근거 → 주장 | 규칙 하나 = 주장 하나 `target: <rule>#*`, 근거 줄 = 기존 sources 각각, `kind: legacy`, `stance: supports`, `locator` 없음, `by: { agent: 'tool', who: 'migrations/…' }`, 옛 `level` · `note` 원문 그대로 보존 |
| 기존 `evidence` 칸 | **지우지 않는다** (1 단계). 규칙 `evidence` 와 `#*` 주장이 같은 내용을 갖는 기간 동안 관문이 둘의 일치를 검사 → 2 단계에서 규칙 `evidence` 를 읽기 전용 파생으로 |
| asserted / curated 대응 | `legacy` 상태는 옛 level 을 그대로 보고 — curated 를 `supported` 로 **올리지 않음** (지시서 §11). 등급 계산은 이관 전후 같음 |
| 자동 변환 불가 | note 산문의 칸별 사정(직접 · 해석 · 초록에 없음) — 산문을 쪼개는 자동 변환 금지(RULE-0463: 번역기는 생성하지 않음). **author 가 손으로** 칸 주장을 덧붙임 |
| 수동 검토 | D000051 네 규칙 + D000043 basal(반박) — 시범. 나머지는 닿을 때(RULE-0470) |
| 설명 `desc[].evidence` | 이관하지 않음 (C 혼합 — 설명은 단순 간선 쪽) |
| 역변환 | `#*` 주장 → 규칙 `evidence` 는 1:1 이라 기계로 되돌림 가능. 칸 주장은 역변환 대상 아님(새 정보) |
| 동등성 검사 | 이관 전후: `dbtool grade` 표 동일 · `dbtool validate` 오류 0 · 시나리오 궤적 비트 동일(RULE-0036) · 규칙 근거 sources 집합 = `#*` 주장 줄 집합 |

### 13.2 형식 변경에 함께 움직이는 것 (RULE-0261)

`SCHEMA.md` 새 절 · `schemas/` 계약 하나(claim) · `migrations/` 이관 스크립트 · `model.js` normalize · `judicial/` 관문(불변 · 칸 경로 · quoteCheck · by) · `judicial/reliability.js` 규칙 계산 수준 · `retractionImpact` 확장 · 거부 말뭉치 + FLOOR 올림(RULE-0205) · `docs/textbook/03-데이터-모델.md` · `04-알고리즘.md`(RULE-0208) · CHANGES.md 한 행.

### 13.3 들어가지 않는 것

엔진 · 컴파일러 · IR(비트 동일) · 정성 그래프 코드 · 도장 체계 · 설명 links.

### 13.4 L000030 (needs xref)

| 안 | 내용 | 효과 |
|---|---|---|
| (가) | `needMet` xref 를 `status === 'verified'` + 유효한 도장일 때만 해소 | L000030 이 열림으로 돌아옴. 다른 한계도 다시 열릴 수 있음 — 구현 전에 영향 목록을 뽑아 사용자에게 |
| (나) | needs 에 `status` 칸을 선택으로(`{kind:'xref', db, on, status?:'verified'}`), 없으면 지금 동작 | 기존 해소 유지 · Identity_Gap 만 verified 요구 |

권고 (가) [제안] — Identity_Gap 의 요구는 "번호를 **확인**" 이라 asserted 로 닫히면 뜻이 맞지 않는다. 다만 판정 결과가 바뀌므로 사용자 결정(RULE-0163: 결과가 바뀌면 관찰로 고르고, 없으면 Gap note).

---

## 14. 보안 · 검증 · 승인 경계

| 행위 | 누가 [제안] | 막는 장치 [사실 → 제안] |
|---|---|---|
| 주장 · 근거 줄 덧붙이기 | author (서기 put 만 — 삼권 경계) | 문지기 쓰기 구역 · 관문 불변 검사 |
| 근거 줄 `stance` 판단 | author 가 적고 **inspect 가 독립 검토** (작성자와 다른 세션, 원문을 직접 읽음) | inspect 보고서 · 승인 증거 판정(PLAN-102) |
| 존재 확인 (인용이 원문에 있나) | 사법부 기계 | `quoteCheck` 관문 — 사람 판단 아님 |
| 칸 상태 · 규칙 수준 계산 | 사법부 (계산, 저장 안 함) | 데이터가 스스로 상태를 주장할 수 없음 |
| 반영 결정 | 사람 — PR 병합 (DEC-0069) | AI 병합 막음(PLAN-113) |
| 반박 줄 추가 · 철회 | 위와 같음 + 높은 위험이면 사람 서명(DEC-0069 다, 미구현) | — |
| AI 가 만든 후보 줄 | `by.agent: ai` 필수 · 기준이 아님(RULE-0494) | 관문: `by` 없음 거부 |

PLAN-116(거버넌스 대조 조사)과 겹치는 곳: 위 표의 "inspect 독립성"(같은 감독 지시 · 같은 작성자 설명에 기대면 독립이 아님 — 제안서 §7) · Deny/Hold 구분(관문 오류 = Deny, `contested` = Hold 성격). PLAN-116 조사에서 이 표를 입력으로 [제안].

---

## 15. 단계별 구현 로드맵 (각 단계 별도 승인)

| 단계 | 내용 | 모드 | 끝 조건 |
|---|---|---|---|
| 0 | L000030 — `needMet` xref 수정 (안 가 · 나 중 결정) | develop | 영향 받는 한계 목록 · 시험 · 사용자 결정 |
| 1 | 형식: `claims` 모음 · 어휘 표 넷 · 관문(불변 · 칸 경로 · quoteCheck · by) · 이관(`#*`) · 동등성 시험 · 거부 말뭉치 · 교과서 | develop | 이관 전후 등급 · 궤적 동일 · 사용자 결정(RULE-0261) |
| 2 | 계산: 칸 상태 · 규칙 계산 수준 · `dbtool claims`(읽기) · 등급표에 칸 상태 열 | develop | 시범 데이터 없이도 시험 fixture 로 상태 여섯 재현 |
| 3 | 시범: D000051 네 규칙 + D000043 basal 칸 주장 (P1 수정 권고 반영과 같이) → inspect 독립 검토 | author → inspect | §12 표가 기계 계산으로 재현 |
| 4 | 철회 전파 확장: 출처 · 근거 줄 출발 · 남은 독립 근거 · 반박 | develop | 시나리오 1–3 · 5 시험 |
| 5 | (선택) 규칙 구조 관문 — 시나리오가 `min_structure` 를 올릴 때만, 올리기만(raise-only) | develop | 사용자 결정 — 기본으로 켜면 asserted 30 · abstracted 64 규칙의 시나리오가 막힘 |
| 6 | (나중) 해석 주장 → 직접 주장 파생 · I 축 독립성 | — | 필요 사례가 생길 때 |

DEC-0066 메타 편중 경보: 단계 1–2 는 개발체계 일이다. 단계 3 이 과학 축(D000051)이라 1 → 3 사이를 짧게 [제안].

---

## 16. 미해결 질문 · 설계 결정 목록

| # | 결정 | 권고 | 근거 표시 |
|---|---|---|---|
| Q1 | 주장 층을 C 혼합 최소판(새 모음 하나, 생물 술어 어휘 없음)으로 갈 것인가 | 예 | [제안] §6 · §8 · §11 |
| Q2 | 규칙 종류별 핵심 칸 목록 (§5.3 표) — 특히 transition 의 `via_component` · `effect.site` 가 핵심인가 보조인가 | `effect.site` 핵심 · `via_component` 보조 | [가정] — 보조로 두면 S000009 는 표시만, 핵심이면 수준이 내려감 |
| Q3 | 근거 줄 `kind` 넷(direct · background · interpretation · absent)이 P1 note 형식("직접 · 해석 · 초록에 없음")과 같은 것으로 확정할 것인가 — DEC-0073 의 "note 형식 통일" 질문과 묶임 | 예 | [제안] |
| Q4 | Assessment · Decision 을 별도 객체로 만들지 않는 것 (근거 줄 = 평가, 병합 = 결정) | 예 | [제안] §5.1 — DEC-… 이름 충돌도 피함 |
| Q5 | 이관 1 단계에서 규칙 `evidence` 를 남기고 두 곳 일치 검사 → 2 단계에서 파생으로 | 예 | [제안] §13.1 |
| Q6 | L000030 안 (가) · (나) | (가) | [제안] §13.4 |
| Q7 | 구조 관문(단계 5)을 만들 것인가 · 기본값 | 만들되 기본 꺼짐(raise-only) | [제안] |
| Q8 | 관찰 `condition` 에 `tissue` · `system` 열쇠를 더할 것인가 (transfer-judgment 와 한 번에) | 예 | [제안] — 형식 변경 |
| Q9 | Biolink `knowledge_level` · ECO 번호를 선택 칸으로 둘 것인가 | 지금은 아니오 | [외부] 열거값 판이 문서마다 다름 |
| Q10 | SCH-0212 · 0214 · 0164 · 0186 · 0074 · 0213 카드를 받아 §6–§10 을 다시 대조할 것인가 | 구현 전에 | 확인 불가 |
| Q11 | 시범(단계 3)에서 논문 한 편 입력 시간을 재서 §11 입력 비용 가정을 확인 | 예 | [가정] |

---

## 17. 참고문헌

확인 수준은 §4 표 그대로(초록 = Europe PMC 에서 받은 서지 · 초록을 읽음 · 서지 = 웹 검색으로 존재 · 서지만). 이 세션이 받은 Europe PMC 응답은 세션 임시 폴더에만 있고 저장소 `data/fetched/` 에는 넣지 않았다(조사 단계 — 데이터 쓰기 없음).

1. Clark T, Ciccarese PN, Goble CA. Micropublications: a semantic model for claims, evidence, arguments and annotations in biomedical communications. J Biomed Semantics. 2014. doi:10.1186/2041-1480-5-28 · PMID 26261718 — 초록
2. Groth P, Gibson A, Velterop J. The anatomy of a nanopublication. Inf Serv Use. 2010;30:51–56. doi:10.3233/ISU-2010-0613 — 서지
3. Menotti L, Marchesin S, Giachelle F, Silvello G. Provenance-driven nanopublications: representing source lineage and trust networks for multi-source assertions. Int J Digit Libr. 2025;26(4):24. doi:10.1007/s00799-025-00431-x · PROV-K https://prov-k.dei.unipd.it/ontology/ — 서지
4. W3C. PROV-O: The PROV Ontology. W3C Recommendation, 30 April 2013. https://www.w3.org/TR/2013/REC-prov-o-20130430/ — 서지
5. W3C. Web Annotation Data Model. W3C Recommendation, 23 February 2017. https://www.w3.org/TR/2017/REC-annotation-model-20170223/ — 서지
6. Unni DR, Moxon SAT, Bada M, et al. Biolink Model: A universal schema for knowledge graphs in clinical, biomedical, and translational science. Clin Transl Sci. 2022. doi:10.1111/cts.13302 · PMID 36125173 — 초록 · 문서 https://biolink.github.io/biolink-model/KnowledgeLevelEnum/ (서지)
7. Nadendla S, Jackson R, Munro J, et al. ECO: the Evidence and Conclusion Ontology, an update for 2022. Nucleic Acids Res. 2022. doi:10.1093/nar/gkab1025 · PMID 34986598 — 초록
8. de Kleer J. An assumption-based TMS. Artif Intell. 1986;28:127–162 — 서지
9. Doyle J. A truth maintenance system. Artif Intell. 1979;12(3):251–272 — 서지
10. Moxon SAT, Solbrig H, Harris NL, et al. LinkML: an open data modeling framework. GigaScience. 2026. doi:10.1093/gigascience/giaf152 — 초록
11. Keating SM, Waltemath D, König M, et al. SBML Level 3: an extensible format for the exchange and reuse of biological models. Mol Syst Biol. 2020. doi:10.15252/msb.20199110 · PMID 32845085 — 서지(초록 미독)
12. Malik-Sheriff RS, Glont M, Nguyen TVN, et al. BioModels — 15 years of sharing computational models in life science. Nucleic Acids Res. 2020. doi:10.1093/nar/gkz1055 · PMID 31701150 — 서지(초록 미독)
13. Le Novère N, Finney A, Hucka M, et al. Minimum information requested in the annotation of biochemical models (MIRIAM). Nat Biotechnol. 2005. doi:10.1038/nbt1156 · PMID 16333295 — 서지(초록 미독)
14. Bandrowski A, Brinkman R, Brochhausen M, et al. The Ontology for Biomedical Investigations. PLoS One. 2016. doi:10.1371/journal.pone.0154556 · PMID 27128319 — 서지(초록 미독)
15. Sansone SA, Rocca-Serra P, Field D, et al. Toward interoperable bioscience data. Nat Genet. 2012. doi:10.1038/ng.1054 · PMID 22281772 — 서지(초록 미독)
16. Luo L, Lai PT, Wei CH, Arighi CN, Lu Z. BioRED: a rich biomedical relation extraction dataset. Brief Bioinform. 2022. doi:10.1093/bib/bbac282 · PMID 35849818 — 서지(초록 미독)
17. Smith N, Yuan X, Melissinos C, Moghe G. FuncFetch: an LLM-assisted workflow enables mining thousands of enzyme-substrate interactions from published manuscripts. Bioinformatics. 2024. doi:10.1093/bioinformatics/btae756 · PMID 39718779 — 초록
18. Park JS, Ha S, Lee Y, Kang YJ. GeneReL: a large language model-powered platform for gene regulatory relationship extraction with community curation. Database. 2026. doi:10.1093/database/baag062 — 초록
19. Bakker C, Boughton S, Faggion CM, et al. Reducing the residue of retractions in evidence synthesis: ways to minimise inappropriate citation and use of retracted data. BMJ Evid Based Med. 2024. doi:10.1136/bmjebm-2022-111921 · PMID 37463764 — 초록

저장소 안 근거(이 보고서가 읽은 곳): `data/db.json`(senses D000043 · D000044 · D000048 · D000051 · D000052 · D000057, steps S000008–S000011, limitations L000030, observations O000001 · O000019) · `SCHEMA.md` §근거 · §7 · 관찰 절 · `judicial/judicial.js` 22–40 · 1426–1470 · `judicial/reliability.js` · `judicial/qual_graph.js` 머리말 · `judicial/collection_audit.js` · `mcp/run.mjs` · `vocab.js` relationRules · `attestations/registry.json` · `data/fetched/europepmc/FETCH_LOG.jsonl` · `docs/design/transfer-judgment.md` §5–§6 · `docs/reports/2026-11-22-sup-0001-r1-p1-review.md`.
