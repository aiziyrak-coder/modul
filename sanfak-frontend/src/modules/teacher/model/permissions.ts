import type { ModulePermission } from '@/shared/lib/module';

export const TEACHER_PERMISSIONS: ModulePermission[] = [
  { key: 'teacher:create',  description: 'Create own teacher profile' },
  { key: 'teacher:read',    description: 'View one teacher profile' },
  { key: 'teacher:readAll', description: 'List teacher profiles (self-scope for oqituvchi)' },
  { key: 'teacher:update',  description: 'Update own teacher profile' },
  { key: 'teacher:approve', description: 'HR: approve a teacher profile' },
  { key: 'teacher:reject',  description: 'HR: reject a teacher profile (comment required)' },
  { key: 'staff:create',  description: 'HR: create a staff member (oqituvchi)' },
  { key: 'staff:read',    description: 'HR: view one staff member' },
  { key: 'staff:readAll', description: 'HR: list staff members' },
  { key: 'staff:update',  description: 'HR: update a staff member' },
  { key: 'staff:delete',  description: 'HR: delete (soft) a staff member' },
  { key: 'staff:export',  description: 'HR: export staff list to Excel' },
  { key: 'personalWorkPlan:create',  description: 'Create personal work plan' },
  { key: 'personalWorkPlan:read',    description: 'View one personal work plan' },
  { key: 'personalWorkPlan:readAll', description: 'List personal work plans' },
  { key: 'personalWorkPlan:update',  description: 'Update personal work plan' },
  { key: 'personalWorkPlan:delete',  description: 'Delete personal work plan' },
  { key: 'personalWorkPlan:approve', description: 'Approve a submitted personal work plan (kafedra mudiri)' },
  { key: 'personalWorkPlan:reject',  description: 'Reject a submitted personal work plan (kafedra mudiri)' },
  { key: 'personalWorkPlan:review',  description: 'Review a submitted personal work plan before approve/reject' },
];
