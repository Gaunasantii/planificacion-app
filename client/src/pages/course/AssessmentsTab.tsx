import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertCircle,
  BookOpen,
  Calendar,
  Check,
  ClipboardCheck,
  FileCheck2,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Scale,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { assessmentsApi } from '../../api/assessments.api';
import { getApiErrorMessage } from '../../api/client';
import {
  ASSESSMENT_TYPE_LABELS,
  Assessment,
  AssessmentType,
  ConceptualScaleItem,
  GradeInput,
  GradingConfig,
  SCALE_TYPE_LABELS,
} from '../../types';
import { useCourseContext } from './CourseLayout';

interface LocalStudentGradeRow {
  enrollmentId: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    dni: string | null;
  };
  numericInput: string;
  conceptualItemId: string | null;
  observations: string;
}

function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatShortDate(dateStr: string): string {
  if (!dateStr) return '';
  const clean = dateStr.slice(0, 10);
  const [y, m, d] = clean.split('-');
  if (!y || !m || !d) return clean;
  return `${d}/${m}/${y}`;
}

export const AssessmentsTab: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { course } = useCourseContext();

  const periods = useMemo(
    () =>
      [...(course.periods || [])].sort(
        (a, b) => a.order - b.order
      ),
    [course.periods]
  );

  // Selected Period filter ('ALL' or period.id)
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('ALL');

  // Assessments list
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loadingList, setLoadingList] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Active selected assessment & grades sheet
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<
    string | null
  >(null);
  const [activeAssessment, setActiveAssessment] = useState<Assessment | null>(
    null
  );
  const [sheetGradingConfig, setSheetGradingConfig] =
    useState<GradingConfig | null>(course.gradingConfig ?? null);
  const [gradeRows, setGradeRows] = useState<LocalStudentGradeRow[]>([]);
  const [loadingGrades, setLoadingGrades] = useState<boolean>(false);
  const [savingGrades, setSavingGrades] = useState<boolean>(false);

  // Create / Edit Assessment Modal state
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingAssessment, setEditingAssessment] = useState<Assessment | null>(
    null
  );
  const [formPeriodId, setFormPeriodId] = useState<string>('');
  const [formTitle, setFormTitle] = useState<string>('');
  const [formType, setFormType] = useState<AssessmentType>('EXAM');
  const [formDate, setFormDate] = useState<string>(getTodayIsoDate());
  const [formWeight, setFormWeight] = useState<string>('1');
  const [formError, setFormError] = useState<string | null>(null);
  const [submittingForm, setSubmittingForm] = useState<boolean>(false);

  // Delete confirmation loading state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadAssessments = useCallback(
    async (keepSelectedId?: string | null) => {
      if (!courseId) return;
      try {
        setLoadingList(true);
        setError(null);
        const periodFilter =
          selectedPeriodId !== 'ALL' ? selectedPeriodId : undefined;
        const list = await assessmentsApi.listCourseAssessments(
          courseId,
          periodFilter
        );
        setAssessments(list);

        if (keepSelectedId) {
          const stillExists = list.find((a) => a.id === keepSelectedId);
          if (stillExists) {
            setSelectedAssessmentId(stillExists.id);
            return;
          }
        }

        if (list.length > 0) {
          setSelectedAssessmentId((prev) => {
            if (prev && list.some((a) => a.id === prev)) return prev;
            return list[0].id;
          });
        } else {
          setSelectedAssessmentId(null);
          setActiveAssessment(null);
          setGradeRows([]);
        }
      } catch (err) {
        setError(
          getApiErrorMessage(err, 'No se pudieron cargar las evaluaciones')
        );
      } finally {
        setLoadingList(false);
      }
    },
    [courseId, selectedPeriodId]
  );

  useEffect(() => {
    loadAssessments();
  }, [loadAssessments]);

  const loadAssessmentGradesSheet = useCallback(async (assessmentId: string) => {
    try {
      setLoadingGrades(true);
      setError(null);
      setSuccessMessage(null);
      const data = await assessmentsApi.getAssessmentGrades(assessmentId);
      setActiveAssessment(data.assessment);
      if (data.gradingConfig) {
        setSheetGradingConfig(data.gradingConfig);
      }

      const studentsList = data.students || data.grades || [];
      setGradeRows(
        studentsList.map((row) => ({
          enrollmentId: row.enrollmentId,
          student: {
            id: row.student.id,
            firstName: row.student.firstName,
            lastName: row.student.lastName,
            dni: row.student.dni ?? null,
          },
          numericInput:
            row.numericValue !== null && row.numericValue !== undefined
              ? String(row.numericValue)
              : '',
          conceptualItemId: row.conceptualItemId ?? row.conceptualItem?.id ?? null,
          observations: row.observations || '',
        }))
      );
    } catch (err) {
      setError(
        getApiErrorMessage(
          err,
          'No se pudo cargar la planilla de calificaciones'
        )
      );
    } finally {
      setLoadingGrades(false);
    }
  }, []);

  useEffect(() => {
    if (selectedAssessmentId) {
      loadAssessmentGradesSheet(selectedAssessmentId);
    }
  }, [selectedAssessmentId, loadAssessmentGradesSheet]);

  const effectiveGradingConfig =
    sheetGradingConfig ?? course.gradingConfig ?? null;
  const scaleType = effectiveGradingConfig?.scaleType ?? 'NUMERIC_10';
  const maxNumericVal = scaleType === 'NUMERIC_100' ? 100 : 10;

  const conceptualItems: ConceptualScaleItem[] = useMemo(() => {
    const items =
      effectiveGradingConfig?.conceptualItems ||
      effectiveGradingConfig?.conceptualScaleItems ||
      [];
    return [...items].sort((a, b) => a.order - b.order);
  }, [effectiveGradingConfig]);

  // Modal handlers
  const openCreateModal = () => {
    setEditingAssessment(null);
    const defaultPeriod =
      selectedPeriodId !== 'ALL'
        ? selectedPeriodId
        : periods[0]?.id || '';
    setFormPeriodId(defaultPeriod);
    setFormTitle('');
    setFormType('EXAM');
    setFormDate(getTodayIsoDate());
    setFormWeight('1');
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (assessment: Assessment) => {
    setEditingAssessment(assessment);
    setFormPeriodId(assessment.periodId || assessment.period?.id || '');
    setFormTitle(assessment.title);
    setFormType(assessment.type);
    setFormDate(assessment.date.slice(0, 10));
    setFormWeight(String(assessment.weight ?? 1));
    setFormError(null);
    setModalOpen(true);
  };

  const handleSaveAssessmentForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return;
    setFormError(null);

    if (!formPeriodId) {
      setFormError('Seleccioná un período lectivo.');
      return;
    }
    if (!formTitle.trim()) {
      setFormError('El título de la evaluación es obligatorio.');
      return;
    }
    const parsedWeight = Number(formWeight);
    if (Number.isNaN(parsedWeight) || parsedWeight <= 0) {
      setFormError('La ponderación / peso debe ser un número mayor a 0.');
      return;
    }

    try {
      setSubmittingForm(true);
      if (editingAssessment) {
        const updated = await assessmentsApi.updateAssessment(
          editingAssessment.id,
          {
            periodId: formPeriodId,
            title: formTitle.trim(),
            type: formType,
            date: formDate,
            weight: parsedWeight,
          }
        );
        setModalOpen(false);
        await loadAssessments(updated.id);
        if (selectedAssessmentId === updated.id) {
          await loadAssessmentGradesSheet(updated.id);
        }
      } else {
        const created = await assessmentsApi.createAssessment(courseId, {
          periodId: formPeriodId,
          title: formTitle.trim(),
          type: formType,
          date: formDate,
          weight: parsedWeight,
        });
        setModalOpen(false);
        setSelectedAssessmentId(created.id);
        await loadAssessments(created.id);
      }
    } catch (err) {
      setFormError(
        getApiErrorMessage(err, 'No se pudo guardar la evaluación')
      );
    } finally {
      setSubmittingForm(false);
    }
  };

  const handleDeleteAssessment = async (assessment: Assessment) => {
    const confirmed = window.confirm(
      `¿Eliminar la evaluación "${assessment.title}" y todas sus notas cargadas?`
    );
    if (!confirmed) return;

    try {
      setDeletingId(assessment.id);
      setError(null);
      await assessmentsApi.deleteAssessment(assessment.id);
      const nextSelected =
        selectedAssessmentId === assessment.id ? null : selectedAssessmentId;
      await loadAssessments(nextSelected);
    } catch (err) {
      setError(
        getApiErrorMessage(err, 'No se pudo eliminar la evaluación')
      );
    } finally {
      setDeletingId(null);
    }
  };

  // Grade Row input handlers
  const handleNumericChange = (enrollmentId: string, val: string) => {
    setSuccessMessage(null);
    setGradeRows((prev) =>
      prev.map((row) =>
        row.enrollmentId === enrollmentId ? { ...row, numericInput: val } : row
      )
    );
  };

  const handleConceptualChange = (
    enrollmentId: string,
    conceptualItemId: string | null
  ) => {
    setSuccessMessage(null);
    setGradeRows((prev) =>
      prev.map((row) =>
        row.enrollmentId === enrollmentId
          ? { ...row, conceptualItemId }
          : row
      )
    );
  };

  const handleObservationsChange = (enrollmentId: string, val: string) => {
    setSuccessMessage(null);
    setGradeRows((prev) =>
      prev.map((row) =>
        row.enrollmentId === enrollmentId
          ? { ...row, observations: val }
          : row
      )
    );
  };

  const handleSaveGrades = async () => {
    if (!selectedAssessmentId) return;
    setError(null);
    setSuccessMessage(null);

    // Validate numeric ranges if NUMERIC_10 or NUMERIC_100
    if (scaleType === 'NUMERIC_10' || scaleType === 'NUMERIC_100') {
      for (const row of gradeRows) {
        const trimmed = row.numericInput.trim();
        if (trimmed !== '') {
          const num = Number(trimmed);
          if (Number.isNaN(num) || num < 0 || num > maxNumericVal) {
            setError(
              `La nota de ${row.student.lastName}, ${row.student.firstName} (${trimmed}) está fuera del rango permitido (0 a ${maxNumericVal}).`
            );
            return;
          }
        }
      }
    }

    const payload: GradeInput[] = gradeRows.map((row) => {
      if (scaleType === 'CONCEPTUAL') {
        const foundConcept = conceptualItems.find(
          (i) => i.id === row.conceptualItemId
        );
        return {
          enrollmentId: row.enrollmentId,
          conceptualItemId: row.conceptualItemId || null,
          numericValue: foundConcept ? foundConcept.numericValue : null,
          observations: row.observations.trim()
            ? row.observations.trim()
            : null,
        };
      }

      const trimmed = row.numericInput.trim();
      const parsedNum = trimmed !== '' ? Number(trimmed) : null;
      return {
        enrollmentId: row.enrollmentId,
        numericValue: parsedNum,
        conceptualItemId: null,
        observations: row.observations.trim() ? row.observations.trim() : null,
      };
    });

    try {
      setSavingGrades(true);
      const saved = await assessmentsApi.saveAssessmentGrades(
        selectedAssessmentId,
        { grades: payload }
      );

      const updatedStudents = saved.students || saved.grades || [];
      setGradeRows(
        updatedStudents.map((row) => ({
          enrollmentId: row.enrollmentId,
          student: {
            id: row.student.id,
            firstName: row.student.firstName,
            lastName: row.student.lastName,
            dni: row.student.dni ?? null,
          },
          numericInput:
            row.numericValue !== null && row.numericValue !== undefined
              ? String(row.numericValue)
              : '',
          conceptualItemId:
            row.conceptualItemId ?? row.conceptualItem?.id ?? null,
          observations: row.observations || '',
        }))
      );

      await loadAssessments(selectedAssessmentId);
      setSuccessMessage('Calificaciones guardadas correctamente.');
    } catch (err) {
      setError(
        getApiErrorMessage(err, 'No se pudieron guardar las calificaciones')
      );
    } finally {
      setSavingGrades(false);
    }
  };

  const getAssessmentTypeBadge = (type: AssessmentType) => {
    switch (type) {
      case 'EXAM':
        return {
          classes: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          icon: FileCheck2,
        };
      case 'ASSIGNMENT':
        return {
          classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: BookOpen,
        };
      case 'MAKEUP':
        return {
          classes: 'bg-amber-50 text-amber-700 border-amber-200',
          icon: RotateCcw,
        };
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Toolbar: Period Filter & New Assessment Button */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-indigo-600" />
            <span>Evaluaciones y Trabajos Prácticos</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Escala activa del curso:{' '}
            <strong className="text-indigo-700">
              {SCALE_TYPE_LABELS[scaleType]}
            </strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Period Filter Buttons / Selector */}
          <div className="flex items-center gap-1.5 overflow-x-auto bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setSelectedPeriodId('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                selectedPeriodId === 'ALL'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos ({periods.length})
            </button>
            {periods.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPeriodId(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                  selectedPeriodId === p.id
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nueva Evaluación / TP</span>
          </button>
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

      {/* Main Content: Assessments List + Grades Grid */}
      {loadingList ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center justify-center text-slate-500">
          <Loader2 className="w-7 h-7 animate-spin text-indigo-600 mb-3" />
          <p className="text-sm font-medium">Cargando evaluaciones...</p>
        </div>
      ) : assessments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">
            No hay evaluaciones registradas
          </h3>
          <p className="text-sm text-slate-600 mt-1.5 mb-6">
            Creá tu primer examen, trabajo práctico o recuperatorio para
            comenzar a cargar las calificaciones del curso.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nueva Evaluación / TP</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Assessments Selector Cards */}
          <div className="lg:col-span-4 space-y-3">
            {assessments.map((item) => {
              const isSelected = selectedAssessmentId === item.id;
              const badge = getAssessmentTypeBadge(item.type);
              const TypeIcon = badge.icon;
              const graded = item.gradedCount ?? item.gradesCount ?? 0;
              const total =
                item.totalActiveStudents ?? item.totalStudents ?? 0;

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedAssessmentId(item.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedAssessmentId(item.id);
                    }
                  }}
                  className={`rounded-2xl border p-4 transition cursor-pointer ${
                    isSelected
                      ? 'bg-white border-indigo-600 ring-2 ring-indigo-600/15 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold border ${badge.classes}`}
                    >
                      <TypeIcon className="w-3.5 h-3.5" />
                      {ASSESSMENT_TYPE_LABELS[item.type]}
                    </span>

                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        title="Editar evaluación"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === item.id}
                        onClick={() => handleDeleteAssessment(item)}
                        title="Eliminar evaluación"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer disabled:opacity-50"
                      >
                        {deletingId === item.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 mt-2">
                    {item.title}
                  </h3>

                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {formatShortDate(item.date)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Scale className="w-3.5 h-3.5 text-slate-400" />
                        Peso {item.weight}
                      </span>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-md font-semibold ${
                        total > 0 && graded === total
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {graded}/{total} calificados
                    </span>
                  </div>

                  {item.period?.name && (
                    <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] font-medium text-slate-500">
                      Período: <strong className="text-slate-700">{item.period.name}</strong>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right Column: Grades Grid for Selected Assessment */}
          <div className="lg:col-span-8">
            {loadingGrades ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center justify-center text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mb-2" />
                <p className="text-xs font-medium">
                  Cargando planilla de calificaciones...
                </p>
              </div>
            ) : !activeAssessment ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-500">
                Seleccioná una evaluación de la lista para cargar sus notas.
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                {/* Sheet Header */}
                <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">
                        {activeAssessment.title}
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {ASSESSMENT_TYPE_LABELS[activeAssessment.type]}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {activeAssessment.period?.name
                        ? `${activeAssessment.period.name} · `
                        : ''}
                      Fecha: {formatShortDate(activeAssessment.date)} · Peso:{' '}
                      {activeAssessment.weight}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={savingGrades || gradeRows.length === 0}
                    onClick={handleSaveGrades}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 disabled:opacity-60 transition cursor-pointer self-start sm:self-auto"
                  >
                    {savingGrades ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>Guardar Notas</span>
                  </button>
                </div>

                {/* Conceptual warning if scale is CONCEPTUAL but no items configured */}
                {scaleType === 'CONCEPTUAL' && conceptualItems.length === 0 && (
                  <div className="m-4 rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-800 flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>Escala conceptual sin niveles definidos:</strong>{' '}
                      Andá a la pestaña <strong>Configuración</strong> para
                      definir los niveles conceptuales del curso (ej: Mal,
                      Regular, Bien, Muy Bien).
                    </div>
                  </div>
                )}

                {gradeRows.length === 0 ? (
                  <div className="p-10 text-center max-w-md mx-auto">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-3">
                      <Users className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">
                      No hay alumnos activos en el curso
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Inscribí alumnos en la pestaña Alumnos para poder
                      calificarlos.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
                          <th className="py-3 px-4 w-10 text-center">#</th>
                          <th className="py-3 px-4">Alumno</th>
                          <th className="py-3 px-4">
                            {scaleType === 'CONCEPTUAL'
                              ? 'Calificación Conceptual'
                              : `Nota (0 a ${maxNumericVal})`}
                          </th>
                          <th className="py-3 px-4">Observaciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {gradeRows.map((row, idx) => (
                          <tr
                            key={row.enrollmentId}
                            className="hover:bg-slate-50/70 transition"
                          >
                            <td className="py-3 px-4 text-center text-xs font-medium text-slate-400">
                              {idx + 1}
                            </td>

                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-900">
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
                            </td>

                            <td className="py-3 px-4">
                              {scaleType === 'CONCEPTUAL' ? (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {conceptualItems.map((item) => {
                                    const isSelected =
                                      row.conceptualItemId === item.id;
                                    return (
                                      <button
                                        key={item.id || item.shortCode}
                                        type="button"
                                        onClick={() =>
                                          handleConceptualChange(
                                            row.enrollmentId,
                                            isSelected ? null : item.id || null
                                          )
                                        }
                                        className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                                          isSelected
                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                            : 'bg-white text-slate-700 border-slate-200 hover:bg-indigo-50 hover:border-indigo-200'
                                        }`}
                                      >
                                        {item.label}{' '}
                                        <span
                                          className={`text-[10px] ${
                                            isSelected
                                              ? 'text-indigo-200'
                                              : 'text-slate-400'
                                          }`}
                                        >
                                          ({item.shortCode})
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : (
                                <input
                                  type="number"
                                  min={0}
                                  max={maxNumericVal}
                                  step="0.01"
                                  value={row.numericInput}
                                  onChange={(e) =>
                                    handleNumericChange(
                                      row.enrollmentId,
                                      e.target.value
                                    )
                                  }
                                  placeholder={`0 - ${maxNumericVal}`}
                                  aria-label={`Nota de ${row.student.lastName} ${row.student.firstName}`}
                                  className="w-28 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                                />
                              )}
                            </td>

                            <td className="py-3 px-4">
                              <input
                                type="text"
                                value={row.observations}
                                onChange={(e) =>
                                  handleObservationsChange(
                                    row.enrollmentId,
                                    e.target.value
                                  )
                                }
                                placeholder="Observación opcional..."
                                aria-label={`Observaciones de ${row.student.lastName} ${row.student.firstName}`}
                                className="w-full min-w-[160px] rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-indigo-600 focus:outline-none"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {gradeRows.length > 0 && (
                  <div className="p-4 bg-slate-50/80 border-t border-slate-200 flex items-center justify-end">
                    <button
                      type="button"
                      disabled={savingGrades}
                      onClick={handleSaveGrades}
                      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 disabled:opacity-60 transition cursor-pointer"
                    >
                      {savingGrades ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      <span>Guardar Notas</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create / Edit Assessment Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <ClipboardCheck className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingAssessment
                    ? 'Editar Evaluación / TP'
                    : 'Nueva Evaluación / TP'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => !submittingForm && setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleSaveAssessmentForm}
              className="p-6 space-y-4"
            >
              {formError && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 flex items-start gap-2 text-red-700 text-xs">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label
                  htmlFor="assessment-period"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Período Lectivo *
                </label>
                <select
                  id="assessment-period"
                  required
                  value={formPeriodId}
                  onChange={(e) => setFormPeriodId(e.target.value)}
                  className="block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                >
                  <option value="" disabled>
                    Seleccionar período...
                  </option>
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="assessment-title"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Título de la Evaluación / TP *
                </label>
                <input
                  id="assessment-title"
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Ej: Evaluación Unidad 1 / TP N° 2"
                  className="block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                />
              </div>

              <div>
                <label
                  htmlFor="assessment-type"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Tipo de Instancia *
                </label>
                <select
                  id="assessment-type"
                  value={formType}
                  onChange={(e) =>
                    setFormType(e.target.value as AssessmentType)
                  }
                  className="block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                >
                  <option value="EXAM">Examen</option>
                  <option value="ASSIGNMENT">Trabajo Práctico</option>
                  <option value="MAKEUP">
                    Recuperatorio (reemplaza la nota más baja de examen si es
                    mayor)
                  </option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="assessment-date"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Fecha *
                  </label>
                  <input
                    id="assessment-date"
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="assessment-weight"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Peso / Ponderación *
                  </label>
                  <input
                    id="assessment-weight"
                    type="number"
                    min="0.1"
                    step="0.1"
                    required
                    value={formWeight}
                    onChange={(e) => setFormWeight(e.target.value)}
                    className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={submittingForm}
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingForm}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 disabled:opacity-60 cursor-pointer"
                >
                  {submittingForm && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  <span>
                    {editingAssessment ? 'Guardar Cambios' : 'Crear Evaluación'}
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

export default AssessmentsTab;
