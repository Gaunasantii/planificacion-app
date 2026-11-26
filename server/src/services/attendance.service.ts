import {
  AttendanceRecord,
  AttendanceStatus,
  ClassSession,
  CourseEnrollment,
  EnrollmentStatus,
  GradingConfig,
} from '../entities';
import { AppError } from '../middlewares/errorHandler';
import {
  AttendanceRecordInput,
  BulkSaveAttendanceInput,
  CreateSessionInput,
} from '../schemas/attendance.schema';
import { CoursesService } from './courses.service';
import { getEm } from './em';

export function formatDateOnly(date: Date | string): string {
  if (typeof date === 'string') {
    return date.slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

export function parseDateOnly(dateStr: string): Date {
  const clean = dateStr.slice(0, 10);
  return new Date(`${clean}T00:00:00.000Z`);
}

export interface StudentAttendanceSummaryItem {
  enrollmentId: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    dni: string | null;
  };
  totalSessions: number;
  present: number;
  absent: number;
  late: number;
  justified: number;
  effectiveScore: number;
  attendancePercentage: number;
}

export class AttendanceService {
  private static async verifySessionTeacher(userId: string, sessionId: string) {
    const em = getEm();
    const session = await em.findOne(
      ClassSession,
      { id: sessionId },
      {
        populate: ['course', 'course.teacher', 'course.teacher.user'],
      }
    );

    if (!session) {
      throw new AppError(404, 'Sesión de clase no encontrada');
    }

    if (session.course.teacher.user.id !== userId) {
      throw new AppError(
        403,
        'No tienes permisos para acceder a esta sesión de clase'
      );
    }

    return session;
  }

  static generateSuggestedDates(
    schedules: Array<{ dayOfWeek: number; startTime: string; endTime: string }>,
    existingSessionDates: Set<string>,
    fromDateStr?: string,
    count: number = 6
  ): Array<{
    date: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }> {
    if (!schedules || schedules.length === 0) {
      return [];
    }

    const startStr = fromDateStr ?? formatDateOnly(new Date());
    const baseDate = parseDateOnly(startStr);
    const suggestions: Array<{
      date: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
    }> = [];

    const uniqueByDay = new Map<
      number,
      { dayOfWeek: number; startTime: string; endTime: string }
    >();
    for (const s of schedules) {
      if (!uniqueByDay.has(s.dayOfWeek)) {
        uniqueByDay.set(s.dayOfWeek, s);
      }
    }

    for (let offset = 0; offset < 45 && suggestions.length < count; offset++) {
      const current = new Date(baseDate.getTime() + offset * 86400000);
      const dayOfWeek = current.getUTCDay();
      const dateStr = formatDateOnly(current);

      const matchedSchedule = uniqueByDay.get(dayOfWeek);
      if (matchedSchedule && !existingSessionDates.has(dateStr)) {
        suggestions.push({
          date: dateStr,
          dayOfWeek: matchedSchedule.dayOfWeek,
          startTime: matchedSchedule.startTime,
          endTime: matchedSchedule.endTime,
        });
      }
    }

    return suggestions;
  }

  static async listCourseSessions(userId: string, courseId: string) {
    const em = getEm();
    const course = await CoursesService.verifyCourseTeacher(userId, courseId);

    const sessions = await em.find(
      ClassSession,
      { course: courseId },
      { orderBy: { date: 'DESC' } }
    );

    const sessionIds = sessions.map((s) => s.id);
    const records =
      sessionIds.length > 0
        ? await em.find(AttendanceRecord, { session: { $in: sessionIds } })
        : [];

    const recordsBySession = new Map<string, AttendanceRecord[]>();
    for (const r of records) {
      const sId = r.session.id;
      const list = recordsBySession.get(sId) ?? [];
      list.push(r);
      recordsBySession.set(sId, list);
    }

    const existingDates = new Set<string>();

    const formattedSessions = sessions.map((s) => {
      const dateStr = formatDateOnly(s.date);
      existingDates.add(dateStr);

      const sessionRecords = recordsBySession.get(s.id) ?? [];
      let present = 0;
      let absent = 0;
      let late = 0;
      let justified = 0;

      for (const r of sessionRecords) {
        if (r.status === AttendanceStatus.PRESENT) present++;
        else if (r.status === AttendanceStatus.ABSENT) absent++;
        else if (r.status === AttendanceStatus.LATE) late++;
        else if (r.status === AttendanceStatus.JUSTIFIED_ABSENT) justified++;
      }

      return {
        id: s.id,
        courseId: course.id,
        date: dateStr,
        topic: s.topic ?? null,
        isCancelled: s.isCancelled,
        summary: {
          present,
          absent,
          late,
          justified,
          totalRecorded: sessionRecords.length,
        },
        present,
        absent,
        late,
        justified,
        totalRecorded: sessionRecords.length,
      };
    });

    const schedules = course.schedules.getItems().map((s) => ({
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
    }));

    const suggestedDates = this.generateSuggestedDates(
      schedules,
      existingDates
    );

    return {
      sessions: formattedSessions,
      suggestedDates,
    };
  }

  static async createOrGetSession(
    userId: string,
    courseId: string,
    input: CreateSessionInput
  ) {
    const em = getEm();
    const course = await CoursesService.verifyCourseTeacher(userId, courseId);
    const dateStr = input.date.slice(0, 10);
    const sessionDate = parseDateOnly(dateStr);

    const session = await em.transactional(async (txEm) => {
      let existing = await txEm.findOne(ClassSession, {
        course: course.id,
        date: sessionDate,
      });

      if (!existing) {
        const allCourseSessions = await txEm.find(ClassSession, {
          course: course.id,
        });
        existing =
          allCourseSessions.find((s) => formatDateOnly(s.date) === dateStr) ??
          null;
      }

      let targetSession: ClassSession;
      if (existing) {
        targetSession = existing;
        if (input.topic !== undefined) {
          targetSession.topic = input.topic;
        }
        if (input.isCancelled !== undefined) {
          targetSession.isCancelled = input.isCancelled;
        }
      } else {
        targetSession = txEm.create(ClassSession, {
          course,
          date: sessionDate,
          topic: input.topic ?? null,
          isCancelled: input.isCancelled ?? false,
        });
        txEm.persist(targetSession);
      }

      await txEm.flush();

      const initialRecords = input.records ?? input.attendance;
      if (
        initialRecords &&
        initialRecords.length > 0 &&
        !targetSession.isCancelled
      ) {
        await this.upsertAttendanceRecordsInTx(
          txEm,
          targetSession,
          initialRecords
        );
      }

      return targetSession;
    });

    return this.getSessionAttendance(userId, session.id);
  }

  private static async upsertAttendanceRecordsInTx(
    txEm: ReturnType<typeof getEm>,
    session: ClassSession,
    recordsInput: AttendanceRecordInput[]
  ) {
    const existingRecords = await txEm.find(AttendanceRecord, {
      session: session.id,
    });
    const existingByEnrollment = new Map<string, AttendanceRecord>();
    for (const r of existingRecords) {
      existingByEnrollment.set(r.enrollment.id, r);
    }

    const enrollments = await txEm.find(CourseEnrollment, {
      course: session.course.id,
    });
    const validEnrollments = new Map<string, CourseEnrollment>();
    for (const e of enrollments) {
      validEnrollments.set(e.id, e);
    }

    for (const item of recordsInput) {
      const enrollment = validEnrollments.get(item.enrollmentId);
      if (!enrollment) {
        throw new AppError(
          400,
          `La inscripción ${item.enrollmentId} no pertenece a este curso`
        );
      }

      const existing = existingByEnrollment.get(item.enrollmentId);
      if (existing) {
        existing.status = item.status;
        if (item.notes !== undefined) {
          existing.notes = item.notes ?? null;
        }
      } else {
        const created = txEm.create(AttendanceRecord, {
          session,
          enrollment,
          status: item.status,
          notes: item.notes ?? null,
        });
        txEm.persist(created);
        existingByEnrollment.set(item.enrollmentId, created);
      }
    }

    await txEm.flush();
  }

  static async getSessionAttendance(userId: string, sessionId: string) {
    const em = getEm();
    const session = await this.verifySessionTeacher(userId, sessionId);

    const activeEnrollments = await em.find(
      CourseEnrollment,
      {
        course: session.course.id,
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

    const existingRecords = await em.find(
      AttendanceRecord,
      { session: session.id },
      { populate: ['enrollment', 'enrollment.student'] }
    );

    const recordByEnrollment = new Map<string, AttendanceRecord>();
    for (const r of existingRecords) {
      recordByEnrollment.set(r.enrollment.id, r);
    }

    const students = activeEnrollments.map((enrollment) => {
      const record = recordByEnrollment.get(enrollment.id);
      return {
        enrollmentId: enrollment.id,
        enrollment: {
          id: enrollment.id,
          status: enrollment.status,
          enrolledAt: enrollment.enrolledAt,
          student: {
            id: enrollment.student.id,
            firstName: enrollment.student.firstName,
            lastName: enrollment.student.lastName,
            dni: enrollment.student.dni ?? null,
          },
        },
        student: {
          id: enrollment.student.id,
          firstName: enrollment.student.firstName,
          lastName: enrollment.student.lastName,
          dni: enrollment.student.dni ?? null,
        },
        recordId: record?.id ?? null,
        status: record?.status ?? null,
        notes: record?.notes ?? null,
      };
    });

    let present = 0;
    let absent = 0;
    let late = 0;
    let justified = 0;
    for (const s of students) {
      if (s.status === AttendanceStatus.PRESENT) present++;
      else if (s.status === AttendanceStatus.ABSENT) absent++;
      else if (s.status === AttendanceStatus.LATE) late++;
      else if (s.status === AttendanceStatus.JUSTIFIED_ABSENT) justified++;
    }

    return {
      session: {
        id: session.id,
        courseId: session.course.id,
        date: formatDateOnly(session.date),
        topic: session.topic ?? null,
        isCancelled: session.isCancelled,
      },
      summary: {
        present,
        absent,
        late,
        justified,
        totalStudents: students.length,
        totalRecorded: existingRecords.length,
      },
      records: students,
      students,
    };
  }

  static async saveSessionAttendance(
    userId: string,
    sessionId: string,
    rawInput: BulkSaveAttendanceInput
  ) {
    const em = getEm();
    const session = await this.verifySessionTeacher(userId, sessionId);

    const recordsInput = Array.isArray(rawInput)
      ? rawInput
      : rawInput.records ?? rawInput.attendance ?? [];

    await em.transactional(async (txEm) => {
      if (!Array.isArray(rawInput)) {
        if (rawInput.topic !== undefined) {
          session.topic = rawInput.topic ?? null;
        }
        if (rawInput.isCancelled !== undefined) {
          session.isCancelled = rawInput.isCancelled;
        }
      }

      await this.upsertAttendanceRecordsInTx(txEm, session, recordsInput);
    });

    return this.getSessionAttendance(userId, session.id);
  }

  static async calculateCourseAttendanceSummary(
    courseId: string,
    asOfDateStr?: string
  ): Promise<{
    asOfDate: string;
    totalCourseSessions: number;
    justifiedCountsAsPresent: boolean;
    students: StudentAttendanceSummaryItem[];
  }> {
    const em = getEm();
    const targetDateStr = asOfDateStr
      ? asOfDateStr.slice(0, 10)
      : formatDateOnly(new Date());

    const gradingConfig = await em.findOne(GradingConfig, { course: courseId });
    const justifiedCountsAsPresent =
      gradingConfig?.justifiedCountsAsPresent ?? true;

    const allSessions = await em.find(
      ClassSession,
      {
        course: courseId,
        isCancelled: false,
      },
      { orderBy: { date: 'ASC' } }
    );

    const computableSessions = allSessions.filter(
      (s) => formatDateOnly(s.date) <= targetDateStr
    );

    const sessionIds = computableSessions.map((s) => s.id);
    const records =
      sessionIds.length > 0
        ? await em.find(AttendanceRecord, {
            session: { $in: sessionIds },
          })
        : [];

    const recordMap = new Map<string, AttendanceRecord>();
    for (const r of records) {
      recordMap.set(`${r.session.id}:${r.enrollment.id}`, r);
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

    const studentsSummary: StudentAttendanceSummaryItem[] =
      activeEnrollments.map((enrollment) => {
        const enrolledAtDateStr = formatDateOnly(enrollment.enrolledAt);

        // Sessions where the student already had an explicit record OR was enrolled on/before the session date.
        // If all sessions precede enrolledAt and the student has no records on those earlier sessions,
        // fallback to counting all computable sessions where records were taken or all computable sessions in the course.
        let applicableSessions = computableSessions.filter((s) => {
          const sDate = formatDateOnly(s.date);
          const hasRecord = recordMap.has(`${s.id}:${enrollment.id}`);
          return hasRecord || sDate >= enrolledAtDateStr;
        });

        if (applicableSessions.length === 0 && computableSessions.length > 0) {
          applicableSessions = computableSessions;
        }

        let present = 0;
        let absent = 0;
        let late = 0;
        let justified = 0;
        let effectiveScore = 0;
        let recordedSessionsCount = 0;

        for (const s of applicableSessions) {
          const record = recordMap.get(`${s.id}:${enrollment.id}`);
          if (!record) {
            continue;
          }
          recordedSessionsCount++;

          if (record.status === AttendanceStatus.PRESENT) {
            present++;
            effectiveScore += 1.0;
          } else if (record.status === AttendanceStatus.LATE) {
            late++;
            effectiveScore += 0.5;
          } else if (record.status === AttendanceStatus.JUSTIFIED_ABSENT) {
            justified++;
            effectiveScore += justifiedCountsAsPresent ? 1.0 : 0.0;
          } else if (record.status === AttendanceStatus.ABSENT) {
            absent++;
            effectiveScore += 0.0;
          }
        }

        const totalSessions = recordedSessionsCount;
        const attendancePercentage =
          totalSessions === 0
            ? 100
            : Number(((effectiveScore / totalSessions) * 100).toFixed(2));

        return {
          enrollmentId: enrollment.id,
          student: {
            id: enrollment.student.id,
            firstName: enrollment.student.firstName,
            lastName: enrollment.student.lastName,
            dni: enrollment.student.dni ?? null,
          },
          totalSessions,
          present,
          absent,
          late,
          justified,
          effectiveScore,
          attendancePercentage,
        };
      });

    return {
      asOfDate: targetDateStr,
      totalCourseSessions: computableSessions.length,
      justifiedCountsAsPresent,
      students: studentsSummary,
    };
  }

  static async getCourseAttendanceSummary(
    userId: string,
    courseId: string,
    asOfDateStr?: string
  ) {
    await CoursesService.verifyCourseTeacher(userId, courseId);
    return this.calculateCourseAttendanceSummary(courseId, asOfDateStr);
  }
}
