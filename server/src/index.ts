import 'reflect-metadata';
import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MikroORM, RequestContext } from '@mikro-orm/postgresql';
import mikroOrmConfig from './mikro-orm.config';
import authRoutes from './routes/auth.routes';
import schoolsRoutes from './routes/schools.routes';
import coursesRoutes from './routes/courses.routes';
import studentsRoutes from './routes/students.routes';
import attendanceRoutes from './routes/attendance.routes';
import assessmentsRoutes from './routes/assessments.routes';
import { errorHandler } from './middlewares/errorHandler';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json());

export let orm: MikroORM;

app.use((_req, _res, next) => {
  if (orm) {
    RequestContext.create(orm.em, next);
  } else {
    next();
  }
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api', authRoutes);
app.use('/api', schoolsRoutes);
app.use('/api', coursesRoutes);
app.use('/api', studentsRoutes);
app.use('/api', attendanceRoutes);
app.use('/api', assessmentsRoutes);

app.use(errorHandler);

async function bootstrap() {
  try {
    orm = await MikroORM.init(mikroOrmConfig);

    if (process.env.NODE_ENV !== 'production') {
      await orm.schema.updateSchema();
    }

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  bootstrap();
}

export default app;
