import {
  Course,
  CourseSchedule,
  Period,
  GradingConfig,
  ConceptualScaleItem,
  School,
  SchoolMember,
  PeriodType,
  ScaleType,
  CourseEnrollment,
  EnrollmentStatus,
} from '../entities';
import { AppError } from '../middlewares/errorHandler';
import {
  CreateCourseInput,
  CreatePeriodInput,
  UpdateGradingConfigInput,
  UpdatePeriodInput,
} from '../schemas/courses.schema';
import { getEm } from './em';

function buildDefaultPeriods(
  periodType: PeriodType,
  academicYear: number
): Array<{
  name: string;
  order: number;
  startDate: Date;
  endDate: Date;
  isRecovery: boolean;
}> {
  if (periodType === PeriodType.BIMESTER) {
    return [
      {
        name: '1° Bimestre',
        order: 1,
        startDate: new Date(`${academicYear}-03-01`),
        endDate: new Date(`${academicYear}-04-30`),
        isRecovery: false,
      },
      {
        name: '2° Bimestre',
        order: 2,
        startDate: new Date(`${academicYear}-05-01`),
        endDate: new Date(`${academicYear}-07-15`),
        isRecovery: false,
      },
      {
        name: '3° Bimestre',
        order: 3,
        startDate: new Date(`${academicYear}-08-01`),
        endDate: new Date(`${academicYear}-09-30`),
        isRecovery: false,
      },
      {
        name: '4° Bimestre',
        order: 4,
        startDate: new Date(`${academicYear}-10-01`),
        endDate: new Date(`${academicYear}-12-15`),
        isRecovery: false,
      },
    ];
  }

  if (periodType === PeriodType.TRIMESTER) {
    return [
      {
        name: '1° Trimestre',
        order: 1,
        startDate: new Date(`${academicYear}-03-01`),
        endDate: new Date(`${academicYear}-05-31`),
        isRecovery: false,
      },
      {
        name: '2° Trimestre',
        order: 2,
        startDate: new Date(`${academicYear}-06-01`),
        endDate: new Date(`${academicYear}-08-31`),
        isRecovery: false,
      },
      {
        name: '3° Trimestre',
        order: 3,
        startDate: new Date(`${academicYear}-09-01`),
        endDate: new Date(`${academicYear}-12-15`),
        isRecovery: false,
      },
    ];
  }

  // QUADRIMESTER
  return [
    {
      name: '1° Cuatrimestre',
      order: 1,
      startDate: new Date(`${academicYear}-03-01`),
      endDate: new Date(`${academicYear}-07-15`),
      isRecovery: false,
    },
    {
      name: '2° Cuatrimestre',
      order: 2,
      startDate: new Date(`${academicYear}-08-01`),
      endDate: new Date(`${academicYear}-12-15`),
      isRecovery: false,
    },
  ];
}

export class CoursesService {
  private static async verifySchoolMember(userId: string, schoolId: string) {
    const em = getEm();
    const school = await em.findOne(School, { id: schoolId });
    if (!school) {
      throw new AppError(404, 'Escuela no encontrada');
    }

    const member = await em.findOne(SchoolMember, {
      user: userId,
      school: schoolId,
    });
    if (!member) {
      throw new AppError(403, 'No perteneces a esta escuela');
    }

    return { school, member };
  }

  static async verifyCourseTeacher(userId: string, courseId: string) {
    const em = getEm();
    const course = await em.findOne(
      Course,
      { id: courseId },
      {
        populate: [
          'school',
          'teacher',
          'teacher.user',
          'schedules',
          'periods',
          'gradingConfig',
          'gradingConfig.conceptualScaleItems',
        ],
      }
    );

    if (!course) {
      throw new AppError(404, 'Curso no encontrado');
    }

    if (course.teacher.user.id !== userId) {
      throw new AppError(
        403,
        'No tienes permisos para acceder o modificar este curso'
      );
    }

    return course;
  }

