import { moment, setIcon } from "obsidian";
import type MyGitSync from "./main";
import { GitState } from "./types";

/**
 * 하단 상태 표시바.
 * - 현재 git 동작 상태를 아이콘 + 텍스트로 표시
 * - 충돌 상태에서 클릭하면 merge view 열기
 */
export class SyncStatusBar {
    private iconEl: HTMLElement;
    private textEl: HTMLElement;

    constructor(
        private readonly el: HTMLElement,
        private readonly plugin: MyGitSync
    ) {
        el.addClass("my-git-sync-statusbar");
        el.setAttribute("data-tooltip-position", "top");

        this.iconEl = el.createDiv({ cls: "my-git-sync-statusbar-icon" });
        this.textEl = el.createDiv({ cls: "my-git-sync-statusbar-text" });

        el.addEventListener("click", () => {
            if (this.plugin.state === GitState.Conflict) {
                void this.plugin.openMergeView();
            }
        });

        this.update();
    }

    update(): void {
        this.iconEl.empty();
        this.textEl.empty();
        this.el.removeClass("my-git-sync-conflict");

        // 일시정지 상태 (충돌 아닌 경우)
        if (this.plugin.automaticsManager.isPaused() && this.plugin.state !== GitState.Conflict) {
            setIcon(this.iconEl, "pause-circle");
            this.textEl.setText("일시정지");
            this.el.ariaLabel = "자동 루틴이 일시정지되었습니다";
            return;
        }

        switch (this.plugin.state) {
            case GitState.Idle:
                setIcon(this.iconEl, "check");
                this.renderIdleState();
                break;

            case GitState.Pulling:
                setIcon(this.iconEl, "download");
                this.textEl.setText("Pull 중...");
                this.el.ariaLabel = "원격 저장소에서 변경사항을 가져오는 중...";
                break;

            case GitState.Pushing:
                setIcon(this.iconEl, "upload");
                this.textEl.setText("Push 중...");
                this.el.ariaLabel = "원격 저장소로 변경사항을 올리는 중...";
                break;

            case GitState.Committing:
                setIcon(this.iconEl, "git-commit");
                this.textEl.setText("커밋 중...");
                this.el.ariaLabel = "변경사항을 커밋하는 중...";
                break;

            case GitState.Conflict:
                setIcon(this.iconEl, "alert-triangle");
                this.textEl.setText("충돌 발생!");
                this.el.ariaLabel = "병합 충돌 발생 - 클릭하여 해결하기";
                this.el.addClass("my-git-sync-conflict");
                break;
        }
    }

    private renderIdleState(): void {
        if (this.plugin.settings.showChangedFilesCount && this.plugin.changedFilesCount > 0) {
            this.textEl.setText(`${this.plugin.changedFilesCount}개 변경`);
        }

        // 비동기로 마지막 커밋 시각 표시
        void this.plugin.gitManager.getLastCommitTime().then((date) => {
            if (date) {
                this.el.ariaLabel = `마지막 커밋: ${moment(date).fromNow()}`;
            } else {
                this.el.ariaLabel = "Git: 준비됨";
            }
        });
    }

    remove(): void {
        this.el.remove();
    }
}
