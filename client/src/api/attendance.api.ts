import apiClient from './client';
import {
  CourseAttendanceSummaryResponse,
  CreateSessionInput,
  ListCourseSessionsResponse,
  SaveSessionAttendanceInput,
  SessionAttendanceResponse,
} from '../types';

export const listCourseSessions = async (
  courseId: string
): Promise<ListCourseSessionsResponse> => {
  const { data } = await apiClient.get<ListCourseSessionsResponse>(
    `/courses/${courseId}/sessions`
  );
  return data;
};

export const createOrGetSession = async (
  courseId: string,
  input: CreateSessionInput
): Promise<SessionAttendanceResponse> => {
  const { data } = await apiClient.post<SessionAttendanceResponse>(
    `/courses/${courseId}/sessions`,
    input
  );
  return data;
};

export const getSessionAttendance = async (
  sessionId: string
): Promise<SessionAttendanceResponse> => {
  const { data } = await apiClient.get<SessionAttendanceResponse>(
    `/sessions/${sessionId}/attendance`
  );
  return data;
};

export const saveSessionAttendance = async (
  sessionId: string,
  input: SaveSessionAttendanceInput
): Promise<SessionAttendanceResponse> => {
  const { data } = await apiClient.put<SessionAttendanceResponse>(
    `/sessions/${sessionId}/attendance`,
    input
  );
  return data;
};

export const getCourseAttendanceSummary = async (
  courseId: string,
  asOfDate?: string
): Promise<CourseAttendanceSummaryResponse> => {
  const { data } = await apiClient.get<CourseAttendanceSummaryResponse>(
    `/courses/${courseId}/attendance-summary`,
    {
      params: asOfDate ? { asOfDate } : undefined,
    }
  );
  return data;
};

export const attendanceApi = {
  listCourseSessions,
  createOrGetSession,
  getSessionAttendance,
  saveSessionAttendance,
  getCourseAttendanceSummary,
};

export default attendanceApi;
