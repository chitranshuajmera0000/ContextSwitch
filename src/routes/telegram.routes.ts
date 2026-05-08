import { Router, Request, Response } from 'express';
import db from '../db';
import { authMiddleware, AuthRequest } from "../middleware/auth.middleware";

const router = Router();

// GET /telegram/messages?limit=50
router.get('/messages', authMiddleware, async (req: Request, res: Response) => {
    const authReq = req as unknown as AuthRequest;
    try {
        const userId = authReq.user!.id;
        const limit = Math.min(200, Math.max(10, Number(req.query.limit) || 50));
        
        // Find user's chat_id
        const user = db.prepare('SELECT telegram_chat_id FROM users WHERE id = ?').get(userId) as any;
        if (!user || !user.telegram_chat_id) {
            return res.json({ ok: true, messages: [] });
        }

        const rows = db.prepare(`
            SELECT tm.* FROM telegram_messages tm
            WHERE tm.chat_id = ?
            ORDER BY tm.ts DESC LIMIT ?
        `).all(user.telegram_chat_id, limit);
        
        res.json({ ok: true, messages: rows });
    } catch (err) {
        console.error('[TelegramRoute] Error fetching messages', err);
        res.status(500).json({ ok: false, error: 'Failed to fetch telegram messages' });
    }
});

export default router;
