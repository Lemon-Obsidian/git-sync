<div align="center">

# @lemon/git-sync

**Obsidian용 Git 동기화 플러그인**

파일 변경 감지 자동 커밋 · 종료 시 자동 저장 · 자동 Pull · 충돌 해결 뷰 · 상태 표시바

[![Release](https://img.shields.io/badge/release-1.4.0-6c63ff?style=flat-square)](https://github.com/Lemon-Obsidian/git-sync/releases/latest)
[![Obsidian](https://img.shields.io/badge/Obsidian-1.4%2B-7c3aed?style=flat-square&logo=obsidian&logoColor=white)](https://obsidian.md)
[![License](https://img.shields.io/github/license/Lemon-Obsidian/git-sync?style=flat-square&color=10b981)](LICENSE)

</div>

---

## ✨ 주요 기능

| 기능 | 설명 |
|------|------|
| 📝 **파일 변경 감지 자동 커밋** | 파일 생성/수정/삭제/이름 변경 후 N초 debounce 대기 → 자동 커밋 & 동기화 |
| 🚪 **종료 시 자동 저장** | X 버튼으로 닫을 때 변경사항을 commit & push 후 종료, Notice로 진행 상황 안내 |
| 🔄 **자동 커밋 & 동기화** | 설정한 간격마다 자동으로 커밋 → Pull → Push 실행 |
| ⬇️ **자동 Pull** | 설정한 간격마다 원격 저장소에서 변경사항 자동 수신 |
| 🚀 **시작 시 Pull** | Obsidian 시작 시 자동으로 최신 상태로 갱신 |
| ⚔️ **충돌 해결 뷰** | 병합 충돌 발생 시 좌(로컬) · 우(원격) 분할 뷰에서 직접 해결, Accept 버튼 지원 |
| 📊 **상태 표시바** | 현재 Git 상태 (Idle / Pulling / Pushing / Committing / Conflict) 및 변경 파일 수 표시 |
| ⚙️ **Pull 방식 선택** | Rebase(기본) / Merge / Reset 중 선택 |
| 🌿 **기본 브랜치 설정** | Push 및 동기화에 사용할 브랜치 지정, detached HEAD 시 폴백으로도 사용 |

---

## 📦 설치

### BRAT 사용 (권장)

> 업데이트가 자동으로 적용됩니다.

1. Obsidian 커뮤니티 플러그인에서 **BRAT** 설치 및 활성화
2. BRAT 설정 → **Add Beta plugin from GitHub**
3. `Lemon-Obsidian/git-sync` 입력
4. Obsidian 재시작 후 `@lemon/git-sync` 플러그인 활성화

### 수동 설치

1. [최신 릴리즈](https://github.com/Lemon-Obsidian/git-sync/releases/latest)에서 `main.js`, `manifest.json`, `styles.css` 다운로드
2. vault 내 `.obsidian/plugins/lemon-git-sync/` 폴더에 복사
3. Obsidian 재시작 후 설정 → 커뮤니티 플러그인에서 활성화

---

## 🗂️ 동작 방식

### 자동 동기화 흐름

```
파일 변경 (생성 / 수정 / 삭제 / 이름 변경)
  └─▶ debounce 타이머 리셋 (기본 30초)
        └─▶ 타이머 만료 → commitAndSync()
              ├─▶ commit (변경사항 없으면 스킵)
              ├─▶ pull --rebase
              └─▶ push origin <기본 브랜치>

N분 주기 타이머 (autoCommitInterval)
  └─▶ commitAndSync() (위와 동일)

N분 주기 타이머 (autoPullInterval)
  └─▶ pull --rebase
```

### 종료 시 자동 저장

```
X 버튼 클릭
  └─▶ beforeunload 감지 → 창 닫기 차단
        └─▶ 변경사항 확인
              ├─▶ 없음 → 바로 종료
              └─▶ 있음 → "⏳ 저장 중..." Notice 표시
                    ├─▶ commit
                    ├─▶ "✓ 커밋 완료, Push 중..." Notice 표시
                    ├─▶ push
                    ├─▶ "✓ Push 완료" Notice 표시
                    └─▶ 종료
```

> 강제 종료(작업 관리자 등)는 beforeunload가 호출되지 않아 동작하지 않습니다.

### 충돌 해결 흐름

```
Pull 중 병합 충돌 감지
  └─▶ 자동 루틴 즉시 정지
        └─▶ 충돌 해결 뷰 자동 오픈
              ├─▶ 좌: 로컬(편집 가능) / 우: 원격(읽기 전용)
              ├─▶ 직접 편집 또는 Accept 버튼으로 청크 선택
              └─▶ "해결 완료 및 커밋" 클릭
                    ├─▶ 머지 커밋
                    ├─▶ push
                    ├─▶ 충돌 해결 뷰 닫기
                    └─▶ 자동 루틴 재개
```

---

## 📖 사용법

### 커맨드 팔레트 (`Ctrl/Cmd+P`)

| 명령어 | 설명 |
|--------|------|
| `풀 (Pull)` | 원격 저장소에서 변경사항 수신 |
| `커밋하고 Push` | 변경사항 커밋 후 원격 저장소에 Push |
| `전체 동기화 (Pull → 커밋 → Push)` | Pull → 커밋 → Push 순서로 전체 동기화 |
| `자동 루틴 일시정지 / 재개` | 자동 커밋 · Pull 타이머 토글 |

### 상태 표시바

하단 상태 표시바에 현재 Git 상태가 실시간으로 표시됩니다.

| 상태 | 아이콘 | 설명 |
|------|--------|------|
| Idle | ✓ | 대기 중. 변경 파일 수 및 마지막 커밋 시각 표시 |
| Pulling | ↓ | 원격에서 변경사항 수신 중 |
| Pushing | ↑ | 원격으로 변경사항 업로드 중 |
| Committing | ● | 로컬 커밋 중 |
| Conflict | ⚠️ | 병합 충돌 발생 — 클릭하면 충돌 해결 뷰 열기 |
| 일시정지 | ⏸ | 자동 루틴 일시정지 상태 |

### 충돌 해결 뷰

Pull 중 병합 충돌이 감지되면 자동으로 열립니다.

- **좌(로컬)**: 내 변경사항 — 직접 편집 가능
- **우(원격)**: 받아온 변경사항 — 읽기 전용
- 우측 청크의 **Accept** 버튼으로 원격 변경을 로컬에 적용
- 여러 파일이 충돌한 경우 **이전 / 다음** 버튼으로 순서대로 해결
- 모든 충돌 마커 제거 후 **해결 완료 및 커밋** 버튼 활성화

---

## ⚙️ 설정

설정 → 플러그인 옵션 → `@lemon/git-sync`

### 자동 동기화

| 항목 | 설명 | 기본값 |
|------|------|--------|
| 시작 시 자동 Pull | Obsidian 시작 시 자동 Pull | ON |
| 자동 커밋 간격 (분) | N분마다 커밋 & 동기화. 0이면 비활성화 | 5 |
| 자동 Pull 간격 (분) | N분마다 Pull. 0이면 비활성화 | 10 |
| 커밋 메시지 | 커밋 메시지 템플릿. `{{date}}`는 현재 날짜/시간으로 대체 | `vault 백업: {{date}}` |
| 파일 변경 시 자동 커밋 지연 (초) | 파일 변경 후 N초 debounce 대기 → 자동 커밋 & 동기화. 0이면 비활성화 | 30 |

### 동기화 방식

| 방식 | 설명 | 기본값 |
|------|------|:------:|
| **Rebase** | 로컬 커밋을 원격 위에 재배치 | ✅ |
| **Merge** | 변경사항을 병합 (충돌 가능) | |
| **Reset** | 로컬 변경사항을 무시하고 원격으로 덮어쓰기 | |

### 상태 표시바

| 항목 | 설명 | 기본값 |
|------|------|--------|
| 상태 표시바 표시 | 하단 상태 표시바 활성화 | ON |
| 변경 파일 수 표시 | 상태 표시바에 변경된 파일 수 함께 표시 | ON |

### 고급

| 항목 | 설명 | 기본값 |
|------|------|--------|
| 기본 브랜치 | Push 및 동기화에 사용할 브랜치. detached HEAD 시 폴백으로도 사용 | `main` |
| Git 저장소 경로 | Vault 내 Git 저장소의 상대 경로. 비어있으면 Vault 루트 사용 | (비어있음) |
| Git 실행 파일 경로 | Git 바이너리 절대 경로. 비어있으면 시스템 기본값(`git`) 사용 | (비어있음) |

---

## 🛠️ 개발

```bash
pnpm install
pnpm dev      # 개발 모드 (파일 변경 감지 + 자동 빌드)
pnpm build    # 프로덕션 빌드
```

빌드 후 `main.js`, `manifest.json`, `styles.css`를 vault의 `.obsidian/plugins/lemon-git-sync/`에 복사하면 즉시 반영됩니다.

### 프로젝트 구조

```
src/
├── main.ts               # 플러그인 진입점 · Git 핵심 동작 · 충돌 처리
├── types.ts              # PluginSettings · GitState · ConflictFile 타입
├── constants.ts          # 기본 설정값 · 뷰 타입 상수
├── gitManager.ts         # simple-git 래퍼 (pull · push · commit · conflict 감지)
├── automaticsManager.ts  # 자동 커밋 / Pull 타이머 · 파일 변경 훅 · 종료 시 저장
├── statusBar.ts          # 하단 상태 표시바
├── mergeView.ts          # 병합 충돌 해결 뷰 (좌우 분할)
├── promiseQueue.ts       # Git 작업 직렬 실행 큐
├── commands.ts           # 커맨드 팔레트 명령어 등록
└── setting/
    └── settings.ts       # 설정 탭 UI
styles.css                # 플러그인 스타일
manifest.json             # 플러그인 메타 (id: lemon-git-sync)
```

---

## 📋 변경 이력

| 버전 | 주요 변경 |
|------|-----------|
| **1.4.0** | 기본 브랜치 설정 추가 (기본값: `main`) · detached HEAD 시 설정 브랜치로 폴백 |
| **1.3.0** | detached HEAD 에러 처리 · reset 방식 pull 수정 · 기본 병합 방식 rebase로 변경 |
| **1.2.0** | 충돌 해결 뷰 좌우 분할 패널로 변경 (unifiedMergeView → MergeView) |
| **1.1.0** | 파일 변경 debounce 커밋 · 종료 시 자동 저장 · 커맨드 재편 (commit & push / full-sync) |
| **1.0.0** | 초기 릴리즈 — 자동 커밋 타이머 · 자동 Pull · 충돌 해결 뷰 · 상태 표시바 |

---

<div align="center">

Made with ☕ for [Obsidian](https://obsidian.md)

</div>
