import db from './db';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Send a notification to the external chat service.
 */
export async function sendNotification(text: string, chatId?: string, options?: any): Promise<void> {
    const key = process.env.TELEGRAM_BOT_TOKEN;
    const def = process.env.TELEGRAM_CHAT_ID;
    const target = chatId || def;
    
    if (!key || !target) return;

    try {
        const u = `https://api.telegram.org/bot${key}/sendMessage`;
        await fetch(u, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: target,
                text: text,
                parse_mode: 'HTML',
                reply_markup: options
            })
        });

        // Audit log
        db.prepare('INSERT INTO telegram_messages (chat_id, direction, message, ts) VALUES (?, ?, ?, ?)')
          .run(String(target), 'outbound', text, Date.now());
          
    } catch (err) {}
}

export async function ackInteraction(id: string, text?: string): Promise<void> {
    const key = process.env.TELEGRAM_BOT_TOKEN;
    if (!key) return;
    try {
        const u = `https://api.telegram.org/bot${key}/answerCallbackQuery`;
        await fetch(u, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: id, text })
        });
    } catch (e) {}
}
