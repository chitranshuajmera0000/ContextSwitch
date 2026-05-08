import dotenv from 'dotenv';
import db from '../db';
import { aiReason } from './aiService';
import { buildContextFromMemory } from './memoryService';
import { sendNotification as sendTelegramMessage, ackInteraction as answerCallbackQuery } from '../comms';
dotenv.config();

// Use global fetch when available (Node 18+), otherwise fall back to node-fetch
const fetchImpl: any = (globalThis as any).fetch || require('node-fetch');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

let offset = 0;
let polling = false;

/**
 * Handles incoming Telegram messages (e.g., user asking questions via bot).
 * Currently a stub — extend to handle /start, questions, commands etc.
 */
export function startTelegramPolling(): void {
    if (!BOT_TOKEN) {
        console.log('[Telegram] Inbound polling disabled — TELEGRAM_BOT_TOKEN not set.');
        return;
    }
    if (polling) return;
    polling = true;
    console.log('[Telegram] Inbound polling started.');
    pollLoop();
}

async function pollLoop(): Promise<void> {
    while (polling) {
        try {
            const res = await fetchImpl(
                `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${offset}&timeout=20`
            );
            if (!res.ok) {
                const body = await res.text();
                console.warn('[Telegram] getUpdates failed:', res.status, body);
                // Common cause: webhook is set for this bot — getUpdates will not work when webhook active.
                await sleep(5000);
                continue;
            }
            const data: any = await res.json();
            if (data.ok && Array.isArray(data.result)) {
                for (const update of data.result) {
                    offset = update.update_id + 1;
                    await handleUpdate(update);
                }
            }
        } catch {
            await sleep(5000);
        }
    }
}

export async function handleUpdate(update: any): Promise<void> {
    if (update.callback_query) {
        const cb = update.callback_query;
        const text = cb.data; // e.g. "/status"
        const chatId = cb.message.chat.id;
        await answerCallbackQuery(cb.id);
        await processCommand(text, chatId, update.update_id);
        return;
    }

    const msg = update.message;
    if (!msg || !msg.text) return;
    const text: string = msg.text.trim();
    const chatId: number = msg.chat.id;

    console.log(`[Telegram] Inbound from ${chatId}: ${text}`);

    // Persist inbound message for conversation history
    try {
        const ts = msg.date ? msg.date * 1000 : Date.now();
        db.prepare(`INSERT INTO telegram_messages (update_id, chat_id, direction, message, ts) VALUES (?, ?, 'inbound', ?, ?)`)
          .run(update.update_id, String(chatId), text, ts);
    } catch (err) {
        console.warn('[Telegram] Failed to persist inbound message', err);
    }

    await processCommand(text, chatId, update.update_id);
}

