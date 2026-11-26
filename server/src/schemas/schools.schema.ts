import { z } from 'zod';
import { EducationLevel, PeriodType } from '../entities';

export const createSchoolSchema = z.object({
  name: z.string().trim().min(1, 'El nombre de la escuela es obligatorio'),
  educationLevel: z.nativeEnum(EducationLevel),
  academicYear: z.coerce.number().int().min(2000).max(2100),
  defaultPeriodType: z.nativeEnum(PeriodType),
});

export const updateSchoolSchema = createSchoolSchema.partial();

export type CreateSchoolInput = z.infer<typeof createSchoolSchema>;
export type UpdateSchoolInput = z.infer<typeof updateSchoolSchema>;
