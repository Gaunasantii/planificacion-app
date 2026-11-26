import { z } from 'zod';
import { AssessmentType } from '../entities';

export const createAssessmentSchema = z.object({
  periodId: z.string().uuid('ID de período inválido'),
  title: z.string().trim().min(1, 'El título de la evaluación es obligatorio'),
  type: z.nativeEnum(AssessmentType),
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}/, 'Formato de fecha inválido (YYYY-MM-DD)'),
  weight: z.coerce.number().positive('El peso debe ser mayor a 0').default(1),
});

export const updateAssessmentSchema = z.object({
  periodId: z.string().uuid('ID de período inválido').optional(),
  title: z.string().trim().min(1, 'El título es obligatorio').optional(),
  type: z.nativeEnum(AssessmentType).optional(),
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}/, 'Formato de fecha inválido (YYYY-MM-DD)')
    .optional(),
  weight: z.coerce.number().positive('El peso debe ser mayor a 0').optional(),
});

export const gradeInputSchema = z.object({
  enrollmentId: z.string().uuid('ID de inscripción inválido'),
  numericValue: z.coerce.number().optional().nullable(),
  conceptualItemId: z.string().uuid('ID de concepto inválido').optional().nullable(),
  observations: z.string().trim().optional().nullable(),
});

export const bulkSaveGradesSchema = z.union([
  z.array(gradeInputSchema),
  z.object({
    grades: z.array(gradeInputSchema),
  }),
]);

export const periodGradeInputSchema = z.object({
  enrollmentId: z.string().uuid('ID de inscripción inválido'),
  calculatedNumeric: z.coerce.number().optional().nullable(),
  finalNumeric: z.coerce.number().optional().nullable(),
  finalConceptualItemId: z
    .string()
    .uuid('ID de concepto inválido')
    .optional()
    .nullable(),
  isOverridden: z.boolean().optional().default(false),
});

export const bulkSavePeriodGradesSchema = z.union([
  z.array(periodGradeInputSchema),
  z.object({
    grades: z.array(periodGradeInputSchema),
  }),
]);

export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;
export type UpdateAssessmentInput = z.infer<typeof updateAssessmentSchema>;
export type GradeInput = z.infer<typeof gradeInputSchema>;
export type BulkSaveGradesInput = z.infer<typeof bulkSaveGradesSchema>;
export type PeriodGradeInput = z.infer<typeof periodGradeInputSchema>;
export type BulkSavePeriodGradesInput = z.infer<typeof bulkSavePeriodGradesSchema>;
