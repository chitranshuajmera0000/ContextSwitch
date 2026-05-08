import { Router, Request, Response } from "express";
import db from "../db";
import { authMiddleware, AuthRequest } from "../middleware/auth.middleware";
import { inviteUser, getProjectMembers } from "../services/collaborationService";

const router = Router();

// POST /project/invite
router.post("/invite", authMiddleware, async (req: Request, res: Response) => {
    const authReq = req as unknown as AuthRequest;
    const { project, email, role } = authReq.body;
    
    if (!project || !email) {
        return res.status(400).json({ error: "Project and Email are required" });
    }

    const success = inviteUser(project, email, role || 'viewer');
    if (success) {
        res.json({ success: true, message: `User ${email} invited to project ${project}` });
    } else {
        res.status(404).json({ error: "User not found or already a member" });
    }
});

// GET /project — List all projects for current user
router.get("/", authMiddleware, async (req: Request, res: Response) => {
    const authReq = req as unknown as AuthRequest;
    try {
        const userId = authReq.user!.id;
        const projects = db.prepare(`SELECT DISTINCT project FROM sessions WHERE user_id = ?`).all(userId) as any[];
        res.json({ success: true, projects: projects.map(p => p.project) });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
