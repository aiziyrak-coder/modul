import { useMemo, useState } from 'react';
import styled from 'styled-components';
import { MdVisibility, MdCheck, MdClose } from '../../icons';
import { App, Input, Select, Textarea } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import {
  FilterBar,
  Btn,
  StatCards,
  FormGroup,
  Label,
  SectionTitle,
} from '../common/FormElements';
import { TableWrap, Table, Th, Td, Tr } from '../common/Table';
import Badge from '../common/Badge';
import StatCard from '../common/StatCard';
import Modal, { ModalBody, ModalFooter } from '../common/Modal';
import { useAcademicYears, withCurrent } from '../../api/reference-api';
import type { PlanHooks } from '../../api/plan-api';
import type { PlanKind, WorkPlan } from '../../api/plan-types';
import { STATUS_LABEL, STATUS_VARIANT } from './planStatus';
import { normalizeSearch } from '../../lib/use-debounced';
import { usePermission, useSessionStore } from '@/app/session';
import OpenLessons from '../OpenLessons';

const fmtDate = (s: string | null) => (s ? s.slice(0, 10) : '—');

const Hint = styled.div`
  margin-top: 4px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const LateNote = styled.div`
  margin-top: 2px;
  font-size: 11px;
  font-weight: 500;
  color: #f39c12;
`;

const APPROVAL_ROLES: { role: string; label: string }[] = [
  { role: 'magistratura_bolim', label: 'Xodim' },
  { role: 'ilmiy_rahbar', label: 'Ilmiy rahbar' },
  { role: 'kafedra_mudiri', label: 'Kafedra' },
];
const labelFor = (role: string) =>
  APPROVAL_ROLES.find((r) => r.role === role)?.label ?? role;
const ERI_KEYS = [
  { value: 'token', label: 'Token USB' },
  { value: 'mobil', label: 'Mobil imzo' },
  { value: 'cloud', label: 'Cloud imzo' },
];
const catLabel = (kind: PlanKind, value: string) =>
  kind.categories.find((c) => c.value === value)?.label ?? value;

const SignRow = styled.div`
  display: flex;
  gap: 4px;
`;
const Chip = styled.span<{ $on?: boolean }>`
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 9999px;
  border: 1px solid ${({ $on }) => ($on ? '#A9DFBF' : '#E8ECEF')};
  background: ${({ $on }) => ($on ? '#EAFAF1' : '#F4F6F9')};
  color: ${({ $on }) => ($on ? '#27AE60' : '#BDC3C7')};
  white-space: nowrap;
