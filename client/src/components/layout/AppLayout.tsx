import React, { useEffect, useState } from 'react';
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import {
  BookOpen,
  Building2,
  ChevronRight,
  GraduationCap,
  LogOut,
  Menu,
  School as SchoolIcon,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { EDUCATION_LEVEL_LABELS } from '../../types';

export const AppLayout: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => {
  const {
    user,
    memberships,
    activeSchoolId,
    setActiveSchoolId,
    logout,
  } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ schoolId?: string }>();

  // Sync activeSchoolId when visiting /schools/:schoolId
  useEffect(() => {
    if (params.schoolId && params.schoolId !== activeSchoolId) {
      const exists = memberships.some((m) => m.school.id === params.schoolId);
      if (exists) {
        setActiveSchoolId(params.schoolId);
      }
    }
  }, [params.schoolId, activeSchoolId, memberships, setActiveSchoolId]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const handleSchoolSelectorChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const selectedId = e.target.value;
    if (!selectedId) {
      setActiveSchoolId(null);
      navigate('/schools');
      return;
    }
    setActiveSchoolId(selectedId);
    navigate(`/schools/${selectedId}`);
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const activeSchool =
    memberships.find((m) => m.school.id === activeSchoolId)?.school || null;

  const userInitials = user
    ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() ||
      'D'
    : 'D';

  const isSchoolsOverview =
    location.pathname === '/' || location.pathname === '/schools';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-slate-200 px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
            <BookOpen className="w-4 h-4" />
          </div>
          <span className="font-bold text-slate-900 text-base tracking-tight">
            Gestión Áulica
          </span>
        </Link>

        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
          aria-label="Abrir menú"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 flex flex-col transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:z-auto lg:shrink-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-5 border-b border-slate-100 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-slate-900 text-base leading-none block">
                Gestión Áulica
              </span>
              <span className="text-xs text-slate-500 mt-0.5 block">
                Cuaderno Docente
              </span>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            aria-label="Cerrar menú"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick School Selector */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <label
            htmlFor="active-school-select"
            className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2"
          >
            <SchoolIcon className="w-3.5 h-3.5 text-indigo-600" />
            <span>Escuela Activa</span>
          </label>

          {memberships.length > 0 ? (
            <div className="space-y-2">
              <select
                id="active-school-select"
                value={activeSchoolId || ''}
                onChange={handleSchoolSelectorChange}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-2xs focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 transition cursor-pointer"
              >
                <option value="" disabled>
                  Seleccionar escuela...
                </option>
                {memberships.map((m) => (
                  <option key={m.school.id} value={m.school.id}>
                    {m.school.name} ({m.school.academicYear})
                  </option>
                ))}
              </select>

              {activeSchool && (
                <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                  <span>
                    Nivel:{' '}
                    <strong className="text-slate-700 font-medium">
                      {EDUCATION_LEVEL_LABELS[activeSchool.educationLevel]}
                    </strong>
                  </span>
                  <span>Ciclo {activeSchool.academicYear}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-3 text-xs text-slate-500 text-center">
              Sin escuelas registradas aún
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-2 pb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Navegación
          </div>

          <NavLink
            to="/schools"
            className={() =>
              `flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                isSchoolsOverview
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`
            }
          >
            <span className="flex items-center gap-3">
              <Building2
                className={`w-4 h-4 ${
                  isSchoolsOverview ? 'text-indigo-600' : 'text-slate-400'
                }`}
              />
              <span>Mis Escuelas</span>
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {memberships.length}
            </span>
          </NavLink>

          {activeSchool && (
            <NavLink
              to={`/schools/${activeSchool.id}`}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <span className="flex items-center gap-3 min-w-0">
                <GraduationCap className="w-4 h-4 shrink-0 text-indigo-600" />
                <span className="truncate">Cursos: {activeSchool.name}</span>
              </span>
              <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" />
            </NavLink>
          )}

          {memberships.length > 1 && (
            <div className="pt-4">
              <div className="px-2 pb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Acceso directo
              </div>
              <div className="space-y-0.5">
                {memberships.map((m) => {
                  const isCurrent =
                    location.pathname === `/schools/${m.school.id}`;
                  return (
                    <Link
                      key={m.school.id}
                      to={`/schools/${m.school.id}`}
                      onClick={() => setActiveSchoolId(m.school.id)}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition ${
                        isCurrent
                          ? 'bg-slate-100 text-indigo-700 font-semibold'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <span className="truncate">{m.school.name}</span>
                      <span className="text-slate-400 shrink-0 ml-2">
                        {m.school.academicYear}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </nav>

        {/* Teacher Profile & Logout */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
              {userInitials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 truncate">
                {user ? `${user.firstName} ${user.lastName}` : 'Docente'}
              </p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Cerrar sesión"
              className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 flex flex-col">
        <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children ? children : <Outlet />}
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
