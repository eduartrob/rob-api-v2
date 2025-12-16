import { Router, Request, Response } from "express";
import { ProgressController } from "../controllers/progressController";
import { authMiddleware } from "../middlewares/authMiddleware";

const progressRouter = Router();
const progressController = new ProgressController();

/**
 * @route POST /api/progress/toggle
 * @desc Toggle habit completion for a date
 * @access Private
 */
progressRouter.post("/toggle", authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user?.userId;
        const { habitId, date } = req.body;

        if (!habitId) {
            res.status(400).json({ message: "habitId is required" });
            return;
        }

        const completionDate = date ? new Date(date) : new Date();
        const result = await progressController.toggleHabitCompletion(habitId, userId, completionDate);

        res.status(200).json({
            message: result.completed ? "Habit marked as completed" : "Habit unmarked",
            completed: result.completed,
        });
    } catch (error) {
        console.error("Error toggling habit completion:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

/**
 * @route GET /api/progress/completions
 * @desc Get all habit completions for a specific date
 * @access Private
 */
progressRouter.get("/completions", authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user?.userId;
        const { date } = req.query;

        const completionDate = date ? new Date(date as string) : new Date();
        const completedHabitIds = await progressController.getCompletionsForDate(userId, completionDate);

        res.status(200).json({
            date: completionDate.toISOString().slice(0, 10),
            completedHabitIds,
        });
    } catch (error) {
        console.error("Error getting completions:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

/**
 * @route GET /api/progress/stats
 * @desc Get progress statistics for the user
 * @access Private
 */
progressRouter.get("/stats", authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user?.userId;
        const { period } = req.query;

        const validPeriod = ["week", "month", "year"].includes(period as string)
            ? (period as "week" | "month" | "year")
            : "week";

        const stats = await progressController.getProgressStats(userId, validPeriod);

        res.status(200).json(stats);
    } catch (error) {
        console.error("Error getting progress stats:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

export default progressRouter;
