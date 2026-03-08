import { Notice, Plugin, WorkspaceLeaf } from "obsidian";
import { DEFAULT_SETTINGS, MERGE_VIEW_TYPE } from "./constants";
import { GitManager } from "./gitManager";
import { AutomaticsManager } from "./automaticsManager";
import { SyncStatusBar } from "./statusBar";
import { MergeView } from "./mergeView";
import { PromiseQueue } from "./promiseQueue";
import { addCommands } from "./commands";
import { SyncSettingTab } from "./setting/settings";
import { GitState } from "./types";
import type { ConflictFile, PluginSettings } from "./types";

export default class MyGitSync extends Plugin {
    settings!: PluginSettings;
    gitManager!: GitManager;
    automaticsManager!: AutomaticsManager;
    promiseQueue!: PromiseQueue;
    statusBar: SyncStatusBar | null = null;

    /** 상태 표시바에 보여줄 변경 파일 수 */
    changedFilesCount = 0;

    private _state: GitState = GitState.Idle;

    get state(): GitState {
        return this._state;
    }

    /** 상태 변경 시 자동으로 상태 표시바 갱신 */
    set state(s: GitState) {
        this._state = s;
        this.statusBar?.update();
    }

    async onload(): Promise<void> {
        await this.loadSettings();

        this.promiseQueue = new PromiseQueue();
        this.gitManager = new GitManager(this);
        this.automaticsManager = new AutomaticsManager(this);

        try {
            await this.gitManager.init();
        } catch (e) {
            new Notice(`[Git 동기화] 초기화 실패: ${e}`);
            return;
        }

        // 상태 표시바
        if (this.settings.showStatusBar) {
            const el = this.addStatusBarItem();
            this.statusBar = new SyncStatusBar(el, this);
        }

        // Merge View 뷰 타입 등록
        this.registerView(MERGE_VIEW_TYPE, (leaf) => new MergeView(leaf, this));

        // 명령어 등록
        addCommands(this);

        // 설정 탭 추가
        this.addSettingTab(new SyncSettingTab(this.app, this));

        // 자동 루틴 시작
        await this.automaticsManager.init();

        // 시작 시 자동 Pull (Obsidian이 완전히 로드된 후 실행)
        if (this.settings.autoPullOnBoot) {
            setTimeout(() => {
                this.promiseQueue.addTask(() => this.pull());
            }, 3000);
        }
    }

    async onunload(): Promise<void> {
        this.automaticsManager.unload();
    }

    // ── 핵심 git 동작 ─────────────────────────────────────────────

    async pull(): Promise<void> {
        this.state = GitState.Pulling;
        try {
            await this.gitManager.pull(this.settings.syncMethod);
            await this.refreshChangedFilesCount();
            new Notice("✓ Pull 완료");
            this.state = GitState.Idle;
        } catch (e) {
            // Pull 실패 시 충돌 여부 즉시 확인
            const conflicts = await this.gitManager.getConflicts();
            if (conflicts.length > 0) {
                await this.handleConflict(conflicts);
                // state는 handleConflict 내부에서 Conflict로 설정됨
            } else {
                new Notice(`Pull 실패: ${e}`);
                this.state = GitState.Idle;
            }
        }
    }

    async push(): Promise<void> {
        this.state = GitState.Pushing;
        try {
            await this.gitManager.push();
            new Notice("✓ Push 완료");
            this.state = GitState.Idle;
        } catch (e) {
            new Notice(`Push 실패: ${e}`);
            this.state = GitState.Idle;
        }
    }

    async commit(message?: string): Promise<void> {
        this.state = GitState.Committing;
        try {
            const hasChanges = await this.gitManager.hasChanges();
            if (!hasChanges) {
                new Notice("커밋할 변경사항이 없습니다.");
                this.state = GitState.Idle;
                return;
            }
            await this.gitManager.stageAll();
            const msg = message ?? this.gitManager.formatCommitMessage(this.settings.commitMessage);
            await this.gitManager.commit(msg);
            await this.refreshChangedFilesCount();
            new Notice("✓ 커밋 완료");
            this.state = GitState.Idle;
        } catch (e) {
            new Notice(`커밋 실패: ${e}`);
            this.state = GitState.Idle;
        }
    }

    /** 커밋 → Push */
    async commitAndPush(): Promise<void> {
        try {
            const hasChanges = await this.gitManager.hasChanges();
            if (!hasChanges) {
                new Notice("커밋할 변경사항이 없습니다.");
                return;
            }
            await this.commit();
            if (this.state === GitState.Conflict) return;

            await this.push();
        } catch (e) {
            new Notice(`커밋 & Push 실패: ${e}`);
            if (this.state !== GitState.Conflict) {
                this.state = GitState.Idle;
            }
        }
    }

