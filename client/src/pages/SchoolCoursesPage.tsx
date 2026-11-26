import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Calendar,
  ChevronRight,
  Clock,
  GraduationCap,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { coursesApi } from '../api/courses.api';
import { schoolsApi } from '../api/schools.api';
import { studentsApi } from '../api/students.api';
import { getApiErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Course,
  CourseScheduleInput,
  DAY_OF_WEEK_LABELS,
  DAY_OF_WEEK_SHORT_LABELS,
  EDUCATION_LEVEL_LABELS,
  PERIOD_TYPE_LABELS,
  PeriodInput,
  PeriodType,
  School,
} from '../types';

const WEEKDAYS = [
  { dayOfWeek: 1, label: 'Lunes', short: 'Lun' },
  { dayOfWeek: 2, label: 'Martes', short: 'Mar' },
  { dayOfWeek: 3, label: 'Miércoles', short: 'Mié' },
  { dayOfWeek: 4, label: 'Jueves', short: 'Jue' },
  { dayOfWeek: 5, label: 'Viernes', short: 'Vie' },
  { dayOfWeek: 6, label: 'Sábado', short: 'Sáb' },
];

function generateDefaultPeriods(
  periodType: PeriodType,
  year: number
): PeriodInput[] {
  if (periodType === 'BIMESTER') {
    return [
      {
        name: '1° Bimestre',
        order: 1,
        startDate: `${year}-03-01`,
        endDate: `${year}-04-30`,
        isRecovery: false,
      },
      {
        name: '2° Bimestre',
        order: 2,
        startDate: `${year}-05-01`,
        endDate: `${year}-07-15`,
        isRecovery: false,
      },
      {
        name: '3° Bimestre',
        order: 3,
        startDate: `${year}-08-01`,
        endDate: `${year}-09-30`,
        isRecovery: false,
      },
      {
        name: '4° Bimestre',
        order: 4,
        startDate: `${year}-10-01`,
        endDate: `${year}-12-15`,
        isRecovery: false,
      },
    ];
  }

  if (periodType === 'TRIMESTER') {
    return [
      {
        name: '1° Trimestre',
        order: 1,
        startDate: `${year}-03-01`,
        endDate: `${year}-05-31`,
        isRecovery: false,
      },
      {
        name: '2° Trimestre',
        order: 2,
        startDate: `${year}-06-01`,
        endDate: `${year}-08-31`,
        isRecovery: false,
      },
      {
        name: '3° Trimestre',
        order: 3,
        startDate: `${year}-09-01`,
        endDate: `${year}-12-15`,
        isRecovery: false,
      },
    ];
  }

  return [
    {
      name: '1° Cuatrimestre',
      order: 1,
      startDate: `${year}-03-01`,
      endDate: `${year}-07-15`,
      isRecovery: false,
    },
    {
      name: '2° Cuatrimestre',
      order: 2,
      startDate: `${year}-08-01`,
      endDate: `${year}-12-15`,
      isRecovery: false,
    },
  ];
}

