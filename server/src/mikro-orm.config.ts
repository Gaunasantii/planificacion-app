import { defineConfig } from '@mikro-orm/postgresql';
import { Migrator } from '@mikro-orm/migrations';
import dotenv from 'dotenv';
import {
  User,
  School,
  SchoolMember,
  Course,
  CourseSchedule,
  GradingConfig,
  ConceptualScaleItem,
  Period,
  Student,
  CourseEnrollment,
  ClassSession,
  AttendanceRecord,
  Assessment,
  Grade,
  PeriodGrade,
} from './entities';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

export default defineConfig({
  clientUrl: process.env.DATABASE_URL,
  schema: 'public',
  entities: [
    User,
    School,
    SchoolMember,
    Course,
    CourseSchedule,
    GradingConfig,
    ConceptualScaleItem,
    Period,
    Student,
    CourseEnrollment,
    ClassSession,
    AttendanceRecord,
    Assessment,
    Grade,
    PeriodGrade,
  ],
  driverOptions: {
    connection: {
      ssl: isProduction ? { rejectUnauthorized: false } : false,
    },
  },
  schemaGenerator: {
    disableForeignKeys: false,
    createForeignKeyConstraints: true,
    ignoreSchema: [],
  },
  extensions: [Migrator],
  debug: !isProduction,
});
