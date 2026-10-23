# 실측 속도 상수 — route 1 (BRENDA) 성과와 한계 (2026-10-16)

사용자가 모든 도메인을 열고 BRENDA 계정을 제공 → route 1(자동 수집) 실제로 열림.

## 성과: 사람 시트르산 생성효소 (첫 자동 수집 실측 상수)
| 값 | 수치 | 기질 | 조건 | 출처 |
|---|---|---|---|---|
| kcat | 260 /s | 아세틸-CoA | WT, pH 8.0, 온도 미기재 | BRENDA EC 2.3.3.1 lit 756131 = PMID 31141475 (Schlachter 2019) |
| Km | 7.7 µM | 아세틸-CoA | 〃 | 〃 |
| (kcat) | 208 /s | 옥살로아세트산 | 〃 | 〃 (증거 파일에, 규칙엔 미사용) |
| (Km) | 3.6 µM | 옥살로아세트산 | 〃 | 〃 |

- 관찰 O+cs_kcat·O+cs_km → 규칙 `D000149/rule/condense` 에 MM 법칙으로. 등급 **parameter**(S≥3·D≥3).
- 모델은 단일 기질 MM(core.js 가 첫 law 입력=아세틸-CoA 의 Km 사용), 옥살로아세트산 포화 가정 — 규칙 text 에 명시.
- 교차 확인: BRENDA Km 7.7·3.6 µM 이 UniProt CS Km(7.7·3.6 µM)과 일치.
- 증거 파일 `data/fetched/brenda/EC2.3.3.1-Homo-sapiens.json` (sha256 0f971698…).
- rate 전후: condense 가 사건기반 → MM rate-active (S000031), 기존 한계 L000038(2/8→3/8)·L000096(0/6→1/6)의 condense kcat·Km 공백 메움.

## 한계: 사람 특이 kcat 은 BRENDA 에도 희소
| 효소 (EC) | 사람 kcat | 사람 Km |
|---|---|---|
| 시트르산 생성효소 2.3.3.1 | ✅ 2종 | ✅ 2종 |
| 석시닐-CoA 합성효소 6.2.1.4 | 0 | 1 |
| 석신산 탈수소효소 1.3.5.1 | 0 | 0 |
| 말산 탈수소효소 1.1.1.37 | 0 | 6 (kcat 없음) |

- 대부분 kinetics 가 돼지·소·세균 값 → 사람 상수로 못 씀(다른 종 값 금지). → L000110 갱신.
- 길: 사람 kcat 보고 1차 문헌을 enzyme 별로 찾으면 추가. ΔG° 는 eQuilibrator api 호스트(502) 복구 시.

## 자동 출처 최종 현황 (모든 도메인 개방 후)
- BRENDA: ✅ (계정) — 사람 kcat 희소가 병목.
- UniProt: ✅ — Km 일부(사람 CS·IDH2), 서열·위치.
- SABIO-RK: ❌ REST 폐지.
- eQuilibrator: ❌ api 호스트 502.
- Europe PMC 전문: ✅ 받히나 절대 kcat/Km 이 그림·보충자료에 잠김.
