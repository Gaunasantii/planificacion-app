import {
  Assessment,
  ConceptualScaleItem,
  CourseEnrollment,
  EnrollmentStatus,
  Grade,
  GradingConfig,
  Period,
  PeriodGrade,
  ScaleType,
} from '../entities';
import { AppError } from '../middlewares/errorHandler';
import {
  BulkSaveGradesInput,
  BulkSavePeriodGradesInput,
  CreateAssessmentInput,
  UpdateAssessmentInput,
} from '../schemas/assessments.schema';
import { formatDateOnly, parseDateOnly } from './attendance.service';
import { CoursesService } from './courses.service';
import { getEm } from './em';
import { calculatePeriodGrades } from './gradingEngine.service';

export class AssessmentsService {
  private static async verifyAssessmentTeacher(
    userId: string,
    assessmentId: string
  ) {
    const em = getEm();
    const assessment = await em.findOne(
      Assessment,
      { id: assessmentId },
      {
        populate: [
          'course',
          'course.teacher',
          'course.teacher.user',
          'period',
        ],
      }
    );

    if (!assessment) {
      throw new AppError(404, 'Evaluación no encontrada');
    }

    if (assessment.course.teacher.user.id !== userId) {
      throw new AppError(
        403,
        'No tienes permisos para acceder o modificar esta evaluación'
      );
    }

    return assessment;
  }

  private static async verifyPeriodTeacher(userId: string, periodId: string) {
    const em = getEm();
    const period = await em.findOne(
      Period,
      { id: periodId },
      {
        populate: ['course', 'course.teacher', 'course.teacher.user'],
      }
    );

    if (!period) {
      throw new AppError(404, 'Período no encontrado');
    }

    if (period.course.teacher.user.id !== userId) {
      throw new AppError(
        403,
        'No tienes permisos para acceder o modificar las notas de este período'
      );
    }

    return period;
  }

  static async listCourseAssessments(
    userId: string,
    courseId: string,
    periodId?: string
  ) {
    const em = getEm();
    await CoursesService.verifyCourseTeacher(userId, courseId);

    const filter: Record<string, unknown> = { course: courseId };
    if (periodId) {
      filter.period = periodId;
    }

    const assessments = await em.find(Assessment, filter, {
      populate: ['period'],
      orderBy: { date: 'DESC' },
    });

    const activeEnrollments = await em.find(CourseEnrollment, {
      course: courseId,
      status: EnrollmentStatus.ACTIVE,
    });
    const activeEnrollmentIds = new Set(activeEnrollments.map((e) => e.id));
    const totalActiveStudents = activeEnrollments.length;

    const assessmentIds = assessments.map((a) => a.id);
    const grades =
      assessmentIds.length > 0
        ? await em.find(Grade, { assessment: { $in: assessmentIds } })
        : [];

    const gradedCountByAssessment = new Map<string, number>();
    for (const g of grades) {
      const hasGrade =
        (g.numericValue !== null && g.numericValue !== undefined) ||
        (g.conceptualItem !== null && g.conceptualItem !== undefined);

      if (hasGrade && activeEnrollmentIds.has(g.enrollment.id)) {
        const aId = g.assessment.id;
        gradedCountByAssessment.set(
          aId,
          (gradedCountByAssessment.get(aId) ?? 0) + 1
        );
      }
    }

    return assessments.map((a) => {
      const gradedCount = gradedCountByAssessment.get(a.id) ?? 0;
      return {
        id: a.id,
        courseId,
        periodId: a.period.id,
        period: {
          id: a.period.id,
          name: a.period.name,
          order: a.period.order,
        },
        title: a.title,
        type: a.type,
        date: formatDateOnly(a.date),
        weight: a.weight,
        gradedCount,
        gradesCount: gradedCount,
        totalStudents: totalActiveStudents,
        totalActiveStudents,
      };
    });
  }

