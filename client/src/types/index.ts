export type EducationLevel = 'PRIMARY' | 'SECONDARY' | 'BOTH';
export type PeriodType = 'BIMESTER' | 'TRIMESTER' | 'QUADRIMESTER';
export type SchoolRole =
  | 'TEACHER'
  | 'PRECEPTOR'
  | 'VICE_PRINCIPAL'
  | 'PRINCIPAL'
  | 'ADMIN';
export type ScaleType = 'NUMERIC_10' | 'NUMERIC_100' | 'CONCEPTUAL';
export type EnrollmentStatus = 'ACTIVE' | 'DROPPED' | 'TRANSFERRED';
export type AttendanceStatus =
  | 'PRESENT'
  | 'ABSENT'
  | 'LATE'
  | 'JUSTIFIED_ABSENT';
export type AssessmentType = 'EXAM' | 'ASSIGNMENT' | 'MAKEUP';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt?: string;
  updatedAt?: string;
  memberships?: SchoolMember[];
}

export interface School {
  id: string;
  name: string;
  educationLevel: EducationLevel;
  academicYear: number;
  defaultPeriodType: PeriodType;
  createdAt?: string;
  role?: SchoolRole;
  isCreator?: boolean;
  memberId?: string;
}

export interface SchoolMember {
  id: string;
  user?: string | User;
  school: School;
  role: SchoolRole;
  isCreator: boolean;
  createdAt?: string;
}

