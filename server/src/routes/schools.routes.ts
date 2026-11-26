import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { asyncHandler } from '../middlewares/errorHandler';
import {
  createSchoolSchema,
  updateSchoolSchema,
} from '../schemas/schools.schema';
import { SchoolsService } from '../services/schools.service';

const router = Router();

router.get(
  '/schools',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const schools = await SchoolsService.listUserSchools(req.userId!);
    res.json(schools);
  })
);

router.post(
  '/schools',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const input = createSchoolSchema.parse(req.body);
    const school = await SchoolsService.createSchool(req.userId!, input);
    res.status(201).json(school);
  })
);

router.patch(
  '/schools/:schoolId',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const input = updateSchoolSchema.parse(req.body);
    const school = await SchoolsService.updateSchool(
      req.userId!,
      req.params.schoolId,
      input
    );
    res.json(school);
  })
);

router.delete(
  '/schools/:schoolId',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await SchoolsService.deleteSchool(
      req.userId!,
      req.params.schoolId
    );
    res.json(result);
  })
);

export default router;
