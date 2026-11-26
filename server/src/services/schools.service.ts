import {
  School,
  SchoolMember,
  SchoolRole,
  User,
  Course,
  Student,
  CourseSchedule,
  Period,
  GradingConfig,
  ConceptualScaleItem,
  CourseEnrollment,
  ClassSession,
  AttendanceRecord,
  Assessment,
  Grade,
  PeriodGrade,
} from '../entities';
import { AppError } from '../middlewares/errorHandler';
import {
  CreateSchoolInput,
  UpdateSchoolInput,
} from '../schemas/schools.schema';
import { getEm } from './em';

export class SchoolsService {
  static async listUserSchools(userId: string) {
    const em = getEm();

    const memberships = await em.find(
      SchoolMember,
      { user: userId },
      {
        populate: ['school'],
        orderBy: {
          school: {
            academicYear: 'DESC',
            name: 'ASC',
          },
        },
      }
    );

    return memberships.map((member) => ({
      id: member.school.id,
      name: member.school.name,
      educationLevel: member.school.educationLevel,
      academicYear: member.school.academicYear,
      defaultPeriodType: member.school.defaultPeriodType,
      createdAt: member.school.createdAt,
      role: member.role,
      isCreator: member.isCreator,
      memberId: member.id,
    }));
  }

  static async createSchool(userId: string, input: CreateSchoolInput) {
    const em = getEm();

    return em.transactional(async (txEm) => {
      const user = await txEm.findOne(User, { id: userId });
      if (!user) {
        throw new AppError(404, 'Usuario no encontrado');
      }

      const school = txEm.create(School, {
        name: input.name,
        educationLevel: input.educationLevel,
        academicYear: input.academicYear,
        defaultPeriodType: input.defaultPeriodType,
        createdAt: new Date(),
      });

      const member = txEm.create(SchoolMember, {
        user,
        school,
        role: SchoolRole.TEACHER,
        isCreator: true,
        createdAt: new Date(),
      });

      await txEm.persistAndFlush([school, member]);

      return {
        id: school.id,
        name: school.name,
        educationLevel: school.educationLevel,
        academicYear: school.academicYear,
        defaultPeriodType: school.defaultPeriodType,
        createdAt: school.createdAt,
        role: member.role,
        isCreator: member.isCreator,
        memberId: member.id,
      };
    });
  }

  static async updateSchool(
    userId: string,
    schoolId: string,
    input: UpdateSchoolInput
  ) {
    const em = getEm();

    const school = await em.findOne(School, { id: schoolId });
    if (!school) {
      throw new AppError(404, 'Escuela no encontrada');
    }

    const member = await em.findOne(SchoolMember, {
      user: userId,
      school: schoolId,
    });

    if (!member || !member.isCreator) {
      throw new AppError(
        403,
        'No tienes permisos para editar esta escuela (se requiere ser creador)'
      );
    }

    if (input.name !== undefined) school.name = input.name;
    if (input.educationLevel !== undefined)
      school.educationLevel = input.educationLevel;
    if (input.academicYear !== undefined)
      school.academicYear = input.academicYear;
    if (input.defaultPeriodType !== undefined)
      school.defaultPeriodType = input.defaultPeriodType;

    await em.flush();

    return {
      id: school.id,
      name: school.name,
      educationLevel: school.educationLevel,
      academicYear: school.academicYear,
      defaultPeriodType: school.defaultPeriodType,
      createdAt: school.createdAt,
      role: member.role,
      isCreator: member.isCreator,
      memberId: member.id,
    };
  }

  static async deleteSchool(userId: string, schoolId: string) {
    const em = getEm();

    const school = await em.findOne(School, { id: schoolId });
    if (!school) {
      throw new AppError(404, 'Escuela no encontrada');
    }

    const member = await em.findOne(SchoolMember, {
      user: userId,
      school: schoolId,
    });

    if (!member || !member.isCreator) {
      throw new AppError(
        403,
        'No tienes permisos para eliminar esta escuela (se requiere ser creador)'
      );
    }

    await em.transactional(async (txEm) => {
      const courses = await txEm.find(Course, { school: schoolId });
      for (const course of courses) {
        const gradingConfigs = await txEm.find(GradingConfig, {
          course: course.id,
        });
        for (const gc of gradingConfigs) {
          await txEm.nativeDelete(ConceptualScaleItem, {
            gradingConfig: gc.id,
          });
        }
        await txEm.nativeDelete(GradingConfig, { course: course.id });
        await txEm.nativeDelete(CourseSchedule, { course: course.id });

        const sessions = await txEm.find(ClassSession, { course: course.id });
        for (const s of sessions) {
          await txEm.nativeDelete(AttendanceRecord, { session: s.id });
        }
        await txEm.nativeDelete(ClassSession, { course: course.id });

        const assessments = await txEm.find(Assessment, { course: course.id });
        for (const a of assessments) {
          await txEm.nativeDelete(Grade, { assessment: a.id });
        }
        await txEm.nativeDelete(Assessment, { course: course.id });

        const periods = await txEm.find(Period, { course: course.id });
        for (const p of periods) {
          await txEm.nativeDelete(PeriodGrade, { period: p.id });
        }
        await txEm.nativeDelete(Period, { course: course.id });
        await txEm.nativeDelete(CourseEnrollment, { course: course.id });
      }

      await txEm.nativeDelete(Course, { school: schoolId });
      await txEm.nativeDelete(Student, { school: schoolId });
      await txEm.nativeDelete(SchoolMember, { school: schoolId });
      await txEm.nativeDelete(School, { id: schoolId });
    });

    return { message: 'Escuela eliminada correctamente' };
  }
}
