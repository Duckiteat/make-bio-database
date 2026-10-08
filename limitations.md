# 한계 등록부 (Limitation & Constraint Registry)

> 이 파일은 `data/db.json` 의 `limitations` 에서 생성된다 — 직접 고치지 말고 패치(`limitations: [...]`)로 등록한 뒤 `node dbtool.mjs limitations --write`.
> 새 개념(정의항)을 설계하기 전에 반드시 이 파일을 읽고, 그 개념이 어떤 한계를 어떻게 해결하는지 정의항의 `addresses` 에 적는다.
> 상태는 계산된다: 해결 경로(needs)의 데이터가 모두 들어오면 resolved. ✓ = 이미 채워진 데이터, ✗ = 아직 없는 데이터.

| 종류 | 열림 | 해결 | 합계 |
|---|---|---|---|
| Kinetic_Gap | 3 | 0 | 3 |
| Concentration_Gap | 4 | 0 | 4 |
| Structural_Gap | 9 | 0 | 9 |

## Kinetic_Gap — 속도·친화도·시간 상수 공백

반응 속도(kcat·Km), 결합 친화도(Kd), 반감기 같은 시간 정보가 없어 경쟁·지속·종료를 정할 수 없는 곳.

| ID | Target | Type | Requirement | 해결 경로 | 상태 | 다루는 개념 |
|---|---|---|---|---|---|---|
| L000004 | D000100/rule/kb_binding (TNF 유전자 · kb_binding) | Kinetic_Gap | NF-κB 가 여러 프로모터의 κB 자리를 두고 경쟁하는데 결합 친화도가 없어 누가 먼저 차지하는지 단계 순서로 정해진다<br>발견: 재사용 시연(NFKBIA 표적 추가) | ✗ 관찰 Kd @ D000100 TNF 유전자 | open (0/1) | D000107 막–핵 신호 연쇄<br>D000115 핵 이동 후 전사 활성화 |
| L000005 | D000049/rule/camp_hydrolysis (포스포다이에스터레이스 · camp_hydrolysis) | Kinetic_Gap | cAMP 를 PKA 활성화와 PDE 분해가 나눠 갖는 비율 — 이산 시뮬레이션은 촉매 수로만 정한다<br>발견: 첫 시뮬레이션: 한 라운드 1회 발화에서 PDE 가 cAMP 를 먼저 다 분해해 PKA 가 켜지지 않음 → 촉매 수만큼 발화로 우회 | ✗ 관찰 Km @ D000049 포스포다이에스터레이스<br>✗ 관찰 kcat @ D000049 포스포다이에스터레이스<br>✗ 관찰 Kd @ D000056 PKA 조절 소단위 | open (0/3) | D000112 2차 전령 증폭 |
| L000006 | D000102 (LPS–TLR4–NF-κB 신호 전달) | Kinetic_Gap | 단계에 시간이 없다 — 신호의 지속·종료(IκBα 재합성, 탈인산화)와 진동을 다룰 수 없다<br>발견: 2026-10-08 LPS→NF-κB 스트레스 시험 | ✗ 관찰 half_life @ D000086 IκBα<br>✗ 관찰 kcat @ D000085 IKK 복합체 | open (0/2) | D000106 수용체 매개 신호 연쇄<br>D000111 키네이스 연쇄<br>D000113 GTPase 타이머 |

## Concentration_Gap — 농도·부피·질량 수지 공백

몰 농도, 세포당 분자 수, 구획 부피, 질량 수지가 없어 시작량을 기본값·무한 풀로 둔 곳.

| ID | Target | Type | Requirement | 해결 경로 | 상태 | 다루는 개념 |
|---|---|---|---|---|---|---|
| L000001 | D000102 (LPS–TLR4–NF-κB 신호 전달) | Concentration_Gap | 대식세포의 분자별 세포당 분자 수 — 지금 시작량은 기본값 10이라, NF-κB 를 두고 TNF·NFKBIA 프로모터가 경쟁한 결과가 단계 순서에 좌우된다<br>발견: 재사용 시연(NFKBIA 표적 추가): 기본 시작량에서 TNF 유전자 10개가 핵 NF-κB 10개를 다 차지해 NFKBIA 가 전사되지 못함 | ✗ 관찰 copy_number @ D000090 NF-κB–IκBα 복합체 · 대식세포 · 세포질<br>✗ 관찰 copy_number @ D000069 TLR4–MD-2 복합체 · 대식세포 · 세포막<br>✓ 관찰 copy_number @ D000100 TNF 유전자 · 대식세포 · 핵질 | open (1/3) | D000116 구획 농도 모델 |
| L000002 | D000102 (LPS–TLR4–NF-κB 신호 전달) | Concentration_Gap | ATP·뉴클레오타이드 같은 대사물을 무한 풀(1000)로 둠 — 실제 농도와 구획 부피가 있어야 유한 풀이 된다<br>발견: 시뮬레이터에서 뉴클레오타이드 10개가 TNF 전사에 다 쓰여 두 번째 표적이 막힌 문제를 무한 풀로 우회함 | ✗ 관찰 concentration @ D000032 ATP · 대식세포 · 세포질<br>✗ 관찰 compartment_volume @ D000116 구획 농도 모델 · 대식세포 · 세포질<br>✗ 관찰 compartment_volume @ D000116 구획 농도 모델 · 대식세포 · 핵질 | open (0/3) | D000116 구획 농도 모델 |
| L000003 | D000102 (LPS–TLR4–NF-κB 신호 전달) | Concentration_Gap | K63·K48 폴리유비퀴틴 사슬을 유비퀴틴 1 단위로 셈 — 질량 수지가 사슬 길이만큼 틀린다<br>발견: 2026-10-08 LPS→NF-κB 스트레스 시험 | ✗ 수동: 사슬 길이(유비퀴틴 개수) 분포 데이터와, 그것을 담을 특징·관찰 어휘 | open (0/1) | D000114 억제자 분해에 의한 전사 인자 방출 |
| L000016 | D000051 (에피네프린에 의한 글리코겐 분해) | Concentration_Gap | 간세포의 분자별 세포당 분자 수 — 시작량이 기본값 10이라 증폭 정도(수용체 하나당 cAMP·인산화효소 수)를 말할 수 없다<br>발견: 2026-10-08 simulate 의 농도 공백 경고 (등록되지 않은 경로) | ✗ 관찰 copy_number @ D000030 β-아드레날린 수용체 · 간세포 · 세포막<br>✗ 관찰 copy_number @ D000042 단백질 키네이스 A · 간세포 · 세포질<br>✗ 관찰 copy_number @ D000044 글리코겐 인산화효소 · 간세포 · 세포질 | open (0/3) | D000116 구획 농도 모델 |

