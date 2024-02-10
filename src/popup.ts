type PackagedTab = {
    title: string | undefined;
    url: string | undefined;
    workspaceName: string | undefined;
    workspaceId: string | undefined;
    favIconUrl: string | undefined;
}

const RESET_TABS_ON_LOAD = false;

function getCurrentWorkspaceId(): Promise<string | undefined> {
    return new Promise((resolve) => {
        console.log("Getting current workspace")

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            const workspaceId = (tab as any).workspaceId as string

            console.log(`Current workspace: ${workspaceId}`)
            resolve(workspaceId);
        });
    });
}

function packageTab(tab: chrome.tabs.Tab): PackagedTab {
    return {
        title: tab.title,
        url: tab.url,
        workspaceId: (tab as any).workspaceId,
        workspaceName: (tab as any).workspaceName,
        favIconUrl: tab.favIconUrl,
    };
}

async function updateTabStorage(workspaceId: string, tabs: PackagedTab[]) {
    const oldTabStore = await chrome.storage.local.get('TabStore')
    const newTabStore = { ...oldTabStore.TabStore, [workspaceId]: tabs }

    console.log(newTabStore);

    chrome.storage.local.set({ TabStore: newTabStore });
}

async function saveTabs(workspaceId: string) {
    const tabs = await chrome.tabs.query({})

    const packagedTabs = tabs.map((tab) => {
        const tabWorkspaceId = (tab as any).workspaceId;
        if (tabWorkspaceId != workspaceId) return;
        return packageTab(tab);
    }).filter((tab) => tab != undefined) as PackagedTab[];

    // store txt file in downloads
    const yearMonthDay = new Date().toISOString().split('T')[0];
    const fileName = `tabs_${workspaceId}_${yearMonthDay}.txt`;
    const fileContent = JSON.stringify(packagedTabs, null, 2);

    chrome.runtime.sendMessage({ event: "downloadtxt", text: fileContent, name: fileName });

    await updateTabStorage(workspaceId, packagedTabs);
}

document.addEventListener("DOMContentLoaded", () => {

    console.log("Loaded")

    if (RESET_TABS_ON_LOAD) {
        console.warn("Resetting TabStore Is Active; resetting...")
        chrome.storage.local.set({ TabStore: {} });
    }

    const saveButton = document.getElementById('saveButton') as HTMLButtonElement;
    const restoreButton = document.getElementById('restoreButton') as HTMLButtonElement;

    saveButton.addEventListener('click', async () => {
        console.log("Initiating Save")

        const currentWorkspace = await getCurrentWorkspaceId();
        if (currentWorkspace == undefined) {
            console.error('No workspace found');
            return;
        };

        console.log("saving tabs")
        await saveTabs(currentWorkspace);

        console.log("Tabs saved")
    });

    restoreButton.addEventListener('click', async () => {
        console.log("Initiating Restore")

        const currentWorkspace = await getCurrentWorkspaceId();
        if (currentWorkspace == undefined) {
            console.error('No workspace found');
            return;
        };

        console.log("restoring tabs")

        chrome.storage.local.get('TabStore', (result) => {
            const tabs = result.TabStore[currentWorkspace];
            if (tabs == undefined) {
                console.warn('No tabs found for workspace');
                return;
            }

            tabs.forEach((tab: PackagedTab) => {
                chrome.tabs.create({ url: tab.url });
            });

            console.log("Tabs restored")
        });
    });
})