import { Router, Request, Response } from 'express';
import db from '../db';
import * as sessionService from '../services/sessionService';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { aiReason } from '../services/aiService';
import { broadcastRealtimeUpdate } from '../realtime';
import { sendNotification as sendTelegramMessage } from '../comms';
import { SESSION_SUMMARY_PROMPT } from './reconstruct.routes';

const router = Router();

// Start or resume a session
router.post('/start', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { project } = req.body;
    const userId = req.user!.id;
    console.log(`[SessionRoute] Starting session for project: ${project}, user: ${userId}`);
    const result = sessionService.startSession(project, userId);
    res.status(201).json({ session: { ...result, sessionId: result.id } });
  } catch (err: any) {
    console.error('Start Session Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Ingest events from extension (New URL)
router.post('/ingest', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { events } = req.body;
    const userId = req.user!.id;
    console.log(`[SessionRoute] Ingesting ${events?.length} events for user: ${userId}`);

    if (!events || !Array.isArray(events)) {
      return res.status(400).json({ error: 'Invalid events data' });
    }

    const result = await sessionService.ingestEvents(userId, events);
    const project = events.length > 0 ? events[0].project : undefined;
    broadcastRealtimeUpdate({ type: 'events_updated', userId, project, count: events.length });
    res.json(result);
  } catch (err: any) {
    console.error('Ingest Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Compatibility Alias (Old URL)
router.post('/events/ingest', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { events } = req.body;
        const userId = req.user!.id;
    const result = await sessionService.ingestEvents(userId, events);
    const project = events.length > 0 ? events[0].project : undefined;
    broadcastRealtimeUpdate({ type: 'events_updated', userId, project, count: events.length });
    res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Get active sessions for the user
router.get('/active', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const activeSessions = sessionService.getActiveSessions(userId);
        
        const projectsMap = new Map<string, any[]>();
        activeSessions.forEach(s => {
            if (!projectsMap.has(s.project)) projectsMap.set(s.project, []);
            projectsMap.get(s.project)!.push(s);
        });
        
        const activeProjects = Array.from(projectsMap.entries()).map(([project, sessions]) => ({
            project,
            sessions
        }));
        
        res.json({
            activeProjectsCount: activeProjects.length,
            activeProjects
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// End session by ID
router.post('/end', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { sessionId } = req.body;
        sessionService.endSession(sessionId);
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Get current/latest activity for sidebar debug
router.get('/debug/session', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const session = sessionService.getCurrentSession(userId);
    
    let events = [];
    if (session) {
      events = db.prepare(`
        SELECT * FROM events 
        WHERE user_id = ? 
          AND project = ? COLLATE NOCASE
          AND ts >= ? 
          AND (ts <= ? OR ? IS NULL)
        ORDER BY ts DESC LIMIT 50
      `).all(userId, session.project, session.start_ts, session.end_ts, session.end_ts) as any[];
    }

    res.json({
      status: session?.status || 'idle',
      project: session?.project || 'unknown',
      ai_summary: session?.ai_summary || null,
      events
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// End session and generate summary
router.post('/end-by-project', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { project } = req.body;
    const userId = req.user!.id;

    console.log(`[SessionRoute] Ending session for project: ${project}, user: ${userId}`);
    let session = db.prepare(`
      SELECT * FROM sessions 
      WHERE project = ? COLLATE NOCASE AND status = 'active' AND user_id = ?
      ORDER BY start_ts DESC LIMIT 1
    `).get(project, userId) as any;

    if (!session) {
      console.warn(`[SessionRoute] No active session found. Falling back to most recent session for project: ${project}`);
      session = db.prepare(`
        SELECT * FROM sessions 
        WHERE project = ? COLLATE NOCASE AND user_id = ?
        ORDER BY start_ts DESC LIMIT 1
      `).get(project, userId) as any;
    }

    if (!session) {
      console.error(`[SessionRoute] No session history at all found for project: ${project}`);
      return res.status(404).json({ error: 'No active or recent session found for this project' });
    }

    console.log(`[SessionRoute] Summarizing session ID: ${session.id}`);
    // End it (if it was active)
    sessionService.endSession(session.id);

    // AI Summary
    const context = sessionService.buildSessionContext(session.id);
    const aiData = await aiReason(context, "Summarize this coding session concisely.", SESSION_SUMMARY_PROMPT);
    
    db.prepare('UPDATE sessions SET ai_summary = ? WHERE id = ?').run(aiData.summary, session.id);

    // Send Telegram Notification
    const user = db.prepare('SELECT telegram_chat_id FROM users WHERE id = ?').get(userId) as any;
    if (user?.telegram_chat_id) {
        const msg = `✅ <b>Session Ended: ${project}</b>\n\n${aiData.summary}`;
        await sendTelegramMessage(msg, user.telegram_chat_id);
    }

    // Notify listeners
    broadcastRealtimeUpdate({ type: 'session_summary_ready', userId, sessionId: session.id });

    res.json({ success: true, summary: aiData });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get full history for Web UI (including shared projects)
router.get('/history', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const project = req.query.project as string | undefined;
        const limit = parseInt(req.query.limit as string) || 50;

        let sessions;
        if (project) {
            sessions = db.prepare(`
                SELECT *, 
                (SELECT COUNT(*) FROM sessions s2 WHERE s2.user_id = s.user_id AND s2.start_ts <= s.start_ts) as userSessionIndex
                FROM sessions s
                WHERE s.user_id = ? AND s.project = ? COLLATE NOCASE
                ORDER BY s.start_ts DESC
                LIMIT ?
            `).all(userId, project, limit);
        } else {
            sessions = db.prepare(`
                SELECT *, 
                (SELECT COUNT(*) FROM sessions s2 WHERE s2.user_id = s.user_id AND s2.start_ts <= s.start_ts) as userSessionIndex
                FROM sessions s
                WHERE s.user_id = ?
                ORDER BY s.start_ts DESC
                LIMIT ?
            `).all(userId, limit);
        }
        res.json({ sessions });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Get specific session events
router.get('/:id/events', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const sessionId = req.params.id;

        const session = db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?').get(sessionId, userId) as any;
        if (!session) return res.status(404).json({ error: 'Session not found' });

        const events = db.prepare(`
            SELECT * FROM events 
            WHERE user_id = ? AND ts >= ? AND (ts <= ? OR ? IS NULL)
            ORDER BY ts ASC
        `).all(userId, session.start_ts, session.end_ts, session.end_ts);

        res.json({ events });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Get specific session details for Web UI
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const sessionId = req.params.id;
        
        const session = db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?').get(sessionId, userId) as any;
        if (!session) return res.status(404).json({ error: 'Session not found' });

        const events = db.prepare(`
            SELECT * FROM events 
            WHERE user_id = ? AND ts >= ? AND (ts <= ? OR ? IS NULL)
            ORDER BY ts ASC
        `).all(userId, session.start_ts, session.end_ts, session.end_ts);

        res.json({ session, events });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