  static async createAssessment(
    userId: string,
    courseId: string,
    input: CreateAssessmentInput
  ) {
    const em = getEm();
    const course = await CoursesService.verifyCourseTeacher(userId, courseId);

    const period = await em.findOne(Period, {
      id: input.periodId,
      course: course.id,
    });
    if (!period) {
      throw new AppError(
        400,
        'El período seleccionado no pertenece a este curso'
      );
    }

    const assessment = em.create(Assessment, {
      course,
      period,
      title: input.title,
      type: input.type,
      date: parseDateOnly(input.date),
      weight: input.weight ?? 1,
    });

    await em.persistAndFlush(assessment);

    const totalActiveStudents = await em.count(CourseEnrollment, {
      course: course.id,
      status: EnrollmentStatus.ACTIVE,
    });

    return {
      id: assessment.id,
      courseId: course.id,
      periodId: period.id,
      period: {
        id: period.id,
        name: period.name,
        order: period.order,
      },
      title: assessment.title,
      type: assessment.type,
      date: formatDateOnly(assessment.date),
      weight: assessment.weight,
      gradedCount: 0,
      gradesCount: 0,
      totalStudents: totalActiveStudents,
      totalActiveStudents,
    };
  }

  static async updateAssessment(
    userId: string,
    assessmentId: string,
    input: UpdateAssessmentInput
  ) {
    const em = getEm();
    const assessment = await this.verifyAssessmentTeacher(userId, assessmentId);

    if (input.periodId !== undefined) {
      const period = await em.findOne(Period, {
        id: input.periodId,
        course: assessment.course.id,
      });
      if (!period) {
        throw new AppError(
          400,
          'El período seleccionado no pertenece a este curso'
        );
      }
      assessment.period = period;
    }

    if (input.title !== undefined) {
      assessment.title = input.title;
    }
    if (input.type !== undefined) {
      assessment.type = input.type;
    }
    if (input.date !== undefined) {
      assessment.date = parseDateOnly(input.date);
    }
    if (input.weight !== undefined) {
      assessment.weight = input.weight;
    }

    await em.flush();

    return {
      id: assessment.id,
      courseId: assessment.course.id,
      periodId: assessment.period.id,
      period: {
        id: assessment.period.id,
        name: assessment.period.name,
        order: assessment.period.order,
      },
      title: assessment.title,
      type: assessment.type,
      date: formatDateOnly(assessment.date),
      weight: assessment.weight,
    };
  }

  static async deleteAssessment(userId: string, assessmentId: string) {
    const em = getEm();
    const assessment = await this.verifyAssessmentTeacher(userId, assessmentId);

    await em.transactional(async (txEm) => {
      const associatedGrades = await txEm.find(Grade, {
        assessment: assessment.id,
      });
      for (const g of associatedGrades) {
        txEm.remove(g);
      }
      txEm.remove(assessment);
      await txEm.flush();
    });

    return { deleted: true, id: assessmentId };
  }

