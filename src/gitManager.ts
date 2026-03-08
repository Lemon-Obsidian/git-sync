import { existsSync, readFileSync } from "fs";
import { FileSystemAdapter, Notice, moment } from "obsidian";
import simpleGit from "simple-git";
import type { SimpleGit } from "simple-git";
import type MyGitSync from "./main";
import type { ConflictFile } from "./types";

export class GitManager {
    private git!: SimpleGit;
    private repoPath!: string;

    constructor(private readonly plugin: MyGitSync) {}

    async init(): Promise<void> {
        const adapter = this.plugin.app.vault.adapter;
        if (!(adapter instanceof FileSystemAdapter)) {
            throw new Error("데스크탑 환경에서만 사용 가능합니다.");
        }

        const vaultPath = adapter.getBasePath();
        this.repoPath = this.plugin.settings.basePath
            ? `${vaultPath}/${this.plugin.settings.basePath}`
            : vaultPath;

        this.git = simpleGit({
            baseDir: this.repoPath,
            binary: this.plugin.settings.gitExecutablePath || "git",
            maxConcurrentProcesses: 1,
        });
    }

    /** git 저장소가 유효한지 확인 */
    async isRepo(): Promise<boolean> {
        try {
            await this.git.status();
            return true;
        } catch {
            return false;
        }
    }

    /** 현재 브랜치명 반환. detached HEAD면 null 반환 */
    async getCurrentBranch(): Promise<string | null> {
        try {
            const status = await this.git.status();
            return status.current ?? null;
        } catch {
            return null;
        }
    }

    /** rebase 진행 중인지 확인 (.git/rebase-merge 또는 .git/rebase-apply 디렉토리 존재 여부) */
    isRebasing(): boolean {
        return (
            existsSync(`${this.repoPath}/.git/rebase-merge`) ||
            existsSync(`${this.repoPath}/.git/rebase-apply`)
        );
    }

    /** 변경사항이 있는지 확인 */
    async hasChanges(): Promise<boolean> {
        const status = await this.git.status();
        return !status.isClean();
    }

    /** 충돌 파일 목록 반환 */
    async getConflicts(): Promise<ConflictFile[]> {
        const status = await this.git.status();
        const result: ConflictFile[] = [];

        for (const repoPath of status.conflicted) {
            const vaultPath = this.plugin.settings.basePath
                ? `${this.plugin.settings.basePath}/${repoPath}`
                : repoPath;

            let content: string | null = null;

            // 1차: vault adapter
            try {
                content = await this.plugin.app.vault.adapter.read(vaultPath);
            } catch {
                // 2차: 파일시스템 직접 읽기
                try {
                    content = readFileSync(`${this.repoPath}/${repoPath}`, "utf8");
                } catch (e2) {
                    console.error(`[my-git-sync] 충돌 파일 읽기 실패: ${repoPath}`, e2);
                }
            }

            if (content !== null) {
                result.push({ vaultPath, repoPath, content });
            }
        }

        return result;
    }

    /** 변경된 파일 수 반환 */
    async getChangedFilesCount(): Promise<number> {
        const status = await this.git.status();
        return status.files.length;
    }

    /** 전체 변경사항 스테이징 */
    async stageAll(): Promise<void> {
        await this.git.add(".");
    }

    /** 특정 파일 스테이징 */
    async stageFile(repoPath: string): Promise<void> {
        await this.git.add(repoPath);
    }

    /** 커밋 */
    async commit(message: string): Promise<void> {
        await this.git.commit(message);
    }

    /**
     * Pull.
     * 충돌 발생 시 simple-git이 예외를 던진다.
     * 호출부에서 catch 후 getConflicts()로 충돌 파일을 확인해야 한다.
     */
    async pull(): Promise<void> {
        const defaultBranch = this.plugin.settings.defaultBranch;

        // rebase 진행 중이면 abort 후 기본 브랜치로 복귀
        if (this.isRebasing()) {
            new Notice(`⚠️ Rebase 진행 중 감지 — 중단 후 '${defaultBranch}' 브랜치로 복귀합니다.`);
            await this.git.raw(["rebase", "--abort"]);
            await this.git.checkout(defaultBranch);
        } else {
            // detached HEAD 상태면 기본 브랜치로 복귀 (null 또는 "HEAD" 문자열 모두 처리)
            const currentBranch = await this.getCurrentBranch();
            if (!currentBranch || currentBranch === "HEAD") {
                new Notice(`⚠️ Detached HEAD 감지 — '${defaultBranch}' 브랜치로 복귀합니다.`);
                await this.git.checkout(defaultBranch);
            }
        }

        await this.git.raw(["fetch", "origin"]);
        await this.git.raw(["rebase", `origin/${defaultBranch}`]);
    }

    /** Rebase 계속 진행 (충돌 해결 후 호출) */
    async rebaseContinue(): Promise<void> {
        await this.git.raw(["-c", "core.editor=true", "rebase", "--continue"]);
    }

    /** Push */
    async push(): Promise<void> {
        const branch = await this.getCurrentBranch();
        const target = (branch && branch !== "HEAD")
            ? branch
            : this.plugin.settings.defaultBranch;
        await this.git.push("origin", target);
    }

    /** 마지막 커밋 시각 */
    async getLastCommitTime(): Promise<Date | undefined> {
        try {
            const log = await this.git.log({ maxCount: 1 });
            if (log.latest) {
                return new Date(log.latest.date);
            }
        } catch {
            // 커밋이 없는 저장소
        }
        return undefined;
    }

    /** 원격에 아직 올리지 않은 커밋 수 */
    async getUnpushedCount(): Promise<number> {
        try {
            const log = await this.git.log(["@{u}..HEAD"]);
            return log.total;
        } catch {
            return 0;
        }
    }

    /** 커밋 메시지 템플릿의 {{date}} 치환 */
    formatCommitMessage(template: string): string {
        return template.replace("{{date}}", moment().format("YYYY-MM-DD HH:mm:ss"));
    }
}
