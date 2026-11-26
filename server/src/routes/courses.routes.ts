import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { asyncHandler } from '../middlewares/errorHandler';
import {
  createCourseSchema,
  createPeriodSchema,
  updateGradingConfigSchema,
  updatePeriodSchema,
} from '../schemas/courses.schema';
import { CoursesService } from '../services/courses.service';

const router = Router();

router.get(
  '/schools/:schoolId/courses',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const courses = await CoursesService.listSchoolCourses(
      req.userId!,
      req.params.schoolId
    );
    res.json(courses);
  })
);

router.post(
  '/schools/:schoolId/courses',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const input = createCourseSchema.parse(req.body);
    const course = await CoursesService.createCourse(
      req.userId!,
      req.params.schoolId,
      input
    );
    res.status(201).json(course);
  })
);

router.get(
  '/courses/:courseId',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const course = await CoursesService.getCourseDetail(
      req.userId!,
      req.params.courseId
    );
    res.json(course);
  })
);

router.put(
  '/courses/:courseId/grading-config',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const input = updateGradingConfigSchema.parse(req.body);
    const gradingConfig = await CoursesService.updateGradingConfig(
      req.userId!,
      req.params.courseId,
      input
    );
    res.json(gradingConfig);
  })
);

router.post(
  '/courses/:courseId/periods',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const input = createPeriodSchema.parse(req.body);
    const period = await CoursesService.createPeriod(
      req.userId!,
      req.params.courseId,
      input
    );
    res.status(201).json(period);
  })
);

router.patch(
  '/periods/:periodId',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const input = updatePeriodSchema.parse(req.body);
    const period = await CoursesService.updatePeriod(
      req.userId!,
      req.params.periodId,
      input
    );
    res.json(period);
  })
);

export default router;
