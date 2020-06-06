async function fetchTabUrls(tabs) {
    const tabsAndUrls = []

    for (const tab of tabs) {
        const [url] = await browser.tabs.executeScript(tab.id, { code: "document.URL" });
        tabsAndUrls.push({ tab, url: new URL(url) });
    }

    return tabsAndUrls;
}

function buildTree(entries) {
    const result = [];
    const level = { result };

    entries.forEach(tabEntry => {
        const path = tabEntry.url.pathname.substring(1);
        path.split("/").reduce((reduceValue, name) => {
            if (!reduceValue[name]) {
                reduceValue[name] = { result: [] };
                reduceValue.result.push({
                    name,
                    tab: tabEntry.tab,
                    children: reduceValue[name].result
                });
            }

            return reduceValue[name];
        }, level);
    });

    return result;
}

function registerToList(tabs, node) {
    if (node.children.length == 0) {
        tabs.push(node.tab);
        return;
    }

    for (const child of node.children) {
        registerToList(tabs, child);
    }
}

async function createTabGroups() {
    const tabs = await browser.tabs.query({ currentWindow: true });
    const tabGroups = tabs.reduce((tabGroups, tab) => {
        const host = new URL(tab.url).host;

        const group = tabGroups[host] || [];
        group.push(tab);
        tabGroups[host] = group;

        return tabGroups;
    }, {});

    for (const groupId of Object.keys(tabGroups)) {
        const tabs = tabGroups[groupId];
        const tabsAndUrls = await fetchTabUrls(tabs);

        const sortedTabs = [];
        const treeList = buildTree(tabsAndUrls);
        treeList.forEach(tree => registerToList(sortedTabs, tree));

        tabGroups[groupId] = sortedTabs;
    }

    return tabGroups;
}

// Register the listener for the group tabs command.
browser.commands.onCommand.addListener(async (command) => {
    if (command !== "group-tabs") {
        return;
    }

    const tabGroups = await createTabGroups();
    const tabIdGroups = Object.values(tabGroups)
        .map(tabs => tabs.map(tab => tab.id))
        .sort((left, right) => right.length - left.length);

    // The index we want to move the tab to, this gets incremented per tab per group.
    let tabIndex = 0;

    for (const tabIds of tabIdGroups) {
        await browser.tabs.move(tabIds, { index: tabIndex });
        tabIndex += tabIds.length;
    }
});
