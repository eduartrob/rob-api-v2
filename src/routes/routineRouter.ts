import { Router } from 'express';
import mongoose from 'mongoose';
import { RoutineController } from '../controllers/routineController';
import { authMiddleware } from '../middlewares/authMiddleware';

const routineController = new RoutineController();
const routineRouter = Router();

// Get all routines for the authenticated user
routineRouter.get('/', authMiddleware, async (req, res): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Unauthorized: user not found" });
            return;
        }
        const userId = req.user.userId as string;
        const routines = await routineController.getRoutinesByUserId(userId);
        res.status(200).json({ data: routines });
    } catch (error: any) {
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
});

// Get a single routine by ID
routineRouter.get('/:id', authMiddleware, async (req, res): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Unauthorized: user not found" });
            return;
        }
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            res.status(400).json({ message: "Invalid routine ID" });
            return;
        }
        const routine = await routineController.getRoutineById(id);
        if (routine?.userId !== req.user.userId) {
            res.status(403).json({ message: "Forbidden: not your routine" });
            return;
        }
        res.status(200).json({ data: routine });
    } catch (error: any) {
        if (error.message === 'routine-not-found') {
            res.status(404).json({ message: "Routine not found" });
            return;
        }
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
});

// Create a new routine
routineRouter.post('/create', authMiddleware, async (req, res): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Unauthorized: user not found" });
            return;
        }
        const userId = req.user.userId as string;
        const { name, categories, habits } = req.body;

        if (!name) {
            res.status(406).json({ message: "Name is required" });
            return;
        }

        const newRoutine = await routineController.createRoutine({
            name,
            userId,
            categories: categories || [],
            habits: habits || []
        });

        res.status(201).json({ message: "Routine created successfully", data: newRoutine });
    } catch (error: any) {
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
});

// Update a routine
routineRouter.put('/update/:id', authMiddleware, async (req, res): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Unauthorized: user not found" });
            return;
        }
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            res.status(400).json({ message: "Invalid routine ID" });
            return;
        }

        const routine = await routineController.getRoutineById(id);
        if (routine?.userId !== req.user.userId) {
            res.status(403).json({ message: "Forbidden: not your routine" });
            return;
        }

        const { name, habits, isActive, categories } = req.body;
        const updatedRoutine = await routineController.updateRoutine(id, {
            name,
            habits,
            isActive,
            categories
        });

        res.status(200).json({ message: "Routine updated successfully", data: updatedRoutine });
    } catch (error: any) {
        if (error.message === 'routine-not-found') {
            res.status(404).json({ message: "Routine not found" });
            return;
        }
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
});

// Toggle routine active status
routineRouter.put('/toggle/:id', authMiddleware, async (req, res): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Unauthorized: user not found" });
            return;
        }
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            res.status(400).json({ message: "Invalid routine ID" });
            return;
        }

        const routine = await routineController.getRoutineById(id);
        if (routine?.userId !== req.user.userId) {
            res.status(403).json({ message: "Forbidden: not your routine" });
            return;
        }

        const toggledRoutine = await routineController.toggleRoutine(id);
        res.status(200).json({ message: "Routine toggled successfully", data: toggledRoutine });
    } catch (error: any) {
        if (error.message === 'routine-not-found') {
            res.status(404).json({ message: "Routine not found" });
            return;
        }
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
});

// Delete a routine
routineRouter.delete('/delete/:id', authMiddleware, async (req, res): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Unauthorized: user not found" });
            return;
        }
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            res.status(400).json({ message: "Invalid routine ID" });
            return;
        }

        const routine = await routineController.getRoutineById(id);
        if (routine?.userId !== req.user.userId) {
            res.status(403).json({ message: "Forbidden: not your routine" });
            return;
        }

        await routineController.deleteRoutine(id);
        res.status(200).json({ message: "Routine deleted successfully" });
    } catch (error: any) {
        if (error.message === 'routine-not-found') {
            res.status(404).json({ message: "Routine not found" });
            return;
        }
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
});

export default routineRouter;
