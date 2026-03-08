import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { unifiedMergeView } from "@codemirror/merge";
import { MERGE_VIEW_TYPE } from "./constants";
import type MyGitSync from "./main";
import type { ConflictFile } from "./types";

/**
 * git 충돌 마커(<<<<<<< / ======= / >>>>>>>) 파싱 결과
 */
interface ParsedConflict {
    ours: string;    // HEAD 측 내용만 남긴 전체 문서
    theirs: string;  // 원격 측 내용만 남긴 전체 문서
}

/**
 * git 충돌 마커를 파싱하여 ours / theirs 문서를 분리한다.
 * 파싱 실패(마커 없음)이면 null 반환.
 */
function parseConflictMarkers(content: string): ParsedConflict {
    const ourLines: string[] = [];
    const theirLines: string[] = [];
    let state: "normal" | "ours" | "theirs" = "normal";

    for (const line of content.split("\n")) {
        if (line.startsWith("<<<<<<<")) {
            state = "ours";
        } else if (line.startsWith("=======") && state === "ours") {
            state = "theirs";
        } else if (line.startsWith(">>>>>>>") && state === "theirs") {
            state = "normal";
        } else {
            if (state === "normal") {
                ourLines.push(line);
                theirLines.push(line);
            } else if (state === "ours") {
                ourLines.push(line);
            } else {
                theirLines.push(line);
            }
        }
    }

    return { ours: ourLines.join("\n"), theirs: theirLines.join("\n") };
}

/**
 * 3-way 병합 충돌 해결 뷰.
 *
 * @codemirror/merge의 unifiedMergeView를 사용한다.
 * - original(theirs)을 기준으로, ours 문서를 편집하여 최종본을 만든다.
 * - 각 청크에서 "Accept ours" / "Accept theirs" 버튼으로 선택 가능.
 * - 마지막으로 남은 충돌 마커가 없으면 "해결 완료" 버튼 활성화.
 */
export class MergeView extends ItemView {
    private conflicts: ConflictFile[] = [];
    private currentIndex = 0;
    private resolvedContents: Map<string, string> = new Map();
    private editor: EditorView | null = null;
    private conflictCheckInterval?: number;

    constructor(leaf: WorkspaceLeaf, private readonly plugin: MyGitSync) {
        super(leaf);
    }

    getViewType(): string { return MERGE_VIEW_TYPE; }
    getDisplayText(): string { return "충돌 해결"; }
    getIcon(): string { return "git-merge"; }

    async onOpen(): Promise<void> { this.render(); }
    async onClose(): Promise<void> { this.destroyEditor(); }

    setConflicts(conflicts: ConflictFile[]): void {
        this.conflicts = conflicts;
        this.currentIndex = 0;
        this.resolvedContents = new Map();
        this.render();
    }

