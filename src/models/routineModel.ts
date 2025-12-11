import mongoose, { Schema, Document } from "mongoose";

export interface HabitDocument extends Document {
    name: string;
    category: string;
    time?: string;
    emoji: string;
}

const HabitSchema: Schema<HabitDocument> = new Schema({
    name: { type: String, required: true },
    category: { type: String, required: true },
    time: { type: String, required: false },
    emoji: { type: String, required: true, default: "📌" }
});

export interface RoutineDocument extends Document {
    name: string;
    userId: string;
    habits: HabitDocument[];
    isActive: boolean;
    categories: string[];
    createdAt: Date;
}

const RoutineSchema: Schema<RoutineDocument> = new Schema({
    name: { type: String, required: true },
    userId: { type: String, required: true },
    habits: { type: [HabitSchema], required: true, default: [] },
    isActive: { type: Boolean, required: true, default: false },
    categories: { type: [String], required: true, default: [] },
    createdAt: { type: Date, required: true, default: Date.now }
});

export const Routine = mongoose.model<RoutineDocument>('Routine', RoutineSchema);
