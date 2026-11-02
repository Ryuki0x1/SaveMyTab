/**
 * SaveMyTab Options Controller
 */

const extApi = (typeof browser !== 'undefined' && browser.tabs) ? browser : chrome;

// State
let currentSettings = null;

// Elements
const presetButtons = document.querySelectorAll('.preset-btn');
const customTimeoutInput = document.getElementById('custom-timeout-input');
const checkIntervalInput = document.getElementById('check-interval-input');
const protectAudio = document.getElementById('protect-audio');
const protectPinned = document.getElementById('protect-pinned');
const showBadge = document.getElementById('show-badge');
const fallbackEnabled = document.getElementById('fallback-enabled');
const alwaysPauseInPlace = document.getElementById('always-pause-in-place');
const newWhitelistInput = document.getElementById('new-whitelist-input');
const addWhitelistBtn = document.getElementById('add-whitelist-btn');
const whitelistTags = document.getElementById('whitelist-tags');
const suggestionChips = document.querySelectorAll('.chip');
const saveAllBtn = document.getElementById('save-all-btn');
const saveStatus = document.getElementById('save-status');
const resetStatsBtn = document.getElementById('reset-stats-btn');
const engineDot = document.getElementById('engine-dot');
const engineNoteText = document.getElementById('engine-note-text');
const totalUnloadedCount = document.getElementById('total-unloaded-count');
const totalRamSaved = document.getElementById('total-ram-saved');

function showStatus(text, isError = false) {
  saveStatus.textContent = text;
  saveStatus.style.color = isError ? 'var(--danger)' : 'var(--success)';
  saveStatus.classList.add('show');
  setTimeout(() => {
    saveStatus.classList.remove('show');
  }, 2500);
}

function renderWhitelist(whitelist) {
  whitelistTags.innerHTML = '';
  whitelist.forEach(domain => {
    const tag = document.createElement('div');
    tag.className = 'whitelist-tag';
    tag.innerHTML = `
      <span>${domain}</span>
      <button type="button" class="remove-tag-btn" data-domain="${domain}" title="Remove domain">&times;</button>
    `;
    whitelistTags.appendChild(tag);
  });

  // Attach delete handlers
  document.querySelectorAll('.remove-tag-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const d = e.target.getAttribute('data-domain');
      currentSettings.whitelist = currentSettings.whitelist.filter(item => item !== d);
      renderWhitelist(currentSettings.whitelist);
      triggerAutoSave();
    });
  });
}

