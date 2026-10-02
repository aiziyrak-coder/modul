export interface CalendarPlan {
  id: string;
  title: string;
  fileUrl: string;
  uploadedAt?: string;
}

export interface CalendarPlanInput {
  title: string;
  file: File;
}
