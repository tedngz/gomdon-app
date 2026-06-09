const fs = require('fs');
let css = fs.readFileSync('src/style.css', 'utf-8');

// Normalize line endings
let normalized = css.replace(/\r\n/g, '\n');

// 1. Hide status bar completely on all devices
normalized = normalized.replace(/\.status-bar\{[^}]+\}/, `.status-bar { display: none !important; }`);

// 2. Patch desktop media queries to hide redundant branding and push controls right
const oldDesktopStart = `  /* App bar adjustments */
  .app-bar {
    padding: 20px 40px;
    background: var(--bar-bg);
    border-bottom: 1px solid var(--border);
  }`;

const newDesktopAppBar = `  /* App bar adjustments */
  .app-bar {
    padding: 20px 40px;
    background: var(--bar-bg);
    border-bottom: 1px solid var(--border);
    display: flex;
    justify-content: flex-end; /* Align elements to the right */
  }

  .app-bar .bar-brand {
    display: none !important; /* Hide logo in top bar since it is in sidebar */
  }`;

normalized = normalized.replace(oldDesktopStart, newDesktopAppBar);

// 3. Replace Alerts Tab CSS in desktop media query for the new wrapper
const oldAlertsCSS = `  /* ── Alerts Tab Two-column layout ── */
  .alerts-body {
    display: grid;
    grid-template-columns: 1.2fr 1fr;
    gap: 32px;
    align-items: start;
  }

  .alerts-body > .alert-settings-card {
    grid-column: 1;
  }

  .alerts-body > .alerts-history-title {
    grid-column: 2;
    grid-row: 1;
    margin-top: 0!important;
    font-size: 14px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border);
  }

  .alerts-body > .alert-hist-item {
    grid-column: 2;
  }`;

const newAlertsCSS = `  /* ── Alerts Tab Two-column layout ── */
  .alerts-body {
    display: grid;
    grid-template-columns: 1.2fr 1fr;
    gap: 32px;
    align-items: start;
  }

  .alerts-body > .alert-settings-card {
    grid-column: 1;
  }

  .alerts-history-col {
    grid-column: 2;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .alerts-history-title {
    margin-top: 0!important;
    font-size: 13px;
    font-weight: 800;
    color: var(--t1);
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border);
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }`;

normalized = normalized.replace(oldAlertsCSS, newAlertsCSS);

// 4. Replace Profile Tab CSS in desktop media query for the new wrappers
const oldProfileCSS = `  /* ── Profile Tab Split Layout ── */
  .profile-body {
    display: grid;
    grid-template-columns: 1fr 1.5fr;
    gap: 32px;
    align-items: start;
    padding: 0 16px 20px;
  }

  .profile-hero {
    grid-column: 1;
    border-radius: 16px;
    border: 1px solid var(--border);
    background: var(--s2);
    padding: 30px 20px;
  }

  .prof-stats {
    grid-column: 1;
    margin: 0!important;
  }

  .profile-body > .prof-section {
    grid-column: 2;
    padding-top: 0!important;
  }

  .profile-body > .prof-section:nth-of-type(1) {
    grid-row: 1 / span 2;
  }

  .profile-body > .prof-section:last-of-type {
    grid-column: 1;
    border-top: none!important;
  }`;

const newProfileCSS = `  /* ── Profile Tab Split Layout ── */
  .profile-body {
    display: grid;
    grid-template-columns: 1fr 1.5fr;
    gap: 32px;
    align-items: start;
    padding: 0 16px 20px;
  }

  .profile-left-col {
    grid-column: 1;
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: 100%;
  }

  .profile-hero {
    border-radius: 16px;
    border: 1px solid var(--border);
    background: var(--s2);
    padding: 30px 20px;
    width: 100%;
  }

  .prof-stats {
    margin: 0!important;
    width: 100%;
  }

  .profile-right-col {
    grid-column: 2;
    display: flex;
    flex-direction: column;
    gap: 24px;
    width: 100%;
  }

  .profile-right-col > .prof-section {
    padding-top: 0!important;
    border-top: none!important;
  }`;

normalized = normalized.replace(oldProfileCSS, newProfileCSS);

const finalContent = css.includes('\r\n') ? normalized.replace(/\n/g, '\r\n') : normalized;
fs.writeFileSync('src/style.css', finalContent, 'utf-8');
console.log('CSS patch complete.');
