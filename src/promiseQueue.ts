type Task = () => Promise<void>;

/**
 * git 작업을 순차적으로 실행하기 위한 큐.
 * 동시에 여러 git 명령이 실행되지 않도록 직렬화한다.
 */
export class PromiseQueue {
    private queue: Task[] = [];
    private running = false;

    addTask(task: Task): void {
        this.queue.push(task);
        if (!this.running) {
            void this.run();
        }
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
