"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const RESET_TABS_ON_LOAD = false;
function getCurrentWorkspaceId() {
    const isOperaGX = navigator.userAgent.includes("OPR/") || navigator.userAgent.includes("Opera/");
    if (!isOperaGX)
        return "default"; // workspaces are only supported on OperaGX I think
    return new Promise((resolve) => {
        console.log("Getting current workspace");
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            const workspaceId = tab.workspaceId;
            console.log(`Current workspace: ${workspaceId}`);
            resolve(workspaceId);
        });
    });
}
function packageTab(tab) {
    return {
        title: tab.title,
        url: tab.url,
        workspaceId: tab.workspaceId,
        workspaceName: tab.workspaceName,
        favIconUrl: tab.favIconUrl,
    };
}
function updateTabStorage(workspaceId, tabs) {
    return __awaiter(this, void 0, void 0, function* () {
        const oldTabStore = yield chrome.storage.local.get('TabStore');
        const newTabStore = Object.assign(Object.assign({}, (oldTabStore.TabStore || {})), { [workspaceId]: tabs });
        console.log(newTabStore);
        chrome.storage.local.set({ TabStore: newTabStore });
    });
}
function saveTabs(workspaceId) {
    return __awaiter(this, void 0, void 0, function* () {
        const tabs = yield chrome.tabs.query({});
        const packagedTabs = tabs.map((tab) => {
            const tabWorkspaceId = tab.workspaceId;
            if (tabWorkspaceId != workspaceId)
                return;
            return packageTab(tab);
        }).filter((tab) => tab != undefined);
        // store txt file in downloads
        const yearMonthDay = new Date().toISOString().split('T')[0];
        const fileName = `tabs_${workspaceId}_${yearMonthDay}.txt`;
        const fileContent = JSON.stringify(packagedTabs, null, 2);
        const blob = new Blob([fileContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        chrome.downloads.download({
            url: url,
            filename: fileName,
        });
        yield updateTabStorage(workspaceId, packagedTabs);
    });
}
document.addEventListener("DOMContentLoaded", () => {
    console.log("Loaded");
    if (RESET_TABS_ON_LOAD) {
        console.warn("Resetting TabStore Is Active; resetting...");
        chrome.storage.local.set({ TabStore: {} });
    }
    const saveButton = document.getElementById('saveButton');
    const restoreButton = document.getElementById('restoreButton');
    saveButton.addEventListener('click', () => __awaiter(void 0, void 0, void 0, function* () {
        console.log("Initiating Save");
        const currentWorkspace = yield getCurrentWorkspaceId();
        if (currentWorkspace == undefined) {
            console.error('No workspace found');
            return;
        }
        ;
        console.log("saving tabs");
        yield saveTabs(currentWorkspace);
        console.log("Tabs saved");
    }));
    // Restore from last save
    restoreButton.addEventListener('click', () => __awaiter(void 0, void 0, void 0, function* () {
        console.log("Initiating Restore");
        const currentWorkspace = yield getCurrentWorkspaceId();
        if (currentWorkspace == undefined) {
            console.error('No workspace found');
            return;
        }
        ;
        console.log("restoring tabs");
        chrome.storage.local.get('TabStore', (result) => {
            var _a;
            const tabs = (_a = result.TabStore) === null || _a === void 0 ? void 0 : _a[currentWorkspace];
            if (tabs == undefined) {
                console.warn('No tabs found for workspace');
                return;
            }
            tabs.forEach((tab) => {
                chrome.tabs.create({ url: tab.url });
            });
            console.log("Tabs restored");
        });
    }));
    // Restore from TXT
    const restoreFromTxtButton = document.getElementById('restoreFromTxtButton');
    restoreFromTxtButton.addEventListener('click', () => __awaiter(void 0, void 0, void 0, function* () {
        console.log("Initiating Restore from TXT");
        const currentWorkspace = yield getCurrentWorkspaceId();
        if (currentWorkspace == undefined) {
            console.error('No workspace found');
            return;
        }
        ;
        console.log("restoring tabs from txt");
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt';
        input.onchange = (event) => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            const file = (_a = event.target.files) === null || _a === void 0 ? void 0 : _a[0];
            if (!file) {
                console.error('No file selected');
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => __awaiter(void 0, void 0, void 0, function* () {
                var _a;
                const text = (_a = e.target) === null || _a === void 0 ? void 0 : _a.result;
                const tabs = JSON.parse(text);
                tabs.forEach((tab) => {
                    if (tab.workspaceId != currentWorkspace)
                        return;
                    chrome.tabs.create({ url: tab.url });
                });
                input.remove(); // remove the input element after use
                console.log("Tabs restored from txt");
            });
            reader.readAsText(file);
        });
        input.click();
    }));
    // tab refresher
    const refreshButton = document.getElementById('refreshButton');
    refreshButton.addEventListener('click', () => __awaiter(void 0, void 0, void 0, function* () {
        console.log("Refreshing Tabs");
        const currentWorkspace = yield getCurrentWorkspaceId();
        if (currentWorkspace == undefined) {
            console.error('No workspace found');
            return;
        }
        ;
        const tabs = yield chrome.tabs.query({});
        const refreshTabs = (tabs) => __awaiter(void 0, void 0, void 0, function* () {
            for (let i = 0; i < tabs.length; i++) {
                const tab = tabs[i];
                const tabWorkspaceId = tab.workspaceId;
                if (tabWorkspaceId != currentWorkspace)
                    continue;
                if (tab.id == undefined)
                    continue;
                chrome.tabs.reload(tab.id);
                // wait 3 seconds every 5 tabs to avoid rate limiting
                if ((i + 1) % 5 == 0) {
                    yield new Promise((resolve) => setTimeout(resolve, 3000));
                }
            }
        });
        refreshTabs(tabs);
        console.log("Tabs Refreshed");
    }));
});
