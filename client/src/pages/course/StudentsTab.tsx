import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertCircle,
  Check,
  ClipboardPaste,
  Loader2,
  Pencil,
  Search,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { studentsApi } from '../../api/students.api';
import { getApiErrorMessage } from '../../api/client';
import {
  CourseEnrollment,
  CreateStudentInput,
  ENROLLMENT_STATUS_LABELS,
  EnrollmentStatus,
} from '../../types';
import { useCourseContext } from './CourseLayout';

interface ParsedStudentRow extends CreateStudentInput {
  id: string;
  rawLine: string;
  isValid: boolean;
}

function parseSingleStudentLine(line: string, index: number): ParsedStudentRow {
  // Strip optional leading list numbering like "1. ", "02) ", "3 - "
  const cleaned = line.trim().replace(/^\d+\s*[.)\-:]\s*/, '').trim();

  let lastName = '';
  let firstName = '';
  let dni: string | null = null;

  const isDniToken = (val: string) => /^[\d.]{6,12}$/.test(val.trim());
  const normalizeDni = (val: string) => val.trim().replace(/\./g, '');

  // 1. Tab-separated (Excel / Sheets) or Semicolon-separated
  if (cleaned.includes('\t') || cleaned.includes(';')) {
    const delimiter = cleaned.includes('\t') ? '\t' : ';';
    const cols = cleaned
      .split(delimiter)
      .map((c) => c.trim())
      .filter(Boolean);

    if (cols.length >= 3) {
      // Check if col[0] is DNI
      if (isDniToken(cols[0])) {
        dni = normalizeDni(cols[0]);
        lastName = cols[1];
        firstName = cols.slice(2).join(' ');
      } else {
        lastName = cols[0];
        firstName = cols[1];
        dni = normalizeDni(cols[2]);
      }
    } else if (cols.length === 2) {
      if (isDniToken(cols[1])) {
        dni = normalizeDni(cols[1]);
        // Parse name in cols[0]
        if (cols[0].includes(',')) {
          const [l, f] = cols[0].split(',').map((s) => s.trim());
          lastName = l || '';
          firstName = f || '';
        } else {
          const tokens = cols[0].split(/\s+/);
          lastName = tokens[0] || '';
          firstName = tokens.slice(1).join(' ');
        }
      } else {
        lastName = cols[0];
        firstName = cols[1];
      }
    } else if (cols.length === 1) {
      const tokens = cols[0].split(/\s+/);
      lastName = tokens[0] || '';
      firstName = tokens.slice(1).join(' ');
    }
  }
  // 2. Comma-separated: "Apellido, Nombre, DNI" or "Apellido, Nombre"
  else if (cleaned.includes(',')) {
    const parts = cleaned
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    lastName = parts[0] || '';

    if (parts.length >= 3) {
      firstName = parts[1] || '';
      dni = normalizeDni(parts[2]);
    } else if (parts.length === 2) {
      // Check if parts[1] has a trailing DNI (e.g. "Apellido, Juan 45123456")
      const tokens = parts[1].split(/\s+/).filter(Boolean);
      if (tokens.length >= 2 && isDniToken(tokens[tokens.length - 1])) {
        dni = normalizeDni(tokens.pop()!);
        firstName = tokens.join(' ');
      } else {
        firstName = parts[1];
      }
    }
  }
  // 3. Space-separated: "Apellido Nombre" or "Apellido Nombre DNI"
  else {
    const tokens = cleaned.split(/\s+/).filter(Boolean);
    if (tokens.length >= 3 && isDniToken(tokens[tokens.length - 1])) {
      dni = normalizeDni(tokens.pop()!);
    }

    if (tokens.length >= 2) {
      lastName = tokens[0];
      firstName = tokens.slice(1).join(' ');
    } else if (tokens.length === 1) {
      lastName = tokens[0];
      firstName = '';
    }
  }

  return {
    id: `row-${index}-${Date.now()}`,
    rawLine: line,
    lastName: lastName.trim(),
    firstName: firstName.trim(),
    dni: dni && dni.length > 0 ? dni : null,
    isValid: Boolean(lastName.trim() && firstName.trim()),
  };
}

export function parseBulkStudentsText(rawText: string): ParsedStudentRow[] {
  return rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((line, index) => parseSingleStudentLine(line, index));
}

