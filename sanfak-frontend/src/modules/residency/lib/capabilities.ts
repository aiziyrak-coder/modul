import { usePermission } from '@/app/session';

export interface ResidencyCapabilities {
  isStudent: boolean;
  isOffice: boolean;
  isMentor: boolean;
  isClinicalMentor: boolean;
  canDecideApplication: boolean;
  canCreateApplication: boolean;
  canSendNotice: boolean;
  canDecideNotice: boolean;
  canApproveDailyLog: boolean;
  canAnnounceSession: boolean;
  canGradeSession: boolean;
  canExcuseAttendance: boolean;
}

export type CanFn = (permission: string) => boolean;

export function deriveCapabilities(can: CanFn): ResidencyCapabilities {
  const isStudent = can('resident:read') && !can('resident:readAll');

  const isOffice = can('residencyReport:readAll') && can('resident:create');

  const isMentor = can('residencyNotice:create');

  return {
    isStudent,
    isOffice,
    isMentor,
    isClinicalMentor: isMentor && can('residentAttendance:create'),
    canDecideApplication: can('residentApplication:approve'),
    canCreateApplication: can('residentApplication:create'),
    canSendNotice: can('residencyNotice:create'),
    canDecideNotice: can('residencyNotice:approve'),
    canApproveDailyLog: can('residentDailyLog:approve'),
    canAnnounceSession: can('residentAttendance:create'),
    canGradeSession: can('residentAttendance:update'),
    canExcuseAttendance: can('residentAttendance:approve') && isOffice,
  };
}

export function useResidencyCapabilities(): ResidencyCapabilities {
  const can = usePermission();
  return deriveCapabilities(can);
}
