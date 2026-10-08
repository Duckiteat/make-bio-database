# 한계 등록부 (Limitation & Constraint Registry)

> 이 파일은 `data/db.json` 의 `limitations` 에서 생성된다 — 직접 고치지 말고 패치(`limitations: [...]`)로 등록한 뒤 `node dbtool.mjs limitations --write`.
> 새 개념(정의항)을 설계하기 전에 반드시 이 파일을 읽고, 그 개념이 어떤 한계를 어떻게 해결하는지 정의항의 `addresses` 에 적는다.
> 상태는 계산된다: 해결 경로(needs)의 데이터가 모두 들어오면 resolved. ✓ = 이미 채워진 데이터, ✗ = 아직 없는 데이터.

| 종류 | 열림 | 해결 | 합계 |
|---|---|---|---|
| Kinetic_Gap | 17 | 0 | 17 |
| Concentration_Gap | 7 | 0 | 7 |
| Structural_Gap | 13 | 0 | 13 |
| Resource_Gap | 4 | 0 | 4 |
| Identity_Gap | 7 | 0 | 7 |

## Kinetic_Gap — 속도·친화도·시간 상수 공백

반응 속도(kcat·Km), 결합 친화도(Kd), 반감기 같은 시간 정보가 없어 경쟁·지속·종료를 정할 수 없는 곳.

