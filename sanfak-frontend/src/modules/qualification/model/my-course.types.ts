import type { EduForm } from './course.types';

export interface MyCourse {
  id: string;
  subscriptionId: string;
  title: string;
  creditHours: number;
  price: number;
  form: EduForm;
  startDate?: string;
  endDate?: string;
  status: number;
  educationType: number;
  entranceTestDone: boolean;
  paid: boolean;
}
