import React, { useCallback, useEffect, useState } from 'react';
import {
  Link,
  NavLink,
  Outlet,
  useOutletContext,
  useParams,
} from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Award,
  Building2,
  Calendar,
  CalendarCheck,
  ClipboardCheck,
  Clock,
  Loader2,
  Settings,
  Users,
} from 'lucide-react';
import { coursesApi } from '../../api/courses.api';
import { getApiErrorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  Course,
  DAY_OF_WEEK_SHORT_LABELS,
  PERIOD_TYPE_LABELS,
} from '../../types';

export interface CourseOutletContext {
  course: Course;
  refreshCourse: () => Promise<void>;
}

export function useCourseContext(): CourseOutletContext {
  return useOutletContext<CourseOutletContext>();
}

export const CourseLayout: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { setActiveSchoolId } = useAuth();

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCourse = useCallback(
    async (silent = false) => {
      if (!courseId) return;
      try {
        if (!silent) setLoading(true);
        setError(null);
        const data = await coursesApi.getCourseDetail(courseId);
        setCourse(data);
        if (data.school?.id) {
          setActiveSchoolId(data.school.id);
        }
      } catch (err) {
        setError(
          getApiErrorMessage(err, 'No se pudo cargar la información del curso')
        );
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [courseId, setActiveSchoolId]
  );

  useEffect(() => {
    fetchCourse(false);
  }, [fetchCourse]);

  const refreshCourse = useCallback(async () => {
    await fetchCourse(true);
  }, [fetchCourse]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-14 flex flex-col items-center justify-center text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
        <p className="text-sm font-medium">Cargando cuaderno del curso...</p>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="space-y-4">
        <Link
          to="/schools"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Volver a Mis Escuelas</span>
        </Link>
        <div className="rounded-2xl bg-red-50 border border-red-200 p-6 flex items-start gap-3 text-red-700">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold">Error al cargar el curso</h3>
            <p className="text-sm mt-1">{error || 'Curso no encontrado'}</p>
          </div>
        </div>
      </div>
    );
  }

  const backToSchoolUrl = course.school?.id
    ? `/schools/${course.school.id}`
    : '/schools';

  const tabs = [
    {
      name: 'Asistencias',
      to: `/courses/${course.id}/attendance`,
      icon: CalendarCheck,
    },
    {
      name: 'Evaluaciones',
      to: `/courses/${course.id}/assessments`,
      icon: ClipboardCheck,
    },
    {
      name: 'Cierre de Período',
      to: `/courses/${course.id}/period-grades`,
      icon: Award,
    },
    {
      name: 'Alumnos',
      to: `/courses/${course.id}/students`,
      icon: Users,
      badge: course.activeStudentsCount ?? 0,
    },
    {
      name: 'Configuración',
      to: `/courses/${course.id}/settings`,
      icon: Settings,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Course Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-5 sm:p-6">
          {/* Back button & school pill */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <Link
              to={backToSchoolUrl}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>
                Volver a {course.school?.name || 'cursos de la escuela'}
              </span>
            </Link>

            {course.school && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                {course.school.name}
              </span>
            )}
          </div>

          {/* Course Title & Metadata */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  {course.subject
                    ? `${course.subject} — ${course.name}${
                        course.division ? ` "${course.division}"` : ''
                      }`
                    : `${course.name}${
                        course.division ? ` "${course.division}"` : ''
                      }`}
                </h1>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Ciclo {course.academicYear}
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-700">
                  {PERIOD_TYPE_LABELS[course.periodType]}
                </span>
              </div>

              {/* Schedules & quick stats */}
              <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600">
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    <strong className="text-slate-900">
                      {course.activeStudentsCount ?? 0}
                    </strong>{' '}
                    alumnos activos
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                  <span>
                    <strong className="text-slate-900">
                      {course.periods?.length || 0}
                    </strong>{' '}
                    períodos configurados
                  </span>
                </div>

                {course.schedules && course.schedules.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <div className="flex flex-wrap gap-1.5">
                      {course.schedules.map((sch, i) => (
                        <span
                          key={sch.id || i}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium"
                        >
                          <strong className="text-indigo-700">
                            {DAY_OF_WEEK_SHORT_LABELS[sch.dayOfWeek]}
                          </strong>
                          {sch.startTime}-{sch.endTime}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-4 sm:px-6 border-t border-slate-200 bg-slate-50/60 overflow-x-auto">
          <nav
            className="flex items-center gap-1 -mb-px min-w-max"
            aria-label="Pestañas del curso"
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  className={({ isActive }) =>
                    `inline-flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-semibold transition whitespace-nowrap ${
                      isActive
                        ? 'border-indigo-600 text-indigo-600 bg-white/60'
                        : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.name}</span>
                  {typeof tab.badge === 'number' && (
                    <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700">
                      {tab.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Active Tab Content */}
      <div>
        <Outlet context={{ course, refreshCourse } satisfies CourseOutletContext} />
      </div>
    </div>
  );
};

export { AttendanceTab as AttendanceTabPlaceholder } from './AttendanceTab';
export { AssessmentsTab as AssessmentsTabPlaceholder } from './AssessmentsTab';
export { PeriodGradesTab as PeriodGradesTabPlaceholder } from './PeriodGradesTab';
export { SettingsTab as SettingsTabPlaceholder } from './SettingsTab';

export default CourseLayout;
