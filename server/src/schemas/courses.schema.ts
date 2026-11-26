import { z } from 'zod';
import { PeriodType, ScaleType } from '../entities';

export const courseScheduleInputSchema = z.object({
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startTime: z.string().trim().min(1, 'Hora de inicio obligatoria'),
  endTime: z.string().trim().min(1, 'Hora de fin obligatoria'),
});

export const periodInputSchema = z.object({
  name: z.string().trim().min(1, 'El nombre del período es obligatorio'),
  order: z.coerce.number().int().min(1).optional(),
  startDate: z.string().trim().min(1, 'Fecha de inicio obligatoria'),
  endDate: z.string().trim().min(1, 'Fecha de fin obligatoria'),
  isRecovery: z.boolean().optional().default(false),
});

export const createCourseSchema = z.object({
  name: z.string().trim().min(1, 'El nombre del curso es obligatorio'),
  division: z.string().trim().optional().nullable(),
  subject: z.string().trim().optional().nullable(),
  academicYear: z.coerce.number().int().min(2000).max(2100),
  periodType: z.nativeEnum(PeriodType),
  schedules: z.array(courseScheduleInputSchema).optional().default([]),
  periods: z.array(periodInputSchema).optional(),
});

export const conceptualScaleItemInputSchema = z.object({
  label: z.string().trim().min(1, 'La etiqueta es obligatoria'),
  shortCode: z.string().trim().min(1, 'El código corto es obligatorio'),
  numericValue: z.coerce.number(),
  order: z.coerce.number().int(),
});

export const updateGradingConfigSchema = z
  .object({
    scaleType: z.nativeEnum(ScaleType),
    attendanceWeight: z.coerce.number().min(0).max(100),
    examWeight: z.coerce.number().min(0).max(100),
    assignmentWeight: z.coerce.number().min(0).max(100),
    justifiedCountsAsPresent: z.boolean().optional().default(true),
    conceptualItems: z.array(conceptualScaleItemInputSchema).optional(),
    conceptualScaleItems: z.array(conceptualScaleItemInputSchema).optional(),
  })
  .refine(
    (data) =>
      data.attendanceWeight + data.examWeight + data.assignmentWeight === 100,
    {
      message:
        'La suma de attendanceWeight, examWeight y assignmentWeight debe ser igual a 100',
      path: ['examWeight'],
    }
  );

export const createPeriodSchema = z.object({
  name: z.string().trim().min(1, 'El nombre del período es obligatorio'),
  order: z.coerce.number().int().min(1).optional(),
  startDate: z.string().trim().min(1, 'La fecha de inicio es obligatoria'),
  endDate: z.string().trim().min(1, 'La fecha de fin es obligatoria'),
  isRecovery: z.boolean().optional().default(false),
});

export const updatePeriodSchema = z.object({
  name: z.string().trim().min(1).optional(),
  order: z.coerce.number().int().min(1).optional(),
  startDate: z.string().trim().min(1).optional(),
  endDate: z.string().trim().min(1).optional(),
  isRecovery: z.boolean().optional(),
});

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateGradingConfigInput = z.infer<typeof updateGradingConfigSchema>;
export type CreatePeriodInput = z.infer<typeof createPeriodSchema>;
export type UpdatePeriodInput = z.infer<typeof updatePeriodSchema>;
