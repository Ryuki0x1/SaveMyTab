/**
 * SaveMyTab Popup Controller with Per-Tab Custom Controls
 */

const extApi = (typeof browser !== 'undefined' && browser.tabs) ? browser : chrome;

// DOM Elements
const discardedStat = document.getElementById('discarded-stat');
const ramStat = document.getElementById('ram-stat');
const activeStat = document.getElementById('active-stat');
const currentTabTitle = document.getElementById('current-tab-title');
const currentTabDomain = document.getElementById('current-tab-domain');
const toggleWhitelistBtn = document.getElementById('toggle-whitelist-btn');
const unloadInactiveBtn = document.getElementById('unload-inactive-btn');
const unloadCurrentBtn = document.getElementById('unload-current-btn');
const unloadOthersBtn = document.getElementById('unload-others-btn');
const wakeAllBtn = document.getElementById('wake-all-btn');
const timerStatus = document.getElementById('timer-status');
const feedbackMsg = document.getElementById('feedback-msg');
const openOptionsBtn = document.getElementById('open-options-btn');

// Per-tab specific elements
const excludeTabToggle = document.getElementById('exclude-tab-toggle');
const tabTimerSelect = document.getElementById('tab-timer-select');
const tabTimerStatusText = document.getElementById('tab-timer-status-text');
const tabTimerControlRow = document.getElementById('tab-timer-control-row');
const customMinutesContainer = document.getElementById('custom-minutes-container');
const tabCustomMinutesInput = document.getElementById('tab-custom-minutes-input');
const applyCustomTimerBtn = document.getElementById('apply-custom-timer-btn');
const tabExcludedNotice = document.getElementById('tab-excluded-notice');

let currentTabState = null;
let currentSettings = null;

function showFeedback(text) {
  feedbackMsg.textContent = text;
  feedbackMsg.classList.add('show');
  setTimeout(() => {
    feedbackMsg.classList.remove('show');
  }, 2200);
}

function updateUI(status) {
  if (!status) return;
  currentSettings = status.settings;

  // 1. Tab and RAM statistics
  discardedStat.textContent = status.discardedCount;
  const ramFreedMb = (status.discardedCount * 150);
  ramStat.textContent = ramFreedMb >= 1024 
    ? (ramFreedMb / 1024).toFixed(1) + ' GB' 
    : ramFreedMb + ' MB';
  activeStat.textContent = status.tabCount;

  // 2. Current Tab details
  currentTabState = status.currentTab;
  if (currentTabState) {
    currentTabTitle.textContent = currentTabState.title || 'Untitled Tab';
    currentTabDomain.textContent = currentTabState.domain || 'Internal page';

    // Whitelist status
    if (currentTabState.isWhitelisted) {
      toggleWhitelistBtn.textContent = 'Whitelisted';
      toggleWhitelistBtn.classList.add('whitelisted');
    } else {
      toggleWhitelistBtn.textContent = 'Whitelist';
      toggleWhitelistBtn.classList.remove('whitelisted');
    }

    if (!currentTabState.domain || currentTabState.domain === 'Internal page') {
      toggleWhitelistBtn.disabled = true;
      toggleWhitelistBtn.style.opacity = '0.5';
    } else {
      toggleWhitelistBtn.disabled = false;
      toggleWhitelistBtn.style.opacity = '1';
    }

    // Feature 2: Per-Tab Exclusion Toggle
    excludeTabToggle.checked = !!currentTabState.isExcluded;
    if (currentTabState.isExcluded) {
      tabExcludedNotice.classList.remove('hidden');
      tabTimerStatusText.textContent = 'Tab Excluded (Never Suspended)';
      tabTimerControlRow.style.opacity = '0.5';
      tabTimerSelect.disabled = true;
      customMinutesContainer.classList.add('hidden');
    } else {
      tabExcludedNotice.classList.add('hidden');
      tabTimerControlRow.style.opacity = '1';
      tabTimerSelect.disabled = false;

      // Feature 1: Per-Tab Fixed Timer Selector
      const cMinutes = currentTabState.customTimeoutMinutes;
      if (cMinutes != null && cMinutes > 0) {
        tabTimerStatusText.textContent = `Fixed: ${cMinutes} min idle`;
        const optionExists = Array.from(tabTimerSelect.options).some(opt => opt.value === String(cMinutes));
        if (optionExists) {
          tabTimerSelect.value = String(cMinutes);
          customMinutesContainer.classList.add('hidden');
        } else {
          tabTimerSelect.value = 'custom';
          customMinutesContainer.classList.remove('hidden');
          tabCustomMinutesInput.value = cMinutes;
        }
      } else {
        tabTimerSelect.value = 'default';
        tabTimerStatusText.textContent = `Global: ${currentSettings?.timeoutMinutes || 15} min idle`;
        customMinutesContainer.classList.add('hidden');
      }
    }
  }

  // 3. Global Timer status in footer
  if (status.settings) {
    timerStatus.textContent = `Global Timeout: ${status.settings.timeoutMinutes}m idle`;
  }
}