  static async getAssessmentGrades(userId: string, assessmentId: string) {
    const em = getEm();
    const assessment = await this.verifyAssessmentTeacher(userId, assessmentId);

    const gradingConfig = await em.findOne(
      GradingConfig,
      { course: assessment.course.id },
      { populate: ['conceptualScaleItems'] }
    );

    const sortedConceptualItems = gradingConfig
      ? gradingConfig.conceptualScaleItems
          .getItems()
          .sort((a, b) => a.order - b.order)
          .map((item) => ({
            id: item.id,
            label: item.label,
            shortCode: item.shortCode,
            numericValue: item.numericValue,
            order: item.order,
          }))
      : [];

    const activeEnrollments = await em.find(
      CourseEnrollment,
      {
        course: assessment.course.id,
        status: EnrollmentStatus.ACTIVE,
      },
      {
        populate: ['student'],
        orderBy: {
          student: {
            lastName: 'ASC',
            firstName: 'ASC',
          },
        },
      }
    );

    const existingGrades = await em.find(
      Grade,
      { assessment: assessment.id },
      { populate: ['conceptualItem'] }
    );

    const gradeByEnrollment = new Map<string, Grade>();
    for (const g of existingGrades) {
      gradeByEnrollment.set(g.enrollment.id, g);
    }

    const students = activeEnrollments.map((enrollment) => {
      const g = gradeByEnrollment.get(enrollment.id);
      const conceptualItemDto = g?.conceptualItem
        ? {
            id: g.conceptualItem.id,
            label: g.conceptualItem.label,
            shortCode: g.conceptualItem.shortCode,
            numericValue: g.conceptualItem.numericValue,
            order: g.conceptualItem.order,
          }
        : null;

      return {
        enrollmentId: enrollment.id,
        student: {
          id: enrollment.student.id,
          firstName: enrollment.student.firstName,
          lastName: enrollment.student.lastName,
          dni: enrollment.student.dni ?? null,
        },
        gradeId: g?.id ?? null,
        numericValue: g?.numericValue ?? null,
        conceptualItemId: conceptualItemDto?.id ?? null,
        conceptualItem: conceptualItemDto,
        observations: g?.observations ?? null,
        grade: g
          ? {
              id: g.id,
              numericValue: g.numericValue ?? null,
              conceptualItemId: conceptualItemDto?.id ?? null,
              conceptualItem: conceptualItemDto,
              observations: g.observations ?? null,
            }
          : null,
      };
    });

    return {
      assessment: {
        id: assessment.id,
        courseId: assessment.course.id,
        periodId: assessment.period.id,
        period: {
          id: assessment.period.id,
          name: assessment.period.name,
          order: assessment.period.order,
        },
        title: assessment.title,
        type: assessment.type,
        date: formatDateOnly(assessment.date),
        weight: assessment.weight,
      },
      gradingConfig: gradingConfig
        ? {
            id: gradingConfig.id,
            scaleType: gradingConfig.scaleType,
            attendanceWeight: gradingConfig.attendanceWeight,
            examWeight: gradingConfig.examWeight,
            assignmentWeight: gradingConfig.assignmentWeight,
            justifiedCountsAsPresent: gradingConfig.justifiedCountsAsPresent,
            conceptualItems: sortedConceptualItems,
            conceptualScaleItems: sortedConceptualItems,
          }
        : null,
      grades: students,
      students,
    };
  }

  static async saveAssessmentGrades(
    userId: string,
    assessmentId: string,
    rawInput: BulkSaveGradesInput
  ) {
    const em = getEm();
    const assessment = await this.verifyAssessmentTeacher(userId, assessmentId);
    const gradesInput = Array.isArray(rawInput) ? rawInput : rawInput.grades;

    await em.transactional(async (txEm) => {
      const gradingConfig = await txEm.findOne(
        GradingConfig,
        { course: assessment.course.id },
        { populate: ['conceptualScaleItems'] }
      );

      const conceptualMap = new Map<string, ConceptualScaleItem>();
      if (gradingConfig) {
        for (const item of gradingConfig.conceptualScaleItems.getItems()) {
          conceptualMap.set(item.id, item);
        }
      }

      const enrollments = await txEm.find(CourseEnrollment, {
        course: assessment.course.id,
      });
      const enrollmentMap = new Map<string, CourseEnrollment>();
      for (const e of enrollments) {
        enrollmentMap.set(e.id, e);
      }

      const existingGrades = await txEm.find(Grade, {
        assessment: assessment.id,
      });
      const existingByEnrollment = new Map<string, Grade>();
      for (const g of existingGrades) {
        existingByEnrollment.set(g.enrollment.id, g);
      }

      for (const item of gradesInput) {
        const enrollment = enrollmentMap.get(item.enrollmentId);
        if (!enrollment) {
          throw new AppError(
            400,
            `La inscripción ${item.enrollmentId} no pertenece a este curso`
          );
        }

        let resolvedConceptual: ConceptualScaleItem | null = null;
        let resolvedNumeric: number | null =
          item.numericValue !== undefined ? item.numericValue : null;

        if (item.conceptualItemId) {
          const foundConcept = conceptualMap.get(item.conceptualItemId);
          if (!foundConcept) {
            throw new AppError(
              400,
              `El ítem conceptual ${item.conceptualItemId} no pertenece a la configuración de este curso`
            );
          }
          resolvedConceptual = foundConcept;

          // If scaleType === 'CONCEPTUAL' (or when conceptualItemId is sent), sync numericValue automatically
          if (
            gradingConfig?.scaleType === ScaleType.CONCEPTUAL ||
            resolvedNumeric === null
          ) {
            resolvedNumeric = foundConcept.numericValue;
          }
        } else if (item.conceptualItemId === null) {
          resolvedConceptual = null;
          if (
            gradingConfig?.scaleType === ScaleType.CONCEPTUAL &&
            item.numericValue === undefined
          ) {
            resolvedNumeric = null;
          }
        }

        const existing = existingByEnrollment.get(item.enrollmentId);
        if (existing) {
          existing.numericValue = resolvedNumeric;
          existing.conceptualItem = resolvedConceptual;
          if (item.observations !== undefined) {
            existing.observations = item.observations ?? null;
          }
        } else {
          const created = txEm.create(Grade, {
            assessment,
            enrollment,
            numericValue: resolvedNumeric,
            conceptualItem: resolvedConceptual,
            observations: item.observations ?? null,
          });
          txEm.persist(created);
          existingByEnrollment.set(item.enrollmentId, created);
        }
      }

      await txEm.flush();
    });

    return this.getAssessmentGrades(userId, assessment.id);
  }

