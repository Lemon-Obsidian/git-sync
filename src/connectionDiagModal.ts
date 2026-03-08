import { App, Modal } from "obsidian";
import type MyGitSync from "./main";

export class ConnectionDiagModal extends Modal {
    constructor(app: App, private readonly plugin: MyGitSync) {
        super(app);
        this.titleEl.setText("연결 진단");
    }

    async onOpen(): Promise<void> {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("my-git-sync-diag-modal");

        const list = contentEl.createDiv({ cls: "my-git-sync-diag-list" });

        const items: { label: string; run: () => Promise<string> }[] = [
            { label: "Git 실행파일", run: () => this.checkGitVersion() },
            { label: "저장소",       run: () => this.checkRepo() },
            { label: "Remote URL",   run: () => this.checkRemoteUrl() },
            { label: "현재 브랜치",  run: () => this.checkBranch() },
            { label: "Remote 연결",  run: () => this.checkRemoteConnection() },
            { label: "미push 커밋",  run: () => this.checkUnpushed() },
        ];

        const rows = items.map((item) => {
            const row = list.createDiv({ cls: "my-git-sync-diag-row" });
            row.createSpan({ cls: "my-git-sync-diag-label", text: item.label });
            const statusEl = row.createSpan({ cls: "my-git-sync-diag-status my-git-sync-diag-loading", text: "…" });
            const detailEl = row.createSpan({ cls: "my-git-sync-diag-detail" });
            return { statusEl, detailEl, run: item.run };
        });

        for (const row of rows) {
            try {
                const result = await row.run();
                row.statusEl.setText("✓");
                row.statusEl.removeClass("my-git-sync-diag-loading");
                row.statusEl.addClass("my-git-sync-diag-ok");
                row.detailEl.setText(result);
            } catch (e) {
                row.statusEl.setText("✗");
                row.statusEl.removeClass("my-git-sync-diag-loading");
                row.statusEl.addClass("my-git-sync-diag-fail");
                row.detailEl.setText(e instanceof Error ? e.message : String(e));
                row.detailEl.addClass("my-git-sync-diag-detail-error");
            }
        }
    }

    onClose(): void {
        this.contentEl.empty();
    }

    private async checkGitVersion(): Promise<string> {
        return await this.plugin.gitManager.getGitVersion();
    }

    private async checkRepo(): Promise<string> {
        const ok = await this.plugin.gitManager.isRepo();
        if (!ok) throw new Error("Git 저장소가 아닙니다.");
        return "유효한 Git 저장소";
    }

    private async checkRemoteUrl(): Promise<string> {
        const url = await this.plugin.gitManager.getRemoteUrl();
        if (!url) throw new Error("origin remote가 없습니다.");
        return url;
    }

    private async checkBranch(): Promise<string> {
        const branch = await this.plugin.gitManager.getCurrentBranch();
        if (!branch || branch === "HEAD") throw new Error("Detached HEAD 상태");
        return branch;
    }

    private async checkRemoteConnection(): Promise<string> {
        await this.plugin.gitManager.testRemoteConnection();
        return "연결 성공";
    }

    private async checkUnpushed(): Promise<string> {
        const count = await this.plugin.gitManager.getUnpushedCount();
        return count === 0 ? "없음" : `${count}개`;
    }
}
