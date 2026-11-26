import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  Award,
  Check,
  CheckCircle2,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { assessmentsApi } from '../../api/assessments.api';
import { coursesApi } from '../../api/courses.api';
import { getApiErrorMessage } from '../../api/client';
import {
  ConceptualScaleItem,
  PeriodGradeInput,
  PeriodGradesPreviewResponse,
  SCALE_TYPE_LABELS,
  StudentPeriodGradeCalculation,
} from '../../types';
import { useCourseContext } from './CourseLayout';

interface LocalPeriodGradeResolution {
  enrollmentId: string;
  finalNumericInput: string;
  finalConceptualItemId: string | null;
  isOverridden: boolean;
}

export const PeriodGradesTab: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { course, refreshCourse } = useCourseContext();

  const periods = useMemo(
    () => [...(course.periods || [])].sort((a, b) => a.order - b.order),
    [course.periods]
  );

  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(
    periods[0]?.id || ''
  );

  // Sync selectedPeriodId if periods change and current selection is empty
  useEffect(() => {
    if (!selectedPeriodId && periods.length > 0) {
      setSelectedPeriodId(periods[0].id);
    }
  }, [periods, selectedPeriodId]);

  const [previewData, setPreviewData] =
    useState<PeriodGradesPreviewResponse | null>(null);
  const [resolutions, setResolutions] = useState<
    Record<string, LocalPeriodGradeResolution>
  >({});

  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Add Extra / Recovery Period Modal State
  const [periodModalOpen, setPeriodModalOpen] = useState<boolean>(false);
  const [newPeriodName, setNewPeriodName] = useState<string>(
    'Período de Recuperación / Intensificación'
  );
  const [newPeriodStart, setNewPeriodStart] = useState<string>(
    `${course.academicYear}-12-01`
  );
  const [newPeriodEnd, setNewPeriodEnd] = useState<string>(
    `${course.academicYear}-12-20`
  );
  const [newPeriodIsRecovery, setNewPeriodIsRecovery] = useState<boolean>(true);
  const [periodFormError, setPeriodFormError] = useState<string | null>(null);
  const [creatingPeriod, setCreatingPeriod] = useState<boolean>(false);

  const initializeResolutionsFromPreview = useCallback(
    (data: PeriodGradesPreviewResponse) => {
      const map: Record<string, LocalPeriodGradeResolution> = {};
      const isConceptual = data.gradingConfig.scaleType === 'CONCEPTUAL';

      for (const s of data.students) {
        if (s.savedPeriodGrade) {
          map[s.enrollmentId] = {
            enrollmentId: s.enrollmentId,
            finalNumericInput:
              s.savedPeriodGrade.finalNumeric !== null &&
              s.savedPeriodGrade.finalNumeric !== undefined
                ? String(s.savedPeriodGrade.finalNumeric)
                : s.calculatedNumeric !== null
                ? String(s.calculatedNumeric)
                : '',
            finalConceptualItemId:
              s.savedPeriodGrade.finalConceptualItem?.id ??
              s.conceptualResolution?.suggestedConceptualItem?.id ??
              null,
            isOverridden: Boolean(s.savedPeriodGrade.isOverridden),
          };
        } else {
          map[s.enrollmentId] = {
            enrollmentId: s.enrollmentId,
            finalNumericInput:
              s.calculatedNumeric !== null && s.calculatedNumeric !== undefined
                ? String(s.calculatedNumeric)
                : '',
            finalConceptualItemId: isConceptual
              ? s.conceptualResolution?.suggestedConceptualItem?.id ?? null
              : null,
            isOverridden: false,
          };
        }
      }

      setResolutions(map);
    },
    []
  );

  const loadPreview = useCallback(
    async (periodId: string) => {
      if (!periodId) return;
      try {
        setLoading(true);
        setError(null);
        setSuccessMessage(null);
        const data = await assessmentsApi.previewPeriodGrades(periodId);
        setPreviewData(data);
        initializeResolutionsFromPreview(data);
      } catch (err) {
        setError(
          getApiErrorMessage(
            err,
            'No se pudo calcular la vista previa de cierre del período'
          )
        );
      } finally {
        setLoading(false);
      }
    },
    [initializeResolutionsFromPreview]
  );

  useEffect(() => {
    if (selectedPeriodId) {
      loadPreview(selectedPeriodId);
    }
  }, [selectedPeriodId, loadPreview]);

  const handleNumericResolutionChange = (
    studentRow: StudentPeriodGradeCalculation,
    newVal: string
  ) => {
    setSuccessMessage(null);
    const trimmed = newVal.trim();
    const calcStr =
      studentRow.calculatedNumeric !== null &&
      studentRow.calculatedNumeric !== undefined
        ? String(studentRow.calculatedNumeric)
        : '';

    const isDifferent =
      trimmed !== '' &&
      (calcStr === '' ||
        Math.abs(Number(trimmed) - Number(calcStr)) > 0.001);

    setResolutions((prev) => ({
      ...prev,
      [studentRow.enrollmentId]: {
        ...(prev[studentRow.enrollmentId] || {
          enrollmentId: studentRow.enrollmentId,
          finalConceptualItemId: null,
        }),
        finalNumericInput: newVal,
        isOverridden: isDifferent,
      },
    }));
  };

  const handleResetNumericToCalculated = (
    studentRow: StudentPeriodGradeCalculation
  ) => {
    setSuccessMessage(null);
    setResolutions((prev) => ({
      ...prev,
      [studentRow.enrollmentId]: {
        ...(prev[studentRow.enrollmentId] || {
          enrollmentId: studentRow.enrollmentId,
          finalConceptualItemId: null,
        }),
        finalNumericInput:
          studentRow.calculatedNumeric !== null
            ? String(studentRow.calculatedNumeric)
            : '',
        isOverridden: false,
      },
    }));
  };

  const handleConceptualResolutionSelect = (
    studentRow: StudentPeriodGradeCalculation,
    item: ConceptualScaleItem
  ) => {
    if (!item.id) return;
    setSuccessMessage(null);

    const suggestedId =
      studentRow.conceptualResolution?.suggestedConceptualItem?.id ?? null;
    const isExact = studentRow.conceptualResolution?.exactMatch ?? false;

    const isOverridden =
      !isExact || (suggestedId !== null && item.id !== suggestedId);

    setResolutions((prev) => ({
      ...prev,
      [studentRow.enrollmentId]: {
        enrollmentId: studentRow.enrollmentId,
        finalConceptualItemId: item.id!,
        finalNumericInput: String(item.numericValue),
        isOverridden,
      },
    }));
  };

  const handleSavePeriodGrades = async () => {
    if (!selectedPeriodId || !previewData) return;
    setError(null);
    setSuccessMessage(null);

    const scaleType = previewData.gradingConfig.scaleType;
    const maxNumeric = scaleType === 'NUMERIC_100' ? 100 : 10;

    if (scaleType === 'NUMERIC_10' || scaleType === 'NUMERIC_100') {
      for (const s of previewData.students) {
        const res = resolutions[s.enrollmentId];
        const trimmed = res?.finalNumericInput?.trim() ?? '';
        if (trimmed !== '') {
          const parsed = Number(trimmed);
          if (Number.isNaN(parsed) || parsed < 0 || parsed > maxNumeric) {
            setError(
              `La nota final de ${s.student.lastName}, ${s.student.firstName} (${trimmed}) debe estar entre 0 y ${maxNumeric}.`
            );
            return;
          }
        }
      }
    }

    const payload: PeriodGradeInput[] = previewData.students.map((s) => {
      const res = resolutions[s.enrollmentId];

      if (scaleType === 'CONCEPTUAL') {
        const conceptId =
          res?.finalConceptualItemId ??
          s.conceptualResolution?.suggestedConceptualItem?.id ??
          null;
        const foundConcept = previewData.gradingConfig.conceptualItems.find(
          (c) => c.id === conceptId
        );
        return {
          enrollmentId: s.enrollmentId,
          calculatedNumeric: s.calculatedNumeric,
          finalConceptualItemId: conceptId,
          finalNumeric: foundConcept
            ? foundConcept.numericValue
            : s.calculatedNumeric,
          isOverridden: Boolean(res?.isOverridden),
        };
      }

      const trimmed = res?.finalNumericInput?.trim() ?? '';
      const finalNumeric =
        trimmed !== '' ? Number(trimmed) : s.calculatedNumeric;

      return {
        enrollmentId: s.enrollmentId,
        calculatedNumeric: s.calculatedNumeric,
        finalNumeric,
        finalConceptualItemId: null,
        isOverridden: Boolean(res?.isOverridden),
      };
    });

    try {
      setSaving(true);
      const updated = await assessmentsApi.savePeriodGrades(selectedPeriodId, {
        grades: payload,
      });
      setPreviewData(updated);
      initializeResolutionsFromPreview(updated);
      setSuccessMessage(
        `Notas finales de "${updated.period.name}" confirmadas y guardadas correctamente.`
      );
    } catch (err) {
      setError(
        getApiErrorMessage(
          err,
          'No se pudieron guardar las calificaciones del período'
        )
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCreateExtraPeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return;
    setPeriodFormError(null);

    if (!newPeriodName.trim()) {
      setPeriodFormError('El nombre del período es obligatorio.');
      return;
    }
    if (!newPeriodStart || !newPeriodEnd) {
      setPeriodFormError('Indicá las fechas de inicio y fin del período.');
      return;
    }

    try {
      setCreatingPeriod(true);
      const created = await coursesApi.createPeriod(courseId, {
        name: newPeriodName.trim(),
        startDate: newPeriodStart,
        endDate: newPeriodEnd,
        isRecovery: newPeriodIsRecovery,
      });
      await refreshCourse();
      setPeriodModalOpen(false);
      setSelectedPeriodId(created.id);
    } catch (err) {
      setPeriodFormError(
        getApiErrorMessage(err, 'No se pudo crear el período adicional')
      );
    } finally {
      setCreatingPeriod(false);
    }
  };

  const gc = previewData?.gradingConfig ?? course.gradingConfig;
  const scaleType = gc?.scaleType ?? 'NUMERIC_10';
  const maxNumericVal = scaleType === 'NUMERIC_100' ? 100 : 10;
  const conceptualItems = useMemo(() => {
    const items =
      previewData?.gradingConfig?.conceptualItems ||
      course.gradingConfig?.conceptualItems ||
      course.gradingConfig?.conceptualScaleItems ||
      [];
    return [...items].sort((a, b) => a.order - b.order);
  }, [previewData, course.gradingConfig]);

  return (
    <div className="space-y-5">
      {/* Period Selector & Extra Recovery Period Button */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-600" />
              <span>Cierre de Período y Promedios Ponderados</span>
            </h2>
            {gc && (
              <p className="text-xs text-slate-500 mt-0.5">
                Escala:{' '}
                <strong className="text-slate-700">
                  {SCALE_TYPE_LABELS[gc.scaleType]}
                </strong>{' '}
                · Ponderación:{' '}
                <strong className="text-indigo-700">
                  Exámenes {gc.examWeight}%
                </strong>{' '}
                +{' '}
                <strong className="text-emerald-700">
                  TPs {gc.assignmentWeight}%
                </strong>{' '}
                +{' '}
                <strong className="text-amber-700">
                  Asistencia {gc.attendanceWeight}%
                </strong>
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setPeriodFormError(null);
                setPeriodModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3.5 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Instancia de Recuperación / Período</span>
            </button>

            <button
              type="button"
              disabled={
                saving ||
                loading ||
                !previewData ||
                previewData.students.length === 0
              }
              onClick={handleSavePeriodGrades}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 disabled:opacity-60 transition cursor-pointer"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>Confirmar y Guardar Notas del Período</span>
            </button>
          </div>
        </div>

        {/* Period Tabs */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
          {periods.map((p) => {
            const isActive = selectedPeriodId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPeriodId(p.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>{p.name}</span>
                {p.isRecovery && (
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                      isActive
                        ? 'bg-indigo-500 text-white'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    Recuperación
                  </span>
                )}
              </button>
            );
          })}
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

      {/* Calculation Table */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center justify-center text-slate-500">
          <Loader2 className="w-7 h-7 animate-spin text-indigo-600 mb-3" />
          <p className="text-sm font-medium">
            Calculando promedios ponderados del período...
          </p>
        </div>
      ) : !previewData || previewData.students.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-3">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            No hay alumnos activos para cerrar el período
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Verificá que el curso tenga alumnos activos en la pestaña Alumnos.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4 w-10 text-center">#</th>
                  <th className="py-3 px-4">Alumno</th>
                  <th className="py-3 px-3 text-center">
                    Prom. Exámenes ({previewData.gradingConfig.examWeight}%)
                  </th>
                  <th className="py-3 px-3 text-center">
                    Prom. TPs ({previewData.gradingConfig.assignmentWeight}%)
                  </th>
                  <th className="py-3 px-3 text-center">
                    % Asistencia ({previewData.gradingConfig.attendanceWeight}%)
                  </th>
                  <th className="py-3 px-3 text-center">Cálculo Sugerido</th>
                  <th className="py-3 px-4 min-w-[260px]">
                    Resolución Final del Docente
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {previewData.students.map((s, idx) => {
                  const res = resolutions[s.enrollmentId] || {
                    enrollmentId: s.enrollmentId,
                    finalNumericInput:
                      s.calculatedNumeric !== null
                        ? String(s.calculatedNumeric)
                        : '',
                    finalConceptualItemId:
                      s.conceptualResolution?.suggestedConceptualItem?.id ??
                      null,
                    isOverridden: false,
                  };

                  const missingLabels: string[] = [];
                  if (s.missingComponents.exams) {
                    missingLabels.push('Sin exámenes');
                  }
                  if (s.missingComponents.assignments) {
                    missingLabels.push('Sin TPs');
                  }

                  const conceptualRes = s.conceptualResolution;
                  const needsTieBreak =
                    scaleType === 'CONCEPTUAL' &&
                    conceptualRes &&
                    !conceptualRes.exactMatch &&
                    conceptualRes.lowerOption &&
                    conceptualRes.upperOption &&
                    conceptualRes.lowerOption.id !==
                      conceptualRes.upperOption.id;

                  return (
                    <tr
                      key={s.enrollmentId}
                      className="hover:bg-slate-50/70 transition"
                    >
                      <td className="py-3.5 px-4 text-center text-xs font-medium text-slate-400">
                        {idx + 1}
                      </td>

                      {/* Student Info + Saved badge */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">
                            {s.student.lastName},{' '}
                            <span className="font-medium text-slate-700">
                              {s.student.firstName}
                            </span>
                          </span>
                          {s.savedPeriodGrade && (
                            <span
                              title="Nota del período ya guardada en boletín"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Guardada
                            </span>
                          )}
                        </div>
                        {s.student.dni && (
                          <div className="text-[11px] text-slate-400 font-mono">
                            DNI {s.student.dni}
                          </div>
                        )}
                      </td>

                      {/* Exam Average */}
                      <td className="py-3.5 px-3 text-center">
                        {s.examAvg !== null ? (
                          <div>
                            <span className="font-bold text-slate-800">
                              {s.examAvg.toFixed(2)}
                            </span>
                            <span className="block text-[10px] text-slate-400">
                              ({s.examCount}{' '}
                              {s.examCount === 1 ? 'nota' : 'notas'})
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">
                            —
                          </span>
                        )}
                      </td>

                      {/* Assignment Average */}
                      <td className="py-3.5 px-3 text-center">
                        {s.assignmentAvg !== null ? (
                          <div>
                            <span className="font-bold text-slate-800">
                              {s.assignmentAvg.toFixed(2)}
                            </span>
                            <span className="block text-[10px] text-slate-400">
                              ({s.assignmentCount}{' '}
                              {s.assignmentCount === 1 ? 'nota' : 'notas'})
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">
                            —
                          </span>
                        )}
                      </td>

                      {/* Attendance % */}
                      <td className="py-3.5 px-3 text-center">
                        <span className="font-semibold text-slate-800">
                          {s.attendancePercentage.toFixed(1)}%
                        </span>
                        {previewData.gradingConfig.attendanceWeight > 0 && (
                          <span className="block text-[10px] text-slate-400">
                            Equiv: {s.attendanceScore.toFixed(2)}
                          </span>
                        )}
                      </td>

                      {/* Calculated Numeric + Missing Warning */}
                      <td className="py-3.5 px-3 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-800">
                            {s.calculatedNumeric !== null
                              ? s.calculatedNumeric.toFixed(2)
                              : 'Sin datos'}
                          </span>

                          {s.missingComponents.hasMissing &&
                            missingLabels.length > 0 && (
                              <span
                                title={`Faltan calificaciones en categorías con peso asignado (${missingLabels.join(
                                  ', '
                                )}). El promedio se normalizó sobre los componentes cargados.`}
                                className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md"
                              >
                                <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                                {missingLabels.join(', ')}
                              </span>
                            )}
                        </div>
                      </td>

                      {/* Final Resolution Control */}
                      <td className="py-3.5 px-4">
                        {scaleType === 'CONCEPTUAL' ? (
                          <div className="space-y-2">
                            {/* Dual Recommendation Buttons when decimal falls between 2 concepts */}
                            {needsTieBreak &&
                              conceptualRes?.lowerOption &&
                              conceptualRes?.upperOption && (
                                <div className="p-2 rounded-xl bg-indigo-50/70 border border-indigo-200/80 space-y-1.5">
                                  <div className="flex items-center gap-1 text-[11px] font-semibold text-indigo-800">
                                    <Sparkles className="w-3 h-3 text-indigo-600 shrink-0" />
                                    <span>
                                      Promedio intermedio (
                                      {s.calculatedNumeric?.toFixed(2)}): elegí
                                      recomendación
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {[
                                      conceptualRes.lowerOption,
                                      conceptualRes.upperOption,
                                    ].map((opt) => {
                                      const isSelected =
                                        res.finalConceptualItemId === opt.id;
                                      const isNearest =
                                        conceptualRes.suggestedConceptualItem
                                          ?.id === opt.id;
                                      return (
                                        <button
                                          key={opt.id}
                                          type="button"
                                          onClick={() =>
                                            handleConceptualResolutionSelect(
                                              s,
                                              opt
                                            )
                                          }
                                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                                            isSelected
                                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                              : 'bg-white text-indigo-700 border-indigo-300 hover:bg-indigo-100'
                                          }`}
                                        >
                                          <span>
                                            {opt.label} ({opt.shortCode})
                                          </span>
                                          {isNearest && (
                                            <span
                                              className={`text-[10px] font-normal ${
                                                isSelected
                                                  ? 'text-indigo-200'
                                                  : 'text-indigo-500'
                                              }`}
                                            >
                                              · sugerido
                                            </span>
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                            {/* Full conceptual scale selector */}
                            <div className="flex flex-wrap items-center gap-1">
                              {conceptualItems.map((item) => {
                                const isSelected =
                                  res.finalConceptualItemId === item.id;
                                return (
                                  <button
                                    key={item.id || item.shortCode}
                                    type="button"
                                    onClick={() =>
                                      handleConceptualResolutionSelect(s, item)
                                    }
                                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                                      isSelected
                                        ? 'bg-slate-900 text-white border-slate-900'
                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                    }`}
                                  >
                                    {item.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          /* Numeric Resolution Input */
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              max={maxNumericVal}
                              step="0.01"
                              value={res.finalNumericInput}
                              onChange={(e) =>
                                handleNumericResolutionChange(
                                  s,
                                  e.target.value
                                )
                              }
                              aria-label={`Nota final de ${s.student.lastName} ${s.student.firstName}`}
                              className={`w-24 rounded-xl border px-3 py-1.5 text-sm font-bold focus:outline-none focus:ring-2 ${
                                res.isOverridden
                                  ? 'border-amber-400 bg-amber-50/40 text-amber-900 focus:border-amber-600 focus:ring-amber-500/20'
                                  : 'border-slate-300 bg-white text-slate-900 focus:border-indigo-600 focus:ring-indigo-600/20'
                              }`}
                            />

                            {res.isOverridden ? (
                              <div className="flex items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800">
                                  Manual
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleResetNumericToCalculated(s)
                                  }
                                  title="Restaurar nota calculada sugerida"
                                  className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition cursor-pointer"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-emerald-700 font-medium">
                                Automática
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer Save Bar */}
          <div className="p-4 bg-slate-50/80 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-xs text-slate-500">
              Al confirmar, las calificaciones finales quedarán asentadas en el
              cierre de <strong>{previewData.period.name}</strong>.
            </p>
            <button
              type="button"
              disabled={saving}
              onClick={handleSavePeriodGrades}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 disabled:opacity-60 transition cursor-pointer self-end sm:self-auto"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>Confirmar y Guardar Notas del Período</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal to Add Extra Recovery / Intensification Period */}
      {periodModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Agregar Período / Instancia Extra
                </h3>
              </div>
              <button
                type="button"
                onClick={() => !creatingPeriod && setPeriodModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateExtraPeriod} className="p-6 space-y-4">
              {periodFormError && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 flex items-start gap-2 text-red-700 text-xs">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{periodFormError}</span>
                </div>
              )}

              <div>
                <label
                  htmlFor="extra-period-name"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Nombre de la instancia / período *
                </label>
                <input
                  id="extra-period-name"
                  type="text"
                  required
                  value={newPeriodName}
                  onChange={(e) => setNewPeriodName(e.target.value)}
                  placeholder="Ej: Diciembre - Intensificación / Coloquio"
                  className="block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="extra-period-start"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Fecha inicio *
                  </label>
                  <input
                    id="extra-period-start"
                    type="date"
                    required
                    value={newPeriodStart}
                    onChange={(e) => setNewPeriodStart(e.target.value)}
                    className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="extra-period-end"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Fecha fin *
                  </label>
                  <input
                    id="extra-period-end"
                    type="date"
                    required
                    value={newPeriodEnd}
                    onChange={(e) => setNewPeriodEnd(e.target.value)}
                    className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={newPeriodIsRecovery}
                  onChange={(e) => setNewPeriodIsRecovery(e.target.checked)}
                  className="w-4 h-4 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs font-semibold text-slate-700">
                  Es instancia de recuperación / intensificación
                </span>
              </label>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={creatingPeriod}
                  onClick={() => setPeriodModalOpen(false)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingPeriod}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 disabled:opacity-60 cursor-pointer"
                >
                  {creatingPeriod && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  <span>Crear Período</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PeriodGradesTab;
