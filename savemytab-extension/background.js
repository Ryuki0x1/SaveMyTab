/**
 * SaveMyTab: Universal Cross-Browser Tab Unloader & Memory Saver
 * Background Service Worker / Script
 */

// Cross-browser API shim
const extApi = (typeof browser !== 'undefined' && browser.tabs) ? browser : chrome;
const actionApi = extApi.action || extApi.browserAction;
const menusApi = extApi.contextMenus || extApi.menus;

// Default configuration settings
const DEFAULT_SETTINGS = {
  timeoutMinutes: 15,          // Inactive duration before discarding
  protectPinned: true,         // Skip pinned tabs
  protectAudio: true,          // Skip tabs currently playing audio
  protectActive: true,         // Never discard active tab
  alwaysPauseInPlace: false,   // If true, always pause in-place without switching tabs
  whitelist: [
    'docs.google.com',
    'mail.google.com',
    'music.youtube.com',
    'teams.microsoft.com',
    'slack.com'
  ],
  checkIntervalMinutes: 1,     // How often the background alarm evaluates tabs
  fallbackEnabled: true,       // Use pause fallback if browser lacks native tabs.discard
  showBadgeCount: true,        // Show count of discarded tabs on the extension badge
  stats: {
    totalDiscardedCount: 0,
    estimatedRamSavedMb: 0,    // ~150MB average RAM per discarded tab
    lastCheckTimestamp: Date.now()
  }
};

// In-memory tracker for tab access timestamps
const tabAccessMap = new Map();
let lastActiveTabId = null;

// Per-Tab Custom Overrides: tabId -> { isExcluded: boolean, customTimeoutMinutes: number | null }
let tabCustomSettings = new Map();

/**
 * Feature Detection: Check if current browser supports native tab discarding
 */
function hasNativeDiscard() {
  return typeof extApi?.tabs?.discard === 'function';
}

/**
 * Check if a tab is already discarded or paused in fallback mode
 */
function isTabUnloaded(tab) {
  if (!tab) return false;
  if (tab.discarded) return true;
  if (tab.url && tab.url.includes('fallback/paused.html')) return true;
  return false;
}

/**
 * Robust helper to query tabs handling both Promise and Callback styles
 */
function queryTabs(queryInfo) {
  return new Promise((resolve) => {
    let finished = false;
    const safeResolve = (res) => {
      if (!finished) {
        finished = true;
        resolve(res || []);
      }
    };

    try {
      const p = extApi.tabs.query(queryInfo, (tabs) => {
        if (!extApi.runtime.lastError && tabs) {
          safeResolve(tabs);
        } else {
          safeResolve([]);
        }
      });
      if (p && typeof p.then === 'function') {
        p.then(safeResolve).catch(() => safeResolve([]));
      }
    } catch (e) {
      safeResolve([]);
    }
  });
}

/**
 * Load stored settings or initialize with defaults
 */
async function getSettings() {
  return new Promise((resolve) => {
    extApi.storage.sync.get('settings', (result) => {
      if (extApi.runtime.lastError || !result || !result.settings) {
        extApi.storage.local.get('settings', (localResult) => {
          if (!localResult || !localResult.settings) {
            resolve({ ...DEFAULT_SETTINGS });
          } else {
            resolve({ ...DEFAULT_SETTINGS, ...localResult.settings });
          }
        });
      } else {
        resolve({ ...DEFAULT_SETTINGS, ...result.settings });
      }
    });
  });
}

/**
 * Save updated settings
 */
async function saveSettings(newSettings) {
  return new Promise((resolve) => {
    extApi.storage.sync.set({ settings: newSettings }, () => {
      if (extApi.runtime.lastError) {
        extApi.storage.local.set({ settings: newSettings }, () => resolve(true));
      } else {
        resolve(true);
      }
    });
  });
}

/**
 * Load per-tab custom settings from session/local storage
 */
async function loadTabOverrides() {
  return new Promise((resolve) => {
    const storageArea = extApi.storage.session || extApi.storage.local;
    if (!storageArea) {
      resolve();
      return;
    }
    storageArea.get('tabCustomSettings', (result) => {
      if (result && result.tabCustomSettings) {
        tabCustomSettings = new Map(
          Object.entries(result.tabCustomSettings).map(([k, v]) => [Number(k), v])
        );
      }
      resolve();
    });
  });
}