export interface CourseSchedule {
  id?: string;
  course?: string | Course;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface Period {
  id: string;
  course?: string | Course;
  name: string;
  order: number;
  startDate: string;
  endDate: string;
  isRecovery: boolean;
}

export interface ConceptualScaleItem {
  id?: string;
  gradingConfig?: string | GradingConfig;
  label: string;
  shortCode: string;
  numericValue: number;
  order: number;
}

export interface GradingConfig {
  id: string;
  course?: string | Course;
  scaleType: ScaleType;
  attendanceWeight: number;
  examWeight: number;
  assignmentWeight: number;
  justifiedCountsAsPresent: boolean;
  conceptualItems?: ConceptualScaleItem[];
  conceptualScaleItems?: ConceptualScaleItem[];
}

export interface Course {
  id: string;
  school?: School;
  teacher?: string | SchoolMember;
  name: string;
  division?: string | null;
  subject?: string | null;
  academicYear: number;
  periodType: PeriodType;
  createdAt?: string;
  schedules?: CourseSchedule[];
  periods?: Period[];
  gradingConfig?: GradingConfig | null;
  activeStudentsCount?: number;
}

export interface Student {
  id: string;
  school?: string | School;
  firstName: string;
  lastName: string;
  dni?: string | null;
  createdAt?: string;
}

export interface CourseEnrollment {
  id: string;
  course?: string | Course;
  student: Student;
  status: EnrollmentStatus;
  enrolledAt: string;
}

export interface ClassSession {
  id: string;
  course?: string | Course;
  courseId?: string;
  date: string;
  topic?: string | null;
  isCancelled: boolean;
  summary?: {
    present: number;
    absent: number;
    late: number;
    justified: number;
    totalRecorded: number;
    totalStudents?: number;
  };
  present?: number;
  absent?: number;
  late?: number;
  justified?: number;
  totalRecorded?: number;
}

export interface SuggestedSessionDate {
  date: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface ListCourseSessionsResponse {
  sessions: ClassSession[];
  suggestedDates: SuggestedSessionDate[];
}

export interface AttendanceRecord {
  id?: string;
  recordId?: string | null;
  session?: string | ClassSession;
  enrollmentId: string;
  enrollment?: CourseEnrollment;
  student?: Student;
  status: AttendanceStatus | null;
  notes?: string | null;
}

export interface SessionAttendanceStudentRow {
  enrollmentId: string;
  enrollment?: CourseEnrollment;
  student: Student;
  recordId: string | null;
  status: AttendanceStatus | null;
  notes: string | null;
}

export interface SessionAttendanceResponse {
  session: {
    id: string;
    courseId: string;
    date: string;
    topic: string | null;
    isCancelled: boolean;
  };
  summary: {
    present: number;
    absent: number;
    late: number;
    justified: number;
    totalStudents: number;
    totalRecorded: number;
  };
  records: SessionAttendanceStudentRow[];
  students: SessionAttendanceStudentRow[];
}

export interface AttendanceRecordInput {
  enrollmentId: string;
  status: AttendanceStatus;
  notes?: string | null;
}

export interface CreateSessionInput {
  date: string;
  topic?: string | null;
  isCancelled?: boolean;
  records?: AttendanceRecordInput[];
  attendance?: AttendanceRecordInput[];
}

export type SaveSessionAttendanceInput =
  | AttendanceRecordInput[]
  | {
      records?: AttendanceRecordInput[];
      attendance?: AttendanceRecordInput[];
      topic?: string | null;
      isCancelled?: boolean;
    };

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

export interface CourseAttendanceSummaryResponse {
  asOfDate: string;
  totalCourseSessions: number;
  justifiedCountsAsPresent: boolean;
  students: StudentAttendanceSummaryItem[];
}

export interface Assessment {
  id: string;
  course?: string | Course;
  courseId?: string;
  periodId: string;
  period?: {
    id: string;
    name: string;
    order: number;
  };
  title: string;
  type: AssessmentType;
  date: string;
  weight: number;
  gradedCount?: number;
  gradesCount?: number;
  totalStudents?: number;
  totalActiveStudents?: number;
}

export interface Grade {
  id?: string;
  gradeId?: string | null;
  assessment?: string | Assessment;
  enrollmentId?: string;
  enrollment?: string | CourseEnrollment;
  student?: Student;
  numericValue?: number | null;
  conceptualItemId?: string | null;
  conceptualItem?: ConceptualScaleItem | null;
  observations?: string | null;
}

export interface AssessmentGradeStudentRow {
  enrollmentId: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    dni: string | null;
  };
  gradeId: string | null;
  numericValue: number | null;
  conceptualItemId: string | null;
  conceptualItem: ConceptualScaleItem | null;
  observations: string | null;
  grade: {
    id: string;
    numericValue: number | null;
    conceptualItemId: string | null;
    conceptualItem: ConceptualScaleItem | null;
    observations: string | null;
  } | null;
}

export interface AssessmentGradesResponse {
  assessment: Assessment;
  gradingConfig: GradingConfig | null;
  grades: AssessmentGradeStudentRow[];
  students: AssessmentGradeStudentRow[];
}

export interface CreateAssessmentInput {
  periodId: string;
  title: string;
  type: AssessmentType;
  date: string;
  weight?: number;
}

export type UpdateAssessmentInput = Partial<CreateAssessmentInput>;

export interface GradeInput {
  enrollmentId: string;
  numericValue?: number | null;
  conceptualItemId?: string | null;
  observations?: string | null;
}

export type SaveAssessmentGradesInput =
  | GradeInput[]
  | {
      grades: GradeInput[];
    };

export interface PeriodGrade {
  id?: string;
  period?: string | Period;
  enrollment?: string | CourseEnrollment;
  enrollmentId?: string;
  calculatedNumeric?: number | null;
  finalNumeric?: number | null;
  finalConceptualItem?: ConceptualScaleItem | null;
  finalConceptualItemId?: string | null;
  isOverridden: boolean;
}

export interface ConceptualResolution {
  exactMatch: boolean;
  suggestedConceptualItem: ConceptualScaleItem | null;
  lowerOption: ConceptualScaleItem | null;
  upperOption: ConceptualScaleItem | null;
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
    finalConceptualItem: ConceptualScaleItem | null;
    isOverridden: boolean;
  } | null;
}

