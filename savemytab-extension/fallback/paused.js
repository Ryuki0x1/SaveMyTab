/**
 * Paused script for suspended tabs
 * Reloads the original page upon click and displays greyscale favicon
 */
(function() {
  const params = new URLSearchParams(window.location.search);
  const targetUrl = params.get('url');
  const title = params.get('title');
  const favicon = params.get('favicon');
  const iconEl = document.getElementById('page-favicon');

  if (title) {
    document.title = '💤 ' + decodeURIComponent(title);
    const titleEl = document.getElementById('tab-title');
    if (titleEl) titleEl.textContent = decodeURIComponent(title);
  }

  if (targetUrl) {
    const urlEl = document.getElementById('tab-url');
    if (urlEl) urlEl.textContent = decodeURIComponent(targetUrl);
  }

  // Grey out the favicon dynamically on a canvas
  if (favicon) {
    const rawFavicon = decodeURIComponent(favicon);
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = function() {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width || 32;
        canvas.height = img.height || 32;
        const ctx = canvas.getContext('2d');

        // Apply greyscale and slight transparency to match native browser discard styling
        ctx.filter = 'grayscale(100%) opacity(55%)';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const greyFavicon = canvas.toDataURL('image/png');
        if (iconEl) iconEl.href = greyFavicon;
      } catch (e) {
        // Fallback if cross-origin canvas read is restricted
        if (iconEl) iconEl.href = '../icons/icon-sleep-32.png';
      }
    };

    img.onerror = function() {
      if (iconEl) iconEl.href = '../icons/icon-sleep-32.png';
    };

    img.src = rawFavicon;
  } else {
    if (iconEl) iconEl.href = '../icons/icon-sleep-32.png';
  }

  let resuming = false;
  function resume() {
    if (resuming) return;
    resuming = true;
    if (targetUrl) {
      const btn = document.getElementById('resume-btn');
      if (btn) btn.textContent = 'Restoring page...';
      window.location.replace(decodeURIComponent(targetUrl));
    }
  }

  // Click anywhere on the page or card to resume
  document.addEventListener('click', resume);
})();
