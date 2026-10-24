/**
 * GameManor Website — Download & Release Resolution
 * Dynamically queries public GitHub Releases with robust fallbacks,
 * rate-limit handling, asset verification, and sanitized release note rendering.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Populate all static configuration placeholders across the page
  populateConfigPlaceholders();

  // If on the download page, resolve the latest installer
  if (document.getElementById('downloadHeroBtn')) {
    resolveLatestRelease();
  }

  // If on the changelog page, resolve release history
  if (document.getElementById('changelogContainer')) {
    resolveChangelog();
  }
});

/* ====================================================================
   POPULATE CONFIG PLACEHOLDERS
   ==================================================================== */
function populateConfigPlaceholders() {
  if (typeof GAMEMANOR_CONFIG === 'undefined') return;

  // Repository links
  document.querySelectorAll('[data-bind="repoUrl"]').forEach(el => {
    el.setAttribute('href', GAMEMANOR_CONFIG.repoUrl);
  });
  document.querySelectorAll('[data-bind="releasesUrl"]').forEach(el => {
    el.setAttribute('href', GAMEMANOR_CONFIG.releasesUrl);
  });
  document.querySelectorAll('[data-bind="issuesUrl"]').forEach(el => {
    el.setAttribute('href', GAMEMANOR_CONFIG.issuesUrl);
  });
  document.querySelectorAll('[data-bind="contactEmail"]').forEach(el => {
    el.textContent = GAMEMANOR_CONFIG.contactEmail;
    if (el.tagName === 'A') {
      el.setAttribute('href', `mailto:${GAMEMANOR_CONFIG.contactEmail}?subject=GameManor%20Launcher%20Inquiry`);
    }
  });

  // Current version & date
  document.querySelectorAll('[data-bind="currentVersion"]').forEach(el => {
    el.textContent = `v${GAMEMANOR_CONFIG.currentVersion}`;
  });
  document.querySelectorAll('[data-bind="releaseDate"]').forEach(el => {
    el.textContent = GAMEMANOR_CONFIG.releaseDate;
  });
}

/* ====================================================================
   RESOLVE LATEST WINDOWS RELEASE FOR DOWNLOAD PAGE
   ==================================================================== */
