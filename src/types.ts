export interface PluginSettings {
    // 자동 동기화
    autoPullOnBoot: boolean;
    autoCommitInterval: number;  // 분, 0이면 비활성화
    autoPullInterval: number;    // 분, 0이면 비활성화
    commitMessage: string;       // 커밋 메시지 템플릿 ({{date}} 지원)

    // 상태 표시바
    showStatusBar: boolean;
    showChangedFilesCount: boolean;

    // 파일 변경 감지
    debounceDelay: number;      // 초, 0이면 비활성화

    // 고급
    defaultBranch: string;      // 동기화할 기본 브랜치
    basePath: string;           // vault 내 git 저장소 상대 경로 (비어있으면 vault 루트)
    gitExecutablePath: string;  // git 실행 파일 경로
}

export enum GitState {
    Idle = "idle",
    Pulling = "pulling",
    Pushing = "pushing",
    Committing = "committing",
    Conflict = "conflict",
}

export interface ConflictFile {
    vaultPath: string;  // vault 기준 경로
    repoPath: string;   // 저장소 기준 경로
    content: string;    // 충돌 마커가 포함된 파일 내용
}