export const StudentsTab: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const outletCtx = useCourseContext();
  const refreshCourse = outletCtx?.refreshCourse;

  const [enrollments, setEnrollments] = useState<CourseEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Instant Search & Status Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<EnrollmentStatus | 'ALL'>(
    'ALL'
  );

  // Individual Create / Edit Student Modal
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [editingEnrollment, setEditingEnrollment] =
    useState<CourseEnrollment | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dni, setDni] = useState('');
  const [status, setStatus] = useState<EnrollmentStatus>('ACTIVE');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Quick status change loading tracker
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  // Bulk Import ("Pegar lista") Modal
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedStudentRow[]>([]);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  const loadStudents = useCallback(async () => {
    if (!courseId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await studentsApi.listCourseStudents(courseId);
      setEnrollments(data);
    } catch (err) {
      setError(
        getApiErrorMessage(err, 'No se pudo cargar la nómina de alumnos')
      );
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  // Alphabetically sorted and filtered enrollments
  const sortedAndFilteredEnrollments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return [...enrollments]
      .sort((a, b) => {
        const lastCmp = a.student.lastName.localeCompare(
          b.student.lastName,
          'es',
          { sensitivity: 'base' }
        );
        if (lastCmp !== 0) return lastCmp;
        return a.student.firstName.localeCompare(b.student.firstName, 'es', {
          sensitivity: 'base',
        });
      })
      .filter((enrollment) => {
        if (statusFilter !== 'ALL' && enrollment.status !== statusFilter) {
          return false;
        }
        if (!q) return true;
        const fullLastFirst =
          `${enrollment.student.lastName} ${enrollment.student.firstName}`.toLowerCase();
        const fullFirstLast =
          `${enrollment.student.firstName} ${enrollment.student.lastName}`.toLowerCase();
        const studentDni = (enrollment.student.dni || '').toLowerCase();

        return (
          fullLastFirst.includes(q) ||
          fullFirstLast.includes(q) ||
          studentDni.includes(q)
        );
      });
  }, [enrollments, searchQuery, statusFilter]);

  // Status counts
  const counts = useMemo(() => {
    let active = 0;
    let dropped = 0;
    let transferred = 0;
    for (const e of enrollments) {
      if (e.status === 'ACTIVE') active++;
      else if (e.status === 'DROPPED') dropped++;
      else if (e.status === 'TRANSFERRED') transferred++;
    }
    return {
      total: enrollments.length,
      active,
      dropped,
      transferred,
    };
  }, [enrollments]);

  // Individual Create / Edit Modal handlers
  const openCreateStudentModal = () => {
    setEditingEnrollment(null);
    setLastName('');
    setFirstName('');
    setDni('');
    setStatus('ACTIVE');
    setFormError(null);
    setStudentModalOpen(true);
  };

  const openEditStudentModal = (enrollment: CourseEnrollment) => {
    setEditingEnrollment(enrollment);
    setLastName(enrollment.student.lastName);
    setFirstName(enrollment.student.firstName);
    setDni(enrollment.student.dni || '');
    setStatus(enrollment.status);
    setFormError(null);
    setStudentModalOpen(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return;
    setFormError(null);

    const trimmedLast = lastName.trim();
    const trimmedFirst = firstName.trim();
    const trimmedDni = dni.trim() || null;

    if (!trimmedLast || !trimmedFirst) {
      setFormError('El apellido y el nombre del alumno son obligatorios.');
      return;
    }

    try {
      setSubmitting(true);
      if (editingEnrollment) {
        const updated = await studentsApi.updateEnrollment(
          editingEnrollment.id,
          {
            lastName: trimmedLast,
            firstName: trimmedFirst,
            dni: trimmedDni,
            status,
          }
        );
        setEnrollments((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item))
        );
      } else {
        const created = await studentsApi.enrollStudent(courseId, {
          lastName: trimmedLast,
          firstName: trimmedFirst,
          dni: trimmedDni,
        });
        setEnrollments((prev) => [...prev, created]);
      }

      if (refreshCourse) {
        await refreshCourse();
      }
      setStudentModalOpen(false);
      setEditingEnrollment(null);
    } catch (err) {
      setFormError(
        getApiErrorMessage(err, 'No se pudo guardar los datos del alumno')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickStatusChange = async (
    enrollment: CourseEnrollment,
    newStatus: EnrollmentStatus
  ) => {
    if (enrollment.status === newStatus) return;
    try {
      setUpdatingStatusId(enrollment.id);
      const updated = await studentsApi.updateEnrollment(enrollment.id, {
        status: newStatus,
      });
      setEnrollments((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
      if (refreshCourse) {
        await refreshCourse();
      }
    } catch (err) {
      setError(
        getApiErrorMessage(err, 'No se pudo actualizar el estado del alumno')
      );
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // Bulk Import Modal handlers
  const openBulkModal = () => {
    setBulkText('');
    setParsedRows([]);
    setBulkError(null);
    setBulkModalOpen(true);
  };

  const handleBulkTextChange = (text: string) => {
    setBulkText(text);
    setBulkError(null);
    setParsedRows(parseBulkStudentsText(text));
  };

  const updateParsedRowField = (
    index: number,
    field: 'lastName' | 'firstName' | 'dni',
    value: string
  ) => {
    setParsedRows((prev) =>
      prev.map((row, idx) => {
        if (idx !== index) return row;
        const updated = {
          ...row,
          [field]: field === 'dni' ? value || null : value,
        };
        updated.isValid = Boolean(
          updated.lastName.trim() && updated.firstName.trim()
        );
        return updated;
      })
    );
  };

  const removeParsedRow = (index: number) => {
    setParsedRows((prev) => prev.filter((_, idx) => idx !== index));
  };

  const validParsedRows = useMemo(
    () =>
      parsedRows.filter(
        (r) => r.lastName.trim().length > 0 && r.firstName.trim().length > 0
      ),
    [parsedRows]
  );

  const handleConfirmBulkImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return;
    setBulkError(null);

    if (validParsedRows.length === 0) {
      setBulkError(
        'No hay alumnos válidos para importar. Verificá que cada fila tenga Apellido y Nombre.'
      );
      return;
    }

    try {
      setBulkSubmitting(true);
      const payload: CreateStudentInput[] = validParsedRows.map((row) => ({
        lastName: row.lastName.trim(),
        firstName: row.firstName.trim(),
        dni: row.dni ? row.dni.trim() : null,
      }));

      const updatedEnrollments = await studentsApi.bulkEnrollStudents(
        courseId,
        payload
      );

      // Reload full list to ensure complete consistency
      if (updatedEnrollments && Array.isArray(updatedEnrollments)) {
        await loadStudents();
      }

      if (refreshCourse) {
        await refreshCourse();
      }
      setBulkModalOpen(false);
    } catch (err) {
      setBulkError(
        getApiErrorMessage(err, 'No se pudo realizar la importación masiva')
      );
    } finally {
      setBulkSubmitting(false);
    }
  };

  const getStatusBadgeClasses = (st: EnrollmentStatus) => {
    switch (st) {
      case 'ACTIVE':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'DROPPED':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'TRANSFERRED':
        return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Nómina de Alumnos
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Total: <strong className="text-slate-700">{counts.total}</strong>{' '}
              inscriptos ·{' '}
              <span className="text-emerald-700 font-medium">
                {counts.active} activos
              </span>
              {counts.dropped > 0 && (
                <span> · {counts.dropped} dados de baja</span>
              )}
              {counts.transferred > 0 && (
                <span> · {counts.transferred} con pase</span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={openBulkModal}
              className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3.5 py-2 text-xs sm:text-sm font-semibold text-indigo-700 hover:bg-indigo-100 transition cursor-pointer"
            >
              <ClipboardPaste className="w-4 h-4" />
              <span>Pegar lista</span>
            </button>

            <button
              type="button"
              onClick={openCreateStudentModal}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 transition cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Nuevo Alumno</span>
            </button>
          </div>
        </div>

        {/* Search & Status Filter */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar alumno por apellido, nombre o DNI..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-8 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            {(
              [
                { key: 'ALL', label: `Todos (${counts.total})` },
                { key: 'ACTIVE', label: `Activos (${counts.active})` },
                { key: 'DROPPED', label: `Baja (${counts.dropped})` },
                { key: 'TRANSFERRED', label: `Pase (${counts.transferred})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                  statusFilter === tab.key
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error Message */}
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

      {/* Students Table */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center justify-center text-slate-500">
          <Loader2 className="w-7 h-7 animate-spin text-indigo-600 mb-3" />
          <p className="text-sm font-medium">Cargando nómina de alumnos...</p>
        </div>
      ) : enrollments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">
            El curso aún no tiene alumnos inscriptos
          </h3>
          <p className="text-sm text-slate-600 mt-1.5 mb-6">
            Podés dar de alta un alumno individualmente o pegar tu lista
            completa directamente desde Excel o Word en segundos.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={openBulkModal}
              className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 transition cursor-pointer"
            >
              <ClipboardPaste className="w-4 h-4" />
              <span>Pegar lista desde Excel</span>
            </button>
            <button
              type="button"
              onClick={openCreateStudentModal}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 transition cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Alta individual</span>
            </button>
          </div>
        </div>
      ) : sortedAndFilteredEnrollments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
          No se encontraron alumnos con los filtros aplicados.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Apellido y Nombre</th>
                  <th className="py-3 px-4">DNI</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones Rápidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {sortedAndFilteredEnrollments.map((enrollment, index) => {
                  const isUpdating = updatingStatusId === enrollment.id;
                  const isInactive = enrollment.status !== 'ACTIVE';

                  return (
                    <tr
                      key={enrollment.id}
                      className={`hover:bg-slate-50/80 transition ${
                        isInactive ? 'bg-slate-50/40 text-slate-500' : ''
                      }`}
                    >
                      <td className="py-2.5 px-4 text-center text-xs font-medium text-slate-400">
                        {index + 1}
                      </td>

                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-slate-900">
                          {enrollment.student.lastName},{' '}
                          <span className="font-medium text-slate-700">
                            {enrollment.student.firstName}
                          </span>
                        </div>
                      </td>

                      <td className="py-2.5 px-4 text-slate-600 font-mono text-xs">
                        {enrollment.student.dni || (
                          <span className="text-slate-400 italic font-sans">
                            Sin DNI
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadgeClasses(
                            enrollment.status
                          )}`}
                        >
                          {enrollment.status === 'ACTIVE' ? (
                            <UserCheck className="w-3 h-3" />
                          ) : (
                            <UserMinus className="w-3 h-3" />
                          )}
                          {ENROLLMENT_STATUS_LABELS[enrollment.status]}
                        </span>
                      </td>

                      <td className="py-2.5 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                          {/* Quick Status Selector */}
                          <div className="relative inline-flex items-center">
                            {isUpdating && (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600 mr-1.5" />
                            )}
                            <select
                              value={enrollment.status}
                              disabled={isUpdating}
                              onChange={(e) =>
                                handleQuickStatusChange(
                                  enrollment,
                                  e.target.value as EnrollmentStatus
                                )
                              }
                              aria-label="Cambiar estado del alumno"
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-slate-300 focus:border-indigo-600 focus:outline-none disabled:opacity-50 cursor-pointer"
                            >
                              <option value="ACTIVE">Estado: Activo</option>
                              <option value="DROPPED">Estado: Baja</option>
                              <option value="TRANSFERRED">Estado: Pase</option>
                            </select>
                          </div>

                          {/* Edit Student Button */}
                          <button
                            type="button"
                            onClick={() => openEditStudentModal(enrollment)}
                            title="Editar datos del alumno"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Editar</span>
                          </button>
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

      {/* Individual Student Create / Edit Modal */}
      {studentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingEnrollment ? 'Editar Alumno' : 'Alta de Alumno'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => !submitting && setStudentModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="p-6 space-y-4">
              {formError && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 flex items-start gap-2 text-red-700 text-xs">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label
                  htmlFor="student-lastName"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Apellido *
                </label>
                <input
                  id="student-lastName"
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Ej: Pérez"
                  className="block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                />
              </div>

              <div>
                <label
                  htmlFor="student-firstName"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Nombre *
                </label>
                <input
                  id="student-firstName"
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Ej: Sofía"
                  className="block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                />
              </div>

              <div>
                <label
                  htmlFor="student-dni"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  DNI (Opcional)
                </label>
                <input
                  id="student-dni"
                  type="text"
                  value={dni}
                  onChange={(e) => setDni(e.target.value)}
                  placeholder="Ej: 45123456"
                  className="block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                />
              </div>

              {editingEnrollment && (
                <div>
                  <label
                    htmlFor="student-status"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Estado en el curso
                  </label>
                  <select
                    id="student-status"
                    value={status}
                    onChange={(e) =>
                      setStatus(e.target.value as EnrollmentStatus)
                    }
                    className="block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                  >
                    <option value="ACTIVE">Activo</option>
                    <option value="DROPPED">Baja</option>
                    <option value="TRANSFERRED">Pase</option>
                  </select>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setStudentModalOpen(false)}
                  disabled={submitting}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60 transition cursor-pointer"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>
                    {editingEnrollment ? 'Guardar Cambios' : 'Inscribir Alumno'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Import ("Pegar lista") Modal */}
      {bulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-3xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <ClipboardPaste className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Importación Masiva de Alumnos (&ldquo;Pegar lista&rdquo;)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Pegá filas desde Excel, Google Sheets o texto plano
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !bulkSubmitting && setBulkModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleConfirmBulkImport}
              className="p-6 space-y-5 overflow-y-auto flex-1"
            >
              {bulkError && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3.5 flex items-start gap-2.5 text-red-700 text-xs">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{bulkError}</span>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="bulk-textarea"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    1. Pegá la lista de alumnos (uno por línea)
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Formatos aceptados:{' '}
                    <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                      Apellido, Nombre, DNI
                    </code>{' '}
                    o{' '}
                    <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                      Apellido Nombre
                    </code>{' '}
                    o columnas de Excel
                  </span>
                </div>

                <textarea
                  id="bulk-textarea"
                  rows={5}
                  value={bulkText}
                  onChange={(e) => handleBulkTextChange(e.target.value)}
                  placeholder={`Ejemplo:\nGarcía, Valentina, 46123789\nMartínez, Mateo, 46987321\nLópez Sofía\nRodríguez\tLucas\t45888111`}
                  className="block w-full rounded-xl border border-slate-300 bg-white p-3.5 text-xs sm:text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                />
              </div>

              {/* Parsed Preview Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    2. Vista Previa Parseada ({validParsedRows.length} válidos
                    de {parsedRows.length} líneas)
                  </h4>
                  {parsedRows.length > 0 && (
                    <span className="text-xs text-slate-500">
                      Podés corregir cualquier celda directamente en la tabla
                    </span>
                  )}
                </div>

                {parsedRows.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
                    Pegá los datos en el cuadro superior para previsualizar la
                    tabla de alumnos antes de guardar.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold sticky top-0">
                        <tr>
                          <th className="py-2 px-3 w-10 text-center">#</th>
                          <th className="py-2 px-3">Apellido *</th>
                          <th className="py-2 px-3">Nombre *</th>
                          <th className="py-2 px-3">DNI (Opcional)</th>
                          <th className="py-2 px-3 w-16 text-center">Estado</th>
                          <th className="py-2 px-3 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedRows.map((row, idx) => (
                          <tr
                            key={row.id}
                            className={
                              row.isValid ? 'bg-white' : 'bg-amber-50/70'
                            }
                          >
                            <td className="py-1.5 px-3 text-center text-slate-400 font-medium">
                              {idx + 1}
                            </td>
                            <td className="py-1.5 px-2">
                              <input
                                type="text"
                                value={row.lastName}
                                onChange={(e) =>
                                  updateParsedRowField(
                                    idx,
                                    'lastName',
                                    e.target.value
                                  )
                                }
                                placeholder="Apellido obligatorio"
                                className={`w-full rounded-lg border px-2 py-1 text-xs ${
                                  row.lastName.trim()
                                    ? 'border-slate-200 bg-white'
                                    : 'border-amber-400 bg-white'
                                }`}
                              />
                            </td>
                            <td className="py-1.5 px-2">
                              <input
                                type="text"
                                value={row.firstName}
                                onChange={(e) =>
                                  updateParsedRowField(
                                    idx,
                                    'firstName',
                                    e.target.value
                                  )
                                }
                                placeholder="Nombre obligatorio"
                                className={`w-full rounded-lg border px-2 py-1 text-xs ${
                                  row.firstName.trim()
                                    ? 'border-slate-200 bg-white'
                                    : 'border-amber-400 bg-white'
                                }`}
                              />
                            </td>
                            <td className="py-1.5 px-2">
                              <input
                                type="text"
                                value={row.dni || ''}
                                onChange={(e) =>
                                  updateParsedRowField(
                                    idx,
                                    'dni',
                                    e.target.value
                                  )
                                }
                                placeholder="Sin DNI"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono"
                              />
                            </td>
                            <td className="py-1.5 px-3 text-center">
                              {row.isValid ? (
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700">
                                  <Check className="w-3 h-3" />
                                </span>
                              ) : (
                                <span
                                  title="Falta completar nombre o apellido"
                                  className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700"
                                >
                                  <AlertCircle className="w-3 h-3" />
                                </span>
                              )}
                            </td>
                            <td className="py-1.5 px-2 text-right">
                              <button
                                type="button"
                                onClick={() => removeParsedRow(idx)}
                                title="Quitar fila"
                                className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setBulkModalOpen(false)}
                  disabled={bulkSubmitting}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={bulkSubmitting || validParsedRows.length === 0}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition cursor-pointer"
                >
                  {bulkSubmitting && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  <span>
                    Confirmar e Importar ({validParsedRows.length}{' '}
                    {validParsedRows.length === 1 ? 'alumno' : 'alumnos'})
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentsTab;
