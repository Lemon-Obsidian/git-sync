type Task = () => Promise<void>;

/**
 * git 작업을 순차적으로 실행하기 위한 큐.
 * 동시에 여러 git 명령이 실행되지 않도록 직렬화한다.
 */
export class PromiseQueue {
    private queue: Task[] = [];
    private running = false;
    private runPromise: Promise<void> = Promise.resolve();

    addTask(task: Task): void {
        this.queue.push(task);
        if (!this.running) {
            this.runPromise = this.run();
        }
    }

    /** 대기 중인 작업을 모두 취소한다. 현재 실행 중인 작업은 완료될 때까지 기다린다. */
    clear(): void {
        this.queue = [];
    }

    /** 현재 실행 중인 작업이 완료될 때까지 기다린다. */
    async waitForIdle(): Promise<void> {
        await this.runPromise;
    }

    private async run(): Promise<void> {
        this.running = true;
        while (this.queue.length > 0) {
            const task = this.queue.shift()!;
            try {
                await task();
            } catch (e) {
                console.error("[my-git-sync] 작업 실행 오류:", e);
            }
        }
        this.running = false;
    }
}
