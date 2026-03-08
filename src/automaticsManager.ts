import { Notice } from "obsidian";
import type MyGitSync from "./main";

/**
 * 자동 커밋/동기화, 자동 Pull 타이머 관리.
 * - 주기적 자동 커밋 & Pull 타이머
 * - 파일 변경(create/modify/delete) 감지 후 debounce 커밋
 * - 종료 시(beforeunload) best-effort commit & push
 */
export class AutomaticsManager {
  private commitTimer?: number;
  private pullTimer?: number;
  private debounceTimer?: number;
  private paused = false;
  private beforeUnloadHandler?: (e: BeforeUnloadEvent) => void;

  constructor(private readonly plugin: MyGitSync) {}

  async init(): Promise<void> {
    if (this.plugin.settings.autoCommitInterval > 0) {
      this.scheduleNextCommit();
    }
    if (this.plugin.settings.autoPullInterval > 0) {
      this.scheduleNextPull();
    }
    this.registerVaultHooks();
    this.registerBeforeUnload();
  }

  unload(): void {
    this.clearTimers();
    if (this.beforeUnloadHandler) {
      window.removeEventListener("beforeunload", this.beforeUnloadHandler);
      this.beforeUnloadHandler = undefined;
    }
  }

  /** 충돌 감지 시 즉시 호출 - 모든 자동 루틴 정지 */
  pause(): void {
    this.paused = true;
    this.clearTimers();
  }

  /** 충돌 해결 후 자동 루틴 재개 */
  resume(): void {
    this.paused = false;
    this.scheduleNextCommit();
    this.scheduleNextPull();
  }

  isPaused(): boolean {
    return this.paused;
  }

  /** 설정 변경 시 타이머 재설정 */
  reload(): void {
    if (this.paused) return;
    this.clearTimers();
    this.scheduleNextCommit();
    this.scheduleNextPull();
  }

  // ── 파일 변경 감지 ─────────────────────────────────────────────

  private registerVaultHooks(): void {
    const trigger = () => this.onVaultChange();
    this.plugin.registerEvent(this.plugin.app.vault.on("create", trigger));
    this.plugin.registerEvent(this.plugin.app.vault.on("modify", trigger));
    this.plugin.registerEvent(this.plugin.app.vault.on("delete", trigger));
    this.plugin.registerEvent(this.plugin.app.vault.on("rename", trigger));
  }

  private onVaultChange(): void {
    const delay = this.plugin.settings.debounceDelay;
    if (delay <= 0 || this.paused) return;

    if (this.debounceTimer !== undefined) {
      window.clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = window.setTimeout(() => {
      this.debounceTimer = undefined;
      this.plugin.promiseQueue.addTask(() => this.plugin.commitAndSync());
    }, delay * 1000);
  }

  // ── 종료 시 best-effort commit & push ─────────────────────────

  private registerBeforeUnload(): void {
    this.beforeUnloadHandler = (e: BeforeUnloadEvent) => {
      // 동기적으로 즉시 차단 (비동기 콜백 안에서 호출하면 Electron이 무시함)
      e.preventDefault();
      e.returnValue = "";

      this.plugin.gitManager.hasChanges().then((hasChanges) => {
        if (this.beforeUnloadHandler) {
          window.removeEventListener("beforeunload", this.beforeUnloadHandler);
          this.beforeUnloadHandler = undefined;
        }

        if (!hasChanges) {
          window.close();
          return;
        }

        new Notice("⏳ 종료 전 변경사항을 저장하는 중...", 0);

        this.plugin.gitManager
          .stageAll()
          .then(() => {
            const msg = this.plugin.gitManager.formatCommitMessage(
              this.plugin.settings.commitMessage
            );
            return this.plugin.gitManager.commit(msg);
          })
          .then(() => {
            new Notice("✓ 커밋 완료, Push 중...", 0);
            return this.plugin.gitManager.push();
          })
          .then(() => {
            new Notice("✓ Push 완료. 종료합니다.");
          })
          .catch((err) => {
            new Notice(`⚠️ 종료 저장 실패: ${err}`);
          })
          .finally(() => {
            window.close();
          });
      });
    };

    window.addEventListener("beforeunload", this.beforeUnloadHandler);
  }

  // ── 내부 ──────────────────────────────────────────────────────

  private scheduleNextCommit(): void {
    const interval = this.plugin.settings.autoCommitInterval;
    if (interval <= 0 || this.paused) return;

    this.commitTimer = window.setTimeout(async () => {
      this.plugin.promiseQueue.addTask(() => this.plugin.commitAndSync());
      this.scheduleNextCommit();
    }, interval * 60_000);
  }

  private scheduleNextPull(): void {
    const interval = this.plugin.settings.autoPullInterval;
    if (interval <= 0 || this.paused) return;

    this.pullTimer = window.setTimeout(async () => {
      this.plugin.promiseQueue.addTask(() => this.plugin.pull());
      this.scheduleNextPull();
    }, interval * 60_000);
  }

  private clearTimers(): void {
    if (this.commitTimer !== undefined) {
      window.clearTimeout(this.commitTimer);
      this.commitTimer = undefined;
    }
    if (this.pullTimer !== undefined) {
      window.clearTimeout(this.pullTimer);
      this.pullTimer = undefined;
    }
    if (this.debounceTimer !== undefined) {
      window.clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
  }
}