  static async listSchoolCourses(userId: string, schoolId: string) {
    const em = getEm();
    const { member } = await this.verifySchoolMember(userId, schoolId);

    const courses = await em.find(
      Course,
      {
        school: schoolId,
        teacher: member.id,
      },
      {
        populate: ['schedules', 'periods', 'gradingConfig', 'enrollments'],
        orderBy: {
          academicYear: 'DESC',
          name: 'ASC',
        },
      }
    );

    return courses.map((course) => {
      const enrollments = course.enrollments.getItems();
      const activeStudentsCount = enrollments.filter(
        (e) => e.status === EnrollmentStatus.ACTIVE
      ).length;

      return {
        id: course.id,
        name: course.name,
        division: course.division ?? null,
        subject: course.subject ?? null,
        academicYear: course.academicYear,
        periodType: course.periodType,
        createdAt: course.createdAt,
        schedules: course.schedules
          .getItems()
          .sort(
            (a, b) =>
              a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)
          ),
        periods: course.periods.getItems().sort((a, b) => a.order - b.order),
        gradingConfig: course.gradingConfig ?? null,
        activeStudentsCount,
      };
    });
  }

  static async createCourse(
    userId: string,
    schoolId: string,
    input: CreateCourseInput
  ) {
    const em = getEm();
    const { school, member } = await this.verifySchoolMember(userId, schoolId);

    return em.transactional(async (txEm) => {
      const course = txEm.create(Course, {
        school,
        teacher: member,
        name: input.name,
        division: input.division ?? null,
        subject: input.subject ?? null,
        academicYear: input.academicYear,
        periodType: input.periodType,
        createdAt: new Date(),
      });

      const createdSchedules: CourseSchedule[] = [];
      for (const s of input.schedules ?? []) {
        const schedule = txEm.create(CourseSchedule, {
          course,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
        });
        createdSchedules.push(schedule);
      }

      const periodDefinitions =
        input.periods && input.periods.length > 0
          ? input.periods.map((p, index) => ({
              name: p.name,
              order: p.order ?? index + 1,
              startDate: new Date(p.startDate),
              endDate: new Date(p.endDate),
              isRecovery: p.isRecovery ?? false,
            }))
          : buildDefaultPeriods(input.periodType, input.academicYear);

      const createdPeriods: Period[] = [];
      for (const p of periodDefinitions) {
        const period = txEm.create(Period, {
          course,
          name: p.name,
          order: p.order,
          startDate: p.startDate,
          endDate: p.endDate,
          isRecovery: p.isRecovery,
        });
        createdPeriods.push(period);
      }

      const gradingConfig = txEm.create(GradingConfig, {
        course,
        scaleType: ScaleType.NUMERIC_10,
        attendanceWeight: 0,
        examWeight: 70,
        assignmentWeight: 30,
        justifiedCountsAsPresent: true,
      });

      await txEm.persistAndFlush([
        course,
        ...createdSchedules,
        ...createdPeriods,
        gradingConfig,
      ]);

      return {
        id: course.id,
        name: course.name,
        division: course.division ?? null,
        subject: course.subject ?? null,
        academicYear: course.academicYear,
        periodType: course.periodType,
        createdAt: course.createdAt,
        schedules: createdSchedules,
        periods: createdPeriods.sort((a, b) => a.order - b.order),
        gradingConfig: {
          id: gradingConfig.id,
          scaleType: gradingConfig.scaleType,
          attendanceWeight: gradingConfig.attendanceWeight,
          examWeight: gradingConfig.examWeight,
          assignmentWeight: gradingConfig.assignmentWeight,
          justifiedCountsAsPresent: gradingConfig.justifiedCountsAsPresent,
          conceptualItems: [],
          conceptualScaleItems: [],
        },
        activeStudentsCount: 0,
      };
    });
  }

  static async getCourseDetail(userId: string, courseId: string) {
    const em = getEm();
    const course = await this.verifyCourseTeacher(userId, courseId);

    const activeStudentsCount = await em.count(CourseEnrollment, {
      course: course.id,
      status: EnrollmentStatus.ACTIVE,
    });

    const sortedConceptualItems = course.gradingConfig
      ? course.gradingConfig.conceptualScaleItems
          .getItems()
          .sort((a, b) => a.order - b.order)
      : [];

    return {
      id: course.id,
      name: course.name,
      division: course.division ?? null,
      subject: course.subject ?? null,
      academicYear: course.academicYear,
      periodType: course.periodType,
      createdAt: course.createdAt,
      school: {
        id: course.school.id,
        name: course.school.name,
        educationLevel: course.school.educationLevel,
        academicYear: course.school.academicYear,
        defaultPeriodType: course.school.defaultPeriodType,
      },
      schedules: course.schedules
        .getItems()
        .sort(
          (a, b) =>
            a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)
        ),
      periods: course.periods.getItems().sort((a, b) => a.order - b.order),
      gradingConfig: course.gradingConfig
        ? {
            id: course.gradingConfig.id,
            scaleType: course.gradingConfig.scaleType,
            attendanceWeight: course.gradingConfig.attendanceWeight,
            examWeight: course.gradingConfig.examWeight,
            assignmentWeight: course.gradingConfig.assignmentWeight,
            justifiedCountsAsPresent:
              course.gradingConfig.justifiedCountsAsPresent,
            conceptualItems: sortedConceptualItems,
            conceptualScaleItems: sortedConceptualItems,
          }
        : null,
      activeStudentsCount,
    };
  }

  static async updateGradingConfig(
    userId: string,
    courseId: string,
    input: UpdateGradingConfigInput
  ) {
    const em = getEm();
    const course = await this.verifyCourseTeacher(userId, courseId);

    return em.transactional(async (txEm) => {
      const existingConfig = await txEm.findOne(
        GradingConfig,
        { course: course.id },
        { populate: ['conceptualScaleItems'] }
      );

      let gradingConfig: GradingConfig;

      if (!existingConfig) {
        gradingConfig = txEm.create(GradingConfig, {
          course,
          scaleType: input.scaleType,
          attendanceWeight: input.attendanceWeight,
          examWeight: input.examWeight,
          assignmentWeight: input.assignmentWeight,
          justifiedCountsAsPresent: input.justifiedCountsAsPresent ?? true,
        });
        txEm.persist(gradingConfig);
      } else {
        gradingConfig = existingConfig;
        gradingConfig.scaleType = input.scaleType;
        gradingConfig.attendanceWeight = input.attendanceWeight;
        gradingConfig.examWeight = input.examWeight;
        gradingConfig.assignmentWeight = input.assignmentWeight;
        if (input.justifiedCountsAsPresent !== undefined) {
          gradingConfig.justifiedCountsAsPresent =
            input.justifiedCountsAsPresent;
        }

        // Remove existing conceptual items
        const existingItems = existingConfig.conceptualScaleItems.getItems();
        for (const item of existingItems) {
          txEm.remove(item);
        }
      }

      const createdItems: ConceptualScaleItem[] = [];
      if (input.scaleType === ScaleType.CONCEPTUAL) {
        const rawItems =
          input.conceptualItems ?? input.conceptualScaleItems ?? [];
        for (const itemInput of rawItems) {
          const newItem = txEm.create(ConceptualScaleItem, {
            gradingConfig,
            label: itemInput.label,
            shortCode: itemInput.shortCode,
            numericValue: itemInput.numericValue,
            order: itemInput.order,
          });
          txEm.persist(newItem);
          createdItems.push(newItem);
        }
      }

      await txEm.flush();

      const sortedItems = createdItems.sort((a, b) => a.order - b.order);

      return {
        id: gradingConfig.id,
        scaleType: gradingConfig.scaleType,
        attendanceWeight: gradingConfig.attendanceWeight,
        examWeight: gradingConfig.examWeight,
        assignmentWeight: gradingConfig.assignmentWeight,
        justifiedCountsAsPresent: gradingConfig.justifiedCountsAsPresent,
        conceptualItems: sortedItems,
        conceptualScaleItems: sortedItems,
      };
    });
  }

  static async createPeriod(
    userId: string,
    courseId: string,
    input: CreatePeriodInput
  ) {
    const em = getEm();
    const course = await this.verifyCourseTeacher(userId, courseId);

    const existingPeriods = course.periods.getItems();
    const maxOrder = existingPeriods.reduce(
      (max, p) => (p.order > max ? p.order : max),
      0
    );

    const period = em.create(Period, {
      course,
      name: input.name,
      order: input.order ?? maxOrder + 1,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      isRecovery: input.isRecovery ?? false,
    });

    await em.persistAndFlush(period);
    return period;
  }

  static async updatePeriod(
    userId: string,
    periodId: string,
    input: UpdatePeriodInput
  ) {
    const em = getEm();
    const period = await em.findOne(
      Period,
      { id: periodId },
      { populate: ['course', 'course.teacher', 'course.teacher.user'] }
    );

    if (!period) {
      throw new AppError(404, 'Período no encontrado');
    }

    if (period.course.teacher.user.id !== userId) {
      throw new AppError(
        403,
        'No tienes permisos para editar este período'
      );
    }

    if (input.name !== undefined) period.name = input.name;
    if (input.order !== undefined) period.order = input.order;
    if (input.startDate !== undefined)
      period.startDate = new Date(input.startDate);
    if (input.endDate !== undefined) period.endDate = new Date(input.endDate);
    if (input.isRecovery !== undefined) period.isRecovery = input.isRecovery;

    await em.flush();
    return period;
  }
}