    private render(): void {
        const { contentEl } = this;
        contentEl.empty();
        this.destroyEditor();
        contentEl.addClass("my-git-sync-merge-view");

        if (this.conflicts.length === 0) {
            contentEl.createEl("p", { text: "해결할 충돌이 없습니다." });
            return;
        }

        const current = this.conflicts[this.currentIndex];

        // ── 헤더 ──────────────────────────────────────────────────
        const header = contentEl.createDiv({ cls: "my-git-sync-merge-header" });

        const titleRow = header.createDiv({ cls: "my-git-sync-merge-title-row" });
        titleRow.createEl("h4", { text: "⚠️ 병합 충돌 해결" });
        titleRow.createEl("span", {
            text: `${this.currentIndex + 1} / ${this.conflicts.length}`,
            cls: "my-git-sync-merge-counter",
        });

        header.createEl("div", {
            cls: "my-git-sync-merge-filepath",
            text: current.vaultPath,
        });

        header.createEl("p", {
            cls: "my-git-sync-merge-hint",
            text: "왼쪽: 원격(theirs) 기준 — 각 청크에서 Accept ours / Accept theirs를 선택하거나 직접 편집하세요.",
        });

        // ── 에디터 ────────────────────────────────────────────────
        const editorContainer = contentEl.createDiv({ cls: "my-git-sync-merge-editor" });

        // ── 하단 버튼 (resolveBtn을 먼저 선언, 에디터 updateListener에서 참조) ──
        const footer = contentEl.createDiv({ cls: "my-git-sync-merge-footer" });

        const prevBtn = footer.createEl("button", { text: "◀ 이전" });
        prevBtn.disabled = this.currentIndex === 0;
        prevBtn.addEventListener("click", () => this.navigate(this.currentIndex - 1));

        const nextBtn = footer.createEl("button", { text: "다음 ▶" });
        nextBtn.disabled = this.currentIndex === this.conflicts.length - 1;
        nextBtn.addEventListener("click", () => this.navigate(this.currentIndex + 1));

        const resolveBtn = footer.createEl("button", {
            text: "해결 완료 및 커밋",
            cls: "mod-cta",
        });
        resolveBtn.addEventListener("click", () => void this.finish());

        // ── CodeMirror 에디터 ──────────────────────────────────────
        // 이미 해결된 파일이면 저장된 내용, 아니면 충돌 마커 제거한 ours 사용
        let initialDoc: string;
        let original: string;

        if (this.resolvedContents.has(current.vaultPath)) {
            // 이미 편집한 내용 복원
            initialDoc = this.resolvedContents.get(current.vaultPath)!;
            original = parseConflictMarkers(current.content).theirs;
        } else {
            const parsed = parseConflictMarkers(current.content);
            initialDoc = parsed.ours;
            original = parsed.theirs;
        }

        this.editor = new EditorView({
            state: EditorState.create({
                doc: initialDoc,
                extensions: [
                    EditorView.lineWrapping,
                    unifiedMergeView({ original, mergeControls: true }),
                    EditorView.updateListener.of((update) => {
                        if (update.docChanged) {
                            this.updateResolveBtnState(resolveBtn);
                        }
                    }),
                ],
            }),
            parent: editorContainer,
        });

        this.updateResolveBtnState(resolveBtn);

        // acceptChunk/rejectChunk 클릭은 docChanged를 발생시키므로 updateListener로 충분.
        // 혹시 누락되는 경우 대비해 짧은 주기로도 체크.
        this.conflictCheckInterval = window.setInterval(() => {
            this.updateResolveBtnState(resolveBtn);
        }, 800);
    }

    /**
     * 현재 doc에 충돌 마커가 남아있지 않으면 버튼 활성화.
     * unifiedMergeView는 내부적으로 마커를 제거하지 않으므로
     * 원본 마커 없이 편집된 doc을 기준으로 확인한다.
     */
    private updateResolveBtnState(btn: HTMLButtonElement): void {
        if (!this.editor) return;
        const doc = this.editor.state.doc.toString();
        const hasMarkers = doc.includes("<<<<<<<") || doc.includes(">>>>>>>");
        btn.disabled = hasMarkers;
        btn.title = hasMarkers
            ? "아직 충돌 마커가 남아있습니다"
            : "클릭하면 저장 후 커밋합니다";
    }

    private navigate(newIndex: number): void {
        if (newIndex < 0 || newIndex >= this.conflicts.length) return;
        this.saveCurrentContent();
        this.currentIndex = newIndex;
        this.render();
    }

    private saveCurrentContent(): void {
        if (!this.editor) return;
        const current = this.conflicts[this.currentIndex];
        this.resolvedContents.set(current.vaultPath, this.editor.state.doc.toString());
    }

    private async finish(): Promise<void> {
        if (!this.editor) return;

        const doc = this.editor.state.doc.toString();
        if (doc.includes("<<<<<<<") || doc.includes(">>>>>>>")) {
            new Notice("아직 충돌 마커가 남아있습니다. 모두 해결 후 시도하세요.");
            return;
        }

        this.saveCurrentContent();

        // 아직 방문하지 않은(미해결) 파일 확인
        const unvisited = this.conflicts.filter(
            (c) => !this.resolvedContents.has(c.vaultPath)
        );
        if (unvisited.length > 0) {
            new Notice(
                `${unvisited.length}개의 파일이 아직 확인되지 않았습니다. ` +
                "다음 파일로 이동하여 해결하세요."
            );
            this.navigate(
                this.conflicts.findIndex((c) => !this.resolvedContents.has(c.vaultPath))
            );
            return;
        }

        const resolved: ConflictFile[] = this.conflicts.map((c) => ({
            ...c,
            content: this.resolvedContents.get(c.vaultPath) ?? c.content,
        }));

        await this.plugin.onConflictResolved(resolved);
    }

    private destroyEditor(): void {
        if (this.conflictCheckInterval !== undefined) {
            window.clearInterval(this.conflictCheckInterval);
            this.conflictCheckInterval = undefined;
        }
        this.editor?.destroy();
        this.editor = null;
    }
}
