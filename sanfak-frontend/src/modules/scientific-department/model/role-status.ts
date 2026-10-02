import { useMemo } from 'react';
import { useSessionStore } from '@/app/session';
import type { BadgeStatus, Methodical, Monograph } from './types';

export type SciRole =
  | 'teacher'
  | 'ilmiy'
  | 'kotib'
  | 'rektor'
  | 'prorektor'
  | 'admin'
  | 'other';

export function resolveSciRole(roleNames: string[]): SciRole {
  if (roleNames.includes('super_admin') || roleNames.includes('admin')) return 'admin';
  if (roleNames.includes('ilmiy_bolim')) return 'ilmiy';
  if (roleNames.includes('ilmiy_kengash_kotibi')) return 'kotib';
  if (roleNames.includes('rektor')) return 'rektor';
  if (roleNames.includes('prorektor')) return 'prorektor';
  if (roleNames.includes('oqituvchi')) return 'teacher';
  return 'other';
}

export function useSciRole(): SciRole {
  const user = useSessionStore((s) => s.user);
  return useMemo(
    () => resolveSciRole((user?.roles ?? []).map((r) => r.name)),
    [user],
  );
}

export function getMethodicalRoleStatus(
  m: Methodical,
  role: SciRole,
): BadgeStatus | null {
  if (m.status === 'rejected') return 'rejected';
  if (m.rektorSigned) return 'approved';
  switch (role) {
    case 'teacher':
      return m.ilmiyApproved || m.kotibSigned ? 'pending' : 'new';
    case 'ilmiy':
    case 'admin':
      return m.ilmiyApproved ? 'approved' : 'new';
    case 'kotib':
      if (m.kotibSigned) return 'approved';
      if (m.ilmiyApproved) return 'new';
      return null;
    case 'rektor':
      return m.kotibSigned ? 'new' : null;
    default:
      return m.status;
  }
}

export function methodicalActionStage(
  m: Methodical,
  role: SciRole,
): 'ilmiy' | 'kotib' | 'rektor' | null {
  if (m.status === 'rejected' || m.rektorSigned) return null;
  const stage = !m.ilmiyApproved ? 'ilmiy' : !m.kotibSigned ? 'kotib' : 'rektor';
  return role === 'admin' || role === stage ? stage : null;
}

export function isMethodicalVisible(m: Methodical, role: SciRole): boolean {
  if (role === 'kotib') return m.ilmiyApproved;
  if (role === 'rektor') return m.kotibSigned;
  return true;
}

export const canEditMethodical = (m: Methodical, role: SciRole): boolean =>
  (role === 'teacher' || role === 'admin') &&
  m.status === 'new' &&
  !m.ilmiyApproved;

export const canResubmitMethodical = (m: Methodical, role: SciRole): boolean =>
  (role === 'teacher' || role === 'admin') && m.status === 'rejected';

export function getMonographRoleStatus(m: Monograph, role: SciRole): BadgeStatus {
  if (m.status === 'rejected') return 'rejected';
  if (m.dataApproved) return 'approved';
  if (m.teacherConfirmed) {
    return role === 'ilmiy' || role === 'teacher' || role === 'admin'
      ? 'finalReview'
      : 'ssvReceived';
  }
  if (m.ssvReceived) return 'ssvReceived';
  if (m.ssvSent) return 'ssvSent';
  switch (role) {
    case 'ilmiy':
    case 'admin':
      if (m.prorektorSigned) return 'prorektorApproved';
      if (m.kotibSigned) return 'kotibApproved';
      if (m.ilmiyApproved) return 'pending';
      return 'new';
    case 'kotib':
      if (m.prorektorSigned) return 'ssvSendPending';
      if (m.kotibSigned) return 'kotibApproved';
      return 'new';
    case 'prorektor':
      return m.prorektorSigned ? 'ssvSendPending' : 'new';
    default:
      if (m.prorektorSigned) return 'ssvSendPending';
      if (m.ilmiyApproved || m.kotibSigned) return 'pending';
      return 'new';
  }
}

export function monographActionStage(
  m: Monograph,
  role: SciRole,
): 'ilmiy' | 'kotib' | 'prorektor' | null {
  if (m.status === 'rejected' || m.prorektorSigned) return null;
  const stage = !m.ilmiyApproved ? 'ilmiy' : !m.kotibSigned ? 'kotib' : 'prorektor';
  return role === 'admin' || role === stage ? stage : null;
}

export function isMonographVisible(m: Monograph, role: SciRole): boolean {
  if (role === 'kotib') return m.ilmiyApproved;
  if (role === 'prorektor') return m.kotibSigned;
  return true;
}

const isIlmiy = (role: SciRole) => role === 'ilmiy' || role === 'admin';

export const canSendSsv = (m: Monograph, role: SciRole): boolean =>
  isIlmiy(role) && m.status !== 'rejected' && m.prorektorSigned && !m.ssvSent;

export const canReceiveSsv = (m: Monograph, role: SciRole): boolean =>
  isIlmiy(role) && m.status !== 'rejected' && m.ssvSent && !m.ssvReceived;

export const canTeacherFill = (m: Monograph, role: SciRole): boolean =>
  (role === 'teacher' || role === 'admin') &&
  m.status !== 'rejected' &&
  m.ssvReceived &&
  !m.teacherConfirmed;

export const canReviewData = (m: Monograph, role: SciRole): boolean =>
  isIlmiy(role) && m.status !== 'rejected' && m.teacherConfirmed && !m.dataApproved;

export const canEditMonograph = (m: Monograph, role: SciRole): boolean =>
  (role === 'teacher' || role === 'admin') &&
  m.status === 'new' &&
  !m.ilmiyApproved;

export const canResubmitMonograph = (m: Monograph, role: SciRole): boolean =>
  (role === 'teacher' || role === 'admin') && m.status === 'rejected';
