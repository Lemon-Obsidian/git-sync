import type MyGitSync from "./main";
import { Notice } from "obsidian";
import { ConnectionDiagModal } from "./connectionDiagModal";

export function addCommands(plugin: MyGitSync): void {
    plugin.addCommand({
        id: "pull",
        name: "pull (pull)",
        callback: () => {
            plugin.promiseQueue.addTask(() => plugin.pull());
        },
    });

    plugin.addCommand({
        id: "commit-and-push",
        name: "commit-push (commit -> push)",
        callback: () => {
            plugin.promiseQueue.addTask(() => plugin.commitAndPush());
        },
    });

    plugin.addCommand({
        id: "full-sync",
        name: "full-sync (전체 동기화, pull -> commit -> push)",
        callback: () => {
            plugin.promiseQueue.addTask(() => plugin.fullSync());
        },
    });

    plugin.addCommand({
        id: "push",
        name: "push (push)",
        callback: () => {
            plugin.promiseQueue.addTask(() => plugin.push());
        },
    });

    plugin.addCommand({
        id: "connection-diag",
        name: "연결 진단 (connection diagnostic)",
        callback: () => {
            new ConnectionDiagModal(plugin.app, plugin).open();
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