/**
 * Persist per-tab custom settings to session/local storage
 */
async function saveTabOverrides() {
  const obj = {};
  for (const [k, v] of tabCustomSettings.entries()) {
    obj[k] = v;
  }
  const storageArea = extApi.storage.session || extApi.storage.local;
  if (!storageArea) return;
  return new Promise((resolve) => {
    storageArea.set({ tabCustomSettings: obj }, () => resolve());
  });
}

/**
 * Check if a URL matches any domain in the whitelist
 */
function isUrlWhitelisted(url, whitelist) {
  if (!url) return true; // Internal or blank
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    
    // Ignore internal browser pages
    const protocol = parsed.protocol;
    if (['chrome:', 'edge:', 'about:', 'brave:', 'opera:', 'chrome-extension:', 'moz-extension:'].includes(protocol)) {
      return true;
    }

    return whitelist.some(domain => {
      const clean = domain.trim().toLowerCase();
      if (!clean) return false;
      return hostname === clean || hostname.endsWith('.' + clean);
    });
  } catch (e) {
    return true; // Ignore invalid URLs
  }
}

/**
 * Direct native discard call handling both Firefox and Chromium properly
 */
async function discardTabNative(tabId) {
  // Firefox: browser.tabs.discard takes ONLY tabIds and returns a Promise
  if (typeof browser !== 'undefined' && browser.tabs && typeof browser.tabs.discard === 'function') {
    try {
      await browser.tabs.discard(tabId);
      return true;
    } catch (e) {
      console.warn('[SaveMyTab] browser.tabs.discard failed:', e);
    }
  }

  // Chromium: chrome.tabs.discard(tabId, callback) or Promise
  if (typeof chrome !== 'undefined' && chrome.tabs && typeof chrome.tabs.discard === 'function') {
    return new Promise((resolve) => {
      try {
        const res = chrome.tabs.discard(tabId, () => {
          if (chrome.runtime.lastError) {
            resolve(false);
          } else {
            resolve(true);
          }
        });
        if (res && typeof res.then === 'function') {
          res.then(() => resolve(true)).catch(() => resolve(false));
        }
      } catch (e) {
        resolve(false);
      }
    });
  }

  return false;
}

/**
 * Discard / unload a single tab using the best available browser feature
 */
async function unloadTab(tab) {
  if (!tab || !tab.id) return false;

  // 1. Native tabs.discard() feature
  if (hasNativeDiscard()) {
    const success = await discardTabNative(tab.id);
    if (success) {
      return true;
    }
  }

  // 2. Fallback for browsers lacking tabs.discard or when native discard cannot be applied
  const settings = await getSettings();
  if (settings.fallbackEnabled && tab.url && !tab.url.includes('fallback/paused.html')) {
    const pauseUrl = extApi.runtime.getURL(
      `fallback/paused.html?url=${encodeURIComponent(tab.url)}&title=${encodeURIComponent(tab.title || '')}&favicon=${encodeURIComponent(tab.favIconUrl || '')}`
    );
    return new Promise((resolve) => {
      extApi.tabs.update(tab.id, { url: pauseUrl }, () => resolve(true));
    });
  }

  return false;
}

/**
 * Periodically evaluate tabs across all windows and discard inactive ones
 */
