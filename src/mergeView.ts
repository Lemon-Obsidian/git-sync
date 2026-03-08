import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import { EditorState } from "@codemirror/state";
import { EditorView, showPanel } from "@codemirror/view";
import { MergeView as CMergeView } from "@codemirror/merge";
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
 * 좌우 분할 병합 충돌 해결 뷰.
 *
 * @codemirror/merge의 MergeView를 사용한다.
 * - 좌(a): 로컬(ours) — 편집 가능, 최종 결과물
 * - 우(b): 원격(theirs) — 읽기 전용, 참조용
 * - 우측 청크의 "Accept" 버튼으로 원격 변경을 로컬에 적용 가능
 */
export class MergeView extends ItemView {
  private conflicts: ConflictFile[] = [];
  private currentIndex = 0;
  private resolvedContents: Map<string, string> = new Map();
  private cmMergeView: CMergeView | null = null;
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
    const titleLeft = titleRow.createDiv({ cls: "my-git-sync-merge-title-left" });
    titleLeft.createDiv({ cls: "my-git-sync-merge-title-badge", text: "CONFLICT" });
    titleLeft.createEl("h4", { text: "병합 충돌 해결" });

    const titleRight = titleRow.createDiv({ cls: "my-git-sync-merge-title-right" });
    if (this.conflicts.length > 1) {
      titleRight.createDiv({
        cls: "my-git-sync-merge-counter",
        text: `${this.currentIndex + 1} / ${this.conflicts.length} 파일`,
      });
    }

    header.createDiv({
      cls: "my-git-sync-merge-filepath",
      text: current.vaultPath,
    });

    // ── 에디터 ────────────────────────────────────────────────
    const editorContainer = contentEl.createDiv({ cls: "my-git-sync-merge-editor" });

    // ── 하단 버튼 ─────────────────────────────────────────────
    const footer = contentEl.createDiv({ cls: "my-git-sync-merge-footer" });

    const navGroup = footer.createDiv({ cls: "my-git-sync-merge-nav" });
    const prevBtn = navGroup.createEl("button", { text: "← 이전" });
    prevBtn.disabled = this.currentIndex === 0;
    prevBtn.addEventListener("click", () => this.navigate(this.currentIndex - 1));

    const nextBtn = navGroup.createEl("button", { text: "다음 →" });
    nextBtn.disabled = this.currentIndex === this.conflicts.length - 1;
    nextBtn.addEventListener("click", () => this.navigate(this.currentIndex + 1));

    const resolveBtn = footer.createEl("button", {
      text: "✓ 해결 완료 및 커밋",
      cls: "mod-cta my-git-sync-resolve-btn",
    });
    resolveBtn.addEventListener("click", () => void this.finish());

    // ── CMergeView 생성 ────────────────────────────────────────
    let oursDoc: string;
    let theirsDoc: string;

    if (this.resolvedContents.has(current.vaultPath)) {
      oursDoc = this.resolvedContents.get(current.vaultPath)!;
      theirsDoc = parseConflictMarkers(current.content).theirs;
    } else {
      const parsed = parseConflictMarkers(current.content);
      oursDoc = parsed.ours;
      theirsDoc = parsed.theirs;
    }

    this.cmMergeView = new CMergeView({
      a: {
        doc: oursDoc,
        extensions: [
          EditorView.lineWrapping,
          showPanel.of(() => {
            const dom = document.createElement("div");
            dom.className = "my-git-sync-panel-label my-git-sync-panel-label-local";
            dom.innerHTML = `<span class="my-git-sync-panel-label-dot"></span>로컬 <span class="my-git-sync-panel-label-sub">(내 변경사항 · 편집 가능)</span>`;
            return { dom, top: true };
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              this.updateResolveBtnState(resolveBtn);
            }
          }),
        ],
      },
      b: {
        doc: theirsDoc,
        extensions: [
          EditorView.lineWrapping,
          showPanel.of(() => {
            const dom = document.createElement("div");
            dom.className = "my-git-sync-panel-label my-git-sync-panel-label-remote";
            dom.innerHTML = `<span class="my-git-sync-panel-label-dot"></span>원격 <span class="my-git-sync-panel-label-sub">(받아온 변경사항 · 읽기 전용)</span>`;
            return { dom, top: true };
          }),
          EditorState.readOnly.of(true),
        ],
      },
      parent: editorContainer,
      highlightChanges: true,
      gutter: true,
      revertControls: "b-to-a",
    });

    this.updateResolveBtnState(resolveBtn);

    this.conflictCheckInterval = window.setInterval(() => {
      this.updateResolveBtnState(resolveBtn);
    }, 800);
  }

  private updateResolveBtnState(btn: HTMLButtonElement): void {
    if (!this.cmMergeView) return;
    const doc = this.cmMergeView.a.state.doc.toString();
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
    if (!this.cmMergeView) return;
    const current = this.conflicts[this.currentIndex];
    this.resolvedContents.set(
      current.vaultPath,
      this.cmMergeView.a.state.doc.toString()
    );
  }

  private async finish(): Promise<void> {
    if (!this.cmMergeView) return;

    const doc = this.cmMergeView.a.state.doc.toString();
    if (doc.includes("<<<<<<<") || doc.includes(">>>>>>>")) {
      new Notice("아직 충돌 마커가 남아있습니다. 모두 해결 후 시도하세요.");
      return;
    }

    this.saveCurrentContent();

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
    this.cmMergeView?.destroy();
    this.cmMergeView = null;
  }
}
