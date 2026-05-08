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

### 1.2 Platform Architecture at a Glance
The platform is composed of four tightly integrated components that span three distinct layers:

| Layer | Component | Technology | Role |
| :--- | :--- | :--- | :--- |
| **Capture** | VS Code Extension v0.0.5 | TypeScript, VS Code API | Streams file saves, diffs, errors to backend |
| **Synthesis** | Express Backend API | Node.js, Express 4.18 | Auth, ingestion, AI orchestration |
| **Synthesis** | WebSocket Ingestion Server | ws library, port 3002 | Real-time event streaming from IDE |
| **Synthesis** | SQLite Database | Better-SQLite3, FTS5 | Persists all events, sessions, memory nodes |
| **Synthesis** | AI Engine | Groq LPU + llama-3 | Generates session summaries and handoffs |
| **Presentation** | React Dashboard | React 18, Vite, Tailwind | Analytics, heatmaps, session history |
| **Presentation** | Telegram Bot | Telegram Bot API | Mobile access to session summaries |

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

**AI Summary Types:**
| Summary Type | Prompt Strategy | Audience | Use Case |
| :--- | :--- | :--- | :--- |
| **Context Brief** | 30-second reconstruction | Developer themselves | Resume work instantly after any interruption |
| **Project Handoff** | Detailed technical overview | Teammate or reviewer | Zero-friction knowledge transfer |
| **Daily Digest** | High-level narrative | Manager or personal log | End-of-day progress tracking |

> **PERFORMANCE NOTE:** Groq's LPU (Language Processing Unit) achieves inference speeds of 500–700 tokens per second — orders of magnitude faster than GPU-based inference. This means a full session summary is generated and displayed in under 3 seconds.

### 2.2 VS Code Extension — Deep IDE Integration
The ContextSwitch VS Code extension (version 0.0.5) provides seamless, zero-friction event capture directly inside the developer's IDE.

**Extension Commands:**
| Command | Action |
| :--- | :--- |
| `ContextSwitch: Open Side Panel` | Opens the session sidebar webview |
| `ContextSwitch: Add Brain Dump` | Captures a free-text thought or hypothesis to current session |
| `ContextSwitch: Show Context Summary` | Displays current AI-generated context brief |
| `ContextSwitch: Reset and Login` | Clears stored auth token and shows the login screen |

**Event Capture Strategy:**
The extension uses an intelligent two-phase capture strategy to minimize noise while maximizing signal:
*   **Phase 1 — Aggregate in memory**: Every keystroke change is captured in a per-file change aggregator. No network calls are made during typing.
*   **Phase 2 — Flush on save**: When the developer saves a file, all aggregated changes are condensed into a single diff summary and pushed to the event queue.
*   **Periodic sync**: A background timer fires every 10 seconds to flush any queued events to the backend.

### 2.3 Analytics Dashboard
The React-based dashboard provides a high-fidelity, dark-mode analytics interface for reviewing development history.

**Dashboard Pages:**
| Page | Route | Description |
| :--- | :--- | :--- |
| **Overview** | `/` | Summary cards: total sessions, events, active projects, recent activity timeline |
| **Projects** | `/projects` | Per-project breakdown of sessions, file activity, and staleness scores |
| **Sessions** | `/sessions` | Full session history with AI summaries, event counts, duration, and CRUD actions |
| **Brain Dumps** | `/brain-dumps` | Free-text developer notes linked to sessions, with create/edit/delete |
| **Analytics** | `/analytics` | Charts and heatmaps: activity over time, most-edited files, language breakdown |

---

## 3. Installation & Setup Guide

### 3.1 Prerequisites
| Dependency | Version | Notes |
| :--- | :--- | :--- |
| **Node.js** | 18+ | Required for backend and frontend |
| **VS Code** | 1.80.0+ | Required for the extension |
| **Groq API Key** | Free tier | Get at console.groq.com |

### 3.2 Backend Setup
1.  Navigate to the root directory and install dependencies: `npm install`
2.  Create your environment configuration: `cp .env.example .env`
3.  Set `GROQ_API_KEY` and `JWT_SECRET` in your `.env` file.
4.  Start the server: `npm run dev`

### 3.3 VS Code Extension Installation
Install the pre-compiled package found at `extension/contextswitch-extension-0.0.7.vsix` directly into VS Code via the "Install from VSIX" command in the Extensions view.

---

## 4. Technical Architecture Deep Dive

### 4.1 Database Schema
All data is persisted in a single Better-SQLite3 database file:
*   `users`: Authentication and multi-tenancy anchor.
*   `sessions`: Session lifecycle and AI output.
*   `events`: Raw captured IDE events.
*   `brain_dumps`: Developer free-text notes.
*   `staleness`: Per-file activity tracking.

### 4.2 Security Model
*   JWT tokens are signed and stored securely in VS Code's Secret Storage.
*   Every database query includes strict `user_id` scoping for data isolation.
*   No source code is sent to external servers — only minimal event diffs.

---
*ContextSwitch — Version 0.0.5 — Samsung Prism 2026*
