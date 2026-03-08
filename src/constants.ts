import type { PluginSettings } from "./types";

export const DEFAULT_SETTINGS: PluginSettings = {
    autoPullOnBoot: true,
    autoCommitInterval: 5,
    autoPullInterval: 10,
    commitMessage: "vault 백업: {{date}}",
    syncMethod: "merge",
    showStatusBar: true,
    showChangedFilesCount: true,
    basePath: "",
    gitExecutablePath: "",
};

export const MERGE_VIEW_TYPE = "my-git-sync-merge-view";
