"use strict";
chrome.runtime.onMessage.addListener((arg, sender, sendResponse) => {
    const event = arg.event;
    if (!event) {
        console.warn("No event provided");
        return;
    }
    ;
    if (event == "downloadtxt") {
        const text = arg.text;
        if (!text) {
            console.warn("No text provided");
            return;
        }
        ;
        const name = arg.name;
        if (!name) {
            console.warn("No name provided");
            return;
        }
        ;
        const blob = new Blob([text], { type: 'text/plain' });
        const reader = new FileReader();
        reader.onloadend = () => {
            const url = reader.result;
            chrome.downloads.download({
                url: url,
                filename: name,
            });
        };
        reader.readAsDataURL(blob);
    }
});
