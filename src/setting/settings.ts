import { App, PluginSettingTab, Setting } from "obsidian";
import type MyGitSync from "../main";
import { ConnectionDiagModal } from "../connectionDiagModal";

export class SyncSettingTab extends PluginSettingTab {
    constructor(app: App, private readonly plugin: MyGitSync) {
        super(app, plugin);
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl("h2", { text: "Git 동기화 설정" });

        // ── 자동 동기화 ──────────────────────────────────────────
        containerEl.createEl("h3", { text: "자동 동기화" });

        new Setting(containerEl)
            .setName("시작 시 자동 Pull")
            .setDesc("Obsidian 시작 시 자동으로 원격 저장소에서 변경사항을 가져옵니다.")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.autoPullOnBoot)
                    .onChange(async (value) => {
                        this.plugin.settings.autoPullOnBoot = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("자동 커밋 간격 (분)")
            .setDesc("설정한 분마다 자동으로 커밋하고 동기화합니다. 0이면 비활성화.")
            .addText((text) =>
                text
                    .setValue(String(this.plugin.settings.autoCommitInterval))
                    .onChange(async (value) => {
                        const n = parseInt(value);
                        if (!isNaN(n) && n >= 0) {
                            this.plugin.settings.autoCommitInterval = n;
                            await this.plugin.saveSettings();
                        }
                    })
            );

        new Setting(containerEl)
            .setName("자동 Pull 간격 (분)")
            .setDesc("설정한 분마다 자동으로 Pull합니다. 0이면 비활성화.")
            .addText((text) =>
                text
                    .setValue(String(this.plugin.settings.autoPullInterval))
                    .onChange(async (value) => {
                        const n = parseInt(value);
                        if (!isNaN(n) && n >= 0) {
                            this.plugin.settings.autoPullInterval = n;
                            await this.plugin.saveSettings();
                        }
                    })
            );

        new Setting(containerEl)
            .setName("커밋 메시지")
            .setDesc("커밋 메시지 템플릿. {{date}}는 현재 날짜/시간으로 대체됩니다.")
            .addText((text) =>
                text
                    .setValue(this.plugin.settings.commitMessage)
                    .onChange(async (value) => {
                        this.plugin.settings.commitMessage = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("파일 변경 시 자동 커밋 지연 (초)")
            .setDesc("파일 생성/수정/삭제 후 마지막 변경으로부터 N초 대기 후 자동 커밋 & 동기화합니다. 0이면 비활성화.")
            .addText((text) =>
                text
                    .setValue(String(this.plugin.settings.debounceDelay))
                    .onChange(async (value) => {
                        const n = parseInt(value);
                        if (!isNaN(n) && n >= 0) {
                            this.plugin.settings.debounceDelay = n;
                            await this.plugin.saveSettings();
                        }
                    })
            );

        // ── 동기화 방식 ──────────────────────────────────────────
        containerEl.createEl("h3", { text: "동기화 방식" });

        new Setting(containerEl)
            .setName("Pull 방식")
            .setDesc("Rebase — 로컬 커밋을 원격 위에 재배치합니다.");

        // ── 상태 표시바 ──────────────────────────────────────────
        containerEl.createEl("h3", { text: "상태 표시바" });

        new Setting(containerEl)
            .setName("상태 표시바 표시")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.showStatusBar)
                    .onChange(async (value) => {
                        this.plugin.settings.showStatusBar = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("변경 파일 수 표시")
            .setDesc("상태 표시바에 변경된 파일 수를 함께 표시합니다.")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.showChangedFilesCount)
                    .onChange(async (value) => {
                        this.plugin.settings.showChangedFilesCount = value;
                        await this.plugin.saveSettings();
                    })
            );

        // ── 고급 ──────────────────────────────────────────────
        containerEl.createEl("h3", { text: "고급" });

        new Setting(containerEl)
            .setName("기본 브랜치")
            .setDesc("Push 및 동기화에 사용할 기본 브랜치 이름.")
            .addText((text) =>
                text
                    .setPlaceholder("main")
                    .setValue(this.plugin.settings.defaultBranch)
                    .onChange(async (value) => {
                        this.plugin.settings.defaultBranch = value.trim() || "main";
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Git 저장소 경로")
            .setDesc("Vault 내 Git 저장소의 상대 경로. 비어있으면 Vault 루트를 사용합니다.")
            .addText((text) =>
                text
                    .setPlaceholder("예: notes")
                    .setValue(this.plugin.settings.basePath)
                    .onChange(async (value) => {
                        this.plugin.settings.basePath = value.trim();
                        await this.plugin.saveSettings();
                        await this.plugin.gitManager.init();
                    })
            );

        new Setting(containerEl)
            .setName("Git 실행 파일 경로")
            .setDesc("Git 실행 파일의 절대 경로. 비어있으면 시스템 기본값(git)을 사용합니다.")
            .addText((text) =>
                text
                    .setPlaceholder("예: /usr/bin/git")
                    .setValue(this.plugin.settings.gitExecutablePath)
                    .onChange(async (value) => {
                        this.plugin.settings.gitExecutablePath = value.trim();
                        await this.plugin.saveSettings();
                        await this.plugin.gitManager.init();
                    })
            );

        // ── 연결 진단 ──────────────────────────────────────────
        containerEl.createEl("h3", { text: "연결 진단" });

        new Setting(containerEl)
            .setName("연결 상태 확인")
            .setDesc("Git 실행파일, 저장소, Remote URL, 브랜치, 인증 등 연결 관련 항목을 점검합니다.")
            .addButton((btn) =>
                btn
                    .setButtonText("진단 실행")
                    .onClick(() => {
                        new ConnectionDiagModal(this.app, this.plugin).open();
                    })
            );
    }
}
