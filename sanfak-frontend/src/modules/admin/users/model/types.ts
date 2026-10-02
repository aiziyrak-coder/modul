export interface AdminUser {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  email?: string;
  phone?: string;
  photo?: string;
  oneIdPin?: string;
  passportSeria?: string;
  passportNumber?: string;
  role?: { id: string; title: string };
  position?: { id: string; title: string } | string;
  division?: { id: string; title: string } | string;
  department?: { id: string; title: string } | string;
  faculty?: { id: string; title: string } | string;
  academicTitle?: { id: string; title: string } | string;
  publications?: number;
  hIndex?: number;
  workingHours?: string;
  office?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserInput {
  firstName: string;
  lastName: string;
  middleName?: string;
  email?: string;
  phone?: string;
  oneIdPin?: string;
  role?: string;
  active?: boolean;
}