`;

export default function PlanReviewView({ hooks, kind }: { hooks: PlanHooks; kind: PlanKind }) {
  const { message } = App.useApp();
  const [search, setSearch] = useState('');
  const [year, setYear] = useState('');
  const [status, setStatus] = useState('');
  const [eriFor, setEriFor] = useState<WorkPlan | null>(null);
  const [eriKey, setEriKey] = useState('token');
  const [rejectFor, setRejectFor] = useState<WorkPlan | null>(null);
  const [reason, setReason] = useState('');
  const [viewing, setViewing] = useState<WorkPlan | null>(null);

  const can = usePermission();
  const canAssignOpenLesson = can('residencyOpenLesson:create');

  const canDecide = can(`${kind.section}:approve`);
  const myRoles = useSessionStore((st) => st.user?.roles);
  const signedByMe = (p: WorkPlan) => {
    if (!myRoles?.length) return false;
    const mine = new Set(myRoles.map((r) => r.name));
    return p.approvals.some((a) => mine.has(a.role));
  };

  const { data: academicYears = [] } = useAcademicYears();

  const { data: plans = [], isFetching } = hooks.usePlans({
    academicYear: year || undefined,
    status: status || undefined,
  });
  const { data: stats } = hooks.useStats();
  const approveM = hooks.useApprove();
  const rejectM = hooks.useReject();
  const reviewM = hooks.useReviewProof();

  const rows = useMemo(() => {
    const q = normalizeSearch(search).toLowerCase();
    return q ? plans.filter((p) => (p.resident?.fullName ?? '').toLowerCase().includes(q)) : plans;
  }, [plans, search]);

  const hasFilter = !!(normalizeSearch(search) || year || status);

  const doApprove = async () => {
    if (!eriFor) return;
    try {
      const r = await approveM.mutateAsync({ id: eriFor.id, eriKey });
      const s = (r as { status?: string })?.status;
      message.success(s === 'jarayonda' ? 'Tasdiqlandi — reja jarayonda' : 'Imzo qo‘yildi');
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Xatolik'));
    }
    setEriFor(null);
  };

  const doReject = async () => {
    if (!rejectFor || !reason.trim()) {
      message.warning('Sabab kiriting');
      return;
    }
    try {
      await rejectM.mutateAsync({ id: rejectFor.id, reason: reason.trim() });
      message.success('Qaytarildi');
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Xatolik'));
    }
    setRejectFor(null);
    setReason('');
  };

  const [proofReject, setProofReject] = useState<{ taskIndex: number; proofIndex: number } | null>(
    null,
  );
  const [proofReason, setProofReason] = useState('');

  const approveProof = async (taskIndex: number, proofIndex: number) => {
    if (!viewing) return;
    try {
      await reviewM.mutateAsync({ id: viewing.id, taskIndex, proofIndex, decision: 'approved' });
      message.success('Tasdiqlandi');
      setViewing(null);
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Xatolik'));
    }
  };

  const confirmRejectProof = async () => {
    if (!viewing || !proofReject || !proofReason.trim()) return;
    try {
      await reviewM.mutateAsync({
        id: viewing.id,
        ...proofReject,
        decision: 'rejected',
        comment: proofReason.trim(),
      });
      message.success('Qaytarildi');
      setProofReject(null);
      setProofReason('');
      setViewing(null);
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Xatolik'));
    }
  };

  return (
    <div>
      <StatCards>
        <StatCard icon="📤" iconBg="#EBF5FB" number={stats?.yuborilgan ?? 0} label="Yuborilgan" />
        <StatCard icon="⏳" iconBg="#FEF9E7" number={stats?.jarayonda ?? 0} label="Jarayonda" />
        <StatCard icon="✅" iconBg="#EAFAF1" number={stats?.bajarilgan ?? 0} label="Bajarilgan" />
        <StatCard icon="📄" iconBg="#F4F6F9" number={stats?.total ?? 0} label="Jami" />
      </StatCards>

      <FilterBar>
        <Input
          placeholder="F.I.Sh qidirish..."
          value={search}
          style={{ width: 'auto', minWidth: 200 }}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          value={year}
          style={{ width: 'auto', minWidth: 200 }}
          onChange={(value) => setYear(value)}
          options={[
            { value: '', label: 'O‘quv yili — barchasi' },
            ...withCurrent(academicYears, year).map((y) => ({
              value: y.id,
              label: y.title,
            })),
          ]}
        />
        <Select
          value={status}
          style={{ width: 'auto', minWidth: 150 }}
          onChange={(value) => setStatus(value)}
          options={[
            { value: '', label: 'Barcha holat' },
            ...Object.entries(STATUS_LABEL).map(([k, v]) => ({ value: k, label: v })),
          ]}
        />
      </FilterBar>

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th style={{ width: 40 }}>#</Th>
              <Th>F.I.Sh</Th>
              <Th>Mutaxassislik</Th>
              <Th>Nomi</Th>
              <Th>Imzolar</Th>
              <Th>Status</Th>
              <Th style={{ width: 150 }}>Amallar</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => {
              const signed = new Set(p.approvals.map((a) => a.role));
              return (
                <Tr key={p.id}>
                  <Td>{i + 1}</Td>
                  <Td>{p.resident?.fullName || '—'}</Td>
                  <Td>{p.resident?.specialtyTitle || '—'}</Td>
                  <Td>{p.title}</Td>
                  <Td>
                    <SignRow>
                      {APPROVAL_ROLES.map((r) => (
                        <Chip key={r.role} $on={signed.has(r.role)} title={labelFor(r.role)}>
                          {labelFor(r.role)}
                        </Chip>
                      ))}
                    </SignRow>
                  </Td>
                  <Td>
                    <Badge variant={STATUS_VARIANT[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                  </Td>
                  <Td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <Btn $variant="ghost" $size="sm" onClick={() => setViewing(p)} title="Ko‘rish">
                        <MdVisibility />
                      </Btn>
                      {canDecide && p.status === 'yuborilgan' && (
                        <>

                          <Btn
                            $variant="ghost"
                            $size="sm"
                            disabled={signedByMe(p)}
                            onClick={() => setEriFor(p)}
                            title={
                              signedByMe(p)
                                ? 'Siz bu rejani allaqachon imzolagansiz'
                                : 'Tasdiqlash'
                            }
                          >
                            <MdCheck />
                          </Btn>
                          <Btn $variant="ghost" $size="sm" onClick={() => setRejectFor(p)} title="Qaytarish">
                            <MdClose />
                          </Btn>
                        </>
                      )}
                    </div>
                  </Td>
                </Tr>
              );
            })}
            {rows.length === 0 && (
              <Tr>
                <Td colSpan={7} style={{ textAlign: 'center', color: '#7F8C8D', padding: 32 }}>
                  {isFetching
                    ? 'Yuklanmoqda…'
                    : hasFilter
                      ? 'Filtrga mos reja topilmadi'
                      : 'Reja topilmadi'}
                </Td>
              </Tr>
            )}
          </tbody>
        </Table>
      </TableWrap>

      <Modal open={!!eriFor} onClose={() => setEriFor(null)} title="Rejani tasdiqlash" width="420px">
        <ModalBody>
          <div style={{ fontSize: 13, marginBottom: 12 }}>
            <b>{eriFor?.title}</b> — {eriFor?.resident?.fullName}
          </div>
          <FormGroup>
            <Label>ERI kaliti</Label>
            <Select
              value={eriKey}
              style={{ width: '100%' }}
              disabled
              onChange={(value) => setEriKey(value)}
              options={ERI_KEYS}
            />
            <div style={{ fontSize: 11, color: '#7F8C8D', marginTop: 4 }}>
              ERI imzolash keyingi fazada qo&apos;shiladi
            </div>
          </FormGroup>
          <div style={{ fontSize: 11, color: '#7F8C8D' }}>
            3 rol (xodim, ilmiy rahbar, kafedra mudiri) imzolaganda reja “jarayonda” bo‘ladi.
          </div>
        </ModalBody>
        <ModalFooter>
          <Btn $variant="ghost" onClick={() => setEriFor(null)}>
            Bekor
          </Btn>
          <Btn $variant="success" onClick={doApprove} disabled={approveM.isPending}>
            <MdCheck /> Tasdiqlash
          </Btn>
        </ModalFooter>
      </Modal>

      <Modal open={!!rejectFor} onClose={() => setRejectFor(null)} title="Rejani qaytarish" width="420px">
        <ModalBody>
          <FormGroup>
            <Label>Qaytarish sababi *</Label>
            <Textarea rows={3} value={reason} onChange={(v) => setReason(v)} />
          </FormGroup>
        </ModalBody>
        <ModalFooter>
          <Btn $variant="ghost" onClick={() => setRejectFor(null)}>
            Bekor
          </Btn>
          <Btn $variant="danger" onClick={doReject} disabled={rejectM.isPending}>
            Qaytarish
          </Btn>
        </ModalFooter>
      </Modal>

      <Modal
        open={!!proofReject}
        onClose={() => {
          setProofReject(null);
          setProofReason('');
        }}
        title="Bajaruvni qaytarish"
        width="420px"
      >
        <ModalBody>
          <FormGroup>
            <Label>Qaytarish sababi *</Label>
            <Textarea rows={3} value={proofReason} onChange={(v) => setProofReason(v)} />
            <Hint>Talaba bu matnni bildirishnomada ko'radi.</Hint>
          </FormGroup>
        </ModalBody>
        <ModalFooter>
          <Btn
            $variant="ghost"
            onClick={() => {
              setProofReject(null);
              setProofReason('');
            }}
          >
            Bekor
          </Btn>
          <Btn
            $variant="danger"
            onClick={confirmRejectProof}
            disabled={!proofReason.trim() || reviewM.isPending}
          >
            Qaytarish
          </Btn>
        </ModalFooter>
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.title || ''} width="940px">
        {viewing && (
          <ModalBody>
            {viewing.tasks.length === 0 && <div style={{ color: '#7F8C8D' }}>Vazifa yo‘q</div>}
            {viewing.tasks.map((t, ti) => (
              <div key={ti} style={{ marginBottom: 14 }}>
                <SectionTitle style={{ marginBottom: 6 }}>
                  {catLabel(kind, t.category)} — {t.title} ({t.proofs.filter((p) => p.status === 'approved').length}/
                  {t.targetCount})
                </SectionTitle>
                {t.proofs.length === 0 && (
                  <div style={{ fontSize: 12, color: '#BDC3C7' }}>Bajaruv yo‘q</div>
                )}
                {t.proofs.map((p, pi) => (
                  <div
                    key={pi}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 0',
                      borderBottom: '1px solid #F0F0F0',
                    }}
                  >
                    <Badge
                      variant={p.status === 'approved' ? 'bajarildi' : p.status === 'rejected' ? 'rad etilgan' : 'kutilmoqda'}
                    >
                      {p.status === 'approved' ? 'Tasdiqlangan' : p.status === 'rejected' ? 'Qaytarilgan' : 'Kutilmoqda'}
                    </Badge>
                    <span style={{ flex: 1, fontSize: 12 }}>
                      {p.comment || p.url || p.fileUrl || '—'}
                      {p.lateUpload && (
                        <LateNote>
                          ⚠️ Kechikib yuklangan
                          {p.workDate ? ` — ish sanasi: ${fmtDate(p.workDate)}` : ''}
                        </LateNote>
                      )}
                    </span>
                    {canDecide && viewing.status === 'jarayonda' && p.status === 'pending' && (
                      <>
                        <Btn
                          $variant="success"
                          $size="sm"
                          title="Bajaruvni tasdiqlash"
                          aria-label="Bajaruvni tasdiqlash"
                          onClick={() => approveProof(ti, pi)}
                          disabled={reviewM.isPending}
                        >
                          <MdCheck />
                        </Btn>
                        <Btn
                          $variant="danger"
                          $size="sm"
                          title="Bajaruvni qaytarish"
                          aria-label="Bajaruvni qaytarish"
                          onClick={() => setProofReject({ taskIndex: ti, proofIndex: pi })}
                          disabled={reviewM.isPending}
                        >
                          <MdClose />
                        </Btn>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ))}

            <OpenLessons
              residentId={viewing.residentId}
              planId={viewing.id}
              planKind={kind.planKind}
              taskTitles={viewing.tasks.map((t) => t.title)}
              canAssign={canAssignOpenLesson}
            />
          </ModalBody>
        )}
        <ModalFooter>
          <Btn $variant="ghost" onClick={() => setViewing(null)}>
            Yopish
          </Btn>
        </ModalFooter>
      </Modal>
    </div>
  );
}
