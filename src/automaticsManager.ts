import type MyGitSync from "./main";

/**
 * 자동 커밋/동기화, 자동 Pull 타이머 관리.
 * 충돌 발생 시 pause()로 모든 타이머를 즉시 정지한다.
 */
export class AutomaticsManager {
    private commitTimer?: number;
    private pullTimer?: number;
    private paused = false;

    constructor(private readonly plugin: MyGitSync) {}

    async init(): Promise<void> {
        if (this.plugin.settings.autoCommitInterval > 0) {
            this.scheduleNextCommit();
        }
        if (this.plugin.settings.autoPullInterval > 0) {
            this.scheduleNextPull();
        }
    }

    unload(): void {
        this.clearTimers();
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

    private scheduleNextCommit(): void {
        const interval = this.plugin.settings.autoCommitInterval;
        if (interval <= 0 || this.paused) return;

        this.commitTimer = window.setTimeout(async () => {
            this.plugin.promiseQueue.addTask(() => this.plugin.commitAndSync());
            // 작업 큐에 넣은 뒤 다음 타이머 예약
            // pause()가 호출되면 아래 scheduleNextCommit은 paused 체크에서 걸린다
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
    }
}
