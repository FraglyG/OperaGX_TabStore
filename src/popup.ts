type PackagedTab = {
    title: string | undefined;
    url: string | undefined;
    workspaceName: string | undefined;
    workspaceId: string | undefined;
    favIconUrl: string | undefined;
}

const RESET_TABS_ON_LOAD = false;

function getCurrentWorkspaceId(): Promise<string | undefined> | string | undefined {
    const isOperaGX = navigator.userAgent.includes("OPR/") || navigator.userAgent.includes("Opera/");
    if (!isOperaGX) return "default"; // workspaces are only supported on OperaGX I think

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

    const blob = new Blob([fileContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    chrome.downloads.download({
        url: url,
        filename: fileName,
    });

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

    // Restore from last save
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

    // Restore from TXT
    const restoreFromTxtButton = document.getElementById('restoreFromTxtButton') as HTMLButtonElement;

    restoreFromTxtButton.addEventListener('click', async () => {
        console.log("Initiating Restore from TXT")

        const currentWorkspace = await getCurrentWorkspaceId();
        if (currentWorkspace == undefined) {
            console.error('No workspace found');
            return;
        };

        console.log("restoring tabs from txt")

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt';
        input.onchange = async (event) => {
            const file = (event.target as HTMLInputElement).files?.[0];
            if (!file) {
                console.error('No file selected');
                return;
            }

            const reader = new FileReader();
            reader.onload = async (e) => {
                const text = e.target?.result as string;
                const tabs: PackagedTab[] = JSON.parse(text);

                tabs.forEach((tab: PackagedTab) => {
                    if (tab.workspaceId != currentWorkspace) return;
                    chrome.tabs.create({ url: tab.url });
                });

                input.remove(); // remove the input element after use
                console.log("Tabs restored from txt")
            };
            reader.readAsText(file);
        };
        input.click();
    })

    // tab refresher
    const refreshButton = document.getElementById('refreshButton') as HTMLButtonElement;

    refreshButton.addEventListener('click', async () => {
        console.log("Refreshing Tabs")

        const currentWorkspace = await getCurrentWorkspaceId();
        if (currentWorkspace == undefined) {
            console.error('No workspace found');
            return;
        };

        const tabs = await chrome.tabs.query({});

        const refreshTabs = async (tabs: chrome.tabs.Tab[]) => {
            for (let i = 0; i < tabs.length; i++) {
                const tab = tabs[i];
                const tabWorkspaceId = (tab as any).workspaceId;

                if (tabWorkspaceId != currentWorkspace) continue;
                if (tab.id == undefined) continue;

                chrome.tabs.reload(tab.id);

                // wait 3 seconds every 5 tabs to avoid rate limiting
                if ((i + 1) % 5 == 0) {
                    await new Promise((resolve) => setTimeout(resolve, 3000));
                }
            }
        };

        refreshTabs(tabs);

        console.log("Tabs Refreshed")
    });
})