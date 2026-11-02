# SaveMyTab: Universal Cross-Browser Tab Unloader & Memory Saver

SaveMyTab is an open-source, high-efficiency WebExtension (Manifest V3) that intelligently unloads inactive background tabs to drastically reduce browser memory footprint. Built with a dual-engine architecture, it utilizes native browser memory discard APIs (`tabs.discard`) alongside a zero-memory in-place pause fallback, giving you complete control over your RAM without disrupting your browsing workflow.

Compatible with **Google Chrome**, **Mozilla Firefox**, **Microsoft Edge**, **Brave**, **Opera**, and **Apple Safari**.

---

## The Problem

Modern web applications (social media feeds, documentation suites, video players, webmail, and rich document editors) typically consume anywhere from **100 MB to 600 MB+ of RAM per tab**. 

Keeping 20 to 50 tabs open during research or day-to-day multitasking routinely ties up **4 GB to 16 GB+ of system memory**, leading to:
- Operating system slowdowns and memory swapping
- Excessive laptop battery drain and elevated CPU temperatures
- Browser lag, sluggish tab switching, and frozen windows

---

## How SaveMyTab Works: Dual-Engine Architecture

SaveMyTab solves memory bloating through an intelligent two-tier architecture designed around web browser engine primitives:

### 1. Primary Engine: Native Memory Discard (`tabs.discard`)
* **Engines**: Chromium (Blink), Firefox (Gecko 54+), Safari (WebKit 15+)
* **Mechanism**: Calls the browser's native `tabs.discard(tabId)` API on background tabs.
* **Result**: The browser releases 100% of the tab's DOM tree, style sheets, and JavaScript heap allocations from system RAM.
* **Preservation**: The tab remains visible in your tab strip with its original URL, title, favicon, and session history intact.
* **Restoration**: The moment you click on the tab, the browser automatically reloads the page from cache.

### 2. Secondary Engine: Zero-RAM In-Place Pause Fallback (`paused.html`)
* **When Activated**: When unloading the currently active tab where all other tabs in the window are already asleep, or on browser builds lacking native discard.
* **Mechanism**: Replaces the active tab with an ultra-lightweight static placeholder (`paused.html`, memory footprint ~10 KB).
* **Smart Navigation**: Instead of jumping to an already unloaded tab (which would wake it back up), it suspends the current tab in-place.
* **Visual Indicator**: Renders a greyscale favicon onto an HTML5 canvas and prefixes the title with `💤`.
* **Restoration**: Click anywhere on the paused screen to immediately reload the original URL.

---

## Core Features

### ⏱ Per-Tab Custom Inactivity Timers
* Override the global timeout for specific tabs directly from the toolbar popup.
* Pick from presets (`1 min`, `5 min`, `10 min`, `15 min`, `30 min`, `1 hour`, `2 hours`) or input any custom minute duration.
* Keep long-running dashboards alive for hours while automatically unloading temporary reference tabs after just a few minutes.

### 🛡 Per-Tab Suspension Lock (Exclusion)
* Exclude any individual tab from automatic or bulk suspension with a single toggle in the popup or via right-click context menu.
* Prevents tabs with ongoing tasks, long forms, or temporary sessions from unloading without needing to pin them or whitelist the whole domain.

### ⏱ Global Inactivity Timer & Background Scheduler
* Set a universal idle threshold (default: 15 minutes) applied to all non-overridden tabs.
* Configurable background alarm interval (default: checks every 1 minute).

### 🛡 Smart Global Protections
* **Active Tab Protection**: Never interrupts the tab you are actively reading or interacting with.
* **Audio & Video Protection**: Detects and protects tabs playing music, podcasts, YouTube streams, or active conference calls (Google Meet, Zoom, Teams).
* **Pinned Tab Protection**: Keeps pinned communication tools (Slack, WhatsApp, Gmail) continuously loaded in memory (toggleable in Settings).
* **Domain Whitelist**: Built-in whitelist manager supporting specific domains (e.g. `docs.google.com`, `github.com`, `notion.so`).

### 🎨 Visual Greying-Out of Sleeping Tabs
* **Native Tabs**: In Firefox and Chromium, natively discarded background tabs are dimmed and their favicons are greyed out via native browser styling.
* **Paused Tabs**: Tabs paused in-place dynamically desaturate their favicon (`grayscale(100%) opacity(55%)`) and prepend `💤` to the tab title so you can immediately see which tabs are asleep.

### 🎛 Smart Tab Handoff
* When manually unloading the active tab, SaveMyTab strictly filters for **loaded** tabs to switch focus to.
* It will never focus an already unloaded tab, preventing the browser from accidentally reloading sleeping tabs.
* An optional **"Always Pause Current Tab In-Place"** setting lets you suspend tabs without switching focus at all.

### 🚀 One-Click Control Center
* Live counter of currently unloaded tabs.
* Real-time estimate of total RAM freed (~150 MB average per unloaded tab).
* Quick action buttons:
  * **Unload Inactive Tabs Now**: Run manual memory cleanup across all windows.
  * **Unload This Tab**: Immediately free RAM for the current tab.
  * **Unload Others**: Discard all background tabs in the current window.
  * **Wake All Suspended Tabs**: Restore all sleeping tabs in one click.
  * **Whitelist Site**: Add the active domain to your exclusion list in one tap.

