import apiClient from './client';
import {
  CourseEnrollment,
  CreateStudentInput,
  UpdateEnrollmentInput,
} from '../types';

export const listCourseStudents = async (
  courseId: string
): Promise<CourseEnrollment[]> => {
  const { data } = await apiClient.get<CourseEnrollment[]>(
    `/courses/${courseId}/students`
  );
  return data;
};

export const enrollStudent = async (
  courseId: string,
  input: CreateStudentInput
): Promise<CourseEnrollment> => {
  const { data } = await apiClient.post<CourseEnrollment>(
    `/courses/${courseId}/students`,
    input
  );
  return data;
};

export const bulkEnrollStudents = async (
  courseId: string,
  students: CreateStudentInput[]
): Promise<CourseEnrollment[]> => {
  const { data } = await apiClient.post<CourseEnrollment[]>(
    `/courses/${courseId}/students/bulk`,
    { students }
  );
  return data;
};

export const updateEnrollment = async (
  enrollmentId: string,
  input: UpdateEnrollmentInput
): Promise<CourseEnrollment> => {
  const { data } = await apiClient.patch<CourseEnrollment>(
    `/enrollments/${enrollmentId}`,
    input
  );
  return data;
};

export const studentsApi = {
  listCourseStudents,
  enrollStudent,
  bulkEnrollStudents,
  updateEnrollment,
};

export default studentsApi;