async function evaluateTabs(forceInactive = false) {
  await loadTabOverrides();
  const settings = await getSettings();
  const now = Date.now();

  const tabs = await queryTabs({});
  if (!tabs || tabs.length === 0) {
    return { checked: 0, unloaded: 0, activeDiscarded: 0 };
  }

  let unloadedCount = 0;
  let activeDiscardedCount = 0;

  for (const tab of tabs) {
    // Count already discarded tabs
    if (isTabUnloaded(tab)) {
      activeDiscardedCount++;
      continue;
    }

    // Feature 2: Check per-tab exclusion override
    const tabOverride = tabCustomSettings.get(tab.id);
    if (tabOverride?.isExcluded) {
      // Explicitly excluded from suspension by user
      continue;
    }

    // Global safety exclusions:
    if (settings.protectActive && tab.active) continue;
    if (settings.protectPinned && tab.pinned) continue;
    if (settings.protectAudio && tab.audible) continue;
    if (isUrlWhitelisted(tab.url, settings.whitelist)) continue;

    // Inactivity evaluation
    let lastActive = tab.lastAccessed || tabAccessMap.get(tab.id);
    if (!lastActive) {
      lastActive = now;
      tabAccessMap.set(tab.id, now);
    }

    // Feature 1: Check per-tab fixed timer override
    const tabTimeoutMinutes = (tabOverride?.customTimeoutMinutes != null && tabOverride.customTimeoutMinutes > 0)
      ? tabOverride.customTimeoutMinutes
      : settings.timeoutMinutes;
    const tabTimeoutMs = tabTimeoutMinutes * 60 * 1000;

    const elapsedMs = now - lastActive;
    const isEligible = forceInactive || (elapsedMs >= tabTimeoutMs);

    if (isEligible) {
      const success = await unloadTab(tab);
      if (success) {
        unloadedCount++;
        activeDiscardedCount++;
      }
    }
  }

  // Update statistics
  if (unloadedCount > 0) {
    settings.stats.totalDiscardedCount = (settings.stats.totalDiscardedCount || 0) + unloadedCount;
    settings.stats.estimatedRamSavedMb = (settings.stats.estimatedRamSavedMb || 0) + (unloadedCount * 150);
    settings.stats.lastCheckTimestamp = now;
    await saveSettings(settings);
  }

  // Update icon badge
  updateBadge(activeDiscardedCount, settings.showBadgeCount);

  return { checked: tabs.length, unloaded: unloadedCount, activeDiscarded: activeDiscardedCount };
}

/**
 * Update extension icon badge
 */
function updateBadge(count, enabled) {
  if (!actionApi) return;
  try {
    if (!enabled || count <= 0) {
      actionApi.setBadgeText({ text: '' });
    } else {
      actionApi.setBadgeText({ text: String(count) });
      actionApi.setBadgeBackgroundColor({ color: '#2563EB' });
    }
  } catch (e) {}
}

/**
 * Refresh badge count based on current state of all open tabs
 */
function refreshBadge() {
  getSettings().then(settings => {
    queryTabs({}).then((tabs) => {
      if (!tabs) return;
      const discarded = tabs.filter(t => isTabUnloaded(t)).length;
      updateBadge(discarded, settings.showBadgeCount);
    });
  });
}

/**
 * Setup recurring alarm for checking tab inactivity
 */
function setupAlarm(intervalMinutes = 1) {
  extApi.alarms.clear('saveMyTabCheck', () => {
    extApi.alarms.create('saveMyTabCheck', {
      periodInMinutes: Math.max(1, intervalMinutes)
    });
  });
}

// Alarm listener
extApi.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'saveMyTabCheck') {
    evaluateTabs();
  }
});

// Tab activity listeners to update access timestamps
extApi.tabs.onActivated.addListener((activeInfo) => {
  const now = Date.now();
  if (lastActiveTabId && lastActiveTabId !== activeInfo.tabId) {
    tabAccessMap.set(lastActiveTabId, now);
  }
  lastActiveTabId = activeInfo.tabId;
  tabAccessMap.set(activeInfo.tabId, now);
  refreshBadge();
});

extApi.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.active) {
    tabAccessMap.set(tabId, Date.now());
  }
  if (changeInfo.discarded !== undefined || changeInfo.status === 'complete') {
    refreshBadge();
  }
});

extApi.tabs.onRemoved.addListener((tabId) => {
  tabAccessMap.delete(tabId);
  if (lastActiveTabId === tabId) {
    lastActiveTabId = null;
  }
  if (tabCustomSettings.has(tabId)) {
    tabCustomSettings.delete(tabId);
    saveTabOverrides();
  }
  refreshBadge();
});

extApi.windows.onFocusChanged.addListener((windowId) => {
  if (windowId !== extApi.windows.WINDOW_ID_NONE) {
    queryTabs({ active: true, windowId: windowId }).then((tabs) => {
      if (tabs && tabs[0]) {
        const now = Date.now();
        if (lastActiveTabId && lastActiveTabId !== tabs[0].id) {
          tabAccessMap.set(lastActiveTabId, now);
        }
        lastActiveTabId = tabs[0].id;
        tabAccessMap.set(tabs[0].id, now);
      }
    });
  }
});

