import express from 'express';
import cors from 'cors';

import { connectDB } from './config/db';
import userRouter from './routes/userRouter';
import routineRouter from './routes/routineRouter';
import progressRouter from './routes/progressRouter';
import s3Router from './routes/s3Router';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/users', userRouter);
app.use('/api/routines', routineRouter);
app.use('/api/progress', progressRouter);
app.use('/api/s3', s3Router);

connectDB();
export { app };