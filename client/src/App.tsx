import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { SchoolsPage } from './pages/SchoolsPage';
import { SchoolCoursesPage } from './pages/SchoolCoursesPage';
import { CourseLayout } from './pages/course/CourseLayout';
import { AttendanceTab } from './pages/course/AttendanceTab';
import { AssessmentsTab } from './pages/course/AssessmentsTab';
import { PeriodGradesTab } from './pages/course/PeriodGradesTab';
import { StudentsTab } from './pages/course/StudentsTab';
import { SettingsTab } from './pages/course/SettingsTab';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected Application Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<SchoolsPage />} />
              <Route path="/schools" element={<SchoolsPage />} />
              <Route
                path="/schools/:schoolId"
                element={<SchoolCoursesPage />}
              />
              <Route path="/courses/:courseId" element={<CourseLayout />}>
                <Route index element={<Navigate to="attendance" replace />} />
                <Route path="attendance" element={<AttendanceTab />} />
                <Route path="assessments" element={<AssessmentsTab />} />
                <Route path="period-grades" element={<PeriodGradesTab />} />
                <Route path="students" element={<StudentsTab />} />
                <Route path="settings" element={<SettingsTab />} />
              </Route>
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