/**
 * Context Menus Setup
 */
function setupContextMenus() {
  if (!menusApi) return;

  try {
    menusApi.removeAll(() => {
      menusApi.create({
        id: 'suspend-current-tab',
        title: 'Unload / Suspend this Tab (Free RAM)',
        contexts: ['page', 'action']
      });

      menusApi.create({
        id: 'toggle-exclude-tab',
        title: 'Toggle Exclude this tab from suspension',
        contexts: ['page', 'action']
      });

      menusApi.create({
        id: 'suspend-other-tabs',
        title: 'Unload all other tabs in this window',
        contexts: ['page', 'action']
      });

      menusApi.create({
        id: 'suspend-inactive-now',
        title: 'Unload all inactive tabs now',
        contexts: ['page', 'action']
      });

      menusApi.create({
        id: 'whitelist-current-domain',
        title: 'Never unload this domain (Whitelist)',
        contexts: ['page', 'action']
      });
    });
  } catch (e) {}
}

menusApi?.onClicked.addListener(async (info, tab) => {
  if (!tab) return;
  const settings = await getSettings();

  switch (info.menuItemId) {
    case 'suspend-current-tab': {
      const allTabs = await queryTabs({ currentWindow: true });
      // Only switch to a tab that is LOADED (not discarded and not paused)
      const loadedOtherTab = allTabs.find(t => t.id !== tab.id && !isTabUnloaded(t));

      if (settings.alwaysPauseInPlace || !loadedOtherTab) {
        // Pause in-place: zero RAM, no tab switching, no waking up other tabs!
        const pauseUrl = extApi.runtime.getURL(
          `fallback/paused.html?url=${encodeURIComponent(tab.url)}&title=${encodeURIComponent(tab.title || '')}&favicon=${encodeURIComponent(tab.favIconUrl || '')}`
        );
        await extApi.tabs.update(tab.id, { url: pauseUrl });
        refreshBadge();
      } else {
        await extApi.tabs.update(loadedOtherTab.id, { active: true });
        setTimeout(async () => {
          let success = await unloadTab(tab);
          const checkTab = await new Promise(r => extApi.tabs.get(tab.id, (t) => {
            if (extApi.runtime.lastError) r(null);
            else r(t);
          }));
          if (!checkTab || !checkTab.discarded) {
            const pauseUrl = extApi.runtime.getURL(
              `fallback/paused.html?url=${encodeURIComponent(tab.url)}&title=${encodeURIComponent(tab.title || '')}&favicon=${encodeURIComponent(tab.favIconUrl || '')}`
            );
            await extApi.tabs.update(tab.id, { url: pauseUrl });
          }
          refreshBadge();
        }, 200);
      }
      break;
    }

    case 'toggle-exclude-tab': {
      await loadTabOverrides();
      const existing = tabCustomSettings.get(tab.id) || {};
      existing.isExcluded = !existing.isExcluded;
      tabCustomSettings.set(tab.id, existing);
      await saveTabOverrides();
      break;
    }

    case 'suspend-other-tabs': {
      const tabs = await queryTabs({ currentWindow: true });
      for (const t of tabs) {
        if (t.id !== tab.id && !isTabUnloaded(t)) {
          await unloadTab(t);
        }
      }
      refreshBadge();
      break;
    }

    case 'suspend-inactive-now':
      evaluateTabs(true);
      break;

    case 'whitelist-current-domain':
      if (tab.url) {
        try {
          const domain = new URL(tab.url).hostname;
          if (domain && !settings.whitelist.includes(domain)) {
            settings.whitelist.push(domain);
            await saveSettings(settings);
          }
        } catch (e) {}
      }
      break;
  }
});

/**
 * Runtime Message Handler for Popup and Options Page
 */
extApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message.type) {
      case 'GET_STATUS': {
        await loadTabOverrides();
        const settings = await getSettings();
        const tabs = await queryTabs({});
        const activeTabs = await queryTabs({ active: true, currentWindow: true });
        const currentTab = activeTabs?.[0] || null;
        
        let discardedCount = 0;
        let eligibleCount = 0;
        const now = Date.now();

        for (const t of tabs) {
          if (isTabUnloaded(t)) {
            discardedCount++;
          } else {
            const tOverride = tabCustomSettings.get(t.id);
            const isExcluded = !!tOverride?.isExcluded;
            const tTimeout = (tOverride?.customTimeoutMinutes != null && tOverride.customTimeoutMinutes > 0)
              ? tOverride.customTimeoutMinutes
              : settings.timeoutMinutes;
            const tTimeoutMs = tTimeout * 60 * 1000;

            const lastActive = t.lastAccessed || tabAccessMap.get(t.id) || now;
            const isProtected = isExcluded ||
                                (settings.protectPinned && t.pinned) ||
                                (settings.protectAudio && t.audible) ||
                                (settings.protectActive && t.active) ||
                                isUrlWhitelisted(t.url, settings.whitelist);
            if (!isProtected && (now - lastActive >= tTimeoutMs)) {
              eligibleCount++;
            }
          }
        }

        let isCurrentWhitelisted = false;
        let currentDomain = '';
        if (currentTab?.url) {
          try {
            currentDomain = new URL(currentTab.url).hostname;
            isCurrentWhitelisted = isUrlWhitelisted(currentTab.url, settings.whitelist);
          } catch (e) {}
        }

        const currentTabOverride = currentTab ? tabCustomSettings.get(currentTab.id) : null;

        sendResponse({
          hasNativeDiscard: hasNativeDiscard(),
          settings: settings,
          tabCount: tabs.length,
          discardedCount: discardedCount,
          eligibleCount: eligibleCount,
          currentTab: currentTab ? {
            id: currentTab.id,
            title: currentTab.title,
            url: currentTab.url,
            domain: currentDomain,
            pinned: currentTab.pinned,
            audible: currentTab.audible,
            discarded: currentTab.discarded,
            isPaused: currentTab.url ? currentTab.url.includes('fallback/paused.html') : false,
            isWhitelisted: isCurrentWhitelisted,
            isExcluded: !!currentTabOverride?.isExcluded,
            customTimeoutMinutes: currentTabOverride?.customTimeoutMinutes || null,
            effectiveTimeoutMinutes: currentTabOverride?.customTimeoutMinutes || settings.timeoutMinutes
          } : null
        });
        break;
      }

      case 'SET_TAB_EXCLUSION': {
        await loadTabOverrides();
        const tabId = message.tabId;
        const isExcluded = !!message.isExcluded;
        const existing = tabCustomSettings.get(tabId) || {};
        existing.isExcluded = isExcluded;
        tabCustomSettings.set(tabId, existing);
        await saveTabOverrides();
        sendResponse({ success: true, isExcluded });
        break;
      }

      case 'SET_TAB_CUSTOM_TIMER': {
        await loadTabOverrides();
        const tabId = message.tabId;
        const minutes = (message.minutes != null && message.minutes !== '' && !isNaN(message.minutes))
          ? Math.max(1, parseInt(message.minutes, 10))
          : null;
        const existing = tabCustomSettings.get(tabId) || {};
        existing.customTimeoutMinutes = minutes;
        tabCustomSettings.set(tabId, existing);
        await saveTabOverrides();
        sendResponse({ success: true, customTimeoutMinutes: minutes });
        break;
      }

      case 'UNLOAD_CURRENT_TAB': {
        const activeTabs = await queryTabs({ active: true, currentWindow: true });
        const currentTab = activeTabs?.[0];
        if (currentTab) {
          const settings = await getSettings();
          const allTabs = await queryTabs({ currentWindow: true });

          // CRITICAL FIX: Only pick an alternative tab that is LOADED (not discarded and not paused)
          // Never switch to an already discarded/paused tab, which would cause the browser to reload it!
          const loadedOtherTab = allTabs.find(t => t.id !== currentTab.id && !isTabUnloaded(t));

          if (settings.alwaysPauseInPlace || !loadedOtherTab) {
            // Case 1: User requested always pause in-place OR all other tabs in window are already unloaded!
            // Pause current tab in-place with zero-RAM placeholder:
            // This drops memory immediately and NEVER wakes up previously unloaded tabs.
            const pauseUrl = extApi.runtime.getURL(
              `fallback/paused.html?url=${encodeURIComponent(currentTab.url)}&title=${encodeURIComponent(currentTab.title || '')}&favicon=${encodeURIComponent(currentTab.favIconUrl || '')}`
            );
            await extApi.tabs.update(currentTab.id, { url: pauseUrl });
            refreshBadge();
            sendResponse({ success: true, mode: 'in_place' });
          } else {
            // Case 2: There IS another loaded tab available. Switch to it, then natively discard currentTab.
            await extApi.tabs.update(loadedOtherTab.id, { active: true });
            
            // Allow focus switch to settle in browser engine
            await new Promise(r => setTimeout(r, 200));

            // Discard currentTab natively
            await unloadTab(currentTab);

            // Double check if Firefox marked it discarded
            const checkTab = await new Promise(r => extApi.tabs.get(currentTab.id, (t) => {
              if (extApi.runtime.lastError) r(null);
              else r(t);
            }));

            if (!checkTab || !checkTab.discarded) {
              // If browser still refuses native discard, load fallback pause page to free RAM
              const pauseUrl = extApi.runtime.getURL(
                `fallback/paused.html?url=${encodeURIComponent(currentTab.url)}&title=${encodeURIComponent(currentTab.title || '')}&favicon=${encodeURIComponent(currentTab.favIconUrl || '')}`
              );
              await extApi.tabs.update(currentTab.id, { url: pauseUrl });
            }

            refreshBadge();
            sendResponse({ success: true, mode: 'switched', targetId: loadedOtherTab.id });
          }
        } else {
          sendResponse({ success: false });
        }
        break;
      }

      case 'UNLOAD_INACTIVE_NOW': {
        const result = await evaluateTabs(true);
        sendResponse(result);
        break;
      }

      case 'UNLOAD_OTHER_TABS': {
        const activeTabs = await queryTabs({ active: true, currentWindow: true });
        const currentTab = activeTabs?.[0];
        const tabs = await queryTabs({ currentWindow: true });
        let count = 0;
        for (const t of tabs) {
          if (t.id !== currentTab?.id && !isTabUnloaded(t)) {
            const success = await unloadTab(t);
            if (success) count++;
          }
        }
        refreshBadge();
        sendResponse({ unloaded: count });
        break;
      }

      case 'WAKE_ALL_TABS': {
        const tabs = await queryTabs({ currentWindow: true });
        let reloaded = 0;
        for (const t of tabs) {
          if (t.discarded && t.id) {
            extApi.tabs.reload(t.id);
            reloaded++;
          } else if (t.url && t.url.includes('fallback/paused.html')) {
            try {
              const urlObj = new URL(t.url);
              const original = urlObj.searchParams.get('url');
              if (original) {
                extApi.tabs.update(t.id, { url: decodeURIComponent(original) });
                reloaded++;
              }
            } catch (e) {}
          }
        }
        refreshBadge();
        sendResponse({ reloaded: reloaded });
        break;
      }

      case 'TOGGLE_CURRENT_WHITELIST': {
        const settings = await getSettings();
        const domain = message.domain;
        if (!domain) {
          sendResponse({ success: false });
          return;
        }

        const index = settings.whitelist.indexOf(domain);
        if (index >= 0) {
          settings.whitelist.splice(index, 1);
        } else {
          settings.whitelist.push(domain);
        }

        await saveSettings(settings);
        sendResponse({ success: true, isWhitelisted: index < 0, whitelist: settings.whitelist });
        break;
      }

      case 'UPDATE_SETTINGS': {
        const updated = message.settings;
        if (updated) {
          await saveSettings(updated);
          setupAlarm(updated.checkIntervalMinutes || 1);
          refreshBadge();
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false });
        }
        break;
      }

      default:
        sendResponse({ error: 'Unknown message type' });
    }
  })();
  return true; // Keep message channel open for async response
});

// Initialization
extApi.runtime.onInstalled.addListener(async () => {
  await loadTabOverrides();
  setupAlarm();
  setupContextMenus();
  refreshBadge();
});

extApi.runtime.onStartup?.addListener(async () => {
  await loadTabOverrides();
  setupAlarm();
  setupContextMenus();
  refreshBadge();
});
