import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Building2,
  Calendar,
  ChevronRight,
  Clock,
  GraduationCap,
  Loader2,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { schoolsApi } from '../api/schools.api';
import { getApiErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  CreateSchoolInput,
  EDUCATION_LEVEL_LABELS,
  EducationLevel,
  PERIOD_TYPE_LABELS,
  PeriodType,
  School,
  SCHOOL_ROLE_LABELS,
} from '../types';

const CURRENT_YEAR = new Date().getFullYear();

export const SchoolsPage: React.FC = () => {
  const navigate = useNavigate();
  const { setActiveSchoolId, refreshMe } = useAuth();

  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Create / Edit Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [name, setName] = useState('');
  const [educationLevel, setEducationLevel] =
    useState<EducationLevel>('SECONDARY');
  const [academicYear, setAcademicYear] = useState<number>(CURRENT_YEAR);
  const [defaultPeriodType, setDefaultPeriodType] =
    useState<PeriodType>('TRIMESTER');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Delete confirmation state
  const [deletingSchool, setDeletingSchool] = useState<School | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  const fetchSchools = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await schoolsApi.listSchools();
      setSchools(data);
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudieron cargar las escuelas'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchools();
  }, [fetchSchools]);

  const openCreateModal = () => {
    setEditingSchool(null);
    setName('');
    setEducationLevel('SECONDARY');
    setAcademicYear(CURRENT_YEAR);
    setDefaultPeriodType('TRIMESTER');
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (e: React.MouseEvent, school: School) => {
    e.stopPropagation();
    setEditingSchool(school);
    setName(school.name);
    setEducationVersionState(school);
    setFormError(null);
    setModalOpen(true);
  };

  const setEducationVersionState = (school: School) => {
    setEducationLevel(school.educationLevel);
    setAcademicYear(school.academicYear);
    setDefaultPeriodType(school.defaultPeriodType);
  };

  const closeModal = () => {
    if (submitting) return;
    setModalOpen(false);
    setEditingSchool(null);
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError('El nombre de la escuela es obligatorio.');
      return;
    }

    if (
      !Number.isInteger(Number(academicYear)) ||
      academicYear < 2000 ||
      academicYear > 2100
    ) {
      setFormError('El ciclo lectivo debe estar entre 2000 y 2100.');
      return;
    }

    const payload: CreateSchoolInput = {
      name: trimmedName,
      educationLevel,
      academicYear: Number(academicYear),
      defaultPeriodType,
    };

    try {
      setSubmitting(true);
      if (editingSchool) {
        const updated = await schoolsApi.updateSchool(
          editingSchool.id,
          payload
        );
        setSchools((prev) =>
          prev.map((s) => (s.id === updated.id ? updated : s))
        );
      } else {
        const created = await schoolsApi.createSchool(payload);
        setSchools((prev) => [created, ...prev]);
        setActiveSchoolId(created.id);
      }
      await refreshMe();
      setModalOpen(false);
      setEditingSchool(null);
    } catch (err) {
      setFormError(
        getApiErrorMessage(err, 'No se pudo guardar la información de la escuela')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingSchool) return;
    try {
      setDeletingLoading(true);
      await schoolsApi.deleteSchool(deletingSchool.id);
      setSchools((prev) => prev.filter((s) => s.id !== deletingSchool.id));
      await refreshMe();
      setDeletingSchool(null);
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo eliminar la escuela'));
      setDeletingSchool(null);
    } finally {
      setDeletingLoading(false);
    }
  };

  const handleCardClick = (school: School) => {
    setActiveSchoolId(school.id);
    navigate(`/schools/${school.id}`);
  };

  const filteredSchools = schools.filter((school) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      school.name.toLowerCase().includes(q) ||
      String(school.academicYear).includes(q) ||
      EDUCATION_LEVEL_LABELS[school.educationLevel].toLowerCase().includes(q)
    );
  });

  const getLevelBadgeClasses = (level: EducationLevel) => {
    switch (level) {
      case 'PRIMARY':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'SECONDARY':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'BOTH':
        return 'bg-purple-50 text-purple-700 border-purple-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Mis Escuelas
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Seleccioná una institución para gestionar sus cursos o agregá una
            nueva escuela.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Escuela</span>
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 flex items-start justify-between gap-3 text-red-700 text-sm">
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

      {/* Search Bar when schools exist */}
      {schools.length > 0 && (
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar escuela por nombre, nivel o ciclo lectivo..."
            className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 transition"
          />
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center justify-center text-slate-500">
          <Loader2 className="w-7 h-7 animate-spin text-indigo-600 mb-3" />
          <p className="text-sm font-medium">Cargando escuelas...</p>
        </div>
      ) : schools.length === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto my-6">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            Aún no tenés escuelas registradas
          </h2>
          <p className="text-sm text-slate-600 mt-1.5 mb-6">
            Creá tu primera escuela para empezar a configurar tus cursos,
            horarios, períodos y nómina de alumnos.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Crear primera escuela</span>
          </button>
        </div>
      ) : filteredSchools.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
          No se encontraron escuelas que coincidan con &ldquo;{searchQuery}&rdquo;.
        </div>
      ) : (
        /* Schools Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSchools.map((school) => (
            <div
              key={school.id}
              onClick={() => handleCardClick(school)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleCardClick(school);
                }
              }}
              className="group bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:shadow-md hover:border-indigo-300 transition flex flex-col justify-between cursor-pointer text-left"
            >
              <div>
                {/* Top row: Level Badge + Actions */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${getLevelBadgeClasses(
                      school.educationLevel
                    )}`}
                  >
                    <GraduationCap className="w-3.5 h-3.5" />
                    Nivel {EDUCATION_LEVEL_LABELS[school.educationLevel]}
                  </span>

                  <div className="flex items-center gap-1">
                    {(school.isCreator ?? true) && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => openEditModal(e, school)}
                          title="Editar escuela"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingSchool(school);
                          }}
                          title="Eliminar escuela"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* School Name */}
                <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition line-clamp-2">
                  {school.name}
                </h3>

                {/* Metadata */}
                <div className="mt-4 space-y-2 text-xs text-slate-600">
                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Ciclo Lectivo
                    </span>
                    <span className="font-semibold text-slate-800">
                      {school.academicYear}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      Régimen de Períodos
                    </span>
                    <span className="font-semibold text-slate-800">
                      {PERIOD_TYPE_LABELS[school.defaultPeriodType]}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                      Rol en la institución
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                      {school.role
                        ? SCHOOL_ROLE_LABELS[school.role]
                        : 'Docente'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer CTA */}
              <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-indigo-600 group-hover:text-indigo-700">
                <span>Ver cursos de la escuela</span>
                <ChevronRight className="w-4 h-4 transform group-hover:translate-x-0.5 transition" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit School Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900">
                  {editingSchool ? 'Editar Escuela' : 'Nueva Escuela'}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 flex items-start gap-2 text-red-700 text-xs">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label
                  htmlFor="school-name"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Nombre de la Escuela *
                </label>
                <input
                  id="school-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: E.E.S. N° 12 José de San Martín"
                  className="block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="school-level"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Nivel Educativo *
                  </label>
                  <select
                    id="school-level"
                    value={educationLevel}
                    onChange={(e) =>
                      setEducationLevel(e.target.value as EducationLevel)
                    }
                    className="block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                  >
                    <option value="PRIMARY">Primario</option>
                    <option value="SECONDARY">Secundario</option>
                    <option value="BOTH">Ambos (Primario y Secundario)</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="school-year"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Ciclo Lectivo *
                  </label>
                  <input
                    id="school-year"
                    type="number"
                    min={2000}
                    max={2100}
                    required
                    value={academicYear}
                    onChange={(e) => setAcademicYear(Number(e.target.value))}
                    className="block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="school-period-type"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Régimen de Períodos Predeterminado *
                </label>
                <select
                  id="school-period-type"
                  value={defaultPeriodType}
                  onChange={(e) =>
                    setDefaultPeriodType(e.target.value as PeriodType)
                  }
                  className="block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                >
                  <option value="BIMESTER">Bimestral (4 Bimestres)</option>
                  <option value="TRIMESTER">Trimestral (3 Trimestres)</option>
                  <option value="QUADRIMESTER">
                    Cuatrimestral (2 Cuatrimestres)
                  </option>
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Se utilizará por defecto al crear nuevos cursos en esta
                  institución.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={closeModal}
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
                    {editingSchool ? 'Guardar Cambios' : 'Crear Escuela'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete School Confirmation Modal */}
      {deletingSchool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-slate-900">
              ¿Eliminar escuela?
            </h3>
            <p className="text-sm text-slate-600 mt-2">
              Estás por eliminar{' '}
              <strong className="text-slate-900">{deletingSchool.name}</strong> y
              todos sus cursos, asistencias y evaluaciones asociadas. Esta
              acción no se puede deshacer.
            </p>
            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingSchool(null)}
                disabled={deletingLoading}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deletingLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60 transition cursor-pointer"
              >
                {deletingLoading && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                <span>Eliminar Escuela</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchoolsPage;
