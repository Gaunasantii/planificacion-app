import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { asyncHandler } from '../middlewares/errorHandler';
import { loginSchema, registerSchema } from '../schemas/auth.schema';
import { AuthService } from '../services/auth.service';

const router = Router();

router.post(
  '/auth/register',
  asyncHandler(async (req: Request, res: Response) => {
    const input = registerSchema.parse(req.body);
    const result = await AuthService.register(input);
    res.status(201).json(result);
  })
);

router.post(
  '/auth/login',
  asyncHandler(async (req: Request, res: Response) => {
    const input = loginSchema.parse(req.body);
    const result = await AuthService.login(input);
    res.json(result);
  })
);

router.get(
  '/auth/me',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await AuthService.getMe(req.userId!);
    res.json(result);
  })
);

export default router;