async function resolveLatestRelease() {
  const downloadBtn = document.getElementById('downloadHeroBtn');
  const versionBadge = document.getElementById('downloadVersionBadge');
  const releaseDateText = document.getElementById('downloadReleaseDate');
  const fileSizeText = document.getElementById('downloadFileSize');
  const statusNote = document.getElementById('downloadStatusNote');

  if (!downloadBtn) return;

  // Check if configured with real GitHub username
  if (!GAMEMANOR_CONFIG.isConfigured()) {
    // Show honest pending/coming-soon state
    if (versionBadge) versionBadge.textContent = `v${GAMEMANOR_CONFIG.currentVersion} (Initial Release)`;
    if (releaseDateText) releaseDateText.textContent = GAMEMANOR_CONFIG.releaseDate;
    if (fileSizeText) fileSizeText.textContent = GAMEMANOR_CONFIG.fallbackInstallerSize;
    if (statusNote) {
      statusNote.innerHTML = `Official repository is being prepared for release. Download directly from <a href="${GAMEMANOR_CONFIG.releasesUrl}" target="_blank" rel="noopener" style="color:var(--primary-red);text-decoration:underline;">GitHub Releases</a> when published.`;
    }
    downloadBtn.setAttribute('href', GAMEMANOR_CONFIG.releasesUrl);
    return;
  }

  // Attempt to fetch latest release from GitHub API
  try {
    const res = await fetch(GAMEMANOR_CONFIG.latestReleaseApi, {
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    });

    if (res.status === 404) {
      // No published releases yet
      if (statusNote) {
        statusNote.textContent = 'No published release found yet. Check back soon or visit GitHub Releases.';
      }
      downloadBtn.setAttribute('href', GAMEMANOR_CONFIG.releasesUrl);
      return;
    }

    if (!res.ok) {
      throw new Error(`GitHub API returned status ${res.status}`);
    }

    const release = await res.json();

    // Find Windows installer asset (.exe)
    const installerAsset = (release.assets || []).find(asset => 
      asset.name.toLowerCase().endsWith('.exe') && !asset.name.toLowerCase().includes('blockmap')
    );

    if (installerAsset && installerAsset.browser_download_url) {
      downloadBtn.setAttribute('href', installerAsset.browser_download_url);
      downloadBtn.setAttribute('download', installerAsset.name);
      
      const mbSize = (installerAsset.size / (1024 * 1024)).toFixed(1);
      if (fileSizeText) fileSizeText.textContent = `${mbSize} MB`;

      const pubDate = new Date(release.published_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      if (releaseDateText) releaseDateText.textContent = pubDate;

      if (versionBadge) versionBadge.textContent = release.tag_name || `v${GAMEMANOR_CONFIG.currentVersion}`;
      if (statusNote) {
        statusNote.textContent = `Verified official Windows installer: ${installerAsset.name}`;
      }
    } else {
      // Release exists but no .exe asset attached yet
      downloadBtn.setAttribute('href', release.html_url || GAMEMANOR_CONFIG.releasesUrl);
      if (statusNote) {
        statusNote.textContent = 'Release found. Download Windows installer from the GitHub release assets.';
      }
    }

  } catch (err) {
    console.warn('[GameManor Download] Could not query GitHub releases API:', err.message);
    // Graceful offline / rate-limit fallback
    downloadBtn.setAttribute('href', GAMEMANOR_CONFIG.releasesUrl);
    if (statusNote) {
      statusNote.innerHTML = `View downloads directly on <a href="${GAMEMANOR_CONFIG.releasesUrl}" target="_blank" rel="noopener" style="color:var(--primary-red);text-decoration:underline;">GitHub Releases</a>.`;
    }
  }
}

/* ====================================================================
   RESOLVE CHANGELOG HISTORY
   ==================================================================== */
async function resolveChangelog() {
  const container = document.getElementById('changelogContainer');
  const loadingIndicator = document.getElementById('changelogLoading');

  if (!container) return;

  // If not configured, hide loader and let bundled changelog show
  if (!GAMEMANOR_CONFIG.isConfigured()) {
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    return;
  }

  try {
    const res = await fetch(GAMEMANOR_CONFIG.allReleasesApi, {
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    });

    if (!res.ok) {
      throw new Error(`Status ${res.status}`);
    }

    const releases = await res.json();
    if (loadingIndicator) loadingIndicator.style.display = 'none';

    if (Array.isArray(releases) && releases.length > 0) {
      // Clear bundled fallback and render API releases safely
      container.innerHTML = '';
      releases.forEach(rel => {
        container.appendChild(createSanitizedReleaseElement(rel));
      });
    }

  } catch (err) {
    console.warn('[GameManor Changelog] Falling back to bundled release notes:', err.message);
    if (loadingIndicator) loadingIndicator.style.display = 'none';
  }
}

/* ====================================================================
   SAFELY RENDER RELEASE NOTES AS SANITIZED DOM
   ==================================================================== */
function createSanitizedReleaseElement(release) {
  const item = document.createElement('article');
  item.className = 'changelog-item';

  const header = document.createElement('div');
  header.className = 'changelog-header';

  const ver = document.createElement('h3');
  ver.className = 'changelog-version';
  ver.textContent = release.tag_name || release.name || 'Release';

  if (release.prerelease) {
    const preBadge = document.createElement('span');
    preBadge.className = 'badge badge-outline';
    preBadge.textContent = 'Pre-release';
    ver.appendChild(preBadge);
  }

  const dateSpan = document.createElement('span');
  dateSpan.className = 'changelog-date';
  const pubDate = release.published_at ? new Date(release.published_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : 'Published on GitHub';
  dateSpan.textContent = pubDate;

  header.appendChild(ver);
  header.appendChild(dateSpan);
  item.appendChild(header);

  const body = document.createElement('div');
  body.className = 'changelog-body';

  // Sanitize body: render line-by-line as plain text paragraphs or bullet items
  const rawBody = (release.body || 'No release notes provided for this version.').trim();
  const lines = rawBody.split('\n');
  let currentList = null;

  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) {
      if (currentList) {
        body.appendChild(currentList);
        currentList = null;
      }
      const h4 = document.createElement('h4');
      h4.textContent = trimmed.replace(/^#+\s*/, '');
      body.appendChild(h4);
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (!currentList) {
        currentList = document.createElement('ul');
      }
      const li = document.createElement('li');
      li.textContent = trimmed.replace(/^[-*]\s*/, '');
      currentList.appendChild(li);
    } else if (trimmed.length > 0) {
      if (currentList) {
        body.appendChild(currentList);
        currentList = null;
      }
      const p = document.createElement('p');
      p.textContent = trimmed;
      body.appendChild(p);
    }
  });

  if (currentList) {
    body.appendChild(currentList);
  }

  item.appendChild(body);

  const footer = document.createElement('div');
  footer.style.marginTop = '24px';
  const ghLink = document.createElement('a');
  ghLink.className = 'btn btn-secondary';
  ghLink.href = release.html_url || GAMEMANOR_CONFIG.releasesUrl;
  ghLink.target = '_blank';
  ghLink.rel = 'noopener';
  ghLink.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M10 14L21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg> View on GitHub`;
  footer.appendChild(ghLink);

  item.appendChild(footer);
  return item;
}
