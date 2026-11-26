import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { asyncHandler } from '../middlewares/errorHandler';
import {
  bulkSaveGradesSchema,
  bulkSavePeriodGradesSchema,
  createAssessmentSchema,
  updateAssessmentSchema,
} from '../schemas/assessments.schema';
import { AssessmentsService } from '../services/assessments.service';

const router = Router();

router.get(
  '/courses/:courseId/assessments',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const periodId =
      typeof req.query.periodId === 'string' && req.query.periodId.length > 0
        ? req.query.periodId
        : undefined;
    const assessments = await AssessmentsService.listCourseAssessments(
      req.userId!,
      req.params.courseId,
      periodId
    );
    res.json(assessments);
  })
);

router.post(
  '/courses/:courseId/assessments',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const input = createAssessmentSchema.parse(req.body);
    const assessment = await AssessmentsService.createAssessment(
      req.userId!,
      req.params.courseId,
      input
    );
    res.status(201).json(assessment);
  })
);

router.patch(
  '/assessments/:assessmentId',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const input = updateAssessmentSchema.parse(req.body);
    const assessment = await AssessmentsService.updateAssessment(
      req.userId!,
      req.params.assessmentId,
      input
    );
    res.json(assessment);
  })
);

router.delete(
  '/assessments/:assessmentId',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await AssessmentsService.deleteAssessment(
      req.userId!,
      req.params.assessmentId
    );
    res.json(result);
  })
);

router.get(
  '/assessments/:assessmentId/grades',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await AssessmentsService.getAssessmentGrades(
      req.userId!,
      req.params.assessmentId
    );
    res.json(result);
  })
);

router.put(
  '/assessments/:assessmentId/grades',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const input = bulkSaveGradesSchema.parse(req.body);
    const result = await AssessmentsService.saveAssessmentGrades(
      req.userId!,
      req.params.assessmentId,
      input
    );
    res.json(result);
  })
);

router.get(
  '/periods/:periodId/grades/preview',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await AssessmentsService.previewPeriodGrades(
      req.userId!,
      req.params.periodId
    );
    res.json(result);
  })
);

router.put(
  '/periods/:periodId/grades',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const input = bulkSavePeriodGradesSchema.parse(req.body);
    const result = await AssessmentsService.savePeriodGrades(
      req.userId!,
      req.params.periodId,
      input
    );
    res.json(result);
  })
);

export default router;
