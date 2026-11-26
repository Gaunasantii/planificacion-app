import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { authApi } from '../api/auth.api';
import {
  LoginInput,
  RegisterInput,
  SchoolMember,
  User,
} from '../types';

export interface AuthContextValue {
  user: User | null;
  memberships: SchoolMember[];
  loading: boolean;
  isAuthenticated: boolean;
  activeSchoolId: string | null;
  setActiveSchoolId: (schoolId: string | null) => void;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [memberships, setMemberships] = useState<SchoolMember[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeSchoolId, setActiveSchoolIdState] = useState<string | null>(
    () => localStorage.getItem('activeSchoolId')
  );

  const setActiveSchoolId = useCallback((schoolId: string | null) => {
    setActiveSchoolIdState(schoolId);
    if (schoolId) {
      localStorage.setItem('activeSchoolId', schoolId);
    } else {
      localStorage.removeItem('activeSchoolId');
    }
  }, []);

  const syncActiveSchool = useCallback(
    (loadedMemberships: SchoolMember[]) => {
      if (loadedMemberships.length === 0) {
        setActiveSchoolId(null);
        return;
      }

      const stored = localStorage.getItem('activeSchoolId');
      const exists = loadedMemberships.some((m) => m.school.id === stored);
      if (!stored || !exists) {
        setActiveSchoolId(loadedMemberships[0].school.id);
      }
    },
    [setActiveSchoolId]
  );

  const refreshMe = useCallback(async () => {
    const profile = await authApi.getMe();
    const { memberships: userMemberships = [], ...userData } = profile;
    setUser(userData);
    setMemberships(userMemberships);
    syncActiveSchool(userMemberships);
  }, [syncActiveSchool]);

  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        const profile = await authApi.getMe();
        if (!isMounted) return;
        const { memberships: userMemberships = [], ...userData } = profile;
        setUser(userData);
        setMemberships(userMemberships);
        syncActiveSchool(userMemberships);
      } catch {
        if (!isMounted) return;
        localStorage.removeItem('token');
        setUser(null);
        setMemberships([]);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    return () => {
      isMounted = false;
    };
  }, [syncActiveSchool]);

  const login = useCallback(
    async (input: LoginInput) => {
      const response = await authApi.login(input);
      localStorage.setItem('token', response.token);
      setUser(response.user);
      try {
        await refreshMe();
      } catch {
        // Fallback if getMe fails right after login
        setMemberships([]);
      }
    },
    [refreshMe]
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const response = await authApi.register(input);
      localStorage.setItem('token', response.token);
      setUser(response.user);
      try {
        await refreshMe();
      } catch {
        setMemberships([]);
      }
    },
    [refreshMe]
  );

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('activeSchoolId');
    setUser(null);
    setMemberships([]);
    setActiveSchoolIdState(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        memberships,
        loading,
        isAuthenticated: Boolean(user),
        activeSchoolId,
        setActiveSchoolId,
        login,
        register,
        logout,
        refreshMe,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe utilizarse dentro de un AuthProvider');
  }
  return context;
};