| ID | Target | Type | Requirement | 해결 경로 | 상태 | 다루는 개념 |
|---|---|---|---|---|---|---|
| L000004 | D000100/rule/kb_binding (TNF 유전자 · kb_binding) | Kinetic_Gap | NF-κB 가 여러 프로모터의 κB 자리를 두고 경쟁하는데 결합 친화도가 없어 누가 먼저 차지하는지 단계 순서로 정해진다<br>발견: 재사용 시연(NFKBIA 표적 추가) | ✗ 속도 상수 Kd @ D000100/rule/kb_binding | open (0/1) | D000107 막–핵 신호 연쇄<br>D000115 핵 이동 후 전사 활성화<br>D000117 반응 속도 모델 |
| L000005 | D000049/rule/camp_hydrolysis (포스포다이에스터레이스 · camp_hydrolysis) | Kinetic_Gap | cAMP 를 PKA 활성화와 PDE 분해가 나눠 갖는 비율 — 이산 시뮬레이션은 촉매 수로만 정한다<br>발견: 첫 시뮬레이션: 한 라운드 1회 발화에서 PDE 가 cAMP 를 먼저 다 분해해 PKA 가 켜지지 않음 → 촉매 수만큼 발화로 우회 | ✗ 속도 상수 kcat·Km @ D000049/rule/camp_hydrolysis<br>✗ 속도 상수 Kd @ D000042/rule/camp_release | open (0/2) | D000112 2차 전령 증폭<br>D000117 반응 속도 모델 |
| L000006 | D000102 (LPS–TLR4–NF-κB 신호 전달) | Kinetic_Gap | 단계에 시간이 없다 — 신호의 지속·종료(IκBα 재합성, 탈인산화)와 진동을 다룰 수 없다<br>발견: 2026-10-08 LPS→NF-κB 스트레스 시험 | ✗ 속도 상수 kcat·Km @ D000085/rule/ikba_s32<br>✗ 속도 상수 kcat·Km @ D000098/rule/ikba_degradation<br>✗ 속도 상수 k·order @ D000089/rule/nuclear_import | open (0/3) | D000106 수용체 매개 신호 연쇄<br>D000111 키네이스 연쇄<br>D000113 GTPase 타이머<br>D000117 반응 속도 모델<br>D000128 생애 주기 모델 |
| L000019 | D000126/rule/atp_supply (ATP 재생 · atp_supply) | Kinetic_Gap | 세포질 ATP 재생 속도(세포 유형별) — 없으면 ATP 저장소는 소비만 되고 재생 경로가 꺼져 고갈된다<br>발견: v7 생애 주기 엔진 도입 — 속도 상수가 없는 공급·분해 규칙은 시뮬레이터가 적용하지 않음 (audit-run 의 AUDIT_KINETIC_GAP·AUDIT_RESOURCE) | ✗ 속도 상수 k @ D000126/rule/atp_supply | open (0/1) | D000129 대사물 저장소 모델 |
| L000020 | D000123/rule/gtp_regeneration (뉴클레오사이드 이인산 키네이스 · gtp_regeneration) | Kinetic_Gap | NDPK 의 GDP → GTP 재생 속도 — 없으면 GTP–GDP 순환이 닫히지 않는다<br>발견: v7 생애 주기 엔진 도입 — 속도 상수가 없는 공급·분해 규칙은 시뮬레이터가 적용하지 않음 (audit-run 의 AUDIT_KINETIC_GAP·AUDIT_RESOURCE) | ✗ 속도 상수 k @ D000123/rule/gtp_regeneration | open (0/1) | — |
| L000021 | D000124/rule/amp_recharge (아데닐산 키네이스 · amp_recharge) | Kinetic_Gap | 아데닐산 키네이스의 AMP 재충전 속도 — 없으면 AMP 가 쌓이기만 한다<br>발견: v7 생애 주기 엔진 도입 — 속도 상수가 없는 공급·분해 규칙은 시뮬레이터가 적용하지 않음 (audit-run 의 AUDIT_KINETIC_GAP·AUDIT_RESOURCE) | ✗ 속도 상수 k @ D000124/rule/amp_recharge | open (0/1) | — |
| L000022 | D000125/rule/ppi_hydrolysis (무기 피로인산가수분해효소 · ppi_hydrolysis) | Kinetic_Gap | 무기 피로인산가수분해효소의 PPi 가수분해 속도 — 없으면 PPi 가 쌓이기만 한다<br>발견: v7 생애 주기 엔진 도입 — 속도 상수가 없는 공급·분해 규칙은 시뮬레이터가 적용하지 않음 (audit-run 의 AUDIT_KINETIC_GAP·AUDIT_RESOURCE) | ✗ 속도 상수 k @ D000125/rule/ppi_hydrolysis | open (0/1) | — |
| L000023 | D000127/rule/nt_supply (뉴클레오타이드 공급 · nt_supply) | Kinetic_Gap | 핵질 뉴클레오타이드 공급 속도(합성·재활용) — 없으면 전사가 뉴클레오타이드 저장소를 바닥낸다<br>발견: v7 생애 주기 엔진 도입 — 속도 상수가 없는 공급·분해 규칙은 시뮬레이터가 적용하지 않음 (audit-run 의 AUDIT_KINETIC_GAP·AUDIT_RESOURCE) | ✗ 속도 상수 k @ D000127/rule/nt_supply | open (0/1) | — |
| L000024 | D000101/rule/turnover (TNF mRNA · turnover) | Kinetic_Gap | TNF mRNA 반감기(대식세포, LPS 자극 조건) — 없으면 mRNA 가 분해되지 않고 쌓인다<br>발견: v7 생애 주기 엔진 도입 — 속도 상수가 없는 공급·분해 규칙은 시뮬레이터가 적용하지 않음 (audit-run 의 AUDIT_KINETIC_GAP·AUDIT_RESOURCE) | ✗ 속도 상수 half_life @ D000101/rule/turnover | open (0/1) | — |
| L000025 | D000086/rule/basal_turnover (IκBα · basal_turnover) | Kinetic_Gap | 유리 IκBα 의 기저 분해 반감기 — 없으면 유리 IκBα 가 분해되지 않는다<br>발견: v7 생애 주기 엔진 도입 — 속도 상수가 없는 공급·분해 규칙은 시뮬레이터가 적용하지 않음 (audit-run 의 AUDIT_KINETIC_GAP·AUDIT_RESOURCE) | ✗ 속도 상수 half_life @ D000086/rule/basal_turnover | open (0/1) | — |
| L000037 | D000160/rule/efflux (이산화탄소 · efflux) | Kinetic_Gap | 이산화탄소 배출 속도(반감기) — 없으면 CO₂ 가 기질에 쌓이기만 하고 가역 탈카복실화의 역반응 압력을 정할 수 없다<br>발견: 시트르산 회로 소진 시험(가상 시나리오)의 사후 분석이 제한 요인으로 지목 | ✗ 속도 상수 half_life @ D000160/rule/efflux | open (0/1) | — |
| L000038 | D000148 (시트르산 회로) | Kinetic_Gap | 시트르산 회로 여덟 효소의 kcat·Km (사람, 미토콘드리아 기질) — 없으면 단계가 즉시 처리되어 회로의 시간·병목을 말할 수 없다<br>발견: 시트르산 회로를 넣으면서 — 속도 상수 미확인 | ✗ 속도 상수 kcat·Km @ D000149/rule/condense<br>✗ 속도 상수 kcat·Km @ D000150/rule/isomerize<br>✗ 속도 상수 kcat·Km @ D000151/rule/oxdecarb<br>✗ 속도 상수 kcat·Km @ D000152/rule/oxdecarb<br>✗ 속도 상수 kcat·Km @ D000153/rule/slp<br>✗ 속도 상수 kcat·Km @ D000154/rule/oxidize<br>✗ 속도 상수 kcat·Km @ D000155/rule/hydrate<br>✗ 속도 상수 kcat·Km @ D000156/rule/oxidize | open (0/8) | — |
| L000043 | D000151/rule/oxdecarb (아이소시트르산 탈수소효소 · oxdecarb) | Kinetic_Gap | NAD 의존 아이소시트르산 탈수소효소의 역반응 속도(또는 평형 상수) — 생리 조건에서 거의 비가역으로 알려져 있으나 값이 없어, CO₂ 축적이 회로를 평형으로 멈추게 하는지(가상 시험 3) 데이터로 판정할 수 없다<br>발견: 시트르산 회로 소진 시험 3(가상): 가역으로 둔 IDH 가 CO₂ 축적으로 평형(역/정 ≈ 1)에 닿아 정지 | ✗ 속도 상수 k_r @ D000151/rule/oxdecarb | open (0/1) | — |
| L000044 | D000039 (cAMP) | Kinetic_Gap | cAMP 의 세포질 확산 계수 (SI m^2/s) — 없으면 Tier 3 영역 승격 판단(Damköhler)과 경계 유속을 계산할 수 없다<br>발견: 형식 v8 (3 층 엔진): 필드가 생겨 표현 가능해진 공백 — docs/design/hybrid-multiscale-engine.md §6 | ✗ 관찰 diffusion_coefficient @ D000039 cAMP · 세포질 | open (0/1) | — |
| L000045 | D000089 (NF-κB p50–p65 이량체) | Kinetic_Gap | NF-κB p50–p65 이량체의 세포질·핵질 확산 계수 — 핵 이동 전후 공간 기울기를 Tier 3 로 풀 때 필요<br>발견: 형식 v8 (3 층 엔진): 필드가 생겨 표현 가능해진 공백 — docs/design/hybrid-multiscale-engine.md §6 | ✗ 관찰 diffusion_coefficient @ D000089 NF-κB p50–p65 이량체 · 세포질<br>✗ 관찰 diffusion_coefficient @ D000089 NF-κB p50–p65 이량체 · 핵질 | open (0/2) | — |
| L000046 | D000032 (ATP) | Kinetic_Gap | ATP 의 세포질 확산 계수 — Tier 1 연속 장의 청산 시간 상수<br>발견: 형식 v8 (3 층 엔진): 필드가 생겨 표현 가능해진 공백 — docs/design/hybrid-multiscale-engine.md §6 | ✗ 관찰 diffusion_coefficient @ D000032 ATP · 세포질 | open (0/1) | — |
| L000048 | D000148 (시트르산 회로) | Kinetic_Gap | 시트르산 회로 여덟 단계의 표준 반응 자유 에너지 ΔG°′ (J/mol) — 없으면 역반응 속도를 미시적 가역성으로 정할 수 없고 고리 열역학 검사가 비어 있다<br>발견: 형식 v8 (3 층 엔진): 필드가 생겨 표현 가능해진 공백 — docs/design/hybrid-multiscale-engine.md §6 | ✗ 속도 상수 dG0 @ D000149/rule/condense<br>✗ 속도 상수 dG0 @ D000150/rule/isomerize<br>✗ 속도 상수 dG0 @ D000151/rule/oxdecarb<br>✗ 속도 상수 dG0 @ D000152/rule/oxdecarb<br>✗ 속도 상수 dG0 @ D000153/rule/slp<br>✗ 속도 상수 dG0 @ D000154/rule/oxidize<br>✗ 속도 상수 dG0 @ D000155/rule/hydrate<br>✗ 속도 상수 dG0 @ D000156/rule/oxidize | open (0/8) | — |