function refreshStatus() {
  extApi.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
    if (!extApi.runtime.lastError && response) {
      updateUI(response);
    }
  });
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  refreshStatus();

  // Settings button
  openOptionsBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (extApi.runtime.openOptionsPage) {
      extApi.runtime.openOptionsPage();
    } else {
      window.open(extApi.runtime.getURL('options/options.html'));
    }
  });

  // Feature 2: Toggle Exclude This Tab
  excludeTabToggle.addEventListener('change', () => {
    if (!currentTabState) return;
    const isExcluded = excludeTabToggle.checked;

    extApi.runtime.sendMessage({
      type: 'SET_TAB_EXCLUSION',
      tabId: currentTabState.id,
      isExcluded: isExcluded
    }, (res) => {
      if (res && res.success) {
        showFeedback(isExcluded ? 'Tab excluded from suspension' : 'Tab exclusion removed');
        refreshStatus();
      }
    });
  });

  // Feature 1: Set Inactivity Timer for this Tab
  tabTimerSelect.addEventListener('change', () => {
    if (!currentTabState) return;
    const val = tabTimerSelect.value;

    if (val === 'custom') {
      customMinutesContainer.classList.remove('hidden');
      tabCustomMinutesInput.focus();
      return;
    }

    customMinutesContainer.classList.add('hidden');
    const minutes = (val === 'default') ? null : parseInt(val, 10);

    extApi.runtime.sendMessage({
      type: 'SET_TAB_CUSTOM_TIMER',
      tabId: currentTabState.id,
      minutes: minutes
    }, (res) => {
      if (res && res.success) {
        showFeedback(minutes ? `Tab timer set to ${minutes}m` : 'Reset to global default');
        refreshStatus();
      }
    });
  });

  // Apply custom minutes button
  applyCustomTimerBtn.addEventListener('click', () => {
    if (!currentTabState) return;
    const mins = parseInt(tabCustomMinutesInput.value, 10);
    if (!mins || mins < 1) {
      showFeedback('Enter valid minutes (>= 1)');
      return;
    }

    extApi.runtime.sendMessage({
      type: 'SET_TAB_CUSTOM_TIMER',
      tabId: currentTabState.id,
      minutes: mins
    }, (res) => {
      if (res && res.success) {
        showFeedback(`Tab timer set to ${mins}m`);
        refreshStatus();
      }
    });
  });

  tabCustomMinutesInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      applyCustomTimerBtn.click();
    }
  });

  // Whitelist toggle
  toggleWhitelistBtn.addEventListener('click', () => {
    if (!currentTabState || !currentTabState.domain) return;

    extApi.runtime.sendMessage({
      type: 'TOGGLE_CURRENT_WHITELIST',
      domain: currentTabState.domain
    }, (res) => {
      if (res && res.success) {
        showFeedback(res.isWhitelisted ? 'Domain whitelisted' : 'Removed from whitelist');
        refreshStatus();
      }
    });
  });

  // Unload inactive now
  unloadInactiveBtn.addEventListener('click', () => {
    unloadInactiveBtn.disabled = true;
    extApi.runtime.sendMessage({ type: 'UNLOAD_INACTIVE_NOW' }, (res) => {
      unloadInactiveBtn.disabled = false;
      showFeedback(`Unloaded ${res?.unloaded || 0} tabs`);
      refreshStatus();
    });
  });

  // Unload current tab
  unloadCurrentBtn.addEventListener('click', () => {
    extApi.runtime.sendMessage({ type: 'UNLOAD_CURRENT_TAB' }, () => {
      window.close();
    });
  });

  // Unload other tabs
  unloadOthersBtn.addEventListener('click', () => {
    extApi.runtime.sendMessage({ type: 'UNLOAD_OTHER_TABS' }, (res) => {
      showFeedback(`Unloaded ${res?.unloaded || 0} tabs`);
      refreshStatus();
    });
  });

  // Wake all tabs
  wakeAllBtn.addEventListener('click', () => {
    extApi.runtime.sendMessage({ type: 'WAKE_ALL_TABS' }, (res) => {
      showFeedback(`Restored ${res?.reloaded || 0} tabs`);
      refreshStatus();
    });
  });
});
