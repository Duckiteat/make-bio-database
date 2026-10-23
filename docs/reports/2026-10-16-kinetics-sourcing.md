# 실측 속도 상수 수집 — 출처 현황 (2026-10-16)

목표(북극성): 등급 붙은 실측 기전 데이터 자원. 그중 동적 층(kcat·Km·ΔG°)을 채우려 시도했고, 이 환경에서 닿는 출처를 조사했다.

| 출처 | 닿음? | 주는 것 | 판정 |
|---|---|---|---|
| UniProt (`rest.uniprot.org`) | ✅ | 서열·위치, 일부 효소의 Km (PubMed 근거) | 사람 CS(O75390)·IDH2(P48735)에 Km 2개씩. **기질명이 구조화 필드에 없고(None) kcat 도 없음** → 어느 Km 인지 확인 불가, MM 법칙 불완전 |
| Europe PMC (`ebi.ac.uk`) | ✅ | 초록 | kcat/Km 은 본문 표에 있어 초록만으로는 확인 불가 (정성 관찰에는 충분) |
| SABIO-RK | ⚠️ | 효소 반응 동역학 | 사이트 개편으로 옛 REST(`sabioRestWebServices`)가 404 (새 API 경로 미확인) |
| eQuilibrator (`api.equilibrator.org`) | ❌ | 반응 ΔG°′ | 환경 네트워크 정책이 거부 (502) |
| BRENDA | ❌ | kcat·Km 집대성 | 계정·SOAP 필요 |

## 결론
- **정량 속도·열역학 실측 자원은 이 환경에서 깨끗이 수집되지 않는다.** 닿는 것은 UniProt 서열·위치와 초록(정성 관찰)뿐. 지금 실측 속도는 IDH·FH 둘, 나머지 동적 상수는 시나리오의 가상값(hypothetical). → 한계 L000110 (Kinetic_Gap).
- 값을 지어내지 않았다. CS 는 Km 두 개가 기질 미상이라 넣지 않음.

## 길 (사용자 선택)
1. **환경 네트워크 열기**: 세션 제목줄의 클라우드 환경 메뉴 → Edit → Network access 의 Allowed domains 에 `api.equilibrator.org`(ΔG°)와 SABIO-RK 새 API 호스트 추가(패키지 매니저 기본 목록은 켠 채). 그러면 ΔG°·동역학을 직접 수집. 문서: https://code.claude.com/docs/en/cloud-environments#network-access
2. **값 제공**: BRENDA·논문 본문에서 효소별 kcat·기질별 Km(사람 9606, 출처 DOI·PMID)을 주면 관찰 포트(`schemas/obs/`)로 등급 붙여 기록.
3. **닿는 범위부터**: 정성 관찰(초록)·서열·위치로 검증 자원을 먼저 키운다 — 적분 장 전에 판정 기계가 쓸 실측 관찰을 늘리는 쪽.

## 교차 확인 (덤)
- 푸마레이스(FH) UniProt(P07954) 값 — kcat 170/s(푸마르산)·Km 0.2 mM — 이 db 의 기존 FH 실측값(PMID 30761759)과 **같은 출처·같은 값**. 같은 1차 문헌이라 독립 확인은 아니나, 기존 입력이 UniProt 큐레이션과 어긋나지 않음을 보여 준다.
