import { z } from 'zod';
import { AttendanceStatus } from '../entities';

export const attendanceRecordInputSchema = z.object({
  enrollmentId: z.string().uuid('ID de inscripción inválido'),
  status: z.nativeEnum(AttendanceStatus),
  notes: z.string().trim().optional().nullable(),
});

export const createSessionSchema = z.object({
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}/, 'Formato de fecha inválido (YYYY-MM-DD)'),
  topic: z.string().trim().optional().nullable(),
  isCancelled: z.boolean().optional().default(false),
  records: z.array(attendanceRecordInputSchema).optional(),
  attendance: z.array(attendanceRecordInputSchema).optional(),
});

export const bulkSaveAttendanceSchema = z.union([
  z.array(attendanceRecordInputSchema),
  z.object({
    records: z.array(attendanceRecordInputSchema).optional(),
    attendance: z.array(attendanceRecordInputSchema).optional(),
    topic: z.string().trim().optional().nullable(),
    isCancelled: z.boolean().optional(),
  }),
]);

export type AttendanceRecordInput = z.infer<typeof attendanceRecordInputSchema>;
export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type BulkSaveAttendanceInput = z.infer<typeof bulkSaveAttendanceSchema>;
