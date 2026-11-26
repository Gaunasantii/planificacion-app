import apiClient from './client';
import {
  Course,
  CreateCourseInput,
  GradingConfig,
  Period,
  PeriodInput,
  UpdateGradingConfigInput,
} from '../types';

export const listSchoolCourses = async (
  schoolId: string
): Promise<Course[]> => {
  const { data } = await apiClient.get<Course[]>(
    `/schools/${schoolId}/courses`
  );
  return data;
};

export const createCourse = async (
  schoolId: string,
  input: CreateCourseInput
): Promise<Course> => {
  const { data } = await apiClient.post<Course>(
    `/schools/${schoolId}/courses`,
    input
  );
  return data;
};

export const getCourseDetail = async (courseId: string): Promise<Course> => {
  const { data } = await apiClient.get<Course>(`/courses/${courseId}`);
  return data;
};

export const updateGradingConfig = async (
  courseId: string,
  input: UpdateGradingConfigInput
): Promise<GradingConfig> => {
  const { data } = await apiClient.put<GradingConfig>(
    `/courses/${courseId}/grading-config`,
    input
  );
  return data;
};

export const createPeriod = async (
  courseId: string,
  input: PeriodInput
): Promise<Period> => {
  const { data } = await apiClient.post<Period>(
    `/courses/${courseId}/periods`,
    input
  );
  return data;
};

export const updatePeriod = async (
  periodId: string,
  input: Partial<PeriodInput>
): Promise<Period> => {
  const { data } = await apiClient.patch<Period>(
    `/periods/${periodId}`,
    input
  );
  return data;
};

export const coursesApi = {
  listSchoolCourses,
  createCourse,
  getCourseDetail,
  updateGradingConfig,
  createPeriod,
  updatePeriod,
};

export default coursesApi;