## Concentration_Gap — 농도·부피·질량 수지 공백

몰 농도, 세포당 분자 수, 구획 부피, 질량 수지가 없어 시작량을 기본값·무한 풀로 둔 곳.

| ID | Target | Type | Requirement | 해결 경로 | 상태 | 다루는 개념 |
|---|---|---|---|---|---|---|
| L000001 | D000102 (LPS–TLR4–NF-κB 신호 전달) | Concentration_Gap | 대식세포의 분자별 세포당 분자 수 — 지금 시작량은 기본값 10이라, NF-κB 를 두고 TNF·NFKBIA 프로모터가 경쟁한 결과가 단계 순서에 좌우된다<br>발견: 재사용 시연(NFKBIA 표적 추가): 기본 시작량에서 TNF 유전자 10개가 핵 NF-κB 10개를 다 차지해 NFKBIA 가 전사되지 못함 | ✗ 관찰 copy_number @ D000090 NF-κB–IκBα 복합체 · 대식세포 · 세포질<br>✗ 관찰 copy_number @ D000069 TLR4–MD-2 복합체 · 대식세포 · 세포막<br>✓ 관찰 copy_number @ D000100 TNF 유전자 · 대식세포 · 핵질 | open (1/3) | D000116 구획 농도 모델 |
| L000002 | D000102 (LPS–TLR4–NF-κB 신호 전달) | Concentration_Gap | ATP·뉴클레오타이드 같은 대사물을 무한 풀(1000)로 둠 — 실제 농도와 구획 부피가 있어야 유한 풀이 된다<br>발견: 시뮬레이터에서 뉴클레오타이드 10개가 TNF 전사에 다 쓰여 두 번째 표적이 막힌 문제를 무한 풀로 우회함 | ✗ 관찰 concentration @ D000032 ATP · 대식세포 · 세포질<br>✗ 관찰 compartment_volume @ D000116 구획 농도 모델 · 대식세포 · 세포질<br>✗ 관찰 compartment_volume @ D000116 구획 농도 모델 · 대식세포 · 핵질 | open (0/3) | D000116 구획 농도 모델<br>D000129 대사물 저장소 모델 |
| L000003 | D000102 (LPS–TLR4–NF-κB 신호 전달) | Concentration_Gap | K63·K48 폴리유비퀴틴 사슬을 유비퀴틴 1 단위로 셈 — 질량 수지가 사슬 길이만큼 틀린다<br>발견: 2026-10-08 LPS→NF-κB 스트레스 시험 | ✗ 수동: 사슬 길이(유비퀴틴 개수) 분포 데이터와, 그것을 담을 특징·관찰 어휘 | open (0/1) | D000114 억제자 분해에 의한 전사 인자 방출 |
| L000016 | D000051 (에피네프린에 의한 글리코겐 분해) | Concentration_Gap | 간세포의 분자별 세포당 분자 수 — 시작량이 기본값 10이라 증폭 정도(수용체 하나당 cAMP·인산화효소 수)를 말할 수 없다<br>발견: 2026-10-08 simulate 의 농도 공백 경고 (등록되지 않은 경로) | ✗ 관찰 copy_number @ D000030 β-아드레날린 수용체 · 간세포 · 세포막<br>✗ 관찰 copy_number @ D000042 단백질 키네이스 A · 간세포 · 세포질<br>✗ 관찰 copy_number @ D000044 글리코겐 인산화효소 · 간세포 · 세포질 | open (0/3) | D000116 구획 농도 모델 |
| L000017 | D000102 (LPS–TLR4–NF-κB 신호 전달) | Concentration_Gap | 막(2D) 분자가 낀 반응을 인접 3D 구획 부피의 농도로 환산함 — 면적 농도(분자/µm²)와 막 면적이 없다<br>발견: 2026-10-08 속도 기반 시뮬레이터(simulate --rate)의 AUDIT_RESOLUTION | ✗ 수동: 세포막 면적(세포 유형별)과 면적 농도 모델 — 2D 반응 속도(k_on 단위 µm²/s)를 담을 어휘 | open (0/1) | — |
| L000039 | D000148 (시트르산 회로) | Concentration_Gap | 미토콘드리아 기질 부피와 아세틸-CoA·NAD⁺·옥살로아세트산 농도 — 없으면 소진 시각·완료 바퀴 수가 기본값·가상 시작량에 좌우된다<br>발견: 시트르산 회로 소진 시험(가상 시나리오)의 사후 분석이 제한 요인으로 지목 | ✗ 관찰 compartment_volume @ D000116 구획 농도 모델 · 미토콘드리아 기질<br>✗ 관찰 concentration @ D000134 아세틸-CoA · 미토콘드리아 기질<br>✗ 관찰 concentration @ D000144 NAD⁺ · 미토콘드리아 기질<br>✗ 관찰 concentration @ D000136 옥살로아세트산 · 미토콘드리아 기질 | open (0/4) | — |
| L000047 | D000116 (구획 농도 모델) | Concentration_Gap | 구획별 pH 와 상대 유전율(세포질·미토콘드리아 기질·핵질) — 없으면 Tier 1 환경 보정 ΔG_env 가 0 (기준 환경)으로 계산된다<br>발견: 형식 v8 (3 층 엔진): 필드가 생겨 표현 가능해진 공백 — docs/design/hybrid-multiscale-engine.md §6 | ✗ 관찰 pH @ D000116 구획 농도 모델 · 세포질<br>✗ 관찰 relative_permittivity @ D000116 구획 농도 모델 · 세포질<br>✗ 관찰 pH @ D000116 구획 농도 모델 · 미토콘드리아 기질<br>✗ 관찰 relative_permittivity @ D000116 구획 농도 모델 · 미토콘드리아 기질<br>✗ 관찰 pH @ D000116 구획 농도 모델 · 핵질<br>✗ 관찰 relative_permittivity @ D000116 구획 농도 모델 · 핵질 | open (0/6) | — |