function updatePresetSelection(val) {
  presetButtons.forEach(btn => {
    const bVal = parseInt(btn.getAttribute('data-val'), 10);
    if (bVal === val) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  customTimeoutInput.value = val;
}

function populateSettings(status) {
  if (!status) return;
  currentSettings = status.settings;

  // Timeout presets
  const tVal = currentSettings.timeoutMinutes || 15;
  updatePresetSelection(tVal);

  checkIntervalInput.value = currentSettings.checkIntervalMinutes || 1;
  protectAudio.checked = !!currentSettings.protectAudio;
  protectPinned.checked = !!currentSettings.protectPinned;
  showBadge.checked = !!currentSettings.showBadgeCount;
  fallbackEnabled.checked = !!currentSettings.fallbackEnabled;
  if (alwaysPauseInPlace) {
    alwaysPauseInPlace.checked = !!currentSettings.alwaysPauseInPlace;
  }

  // Whitelist
  renderWhitelist(currentSettings.whitelist || []);

  // Single simple note in settings page
  if (engineDot && engineNoteText) {
    if (status.hasNativeDiscard) {
      engineDot.style.color = 'var(--success)';
      engineNoteText.textContent = 'Native tabs.discard supported by this browser.';
    } else {
      engineDot.style.color = 'var(--warning)';
      engineNoteText.textContent = 'Using lightweight tab pause fallback.';
    }
  }

  // Lifetime Stats
  const count = currentSettings.stats?.totalDiscardedCount || 0;
  const ramMb = currentSettings.stats?.estimatedRamSavedMb || (count * 150);
  totalUnloadedCount.textContent = count.toLocaleString();
  totalRamSaved.textContent = ramMb >= 1024 
    ? (ramMb / 1024).toFixed(1) + ' GB' 
    : ramMb.toLocaleString() + ' MB';
}

function collectFormSettings() {
  const timeoutVal = parseInt(customTimeoutInput.value, 10) || 15;
  const intervalVal = parseInt(checkIntervalInput.value, 10) || 1;

  currentSettings.timeoutMinutes = Math.max(1, timeoutVal);
  currentSettings.checkIntervalMinutes = Math.max(1, intervalVal);
  currentSettings.protectAudio = protectAudio.checked;
  currentSettings.protectPinned = protectPinned.checked;
  currentSettings.showBadgeCount = showBadge.checked;
  currentSettings.fallbackEnabled = fallbackEnabled.checked;
  if (alwaysPauseInPlace) {
    currentSettings.alwaysPauseInPlace = alwaysPauseInPlace.checked;
  }

  return currentSettings;
}

function saveSettings() {
  const settingsToSave = collectFormSettings();
  extApi.runtime.sendMessage({
    type: 'UPDATE_SETTINGS',
    settings: settingsToSave
  }, (res) => {
    if (res && res.success) {
      showStatus('Settings saved successfully');
    } else {
      showStatus('Error saving settings', true);
    }
  });
}

function triggerAutoSave() {
  saveSettings();
}

// Add domain helper
function addDomain(domainStr) {
  let clean = domainStr.trim().toLowerCase();
  clean = clean.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
  if (!clean) return;

  if (!currentSettings.whitelist.includes(clean)) {
    currentSettings.whitelist.push(clean);
    renderWhitelist(currentSettings.whitelist);
    triggerAutoSave();
    showStatus(`Added ${clean} to whitelist`);
  } else {
    showStatus(`${clean} is already whitelisted`);
  }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  // Fetch current status
  extApi.runtime.sendMessage({ type: 'GET_STATUS' }, (status) => {
    if (status) {
      populateSettings(status);
    }
  });

  // Preset buttons
  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const val = parseInt(btn.getAttribute('data-val'), 10);
      updatePresetSelection(val);
      triggerAutoSave();
    });
  });

  customTimeoutInput.addEventListener('change', () => {
    const val = parseInt(customTimeoutInput.value, 10) || 15;
    updatePresetSelection(val);
    triggerAutoSave();
  });

  checkIntervalInput.addEventListener('change', triggerAutoSave);
  protectAudio.addEventListener('change', triggerAutoSave);
  protectPinned.addEventListener('change', triggerAutoSave);
  showBadge.addEventListener('change', triggerAutoSave);
  fallbackEnabled.addEventListener('change', triggerAutoSave);
  if (alwaysPauseInPlace) {
    alwaysPauseInPlace.addEventListener('change', triggerAutoSave);
  }

  // Whitelist input
  addWhitelistBtn.addEventListener('click', () => {
    if (newWhitelistInput.value) {
      addDomain(newWhitelistInput.value);
      newWhitelistInput.value = '';
    }
  });

  newWhitelistInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addWhitelistBtn.click();
    }
  });

  // Suggestion chips
  suggestionChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const domain = chip.getAttribute('data-domain');
      if (domain) addDomain(domain);
    });
  });

  // Manual save button
  saveAllBtn.addEventListener('click', saveSettings);

  // Reset stats
  resetStatsBtn.addEventListener('click', () => {
    if (confirm('Reset lifetime tab suspension and RAM statistics counter to zero?')) {
      currentSettings.stats = {
        totalDiscardedCount: 0,
        estimatedRamSavedMb: 0,
        lastCheckTimestamp: Date.now()
      };
      saveSettings();
      totalUnloadedCount.textContent = '0';
      totalRamSaved.textContent = '0 MB';
      showStatus('Statistics reset');
    }
  });

  // Sidebar smooth scroll
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.sidebar-nav .nav-item').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      const targetId = link.getAttribute('href').substring(1);
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
});
