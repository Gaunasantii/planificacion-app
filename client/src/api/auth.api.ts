import apiClient from './client';
import {
  AuthMeResponse,
  AuthResponse,
  LoginInput,
  RegisterInput,
} from '../types';

export const login = async (input: LoginInput): Promise<AuthResponse> => {
  const { data } = await apiClient.post<AuthResponse>('/auth/login', input);
  return data;
};

export const register = async (input: RegisterInput): Promise<AuthResponse> => {
  const { data } = await apiClient.post<AuthResponse>('/auth/register', input);
  return data;
};

export const getMe = async (): Promise<AuthMeResponse> => {
  const { data } = await apiClient.get<AuthMeResponse>('/auth/me');
  return data;
};

export const authApi = {
  login,
  register,
  getMe,
};

export default authApi;
