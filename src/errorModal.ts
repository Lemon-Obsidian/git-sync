import { Modal, Notice } from "obsidian";
import type MyGitSync from "./main";

export class ErrorModal extends Modal {
    constructor(
        private readonly plugin: MyGitSync,
        private readonly title: string,
        private readonly error: unknown,
    ) {
        super(plugin.app);
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.addClass("my-git-sync-error-modal");

        // 헤더
        const header = contentEl.createDiv({ cls: "my-git-sync-error-header" });
        header.createDiv({ cls: "my-git-sync-error-badge", text: "ERROR" });
        header.createEl("h4", { text: this.title });

        // 에러 메시지
        const message = this.errorMessage();
        const body = contentEl.createDiv({ cls: "my-git-sync-error-body" });
        body.createEl("pre", { cls: "my-git-sync-error-text", text: message });

        // 버튼
        const footer = contentEl.createDiv({ cls: "my-git-sync-error-footer" });

        const copyBtn = footer.createEl("button", {
            text: "클립보드에 복사",
            cls: "mod-cta my-git-sync-error-copy-btn",
        });
        copyBtn.addEventListener("click", async () => {
            await navigator.clipboard.writeText(message);
            copyBtn.setText("✓ 복사됨");
            copyBtn.disabled = true;
            setTimeout(() => {
                copyBtn.setText("클립보드에 복사");
                copyBtn.disabled = false;
            }, 2000);
        });

        const closeBtn = footer.createEl("button", { text: "닫기" });
        closeBtn.addEventListener("click", () => this.close());
    }

    onClose(): void {
        this.contentEl.empty();
    }

    private errorMessage(): string {
        if (this.error instanceof Error) {
            return this.error.stack ?? this.error.message;
        }
        return String(this.error);
    }
}

/** 에러 모달을 열고 콘솔에도 기록한다 */
export function showError(plugin: MyGitSync, title: string, error: unknown): void {
    console.error(`[git-sync] ${title}`, error);
    new Notice(`❌ ${title}`, 4000);
    new ErrorModal(plugin, title, error).open();
}
