/**
 * GameManor Website Configuration
 * Central source of truth for repository information, releases, and external links.
 * 
 * IMPORTANT:
 * Update the placeholders below with your actual GitHub username or custom domain.
 * The website dynamically adapts if releases are published or pending.
 */

const GAMEMANOR_CONFIG = {
  // Brand & Product
  appName: 'GameManor Launcher',
  appTagline: 'Your Games. Your Domain.',
  shortDescription: 'The modern, distraction-free desktop game vault and launcher for Windows PC gamers.',
  currentVersion: '1.0.0',
  releaseDate: 'October 2026',
  platform: 'Windows 10 / 11 (64-bit)',

  // GitHub Repository Configuration
  // Replace 'YOUR_GITHUB_USERNAME' with your actual GitHub handle when published
  repoOwner: 'YOUR_GITHUB_USERNAME',
  repoName: 'gamemanor-launcher',

  // Computed & Static URLs
  get repoUrl() {
    return `https://github.com/${this.repoOwner}/${this.repoName}`;
  },
  get releasesUrl() {
    return `${this.repoUrl}/releases`;
  },
  get latestReleaseApi() {
    return `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/releases/latest`;
  },
  get allReleasesApi() {
    return `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/releases`;
  },
  get issuesUrl() {
    return `${this.repoUrl}/issues`;
  },
  get newIssueBugUrl() {
    return `${this.repoUrl}/issues/new?template=bug_report.md&title=%5BBUG%5D+`;
  },
  get newIssueFeatureUrl() {
    return `${this.repoUrl}/issues/new?template=feature_request.md&title=%5BFEATURE%5D+`;
  },

  // Website & Support Configuration
  websiteUrl: 'https://gamemanor.app',
  contactEmail: 'support@gamemanor.app', // Configurable contact email

  // Windows Installer Fallback (Used when no GitHub Release asset is found yet)
  fallbackInstallerName: 'GameManor-Launcher-Setup-1.0.0.exe',
  fallbackInstallerSize: 'Approx. 85 MB',

  // Verification Flags
  isConfigured() {
    return this.repoOwner !== 'YOUR_GITHUB_USERNAME' && !this.repoOwner.includes('PLACEHOLDER');
  }
};

// Freeze configuration in browser
if (typeof Object.freeze === 'function') {
  Object.freeze(GAMEMANOR_CONFIG);
}

// Export for module or browser window
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GAMEMANOR_CONFIG;
}
