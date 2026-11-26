import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { asyncHandler } from '../middlewares/errorHandler';
import {
  bulkSaveAttendanceSchema,
  createSessionSchema,
} from '../schemas/attendance.schema';
import { AttendanceService } from '../services/attendance.service';

const router = Router();

router.get(
  '/courses/:courseId/sessions',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await AttendanceService.listCourseSessions(
      req.userId!,
      req.params.courseId
    );
    res.json(result);
  })
);

router.post(
  '/courses/:courseId/sessions',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const input = createSessionSchema.parse(req.body);
    const result = await AttendanceService.createOrGetSession(
      req.userId!,
      req.params.courseId,
      input
    );
    res.status(201).json(result);
  })
);

router.get(
  '/sessions/:sessionId/attendance',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await AttendanceService.getSessionAttendance(
      req.userId!,
      req.params.sessionId
    );
    res.json(result);
  })
);

router.put(
  '/sessions/:sessionId/attendance',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const input = bulkSaveAttendanceSchema.parse(req.body);
    const result = await AttendanceService.saveSessionAttendance(
      req.userId!,
      req.params.sessionId,
      input
    );
    res.json(result);
  })
);

router.get(
  '/courses/:courseId/attendance-summary',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const asOfDate =
      typeof req.query.asOfDate === 'string' ? req.query.asOfDate : undefined;
    const result = await AttendanceService.getCourseAttendanceSummary(
      req.userId!,
      req.params.courseId,
      asOfDate
    );
    res.json(result);
  })
);

export default router;
