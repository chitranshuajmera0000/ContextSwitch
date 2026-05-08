import * as vscode from "vscode";
import axios from "axios";

export class SessionViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "sessionView";
  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext
  ) { }

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      const token = await this._context.secrets.get("contextswitch.token");

      if (msg.type === "READY") {
        if (token) this.fetchAndUpdate(token);
        else webviewView.webview.postMessage({ type: "AUTH_REQUIRED" });
      }

      if (msg.type === "LOGIN") {
        try {
          const res = await axios.post("http://localhost:3001/auth/login", { email: msg.email, password: msg.password });
          await this._context.secrets.store("contextswitch.token", res.data.token);
          this.fetchAndUpdate(res.data.token);
        } catch (e: any) {
          webviewView.webview.postMessage({ type: "LOGIN_ERROR", error: e.response?.data?.error || "Login failed" });
        }
      }

      if (msg.type === "LOGOUT") {
        await this._context.secrets.delete("contextswitch.token");
        webviewView.webview.postMessage({ type: "AUTH_REQUIRED" });
      }

      if (msg.type === "REFRESH") {
        if (token) this.fetchAndUpdate(token);
      }

      if (msg.type === "END_SESSION") {
        try {
          const project = vscode.workspace.workspaceFolders?.[0]?.name || "unknown";
          await axios.post("http://localhost:3001/session/end-by-project", { project }, {
            headers: { Authorization: `Bearer ${token}` }
          });
          vscode.window.showInformationMessage("✅ Session ended. AI summary generated.");
          setTimeout(() => this.fetchAndUpdate(token || ""), 1000);
        } catch (e) {
          vscode.window.showErrorMessage("Failed to end session.");
        }
      }
    });

    webviewView.webview.html = this.getHtml();
  }

  private async fetchAndUpdate(token: string) {
    if (!this._view) return;
    try {
      const headers = { Authorization: `Bearer ${token}` };

      // 1. Get the most recent session (ignores project name mismatches)
      const historyRes = await axios.get(`http://localhost:3001/session/history?limit=1`, { headers });
      const sessions: any[] = historyRes.data?.sessions || [];

      if (!sessions.length) {
        this._view.webview.postMessage({
          type: "SESSION_UPDATE",
          data: { status: "idle", project: "No sessions yet", events: [], ai_summary: null },
          token
        });
        return;
      }

      const latest = sessions[0];

      // 2. Fetch events for that session
      const eventsRes = await axios.get(`http://localhost:3001/session/${latest.id}/events`, { headers });
      const events: any[] = eventsRes.data?.events || [];

      this._view.webview.postMessage({
        type: "SESSION_UPDATE",
        data: {
          status: latest.status,
          project: latest.project,
          ai_summary: latest.ai_summary || null,
          events: events.slice().reverse() // newest first
        },
        token
      });
    } catch (e: any) {
      console.error("[SessionViewProvider] Fetch failed:", e.message);
    }
  }

  private getHtml() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet">
  <style>
    /* ── Design Tokens (Developer Tools Pro – Dark) ── */
    :root {
      --bg:                   #131313;
      --bg-dim:               #131313;
      --surface:              #131313;
      --surface-low:          #1b1b1c;
      --surface-container:    #202020;
      --surface-high:         #2a2a2a;
      --surface-highest:      #353535;
      --surface-bright:       #393939;
      --surface-variant:      #353535;

      --on-surface:           #e5e2e1;
      --on-surface-variant:   #c1c6d7;
      --outline:              #8b90a0;
      --outline-variant:      #414755;

      --primary:              #adc6ff;
      --primary-container:    #4b8eff;
      --on-primary-container: #00285c;
      --inverse-primary:      #005bc1;
      --primary-fixed-dim:    #adc6ff;

      --secondary:            #4ce266;
      --secondary-fixed:      #6dff7f;
      --secondary-fixed-dim:  #4ce266;

      --tertiary:             #ffb950;

      --error:                #ffb4ab;

      --font-ui:   'Inter', var(--vscode-font-family), sans-serif;
      --font-code: 'JetBrains Mono', var(--vscode-editor-font-family), monospace;

      /* override VSCode sidebar bg to match */
      --vscode-sideBar-background: var(--bg);
    }

    /* ── Reset & Base ── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      height: 100%;
      background: var(--bg);
      color: var(--on-surface);
      font-family: var(--font-ui);
      font-size: 11px;
      line-height: 16px;
      overflow: hidden;
    }

    /* ── Layout ── */
    .panel {
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }

    /* ── Top Bar ── */
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 8px;
      background: var(--surface);
      border-bottom: 1px solid var(--outline-variant);
      flex-shrink: 0;
    }
    .topbar-left {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .topbar-title {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--on-surface-variant);
    }
    .topbar-icon {
      font-size: 14px;
      color: var(--on-surface-variant);
    }
    .icon-btn {
      background: none;
      border: none;
      cursor: pointer;
      color: var(--on-surface-variant);
      border-radius: 2px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2px;
      transition: background 0.15s;
    }
    .icon-btn:hover { background: var(--surface-variant); }
    .icon-btn .material-symbols-outlined { font-size: 16px; }

    /* ── Scroll Area ── */
    .scroll-area {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .scroll-area::-webkit-scrollbar { width: 6px; }
    .scroll-area::-webkit-scrollbar-track { background: transparent; }
    .scroll-area::-webkit-scrollbar-thumb { background: var(--outline-variant); border-radius: 3px; }

    /* ── Keyframes ── */
    @keyframes shimmer {
      0%   { background-position: -200% 0; }
      100% { background-position:  200% 0; }
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes pulse-ring {
      0%   { box-shadow: 0 0 0 0 rgba(173,198,255,0.4); }
      70%  { box-shadow: 0 0 0 6px rgba(173,198,255,0); }
      100% { box-shadow: 0 0 0 0 rgba(173,198,255,0); }
    }

    /* ── Auth View ── */
    #auth-view { display: none; flex-direction: column; gap: 0; }
    #auth-view.visible { display: flex; }

    /* Branding hero */
    .auth-hero {
      background: linear-gradient(135deg, #0d1b3e 0%, #001a55 50%, #0a2a6e 100%);
      border-radius: 6px 6px 0 0;
      padding: 20px 16px 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      border: 1px solid rgba(173,198,255,0.15);
      border-bottom: none;
      position: relative;
      overflow: hidden;
    }
    .auth-hero::before {
      content: '';
      position: absolute;
      inset: 0;
      background: radial-gradient(ellipse at 50% 0%, rgba(173,198,255,0.12) 0%, transparent 70%);
      pointer-events: none;
    }
    .auth-logo-ring {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: rgba(173,198,255,0.1);
      border: 1px solid rgba(173,198,255,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      animation: pulse-ring 2.5s ease-out infinite;
    }
    .auth-logo-ring .material-symbols-outlined {
      font-size: 20px;
      color: var(--primary);
    }
    .auth-brand-name {
      font-size: 13px;
      font-weight: 700;
      color: #e8eeff;
      letter-spacing: 0.03em;
    }
    .auth-brand-sub {
      font-size: 10px;
      color: rgba(173,198,255,0.6);
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-top: -4px;
    }

    /* Auth form card */
    .auth-form-card {
      background: var(--surface-container);
      border: 1px solid var(--outline-variant);
      border-top: none;
      border-radius: 0 0 6px 6px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .auth-form-label {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--on-surface-variant);
      margin-bottom: 2px;
      display: block;
    }
    .auth-field-wrap {
      position: relative;
    }
    .auth-field-icon {
      position: absolute;
      left: 8px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 14px;
      color: var(--on-surface-variant);
      pointer-events: none;
    }
    .auth-field-wrap .input-field {
      padding-left: 30px;
    }
    .auth-divider {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 10px;
      color: var(--on-surface-variant);
    }
    .auth-divider::before, .auth-divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--outline-variant);
    }

    /* Spinner */
    .spinner {
      width: 13px;
      height: 13px;
      border: 2px solid rgba(255,255,255,0.2);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      flex-shrink: 0;
    }
    .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    /* ── Skeleton shimmer ── */
    .skeleton-card {
      background: rgba(75,142,255,0.06);
      border: 1px solid rgba(75,142,255,0.2);
      border-radius: 4px;
      padding: 8px;
      animation: fadeIn 0.3s ease;
    }
    .skeleton-title {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 10px;
    }
    .skeleton-title-text {
      height: 10px;
      width: 80px;
      background: linear-gradient(90deg, var(--surface-high) 25%, var(--surface-bright) 50%, var(--surface-high) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
      border-radius: 3px;
    }
    .skeleton-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: rgba(173,198,255,0.4);
    }
    .skeleton-line {
      height: 9px;
      border-radius: 3px;
      background: linear-gradient(90deg, var(--surface-high) 25%, var(--surface-bright) 50%, var(--surface-high) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
      margin-bottom: 6px;
    }
    .skeleton-line:last-child { margin-bottom: 0; width: 60%; }
    .skeleton-status {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
      color: rgba(173,198,255,0.5);
      font-style: italic;
      margin-top: 4px;
    }
    .skeleton-spinner {
      width: 10px;
      height: 10px;
      border: 1.5px solid rgba(173,198,255,0.2);
      border-top-color: rgba(173,198,255,0.7);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    /* ── Cards ── */
    .card {
      background: var(--surface-container);
      border: 1px solid var(--outline-variant);
      border-radius: 4px;
      padding: 8px;
    }

    /* ── Status Card ── */
    .status-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .status-indicator {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--outline);
      flex-shrink: 0;
      transition: background 0.3s, box-shadow 0.3s;
    }
    .pulse-dot.active {
      background: var(--secondary-fixed);
      box-shadow: 0 0 6px rgba(109,255,127,0.5);
    }
    .status-label {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.02em;
      color: var(--on-surface);
    }
    .sign-out-btn {
      background: none;
      border: none;
      cursor: pointer;
      font-family: var(--font-ui);
      font-size: 11px;
      color: var(--on-surface-variant);
      transition: color 0.15s;
      padding: 0;
    }
    .sign-out-btn:hover { color: var(--primary); }

    .divider {
      height: 1px;
      background: var(--outline-variant);
      margin: 0 -8px;
    }

    .stats-row {
      display: flex;
      margin-top: 8px;
    }
    .stat-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4px 0;
    }
    .stat-value {
      font-size: 16px;
      font-weight: 700;
      color: var(--on-surface);
      line-height: 1.2;
    }
    .stat-label {
      font-family: var(--font-code);
      font-size: 10px;
      color: var(--on-surface-variant);
      margin-top: 2px;
    }
    .stat-divider {
      width: 1px;
      background: var(--outline-variant);
      align-self: stretch;
    }

    /* ── AI Summary Card ── */
    .summary-card {
      display: none;
      background: rgba(75,142,255,0.08);
      border: 1px solid var(--primary-container);
      border-radius: 4px;
      padding: 8px;
    }
    .summary-card.visible { display: block; }
    .summary-title {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--primary);
      margin-bottom: 6px;
    }
    .summary-title .material-symbols-outlined { font-size: 13px; }
    .summary-text {
      font-size: 11px;
      line-height: 1.6;
      color: var(--on-surface);
    }

    /* ── Buttons ── */
    .btn-primary {
      width: 100%;
      height: 28px;
      background: var(--inverse-primary, #005bc1);
      color: var(--on-primary-container);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-family: var(--font-ui);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.02em;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      transition: background 0.15s;
    }
    .btn-primary:hover { background: var(--primary-container); }

    .btn-ghost {
      width: 100%;
      height: 28px;
      background: transparent;
      color: var(--on-surface-variant);
      border: 1px solid var(--outline-variant);
      border-radius: 4px;
      cursor: pointer;
      font-family: var(--font-ui);
      font-size: 11px;
      font-weight: 400;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      transition: background 0.15s, color 0.15s;
    }
    .btn-ghost:hover { background: var(--surface-container); color: var(--on-surface); }

    /* ── Inputs ── */
    .input-group { display: flex; flex-direction: column; gap: 6px; }
    .input-field {
      width: 100%;
      height: 28px;
      background: var(--surface-low);
      color: var(--on-surface);
      border: 1px solid var(--outline-variant);
      border-radius: 4px;
      padding: 0 8px;
      font-family: var(--font-ui);
      font-size: 11px;
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .input-field:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 1px var(--primary);
    }
    .error-msg {
      font-size: 10px;
      color: var(--error);
      margin-top: -2px;
    }

    /* ── Section Header ── */
    .section-header {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--on-surface-variant);
      padding: 4px 0 2px;
    }

    /* ── Feed Cards ── */
    .feed { display: flex; flex-direction: column; gap: 4px; padding-bottom: 16px; }
    .feed-card {
      background: var(--surface-container);
      border: 1px solid var(--outline-variant);
      border-radius: 4px;
      padding: 6px 8px;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .feed-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .feed-card-left {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }
    .feed-card-left .material-symbols-outlined {
      font-size: 14px;
      color: var(--on-surface-variant);
      flex-shrink: 0;
    }
    .feed-card-meta { display: flex; flex-direction: column; min-width: 0; }
    .feed-filename {
      font-size: 11px;
      font-weight: 500;
      color: var(--on-surface);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 150px;
    }
    .feed-info {
      font-family: var(--font-code);
      font-size: 10px;
      color: var(--on-surface-variant);
      margin-top: 1px;
    }

    /* View button */
    .view-btn {
      background: var(--surface-variant);
      border: 1px solid var(--outline-variant);
      color: var(--on-surface);
      font-family: var(--font-ui);
      font-size: 10px;
      font-weight: 400;
      padding: 2px 8px;
      border-radius: 2px;
      cursor: pointer;
      flex-shrink: 0;
      transition: background 0.15s;
    }
    .view-btn:hover { background: var(--surface-bright); }

    /* Diff box */
    .diff-box {
      background: var(--bg-dim);
      border: 1px solid var(--outline-variant);
      border-radius: 2px;
      padding: 5px 6px;
      font-family: var(--font-code);
      font-size: 10px;
      line-height: 14px;
      color: var(--on-surface-variant);
      overflow-x: hidden;
      word-break: break-all;
    }
    .diff-box .diff-line { display: block; padding: 1px 3px; border-radius: 2px; margin-bottom: 1px; }
    .diff-box .diff-add { color: var(--secondary-fixed-dim); background: rgba(76,226,102,0.08); }
    .diff-box .diff-remove { color: var(--error); background: rgba(255,180,171,0.08); }
    .diff-box .diff-ctx { color: var(--on-surface-variant); }
    .diff-box .diff-dim { color: var(--on-surface-variant); font-style: italic; }
    .diff-more { font-size: 10px; color: var(--on-surface-variant); margin-top: 3px; }

    /* Collapsed state – diff hidden by default */
    .feed-diff { display: none; }
    .feed-card.expanded .feed-diff { display: block; }

    /* Chevron toggle */
    .chevron {
      font-size: 14px;
      color: var(--on-surface-variant);
      transition: transform 0.2s;
      cursor: pointer;
    }
    .feed-card.expanded .chevron { transform: rotate(180deg); }

    /* Empty state */
    .empty-state {
      text-align: center;
      padding: 24px 12px;
      color: var(--on-surface-variant);
      font-size: 11px;
    }
    .empty-state .material-symbols-outlined {
      font-size: 32px;
      display: block;
      margin: 0 auto 8px;
      opacity: 0.4;
    }

    /* ── Main view hidden by default ── */
    #main-view { display: none; flex-direction: column; gap: 8px; }
    #main-view.visible { display: flex; }
  </style>
</head>
<body>
<div class="panel">

  <!-- Top Bar -->
  <div class="topbar">
    <div class="topbar-left">
      <span class="material-symbols-outlined topbar-icon">terminal</span>
      <span class="topbar-title">ContextSwitch: Session</span>
    </div>
    <button class="icon-btn" title="More options">
      <span class="material-symbols-outlined">more_vert</span>
    </button>
  </div>

  <!-- Scroll Area -->
  <div class="scroll-area">

    <!-- ── AUTH VIEW ── -->
    <div id="auth-view">
      <!-- Branding Hero -->
      <div class="auth-hero">
        <div class="auth-logo-ring">
          <span class="material-symbols-outlined">data_exploration</span>
        </div>
        <div class="auth-brand-name">ContextSwitch</div>
        <div class="auth-brand-sub">Developer Session Tracker</div>
      </div>
      <!-- Form Card -->
      <div class="auth-form-card">
        <div>
          <span class="auth-form-label">Email</span>
          <div class="auth-field-wrap">
            <span class="material-symbols-outlined auth-field-icon">alternate_email</span>
            <input class="input-field" type="email" id="email" value="admin@example.com" placeholder="you@example.com" autocomplete="email">
          </div>
        </div>
        <div>
          <span class="auth-form-label">Password</span>
          <div class="auth-field-wrap">
            <span class="material-symbols-outlined auth-field-icon">key</span>
            <input class="input-field" type="password" id="password" value="admin123" placeholder="••••••••" autocomplete="current-password">
          </div>
        </div>
        <span id="login-error" class="error-msg" style="display:none"></span>
        <button class="btn-primary" id="login-btn" onclick="login()">
          <span class="material-symbols-outlined" id="login-icon" style="font-size:13px">login</span>
          <span id="login-label">Sign In</span>
        </button>
        <div class="auth-divider">secured by contextswitch</div>
      </div>
    </div>

    <!-- ── MAIN VIEW ── -->
    <div id="main-view">

      <!-- Status Card -->
      <div class="card">
        <div class="status-row">
          <div class="status-indicator">
            <div id="pulse-dot" class="pulse-dot"></div>
            <span id="status-label" class="status-label">Ready</span>
          </div>
          <button class="sign-out-btn" onclick="logout()">Sign Out</button>
        </div>
        <div class="divider"></div>
        <div class="stats-row">
          <div class="stat-item">
            <span id="stat-saves" class="stat-value">0</span>
            <span class="stat-label">Saves</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <span id="stat-files" class="stat-value">0</span>
            <span class="stat-label">Files</span>
          </div>
        </div>
      </div>

      <!-- AI Summary Loading Skeleton -->
      <div id="summary-loading" class="skeleton-card" style="display:none">
        <div class="skeleton-title">
          <div class="skeleton-dot"></div>
          <div class="skeleton-title-text"></div>
        </div>
        <div class="skeleton-line" style="width:100%"></div>
        <div class="skeleton-line" style="width:85%"></div>
        <div class="skeleton-line" style="width:92%"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-status">
          <div class="skeleton-spinner"></div>
          Generating AI summary…
        </div>
      </div>

      <!-- AI Summary Card -->
      <div id="summary-card" class="summary-card">
        <div class="summary-title">
          <span class="material-symbols-outlined">auto_awesome</span>
          AI Summary
        </div>
        <div id="summary-text" class="summary-text"></div>
      </div>

      <!-- Action Buttons -->
      <button class="btn-primary" onclick="endSession()">
        <span class="material-symbols-outlined" style="font-size:13px">stop_circle</span>
        End &amp; Summarize
      </button>
      <button class="btn-ghost" onclick="refresh()">
        <span class="material-symbols-outlined" style="font-size:13px">refresh</span>
        Refresh Feed
      </button>

      <!-- Section Header -->
      <div class="section-header">Activity Feed</div>

      <!-- Feed -->
      <div class="feed" id="feed"></div>

    </div>
  </div><!-- /scroll-area -->
</div><!-- /panel -->

<script>
  const vscode = acquireVsCodeApi();
  let socket;

  /* ── Auth ── */
  function login() {
    const errEl = document.getElementById('login-error');
    errEl.style.display = 'none';
    vscode.postMessage({
      type: 'LOGIN',
      email: document.getElementById('email').value,
      password: document.getElementById('password').value
    });
  }
  function logout() { vscode.postMessage({ type: 'LOGOUT' }); }

  function login() {
    const errEl = document.getElementById('login-error');
    const btn   = document.getElementById('login-btn');
    const icon  = document.getElementById('login-icon');
    const label = document.getElementById('login-label');
    errEl.style.display = 'none';
    btn.disabled = true;
    icon.outerHTML = '<span class="spinner" id="login-icon"></span>';
    label.textContent = 'Signing in…';
    vscode.postMessage({
      type: 'LOGIN',
      email: document.getElementById('email').value,
      password: document.getElementById('password').value
    });
  }

  function endSession() {
    // Show loading skeleton immediately
    document.getElementById('summary-loading').style.display = 'block';
    document.getElementById('summary-card').classList.remove('visible');
    // Disable the End & Summarize button
    const endBtn = document.querySelector('.btn-primary[onclick="endSession()"]');
    if (endBtn) endBtn.disabled = true;
    vscode.postMessage({ type: 'END_SESSION' });
  }

  function refresh() { vscode.postMessage({ type: 'REFRESH' }); }

  /* ── Card Toggle ── */
  function toggleCard(card) {
    card.classList.toggle('expanded');
  }

  /* ── WebSocket ── */
  function connectWS(token) {
    if (socket) socket.close();
    socket = new WebSocket('ws://localhost:3002');
    socket.onopen = () => socket.send(JSON.stringify({ type: 'auth', token }));
    socket.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'events_updated' || msg.type === 'session_summary_ready') {
        vscode.postMessage({ type: 'REFRESH' });
      }
    };
    socket.onclose = () => setTimeout(() => connectWS(token), 3000);
  }

  /* ── Diff Rendering ── */
  function renderDiff(ev) {
    if (!ev.diff) {
      return '<div class="diff-box"><span class="diff-dim">No text changes tracked.</span></div>';
    }
    const lines = ev.diff.split('\\n');
    const preview = lines.slice(0, 12);
    const html = preview.map(l => {
      const safe = l.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      if (safe.startsWith('+') || safe.startsWith('Added:')) {
        return \`<span class="diff-line diff-add">\${safe}</span>\`;
      }
      if (safe.startsWith('-') || safe.startsWith('Removed:')) {
        return \`<span class="diff-line diff-remove">\${safe}</span>\`;
      }
      if (safe.includes('no significant text changes') || safe.includes('File saved')) {
        return \`<span class="diff-line diff-dim">\${safe}</span>\`;
      }
      return \`<span class="diff-line diff-ctx">\${safe}</span>\`;
    }).join('');
    const more = lines.length > 12
      ? \`<div class="diff-more">… \${lines.length - 12} more lines</div>\`
      : '';
    return \`<div class="diff-box">\${html}\${more}</div>\`;
  }

  /* ── Message Handler ── */
  window.addEventListener('message', event => {
    const msg = event.data;

    if (msg.type === 'AUTH_REQUIRED') {
      document.getElementById('auth-view').classList.add('visible');
      document.getElementById('main-view').classList.remove('visible');
    }

    if (msg.type === 'LOGIN_ERROR') {
      // Reset button state
      const btn = document.getElementById('login-btn');
      if (btn) btn.disabled = false;
      const spinnerEl = document.getElementById('login-icon');
      if (spinnerEl && spinnerEl.classList.contains('spinner')) {
        spinnerEl.outerHTML = '<span class="material-symbols-outlined" id="login-icon" style="font-size:13px">login</span>';
      }
      const labelEl = document.getElementById('login-label');
      if (labelEl) labelEl.textContent = 'Sign In';
      const errEl = document.getElementById('login-error');
      errEl.textContent = msg.error;
      errEl.style.display = 'block';
    }

    if (msg.type === 'SESSION_UPDATE') {
      document.getElementById('auth-view').classList.remove('visible');
      document.getElementById('main-view').classList.add('visible');

      const d = msg.data;
      const isActive = d.status === 'active';
      document.getElementById('status-label').textContent = isActive ? (d.project || 'Tracking') : 'Idle';
      document.getElementById('pulse-dot').className = 'pulse-dot' + (isActive ? ' active' : '');

      /* AI Summary – hide loader, show result */
      document.getElementById('summary-loading').style.display = 'none';
      const endBtn = document.querySelector('.btn-primary[onclick="endSession()"]');
      if (endBtn) endBtn.disabled = false;
      const summaryCard = document.getElementById('summary-card');
      if (d.ai_summary) {
        summaryCard.classList.add('visible');
        document.getElementById('summary-text').textContent = d.ai_summary;
      } else {
        summaryCard.classList.remove('visible');
      }

      /* Stats */
      const events = d.events || [];
      document.getElementById('stat-saves').textContent = events.filter(e => e.type === 'file:save').length;
      document.getElementById('stat-files').textContent = new Set(events.map(e => e.filePath)).size;

      /* Feed */
      const feed = document.getElementById('feed');
      if (!events.length) {
        feed.innerHTML = \`
          <div class="empty-state">
            <span class="material-symbols-outlined">inbox</span>
            No file edits tracked yet.
          </div>\`;
      } else {
        feed.innerHTML = events.map((ev, i) => {
          const file = ev.filePath ? ev.filePath.split(/[\\\\/]/).pop() : 'Unknown';
          const time = new Date(ev.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return \`
            <div class="feed-card" id="card-\${i}">
              <div class="feed-card-header" onclick="toggleCard(document.getElementById('card-\${i}'))" style="cursor:pointer">
                <div class="feed-card-left">
                  <span class="material-symbols-outlined">description</span>
                  <div class="feed-card-meta">
                    <span class="feed-filename" title="\${ev.filePath || ''}">\${file}</span>
                    <span class="feed-info">\${ev.type} &bull; \${time}</span>
                  </div>
                </div>
                <div style="display:flex;align-items:center;gap:4px">
                  <button class="view-btn" onclick="event.stopPropagation()">View</button>
                  <span class="material-symbols-outlined chevron">expand_more</span>
                </div>
              </div>
              <div class="feed-diff">
                \${renderDiff(ev)}
              </div>
            </div>\`;
        }).join('');
      }

      /* WS */
      if (msg.token && (!socket || socket.readyState !== WebSocket.OPEN)) {
        connectWS(msg.token);
      }
    }
  });

  vscode.postMessage({ type: 'READY' });
</script>
</body>
</html>`;
  }
}