## Structural_Gap — 구조·위상·해상도 공백

3차원 좌표, 잔기 번호, 화학량(구성 비), 막 위상을 모르거나 다른 분자에서 빌려 온 곳.

| ID | Target | Type | Requirement | 해결 경로 | 상태 | 다루는 개념 |
|---|---|---|---|---|---|---|
| L000007 | D000078/site/act (TAK1 · act) | Structural_Gap | TAK1 활성화 고리의 자가 인산화 잔기 번호(사람)<br>발견: 2026-10-08 LPS→NF-κB 스트레스 시험 | ✗ 잔기 번호 @ D000078/site/act<br>✗ 잔기 번호 @ D000081/site/tak1_act | open (0/2) | — |
| L000008 | D000076/site/k63 (TRAF6 · k63) | Structural_Gap | TRAF6 자가 K63 유비퀴틴화 라이신 번호(사람)<br>발견: 2026-10-08 LPS→NF-κB 스트레스 시험 | ✗ 잔기 번호 @ D000076/site/k63<br>✗ 잔기 번호 @ D000075/site/k63_ub | open (0/2) | — |
| L000009 | D000043/site/pka_phos (인산화효소 키네이스 · pka_phos) | Structural_Gap | PKA 가 인산화하는 인산화효소 키네이스 β 소단위 세린의 사람 번호<br>발견: 형식 v4 변환(migration 003) | ✗ 잔기 번호 @ D000043/site/pka_phos | open (0/1) | — |
| L000010 | D000075 (마이도솜) | Structural_Gap | 마이도솜 화학량 MyD88 6 : IRAK4 4 : IRAK1 4 는 IRAK2 를 담은 구조(Lin et al., 2010)에서 빌린 값 — IRAK1 을 담은 구조가 필요하다<br>발견: 2026-10-08 LPS→NF-κB 스트레스 시험 | ✗ PDB ID @ D000075 마이도솜 | open (0/1) | D000110 신호 발판 조립<br>D000118 혼합 해상도 모델 |
| L000011 | D000070/site/tir (LPS–TLR4–MD-2 다량체 · tir) | Structural_Gap | TIR 발판–TIRAP 결합면과 화학량(단위당 1 로 가정)<br>발견: 2026-10-08 LPS→NF-κB 스트레스 시험 | ✗ 수동: TLR4 TIR 도메인–TIRAP 복합체 구조(PDB) — 세포 밖 도메인 구조(3FXI)로는 해결되지 않음 | open (0/1) | D000109 리간드 유도 수용체 다량체화<br>D000118 혼합 해상도 모델 |
| L000012 | D000085 (IKK 복합체) | Structural_Gap | IKK 복합체의 NEMO 화학량(2 로 가정)과 전체 구조<br>발견: 2026-10-08 LPS→NF-κB 스트레스 시험 | ✗ PDB ID @ D000085 IKK 복합체 | open (0/1) | D000118 혼합 해상도 모델 |
| L000013 | D000098 (26S 프로테아좀) | Structural_Gap | 20S·19S 입자의 소단위를 정의항으로 나누지 않음 — 구성 요소가 열거되지 않은 복합체<br>발견: 2026-10-08 LPS→NF-κB 스트레스 시험 | ✗ PDB ID @ D000098 26S 프로테아좀<br>✗ 수동: 20S(α1–7·β1–7 두 벌)·19S 소단위 정의항과 구성 요소 목록 | open (0/2) | D000118 혼합 해상도 모델 |
| L000014 | D000100/site/kb_site (TNF 유전자 · kb_site) | Structural_Gap | Collart et al. 1990 이 보고한 κB 유사 모티프 네 개를 하나로 묶었고 프로모터 위 위치가 없다<br>발견: 2026-10-08 LPS→NF-κB 스트레스 시험 | ✗ 수동: κB 자리별 프로모터 좌표(뉴클레오타이드 위치)와 그것을 담을 핵산 좌표 어휘 | open (0/1) | D000115 핵 이동 후 전사 활성화 |
| L000015 | D000029 (Gs 단백질) | Structural_Gap | 활성화 때 Gαs(GTP)와 Gβγ 가 갈라지는 것을 표현하지 않고 삼량체를 한 단위로 둠<br>발견: 형식 v4 변환(migration 003) | ✗ 수동: Gαs–Gβγ 해리 규칙·단계와 그 구조 근거 | open (0/1) | — |
| L000018 | D000031/site/gs_site (아데닐산 고리화효소 · gs_site) | Structural_Gap | Gs 가 AC 활성화 단계(S000003)에서 행위자로 풀에 남으면서 AC 의 gs_site 리간드로도 세어져 Gαs·Gβ·Gγ 가 두 번 계산된다 — 실제로는 GTP 결합 Gαs 가 AC 에 붙고 Gβγ 가 떨어지며, GTP 가수분해로 Gαs 가 풀려난다<br>발견: 2026-10-08 audit-run 에피네프린 경로 (속도 기반 시뮬레이션의 AUDIT_MASS: Gαs·Gβ·Gγ 10 → 20) | ✗ 수동: Gαs·GTP 가 AC 에 흡수되는 결합 단계(partner)와, GTP 가수분해로 Gαs·GDP 가 풀려나 Gβγ 와 다시 모이는 단계·규칙 — L000015 의 Gs 해리 모델과 함께 | open (0/1) | — |
| L000026 | D000101 (TNF mRNA) | Structural_Gap | TNF mRNA 의 서열 길이(뉴클레오타이드 수, 사람) — 없으면 분해 때 뉴클레오타이드 몇 개가 돌아가는지 몰라 재활용분을 소실로 처리한다<br>발견: TNF mRNA 분해 규칙(recycle_to n: sequence_length)에 관찰이 없음 | ✗ 관찰 sequence_length @ D000101 TNF mRNA | open (0/1) | D000128 생애 주기 모델 |
| L000027 | D000098/rule/ikba_degradation (26S 프로테아좀 · ikba_degradation) | Structural_Gap | 프로테아좀이 기질 하나를 분해할 때 쓰는 ATP 수 — 지금은 1 분자(ATP → ADP + Pi)로 둔 단순화라 ATP 저장소 소비가 실제보다 적다<br>발견: v7 부분 구조 수지 검사가 ATP → ADP 에서 빠진 Pi 를 잡아 규칙을 고치면서 화학량 단순화가 드러남 | ✗ 수동: 26S 프로테아좀의 기질당 ATP 가수분해 화학량을 문헌에서 확인해 with 화학량(단계 n)에 반영 | open (0/1) | — |
| L000040 | D000154/rule/oxidize (석신산 탈수소효소 · oxidize) | Structural_Gap | 석신산 탈수소효소는 내막 복합체 II 이고 FAD 가 공유 결합한 보결분자단이며 전자는 유비퀴논으로 간다 — 지금은 기질의 자유 FAD 저장소로 단순화<br>발견: 시트르산 회로를 넣으면서 | ✗ 수동: 복합체 II 를 소단위·막 위상(내막, 기질 면)·공유 결합 FAD 부위를 가진 복합체로 정의하고 유비퀴논 풀(내막 2D 저장소)을 전자 수용체로 | open (0/1) | — |