### 🖱 Context Menu Shortcuts
Right-click anywhere on a webpage to:
* Unload/Suspend the tab immediately.
* Toggle the per-tab exclusion lock.
* Unload all other tabs in the active window.
* Unload all inactive tabs now.
* Add the domain to your whitelist.

---

## Browser Compatibility Matrix

SaveMyTab follows the official WebExtensions Manifest V3 specification with dual background declarations (`scripts` + `service_worker`) for universal cross-browser support:

| Browser | Manifest Version | Background Runtime | Tab Discard Engine | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Google Chrome** | Manifest V3 | Service Worker (`service_worker`) | Native `chrome.tabs.discard` | Fully Supported |
| **Mozilla Firefox** | Manifest V3 | Event Page (`scripts`) | Native `browser.tabs.discard` | Fully Supported |
| **Microsoft Edge** | Manifest V3 | Service Worker (`service_worker`) | Native `chrome.tabs.discard` | Fully Supported |
| **Brave Browser** | Manifest V3 | Service Worker (`service_worker`) | Native `chrome.tabs.discard` | Fully Supported |
| **Opera / Vivaldi** | Manifest V3 | Service Worker (`service_worker`) | Native `chrome.tabs.discard` | Fully Supported |
| **Apple Safari** | Manifest V3 | WebExtension (`scripts`/`service_worker`) | Native `browser.tabs.discard` | Fully Supported |

---

## Installation Guide

### For Google Chrome, Microsoft Edge, Brave, and Opera

1. Download or clone this repository to your local machine.
2. Open your browser and navigate to the extension management page:
   * **Chrome**: `chrome://extensions`
   * **Edge**: `edge://extensions`
   * **Brave**: `brave://extensions`
   * **Opera**: `opera://extensions`
3. Enable the **Developer mode** toggle switch in the top-right corner.
4. Click **Load unpacked**.
5. Select the repository root folder (the folder containing `manifest.json`).
6. Pin SaveMyTab to your browser toolbar for easy access.

### For Mozilla Firefox

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**.
3. Select the `manifest.json` file inside the repository directory.
4. The extension will initialize immediately.

*(To view native tab unloading in Firefox at any time, open `about:unloads` in a new tab).*

### For Apple Safari

1. Enable Safari developer features (**Safari > Settings > Advanced > Show features for web developers**).
2. Use Apple's Xcode extension converter:
   ```bash
   xcrun safari-web-extension-converter /path/to/SaveMyTab
   ```
3. Build and run the project in Xcode.

---

## Repository Structure

```
SaveMyTab/
├── manifest.json              # Cross-browser Manifest V3 configuration
├── background.js              # Background service worker / script (alarms, lifecycle, discard)
├── popup/
│   ├── popup.html             # Toolbar popup interface
│   ├── popup.css              # Dark/light responsive styling
│   └── popup.js               # Tab controller, live statistics & quick actions
├── options/
│   ├── options.html           # Settings & preferences dashboard
│   ├── options.css            # Options page layout and design
│   └── options.js             # Settings persistence via storage API
├── fallback/
│   ├── paused.html            # Zero-memory in-place pause placeholder
│   └── paused.js              # Canvas greyscale favicon generator & resume handler
├── icons/
│   ├── icon-16.png            # 16x16 toolbar icon
│   ├── icon-32.png            # 32x32 retina icon
│   ├── icon-48.png            # 48x48 extensions manager icon
│   ├── icon-128.png           # 128x128 store & high-res icon
│   ├── icon-sleep-16.png      # 16x16 greyscale sleep icon
│   └── icon-sleep-32.png      # 32x32 greyscale sleep icon
└── README.md                  # Comprehensive documentation and project guide
```

---

## Configuration & Preferences

Open the Settings page by clicking the **Settings ⚙** icon in the popup toolbar:

* **Inactivity Timer**: Set the global idle duration before tabs are eligible for unloading (5m, 10m, 15m, 30m, 1h, 2h, or custom).
* **Check Frequency**: Adjust how often the background alarm evaluates tabs (1 to 60 minutes).
* **Active Tab Protection**: Prevents unloading the tab currently in use (enforced).
* **Audio & Video Protection**: Prevents background media and meetings from disconnecting.
* **Pinned Tab Protection**: Toggle whether pinned tabs should be preserved or eligible for unloading.
* **Always Pause In-Place**: When unloading the active tab, pauses it directly without switching tabs.
* **Domain Whitelist**: Manage sites that should never be unloaded, with quick-add chips for popular services.
* **Lifetime Statistics**: Track cumulative tabs unloaded and total gigabytes of RAM saved over time.

---

## Privacy & Security

* **100% Local Execution**: All tab analysis, timers, and unloading occur strictly inside your local browser instance.
* **Zero Remote Network Calls**: No telemetry, tracking, external analytics, or remote API requests.
* **No Sensitive Data Stored**: Stores only non-sensitive configuration values (timeout minutes, whitelist domains) via `chrome.storage.sync` / `chrome.storage.local`.
* **Zero Content Injection**: SaveMyTab does not inject tracking scripts or inspect webpage content.

---

## License

This project is open-source software licensed under the MIT License.
