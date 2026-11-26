import React from 'react';
import { GraduationCap } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Navbar: React.FC = () => {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2.5 text-indigo-600">
          <GraduationCap className="h-7 w-7" />
          <span className="text-lg font-bold tracking-tight text-slate-900">
            Gestión Áulica
          </span>
        </Link>
      </div>
    </header>
  );
};