## Resource_Gap — 자원(저장소) 공백

재생·공급 경로나 그 속도가 없어 저장소가 고갈되고 경로가 멈추는 곳 — 사후 분석(post-mortem)이 제한 요인으로 지목한 저장소. 공급 규칙의 속도·시작량이 들어오면 닫힌다.

| ID | Target | Type | Requirement | 해결 경로 | 상태 | 다루는 개념 |
|---|---|---|---|---|---|---|
| L000034 | D000159/rule/accoa_supply (아세틸-CoA 공급 · accoa_supply) | Resource_Gap | 아세틸-CoA 공급 속도(피루브산 탈수소효소·β-산화, 세포 유형별) — 없으면 회로는 처음 있던 아세틸-CoA 수만큼만 돌고 아세틸-CoA 고갈로 멈춘다<br>발견: 시트르산 회로 소진 시험(가상 시나리오)의 사후 분석이 제한 요인으로 지목 | ✗ 속도 상수 k @ D000159/rule/accoa_supply | open (0/1) | — |
| L000035 | D000157/rule/nad_regen (NADH 재산화 (전자 전달계) · nad_regen) | Resource_Gap | 전자 전달계의 NADH 재산화 속도 — 없으면 회로 한 바퀴마다 NAD⁺ 3 분자가 NADH 로 쌓이고 NAD⁺ 고갈로 멈춘다 (NAD⁺ 시작량 ÷ 3 바퀴)<br>발견: 시트르산 회로 소진 시험(가상 시나리오)의 사후 분석이 제한 요인으로 지목 | ✗ 속도 상수 k @ D000157/rule/nad_regen | open (0/1) | — |
| L000036 | D000158/rule/fad_regen (FADH₂ 재산화 · fad_regen) | Resource_Gap | FADH₂ 재산화 속도 — 없으면 바퀴마다 FAD 1 분자가 소비되어 FAD 고갈로 석신산 산화가 멈춘다<br>발견: 시트르산 회로 소진 시험(가상 시나리오)의 사후 분석이 제한 요인으로 지목 | ✗ 속도 상수 k @ D000158/rule/fad_regen | open (0/1) | — |
| L000042 | D000123/rule/gdp_regeneration_matrix (뉴클레오사이드 이인산 키네이스 · gdp_regeneration_matrix) | Resource_Gap | 미토콘드리아 기질의 GTP → GDP 재생 속도 (NDPK 기질 쪽 아형 또는 석시닐-CoA 합성효소의 ADP 형 아형 비율) — 없으면 석시닐-CoA 합성효소가 기질 GDP 를 다 써서 회로가 GDP 고갈로 멈춘다 (GDP 시작량 = 최대 바퀴 수)<br>발견: 시트르산 회로 소진 시험 3(가상)의 사후 분석: 기질 GTP 를 GDP 로 되돌리는 경로가 없어 GDP 저장소가 정확히 그 수만큼의 바퀴 뒤 고갈 | ✗ 속도 상수 k @ D000123/rule/gdp_regeneration_matrix | open (0/1) | — |

