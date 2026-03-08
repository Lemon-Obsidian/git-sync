<div align="center">

# @lemon/git-sync

**Obsidian용 Git 동기화 플러그인**

파일 변경 감지 자동 커밋 · 종료 시 자동 저장 · 자동 Pull · 충돌 해결 뷰 · 상태 표시바

[![Release](https://img.shields.io/badge/release-1.2.0-6c63ff?style=flat-square)](https://github.com/Lemon-Obsidian/git-sync/releases/latest)
[![Obsidian](https://img.shields.io/badge/Obsidian-1.4%2B-7c3aed?style=flat-square&logo=obsidian&logoColor=white)](https://obsidian.md)
[![License](https://img.shields.io/github/license/Lemon-Obsidian/git-sync?style=flat-square&color=10b981)](LICENSE)

</div>

---

## ✨ 주요 기능

| 기능 | 설명 |
|------|------|
| 📝 **파일 변경 감지 자동 커밋** | 파일 생성/수정/삭제 후 N초 debounce 대기 → 자동 커밋 & 동기화 |
| 🚪 **종료 시 자동 저장** | X 버튼으로 닫을 때 변경사항을 commit & push 후 종료 |
| 🔄 **자동 커밋 & 동기화** | 설정한 간격마다 자동으로 커밋 → Pull → Push 실행 |
| ⬇️ **자동 Pull** | 설정한 간격마다 원격 저장소에서 변경사항 자동 수신 |
| 🚀 **시작 시 Pull** | Obsidian 시작 시 자동으로 최신 상태로 갱신 |
| ⚔️ **충돌 해결 뷰** | 병합 충돌 발생 시 좌(로컬) · 우(원격) 분할 뷰에서 직접 해결, Accept 버튼 지원 |
| 📊 **상태 표시바** | 현재 Git 상태 (Idle / Pulling / Pushing / Conflict) 및 변경 파일 수 표시 |
| ⚙️ **Pull 방식 선택** | Merge / Rebase / Reset 중 선택 |

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

## 📖 사용법

### 커맨드 팔레트 (`Ctrl/Cmd+P`)

| 명령어 | 설명 |
|--------|------|
| `풀 (Pull)` | 원격 저장소에서 변경사항 수신 |
| `커밋하고 Push` | 변경사항을 커밋 후 원격 저장소에 Push |
| `전체 동기화 (Pull → 커밋 → Push)` | Pull → 커밋 → Push 순서로 전체 동기화 |
| `자동 루틴 일시정지 / 재개` | 자동 커밋 · Pull 타이머 토글 |

### 충돌 해결

Pull 중 병합 충돌이 감지되면:

1. 자동 루틴이 즉시 정지됨
2. 충돌 해결 뷰가 자동으로 열림
3. 좌(로컬) · 우(원격) 분할 뷰에서 직접 편집하거나 우측 **Accept** 버튼으로 원격 변경 적용
4. 머지 커밋 → Push → 자동 루틴 자동 재개

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
| 파일 변경 시 자동 커밋 지연 (초) | 파일 생성/수정/삭제 후 N초 debounce 대기 → 자동 커밋 & 동기화. 0이면 비활성화 | 30 |

### 동기화 방식

| 방식 | 설명 |
|------|------|
| **Merge** | 변경사항을 병합 (기본값, 충돌 가능) |
| **Rebase** | 로컬 커밋을 원격 위에 재배치 |
| **Reset** | 로컬 변경사항을 무시하고 원격으로 덮어쓰기 |

### 상태 표시바

| 항목 | 설명 | 기본값 |
|------|------|--------|
| 상태 표시바 표시 | 하단 상태 표시바 활성화 | ON |
| 변경 파일 수 표시 | 상태 표시바에 변경된 파일 수 함께 표시 | ON |

### 고급

| 항목 | 설명 | 기본값 |
|------|------|--------|
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
├── automaticsManager.ts  # 자동 커밋 / Pull 타이머 관리
├── statusBar.ts          # 하단 상태 표시바
├── mergeView.ts          # 병합 충돌 해결 뷰
├── promiseQueue.ts       # Git 작업 직렬 실행 큐
├── commands.ts           # 커맨드 팔레트 명령어 등록
└── setting/
    └── settings.ts       # 설정 탭 UI
styles.css                # 플러그인 스타일
manifest.json             # 플러그인 메타 (id: lemon-git-sync)
```

---

<div align="center">

Made with ☕ for [Obsidian](https://obsidian.md)

</div>
