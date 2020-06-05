// TODO: Find a good way to sort the tabs within a group.
async function createTabGroups() {
    const tabs = await browser.tabs.query({ currentWindow: true });
    return tabs.reduce((tabGroups, tab) => {
        const host = new URL(tab.url).host;

        const group = tabGroups[host] || [];
        group.push(tab);
        tabGroups[host] = group;

        return tabGroups;
    }, {});
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
