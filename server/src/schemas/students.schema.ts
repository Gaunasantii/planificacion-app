import { z } from 'zod';
import { EnrollmentStatus } from '../entities';

export const createStudentSchema = z.object({
  firstName: z.string().trim().min(1, 'El nombre del alumno es obligatorio'),
  lastName: z.string().trim().min(1, 'El apellido del alumno es obligatorio'),
  dni: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
});

export const bulkCreateStudentsSchema = z.union([
  z.array(createStudentSchema).min(1, 'Debe enviar al menos un alumno'),
  z.object({
    students: z
      .array(createStudentSchema)
      .min(1, 'Debe enviar al menos un alumno'),
  }),
]);

export const updateEnrollmentSchema = z.object({
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  dni: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) =>
      val === undefined ? undefined : val && val.length > 0 ? val : null
    ),
  status: z.nativeEnum(EnrollmentStatus).optional(),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type BulkCreateStudentsInput = z.infer<typeof bulkCreateStudentsSchema>;
export type UpdateEnrollmentInput = z.infer<typeof updateEnrollmentSchema>;