## Identity_Gap — 정체성(외부 ID) 공백

필수 외부 ID(ChEBI·UniProt …)를 원본과 대조하지 못해 unmapped 에 사유만 둔 곳. 확인된 ID 가 들어오면 닫힌다.

| ID | Target | Type | Requirement | 해결 경로 | 상태 | 다루는 개념 |
|---|---|---|---|---|---|---|
| L000028 | D000027 (에피네프린) | Identity_Gap | 에피네프린의 ChEBI 항목(adrenaline 대 (R)-adrenaline)을 원본에서 골라 번호를 확인 — 지금은 unmapped: ChEBI 에 adrenaline 과 (R)-adrenaline 항목이 따로 있어 어느 것인지·번호를 원본에서 확인해야 함<br>발견: Traceable Evolution Protocol: unmapped 값은 모두 한계로 등록 (detectGaps Identity_Gap) | ✗ ChEBI ID @ D000027 에피네프린 | open (0/1) | — |
| L000029 | D000037 (무기 인산) | Identity_Gap | 무기 인산을 대표할 ChEBI 항목(phosphate 계열)을 정하고 번호를 원본에서 확인 — 지금은 unmapped: Pi 는 pH 에 따라 H2PO4⁻/HPO4²⁻ 가 섞인 표기 — 특정 ChEBI 종을 정하지 않음<br>발견: Traceable Evolution Protocol: unmapped 값은 모두 한계로 등록 (detectGaps Identity_Gap) | ✗ ChEBI ID @ D000037 무기 인산 | open (0/1) | — |
| L000030 | D000048 (포도당-1-인산) | Identity_Gap | 포도당-1-인산의 ChEBI 항목(α-D-포도당 1-인산 등)을 골라 번호를 확인 — 지금은 unmapped: ChEBI 항목(α-D-포도당 1-인산 등) 선택·번호 미확인<br>발견: Traceable Evolution Protocol: unmapped 값은 모두 한계로 등록 (detectGaps Identity_Gap) | ✗ ChEBI ID @ D000048 포도당-1-인산 | open (0/1) | — |
| L000031 | D000062 (피리독살 인산) | Identity_Gap | 피리독살 인산의 ChEBI 번호를 원본에서 확인 — 지금은 unmapped: ChEBI 번호 원본 미확인 (네트워크로 대조할 수 없어 비워 둠)<br>발견: Traceable Evolution Protocol: unmapped 값은 모두 한계로 등록 (detectGaps Identity_Gap) | ✗ ChEBI ID @ D000062 피리독살 인산 | open (0/1) | — |
| L000032 | D000122 (피로인산) | Identity_Gap | 피로인산을 대표할 ChEBI 항목(diphosphate 계열)을 정하고 번호를 원본에서 확인 — 지금은 unmapped: pH 에 따라 이온화 상태가 다른 여러 ChEBI 항목(diphosphate(4−), 등)으로 나뉘어 있고 번호를 원본과 대조하지 못함<br>발견: Traceable Evolution Protocol: unmapped 값은 모두 한계로 등록 (detectGaps Identity_Gap) | ✗ ChEBI ID @ D000122 피로인산 | open (0/1) | — |
| L000033 | D000101 (TNF mRNA) | Identity_Gap | TNF mRNA 전사체 ID — 외부 ID 어휘에 RefSeq(NM_)·Ensembl 전사체 체계가 없어 정체성을 외부 ID 로 고정하지 못함<br>발견: Traceable Evolution Protocol: unmapped 값은 모두 한계로 등록 (detectGaps Identity_Gap) | ✗ 수동: vocab.js xrefs 에 전사체 ID 체계(RefSeq NM_ 또는 Ensembl ENST)를 사람이 검토해 추가한 뒤, 원본에서 확인한 TNF 표준 전사체 ID 를 등록 | open (0/1) | — |
| L000041 | D000148 (시트르산 회로) | Identity_Gap | 시트르산 회로 대사물·보조인자 15종의 ChEBI 번호 — 원본과 대조하지 못해 unmapped<br>발견: 시트르산 회로를 넣으면서 (Identity_Gap) | ✗ ChEBI ID @ D000134 아세틸-CoA<br>✗ ChEBI ID @ D000135 조효소 A<br>✗ ChEBI ID @ D000136 옥살로아세트산<br>✗ ChEBI ID @ D000137 시트르산<br>✗ ChEBI ID @ D000138 아이소시트르산<br>✗ ChEBI ID @ D000139 2-옥소글루타르산<br>✗ ChEBI ID @ D000140 석시닐-CoA<br>✗ ChEBI ID @ D000141 석신산<br>✗ ChEBI ID @ D000142 푸마르산<br>✗ ChEBI ID @ D000143 말산<br>✗ ChEBI ID @ D000160 이산화탄소<br>✗ ChEBI ID @ D000144 NAD⁺<br>✗ ChEBI ID @ D000145 NADH<br>✗ ChEBI ID @ D000146 FAD<br>✗ ChEBI ID @ D000147 FADH₂ | open (0/15) | — |
