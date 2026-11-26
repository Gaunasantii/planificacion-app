import apiClient from './client';
import {
  Assessment,
  AssessmentGradesResponse,
  CreateAssessmentInput,
  PeriodGradesPreviewResponse,
  SaveAssessmentGradesInput,
  SavePeriodGradesInput,
  UpdateAssessmentInput,
} from '../types';

export const listCourseAssessments = async (
  courseId: string,
  periodId?: string
): Promise<Assessment[]> => {
  const { data } = await apiClient.get<Assessment[]>(
    `/courses/${courseId}/assessments`,
    {
      params: periodId ? { periodId } : undefined,
    }
  );
  return data;
};

export const createAssessment = async (
  courseId: string,
  input: CreateAssessmentInput
): Promise<Assessment> => {
  const { data } = await apiClient.post<Assessment>(
    `/courses/${courseId}/assessments`,
    input
  );
  return data;
};

export const updateAssessment = async (
  assessmentId: string,
  input: UpdateAssessmentInput
): Promise<Assessment> => {
  const { data } = await apiClient.patch<Assessment>(
    `/assessments/${assessmentId}`,
    input
  );
  return data;
};

export const deleteAssessment = async (
  assessmentId: string
): Promise<{ deleted: boolean; id: string }> => {
  const { data } = await apiClient.delete<{ deleted: boolean; id: string }>(
    `/assessments/${assessmentId}`
  );
  return data;
};

export const getAssessmentGrades = async (
  assessmentId: string
): Promise<AssessmentGradesResponse> => {
  const { data } = await apiClient.get<AssessmentGradesResponse>(
    `/assessments/${assessmentId}/grades`
  );
  return data;
};

export const saveAssessmentGrades = async (
  assessmentId: string,
  input: SaveAssessmentGradesInput
): Promise<AssessmentGradesResponse> => {
  const { data } = await apiClient.put<AssessmentGradesResponse>(
    `/assessments/${assessmentId}/grades`,
    input
  );
  return data;
};

export const previewPeriodGrades = async (
  periodId: string
): Promise<PeriodGradesPreviewResponse> => {
  const { data } = await apiClient.get<PeriodGradesPreviewResponse>(
    `/periods/${periodId}/grades/preview`
  );
  return data;
};

export const savePeriodGrades = async (
  periodId: string,
  input: SavePeriodGradesInput
): Promise<PeriodGradesPreviewResponse> => {
  const { data } = await apiClient.put<PeriodGradesPreviewResponse>(
    `/periods/${periodId}/grades`,
    input
  );
  return data;
};

export const assessmentsApi = {
  listCourseAssessments,
  createAssessment,
  updateAssessment,
  deleteAssessment,
  getAssessmentGrades,
  saveAssessmentGrades,
  previewPeriodGrades,
  savePeriodGrades,
};

export default assessmentsApi;
