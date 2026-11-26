import React from 'react';
import { BookOpen, Calendar, CheckSquare, Users } from 'lucide-react';

export const HomePage: React.FC = () => {
  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xs">
        <h1 className="text-2xl font-bold text-slate-900">
          Plataforma Multiusuario de Gestión Áulica Docente
        </h1>
        <p className="mt-2 text-slate-600">
          Administración integral de instituciones educativas, cursos, asistencia y calificaciones.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <BookOpen className="mt-0.5 h-5 w-5 text-indigo-600" />
            <div>
              <h2 className="font-semibold text-slate-900">Cursos y Materias</h2>
              <p className="text-sm text-slate-600">Gestión por nivel primario y secundario</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <Users className="mt-0.5 h-5 w-5 text-indigo-600" />
            <div>
              <h2 className="font-semibold text-slate-900">Matrícula</h2>
              <p className="text-sm text-slate-600">Seguimiento de alumnos e inscripciones</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <Calendar className="mt-0.5 h-5 w-5 text-indigo-600" />
            <div>
              <h2 className="font-semibold text-slate-900">Asistencia</h2>
              <p className="text-sm text-slate-600">Registro por clase y horarios</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <CheckSquare className="mt-0.5 h-5 w-5 text-indigo-600" />
            <div>
              <h2 className="font-semibold text-slate-900">Calificaciones</h2>
              <p className="text-sm text-slate-600">Escalas numéricas y conceptuales</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};