async function processCommand(text: string, chatId: number, updateId?: number): Promise<void> {
    if (text.startsWith('/link ')) {
        const email = text.split(' ')[1];
        if (!email) {
            await sendTelegramMessage('Usage: /link your@email.com', String(chatId));
            return;
        }
        try {
            const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as any;
            if (!user) {
                await sendTelegramMessage('❌ User not found in ContextSwitch. Please register via the VS Code extension first.', String(chatId));
                return;
            }
            db.prepare('UPDATE users SET telegram_chat_id = ? WHERE id = ?').run(String(chatId), user.id);
            await sendTelegramMessage(`✅ Successfully linked! You will now receive session updates for <b>${email}</b>.`, String(chatId));
                                // Persist outbound reply
                                db.prepare(`INSERT INTO telegram_messages (update_id, chat_id, direction, message, ts) VALUES (?, ?, 'outbound', ?, ?)`)
                                    .run(updateId || null, String(chatId), `✅ Successfully linked! You will now receive session updates for ${email}.`, Date.now());
        } catch (err) {
            await sendTelegramMessage('❌ Error linking account.', String(chatId));
                                db.prepare(`INSERT INTO telegram_messages (update_id, chat_id, direction, message, ts) VALUES (?, ?, 'outbound', ?, ?)`)
                                    .run(updateId || null, String(chatId), '❌ Error linking account.', Date.now());
        }
        return;
    }

    if (text.startsWith('/start') || text.startsWith('/help')) {
        const helpMsg = `🚀 <b>ContextSwitch Bot</b>\n\n` +
            `<b>📊 Tracking</b>\n` +
            `• /status — Current session summary\n` +
            `• /activity — Detailed event breakdown\n` +
            `• /report — Today's productivity summary\n\n` +
            `<b>🕒 History</b>\n` +
            `• /summary — AI brief of last session\n` +
            `• /notes — Your last 5 brain dumps\n` +
            `• /stats — All-time stats\n\n` +
            `<b>📈 Analysis</b>\n` +
            `• /heatmap — Activity by hour\n` +
            `• /files — Top 5 most edited files\n\n` +
            `<b>🧠 AI & Linking</b>\n` +
            `• /link email — Link your account\n` +
            `• Ask a question ending with <b>?</b> for AI insights\n\n` +
            `<i>Tip: Commands starting with / are clickable!</i>`;

        const keyboard = {
            inline_keyboard: [
                [{ text: "📊 Status", callback_data: "/status" }, { text: "💾 Activity", callback_data: "/activity" }],
                [{ text: "✨ Summary", callback_data: "/summary" }, { text: "📓 Notes", callback_data: "/notes" }],
                [{ text: "📈 Heatmap", callback_data: "/heatmap" }, { text: "❓ Help", callback_data: "/help" }]
            ]
        };

        await sendTelegramMessage(helpMsg, String(chatId), keyboard);
        return;
    }

    // 1. Identify user for all subsequent commands
    const user = db.prepare('SELECT id, email FROM users WHERE telegram_chat_id = ?').get(String(chatId)) as any;

    if (text.startsWith('/link ')) {
        const email = text.split(' ')[1];
        if (!email) {
            await sendTelegramMessage('Usage: /link your@email.com', String(chatId));
            return;
        }
        try {
            const targetUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as any;
            if (!targetUser) {
                await sendTelegramMessage('❌ User not found in ContextSwitch. Please register via the dashboard first.', String(chatId));
                return;
            }
            db.prepare('UPDATE users SET telegram_chat_id = ? WHERE id = ?').run(String(chatId), targetUser.id);
            await sendTelegramMessage(`✅ Successfully linked! You will now receive session updates for <b>${email}</b>.`, String(chatId));
        } catch (err) {
            await sendTelegramMessage('❌ Error linking account.', String(chatId));
        }
        return;
    }

    if (!user) {
        await sendTelegramMessage('❌ Your account is <b>not linked</b>. Use <code>/link your@email.com</code> to start.', String(chatId));
        return;
    }

    // --- LOGGED IN COMMANDS ---

    if (text.startsWith('/status')) {
        const session = db.prepare(`SELECT * FROM sessions WHERE user_id = ? ORDER BY start_ts DESC LIMIT 1`).get(user.id) as any;
        if (!session || session.status === 'ended') {
            await sendTelegramMessage("⚪ No active session right now.\n\nStart VS Code to begin tracking.", String(chatId));
            return;
        }
        const duration = Math.floor((Date.now() - session.start_ts) / 60000);
        const events = db.prepare(`SELECT COUNT(*) as count FROM events WHERE user_id = ? AND ts >= ?`).get(user.id, session.start_ts) as any;
        const files = db.prepare(`SELECT COUNT(DISTINCT filePath) as count FROM events WHERE user_id = ? AND ts >= ? AND filePath IS NOT NULL`).get(user.id, session.start_ts) as any;
        
        await sendTelegramMessage(
            `🟢 <b>Active Session: ${session.project}</b>\n` +
            `⏱ Duration: ${duration}m\n` +
            `📝 Activity: ${events?.count || 0} events across ${files?.count || 0} files`,
            String(chatId)
        );
        return;
    }

    if (text.startsWith('/activity')) {
        const session = db.prepare(`SELECT * FROM sessions WHERE user_id = ? ORDER BY start_ts DESC LIMIT 1`).get(user.id) as any;
        if (!session) { await sendTelegramMessage("No sessions found.", String(chatId)); return; }
        
        const startTs = session.start_ts;
        const endTs = session.end_ts || Date.now();
        
        const saves = db.prepare(`SELECT COUNT(*) as c FROM events WHERE user_id = ? AND ts >= ? AND ts <= ? AND type = 'file:save'`).get(user.id, startTs, endTs) as any;
        const errs  = db.prepare(`SELECT COUNT(*) as c FROM events WHERE user_id = ? AND ts >= ? AND ts <= ? AND type = 'diagnostic:error'`).get(user.id, startTs, endTs) as any;
        const topFiles = db.prepare(`SELECT filePath, COUNT(*) as c FROM events WHERE user_id = ? AND ts >= ? AND ts <= ? AND filePath IS NOT NULL GROUP BY filePath ORDER BY c DESC LIMIT 3`).all(user.id, startTs, endTs) as any[];

        let msg = `📊 <b>Activity: ${session.project}</b>\n\n`;
        msg += `💾 Saves: <b>${saves?.c || 0}</b>\n`;
        msg += `⚠️ Errors: <b>${errs?.c || 0}</b>\n\n`;
        if (topFiles.length > 0) {
            msg += `<b>🔥 Hot Files:</b>\n`;
            topFiles.forEach(f => { msg += ` • ${f.filePath.split(/[\\/]/).pop()} (${f.c}x)\n`; });
        }
        await sendTelegramMessage(msg, String(chatId));
        return;
    }

    if (text.startsWith('/report')) {
        const todayStart = new Date(); todayStart.setHours(0,0,0,0);
        const ts0 = todayStart.getTime();
        const ev = db.prepare(`SELECT COUNT(*) as c FROM events WHERE user_id = ? AND ts >= ?`).get(user.id, ts0) as any;
        const sessions = db.prepare(`SELECT COUNT(*) as c FROM sessions WHERE user_id = ? AND start_ts >= ?`).get(user.id, ts0) as any;
        
        await sendTelegramMessage(
            `📋 <b>Today's Summary</b>\n` +
            `📅 ${new Date().toLocaleDateString()}\n\n` +
            `📂 Sessions: <b>${sessions?.c || 0}</b>\n` +
            `📝 Total Events: <b>${ev?.c || 0}</b>`,
            String(chatId)
        );
        return;
    }

    if (text.startsWith('/summary')) {
        const lastSession = db.prepare(`SELECT id, project, ai_summary FROM sessions WHERE user_id = ? AND status = 'ended' ORDER BY end_ts DESC LIMIT 1`).get(user.id) as any;
        if (!lastSession) { await sendTelegramMessage("No completed sessions found.", String(chatId)); return; }
        
        let summary = lastSession.ai_summary || "No AI summary generated for this session.";
        await sendTelegramMessage(`✨ <b>Last Session: ${lastSession.project}</b>\n\n${summary}`, String(chatId));
        return;
    }

    if (text.startsWith('/notes')) {
        const notes = db.prepare(`SELECT content, ts FROM braindumps WHERE user_id = ? ORDER BY ts DESC LIMIT 5`).all(user.id) as any[];
        if (notes.length === 0) {
            await sendTelegramMessage("📓 No notes saved yet.", String(chatId));
        } else {
            let msg = "📓 <b>Your Last 5 Notes:</b>\n\n";
            notes.forEach((n, i) => {
                const date = new Date(n.ts).toLocaleDateString();
                msg += `${i + 1}. <i>${date}</i>: ${n.content}\n\n`;
            });
            await sendTelegramMessage(msg, String(chatId));
        }
        return;
    }

    if (text.startsWith('/stats')) {
        const totalSessions = db.prepare(`SELECT COUNT(*) as c FROM sessions WHERE user_id = ?`).get(user.id) as any;
        const totalEvents = db.prepare(`SELECT COUNT(*) as c FROM events WHERE user_id = ?`).get(user.id) as any;
        const totalNotes = db.prepare(`SELECT COUNT(*) as c FROM braindumps WHERE user_id = ?`).get(user.id) as any;
        
        await sendTelegramMessage(
            `📈 <b>ContextSwitch Stats</b>\n\n` +
            `• Sessions: <b>${totalSessions?.c || 0}</b>\n` +
            `• Total Events: <b>${totalEvents?.c || 0}</b>\n` +
            `• Brain Dumps: <b>${totalNotes?.c || 0}</b>`,
            String(chatId)
        );
        return;
    }

    if (text.startsWith('/heatmap')) {
        const rows = db.prepare(`
            SELECT CAST(strftime('%H', datetime(ts/1000,'unixepoch','localtime')) AS INTEGER) as hr, COUNT(*) as c 
            FROM events WHERE user_id = ? GROUP BY hr ORDER BY hr
        `).all(user.id) as any[];
        
        const maxC = rows.reduce((m:number, r:any) => Math.max(m, r.c), 1);
        const bars = ['▁','▂','▃','▄','▅','▆','▇','█'];
        const byHour: Record<number,number> = {};
        rows.forEach((r:any) => { byHour[r.hr] = r.c; });
        
        let msg = '📊 <b>Activity Heatmap (All Time)</b>\n\n<code>';
        for (let h = 0; h < 24; h++) {
            const c = byHour[h] || 0;
            const idx = c === 0 ? 0 : Math.ceil((c / maxC) * (bars.length - 1));
            msg += bars[idx];
        }
        msg += '</code>\n';
        msg += '<code>0  3  6  9  12 15 18 21</code>\n';
        await sendTelegramMessage(msg, String(chatId));
        return;
    }

    if (text.startsWith('/files')) {
        const topFiles = db.prepare(`
            SELECT filePath, COUNT(*) as c FROM events 
            WHERE user_id = ? AND filePath IS NOT NULL AND filePath NOT LIKE '%node_modules%' 
            GROUP BY filePath ORDER BY c DESC LIMIT 5
        `).all(user.id) as any[];
        
        if (topFiles.length === 0) { await sendTelegramMessage('No file activity yet.', String(chatId)); return; }
        
        let msg = '🗂 <b>Top 5 Most Edited Files</b>\n\n';
        topFiles.forEach((f, i) => {
            const name = f.filePath.split(/[\\/]/).pop();
            msg += `${i+1}. <code>${name}</code> — ${f.c} edits\n`;
        });
        await sendTelegramMessage(msg, String(chatId));
        return;
    }

    // Handle questions
    if (text.endsWith('?')) {
        await sendTelegramMessage('⏳ <i>ContextSwitch is thinking...</i>', String(chatId));
        try {
            // Get most recent project for this user
            const lastSession = db.prepare('SELECT project FROM sessions WHERE user_id = ? ORDER BY start_ts DESC LIMIT 1').get(user.id) as any;
            const project = lastSession?.project || 'default';
            
            const context = buildContextFromMemory(project, user.id); 
            const aiData = await aiReason(context, text);
            await sendTelegramMessage(`🤖 <b>AI Answer:</b>\n\n${aiData.summary}`, String(chatId));
        } catch (err) {
            await sendTelegramMessage('❌ Sorry, I encountered an error while processing your request.', String(chatId));
        }
        return;
    }

    // Fallback
    await sendTelegramMessage('❓ Unknown command. Type <code>/help</code> for options.', String(chatId));
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function stopTelegramPolling(): void {
    polling = false;
}