## Structural_Gap — 구조·위상·해상도 공백

3차원 좌표, 잔기 번호, 화학량(구성 비), 막 위상을 모르거나 다른 분자에서 빌려 온 곳.

| ID | Target | Type | Requirement | 해결 경로 | 상태 | 다루는 개념 |
|---|---|---|---|---|---|---|
| L000007 | D000078/site/act (TAK1 · act) | Structural_Gap | TAK1 활성화 고리의 자가 인산화 잔기 번호(사람)<br>발견: 2026-10-08 LPS→NF-κB 스트레스 시험 | ✗ 잔기 번호 @ D000078/site/act<br>✗ 잔기 번호 @ D000081/site/tak1_act | open (0/2) | — |
| L000008 | D000076/site/k63 (TRAF6 · k63) | Structural_Gap | TRAF6 자가 K63 유비퀴틴화 라이신 번호(사람)<br>발견: 2026-10-08 LPS→NF-κB 스트레스 시험 | ✗ 잔기 번호 @ D000076/site/k63<br>✗ 잔기 번호 @ D000075/site/k63_ub | open (0/2) | — |
| L000009 | D000043/site/pka_phos (인산화효소 키네이스 · pka_phos) | Structural_Gap | PKA 가 인산화하는 인산화효소 키네이스 β 소단위 세린의 사람 번호<br>발견: 형식 v4 변환(migration 003) | ✗ 잔기 번호 @ D000043/site/pka_phos | open (0/1) | — |
| L000010 | D000075 (마이도솜) | Structural_Gap | 마이도솜 화학량 MyD88 6 : IRAK4 4 : IRAK1 4 는 IRAK2 를 담은 구조(Lin et al., 2010)에서 빌린 값 — IRAK1 을 담은 구조가 필요하다<br>발견: 2026-10-08 LPS→NF-κB 스트레스 시험 | ✗ PDB ID @ D000075 마이도솜 | open (0/1) | D000110 신호 발판 조립 |
| L000011 | D000070/site/tir (LPS–TLR4–MD-2 다량체 · tir) | Structural_Gap | TIR 발판–TIRAP 결합면과 화학량(단위당 1 로 가정)<br>발견: 2026-10-08 LPS→NF-κB 스트레스 시험 | ✗ PDB ID @ D000070 LPS–TLR4–MD-2 다량체 | open (0/1) | D000109 리간드 유도 수용체 다량체화 |
| L000012 | D000085 (IKK 복합체) | Structural_Gap | IKK 복합체의 NEMO 화학량(2 로 가정)과 전체 구조<br>발견: 2026-10-08 LPS→NF-κB 스트레스 시험 | ✗ PDB ID @ D000085 IKK 복합체 | open (0/1) | — |
| L000013 | D000098 (26S 프로테아좀) | Structural_Gap | 20S·19S 입자의 소단위를 정의항으로 나누지 않음 — 구성 요소가 열거되지 않은 복합체<br>발견: 2026-10-08 LPS→NF-κB 스트레스 시험 | ✗ PDB ID @ D000098 26S 프로테아좀<br>✗ 수동: 20S(α1–7·β1–7 두 벌)·19S 소단위 정의항과 구성 요소 목록 | open (0/2) | — |
| L000014 | D000100/site/kb_site (TNF 유전자 · kb_site) | Structural_Gap | Collart et al. 1990 이 보고한 κB 유사 모티프 네 개를 하나로 묶었고 프로모터 위 위치가 없다<br>발견: 2026-10-08 LPS→NF-κB 스트레스 시험 | ✗ 수동: κB 자리별 프로모터 좌표(뉴클레오타이드 위치)와 그것을 담을 핵산 좌표 어휘 | open (0/1) | D000115 핵 이동 후 전사 활성화 |
| L000015 | D000029 (Gs 단백질) | Structural_Gap | 활성화 때 Gαs(GTP)와 Gβγ 가 갈라지는 것을 표현하지 않고 삼량체를 한 단위로 둠<br>발견: 형식 v4 변환(migration 003) | ✗ 수동: Gαs–Gβγ 해리 규칙·단계와 그 구조 근거 | open (0/1) | — |