    /**
     * Pull → 커밋 → Push 순서로 전체 동기화.
     * 충돌 발생 시 즉시 중단하고 merge view를 연다.
     */
    async fullSync(): Promise<void> {
        try {
            await this.pull();
            if (this.state === GitState.Conflict) return;

            const hasChanges = await this.gitManager.hasChanges();
            if (hasChanges) {
                await this.commit();
                if (this.state === GitState.Conflict) return;
            }

            await this.push();
        } catch (e) {
            new Notice(`전체 동기화 실패: ${e}`);
            if (this.state !== GitState.Conflict) {
                this.state = GitState.Idle;
            }
        }
    }

    /**
     * 커밋 → Pull → Push (자동 루틴 내부용).
     * 충돌 발생 시 즉시 중단하고 merge view를 연다.
     */
    async commitAndSync(): Promise<void> {
        try {
            const hasChanges = await this.gitManager.hasChanges();
            if (hasChanges) {
                await this.commit();
                if (this.state === GitState.Conflict) return;
            }

            await this.pull();
            if (this.state === GitState.Conflict) return;

            await this.push();
        } catch (e) {
            new Notice(`동기화 실패: ${e}`);
            if (this.state !== GitState.Conflict) {
                this.state = GitState.Idle;
            }
        }
    }

    // ── 충돌 처리 ─────────────────────────────────────────────────

    /**
     * 충돌 감지 시 즉시 호출.
     * 1) 모든 자동 루틴 정지
     * 2) 상태를 Conflict로 변경
     * 3) Merge View 강제 오픈
     */
    private async handleConflict(conflicts: ConflictFile[]): Promise<void> {
        this.automaticsManager.pause();
        this.state = GitState.Conflict;

        new Notice(
            `⚠️ 병합 충돌 발생 (${conflicts.length}개 파일)! 해결 후 동기화를 재개하세요.`,
            0  // timeout 0 = 수동으로 닫을 때까지 표시
        );

        await this.openMergeView(conflicts);
    }

    /** Merge View를 열고 충돌 파일 목록을 전달한다 */
    async openMergeView(conflicts?: ConflictFile[]): Promise<void> {
        const leaves = this.app.workspace.getLeavesOfType(MERGE_VIEW_TYPE);
        let leaf: WorkspaceLeaf;

        if (leaves.length === 0) {
            leaf = this.app.workspace.getLeaf("tab");
            await leaf.setViewState({ type: MERGE_VIEW_TYPE });
        } else {
            leaf = leaves[0];
        }

        await this.app.workspace.revealLeaf(leaf);

        if (conflicts) {
            (leaf.view as MergeView).setConflicts(conflicts);
        }
    }

    /**
     * Merge View에서 모든 충돌을 해결하면 호출됨.
     * 해결된 파일을 저장 → 스테이징 → 머지 커밋 → Push → 자동 루틴 재개
     */
    async onConflictResolved(resolvedFiles: ConflictFile[]): Promise<void> {
        try {
            // 해결된 내용을 파일에 쓰고 스테이징
            for (const file of resolvedFiles) {
                await this.app.vault.adapter.write(file.vaultPath, file.content);
                await this.gitManager.stageFile(file.repoPath);
            }

            // 머지 커밋
            await this.gitManager.commit("병합 충돌 해결");
            await this.gitManager.push();

            this.state = GitState.Idle;
            this.automaticsManager.resume();

            new Notice("✓ 충돌 해결 및 동기화 완료");

            // Merge View 닫기
            const leaves = this.app.workspace.getLeavesOfType(MERGE_VIEW_TYPE);
            for (const leaf of leaves) {
                leaf.detach();
            }
        } catch (e) {
            new Notice(`충돌 해결 후 처리 실패: ${e}`);
        }
    }

    // ── 설정 ──────────────────────────────────────────────────────

    async loadSettings(): Promise<void> {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
        this.automaticsManager.reload();
    }

    // ── 내부 유틸 ─────────────────────────────────────────────────

    private async refreshChangedFilesCount(): Promise<void> {
        if (!this.settings.showChangedFilesCount) return;
        try {
            this.changedFilesCount = await this.gitManager.getChangedFilesCount();
            this.statusBar?.update();
        } catch {
            // 무시
        }
    }
}
