# SaveMyTab: Universal Cross-Browser Tab Unloader & Memory Saver

> An ultra-efficient, all-browser compatible WebExtension (Manifest V3) that intelligently unloads inactive background tabs to save system RAM, leveraging native browser engine discard features with seamless fallback support.

---

## ⚡ How It Works & Architecture

Modern web apps (social feeds, rich editors, video players) typically consume **100MB to 500MB+ of RAM per tab**. Having 20–30 background tabs open can easily exhaust 4GB–12GB of system memory, slowing down your entire operating system.

**SaveMyTab** implements an intelligent two-tier memory reclamation engine:

1. **Native Browser Discard Engine (`tabs.discard`)**:
   - **Supported on**: Google Chrome, Microsoft Edge, Brave, Opera, Vivaldi, Mozilla Firefox (54+), and Apple Safari (15+).
   - **Mechanism**: Calls the browser's native `tabs.discard(tabId)` API. The browser unloads 100% of the tab's DOM tree, CSS styles, and JavaScript heap from system RAM while preserving the tab's title, favicon, scroll position, and tab strip location.
   - **Restoration**: The tab stays sleeping in your tab strip. As soon as you click the tab, the browser automatically wakes it up.

2. **Universal Fallback Pause Engine**:
   - **Supported on**: Any browser or lightweight engine where native `tabs.discard` is unavailable.
   - **Mechanism**: Gracefully transitions inactive tabs to an ultra-lightweight, zero-memory pause placeholder (`paused.html`).
   - **Restoration**: Automatically reloads the original page the moment the tab is focused or clicked.

---

## ✨ Features

- **⏱ Per-Tab Fixed Inactivity Timer**: Set an individual inactivity timer on any specific tab (e.g. 1m, 5m, 10m, 15m, 30m, 1h, 2h, or any custom minutes) overriding the global timer.
- **🛡 Per-Tab Suspension Lock / Exclusion**: Exclude individual tabs from ever being suspended with one click from the popup or context menu without having to pin them or whitelist their entire domain.
- **⏱ Configurable Global Inactivity Timer**: Set a universal default idle duration before background tabs are unloaded (default: 15 minutes).
- **🛡 Smart Tab Protection**:
  - **Active Tab Guard**: Never unloads the tab you are currently reading or interacting with.
  - **Media & Audio Protection**: Detects and skips tabs playing music, podcasts, YouTube streams, or conference calls.
  - **Pinned Tab Protection**: Keeps pinned communication apps (Slack, Gmail, WhatsApp) loaded in memory.
  - **Domain Whitelist**: Add sites (e.g. `docs.google.com`, `github.com`) that should never be unloaded.
- **🚀 One-Click Toolbar Controls**:
  - **"Exclude this tab"** toggle switch.
  - **"Tab Inactivity Timer"** selector with custom duration input.
  - **"Unload Inactive Tabs Now"**: Instant manual trigger to free RAM on demand.
  - **"Unload This Tab"** & **"Unload Others"**: Targeted memory cleanup.
  - **"Wake All Suspended Tabs"**: Instantly restore all sleeping tabs.
  - **Quick Whitelist Toggle**: Whitelist the current site directly from the popup.
- **🖱 Context Menu Integration**: Right-click anywhere on a webpage to unload it, toggle its exclusion status, or whitelist its domain.
- **📊 Real-Time RAM & Tab Counter**: Live tracking of unloaded tabs, open tabs, and estimated memory saved (badge indicator included).

---

## 🎯 How to Use the Per-Tab Features

### 1. Set a Fixed Timer for a Specific Tab
1. Switch to the tab you want to configure.
2. Click the **SaveMyTab** icon in your browser toolbar.
3. In the **Current Tab Controls** section, locate the **Tab Inactivity Timer** dropdown.
4. Select a duration (e.g., `1 min`, `5 min`, `30 min`, `1 hour`) or select `Custom...` and enter the exact number of minutes.
5. That specific tab will now automatically unload if left unopened for that duration, regardless of your global timer! To revert to the global setting, simply choose `Global Default`.

### 2. Exclude a Specific Tab from Suspension
1. Switch to the tab you want to protect.
2. Click the **SaveMyTab** icon in your toolbar.
3. Toggle the **"Exclude this tab"** switch to ON.
   *(Or simply right-click anywhere on the webpage and select **"Toggle Exclude this tab from suspension"**).*
4. The tab is now locked and protected: it will never be suspended automatically, even if left inactive for hours or days.

---

## 📂 File Structure

```
savemytab-extension/
├── manifest.json              # Cross-browser Manifest V3 configuration (Chrome & Firefox)
├── background.js              # Background service worker with per-tab overrides & alarms
├── popup/
│   ├── popup.html             # Clean toolbar popup with per-tab timer & exclusion controls
│   ├── popup.css              # Responsive dark/light mode styles
│   └── popup.js               # Per-tab state controller & quick actions
├── options/
│   ├── options.html           # Settings & preferences dashboard
│   ├── options.css            # Dashboard styling
│   └── options.js             # Settings persistence & whitelist editor
├── fallback/
│   ├── paused.html            # Lightweight fallback pause placeholder
│   └── paused.js              # Instant resume-on-focus script
├── icons/
│   ├── icon-16.png            # 16x16 toolbar icon
│   ├── icon-32.png            # 32x32 retina icon
│   ├── icon-48.png            # 48x48 extensions manager icon
│   └── icon-128.png           # 128x128 store & high-res icon
└── README.md                  # Documentation and installation guide
```

---

## 🛠 Installation Instructions

### 1. Google Chrome / Microsoft Edge / Brave / Opera / Vivaldi

1. Extract the extension archive (`savemytab-extension.zip`) into a folder on your computer.
2. Open your browser and navigate to:
   - **Chrome**: `chrome://extensions`
   - **Edge**: `edge://extensions`
   - **Brave**: `brave://extensions`
   - **Opera**: `opera://extensions`
3. Enable the **"Developer mode"** toggle switch (usually found in the top-right corner).
4. Click the **"Load unpacked"** button.
5. Select the extracted extension directory (the folder containing `manifest.json`).
6. SaveMyTab is now active! Pin it to your toolbar for quick access.

### 2. Mozilla Firefox

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click **"Load Temporary Add-on..."**.
3. Select the `manifest.json` file inside the extracted extension directory.
4. SaveMyTab will load and begin monitoring tabs immediately.

### 3. Apple Safari

Safari requires converting WebExtensions using Safari's developer tools:
1. Ensure Safari Developer Mode is enabled (**Safari > Settings > Advanced > Show features for web developers**).
2. Run `xcrun safari-web-extension-converter /path/to/savemytab-extension` to generate the Safari extension project.