export interface PeriodGradesPreviewResponse {
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
    conceptualItems: ConceptualScaleItem[];
  };
  asOfDate: string;
  students: StudentPeriodGradeCalculation[];
}

export interface PeriodGradeInput {
  enrollmentId: string;
  calculatedNumeric?: number | null;
  finalNumeric?: number | null;
  finalConceptualItemId?: string | null;
  isOverridden?: boolean;
}

export type SavePeriodGradesInput =
  | PeriodGradeInput[]
  | {
      grades: PeriodGradeInput[];
    };

// --- API Request / Response Payloads ---

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface AuthMeResponse extends User {
  memberships: SchoolMember[];
}

export interface CreateSchoolInput {
  name: string;
  educationLevel: EducationLevel;
  academicYear: number;
  defaultPeriodType: PeriodType;
}

export type UpdateSchoolInput = Partial<CreateSchoolInput>;

export interface CourseScheduleInput {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface PeriodInput {
  name: string;
  order?: number;
  startDate: string;
  endDate: string;
  isRecovery?: boolean;
}

export interface CreateCourseInput {
  name: string;
  division?: string | null;
  subject?: string | null;
  academicYear: number;
  periodType: PeriodType;
  schedules?: CourseScheduleInput[];
  periods?: PeriodInput[];
}

export interface UpdateGradingConfigInput {
  scaleType: ScaleType;
  attendanceWeight: number;
  examWeight: number;
  assignmentWeight: number;
  justifiedCountsAsPresent?: boolean;
  conceptualItems?: Omit<ConceptualScaleItem, 'id' | 'gradingConfig'>[];
  conceptualScaleItems?: Omit<ConceptualScaleItem, 'id' | 'gradingConfig'>[];
}

export interface CreateStudentInput {
  firstName: string;
  lastName: string;
  dni?: string | null;
}

export interface UpdateEnrollmentInput {
  firstName?: string;
  lastName?: string;
  dni?: string | null;
  status?: EnrollmentStatus;
}

// --- Display Labels & Helpers ---

export const EDUCATION_LEVEL_LABELS: Record<EducationLevel, string> = {
  PRIMARY: 'Primario',
  SECONDARY: 'Secundario',
  BOTH: 'Ambos',
};

export const PERIOD_TYPE_LABELS: Record<PeriodType, string> = {
  BIMESTER: 'Bimestral',
  TRIMESTER: 'Trimestral',
  QUADRIMESTER: 'Cuatrimestral',
};

export const SCHOOL_ROLE_LABELS: Record<SchoolRole, string> = {
  TEACHER: 'Docente',
  PRECEPTOR: 'Preceptor/a',
  VICE_PRINCIPAL: 'Vicedirector/a',
  PRINCIPAL: 'Director/a',
  ADMIN: 'Administrador/a',
};

export const ENROLLMENT_STATUS_LABELS: Record<EnrollmentStatus, string> = {
  ACTIVE: 'Activo',
  DROPPED: 'Baja',
  TRANSFERRED: 'Pase',
};

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: 'Presente',
  ABSENT: 'Ausente',
  LATE: 'Tardanza',
  JUSTIFIED_ABSENT: 'Justificado',
};

export const ASSESSMENT_TYPE_LABELS: Record<AssessmentType, string> = {
  EXAM: 'Examen',
  ASSIGNMENT: 'Trabajo Práctico',
  MAKEUP: 'Recuperatorio',
};

export const SCALE_TYPE_LABELS: Record<ScaleType, string> = {
  NUMERIC_10: 'Numérica (0 a 10)',
  NUMERIC_100: 'Numérica (0 a 100)',
  CONCEPTUAL: 'Conceptual personalizada',
};

export const DAY_OF_WEEK_LABELS: Record<number, string> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
};

export const DAY_OF_WEEK_SHORT_LABELS: Record<number, string> = {
  0: 'Dom',
  1: 'Lun',
  2: 'Mar',
  3: 'Mié',
  4: 'Jue',
  5: 'Vie',
  6: 'Sáb',
};
