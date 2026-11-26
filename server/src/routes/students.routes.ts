import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { asyncHandler } from '../middlewares/errorHandler';
import {
  bulkCreateStudentsSchema,
  createStudentSchema,
  updateEnrollmentSchema,
} from '../schemas/students.schema';
import { StudentsService } from '../services/students.service';

const router = Router();

router.get(
  '/courses/:courseId/students',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const enrollments = await StudentsService.listCourseStudents(
      req.userId!,
      req.params.courseId
    );
    res.json(enrollments);
  })
);

router.post(
  '/courses/:courseId/students',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const input = createStudentSchema.parse(req.body);
    const enrollment = await StudentsService.enrollStudent(
      req.userId!,
      req.params.courseId,
      input
    );
    res.status(201).json(enrollment);
  })
);

router.post(
  '/courses/:courseId/students/bulk',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const input = bulkCreateStudentsSchema.parse(req.body);
    const enrollments = await StudentsService.bulkEnrollStudents(
      req.userId!,
      req.params.courseId,
      input
    );
    res.status(201).json(enrollments);
  })
);

router.patch(
  '/enrollments/:enrollmentId',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const input = updateEnrollmentSchema.parse(req.body);
    const enrollment = await StudentsService.updateEnrollment(
      req.userId!,
      req.params.enrollmentId,
      input
    );
    res.json(enrollment);
  })
);

export default router;
