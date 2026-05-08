# 🚀 ContextSwitch: Intelligent Developer Dashboard

[![Samsung Prism](https://img.shields.io/badge/Samsung-Prism-blue.svg)](https://www.samsungprism.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://reactjs.org/)
[![Express](https://img.shields.io/badge/Express-4.18-lightgrey.svg)](https://expressjs.com/)
[![Groq](https://img.shields.io/badge/AI-Groq%20LPU-orange.svg)](https://groq.com/)

> **Bridging the gap between code changes and high-level project context.**

ContextSwitch is an autonomous developer recorder and AI synthesis platform. It tracks granular activity in VS Code and uses AI to reconstruct the "intent" behind development sessions, providing a data-driven dashboard for focus, heatmaps, and session history.

---

## 🏆 Hackathon Submission
This repository contains the complete source code, documentation, and pre-compiled assets for the **ContextSwitch** platform.

### 🎥 Live Demo Video
[![Watch the Demo](https://img.shields.io/badge/Google%20Drive-Watch%20Demo-red?style=for-the-badge&logo=googledrive)](https://drive.google.com/file/d/1-2F0IU8upqdYtcoG0Ai7ItmxXKYO_E_s/view?usp=sharing)
*(Click above to view the system in action on Google Drive)*

### 📂 Documentation Suite
Explore our comprehensive technical and product documentation:
*   [📘 Pitch Document](docs/PITCH.md): Problem, Solution, and Value Proposition.
*   [🏛️ Technical Architecture](docs/ARCHITECTURE.md): System design, security, and AI pipeline.
*   [⚖️ AI Disclosure](docs/ContextSwitch_AI_Disclosure.docx): Breakdown of AI usage and model details.
*   [📜 Feature Guide](docs/FEATURE_GUIDE.md): Full end-to-end user manual.
*   [🎥 Video Demo](docs/VIDEO_DEMO.md): Quick access to the system demonstration.

---

## ✨ Key Features

- **🧠 AI Session Reconstruction**: Automatically generates summaries of your coding sessions using the high-speed **Groq LPU Inference**.
- **🔐 Multi-User Architecture**: Secure authentication system with JWT and data isolation.
- **🤖 Interactive Telegram Bot**: Real-time project status and interactive AI commands via mobile.
- **📊 Premium Dashboard**: A high-fidelity, dark-mode analytics interface.
- **🔥 File Heatmaps**: Advanced staleness tracking to identify abandoned work.
- **🔌 Deep IDE Integration**: Real-time event capture including errors and terminal logs.

---

## 📂 Project Structure

| Component | Path | Technology |
| :--- | :--- | :--- |
| **Backend API** | `/` | Node.js, Express, Better-SQLite3 |
| **Ingestion Server** | `/src/websocket` | WebSockets (ws) |
| **Dashboard UI** | `/frontend-v2` | React 18, Vite, Tailwind |
| **VS Code Extension** | `/extension` | VS Code Extension API |

---

## 🚀 Quick Start (Panel Guide)

### 1. Backend Setup
```bash
npm install
cp .env.example .env
# Add GROQ_API_KEY and TELEGRAM_BOT_TOKEN
npm run dev
```

### 2. Frontend Setup
```bash
cd frontend-v2
npm install
npm run dev
```
*View dashboard at `http://localhost:5173`.*

### 3. Extension Installation
Install the pre-compiled package found at `extension/contextswitch-extension-0.0.7.vsix` directly into VS Code.

---

## 📜 Acknowledgements
Developed with passion by **Anurag (P2)**, **Chitranshu (P3)**, and **Vaibhav (P1)** as part of the **Samsung Prism** program.
