import { Routine, RoutineDocument, HabitDocument } from "../models/routineModel";

interface CreateRoutineData {
    name: string;
    userId: string;
    categories?: string[];
    habits?: Partial<HabitDocument>[];
}

interface UpdateRoutineData {
    name?: string;
    habits?: Partial<HabitDocument>[];
    isActive?: boolean;
    categories?: string[];
}

export class RoutineController {
    async getRoutinesByUserId(userId: string): Promise<RoutineDocument[]> {
        const routines = await Routine.find({ userId }).exec();
        return routines;
    }

    async getRoutineById(id: string): Promise<RoutineDocument | null> {
        const routine = await Routine.findById(id).exec();
        if (!routine) {
            throw new Error('routine-not-found');
        }
        return routine;
    }

    async createRoutine(data: CreateRoutineData): Promise<RoutineDocument> {
        const newRoutine = new Routine({
            name: data.name,
            userId: data.userId,
            categories: data.categories || [],
            habits: data.habits || [],
            isActive: false,
            createdAt: new Date()
        });

        return await newRoutine.save();
    }

    async updateRoutine(id: string, data: UpdateRoutineData): Promise<RoutineDocument | null> {
        const routine = await Routine.findByIdAndUpdate(id, data, { new: true }).exec();
        if (!routine) {
            throw new Error('routine-not-found');
        }
        return routine;
    }

    async toggleRoutine(id: string): Promise<RoutineDocument | null> {
        const routine = await Routine.findById(id).exec();
        if (!routine) {
            throw new Error('routine-not-found');
        }
        routine.isActive = !routine.isActive;
        return await routine.save();
    }

    async deleteRoutine(id: string): Promise<{ message: string }> {
        const routine = await Routine.findById(id).exec();
        if (!routine) {
            throw new Error('routine-not-found');
        }
        await Routine.findByIdAndDelete(id).exec();
        return { message: 'Routine deleted successfully' };
    }

    async addHabitToRoutine(routineId: string, habit: Partial<HabitDocument>): Promise<RoutineDocument | null> {
        const routine = await Routine.findById(routineId).exec();
        if (!routine) {
            throw new Error('routine-not-found');
        }
        routine.habits.push(habit as HabitDocument);
        return await routine.save();
    }

    async removeHabitFromRoutine(routineId: string, habitIndex: number): Promise<RoutineDocument | null> {
        const routine = await Routine.findById(routineId).exec();
        if (!routine) {
            throw new Error('routine-not-found');
        }
        routine.habits.splice(habitIndex, 1);
        return await routine.save();
    }
}
