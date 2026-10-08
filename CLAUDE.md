# 이 저장소에서 일하는 AI 에이전트를 위한 규칙

데이터는 사람이 아니라 AI가 넣는다. 저장소는 `data/db.json`, 병합 기록은 `data/patches/`.
규칙 전체는 `SCHEMA.md`. 명령은 저장소 최상위에서 실행한다.

## 데이터를 넣을 때

`data/db.json` 을 직접 편집하지 않는다. 항상 패치 → `merge` 경로를 쓴다.

1. `node dbtool.mjs status`, `node dbtool.mjs prompt` 로 규모·규칙·색인을 읽는다.
2. 쓰려는 개념이 이미 있는지 `node dbtool.mjs map <이름|영문명|외부ID>` 로 먼저 찾는다. 있으면 그 id 를 쓴다.
   뜻이 여러 개면 `node dbtool.mjs context <피정의항>` 으로 맥락을 보고 맞는 정의항을 고른다.
   기전을 넣을 때는 `node dbtool.mjs mechanism <경로|step:N>` 으로 기존 사슬과 상태 키를 확인한다.
3. 패치 JSON 을 저장소 밖(스크래치 폴더)에 쓰고 `node dbtool.mjs merge <patch.json> --dry` 로 관문을 통과하는지 본다.
   거부되면 메시지대로 고친다. `--allow-warnings` 는 사용자가 허락한 경우에만 쓴다.
4. 통과하면 `--dry` 없이 병합하고 `data/db.json` 과 `data/patches/` 를 함께 커밋한다.

반드시 지킬 것
- 외부 ID(ChEBI, UniProt, EC, GO …)는 확실한 것만 적는다. 모르면 `unmapped` 에 사유를 적는다. 지어내지 않는다.
- 인산화형·활성형 같은 변화는 새 피정의항이 아니라 상태(state)로 표현한다.
- 연결의 `span` 은 정의 문장 속 구절을 원문 그대로. 근거가 문장에 없으면 연결을 빼거나 문장을 고친다.
- 기존 정의항을 고치는 패치는 정의항 전체를 교체한다(연결·예시도 다시 적을 것). states·xrefs·unmapped 는 생략하면 유지된다.

## 규칙·코드를 바꿀 때

- 통제 어휘(`vocab.js`)나 규칙(`core.js`)은 사용자 요청이 있을 때만 바꾼다. 데이터를 통과시키려고 규칙을 느슨하게 하지 않는다.
- 바꾼 뒤 `node --test tests/*.test.mjs` 와 `node dbtool.mjs validate` 가 모두 통과해야 한다. 새 규칙에는 거부 테스트를 추가한다.
- 형식이 바뀌면 `migrations/` 에 변환 스크립트를 추가하고 `SCHEMA.md` 변경 기록을 갱신한다.
- `index.html` 은 `viewer.html` 의 복사본이다. 화면을 고치면 둘 다 맞춘다.
