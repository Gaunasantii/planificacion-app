import {
  Assessment,
  AssessmentType,
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
import { AttendanceService, formatDateOnly } from './attendance.service';
import { getEm } from './em';

export interface ConceptualItemDTO {
  id: string;
  label: string;
  shortCode: string;
  numericValue: number;
  order: number;
}

export interface ConceptualResolution {
  exactMatch: boolean;
  suggestedConceptualItem: ConceptualItemDTO | null;
  lowerOption: ConceptualItemDTO | null;
  upperOption: ConceptualItemDTO | null;
}

export interface StudentPeriodGradeCalculation {
  enrollmentId: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    dni: string | null;
  };
  examAvg: number | null;
  examCount: number;
  assignmentAvg: number | null;
  assignmentCount: number;
  attendancePercentage: number;
  attendanceScore: number;
  calculatedNumeric: number | null;
  missingComponents: {
    hasMissing: boolean;
    exams: boolean;
    assignments: boolean;
    attendance: boolean;
  };
  conceptualResolution: ConceptualResolution | null;
  savedPeriodGrade: {
    id: string;
    calculatedNumeric: number | null;
    finalNumeric: number | null;
    finalConceptualItem: ConceptualItemDTO | null;
    isOverridden: boolean;
  } | null;
}

export interface CalculatePeriodGradesResult {
  courseId: string;
  period: {
    id: string;
    name: string;
    order: number;
    startDate: string;
    endDate: string;
    isRecovery: boolean;
  };
  gradingConfig: {
    id: string;
    scaleType: ScaleType;
    attendanceWeight: number;
    examWeight: number;
    assignmentWeight: number;
    justifiedCountsAsPresent: boolean;
    conceptualItems: ConceptualItemDTO[];
  };
  asOfDate: string;
  students: StudentPeriodGradeCalculation[];
}

export function resolveConceptualScale(
  calculatedNumeric: number | null,
  sortedItems: ConceptualItemDTO[]
): ConceptualResolution {
  if (calculatedNumeric === null || sortedItems.length === 0) {
    return {
      exactMatch: false,
      suggestedConceptualItem: null,
      lowerOption: null,
      upperOption: null,
    };
  }

  const asc = [...sortedItems].sort((a, b) => a.numericValue - b.numericValue);
  const EPSILON = 1e-6;

  // Check exact match first
  for (const item of asc) {
    if (Math.abs(calculatedNumeric - item.numericValue) <= EPSILON) {
      return {
        exactMatch: true,
        suggestedConceptualItem: item,
        lowerOption: item,
        upperOption: item,
      };
    }
  }

  // Clamp if below minimum
  if (calculatedNumeric < asc[0].numericValue) {
    return {
      exactMatch: true,
      suggestedConceptualItem: asc[0],
      lowerOption: asc[0],
      upperOption: asc[0],
    };
  }

  // Clamp if above maximum
  const last = asc[asc.length - 1];
  if (calculatedNumeric > last.numericValue) {
    return {
      exactMatch: true,
      suggestedConceptualItem: last,
      lowerOption: last,
      upperOption: last,
    };
  }

  // Find bracketing items
  for (let i = 0; i < asc.length - 1; i++) {
    const low = asc[i];
    const high = asc[i + 1];
    if (
      calculatedNumeric > low.numericValue &&
      calculatedNumeric < high.numericValue
    ) {
      const distLow = Math.abs(calculatedNumeric - low.numericValue);
      const distHigh = Math.abs(high.numericValue - calculatedNumeric);
      const nearest = distLow < distHigh ? low : high;

      return {
        exactMatch: false,
        suggestedConceptualItem: nearest,
        lowerOption: low,
        upperOption: high,
      };
    }
  }

  return {
    exactMatch: false,
    suggestedConceptualItem: last,
    lowerOption: last,
    upperOption: last,
  };
}

export function mapAttendanceToScale(
  attendancePercentage: number,
  scaleType: ScaleType,
  conceptualItems: ConceptualItemDTO[]
): number {
  if (scaleType === ScaleType.NUMERIC_10) {
    return Number(((attendancePercentage / 100) * 10).toFixed(2));
  }

  if (scaleType === ScaleType.NUMERIC_100) {
    return Number(attendancePercentage.toFixed(2));
  }

  // CONCEPTUAL: map proportionally between min(numericValue) and max(numericValue)
  if (conceptualItems.length === 0) {
    return Number(((attendancePercentage / 100) * 10).toFixed(2));
  }

  const values = conceptualItems.map((i) => i.numericValue);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);

  if (maxVal === minVal) {
    return minVal;
  }

  const mapped = minVal + (attendancePercentage / 100) * (maxVal - minVal);
  return Number(mapped.toFixed(2));
}