  static async previewPeriodGrades(userId: string, periodId: string) {
    const period = await this.verifyPeriodTeacher(userId, periodId);
    return calculatePeriodGrades(period.course.id, period.id);
  }

  static async savePeriodGrades(
    userId: string,
    periodId: string,
    rawInput: BulkSavePeriodGradesInput
  ) {
    const em = getEm();
    const period = await this.verifyPeriodTeacher(userId, periodId);
    const gradesInput = Array.isArray(rawInput) ? rawInput : rawInput.grades;

    await em.transactional(async (txEm) => {
      const gradingConfig = await txEm.findOne(
        GradingConfig,
        { course: period.course.id },
        { populate: ['conceptualScaleItems'] }
      );

      const conceptualMap = new Map<string, ConceptualScaleItem>();
      if (gradingConfig) {
        for (const item of gradingConfig.conceptualScaleItems.getItems()) {
          conceptualMap.set(item.id, item);
        }
      }

      const enrollments = await txEm.find(CourseEnrollment, {
        course: period.course.id,
      });
      const enrollmentMap = new Map<string, CourseEnrollment>();
      for (const e of enrollments) {
        enrollmentMap.set(e.id, e);
      }

      const existingPeriodGrades = await txEm.find(PeriodGrade, {
        period: period.id,
      });
      const existingByEnrollment = new Map<string, PeriodGrade>();
      for (const pg of existingPeriodGrades) {
        existingByEnrollment.set(pg.enrollment.id, pg);
      }

      for (const item of gradesInput) {
        const enrollment = enrollmentMap.get(item.enrollmentId);
        if (!enrollment) {
          throw new AppError(
            400,
            `La inscripción ${item.enrollmentId} no pertenece a este curso`
          );
        }

        let resolvedConceptual: ConceptualScaleItem | null = null;
        if (item.finalConceptualItemId) {
          const found = conceptualMap.get(item.finalConceptualItemId);
          if (!found) {
            throw new AppError(
              400,
              `El ítem conceptual ${item.finalConceptualItemId} no pertenece a la configuración de este curso`
            );
          }
          resolvedConceptual = found;
        }

        let resolvedFinalNumeric =
          item.finalNumeric !== undefined
            ? item.finalNumeric
            : item.calculatedNumeric ?? null;

        if (
          gradingConfig?.scaleType === ScaleType.CONCEPTUAL &&
          resolvedConceptual &&
          item.finalNumeric === undefined
        ) {
          resolvedFinalNumeric = resolvedConceptual.numericValue;
        }

        const existing = existingByEnrollment.get(item.enrollmentId);
        if (existing) {
          existing.calculatedNumeric = item.calculatedNumeric ?? null;
          existing.finalNumeric = resolvedFinalNumeric;
          existing.finalConceptualItem = resolvedConceptual;
          existing.isOverridden = item.isOverridden ?? false;
        } else {
          const created = txEm.create(PeriodGrade, {
            period,
            enrollment,
            calculatedNumeric: item.calculatedNumeric ?? null,
            finalNumeric: resolvedFinalNumeric,
            finalConceptualItem: resolvedConceptual,
            isOverridden: item.isOverridden ?? false,
          });
          txEm.persist(created);
          existingByEnrollment.set(item.enrollmentId, created);
        }
      }

      await txEm.flush();
    });

    return calculatePeriodGrades(period.course.id, period.id);
  }
}