export const SchoolCoursesPage: React.FC = () => {
  const { schoolId } = useParams<{ schoolId: string }>();
  const navigate = useNavigate();
  const { memberships, setActiveSchoolId } = useAuth();

  const [school, setSchool] = useState<School | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Course Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [division, setDivision] = useState('');
  const [subject, setSubject] = useState('');
  const [academicYear, setAcademicYear] = useState<number>(
    new Date().getFullYear()
  );
  const [periodType, setPeriodType] = useState<PeriodType>('TRIMESTER');
  const [schedules, setSchedules] = useState<CourseScheduleInput[]>([]);
  const [periods, setPeriods] = useState<PeriodInput[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadSchoolAndCourses = useCallback(async () => {
    if (!schoolId) return;
    try {
      setLoading(true);
      setError(null);
      setActiveSchoolId(schoolId);

      // Find school in memberships or fetch list
      const fromMembership = memberships.find(
        (m) => m.school.id === schoolId
      )?.school;

      const [coursesData, allSchools] = await Promise.all([
        coursesApi.listSchoolCourses(schoolId),
        fromMembership ? Promise.resolve(null) : schoolsApi.listSchools(),
      ]);

      const resolvedSchool =
        fromMembership ||
        allSchools?.find((s) => s.id === schoolId) ||
        null;

      setSchool(resolvedSchool);
      setCourses(coursesData);

      // Populate student counts if not already present on course object
      const missingCountCourses = coursesData.filter(
        (c) => typeof c.activeStudentsCount !== 'number'
      );

      if (missingCountCourses.length > 0) {
        const countsEntries = await Promise.all(
          missingCountCourses.map(async (c) => {
            try {
              const enrollments = await studentsApi.listCourseStudents(c.id);
              const activeCount = enrollments.filter(
                (e) => e.status === 'ACTIVE'
              ).length;
              return [c.id, activeCount] as const;
            } catch {
              return [c.id, 0] as const;
            }
          })
        );
        setStudentCounts(Object.fromEntries(countsEntries));
      }
    } catch (err) {
      setError(
        getApiErrorMessage(err, 'No se pudieron cargar los cursos de la escuela')
      );
    } finally {
      setLoading(false);
    }
  }, [schoolId, memberships, setActiveSchoolId]);

  useEffect(() => {
    loadSchoolAndCourses();
  }, [loadSchoolAndCourses]);

  const openNewCourseModal = () => {
    const defaultYear = school?.academicYear || new Date().getFullYear();
    const defaultPType = school?.defaultPeriodType || 'TRIMESTER';
    setName('');
    setDivision('');
    setSubject('');
    setAcademicYear(defaultYear);
    setPeriodType(defaultPType);
    setSchedules([
      { dayOfWeek: 1, startTime: '08:00', endTime: '09:20' },
    ]);
    setPeriods(generateDefaultPeriods(defaultPType, defaultYear));
    setFormError(null);
    setModalOpen(true);
  };

  const handlePeriodTypeChange = (newType: PeriodType) => {
    setPeriodType(newType);
    setPeriods(generateDefaultPeriods(newType, academicYear));
  };

  const handleAcademicYearChange = (newYear: number) => {
    setAcademicYear(newYear);
    if (newYear >= 2000 && newYear <= 2100) {
      setPeriods(generateDefaultPeriods(periodType, newYear));
    }
  };

  // Interactive Schedules handlers
  const isDaySelected = (dayOfWeek: number) =>
    schedules.some((s) => s.dayOfWeek === dayOfWeek);

  const toggleWeekday = (dayOfWeek: number) => {
    if (isDaySelected(dayOfWeek)) {
      setSchedules((prev) => prev.filter((s) => s.dayOfWeek !== dayOfWeek));
    } else {
      setSchedules((prev) =>
        [
          ...prev,
          { dayOfWeek, startTime: '08:00', endTime: '09:20' },
        ].sort((a, b) => a.dayOfWeek - b.dayOfWeek)
      );
    }
  };

  const addScheduleBlock = () => {
    setSchedules((prev) => [
      ...prev,
      { dayOfWeek: 1, startTime: '08:00', endTime: '09:20' },
    ]);
  };

  const updateScheduleRow = (
    index: number,
    field: keyof CourseScheduleInput,
    value: string | number
  ) => {
    setSchedules((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, [field]: value } : item
      )
    );
  };

  const removeScheduleRow = (index: number) => {
    setSchedules((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Periods handlers
  const updatePeriodRow = (
    index: number,
    field: keyof PeriodInput,
    value: string | number | boolean
  ) => {
    setPeriods((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, [field]: value } : item
      )
    );
  };

  const addCustomPeriod = () => {
    const nextOrder = periods.length + 1;
    setPeriods((prev) => [
      ...prev,
      {
        name: `${nextOrder}° Período`,
        order: nextOrder,
        startDate: `${academicYear}-03-01`,
        endDate: `${academicYear}-12-15`,
        isRecovery: false,
      },
    ]);
  };

  const removePeriodRow = (index: number) => {
    if (periods.length <= 1) return;
    setPeriods((prev) =>
      prev
        .filter((_, idx) => idx !== index)
        .map((p, idx) => ({ ...p, order: idx + 1 }))
    );
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolId) return;
    setFormError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError('El nombre del curso (ej. "3° Año") es obligatorio.');
      return;
    }

    if (
      school?.educationLevel === 'SECONDARY' &&
      !subject.trim()
    ) {
      // Note: optional in schema, but helpful check or allow if user wants; prompt says "subject (opcional si es Primaria)"
    }

    for (const s of schedules) {
      if (!s.startTime || !s.endTime) {
        setFormError('Completá la hora de inicio y fin en todos los horarios.');
        return;
      }
      if (s.startTime >= s.endTime) {
        setFormError(
          `En el horario del día ${DAY_OF_WEEK_LABELS[s.dayOfWeek]}, la hora de fin debe ser posterior a la de inicio.`
        );
        return;
      }
    }

    if (periods.length === 0) {
      setFormError('El curso debe tener al menos un período lectivo.');
      return;
    }

    for (const p of periods) {
      if (!p.name.trim() || !p.startDate || !p.endDate) {
        setFormError(
          'Todos los períodos deben tener nombre, fecha de inicio y fecha de fin.'
        );
        return;
      }
      if (p.startDate > p.endDate) {
        setFormError(
          `En "${p.name}", la fecha de fin debe ser igual o posterior a la de inicio.`
        );
        return;
      }
    }

    try {
      setSubmitting(true);
      const created = await coursesApi.createCourse(schoolId, {
        name: trimmedName,
        division: division.trim() || null,
        subject: subject.trim() || null,
        academicYear: Number(academicYear),
        periodType,
        schedules: schedules.map((s) => ({
          dayOfWeek: Number(s.dayOfWeek),
          startTime: s.startTime,
          endTime: s.endTime,
        })),
        periods: periods.map((p, idx) => ({
          name: p.name.trim(),
          order: idx + 1,
          startDate: p.startDate,
          endDate: p.endDate,
          isRecovery: Boolean(p.isRecovery),
        })),
      });

      setCourses((prev) => [created, ...prev]);
      setModalOpen(false);
    } catch (err) {
      setFormError(
        getApiErrorMessage(err, 'No se pudo crear el curso')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const isPrimarySchool = school?.educationLevel === 'PRIMARY';

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Header */}
      <div>
        <Link
          to="/schools"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Volver a Mis Escuelas</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {school ? school.name : 'Cursos de la Escuela'}
              </h1>
              {school && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <GraduationCap className="w-3.5 h-3.5" />
                  Nivel {EDUCATION_LEVEL_LABELS[school.educationLevel]}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-600 mt-1">
              {school
                ? `Ciclo lectivo ${school.academicYear} · Régimen ${
                    PERIOD_TYPE_LABELS[school.defaultPeriodType]
                  }`
                : 'Administrá tus cursos, horarios de cursada y nóminas de alumnos.'}
            </p>
          </div>

          <button
            type="button"
            onClick={openNewCourseModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 transition cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Curso</span>
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 flex items-start gap-2.5 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Courses List */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center justify-center text-slate-500">
          <Loader2 className="w-7 h-7 animate-spin text-indigo-600 mb-3" />
          <p className="text-sm font-medium">Cargando cursos...</p>
        </div>
      ) : courses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto my-6">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            No hay cursos creados en esta escuela
          </h2>
          <p className="text-sm text-slate-600 mt-1.5 mb-6">
            Creá tu primer curso configurando sus días de cursada y períodos
            lectivos para comenzar a cargar alumnos y asistencias.
          </p>
          <button
            type="button"
            onClick={openNewCourseModal}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Crear primer curso</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {courses.map((course) => {
            const count =
              typeof course.activeStudentsCount === 'number'
                ? course.activeStudentsCount
                : studentCounts[course.id] ?? 0;

            return (
              <div
                key={course.id}
                onClick={() => navigate(`/courses/${course.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/courses/${course.id}`);
                  }
                }}
                className="group bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:shadow-md hover:border-indigo-300 transition flex flex-col justify-between cursor-pointer text-left"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {course.name}
                        {course.division ? ` "${course.division}"` : ''}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600">
                        {course.academicYear}
                      </span>
                    </div>

                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <Users className="w-3.5 h-3.5" />
                      {count} {count === 1 ? 'alumno' : 'alumnos'}
                    </span>
                  </div>

                  {/* Subject / Course Title */}
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition">
                    {course.subject ||
                      `${course.name}${
                        course.division ? ` ${course.division}` : ''
                      }`}
                  </h3>
                  {course.subject && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      Curso: {course.name}
                      {course.division ? ` · División ${course.division}` : ''}
                    </p>
                  )}

                  {/* Schedules */}
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-2">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Días y horarios de cursada</span>
                    </div>

                    {course.schedules && course.schedules.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {course.schedules.map((sch, idx) => (
                          <span
                            key={sch.id || idx}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium"
                          >
                            <strong className="text-indigo-700">
                              {DAY_OF_WEEK_SHORT_LABELS[sch.dayOfWeek] ||
                                sch.dayOfWeek}
                            </strong>
                            <span>
                              {sch.startTime} - {sch.endTime}
                            </span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">
                        Sin horarios configurados
                      </p>
                    )}
                  </div>

                  {/* Period Type Info */}
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Régimen {PERIOD_TYPE_LABELS[course.periodType]}
                    </span>
                    <span>
                      {course.periods?.length || 0}{' '}
                      {course.periods?.length === 1 ? 'período' : 'períodos'}
                    </span>
                  </div>
                </div>

                {/* Footer CTA */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-indigo-600 group-hover:text-indigo-700">
                  <span>Abrir cuaderno del curso</span>
                  <ChevronRight className="w-4 h-4 transform group-hover:translate-x-0.5 transition" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Course Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-2xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Nuevo Curso
                  </h2>
                  {school && (
                    <p className="text-xs text-slate-500">{school.name}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => !submitting && setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form
              onSubmit={handleCreateCourse}
              className="p-6 space-y-6 overflow-y-auto flex-1"
            >
              {formError && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3.5 flex items-start gap-2.5 text-red-700 text-xs">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Section 1: Basic Data */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  1. Datos Básicos del Curso
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-1">
                    <label
                      htmlFor="course-name"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Año / Grado *
                    </label>
                    <input
                      id="course-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ej: 3° Año"
                      className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                    />
                  </div>

                  <div className="sm:col-span-1">
                    <label
                      htmlFor="course-division"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      División
                    </label>
                    <input
                      id="course-division"
                      type="text"
                      value={division}
                      onChange={(e) => setDivision(e.target.value)}
                      placeholder="Ej: A"
                      className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                    />
                  </div>

                  <div className="sm:col-span-1">
                    <label
                      htmlFor="course-year"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Ciclo Lectivo *
                    </label>
                    <input
                      id="course-year"
                      type="number"
                      min={2000}
                      max={2100}
                      required
                      value={academicYear}
                      onChange={(e) =>
                        handleAcademicYearChange(Number(e.target.value))
                      }
                      className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="course-subject"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Materia / Área{' '}
                      {isPrimarySchool ? '(Opcional en Primaria)' : ''}
                    </label>
                    <input
                      id="course-subject"
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Ej: Matemática, Lengua, Historia..."
                      className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="course-period-type"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Régimen de Períodos *
                    </label>
                    <select
                      id="course-period-type"
                      value={periodType}
                      onChange={(e) =>
                        handlePeriodTypeChange(e.target.value as PeriodType)
                      }
                      className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                    >
                      <option value="BIMESTER">Bimestral (4 Bimestres)</option>
                      <option value="TRIMESTER">
                        Trimestral (3 Trimestres)
                      </option>
                      <option value="QUADRIMESTER">
                        Cuatrimestral (2 Cuatrimestres)
                      </option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Weekly Schedules */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      2. Horarios Semanales
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Seleccioná los días de cursada y configurá la hora de
                      inicio y fin.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addScheduleBlock}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-500 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar bloque</span>
                  </button>
                </div>

                {/* Quick Day Selector Pills (Lunes a Sábado) */}
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map((day) => {
                    const active = isDaySelected(day.dayOfWeek);
                    return (
                      <button
                        key={day.dayOfWeek}
                        type="button"
                        onClick={() => toggleWeekday(day.dayOfWeek)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                          active
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>

                {/* Schedule Rows */}
                {schedules.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-500">
                    Hacé clic en los días de arriba (Lunes a Sábado) para
                    asignar horarios de clase.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {schedules.map((sch, idx) => (
                      <div
                        key={idx}
                        className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200"
                      >
                        <select
                          value={sch.dayOfWeek}
                          onChange={(e) =>
                            updateScheduleRow(
                              idx,
                              'dayOfWeek',
                              Number(e.target.value)
                            )
                          }
                          aria-label="Día de la semana"
                          className="w-full sm:w-40 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900 focus:border-indigo-600 focus:outline-none"
                        >
                          {WEEKDAYS.map((d) => (
                            <option key={d.dayOfWeek} value={d.dayOfWeek}>
                              {d.label}
                            </option>
                          ))}
                        </select>

                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="time"
                            value={sch.startTime}
                            onChange={(e) =>
                              updateScheduleRow(
                                idx,
                                'startTime',
                                e.target.value
                              )
                            }
                            aria-label="Hora de inicio"
                            className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-indigo-600 focus:outline-none"
                          />
                          <span className="text-xs text-slate-400">a</span>
                          <input
                            type="time"
                            value={sch.endTime}
                            onChange={(e) =>
                              updateScheduleRow(idx, 'endTime', e.target.value)
                            }
                            aria-label="Hora de fin"
                            className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-indigo-600 focus:outline-none"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => removeScheduleRow(idx)}
                          title="Quitar horario"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 3: Auto-generated Periods */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      3. Períodos Lectivos ({PERIOD_TYPE_LABELS[periodType]})
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Podés ajustar los nombres y fechas de inicio/cierre antes
                      de guardar.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setPeriods(
                          generateDefaultPeriods(periodType, academicYear)
                        )
                      }
                      className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
                      title="Restaurar períodos predeterminados"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Autogenerar</span>
                    </button>
                    <button
                      type="button"
                      onClick={addCustomPeriod}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-500 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agregar</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {periods.map((period, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200"
                    >
                      <div className="sm:col-span-4">
                        <label className="block text-[11px] font-medium text-slate-500 mb-0.5">
                          Nombre del período
                        </label>
                        <input
                          type="text"
                          required
                          value={period.name}
                          onChange={(e) =>
                            updatePeriodRow(idx, 'name', e.target.value)
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900 focus:border-indigo-600 focus:outline-none"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-medium text-slate-500 mb-0.5">
                          Fecha inicio
                        </label>
                        <input
                          type="date"
                          required
                          value={period.startDate}
                          onChange={(e) =>
                            updatePeriodRow(idx, 'startDate', e.target.value)
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-indigo-600 focus:outline-none"
                        />
                      </div>

                      <div className="sm:col-span-4">
                        <label className="block text-[11px] font-medium text-slate-500 mb-0.5">
                          Fecha fin
                        </label>
                        <input
                          type="date"
                          required
                          value={period.endDate}
                          onChange={(e) =>
                            updatePeriodRow(idx, 'endDate', e.target.value)
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-indigo-600 focus:outline-none"
                        />
                      </div>

                      <div className="sm:col-span-1 flex justify-end sm:pt-4">
                        <button
                          type="button"
                          onClick={() => removePeriodRow(idx)}
                          disabled={periods.length <= 1}
                          title="Quitar período"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={submitting}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60 transition cursor-pointer"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Crear Curso</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchoolCoursesPage;