export async function calculatePeriodGrades(
  courseId: string,
  periodId: string
): Promise<CalculatePeriodGradesResult> {
  const em = getEm();

  const period = await em.findOne(
    Period,
    { id: periodId, course: courseId },
    { populate: ['course'] }
  );

  if (!period) {
    throw new AppError(404, 'Período no encontrado en el curso especificado');
  }

  const gradingConfig = await em.findOne(
    GradingConfig,
    { course: courseId },
    { populate: ['conceptualScaleItems'] }
  );

  if (!gradingConfig) {
    throw new AppError(
      404,
      'Configuración de calificación no encontrada para este curso'
    );
  }

  const conceptualItems: ConceptualItemDTO[] = gradingConfig.conceptualScaleItems
    .getItems()
    .map((item: ConceptualScaleItem) => ({
      id: item.id,
      label: item.label,
      shortCode: item.shortCode,
      numericValue: item.numericValue,
      order: item.order,
    }))
    .sort((a, b) => a.numericValue - b.numericValue);

  const todayStr = formatDateOnly(new Date());
  const periodEndStr = formatDateOnly(period.endDate);
  const effectiveAsOfDate = periodEndStr < todayStr ? periodEndStr : todayStr;

  const attendanceSummary =
    await AttendanceService.calculateCourseAttendanceSummary(
      courseId,
      effectiveAsOfDate
    );

  const attendanceByEnrollment = new Map<
    string,
    { attendancePercentage: number; totalSessions: number }
  >();
  for (const s of attendanceSummary.students) {
    attendanceByEnrollment.set(s.enrollmentId, {
      attendancePercentage: s.attendancePercentage,
      totalSessions: s.totalSessions,
    });
  }

  const activeEnrollments = await em.find(
    CourseEnrollment,
    {
      course: courseId,
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

  const assessments = await em.find(
    Assessment,
    {
      course: courseId,
      period: periodId,
    },
    { orderBy: { date: 'ASC' } }
  );

  const assessmentIds = assessments.map((a) => a.id);
  const grades =
    assessmentIds.length > 0
      ? await em.find(
          Grade,
          { assessment: { $in: assessmentIds } },
          { populate: ['conceptualItem', 'assessment'] }
        )
      : [];

  const gradesByEnrollment = new Map<string, Grade[]>();
  for (const g of grades) {
    const eId = g.enrollment.id;
    const list = gradesByEnrollment.get(eId) ?? [];
    list.push(g);
    gradesByEnrollment.set(eId, list);
  }

  const existingPeriodGrades = await em.find(
    PeriodGrade,
    { period: periodId },
    { populate: ['finalConceptualItem'] }
  );
  const periodGradeByEnrollment = new Map<string, PeriodGrade>();
  for (const pg of existingPeriodGrades) {
    periodGradeByEnrollment.set(pg.enrollment.id, pg);
  }

  const studentsResult: StudentPeriodGradeCalculation[] = activeEnrollments.map(
    (enrollment) => {
      const studentGrades = gradesByEnrollment.get(enrollment.id) ?? [];

      // Filter valid numeric grades
      const examGrades: Array<{ value: number; weight: number }> = [];
      const makeupGrades: Array<{ value: number; weight: number }> = [];
      const assignmentGrades: Array<{ value: number; weight: number }> = [];

      for (const g of studentGrades) {
        const numericVal =
          g.numericValue !== null && g.numericValue !== undefined
            ? g.numericValue
            : g.conceptualItem?.numericValue ?? null;

        if (numericVal === null || numericVal === undefined) {
          continue;
        }

        const weight = g.assessment.weight > 0 ? g.assessment.weight : 1;

        if (g.assessment.type === AssessmentType.EXAM) {
          examGrades.push({ value: numericVal, weight });
        } else if (g.assessment.type === AssessmentType.MAKEUP) {
          makeupGrades.push({ value: numericVal, weight });
        } else if (g.assessment.type === AssessmentType.ASSIGNMENT) {
          assignmentGrades.push({ value: numericVal, weight });
        }
      }

      // Apply makeup replacement logic if student has makeup grades:
      // Each makeup grade replaces the lowest exam grade if the makeup grade is higher;
      // if there are no prior exam grades or more makeups than exams, include remaining makeups in examGrades.
      const effectiveExamGrades = [...examGrades];
      if (makeupGrades.length > 0) {
        const sortedMakeups = [...makeupGrades].sort(
          (a, b) => b.value - a.value
        );
        for (const makeup of sortedMakeups) {
          if (effectiveExamGrades.length > 0) {
            let lowestIdx = 0;
            for (let i = 1; i < effectiveExamGrades.length; i++) {
              if (
                effectiveExamGrades[i].value <
                effectiveExamGrades[lowestIdx].value
              ) {
                lowestIdx = i;
              }
            }
            if (makeup.value > effectiveExamGrades[lowestIdx].value) {
              effectiveExamGrades[lowestIdx] = {
                value: makeup.value,
                weight: effectiveExamGrades[lowestIdx].weight,
              };
            }
          } else {
            effectiveExamGrades.push(makeup);
          }
        }
      }

      let examAvg: number | null = null;
      if (effectiveExamGrades.length > 0) {
        const totalWeight = effectiveExamGrades.reduce(
          (acc, item) => acc + item.weight,
          0
        );
        const weightedSum = effectiveExamGrades.reduce(
          (acc, item) => acc + item.value * item.weight,
          0
        );
        examAvg = Number((weightedSum / totalWeight).toFixed(2));
      }

      let assignmentAvg: number | null = null;
      if (assignmentGrades.length > 0) {
        const totalWeight = assignmentGrades.reduce(
          (acc, item) => acc + item.weight,
          0
        );
        const weightedSum = assignmentGrades.reduce(
          (acc, item) => acc + item.value * item.weight,
          0
        );
        assignmentAvg = Number((weightedSum / totalWeight).toFixed(2));
      }

      const attData = attendanceByEnrollment.get(enrollment.id);
      const attendancePercentage = attData?.attendancePercentage ?? 100;
      const attendanceScore = mapAttendanceToScale(
        attendancePercentage,
        gradingConfig.scaleType,
        conceptualItems
      );

      // Weighted final combination & normalization over available components
      const examWeight = gradingConfig.examWeight;
      const assignmentWeight = gradingConfig.assignmentWeight;
      const attendanceWeight = gradingConfig.attendanceWeight;

      const missingExams = examWeight > 0 && examAvg === null;
      const missingAssignments =
        assignmentWeight > 0 && assignmentAvg === null;
      const missingAttendance = false; // Attendance always has a valid percentage (100 if 0 sessions)

      let activeWeightSum = 0;
      let weightedAccumulator = 0;

      if (examWeight > 0 && examAvg !== null) {
        activeWeightSum += examWeight;
        weightedAccumulator += examAvg * examWeight;
      }

      if (assignmentWeight > 0 && assignmentAvg !== null) {
        activeWeightSum += assignmentWeight;
        weightedAccumulator += assignmentAvg * assignmentWeight;
      }

      if (attendanceWeight > 0) {
        activeWeightSum += attendanceWeight;
        weightedAccumulator += attendanceScore * attendanceWeight;
      }

      const calculatedNumeric =
        activeWeightSum > 0
          ? Number((weightedAccumulator / activeWeightSum).toFixed(2))
          : null;

      const conceptualResolution =
        gradingConfig.scaleType === ScaleType.CONCEPTUAL
          ? resolveConceptualScale(calculatedNumeric, conceptualItems)
          : null;

      const savedPg = periodGradeByEnrollment.get(enrollment.id);

      return {
        enrollmentId: enrollment.id,
        student: {
          id: enrollment.student.id,
          firstName: enrollment.student.firstName,
          lastName: enrollment.student.lastName,
          dni: enrollment.student.dni ?? null,
        },
        examAvg,
        examCount: effectiveExamGrades.length,
        assignmentAvg,
        assignmentCount: assignmentGrades.length,
        attendancePercentage,
        attendanceScore,
        calculatedNumeric,
        missingComponents: {
          hasMissing: missingExams || missingAssignments || missingAttendance,
          exams: missingExams,
          assignments: missingAssignments,
          attendance: missingAttendance,
        },
        conceptualResolution,
        savedPeriodGrade: savedPg
          ? {
              id: savedPg.id,
              calculatedNumeric: savedPg.calculatedNumeric ?? null,
              finalNumeric: savedPg.finalNumeric ?? null,
              finalConceptualItem: savedPg.finalConceptualItem
                ? {
                    id: savedPg.finalConceptualItem.id,
                    label: savedPg.finalConceptualItem.label,
                    shortCode: savedPg.finalConceptualItem.shortCode,
                    numericValue: savedPg.finalConceptualItem.numericValue,
                    order: savedPg.finalConceptualItem.order,
                  }
                : null,
              isOverridden: savedPg.isOverridden,
            }
          : null,
      };
    }
  );

  return {
    courseId,
    period: {
      id: period.id,
      name: period.name,
      order: period.order,
      startDate: formatDateOnly(period.startDate),
      endDate: formatDateOnly(period.endDate),
      isRecovery: period.isRecovery,
    },
    gradingConfig: {
      id: gradingConfig.id,
      scaleType: gradingConfig.scaleType,
      attendanceWeight: gradingConfig.attendanceWeight,
      examWeight: gradingConfig.examWeight,
      assignmentWeight: gradingConfig.assignmentWeight,
      justifiedCountsAsPresent: gradingConfig.justifiedCountsAsPresent,
      conceptualItems,
    },
    asOfDate: effectiveAsOfDate,
    students: studentsResult,
  };
}
