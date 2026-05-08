# 📜 ContextSwitch Feature Guide
### Intelligent Developer Dashboard & Session Recorder

---

## 1. Executive Overview
ContextSwitch is an autonomous developer session recorder and AI synthesis platform built to solve one of software engineering's most persistent pain points: the cognitive cost of context-switching.

When a developer is interrupted — whether by a meeting, a teammate, or the end of a workday — they lose their entire mental model of what they were building. Studies show it takes an average of 23 minutes to rebuild deep focus after an interruption. ContextSwitch eliminates that reconstruction time entirely.

### 1.1 The Problem It Solves
Every developer faces these friction points daily:
*   Spending 15–30 minutes every morning re-reading code to remember where they left off.
*   Writing verbose commit messages or hand-crafted "WIP" notes just to preserve mental state.
*   Struggling to hand off in-progress work to teammates without lengthy verbal explanations.
*   Failing to notice "stale" files that were touched weeks ago but never completed.

> **KEY INSIGHT:** ContextSwitch acts as a digital black box for your development process — silently recording every file save, error, and terminal command, then using AI to reconstruct the intent and hypothesis behind that work.

---

## 2. Core Features

### 2.1 AI Session Reconstruction
The flagship feature of ContextSwitch. When a developer ends a session, the platform sends all captured file-change events and diffs to the **Groq LPU inference engine**, which generates a human-readable narrative of what was accomplished.

**How It Works:**
1.  The VS Code extension captures file save events with diff summaries throughout the coding session.
2.  Events are batched and posted to the backend via the `/session/ingest` endpoint every 10 seconds.
3.  When the developer clicks "End & Summarize," the backend collects all session events.
4.  A multi-prompt strategy is submitted to the **Groq LPU API** for ultra-low-latency inference.
5.  The generated summary is persisted in the database and surfaced in both the VS Code sidebar and the web dashboard.

> **PERFORMANCE NOTE:** Groq's LPU achieves inference speeds of 500–700 tokens per second — orders of magnitude faster than GPU-based inference. A full session summary is generated in under 3 seconds.

### 2.2 VS Code Extension — Deep IDE Integration
The ContextSwitch VS Code extension (v0.0.5) provides seamless, zero-friction event capture directly inside the developer's IDE.

**Key Commands:**
*   `ContextSwitch: Open Side Panel`: Opens the session sidebar webview.
*   `ContextSwitch: Add Brain Dump`: Captures a free-text thought or hypothesis.
*   `ContextSwitch: Show Context Summary`: Displays the current AI context brief.

### 2.3 Analytics Dashboard
The React-based dashboard provides a high-fidelity, dark-mode analytics interface for reviewing development history.
*   **Overview**: Summary cards for total sessions, events, and active projects.
*   **Sessions**: Full history with AI summaries and event timelines.
*   **Analytics**: Activity heatmaps and language breakdowns.

---

## 3. Installation & Setup Guide

### 3.1 Backend Setup
```bash
npm install
cp .env.example .env
# Set GROQ_API_KEY, JWT_SECRET
npm run dev
```

### 3.2 Frontend Setup
```bash
cd frontend-v2
npm install
npm run dev
```

### 3.3 VS Code Extension
Install the pre-compiled package found at `extension/contextswitch-extension-0.0.7.vsix` directly into VS Code via the "Install from VSIX" command.

---

## 4. Technical Architecture
ContextSwitch uses a high-performance stack:
*   **Backend**: Node.js / Express
*   **Database**: SQLite with FTS5 for semantic memory.
*   **AI**: Groq LPU (llama-3) for real-time synthesis.
*   **Frontend**: React 18 / Vite / Tailwind.

---
*ContextSwitch — Version 0.0.5 — Samsung Prism 2026*
