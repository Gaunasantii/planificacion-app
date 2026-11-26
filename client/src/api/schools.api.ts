import apiClient from './client';
import { CreateSchoolInput, School, UpdateSchoolInput } from '../types';

export const listSchools = async (): Promise<School[]> => {
  const { data } = await apiClient.get<School[]>('/schools');
  return data;
};

export const createSchool = async (
  input: CreateSchoolInput
): Promise<School> => {
  const { data } = await apiClient.post<School>('/schools', input);
  return data;
};

export const updateSchool = async (
  schoolId: string,
  input: UpdateSchoolInput
): Promise<School> => {
  const { data } = await apiClient.patch<School>(
    `/schools/${schoolId}`,
    input
  );
  return data;
};

export const deleteSchool = async (
  schoolId: string
): Promise<{ message: string }> => {
  const { data } = await apiClient.delete<{ message: string }>(
    `/schools/${schoolId}`
  );
  return data;
};

export const schoolsApi = {
  listSchools,
  createSchool,
  updateSchool,
  deleteSchool,
};

export default schoolsApi;
