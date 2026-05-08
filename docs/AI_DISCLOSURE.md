# ⚖️ ContextSwitch AI Disclosure

This document provides a transparent breakdown of the Artificial Intelligence systems integrated into the ContextSwitch platform, as required for the Samsung Prism Hackathon 2026.

## 1. AI Models & Infrastructure

| Component | Model | Provider | Infrastructure |
| :--- | :--- | :--- | :--- |
| **Session Reconstruction** | Llama-3-70b-8192 | Meta / Groq | Groq LPU (Language Processing Unit) |
| **Context Synthesis** | Llama-3-8b-8192 | Meta / Groq | Groq LPU |
| **Semantic Indexing** | SQLite FTS5 | Local | Native Full-Text Search |

## 2. AI Implementation Details

### 2.1 Autonomous Session Summarization
ContextSwitch uses a multi-prompt strategy to process raw development events (file saves, diffs, errors). The system performs:
*   **Diff Analysis**: Identifying the technical changes made during a session.
*   **Intent Extraction**: Deducing the "why" behind the code changes using LLM reasoning.
*   **Synthesis**: Consolidating multiple events into a concise narrative.

### 2.2 Low-Latency Inference
By utilizing **Groq's LPU** (Language Processing Unit), ContextSwitch achieves inference speeds of **500+ tokens per second**. This ensures that session summaries are generated in real-time (typically < 3 seconds) without interrupting the developer's workflow.

## 3. Data Privacy & Security

ContextSwitch is designed with a **privacy-first** approach to AI:
*   **No Code Uploads**: The system does **not** upload entire source code files to the AI provider. Only granular diff summaries and metadata are processed.
*   **Data Isolation**: All AI-generated context is stored in a multi-tenant SQLite database, ensuring strict user-level isolation.
*   **Local Processing**: Authentication and data management are handled entirely on the local server instance.

## 4. Human-in-the-Loop

AI-generated summaries are intended to assist the developer, not replace their judgment.
*   **Reviewable**: All summaries are displayed in the dashboard and sidebar for developer review.
*   **Editable**: Developers can enrich AI summaries with manual "Brain Dumps" to ensure perfect accuracy.

---
*ContextSwitch — Samsung Prism 2026 Submission*
