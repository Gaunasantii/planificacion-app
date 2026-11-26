import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertCircle,
  BarChart3,
  Calendar,
  CalendarCheck,
  CalendarOff,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  History,
  Loader2,
  MessageSquare,
  Save,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { attendanceApi } from '../../api/attendance.api';
import { studentsApi } from '../../api/students.api';
import { getApiErrorMessage } from '../../api/client';
import {
  AttendanceRecordInput,
  AttendanceStatus,
  ClassSession,
  CourseAttendanceSummaryResponse,
  CourseEnrollment,
  DAY_OF_WEEK_SHORT_LABELS,
  SuggestedSessionDate,
} from '../../types';
import { useCourseContext } from './CourseLayout';

interface LocalStudentAttendanceRow {
  enrollmentId: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    dni?: string | null;
  };
  status: AttendanceStatus | null;
  notes: string;
  showNotes: boolean;
}

function getTodayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatHumanDate(dateStr: string): string {
  if (!dateStr) return '';
  const clean = dateStr.slice(0, 10);
  const [y, m, d] = clean.split('-').map(Number);
  if (!y || !m || !d) return clean;
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  const dayName = DAY_OF_WEEK_SHORT_LABELS[dateObj.getUTCDay()] || '';
  return `${dayName} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

export const AttendanceTab: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { course } = useCourseContext();

  // Sub-view mode: 'daily' (Toma de lista) | 'summary' (Porcentajes acumulados)
  const [viewMode, setViewMode] = useState<'daily' | 'summary'>('daily');

  // Sessions & suggestions state
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [suggestedDates, setSuggestedDates] = useState<SuggestedSessionDate[]>(
    []
  );
  const [activeEnrollments, setActiveEnrollments] = useState<
    CourseEnrollment[]
  >([]);

  // Selected session / date form state
  const [selectedDate, setSelectedDate] = useState<string>(getTodayIsoDate());
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [topic, setTopic] = useState<string>('');
  const [isCancelled, setIsCancelled] = useState<boolean>(false);
  const [rows, setRows] = useState<LocalStudentAttendanceRow[]>([]);

  // UI feedback states
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [loadingSession, setLoadingSession] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [historyOpenMobile, setHistoryOpenMobile] = useState<boolean>(false);

  // Accumulated Summary state
  const [asOfDate, setAsOfDate] = useState<string>(getTodayIsoDate());
  const [summaryData, setSummaryData] =
    useState<CourseAttendanceSummaryResponse | null>(null);
  const [loadingSummary, setLoadingSummary] = useState<boolean>(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const buildEmptyRowsFromEnrollments = useCallback(
    (enrollments: CourseEnrollment[]): LocalStudentAttendanceRow[] => {
      return [...enrollments]
        .filter((e) => e.status === 'ACTIVE')
        .sort((a, b) => {
          const cmp = a.student.lastName.localeCompare(
            b.student.lastName,
            'es',
            { sensitivity: 'base' }
          );
          if (cmp !== 0) return cmp;
          return a.student.firstName.localeCompare(b.student.firstName, 'es', {
            sensitivity: 'base',
          });
        })
        .map((e) => ({
          enrollmentId: e.id,
          student: {
            id: e.student.id,
            firstName: e.student.firstName,
            lastName: e.student.lastName,
            dni: e.student.dni ?? null,
          },
          status: null,
          notes: '',
          showNotes: false,
        }));
    },
    []
  );

  const loadSessionDetailById = useCallback(
    async (sessionId: string) => {
      try {
        setLoadingSession(true);
        setError(null);
        setSuccessMessage(null);
        const detail = await attendanceApi.getSessionAttendance(sessionId);
        setActiveSessionId(detail.session.id);
        setSelectedDate(detail.session.date.slice(0, 10));
        setTopic(detail.session.topic || '');
        setIsCancelled(Boolean(detail.session.isCancelled));

        const list = detail.students || detail.records || [];
        setRows(
          list.map((item) => ({
            enrollmentId: item.enrollmentId,
            student: {
              id: item.student.id,
              firstName: item.student.firstName,
              lastName: item.student.lastName,
              dni: item.student.dni ?? null,
            },
            status: item.status ?? null,
            notes: item.notes || '',
            showNotes: Boolean(item.notes && item.notes.trim().length > 0),
          }))
        );
      } catch (err) {
        setError(
          getApiErrorMessage(err, 'No se pudo cargar la planilla de la sesión')
        );
      } finally {
        setLoadingSession(false);
      }
    },
    []
  );

  const loadInitialData = useCallback(async () => {
    if (!courseId) return;
    try {
      setLoadingInitial(true);
      setError(null);

      const [sessionsRes, enrollmentsRes] = await Promise.all([
        attendanceApi.listCourseSessions(courseId),
        studentsApi.listCourseStudents(courseId),
      ]);

      const fetchedSessions = sessionsRes.sessions || [];
      const fetchedSuggestions = sessionsRes.suggestedDates || [];

      setSessions(fetchedSessions);
      setSuggestedDates(fetchedSuggestions);
      setActiveEnrollments(enrollmentsRes);

      const today = getTodayIsoDate();
      const todaySession = fetchedSessions.find(
        (s) => s.date.slice(0, 10) === today
      );

      if (todaySession) {
        await loadSessionDetailById(todaySession.id);
      } else if (fetchedSessions.length > 0) {
        await loadSessionDetailById(fetchedSessions[0].id);
      } else {
        const initialDate =
          fetchedSuggestions.length > 0
            ? fetchedSuggestions[0].date.slice(0, 10)
            : today;
        setSelectedDate(initialDate);
        setActiveSessionId(null);
        setTopic('');
        setIsCancelled(false);
        setRows(buildEmptyRowsFromEnrollments(enrollmentsRes));
      }
    } catch (err) {
      setError(
        getApiErrorMessage(
          err,
          'No se pudieron cargar las sesiones de asistencia'
        )
      );
    } finally {
      setLoadingInitial(false);
    }
  }, [courseId, buildEmptyRowsFromEnrollments, loadSessionDetailById]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const handleSelectDate = async (dateStr: string) => {
    const cleanDate = dateStr.slice(0, 10);
    setSelectedDate(cleanDate);
    setError(null);
    setSuccessMessage(null);

    const existing = sessions.find((s) => s.date.slice(0, 10) === cleanDate);
    if (existing) {
      await loadSessionDetailById(existing.id);
    } else {
      setActiveSessionId(null);
      setTopic('');
      setIsCancelled(false);
      setRows(buildEmptyRowsFromEnrollments(activeEnrollments));
    }
  };

  const handleSetStudentStatus = (
    enrollmentId: string,
    status: AttendanceStatus
  ) => {
    setSuccessMessage(null);
    setRows((prev) =>
      prev.map((row) =>
        row.enrollmentId === enrollmentId ? { ...row, status } : row
      )
    );
  };

  const handleToggleNotesField = (enrollmentId: string) => {
    setRows((prev) =>
      prev.map((row) =>
        row.enrollmentId === enrollmentId
          ? { ...row, showNotes: !row.showNotes }
          : row
      )
    );
  };

  const handleChangeNotes = (enrollmentId: string, notes: string) => {
    setSuccessMessage(null);
    setRows((prev) =>
      prev.map((row) =>
        row.enrollmentId === enrollmentId ? { ...row, notes } : row
      )
    );
  };

  const handleMarkAllPresent = () => {
    if (isCancelled) return;
    setSuccessMessage(null);
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        status: 'PRESENT',
      }))
    );
  };

  const handleSaveAttendance = async () => {
    if (!courseId) return;
    if (!selectedDate) {
      setError('Seleccioná una fecha válida para guardar la asistencia.');
      return;
    }

    const recordsToSave: AttendanceRecordInput[] = isCancelled
      ? []
      : rows
          .filter((r) => r.status !== null)
          .map((r) => ({
            enrollmentId: r.enrollmentId,
            status: r.status as AttendanceStatus,
            notes: r.notes.trim() ? r.notes.trim() : null,
          }));

    if (!isCancelled && rows.length > 0 && recordsToSave.length === 0) {
      setError(
        'Marcá el estado de al menos un alumno o usá "Marcar todos Presentes" antes de guardar.'
      );
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      let targetSessionId = activeSessionId;

      if (!targetSessionId) {
        const created = await attendanceApi.createOrGetSession(courseId, {
          date: selectedDate,
          topic: topic.trim() ? topic.trim() : null,
          isCancelled,
          records: recordsToSave,
        });
        targetSessionId = created.session.id;
      }

      const saved = await attendanceApi.saveSessionAttendance(targetSessionId, {
        topic: topic.trim() ? topic.trim() : null,
        isCancelled,
        records: recordsToSave,
      });

      setActiveSessionId(saved.session.id);
      setTopic(saved.session.topic || '');
      setIsCancelled(Boolean(saved.session.isCancelled));

      const updatedStudents = saved.students || saved.records || [];
      setRows(
        updatedStudents.map((item) => ({
          enrollmentId: item.enrollmentId,
          student: {
            id: item.student.id,
            firstName: item.student.firstName,
            lastName: item.student.lastName,
            dni: item.student.dni ?? null,
          },
          status: item.status ?? null,
          notes: item.notes || '',
          showNotes: Boolean(item.notes && item.notes.trim().length > 0),
        }))
      );

      // Refresh sessions list & suggested dates
      const sessionsRes = await attendanceApi.listCourseSessions(courseId);
      setSessions(sessionsRes.sessions || []);
      setSuggestedDates(sessionsRes.suggestedDates || []);

      setSuccessMessage(
        isCancelled
          ? 'Clase registrada como sin actividad / cancelada.'
          : 'Asistencia guardada correctamente.'
      );
    } catch (err) {
      setError(
        getApiErrorMessage(err, 'No se pudo guardar la planilla de asistencia')
      );
    } finally {
      setSaving(false);
    }
  };

  // Load accumulated summary
  const loadSummary = useCallback(
    async (cutoffDate?: string) => {
      if (!courseId) return;
      try {
        setLoadingSummary(true);
        setSummaryError(null);
        const data = await attendanceApi.getCourseAttendanceSummary(
          courseId,
          cutoffDate || asOfDate
        );
        setSummaryData(data);
      } catch (err) {
        setSummaryError(
          getApiErrorMessage(
            err,
            'No se pudo obtener el resumen acumulado de asistencia'
          )
        );
      } finally {
        setLoadingSummary(false);
      }
    },
    [courseId, asOfDate]
  );

  useEffect(() => {
    if (viewMode === 'summary') {
      loadSummary(asOfDate);
    }
  }, [viewMode, asOfDate, loadSummary]);

  // Live counters for current roll call
  const liveCounters = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let justified = 0;
    let unmarked = 0;

    for (const r of rows) {
      if (r.status === 'PRESENT') present++;
      else if (r.status === 'ABSENT') absent++;
      else if (r.status === 'LATE') late++;
      else if (r.status === 'JUSTIFIED_ABSENT') justified++;
      else unmarked++;
    }

    return {
      total: rows.length,
      present,
      absent,
      late,
      justified,
      unmarked,
      recorded: rows.length - unmarked,
    };
  }, [rows]);

  if (loadingInitial) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center justify-center text-slate-500">
        <Loader2 className="w-7 h-7 animate-spin text-indigo-600 mb-3" />
        <p className="text-sm font-medium">
          Cargando módulo de asistencias...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Mode Switcher Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-indigo-600" />
            <span>Control de Asistencias</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tomá lista en segundos desde el aula o consultá los porcentajes
            acumulados por alumno.
          </p>
        </div>

        <div className="inline-flex rounded-xl bg-slate-100 p-1 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('daily')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition cursor-pointer ${
              viewMode === 'daily'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CalendarCheck className="w-4 h-4" />
            <span>Toma de Lista</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('summary')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition cursor-pointer ${
              viewMode === 'summary'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Porcentajes Acumulados</span>
          </button>
        </div>
      </div>

      {viewMode === 'daily' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left / Main Column: Date Selector + Roll Call Grid */}
          <div className="lg:col-span-8 xl:col-span-9 space-y-5">
            {/* Session & Date Configuration Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-4">
              {/* Suggested Dates Quick Chips */}
              {suggestedDates.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Próximas fechas sugeridas según horario:</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {suggestedDates.map((sug) => {
                      const isSelected =
                        selectedDate === sug.date.slice(0, 10) &&
                        !activeSessionId;
                      return (
                        <button
                          key={`${sug.date}-${sug.startTime}`}
                          type="button"
                          onClick={() => handleSelectDate(sug.date)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-indigo-50/70 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                          }`}
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{formatHumanDate(sug.date)}</span>
                          <span
                            className={`text-[11px] ${
                              isSelected ? 'text-indigo-100' : 'text-indigo-500'
                            }`}
                          >
                            ({sug.startTime})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Date Picker, Topic & Cancelled Switch */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
                <div className="sm:col-span-4">
                  <label
                    htmlFor="session-date"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Fecha de la clase
                  </label>
                  <input
                    id="session-date"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => handleSelectDate(e.target.value)}
                    className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                  />
                </div>

                <div className="sm:col-span-8">
                  <label
                    htmlFor="session-topic"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Tema de la clase / Contenido dado (opcional)
                  </label>
                  <div className="relative">
                    <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="session-topic"
                      type="text"
                      value={topic}
                      onChange={(e) => {
                        setTopic(e.target.value);
                        setSuccessMessage(null);
                      }}
                      placeholder="Ej: Unidad 2 - Ecuaciones lineales / Práctica grupal"
                      className="block w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                    />
                  </div>
                </div>
              </div>

              {/* Session Status Pill + Cancelled Switch */}
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold ${
                      activeSessionId
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    {activeSessionId
                      ? `Sesión registrada (${formatHumanDate(selectedDate)})`
                      : `Nueva sesión (${formatHumanDate(selectedDate)})`}
                  </span>
                </div>

                <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isCancelled}
                    onChange={(e) => {
                      setIsCancelled(e.target.checked);
                      setSuccessMessage(null);
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all relative peer-checked:bg-red-600" />
                  <span className="text-xs font-semibold text-slate-700">
                    Clase sin actividad / Cancelada
                  </span>
                </label>
              </div>
            </div>

            {/* Feedback Alerts */}
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-4 flex items-start justify-between gap-2.5 text-red-700 text-sm">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="text-red-500 hover:text-red-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {successMessage && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-center justify-between gap-2.5 text-emerald-800 text-sm">
                <div className="flex items-center gap-2.5 font-medium">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{successMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSuccessMessage(null)}
                  className="text-emerald-600 hover:text-emerald-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Fast Roll Call Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              {/* Action Header */}
              <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">
                    Planilla del Día
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                      P: {liveCounters.present}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-red-100 text-red-800">
                      A: {liveCounters.absent}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                      T: {liveCounters.late}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-800">
                      J: {liveCounters.justified}
                    </span>
                    {liveCounters.unmarked > 0 && !isCancelled && (
                      <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-700">
                        Sin marcar: {liveCounters.unmarked}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!isCancelled && rows.length > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllPresent}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs sm:text-sm font-semibold text-emerald-800 hover:bg-emerald-100 transition cursor-pointer"
                    >
                      <CheckCheck className="w-4 h-4 text-emerald-600" />
                      <span>Marcar todos Presentes</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={saving || loadingSession}
                    onClick={handleSaveAttendance}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 disabled:opacity-60 transition cursor-pointer"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>Guardar Asistencia</span>
                  </button>
                </div>
              </div>

              {/* Roll Call Content */}
              {loadingSession ? (
                <div className="p-12 flex flex-col items-center justify-center text-slate-500">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mb-2" />
                  <p className="text-xs font-medium">
                    Cargando asistencia de la sesión...
                  </p>
                </div>
              ) : isCancelled ? (
                <div className="p-10 text-center max-w-md mx-auto">
                  <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3">
                    <CalendarOff className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">
                    Clase marcada como Sin Actividad / Cancelada
                  </h3>
                  <p className="text-xs text-slate-600 mt-1.5">
                    Esta sesión no computará inasistencias en el cálculo del
                    porcentaje acumulado del curso. Hacé clic en{' '}
                    <strong>Guardar Asistencia</strong> para registrar el
                    estado.
                  </p>
                </div>
              ) : rows.length === 0 ? (
                <div className="p-10 text-center max-w-md mx-auto">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-3">
                    <Users className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">
                    No hay alumnos activos en este curso
                  </h3>
                  <p className="text-xs text-slate-600 mt-1">
                    Agregá o importá alumnos en la pestaña{' '}
                    <strong>Alumnos</strong> para comenzar a tomar asistencia.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {rows.map((row, index) => {
                    const st = row.status;

                    return (
                      <div
                        key={row.enrollmentId}
                        className="p-3.5 sm:px-5 hover:bg-slate-50/70 transition"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          {/* Student Name */}
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-6 text-xs font-semibold text-slate-400 text-right shrink-0">
                              {index + 1}.
                            </span>
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-slate-900 truncate">
                                {row.student.lastName},{' '}
                                <span className="font-medium text-slate-700">
                                  {row.student.firstName}
                                </span>
                              </div>
                              {row.student.dni && (
                                <div className="text-[11px] text-slate-400 font-mono">
                                  DNI {row.student.dni}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* 4 Toggle Buttons (P, A, T, J) + Notes Toggle */}
                          <div className="flex items-center justify-between sm:justify-end gap-2 pl-9 sm:pl-0">
                            <div
                              className="inline-flex items-center gap-1.5"
                              role="group"
                              aria-label={`Estado de asistencia para ${row.student.lastName} ${row.student.firstName}`}
                            >
                              {/* P - Presente (Verde) */}
                              <button
                                type="button"
                                onClick={() =>
                                  handleSetStudentStatus(
                                    row.enrollmentId,
                                    'PRESENT'
                                  )
                                }
                                title="Presente (1.0)"
                                className={`w-11 h-10 sm:w-12 sm:h-10 rounded-xl font-bold text-sm border transition cursor-pointer flex flex-col items-center justify-center ${
                                  st === 'PRESENT'
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-600/20'
                                    : 'bg-emerald-50/60 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                }`}
                              >
                                <span>P</span>
                              </button>

                              {/* A - Ausente (Rojo) */}
                              <button
                                type="button"
                                onClick={() =>
                                  handleSetStudentStatus(
                                    row.enrollmentId,
                                    'ABSENT'
                                  )
                                }
                                title="Ausente (0.0)"
                                className={`w-11 h-10 sm:w-12 sm:h-10 rounded-xl font-bold text-sm border transition cursor-pointer flex flex-col items-center justify-center ${
                                  st === 'ABSENT'
                                    ? 'bg-red-600 text-white border-red-600 shadow-xs ring-2 ring-red-600/20'
                                    : 'bg-red-50/60 text-red-800 border-red-200 hover:bg-red-100'
                                }`}
                              >
                                <span>A</span>
                              </button>

                              {/* T - Tardanza (Ámbar) */}
                              <button
                                type="button"
                                onClick={() =>
                                  handleSetStudentStatus(
                                    row.enrollmentId,
                                    'LATE'
                                  )
                                }
                                title="Tardanza / Media falta (0.5)"
                                className={`w-11 h-10 sm:w-12 sm:h-10 rounded-xl font-bold text-sm border transition cursor-pointer flex flex-col items-center justify-center ${
                                  st === 'LATE'
                                    ? 'bg-amber-500 text-white border-amber-500 shadow-xs ring-2 ring-amber-500/20'
                                    : 'bg-amber-50/60 text-amber-800 border-amber-200 hover:bg-amber-100'
                                }`}
                              >
                                <span>T</span>
                              </button>

                              {/* J - Justificado (Azul) */}
                              <button
                                type="button"
                                onClick={() =>
                                  handleSetStudentStatus(
                                    row.enrollmentId,
                                    'JUSTIFIED_ABSENT'
                                  )
                                }
                                title="Ausente Justificado"
                                className={`w-11 h-10 sm:w-12 sm:h-10 rounded-xl font-bold text-sm border transition cursor-pointer flex flex-col items-center justify-center ${
                                  st === 'JUSTIFIED_ABSENT'
                                    ? 'bg-sky-600 text-white border-sky-600 shadow-xs ring-2 ring-sky-600/20'
                                    : 'bg-sky-50/60 text-sky-800 border-sky-200 hover:bg-sky-100'
                                }`}
                              >
                                <span>J</span>
                              </button>
                            </div>

                            {/* Observation Toggle Button */}
                            <button
                              type="button"
                              onClick={() =>
                                handleToggleNotesField(row.enrollmentId)
                              }
                              title="Agregar o ver observación"
                              className={`p-2.5 rounded-xl border text-xs font-medium transition cursor-pointer ${
                                row.showNotes || row.notes.trim().length > 0
                                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                  : 'bg-white text-slate-400 border-slate-200 hover:text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Collapsible Brief Observation Input */}
                        {row.showNotes && (
                          <div className="mt-2.5 pl-9">
                            <input
                              type="text"
                              value={row.notes}
                              onChange={(e) =>
                                handleChangeNotes(
                                  row.enrollmentId,
                                  e.target.value
                                )
                              }
                              placeholder="Observación breve (ej: Certificado médico, retirado antes)..."
                              className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-indigo-600 focus:outline-none"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Bottom Sticky/Footer Save Button for Mobile Convenience */}
              {rows.length > 0 && (
                <div className="p-4 bg-slate-50/80 border-t border-slate-200 flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-500">
                    {isCancelled
                      ? 'Sesión marcada como cancelada'
                      : `${liveCounters.recorded} de ${liveCounters.total} alumnos marcados`}
                  </span>
                  <button
                    type="button"
                    disabled={saving || loadingSession}
                    onClick={handleSaveAttendance}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 disabled:opacity-60 transition cursor-pointer"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>Guardar Asistencia</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Previous Sessions History */}
          <div className="lg:col-span-4 xl:col-span-3">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <button
                type="button"
                onClick={() => setHistoryOpenMobile((prev) => !prev)}
                className="w-full p-4 border-b border-slate-100 flex items-center justify-between text-left lg:cursor-default"
              >
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Clases Anteriores ({sessions.length})
                  </h3>
                </div>
                <span className="lg:hidden text-slate-400">
                  {historyOpenMobile ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </span>
              </button>

              <div
                className={`${
                  historyOpenMobile ? 'block' : 'hidden'
                } lg:block max-h-[540px] overflow-y-auto divide-y divide-slate-100`}
              >
                {sessions.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    Aún no hay clases registradas en el historial.
                  </div>
                ) : (
                  sessions.map((sess) => {
                    const isCurrent = activeSessionId === sess.id;
                    const p = sess.summary?.present ?? sess.present ?? 0;
                    const a = sess.summary?.absent ?? sess.absent ?? 0;
                    const t = sess.summary?.late ?? sess.late ?? 0;
                    const j = sess.summary?.justified ?? sess.justified ?? 0;

                    return (
                      <button
                        key={sess.id}
                        type="button"
                        onClick={() => loadSessionDetailById(sess.id)}
                        className={`w-full p-3.5 text-left transition flex flex-col gap-1.5 cursor-pointer ${
                          isCurrent
                            ? 'bg-indigo-50/80 border-l-4 border-indigo-600'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-900">
                            {formatHumanDate(sess.date)}
                          </span>
                          {sess.isCancelled ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                              Cancelada
                            </span>
                          ) : (
                            <div className="flex items-center gap-1 text-[11px] font-semibold">
                              <span className="text-emerald-700">{p}P</span>
                              <span className="text-slate-300">·</span>
                              <span className="text-red-700">{a}A</span>
                              {t > 0 && (
                                <>
                                  <span className="text-slate-300">·</span>
                                  <span className="text-amber-700">{t}T</span>
                                </>
                              )}
                              {j > 0 && (
                                <>
                                  <span className="text-slate-300">·</span>
                                  <span className="text-sky-700">{j}J</span>
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        {sess.topic && (
                          <p className="text-xs text-slate-500 truncate">
                            {sess.topic}
                          </p>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Sub-View: Accumulated Attendance Percentages */
        <div className="space-y-5">
          {/* Filter Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Resumen Acumulado de Presentismo
              </h3>
              <p className="text-xs text-slate-500">
                Clases computables hasta la fecha de corte:{' '}
                <strong className="text-slate-800">
                  {summaryData?.totalCourseSessions ?? 0}
                </strong>{' '}
                ·{' '}
                <span>
                  Ausente justificado:{' '}
                  <strong className="text-slate-700">
                    {(summaryData?.justifiedCountsAsPresent ??
                    course.gradingConfig?.justifiedCountsAsPresent ??
                    true)
                      ? 'Cuenta como Presente'
                      : 'Cuenta como Ausente'}
                  </strong>
                </span>
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <label
                htmlFor="summary-as-of-date"
                className="text-xs font-semibold text-slate-700 whitespace-nowrap"
              >
                Fecha de corte:
              </label>
              <input
                id="summary-as-of-date"
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
              />
            </div>
          </div>

          {summaryError && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-4 flex items-start gap-2.5 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{summaryError}</span>
            </div>
          )}

          {loadingSummary ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center justify-center text-slate-500">
              <Loader2 className="w-7 h-7 animate-spin text-indigo-600 mb-3" />
              <p className="text-sm font-medium">
                Calculando porcentajes acumulados...
              </p>
            </div>
          ) : !summaryData || summaryData.students.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-500">
              No hay alumnos activos para calcular el resumen de asistencia.
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-4 w-10 text-center">#</th>
                      <th className="py-3 px-4">Alumno</th>
                      <th className="py-3 px-3 text-center">Clases</th>
                      <th className="py-3 px-3 text-center text-emerald-700">
                        Presentes
                      </th>
                      <th className="py-3 px-3 text-center text-red-700">
                        Ausentes
                      </th>
                      <th className="py-3 px-3 text-center text-amber-700">
                        Tardanzas (½)
                      </th>
                      <th className="py-3 px-3 text-center text-sky-700">
                        Justificadas
                      </th>
                      <th className="py-3 px-4 text-right min-w-[180px]">
                        % Asistencia Acumulado
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {summaryData.students.map((item, idx) => {
                      const pct = item.attendancePercentage;
                      const badgeColor =
                        pct >= 80
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : pct >= 60
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-red-50 text-red-700 border-red-200';
                      const barColor =
                        pct >= 80
                          ? 'bg-emerald-500'
                          : pct >= 60
                          ? 'bg-amber-500'
                          : 'bg-red-500';

                      return (
                        <tr
                          key={item.enrollmentId}
                          className="hover:bg-slate-50/80 transition"
                        >
                          <td className="py-3 px-4 text-center text-xs font-medium text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">
                              {item.student.lastName},{' '}
                              <span className="font-medium text-slate-700">
                                {item.student.firstName}
                              </span>
                            </div>
                            {item.student.dni && (
                              <div className="text-xs text-slate-400 font-mono">
                                DNI {item.student.dni}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center font-semibold text-slate-700">
                            {item.totalSessions}
                          </td>
                          <td className="py-3 px-3 text-center font-semibold text-emerald-700">
                            {item.present}
                          </td>
                          <td className="py-3 px-3 text-center font-semibold text-red-700">
                            {item.absent}
                          </td>
                          <td className="py-3 px-3 text-center font-semibold text-amber-700">
                            {item.late}
                          </td>
                          <td className="py-3 px-3 text-center font-semibold text-sky-700">
                            {item.justified}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-end gap-2.5">
                              <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                                <div
                                  className={`h-full rounded-full ${barColor}`}
                                  style={{
                                    width: `${Math.min(100, Math.max(0, pct))}%`,
                                  }}
                                />
                              </div>
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${badgeColor}`}
                              >
                                {pct.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AttendanceTab;
