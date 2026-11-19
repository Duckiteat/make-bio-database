```
속도 기반 시뮬레이션: D000051 — 60 s, dt 0.001 s, 세포 간세포, 시나리오 'cAMP 경쟁 가상 시나리오 (감사 시험용)' · 저장소 finite
  ⚠ 가상 시나리오 값 — 지식이 아니라 엔진 시험용 (data/db.json 에 저장되지 않음)
단계별 속도 법칙:
  S000001 수용체 활성화: 속도 상수 없음 → 즉시 · 부피 1.00e+4 fL
  S000002 Gs 활성화: 속도 상수 없음 → 즉시
  S000003 아데닐산 고리화효소 활성화: 속도 상수 없음 → 즉시
  S000004 Gs 자체 비활성화: 속도 상수 없음 → 즉시
  S000005 cAMP 합성: 속도 상수 없음 → 즉시 · 부피 4.00e+3 fL
  S000006 PKA 활성화: binding [scenario] k_on=10000000 k_off=1 Kd=1e-9 · 부피 4.00e+3 fL
  S000007 cAMP 분해 (신호 종료): michaelis_menten [scenario] kcat=5 Km=0.000001 · 부피 4.00e+3 fL
  S000008 인산화효소 키네이스 활성화: 속도 상수 없음 → 즉시 · 부피 4.00e+3 fL
  S000009 글리코겐 인산화효소 활성화: 속도 상수 없음 → 즉시 · 부피 4.00e+3 fL
  S000010 글리코겐 가인산분해: 속도 상수 없음 → 즉시 · 부피 4.00e+3 fL
  S000011 포스포릴레이스 비활성화: 속도 상수 없음 → 즉시 · 부피 4.00e+3 fL
공급 규칙 (Metabolic_Supply_Rule):
  ○ D000123/rule/gtp_regeneration 「GTP 재생 (GDP + ATP → GTP + ADP)」 공급: GDP + ATP → GTP + ADP @세포질 — 적용 안 함 (속도 상수·부피 없음)
  ○ D000124/rule/amp_recharge 「AMP 재충전 (AMP + ATP → 2 ADP)」 공급: AMP + ATP → 2 ADP @세포질 — 적용 안 함 (속도 상수·부피 없음)
  ○ D000125/rule/ppi_hydrolysis 「피로인산 가수분해 (PPi → 2 Pi)」 공급: 피로인산 → 2 무기 인산 @세포질 — 적용 안 함 (속도 상수·부피 없음)
  ○ D000126/rule/atp_supply 「ATP 재생 (ADP + Pi → ATP)」 공급: ADP + 무기 인산 → ATP @세포질 — 적용 안 함 (속도 상수·부피 없음)
  ○ D000170/rule/aerobic_glycolysis 「해당과정 (포도당 → 피루브산 2)」 공급: 포도당 + 2 NAD⁺ + 2 ADP + 2 무기 인산 → 2 피루브산 + 2 NADH + 2 ATP @세포질 — 적용 안 함 (속도 상수·부피 없음)
  ○ D000171/rule/pyruvate_reduction 「피루브산 → 젖산 (NAD⁺ 재생)」 공급: 피루브산 + NADH → 젖산 + NAD⁺ @세포질 — 적용 안 함 (속도 상수·부피 없음)
  ○ D000173/rule/atp_hydrolysis_load 「ATP 소비 (ATP → ADP + Pi)」 공급: ATP → ADP + 무기 인산 @세포질 — 적용 안 함 (속도 상수·부피 없음)
처음 1분자 이상이 된 시각:
  t=0.001 s  β-아드레날린 수용체[ligand:결합됨]@세포막
  t=0.001 s  Gs 단백질[nucleotide:GTP 결합]@세포막
  t=0.001 s  GDP@세포질
  t=0.001 s  아데닐산 고리화효소[gs_site:결합됨]@세포막
  t=0.001 s  Gs 단백질[nucleotide:GDP 결합]@세포막
  t=0.001 s  무기 인산@세포질
  t=0.001 s  cAMP@세포질
  t=0.001 s  피로인산@세포질
  t=0.001 s  인산화효소 키네이스[pka_phos:인산화됨]@세포질
  t=0.001 s  ADP@세포질
  t=0.001 s  글리코겐 인산화효소[reg_phos(Ser14):인산화됨]@세포질
  t=0.001 s  포도당-1-인산@세포질
  t=0.001 s  글리코겐@글리코겐 과립
  t=0.001 s  글리코겐 인산화효소@세포질
끝 시점 분자 수 (0 아님, 저장소 제외):
  10.00× 단백질 키네이스 A@세포질
  10.00× 포스포다이에스터레이스@세포질
  10.00× 단백질 인산가수분해효소 1@세포질
  10.00× Gs 단백질[nucleotide:GDP 결합]@세포막
  10.00× 글리코겐 인산화효소@세포질
  10.00× β-아드레날린 수용체[ligand:결합됨]@세포막
  10.00× 아데닐산 고리화효소[gs_site:결합됨]@세포막
  499.38× cAMP@세포질
  0.62× AMP@세포질
  10.00× 인산화효소 키네이스[pka_phos:인산화됨]@세포질
  490.00× 포도당-1-인산@세포질
대사물 저장소 (유한 저장소 (기본) — 소비하면 줄고, 공급 규칙·재활용이 채운다. 바닥나면 단계가 멈춘다(고갈).):
  GTP@세포질: 시작 1000.00 → 끝 0.00 (최소 0.00) · 소비만 — 고갈 위험 · 시작량 기본값(농도 공백) · 고갈 1회
  GDP@세포질: 시작 1000.00 → 끝 2000.00 (최소 1000.00) · 생성만 — 축적 · 시작량 기본값(농도 공백)
  무기 인산@세포질: 시작 1000.00 → 끝 2000.00 (최소 1000.00) · 순환(소비·재생) · 시작량 기본값(농도 공백)
  피로인산@세포질: 시작 1000.00 → 끝 1500.00 (최소 1000.00) · 생성만 — 축적 · 시작량 기본값(농도 공백)
  ATP@세포질: 시작 1000.00 → 끝 0.00 (최소 0.00) · 소비만 — 고갈 위험 · 시작량 기본값(농도 공백) · 고갈 1회
  ADP@세포질: 시작 1000.00 → 끝 1500.00 (최소 1000.00) · 생성만 — 축적 · 시작량 기본값(농도 공백)
  글리코겐@글리코겐 과립: 시작 1000.00 → 끝 1000.00 (최소 1000.00) · 순환(소비·재생) · 시작량 기본값(농도 공백)
  포도당@세포질: 시작 1000.00 → 끝 1000.00 (최소 1000.00) · 쓰이지 않음 · 시작량 기본값(농도 공백)
  NAD⁺@세포질: 시작 1000.00 → 끝 1000.00 (최소 1000.00) · 쓰이지 않음 · 시작량 기본값(농도 공백)
  피루브산@세포질: 시작 1000.00 → 끝 1000.00 (최소 1000.00) · 쓰이지 않음 · 시작량 기본값(농도 공백)
  NADH@세포질: 시작 1000.00 → 끝 1000.00 (최소 1000.00) · 쓰이지 않음 · 시작량 기본값(농도 공백)
  젖산@세포질: 시작 1000.00 → 끝 1000.00 (최소 1000.00) · 쓰이지 않음 · 시작량 기본값(농도 공백)
고갈·재생 사건:
  t=0.05 s 멈춤 S000009 글리코겐 인산화효소 활성화 ← ATP@세포질 부족
  t=0.05 s 고갈 ATP@세포질
  t=0.051 s 멈춤 S000005 cAMP 합성 ← ATP@세포질 부족
  t=0.051 s 멈춤 S000009 글리코겐 인산화효소 활성화 ← ATP@세포질 부족
  t=0.1 s 고갈 GTP@세포질
  t=0.101 s 멈춤 S000002 Gs 활성화 ← GTP@세포질 부족
단계 순환 (회로):
  ⟳ S000002 → S000004 → … : 완료 1000바퀴 (진행량 1000.000)
  ⟳ S000009 → S000011 → … : 완료 490바퀴 (진행량 490.000)
사후 분석 (Post-Mortem) — 정지:
  정지 시각 t=0.05 s (감지 t=1.1 s · 확인 창 1 s · 시간 해상도 Δt 0.001 s) · 원인: 자원 고갈 (저장소 < 1 분자 — 다음 반응을 일으킬 수 없음)
  마지막으로 완료한 바퀴: 1000 번째, t=0.1 s
  제한 요인: ATP@세포질 — 굶은 단계 S000009 글리코겐 인산화효소 활성화 · 켜진 재생 경로 없음
  0 에 닿은 순서 (감시 단계의 입력 중 끝까지 1 분자 미만인 것):
    t=0.05 s ATP@세포질 [저장소]
    t=0.1 s GTP@세포질 [저장소]
  축적된 폐기물·산물 (소비되지 않음):
    +1000.00 GDP@세포질
    +500.00 피로인산@세포질
    +500.00 ADP@세포질
    +490.00 포도당-1-인산@세포질
    +10.00 β-아드레날린 수용체[ligand:결합됨]@세포막
    +10.00 아데닐산 고리화효소[gs_site:결합됨]@세포막
    +10.00 인산화효소 키네이스[pka_phos:인산화됨]@세포질
    +0.62 AMP@세포질
  소비/생산 비 (저장소 순소비 ÷ 순생산): 0.5681 — 소비 GTP@세포질 1000.00, ATP@세포질 1000.00 / 생산 GDP@세포질 1000.00, 무기 인산@세포질 1000.00, 피로인산@세포질 500.00, ADP@세포질 500.00, 포도당-1-인산@세포질 490.00, β-아드레날린 수용체[ligand:결합됨]@세포막 10.00, 아데닐산 고리화효소[gs_site:결합됨]@세포막 10.00, 인산화효소 키네이스[pka_phos:인산화됨]@세포질 10.00, AMP@세포질 0.62, PKA 조절 소단위[cnb_a:결합됨, cnb_b:결합됨]@세포질 0.00, PKA 촉매 소단위@세포질 0.00
감사 (Audit) — 14건:
  [AUDIT_KINETIC · DOMAIN_CONFLICT] S000006 PKA 활성화: Kd 와 k_off/k_on 이 맞지 않음 (Kd 1e-9 M, k_off/k_on 1.000e-7 M)
      → 교정 제안: L000004: Kd (D000100/rule/kb_binding) 를 채울 것 / L000005: kcat·Km (D000049/rule/camp_hydrolysis), Kd (D000042/rule/camp_release) 를 채울 것 / L000006: kcat·Km (D000085/rule/ikba_s32), kcat·Km (D000098/rule/ikba_degradation), k·order (D000089/rule/nuclear_import) 를 채울 것
  [AUDIT_KINETIC · DOMAIN_CONFLICT] S000006 PKA 활성화: binding 법칙은 두 분자 결합(k_on 단위 M⁻¹s⁻¹) — 이 단계의 반응물은 5분자. 협동 결합은 mass_action 에 차수를 적을 것
      → 교정 제안: L000004: Kd (D000100/rule/kb_binding) 를 채울 것 / L000005: kcat·Km (D000049/rule/camp_hydrolysis), Kd (D000042/rule/camp_release) 를 채울 것 / L000006: kcat·Km (D000085/rule/ikba_s32), kcat·Km (D000098/rule/ikba_degradation), k·order (D000089/rule/nuclear_import) 를 채울 것
  [AUDIT_MASS · DOMAIN_CONFLICT] S000003 아데닐산 고리화효소 활성화: t=0.001 s 첫 발화에서 국소 수지 위반 — 한 번 일어날 때마다 Gαs 소단위 +1, Gβ 소단위 +1, Gγ 소단위 +1 (보존되어야 할 실체가 생기거나 사라짐)
      → 교정 제안: L000015 [Structural_Gap] 활성화 때 Gαs(GTP)와 Gβγ 가 갈라지는 것을 표현하지 않고 삼량체를 한 단위로 둠 / L000018 [Structural_Gap] Gs 가 AC 활성화 단계(S000003)에서 행위자로 풀에 남으면서 AC 의 gs_site 리간드로도 세어져 Gαs·Gβ·Gγ 가 두 번 계산된다 — 실제로는 GTP 결합 Gαs 가 AC 에 붙고 Gβγ 가 떨어지며, GTP 가수분해로 Gαs 가 풀려난다
  [AUDIT_MASS · DOMAIN_CONFLICT] D000053: Gαs 소단위: t=0.3 s 기록점까지 처음 어긋남 — 시작 10.000 + 생성 0.000 − 소멸 0.000 = 10.000 ≠ 실제 20.000 — 보존되어야 하는 실체가 원장 밖에서 사라지거나 생김
      → 교정 제안: L000015 [Structural_Gap] 활성화 때 Gαs(GTP)와 Gβγ 가 갈라지는 것을 표현하지 않고 삼량체를 한 단위로 둠 / L000018 [Structural_Gap] Gs 가 AC 활성화 단계(S000003)에서 행위자로 풀에 남으면서 AC 의 gs_site 리간드로도 세어져 Gαs·Gβ·Gγ 가 두 번 계산된다 — 실제로는 GTP 결합 Gαs 가 AC 에 붙고 Gβγ 가 떨어지며, GTP 가수분해로 Gαs 가 풀려난다
  [AUDIT_RESOURCE · DATA_GAP] D000035|cytosol: 저장소 GTP@세포질 는 소비만 되고 재생 경로가 없음 (소비: S000002) — t=0.1 s 에 고갈
      → 교정 제안: L000019: k (D000126/rule/atp_supply) 를 채울 것 / L000020: k (D000123/rule/gtp_regeneration) 를 채울 것 / L000023: k (D000127/rule/nt_supply) 를 채울 것
  [AUDIT_CONCENTRATION · DATA_GAP] D000035|cytosol: 저장소 GTP@세포질 의 시작량이 기본값(1000) — 고갈 시각은 질적 의미만
      → 교정 제안: L000002: concentration 관찰(ATP), compartment_volume 관찰(구획 농도 모델), compartment_volume 관찰(구획 농도 모델) 를 채울 것 / L000103: resAmount 가 정의항 obs(농도 × 부피)를 보도록 하는 결정 — 행정부 코드 변경이므로 사용자 요청이 필요하고, 기존 시나리오의 궤적이 바뀌지 않는지(시나리오 우선) 확인이 조건 를 채울 것 / L000122: 기질의 자유/결합 비율(NADH 형광 수명 측정 등) 출처 — 없으면 총농도로 고정하고 판정 보고에 그 근사를 적음 를 채울 것
  [AUDIT_CONCENTRATION · DATA_GAP] D000037|cytosol: 저장소 무기 인산@세포질 의 시작량이 기본값(1000) — 고갈 시각은 질적 의미만
      → 교정 제안: L000002: concentration 관찰(ATP), compartment_volume 관찰(구획 농도 모델), compartment_volume 관찰(구획 농도 모델) 를 채울 것 / L000103: resAmount 가 정의항 obs(농도 × 부피)를 보도록 하는 결정 — 행정부 코드 변경이므로 사용자 요청이 필요하고, 기존 시나리오의 궤적이 바뀌지 않는지(시나리오 우선) 확인이 조건 를 채울 것 / L000122: 기질의 자유/결합 비율(NADH 형광 수명 측정 등) 출처 — 없으면 총농도로 고정하고 판정 보고에 그 근사를 적음 를 채울 것
  [AUDIT_RESOURCE · DATA_GAP] D000032|cytosol: 저장소 ATP@세포질 는 소비만 되고 재생 경로가 없음 (소비: S000005, S000008, S000009, D000123/rule/gtp_regeneration, D000124/rule/amp_recharge, D000173/rule/atp_hydrolysis_load) — t=0.05 s 에 고갈
      → 교정 제안: L000019: k (D000126/rule/atp_supply) 를 채울 것 / L000020: k (D000123/rule/gtp_regeneration) 를 채울 것 / L000023: k (D000127/rule/nt_supply) 를 채울 것
  [AUDIT_CONCENTRATION · DATA_GAP] D000032|cytosol: 저장소 ATP@세포질 의 시작량이 기본값(1000) — 고갈 시각은 질적 의미만
      → 교정 제안: L000002: concentration 관찰(ATP), compartment_volume 관찰(구획 농도 모델), compartment_volume 관찰(구획 농도 모델) 를 채울 것 / L000103: resAmount 가 정의항 obs(농도 × 부피)를 보도록 하는 결정 — 행정부 코드 변경이므로 사용자 요청이 필요하고, 기존 시나리오의 궤적이 바뀌지 않는지(시나리오 우선) 확인이 조건 를 채울 것 / L000122: 기질의 자유/결합 비율(NADH 형광 수명 측정 등) 출처 — 없으면 총농도로 고정하고 판정 보고에 그 근사를 적음 를 채울 것
  [AUDIT_CONCENTRATION · DATA_GAP] D000047|glycogen_granule: 저장소 글리코겐@글리코겐 과립 의 시작량이 기본값(1000) — 고갈 시각은 질적 의미만
      → 교정 제안: L000002: concentration 관찰(ATP), compartment_volume 관찰(구획 농도 모델), compartment_volume 관찰(구획 농도 모델) 를 채울 것 / L000103: resAmount 가 정의항 obs(농도 × 부피)를 보도록 하는 결정 — 행정부 코드 변경이므로 사용자 요청이 필요하고, 기존 시나리오의 궤적이 바뀌지 않는지(시나리오 우선) 확인이 조건 를 채울 것 / L000122: 기질의 자유/결합 비율(NADH 형광 수명 측정 등) 출처 — 없으면 총농도로 고정하고 판정 보고에 그 근사를 적음 를 채울 것
  [AUDIT_RESOURCE · FINDING] D000051: 사후 분석: t=0.05 s 에 정지 (자원 고갈) — 제한 요인 ATP@세포질 (굶은 단계 S000009) · 완료한 회로 1000/490바퀴
      → 교정 제안: L000034: k (D000159/rule/accoa_supply) 를 채울 것 / L000035: k (D000157/rule/nad_regen) 를 채울 것 / L000036: k (D000158/rule/fad_regen) 를 채울 것
  [AUDIT_KINETIC_GAP · DATA_GAP] D000051: 속도 상수가 없는 단계 9개를 즉시(사건 기반)로 처리함: S000001, S000002, S000003, S000004, S000005, S000008, S000009, S000010, S000011
      → 교정 제안: L000004: Kd (D000100/rule/kb_binding) 를 채울 것 / L000005: kcat·Km (D000049/rule/camp_hydrolysis), Kd (D000042/rule/camp_release) 를 채울 것 / L000006: kcat·Km (D000085/rule/ikba_s32), kcat·Km (D000098/rule/ikba_degradation), k·order (D000089/rule/nuclear_import) 를 채울 것
  [AUDIT_KINETIC_GAP · DATA_GAP] D000051: 속도 상수가 없는 공급·분해 규칙 7개는 적용하지 않음: D000123/rule/gtp_regeneration, D000124/rule/amp_recharge, D000125/rule/ppi_hydrolysis, D000126/rule/atp_supply, D000170/rule/aerobic_glycolysis, D000171/rule/pyruvate_reduction, D000173/rule/atp_hydrolysis_load
      → 교정 제안: L000020: k (D000123/rule/gtp_regeneration) 를 채울 것 / L000021: k (D000124/rule/amp_recharge) 를 채울 것 / L000022: k (D000125/rule/ppi_hydrolysis) 를 채울 것 / L000019: k (D000126/rule/atp_supply) 를 채울 것 / L000063: k (D000170/rule/aerobic_glycolysis), k (D000171/rule/pyruvate_reduction), k (D000172/rule/palmitoyl_oxidation), k (D000173/rule/atp_hydrolysis_load), k (D000168/rule/export), k (D000148/rule/lumped_oxidation) 를 채울 것 / L000004: Kd (D000100/rule/kb_binding) 를 채울 것 / L000005: kcat·Km (D000049/rule/camp_hydrolysis), Kd (D000042/rule/camp_release) 를 채울 것 / L000006: kcat·Km (D000085/rule/ikba_s32), kcat·Km (D000098/rule/ikba_degradation), k·order (D000089/rule/nuclear_import) 를 채울 것
  [AUDIT_RESOLUTION · DATA_GAP] D000051: 막(2D) 분자가 낀 단계 5개는 인접 3D 부피의 농도로 환산함 (면적 농도 아님): S000001, S000002, S000003, S000004, S000005
      → 교정 제안: L000017: 세포막 면적(세포 유형별)과 면적 농도 모델 — 2D 반응 속도(k_on 단위 µm²/s)를 담을 어휘 를 채울 것
정제 점검 (Continuous Refinement):
  ○ [lumped_contradiction] D000148/rule/lumped_oxidation (순 반응) ↔ 시트르산 회로 단계 8개의 화학량 합: GTP 단계 +1 / 규칙 0, GDP 단계 -1 / 규칙 0, 무기 인산 단계 -1 / 규칙 0 — 알려진 단순화 (L000061)
```
