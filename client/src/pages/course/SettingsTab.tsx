import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  Loader2,
  Percent,
  Plus,
  Save,
  Scale,
  Settings,
  Trash2,
  X,
} from 'lucide-react';
import { coursesApi } from '../../api/courses.api';
import { getApiErrorMessage } from '../../api/client';
import { ScaleType } from '../../types';
import { useCourseContext } from './CourseLayout';

interface EditableConceptualItem {
  tempId: string;
  label: string;
  shortCode: string;
  numericValue: number;
  order: number;
}

const DEFAULT_CONCEPTUAL_ITEMS: EditableConceptualItem[] = [
  { tempId: 'def-0', label: 'Mal', shortCode: 'M', numericValue: 0, order: 1 },
  {
    tempId: 'def-1',
    label: 'Regular',
    shortCode: 'R',
    numericValue: 1,
    order: 2,
  },
  { tempId: 'def-2', label: 'Bien', shortCode: 'B', numericValue: 2, order: 3 },
  {
    tempId: 'def-3',
    label: 'Muy Bien',
    shortCode: 'MB',
    numericValue: 3,
    order: 4,
  },
];

export const SettingsTab: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { course, refreshCourse } = useCourseContext();

  const gc = course.gradingConfig;

  const [scaleType, setScaleType] = useState<ScaleType>(
    gc?.scaleType ?? 'NUMERIC_10'
  );
  const [examWeight, setExamWeight] = useState<number>(gc?.examWeight ?? 70);
  const [assignmentWeight, setAssignmentWeight] = useState<number>(
    gc?.assignmentWeight ?? 30
  );
  const [attendanceWeight, setAttendanceWeight] = useState<number>(
    gc?.attendanceWeight ?? 0
  );
  const [justifiedCountsAsPresent, setJustifiedCountsAsPresent] =
    useState<boolean>(gc?.justifiedCountsAsPresent ?? true);

  const [conceptualItems, setConceptualItems] = useState<
    EditableConceptualItem[]
  >(() => {
    const existing = gc?.conceptualItems || gc?.conceptualScaleItems || [];
    if (existing.length > 0) {
      return [...existing]
        .sort((a, b) => a.order - b.order)
        .map((item, idx) => ({
          tempId: item.id || `item-${idx}`,
          label: item.label,
          shortCode: item.shortCode,
          numericValue: item.numericValue,
          order: item.order ?? idx + 1,
        }));
    }
    return DEFAULT_CONCEPTUAL_ITEMS;
  });

  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sync if course gradingConfig changes externally
  useEffect(() => {
    if (!gc) return;
    setScaleType(gc.scaleType);
    setExamWeight(gc.examWeight);
    setAssignmentWeight(gc.assignmentWeight);
    setAttendanceWeight(gc.attendanceWeight);
    setJustifiedCountsAsPresent(gc.justifiedCountsAsPresent);

    const existing = gc.conceptualItems || gc.conceptualScaleItems || [];
    if (existing.length > 0) {
      setConceptualItems(
        [...existing]
          .sort((a, b) => a.order - b.order)
          .map((item, idx) => ({
            tempId: item.id || `item-${idx}`,
            label: item.label,
            shortCode: item.shortCode,
            numericValue: item.numericValue,
            order: item.order ?? idx + 1,
          }))
      );
    }
  }, [gc]);

  // If teacher switches to CONCEPTUAL and list is empty, preload defaults
  const handleSelectScaleType = (newType: ScaleType) => {
    setScaleType(newType);
    setSuccessMessage(null);
    if (newType === 'CONCEPTUAL' && conceptualItems.length === 0) {
      setConceptualItems(DEFAULT_CONCEPTUAL_ITEMS);
    }
  };

  // Conceptual items CRUD
  const handleAddConceptualItem = () => {
    setSuccessMessage(null);
    const nextOrder = conceptualItems.length + 1;
    const maxVal =
      conceptualItems.length > 0
        ? Math.max(...conceptualItems.map((i) => i.numericValue))
        : -1;
    setConceptualItems((prev) => [
      ...prev,
      {
        tempId: `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label: '',
        shortCode: '',
        numericValue: maxVal + 1,
        order: nextOrder,
      },
    ]);
  };

  const handleUpdateConceptualItem = (
    index: number,
    field: 'label' | 'shortCode' | 'numericValue',
    value: string
  ) => {
    setSuccessMessage(null);
    setConceptualItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        if (field === 'numericValue') {
          return {
            ...item,
            numericValue: value === '' ? 0 : Number(value),
          };
        }
        return {
          ...item,
          [field]: value,
        };
      })
    );
  };

  const handleRemoveConceptualItem = (index: number) => {
    setSuccessMessage(null);
    setConceptualItems((prev) =>
      prev
        .filter((_, idx) => idx !== index)
        .map((item, idx) => ({ ...item, order: idx + 1 }))
    );
  };

  const handleMoveConceptualItem = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= conceptualItems.length) return;
    setSuccessMessage(null);
    setConceptualItems((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy.map((item, idx) => ({ ...item, order: idx + 1 }));
    });
  };

  const handleResetConceptualDefaults = () => {
    setSuccessMessage(null);
    setConceptualItems(DEFAULT_CONCEPTUAL_ITEMS);
  };

  const totalWeight = useMemo(() => {
    const e = Number.isFinite(examWeight) ? examWeight : 0;
    const a = Number.isFinite(assignmentWeight) ? assignmentWeight : 0;
    const att = Number.isFinite(attendanceWeight) ? attendanceWeight : 0;
    return Number((e + a + att).toFixed(2));
  }, [examWeight, assignmentWeight, attendanceWeight]);

  const isWeightSumValid = Math.abs(totalWeight - 100) < 0.001;

  const isConceptualValid = useMemo(() => {
    if (scaleType !== 'CONCEPTUAL') return true;
    if (conceptualItems.length === 0) return false;
    return conceptualItems.every(
      (item) =>
        item.label.trim().length > 0 &&
        item.shortCode.trim().length > 0 &&
        Number.isFinite(item.numericValue)
    );
  }, [scaleType, conceptualItems]);

  const canSave = isWeightSumValid && isConceptualValid && !saving;

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return;
    setError(null);
    setSuccessMessage(null);

    if (!isWeightSumValid) {
      setError(
        `La suma de las ponderaciones debe ser exactamente 100% (actualmente suma ${totalWeight}%).`
      );
      return;
    }

    if (scaleType === 'CONCEPTUAL' && !isConceptualValid) {
      setError(
        'Completá la etiqueta, código corto y valor numérico de todos los niveles conceptuales.'
      );
      return;
    }

    try {
      setSaving(true);
      const formattedItems =
        scaleType === 'CONCEPTUAL'
          ? conceptualItems.map((item, idx) => ({
              label: item.label.trim(),
              shortCode: item.shortCode.trim(),
              numericValue: Number(item.numericValue),
              order: idx + 1,
            }))
          : undefined;

      await coursesApi.updateGradingConfig(courseId, {
        scaleType,
        examWeight: Number(examWeight),
        assignmentWeight: Number(assignmentWeight),
        attendanceWeight: Number(attendanceWeight),
        justifiedCountsAsPresent,
        conceptualItems: formattedItems,
        conceptualScaleItems: formattedItems,
      });

      await refreshCourse();
      setSuccessMessage(
        'Configuración de calificaciones guardada correctamente.'
      );
    } catch (err) {
      setError(
        getApiErrorMessage(
          err,
          'No se pudo guardar la configuración de calificaciones'
        )
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSaveConfig} className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-600" />
            <span>Configuración de Calificaciones y Ponderación</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Definí la escala de evaluación del curso, las equivalencias
            conceptuales y el peso de cada componente en la nota final.
          </p>
        </div>

        <button
          type="submit"
          disabled={!canSave}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer self-start sm:self-auto"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span>Guardar Configuración</span>
        </button>
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

      {/* Section 1: Grading Scale Selector & Conceptual Editor */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs space-y-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Scale className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              1. Escala de Calificaciones
            </h3>
            <p className="text-xs text-slate-500">
              Elegí cómo se cargan y expresan las calificaciones en este curso.
            </p>
          </div>
        </div>

        {/* Scale Type Radio Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {(
            [
              {
                value: 'NUMERIC_10' as ScaleType,
                title: 'Numérica (0 a 10)',
                desc: 'Escala tradicional de 0 a 10 puntos con decimales.',
              },
              {
                value: 'NUMERIC_100' as ScaleType,
                title: 'Numérica (0 a 100)',
                desc: 'Escala porcentual de 0 a 100 puntos.',
              },
              {
                value: 'CONCEPTUAL' as ScaleType,
                title: 'Conceptual personalizada',
                desc: 'Niveles conceptuales con equivalencia numérica interna.',
              },
            ] as const
          ).map((option) => {
            const isSelected = scaleType === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelectScaleType(option.value)}
                className={`p-4 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600/15'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-sm font-bold text-slate-900">
                    {option.title}
                  </span>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    {isSelected && <Check className="w-2.5 h-2.5" />}
                  </div>
                </div>
                <p className="text-xs text-slate-500">{option.desc}</p>
              </button>
            );
          })}
        </div>

        {/* Dynamic Conceptual Items Editor */}
        {scaleType === 'CONCEPTUAL' && (
          <div className="mt-4 pt-5 border-t border-slate-100 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Niveles de la Escala Conceptual
                </h4>
                <p className="text-xs text-slate-500">
                  Cada concepto tiene un valor numérico interno para calcular
                  promedios ponderados y sugerir cierres de período.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetConceptualDefaults}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Restaurar por defecto
                </button>
                <button
                  type="button"
                  onClick={handleAddConceptualItem}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Agregar Nivel</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 px-3 w-16 text-center">Orden</th>
                    <th className="py-2.5 px-3">Etiqueta (ej: Muy Bien)</th>
                    <th className="py-2.5 px-3 w-32">Código Corto (ej: MB)</th>
                    <th className="py-2.5 px-3 w-36">Valor Numérico</th>
                    <th className="py-2.5 px-3 w-28 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {conceptualItems.map((item, idx) => (
                    <tr key={item.tempId} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 text-center text-xs font-bold text-slate-400">
                        #{idx + 1}
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          required
                          value={item.label}
                          onChange={(e) =>
                            handleUpdateConceptualItem(
                              idx,
                              'label',
                              e.target.value
                            )
                          }
                          placeholder="Ej: Regular"
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs sm:text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          required
                          value={item.shortCode}
                          onChange={(e) =>
                            handleUpdateConceptualItem(
                              idx,
                              'shortCode',
                              e.target.value
                            )
                          }
                          placeholder="Ej: R"
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs sm:text-sm font-semibold text-slate-900 focus:border-indigo-600 focus:outline-none"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="number"
                          step="0.5"
                          required
                          value={item.numericValue}
                          onChange={(e) =>
                            handleUpdateConceptualItem(
                              idx,
                              'numericValue',
                              e.target.value
                            )
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs sm:text-sm font-semibold text-slate-900 focus:border-indigo-600 focus:outline-none"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveConceptualItem(idx, -1)}
                            title="Subir orden"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === conceptualItems.length - 1}
                            onClick={() => handleMoveConceptualItem(idx, 1)}
                            title="Bajar orden"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={conceptualItems.length <= 1}
                            onClick={() => handleRemoveConceptualItem(idx)}
                            title="Eliminar nivel"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Section 2: Final Grade Weights & Attendance Rules */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Percent className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                2. Ponderación de la Nota Final y Reglas
              </h3>
              <p className="text-xs text-slate-500">
                La suma de los tres porcentajes debe ser exactamente 100%.
              </p>
            </div>
          </div>

          {/* Real-time Sum Indicator Badge */}
          <div
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold border ${
              isWeightSumValid
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-red-50 text-red-700 border-red-200'
            }`}
          >
            {isWeightSumValid ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600" />
            )}
            <span>Suma Total: {totalWeight}% / 100%</span>
          </div>
        </div>

        {/* 3 Weight Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50">
            <label
              htmlFor="weight-exams"
              className="block text-xs font-bold text-slate-700 mb-1.5"
            >
              Exámenes (%)
            </label>
            <div className="relative">
              <input
                id="weight-exams"
                type="number"
                min={0}
                max={100}
                step="1"
                value={examWeight}
                onChange={(e) => {
                  setExamWeight(
                    e.target.value === '' ? 0 : Number(e.target.value)
                  );
                  setSuccessMessage(null);
                }}
                className="block w-full rounded-xl border border-slate-300 bg-white pr-8 pl-3.5 py-2 text-base font-bold text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                %
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              Incluye exámenes y reemplazos por recuperatorio.
            </p>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50">
            <label
              htmlFor="weight-assignments"
              className="block text-xs font-bold text-slate-700 mb-1.5"
            >
              Trabajos Prácticos (%)
            </label>
            <div className="relative">
              <input
                id="weight-assignments"
                type="number"
                min={0}
                max={100}
                step="1"
                value={assignmentWeight}
                onChange={(e) => {
                  setAssignmentWeight(
                    e.target.value === '' ? 0 : Number(e.target.value)
                  );
                  setSuccessMessage(null);
                }}
                className="block w-full rounded-xl border border-slate-300 bg-white pr-8 pl-3.5 py-2 text-base font-bold text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                %
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              Promedio ponderado de entregas y TPs del período.
            </p>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50">
            <label
              htmlFor="weight-attendance"
              className="block text-xs font-bold text-slate-700 mb-1.5"
            >
              Asistencia (%)
            </label>
            <div className="relative">
              <input
                id="weight-attendance"
                type="number"
                min={0}
                max={100}
                step="1"
                value={attendanceWeight}
                onChange={(e) => {
                  setAttendanceWeight(
                    e.target.value === '' ? 0 : Number(e.target.value)
                  );
                  setSuccessMessage(null);
                }}
                className="block w-full rounded-xl border border-slate-300 bg-white pr-8 pl-3.5 py-2 text-base font-bold text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                %
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              Impacto del % de asistencia acumulado en la nota final.
            </p>
          </div>
        </div>

        {/* Visual Progress Bar of Weights */}
        <div className="space-y-1.5">
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
            <div
              className="bg-indigo-600 h-full transition-all"
              style={{
                width: `${Math.min(100, Math.max(0, examWeight))}%`,
              }}
              title={`Exámenes: ${examWeight}%`}
            />
            <div
              className="bg-emerald-500 h-full transition-all"
              style={{
                width: `${Math.min(100, Math.max(0, assignmentWeight))}%`,
              }}
              title={`Trabajos Prácticos: ${assignmentWeight}%`}
            />
            <div
              className="bg-amber-500 h-full transition-all"
              style={{
                width: `${Math.min(100, Math.max(0, attendanceWeight))}%`,
              }}
              title={`Asistencia: ${attendanceWeight}%`}
            />
          </div>

          {!isWeightSumValid && (
            <p className="text-xs font-semibold text-red-600">
              La suma actual es {totalWeight}%. Ajustá los valores para que
              sumen exactamente 100% antes de guardar.
            </p>
          )}
        </div>

        {/* Justified Absent Rule Checkbox */}
        <div className="pt-4 border-t border-slate-100">
          <label className="inline-flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={justifiedCountsAsPresent}
              onChange={(e) => {
                setJustifiedCountsAsPresent(e.target.checked);
                setSuccessMessage(null);
              }}
              className="mt-0.5 w-4 h-4 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <div>
              <span className="block text-sm font-bold text-slate-900">
                Ausente Justificado cuenta como Presente
              </span>
              <span className="block text-xs text-slate-500 mt-0.5">
                Si está activo, las inasistencias justificadas (J) suman 1.0 en
                el cálculo del porcentaje de asistencia del alumno. Si se
                desactiva, computan como 0.0.
              </span>
            </div>
          </label>
        </div>

        {/* Bottom Save Button */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
          <button
            type="submit"
            disabled={!canSave}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>Guardar Configuración</span>
          </button>
        </div>
      </div>
    </form>
  );
};

export default SettingsTab;
