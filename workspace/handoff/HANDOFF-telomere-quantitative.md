# HANDOFF — TASK-004 사람 텔로미어 정량 측정 (2026-10-23)

출처: Europe PMC REST `resultType=core` 초록만. 원본은 입법 서기 `fetchToInbox` 로 `data/fetched/europepmc/MED-{PMID}.json` 에 받음. 7개 인용구 모두 수신함 원문과 **글자 그대로 일치** 확인(통합가 1차 출처 재확인). `verify-collection`: REVIEW_REQUIRED(구조 통과, 값 후보 — 아래 판정 대기). 수집·통합 같은 세션(사용자 승인).

| # | 대상 | 값·단위 | 종·세포·조건·불확도 | 출처+인용 | use | 규약 가능? 빠진 것 | 상태 |
|---|---|---|---|---|---|---|---|
| 1 | D000210 | **10 ± 2 PD/kbp** (전문 그림 2C) | 9606 · 섬유아세포 균주 31(0–93세 기증자) · 19 PD 뒤 남은 수명 대 TRF · r 0.76, P 0.004 · **± 는 스캔 그림 전사(사람 확인 권장)** | PMID 1438199 (Allsopp 1992) "m = 10 doublings per kilobase pair; r = 0.76; P = 0.004" | validation | 가능성 있음 — 모델 예측 = 1/(분열당 소실). 빠짐: 기울기 불확도, 측정법(전문) | collected · 인용 일치 |
| 2 | D000210 | −15 bp/yr | 9606 · 같은 31 기증자 · 생체 내 나이 · r −0.43 | PMID 1438199 "m = -15 base pairs per yr" | validation | 아니오 — 모델에 나이 축 없음 | collected · 인용 일치 |
| 3 | D000210 | 7.2 PD/kbp | 9606 · 한 기증자 클론 35 개체군 · TRF · r 0.65, P 0.0004 · SE 없음 | PMID 7628529 (Allsopp & Harley 1995) "m = 7.2 population doublings/kbp" | validation | #1 과 같은 꼴, 설계 다름(클론). 빠짐: 기울기 불확도 | collected · 인용 일치 |
| 4 | D000205/rule/division_attrition | ≈65 bp/PD | 9606 · **세포 종류 초록에 없음** · '대략', 불확도 없음 | PMID 1582420 (Counter 1992) "approximately 65 bp/generation" | validation | 아니오(지금) — 섬유아세포 확인 전문 필요, 상수라 검증보다 추정용 | collected · 인용 일치 |
| 5 | D000210 | ≈1.5 kbp | 9606 · 형질전환 세포 위기 시점 | PMID 1582420 "only approximately 1.5 kbp" | validation | 아니오 — 정상 노화 임계 길이가 아님 | collected · 인용 일치 |
| 6 | D000210 | ≥20 PD (하한) | 9606 · RPE + 포피 섬유아세포 합쳐 | PMID 9454332 (Bodnar 1998, O000027 과 같은 논문) "exceeded their normal life-span by at least 20 doublings" | validation | 부분 — 하한 검정(텔로머레이스 시나리오 수명 연장 ≥ 20 PD) 가능, 두 세포 합침 | collected · 인용 일치 |
| 7 | D000210 | — | 9606 · 섬유아세포 계대 | PMID 2342578 (Harley 1990) "decrease as a function of serial passage" | validation | 초록에 수치 없음 — 전문 필요 | collected · 인용 일치 |

**판정**
- 가장 가까운 후보: **#1·#3 (복제 수명 대 초기 텔로미어 길이 기울기, 10 · 7.2 PD/kbp)** — 사람 섬유아세포, 같은 연구군 두 설계. 모델은 이 양을 "초기 반복 단위를 바꿔 가며 정지까지의 분열 수" 용량 반응으로 낼 수 있다.
- 공통으로 빠진 것: **기울기의 불확도(SE)** — 초록엔 r·P 만. 정량 검증(TOST)에는 불확도가 필요하다.
- 순환 위험: 지금 시나리오의 분열당 소실 96 bp(가상)는 기울기로 1/0.096 ≈ 10.4 PD/kbp 를 내 #1 과 가깝다 — 그 가상 값이 이 문헌을 보고 고른 것이면 검증이 아니라 순환이다. 통합가가 시나리오 값의 유래를 확인해야 한다.
- 새 측정 유형 필요: "기울기(용량 반응의 민감도)" 는 지금 관찰 연산자 6종(amount·concentration·fraction·event_time·ratio·fraction_above)에 없다 — 들이려면 측정 유형 확장(어휘·연산자) 결정이 먼저.
- **불확도를 초록에서 계산할 수 없음 (통합가 점검)**: 기울기 SE 를 r·n 에서 유도하면(t = r√(n−2)/√(1−r²)) #1 은 t 6.30·SE 1.59, #3 은 t 4.91·SE 1.47 이지만, 그 t 라면 P < 1e-4 여야 하는데 보고된 P 는 0.004·0.0004 다 — 회귀에 실제로 쓴 표본 수가 기증자·클론 전체(31·35)보다 작았을 가능성. 그래서 SE 를 지어내지 않는다. **전문 필요**: #1 PNAS 89:10114 (PMC50288, Europe PMC 에서 OA 아님·구독), #3 Exp Cell Res 219:130 (구독). 회귀에 쓴 n·기울기 SE(또는 산점도 자료).

## 2026-10-23 ② 전문 확인 (사용자 요청: PubMed·PMC 에서 직접)
- **#1 Allsopp 1992 전문 확보** — PMC50288 스캔 PDF(PMC 의 브라우저 확인을 헤드리스 Chromium 으로 통과, 무료 공개 논문). 저작권 때문에 PDF 는 저장소에 넣지 않고 sha256 `40ea8619…2c` 만 기록. 그림 2C: **m = 0.010 ± 0.002 MPD per bp → 10 ± 2 PD/kbp**. 이 ± 는 OCR 텍스트 층에 없어 스캔을 눈으로 읽은 전사다 — 사람이 그림을 한 번 확인하면 확정.
- 같은 논문 본문: 체외 소실률 '48 ± 21 bp per population doubling'(참고문헌 22·25 인용 — **2차**, #8). 1/0.048 ≈ 21 PD/kbp 로 #1 과 2배 차 — 긴장으로 기록만.
- 본문: 노화 세포 TRF ≈ 6 kbp(인용 22·25), TRF 에 비-TTAGGG 아텔로미어 ≈ 4–5 kbp 포함 — 모델의 '반복 단위' 와 TRF 길이는 같은 양이 아니다(기울기는 오프셋과 무관해 영향 없음).
- 못 받은 것: #3 Allsopp & Harley 1995 (Exp Cell Res, PMC 없음·구독), Harley 1990 (Nature, 구독). PubMed 는 초록만이라 Europe PMC 와 같고, ExPASy 는 단백질 자원이라 논문 본문이 없다.
- **이제 #1 은 불확도가 있는 정량 검증 후보다.** 남은 결정: 측정 유형 '용량 반응 기울기' + 순환 위험(시나리오 96 bp/PD 의 유래 미기록).
