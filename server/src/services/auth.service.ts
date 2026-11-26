import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../entities';
import { AppError } from '../middlewares/errorHandler';
import { getJwtSecret } from '../middlewares/authMiddleware';
import { LoginInput, RegisterInput } from '../schemas/auth.schema';
import { getEm } from './em';

const signToken = (user: User): string => {
  return jwt.sign(
    { userId: user.id, email: user.email },
    getJwtSecret(),
    { expiresIn: '7d' }
  );
};

const sanitizeUser = (user: User) => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export class AuthService {
  static async register(input: RegisterInput) {
    const em = getEm();

    const existing = await em.findOne(User, { email: input.email });
    if (existing) {
      throw new AppError(409, 'Ya existe un usuario registrado con ese email');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    const user = em.create(User, {
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await em.persistAndFlush(user);

    const token = signToken(user);
    return {
      token,
      user: sanitizeUser(user),
    };
  }

  static async login(input: LoginInput) {
    const em = getEm();

    const user = await em.findOne(User, { email: input.email });
    if (!user) {
      throw new AppError(401, 'Credenciales inválidas');
    }

    const isValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isValid) {
      throw new AppError(401, 'Credenciales inválidas');
    }

    const token = signToken(user);
    return {
      token,
      user: sanitizeUser(user),
    };
  }

  static async getMe(userId: string) {
    const em = getEm();

    const user = await em.findOne(
      User,
      { id: userId },
      { populate: ['memberships', 'memberships.school'] }
    );

    if (!user) {
      throw new AppError(404, 'Usuario no encontrado');
    }

    return {
      ...sanitizeUser(user),
      memberships: user.memberships.getItems().map((membership) => ({
        id: membership.id,
        role: membership.role,
        isCreator: membership.isCreator,
        createdAt: membership.createdAt,
        school: {
          id: membership.school.id,
          name: membership.school.name,
          educationLevel: membership.school.educationLevel,
          academicYear: membership.school.academicYear,
          defaultPeriodType: membership.school.defaultPeriodType,
          createdAt: membership.school.createdAt,
        },
      })),
    };
  }
}
