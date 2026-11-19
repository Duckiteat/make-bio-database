```
속도 기반 시뮬레이션: D000102 — 60 s, dt 0.001 s, 세포 대식세포, 시나리오 'LPS 가상 시나리오 (엔진 시험용)' · 저장소 finite
  ⚠ 가상 시나리오 값 — 지식이 아니라 엔진 시험용 (data/db.json 에 저장되지 않음)
단계별 속도 법칙:
  S000012 LBP 의 LPS 결합: binding [scenario] k_on=1000000 k_off=0.001 · 부피 1.00e+4 fL
  S000013 LPS 를 CD14 로 전달: 속도 상수 없음 → 즉시 · 부피 1.00e+4 fL
  S000014 LPS 를 TLR4–MD-2 로 전달: 속도 상수 없음 → 즉시
  S000015 TLR4–MD-2 다량체화: 속도 상수 없음 → 즉시
  S000016 TIRAP 모집: 속도 상수 없음 → 즉시
  S000017 마이도솜 조립: 속도 상수 없음 → 즉시 · 부피 1.00e+3 fL
  S000018 IRAK1 인산화: 속도 상수 없음 → 즉시 · 부피 1.00e+3 fL
  S000019 TRAF6 모집: 속도 상수 없음 → 즉시 · 부피 1.00e+3 fL
  S000020 TRAF6 K63 자가 유비퀴틴화: 속도 상수 없음 → 즉시 · 부피 1.00e+3 fL
  S000021 TAK1 활성화: 속도 상수 없음 → 즉시 · 부피 1.00e+3 fL
  S000022 IKKβ Ser177 인산화: 속도 상수 없음 → 즉시 · 부피 1.00e+3 fL
  S000023 IKKβ Ser181 인산화: 속도 상수 없음 → 즉시 · 부피 1.00e+3 fL
  S000024 IκBα Ser32 인산화: michaelis_menten [scenario] kcat=1 Km=1e-7 · 부피 1.00e+3 fL
  S000025 IκBα Ser36 인산화: michaelis_menten [scenario] kcat=1 Km=1e-7 · 부피 1.00e+3 fL
  S000026 IκBα K48 유비퀴틴화: 속도 상수 없음 → 즉시 · 부피 1.00e+3 fL
  S000027 IκBα 분해: michaelis_menten [scenario] kcat=0.5 Km=1e-7 · 부피 1.00e+3 fL
  S000028 NF-κB 핵 이동: mass_action [scenario] k=0.05 order=1 · 부피 1.00e+3 fL
  S000029 NF-κB 의 κB 자리 결합: binding [scenario] k_on=10000000 k_off=0.01 · 부피 300 fL
  S000030 TNF 전사: 속도 상수 없음 → 즉시 · 부피 300 fL
공급 규칙 (Metabolic_Supply_Rule):
  ○ D000123/rule/gtp_regeneration 「GTP 재생 (GDP + ATP → GTP + ADP)」 공급: GDP + ATP → GTP + ADP @세포질 — 적용 안 함 (속도 상수·부피 없음)
  ● D000124/rule/amp_recharge 「AMP 재충전 (AMP + ATP → 2 ADP)」 공급: AMP + ATP → 2 ADP @세포질 · mass_action [scenario] k=1000 order=2
  ● D000125/rule/ppi_hydrolysis 「피로인산 가수분해 (PPi → 2 Pi)」 공급: 피로인산 → 2 무기 인산 @세포질 · mass_action [scenario] k=10 order=1
  ● D000126/rule/atp_supply 「ATP 재생 (ADP + Pi → ATP)」 공급: ADP + 무기 인산 → ATP @세포질 · mass_action [scenario] k=1000 order=2
  ● D000127/rule/nt_supply 「핵질 뉴클레오타이드 공급 (계 밖)」 공급(계 밖): ∅ → 뉴클레오타이드 @핵질 · zero_order [scenario] k=1e-9
  ○ D000170/rule/aerobic_glycolysis 「해당과정 (포도당 → 피루브산 2)」 공급: 포도당 + 2 NAD⁺ + 2 ADP + 2 무기 인산 → 2 피루브산 + 2 NADH + 2 ATP @세포질 — 적용 안 함 (속도 상수·부피 없음)
  ○ D000171/rule/pyruvate_reduction 「피루브산 → 젖산 (NAD⁺ 재생)」 공급: 피루브산 + NADH → 젖산 + NAD⁺ @세포질 — 적용 안 함 (속도 상수·부피 없음)
  ○ D000173/rule/atp_hydrolysis_load 「ATP 소비 (ATP → ADP + Pi)」 공급: ATP → ADP + 무기 인산 @세포질 — 적용 안 함 (속도 상수·부피 없음)
  ○ D000205/rule/division_attrition 「분열 1회 — 텔로미어 반복 단위 소모 (말단 복제 문제)」 공급: 16 텔로미어 반복 단위 → 192 뉴클레오타이드 @핵질 — 적용 안 함 (속도 상수·부피 없음)
  ○ D000206/rule/elongation 「텔로미어 연장 (텔로머레이스)」 공급: 12 뉴클레오타이드 → 텔로미어 반복 단위 @핵질 — 적용 안 함 (속도 상수·부피 없음)
분해 규칙 (Degradation_Rule):
  ● TNF mRNA@핵질 ← D000101/rule/turnover 재활용 (구성 단위가 대사물 저장소로 돌아감 — recycle_to) k_deg=3.851e-4 s⁻¹ [scenario]
처음 1분자 이상이 된 시각:
  t=0.001 s  LPS 결합 단백질@세포 밖
  t=0.001 s  CD14@세포막
  t=0.001 s  마이도솜@세포질
  t=0.001 s  마이도솜[irak1_t209(Thr209):인산화됨]@세포질
  t=0.001 s  ADP@세포질
  t=0.001 s  마이도솜[irak1_t209(Thr209):인산화됨, traf6:결합됨]@세포질
  t=0.001 s  마이도솜[irak1_t209(Thr209):인산화됨, k63_ub:K63 폴리유비퀴틴화됨 (신호 발판), traf6:결합됨]@세포질
  t=0.001 s  AMP@세포질
  t=0.001 s  피로인산@세포질
  t=0.001 s  TAK1 복합체[tak1_act:인산화됨]@세포질
  t=0.001 s  IKK 복합체[ikkb_s177(Ser177):인산화됨]@세포질
  t=0.001 s  IKK 복합체[ikkb_s177(Ser177):인산화됨, ikkb_s181(Ser181):인산화됨]@세포질
  t=0.001 s  NF-κB–IκBα 복합체[ikba_s32(Ser32):인산화됨]@세포질
  t=0.001 s  유비퀴틴@세포질
  t=0.001 s  무기 인산@세포질
  t=0.003 s  LPS–TLR4–MD-2 다량체[lps_pocket:결합됨, tir:결합됨]@세포막
  t=0.009 s  NF-κB–IκBα 복합체[ikba_s32(Ser32):인산화됨, ikba_s36(Ser36):인산화됨, ikba_ub(Lys21):K48 폴리유비퀴틴화됨 (분해 표지)]@세포질
  t=0.041 s  NF-κB–IκBα 복합체[ikba_s32(Ser32):인산화됨, ikba_s36(Ser36):인산화됨]@세포질
  t=0.066 s  NF-κB p50–p65 이량체@세포질
  t=0.066 s  펩타이드@세포질
  t=0.408 s  NF-κB p50–p65 이량체@핵질
  t=1.476 s  TNF mRNA@핵질
  t=6.288 s  TNF 유전자[kb_site:결합됨]@핵질
  t=10.981 s  CD14[lps_site:결합됨]@세포막
끝 시점 분자 수 (0 아님, 저장소 제외):
  22153.88× 지질다당류@세포 밖
  10000.00× TRAF6@세포질
  20000.00× SCF–βTrCP 유비퀴틴 연결효소@세포질
  100000.00× 26S 프로테아좀@세포질
  0.00× TNF 유전자@핵질
  100000.00× LPS 결합 단백질@세포 밖
  22153.88× CD14@세포막
  27846.12× CD14[lps_site:결합됨]@세포막
  5000.00× LPS–TLR4–MD-2 다량체[lps_pocket:결합됨, tir:결합됨]@세포막
  10000.00× 마이도솜[irak1_t209(Thr209):인산화됨, k63_ub:K63 폴리유비퀴틴화됨 (신호 발판), traf6:결합됨]@세포질
  20000.00× TAK1 복합체[tak1_act:인산화됨]@세포질
  50000.00× IKK 복합체[ikkb_s177(Ser177):인산화됨, ikkb_s181(Ser181):인산화됨]@세포질
  6582.90× NF-κB p50–p65 이량체@세포질
  100000.00× 펩타이드@세포질
  93415.11× NF-κB p50–p65 이량체@핵질
  2.00× TNF 유전자[kb_site:결합됨]@핵질
  105922.10× TNF mRNA@핵질
대사물 저장소 (유한 저장소 (기본) — 소비하면 줄고, 공급 규칙·재활용이 채운다. 바닥나면 단계가 멈춘다(고갈).):
  ATP@세포질: 시작 1.000e+8 → 끝 1.110e+8 (최소 9.986e+7) · 순환(소비·재생)
  ADP@세포질: 시작 1.000e+7 → 끝 3196.59 (최소 3196.59) · 순환(소비·재생)
  AMP@세포질: 시작 1.000e+6 → 끝 22.21 (최소 22.21) · 순환(소비·재생)
  피로인산@세포질: 시작 0.00 → 끝 0.00 (최소 0.00) · 순환(소비·재생) · 고갈 1회
  유비퀴틴@세포질: 시작 1.000e+6 → 끝 9.900e+5 (최소 9.660e+5) · 순환(소비·재생)
  무기 인산@세포질: 시작 1.000e+8 → 끝 8.767e+7 (최소 8.767e+7) · 순환(소비·재생)
  뉴클레오타이드@핵질: 시작 1.000e+5 → 끝 1.848e+6 (최소 1.000e+5) · 순환(소비·재생)
  GDP@세포질: 시작 1000.00 → 끝 1000.00 (최소 1000.00) · 쓰이지 않음 · 시작량 기본값(농도 공백)
  GTP@세포질: 시작 1000.00 → 끝 1000.00 (최소 1000.00) · 쓰이지 않음 · 시작량 기본값(농도 공백)
  포도당@세포질: 시작 1000.00 → 끝 1000.00 (최소 1000.00) · 쓰이지 않음 · 시작량 기본값(농도 공백)
  NAD⁺@세포질: 시작 1000.00 → 끝 1000.00 (최소 1000.00) · 쓰이지 않음 · 시작량 기본값(농도 공백)
  피루브산@세포질: 시작 1000.00 → 끝 1000.00 (최소 1000.00) · 쓰이지 않음 · 시작량 기본값(농도 공백)
  NADH@세포질: 시작 1000.00 → 끝 1000.00 (최소 1000.00) · 쓰이지 않음 · 시작량 기본값(농도 공백)
  젖산@세포질: 시작 1000.00 → 끝 1000.00 (최소 1000.00) · 쓰이지 않음 · 시작량 기본값(농도 공백)
  텔로미어 반복 단위@핵질: 시작 1000.00 → 끝 1000.00 (최소 1000.00) · 쓰이지 않음 · 시작량 기본값(농도 공백)
자원 순환 (저장소 분자 사이의 닫힌 소비·생성 고리 — 강하게 연결된 성분):
  ⟲ ATP@세포질 · ADP@세포질 · AMP@세포질 · 피로인산@세포질 · 무기 인산@세포질 · 유비퀴틴@세포질
고갈·재생 사건:
  t=16.103 s 고갈 피로인산@세포질
변화량 원장 Δ (반응 · 공급 · 분해 · 재활용):
  ATP@세포질: -5.400e+5 · 1.154e+7 · 0.00 · 0.00
  ADP@세포질: 4.300e+5 · -1.043e+7 · 0.00 · 0.00
  AMP@세포질: 1.100e+5 · -1.110e+6 · 0.00 · 0.00
  피로인산@세포질: 1.100e+5 · -1.100e+5 · 0.00 · 0.00
  무기 인산@세포질: 100000.00 · -1.243e+7 · 0.00 · 0.00
  뉴클레오타이드@핵질: -1.070e+5 · 10839.85 · 0.00 · 1.844e+6
  TNF mRNA@핵질: 1.070e+5 · 0.00 · -1099.15 · 0.00
단계 순환 (회로):
  ⟳ S000012 → S000013 → S000014 → … : 완료 10000바퀴 (진행량 10000.000)
사후 분석 (Post-Mortem) — 정지:
  정지 시각 t=10.98 s (감지 t=11.979 s · 확인 창 1 s · 시간 해상도 Δt 0.001 s) · 원인: 중간물 고갈
  마지막으로 완료한 바퀴: 10000 번째, t=10.98 s
  제한 요인: TLR4–MD-2 복합체@세포막 — 굶은 단계 S000014 LPS 를 TLR4–MD-2 로 전달
  0 에 닿은 순서 (감시 단계의 입력 중 끝까지 1 분자 미만인 것):
    t=10.979 s TLR4–MD-2 복합체@세포막
  축적된 폐기물·산물 (소비되지 않음):
    +1.059e+5 TNF mRNA@핵질
    +100000.00 펩타이드@세포질
    +50000.00 IKK 복합체[ikkb_s177(Ser177):인산화됨, ikkb_s181(Ser181):인산화됨]@세포질
    +20000.00 TAK1 복합체[tak1_act:인산화됨]@세포질
    +10000.00 마이도솜[irak1_t209(Thr209):인산화됨, k63_ub:K63 폴리유비퀴틴화됨 (신호 발판), traf6:결합됨]@세포질
    +5000.00 LPS–TLR4–MD-2 다량체[lps_pocket:결합됨, tir:결합됨]@세포막
    +2.00 TNF 유전자[kb_site:결합됨]@핵질
  소비/생산 비 (저장소 순소비 ÷ 순생산): 1.7899 — 소비 ADP@세포질 9.997e+6, 유비퀴틴@세포질 10000.00, AMP@세포질 1.000e+6, 무기 인산@세포질 1.233e+7 / 생산 ATP@세포질 1.100e+7, 뉴클레오타이드@핵질 1.748e+6, TNF mRNA@핵질 1.059e+5, 펩타이드@세포질 100000.00, IKK 복합체[ikkb_s177(Ser177):인산화됨, ikkb_s181(Ser181):인산화됨]@세포질 50000.00, TAK1 복합체[tak1_act:인산화됨]@세포질 20000.00, 마이도솜[irak1_t209(Thr209):인산화됨, k63_ub:K63 폴리유비퀴틴화됨 (신호 발판), traf6:결합됨]@세포질 10000.00, LPS–TLR4–MD-2 다량체[lps_pocket:결합됨, tir:결합됨]@세포막 5000.00, TNF 유전자[kb_site:결합됨]@핵질 2.00
감사 (Audit) — 4건:
  [AUDIT_RESOURCE · FINDING] D000102: 사후 분석: t=10.98 s 에 정지 (중간물 고갈) — 제한 요인 TLR4–MD-2 복합체@세포막 (굶은 단계 S000014) · 완료한 회로 10000바퀴
      → 교정 제안: L000004: Kd (D000100/rule/kb_binding) 를 채울 것 / L000005: kcat·Km (D000049/rule/camp_hydrolysis), Kd (D000042/rule/camp_release) 를 채울 것 / L000006: kcat·Km (D000085/rule/ikba_s32), kcat·Km (D000098/rule/ikba_degradation), k·order (D000089/rule/nuclear_import) 를 채울 것
  [AUDIT_KINETIC_GAP · DATA_GAP] D000102: 속도 상수가 없는 단계 13개를 즉시(사건 기반)로 처리함: S000013, S000014, S000015, S000016, S000017, S000018, S000019, S000020, S000021, S000022, S000023, S000026, S000030
      → 교정 제안: L000006: kcat·Km (D000085/rule/ikba_s32), kcat·Km (D000098/rule/ikba_degradation), k·order (D000089/rule/nuclear_import) 를 채울 것
  [AUDIT_KINETIC_GAP · DATA_GAP] D000102: 속도 상수가 없는 공급·분해 규칙 6개는 적용하지 않음: D000123/rule/gtp_regeneration, D000170/rule/aerobic_glycolysis, D000171/rule/pyruvate_reduction, D000173/rule/atp_hydrolysis_load, D000205/rule/division_attrition, D000206/rule/elongation
      → 교정 제안: L000020: k (D000123/rule/gtp_regeneration) 를 채울 것 / L000063: k (D000170/rule/aerobic_glycolysis), k (D000171/rule/pyruvate_reduction), k (D000172/rule/palmitoyl_oxidation), k (D000173/rule/atp_hydrolysis_load), k (D000168/rule/export), k (D000148/rule/lumped_oxidation) 를 채울 것 / L000004: Kd (D000100/rule/kb_binding) 를 채울 것 / L000005: kcat·Km (D000049/rule/camp_hydrolysis), Kd (D000042/rule/camp_release) 를 채울 것 / L000006: kcat·Km (D000085/rule/ikba_s32), kcat·Km (D000098/rule/ikba_degradation), k·order (D000089/rule/nuclear_import) 를 채울 것 / L000087: k (D000205/rule/division_attrition), 분열당 소실 염기쌍(ΔL)의 직접 측정값과, 그것을 화학량으로 담을 측정량(관찰 종류) — 지금 observables 에는 화학량을 재는 종류가 없다 를 채울 것 / L000095: k (D000206/rule/elongation) 를 채울 것
  [AUDIT_RESOLUTION · DATA_GAP] D000102: 막(2D) 분자가 낀 단계 5개는 인접 3D 부피의 농도로 환산함 (면적 농도 아님): S000013, S000014, S000015, S000016, S000017
      → 교정 제안: L000017: 세포막 면적(세포 유형별)과 면적 농도 모델 — 2D 반응 속도(k_on 단위 µm²/s)를 담을 어휘 를 채울 것
정제 점검 (Continuous Refinement):
  ○ [lumped_contradiction] D000148/rule/lumped_oxidation (순 반응) ↔ 시트르산 회로 단계 8개의 화학량 합: GTP 단계 +1 / 규칙 0, GDP 단계 -1 / 규칙 0, 무기 인산 단계 -1 / 규칙 0 — 알려진 단순화 (L000061)
```
