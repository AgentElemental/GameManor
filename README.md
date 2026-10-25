# GameManor Launcher — Official Website

This folder contains the complete, standalone static website for **GameManor Launcher**, the desktop game vault and location monitor for Windows PC gamers.

---

## 1. Architecture & Isolation

- **Standalone Static Website:** Built with pure semantic HTML5, Vanilla CSS3, and vanilla JavaScript.
- **Zero Electron Dependencies:** Completely decoupled from the desktop application, Electron APIs, IPC bridges, and the local SQLite database.
- **Zero Telemetry & Tracking:** No third-party tracking scripts, advertising pixels, or marketing cookies.
- **Offline & Local Testing:** Runs immediately by opening `index.html` in any modern web browser or serving via any static web server.

---

## 2. Directory Structure

```
website/
├── index.html            # Homepage (Hero showcase, highlights, preview gallery, CTA)
├── features.html         # In-depth architectural feature overview & planned roadmap
├── download.html         # Windows download center & system requirements
├── changelog.html        # Release notes & version history with GitHub API support
├── faq.html              # Searchable & categorized accordion FAQ
├── contact.html          # Contact Us form (Google Apps Script / Netlify function integration)
├── bug-reports.html      # Bug Reports form with multi-file attachment dropzone & size limits
├── privacy.html          # Transparent privacy policy
├── 404.html              # Branded 404 error page
├── assets/
│   ├── icons/            # Brand icon, favicon.png, favicon.svg
│   ├── images/           # Additional graphical assets
│   └── screenshots/      # 8 real high-resolution screenshots from GameManor Launcher
├── css/
│   ├── style.css         # Brand design tokens, dark & light themes, layout components
│   ├── forms.css         # Contact & Bug Reports form styling, dropzone, storage meter, status banners
│   └── responsive.css    # Tablet & mobile responsive media queries
├── js/
│   ├── config.js         # Central configuration for repository, releases, and form endpoints
│   ├── main.js           # Theme switcher, navigation, mobile drawer, accordions, search
│   ├── download.js       # GitHub Releases API resolution & sanitized changelog loader
│   └── forms.js          # Form validation, attachment handling (Base64), submission & prefilled fallbacks
├── netlify/
│   └── functions/
│       └── submit-form.js # Serverless proxy to Google Apps Script bypassing browser CORS preflight
├── netlify.toml          # Netlify static deployment, function routing & security response headers
├── robots.txt            # Search engine crawler directives
├── sitemap.xml           # XML sitemap with all page canonical URLs
└── README.md             # This documentation
```

---

## 3. How to Run Locally

You can test and view the website locally without any build step:

### Option A: Using Python (Recommended)
From your terminal, navigate into `website/` and run:
```bash
# Python 3
python -m http.server 8080
```
Then open your browser to `http://localhost:8080`.

### Option B: Using Node.js `npx serve`
```bash
npx serve website
```

### Option C: Direct File Opening
You can double-click or drag `website/index.html` directly into any web browser (Chrome, Edge, Firefox, Brave).

---

## 4. Configuration Guide (`website/js/config.js`)

All project URLs, GitHub handles, version numbers, and contact channels are centralized in `website/js/config.js`:

```javascript
const GAMEMANOR_CONFIG = {
  appName: 'GameManor Launcher',
  currentVersion: '1.0.0',
  releaseDate: 'October 2026',

  // Update these with your GitHub account details:
  repoOwner: 'YOUR_GITHUB_USERNAME',
  repoName: 'gamemanor-launcher',

  // Custom domain & contact:
  websiteUrl: 'https://gamemanor.app',
  contactEmail: 'support@gamemanor.app'
};
```

When `repoOwner` is updated from the default placeholder, the download and changelog pages will automatically query the GitHub Releases API for live installer binaries.

---

## 5. Deploying to Netlify

The website is pre-configured for static deployment on [Netlify](https://www.netlify.com/):

### Method 1: Git-Connected Repository (Continuous Deployment)
1. Push your repository to GitHub.
2. In Netlify, click **"Add new site"** &rarr; **"Import an existing project"**.
3. Select your repository.
4. Set the following build configuration:
   - **Base directory:** `website`
   - **Package directory:** `website`
   - **Build command:** *(Leave empty / blank)*
   - **Publish directory:** `.` (or `website` if base directory is root)
5. Click **"Deploy site"**.

### Method 2: Netlify CLI
From the project root:
```bash
netlify deploy --dir=website --prod
```

### Method 3: Drag & Drop (Instant Manual Deploy)
1. In Netlify, go to the **Sites** dashboard.
2. Drag and drop the `website` folder directly into the deploy target.
3. Your site will be published immediately with custom domain and SSL support.

---

## 6. Security Headers & Performance

The included `netlify.toml` automatically applies:
- `X-Frame-Options: DENY` (Clickjacking protection)
- `X-Content-Type-Options: nosniff` (MIME sniffing prevention)
- `Referrer-Policy: strict-origin-when-cross-origin`
- Content Security Policy (CSP) scoped to Google Fonts and the public GitHub Releases API
- Immutable long-term caching (`max-age=31536000`) for static icons and screenshots

---

## 7. Form Submission Service Architecture

The **Contact Us** (`contact.html`) and **Bug Reports** (`bug-reports.html`) pages submit data through a server-side Netlify Function (`netlify/functions/submit-form.js`):

- **Proxy Endpoint:** `/api/submit-form` (routed via `netlify.toml` rewrites to `/.netlify/functions/submit-form`).
- **Google Apps Script Web App Deployment:**
  `https://script.google.com/macros/s/AKfycbxLjK2_TOmdtoAzqydBT0kMl0bprIMF_ylnpquVvIocjDCxEXS-ZGSGPysOwLiVe04/exec`
- **Why the Serverless Proxy Exists:** Browser POST requests with `Content-Type: application/json` trigger a CORS preflight (`OPTIONS`) check. Google Apps Script returns HTTP 200 on OPTIONS without CORS headers, which causes browsers to block the request. The Netlify function executes securely on Node.js, automatically follows Google 302 redirects, and relays the response with full CORS headers.
- **Client Fallback:** If the site is served in a static environment where the Netlify Function is unavailable, `js/forms.js` provides prefilled official Google Form fallback links so users never lose their data.

