import { Router, Request, Response } from "express";
import db from "../db";
import { getAllScores } from "../services/stalenessService";
import { authMiddleware, AuthRequest } from "../middleware/auth.middleware";

const router = Router();

// GET /staleness — list all staleness scores
router.get("/", authMiddleware, (req: Request, res: Response) => {
  const authReq = req as unknown as AuthRequest;
  try {
    const scores = getAllScores(authReq.user!.id);
    res.json({ success: true, data: scores });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /staleness/all — keep backward compat alias
router.get("/all", authMiddleware, (req: Request, res: Response) => {
  const authReq = req as unknown as AuthRequest;
  try {
    const scores = getAllScores(authReq.user!.id);
    res.json({ success: true, data: scores });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /staleness/:filePath — get staleness for a specific file (URL-encoded)
router.get("/:filePath", authMiddleware, (req: Request, res: Response) => {
  const authReq = req as unknown as AuthRequest;
  try {
    const filePath = decodeURIComponent(req.params.filePath);
    const row = db.prepare(`SELECT * FROM staleness_scores WHERE filePath = ? AND user_id = ?`).get(filePath, authReq.user!.id);
    if (!row) return res.status(404).json({ success: false, error: "File not found in staleness records" });
    res.json({ success: true, data: row });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /staleness/:filePath — manually override score, edit_count or last_seen
router.put("/:filePath", authMiddleware, (req: Request, res: Response) => {
  const authReq = req as unknown as AuthRequest;
  try {
    const filePath = decodeURIComponent(req.params.filePath);
    const userId = authReq.user!.id;
    const existing = db.prepare(`SELECT * FROM staleness_scores WHERE filePath = ? AND user_id = ?`).get(filePath, userId);
    if (!existing) return res.status(404).json({ success: false, error: "File not found in staleness records" });
    const { score, edit_count, last_seen } = req.body;
    db.prepare(`
      UPDATE staleness_scores SET
        score      = COALESCE(?, score),
        edit_count = COALESCE(?, edit_count),
        last_seen  = COALESCE(?, last_seen)
      WHERE filePath = ? AND user_id = ?
    `).run(score ?? null, edit_count ?? null, last_seen ?? null, filePath, userId);
    const updated = db.prepare(`SELECT * FROM staleness_scores WHERE filePath = ? AND user_id = ?`).get(filePath, userId);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /staleness/:filePath — remove a file's staleness record
router.delete("/:filePath", authMiddleware, (req: Request, res: Response) => {
  const authReq = req as unknown as AuthRequest;
  try {
    const filePath = decodeURIComponent(req.params.filePath);
    const userId = authReq.user!.id;
    const existing = db.prepare(`SELECT * FROM staleness_scores WHERE filePath = ? AND user_id = ?`).get(filePath, userId);
    if (!existing) return res.status(404).json({ success: false, error: "File not found in staleness records" });
    db.prepare(`DELETE FROM staleness_scores WHERE filePath = ? AND user_id = ?`).run(filePath, userId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
