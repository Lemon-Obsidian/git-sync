import { Notice } from "obsidian";
import type MyGitSync from "./main";

export function addCommands(plugin: MyGitSync): void {
    plugin.addCommand({
        id: "pull",
        name: "풀 (Pull)",
        callback: () => {
            plugin.promiseQueue.addTask(() => plugin.pull());
        },
    });

    plugin.addCommand({
        id: "push",
        name: "푸시 (Push)",
        callback: () => {
            plugin.promiseQueue.addTask(() => plugin.push());
        },
    });

    plugin.addCommand({
        id: "commit",
        name: "커밋 (Commit)",
        callback: () => {
            plugin.promiseQueue.addTask(() => plugin.commit());
        },
    });

    plugin.addCommand({
        id: "commit-and-sync",
        name: "커밋하고 동기화",
        callback: () => {
            plugin.promiseQueue.addTask(() => plugin.commitAndSync());
        },
    });

    plugin.addCommand({
        id: "toggle-automatics",
        name: "자동 루틴 일시정지 / 재개",
        callback: () => {
            if (plugin.automaticsManager.isPaused()) {
                plugin.automaticsManager.resume();
                new Notice("▶ 자동 루틴 재개");
            } else {
                plugin.automaticsManager.pause();
                new Notice("⏸ 자동 루틴 일시정지");
            }
            plugin.statusBar?.update();
        },
    });
}
