import type { PlanStatus } from '../../api/plan-types';

export const STATUS_LABEL: Record<PlanStatus, string> = {
  yangi: 'Yangi',
  yuborilgan: 'Yuborilgan',
  jarayonda: 'Jarayonda',
  rad_etilgan: 'Rad etilgan',
  bajarilgan: 'Bajarilgan',
};

export const STATUS_VARIANT: Record<PlanStatus, string> = {
  yangi: 'yangi',
  yuborilgan: 'yuborilgan',
  jarayonda: 'kutilmoqda',
  rad_etilgan: 'rad etilgan',
  bajarilgan: 'bajarildi',
};
