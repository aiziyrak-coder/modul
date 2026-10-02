import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { MdArrowBack, MdCheck, MdClose } from '../icons';
import { App, Textarea } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { PageTitle, Btn, FormGroup, Label } from '../components/common/FormElements';
import QueryNotice from '../components/common/QueryNotice';
import { combineState } from '../lib/query-state';
import { TableWrap, Table, Th, Td, Tr } from '../components/common/Table';
import Badge from '../components/common/Badge';

import { skillsText } from '../lib/skills';
import TruncCell from '../components/common/TruncCell';
import Modal, { ModalBody, ModalFooter } from '../components/common/Modal';
import { useResidencyCapabilities } from '../lib/capabilities';
import { useDailyLogsByResident, useApproveDailyLog, useReturnDailyLog } from '../api/residency-api';
import type { DailyLog, DailyLogStatus } from '../api/types';

const STATUS_LABEL: Record<DailyLogStatus, string> = {
  kutilmoqda: 'Kutilmoqda',
  tasdiqlangan: 'Tasdiqlangan',
  qaytarilgan: 'Qaytarilgan',
};
const fmtDate = (d: string | null) => (d ? d.slice(0, 10) : '—');

const MetaBlock = styled.div`
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
  background: ${({ theme }) => theme.colors.white};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 14px;
  padding: 16px 20px;
  margin-bottom: 20px;
`;
const MetaItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;
const MetaLabel = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textMuted};
  text-transform: uppercase;
  letter-spacing: 0.4px;
`;
const MetaValue = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

export default function KundalikDetail() {
  const { message } = App.useApp();
  const { residentId } = useParams<{ residentId: string }>();
  const navigate = useNavigate();
  const { canApproveDailyLog: isMentor } = useResidencyCapabilities();

  const logsQ = useDailyLogsByResident(residentId);
  const records = logsQ.data ?? [];
  const queryState = combineState([logsQ]);
  const approveM = useApproveDailyLog();
  const returnM = useReturnDailyLog();

  const [approveTarget, setApproveTarget] = useState<DailyLog | null>(null);
  const [returnTarget, setReturnTarget] = useState<DailyLog | null>(null);

  const resident = records[0]?.resident ?? null;
  const name = resident?.fullName ?? '—';

  const doApprove = async (comment: string) => {
    if (!approveTarget) return;
    try {
      await approveM.mutateAsync({ id: approveTarget.id, comment: comment || undefined });
      message.success('Yozuv tasdiqlandi');
      setApproveTarget(null);
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Xatolik'));
    }
  };
  const doReturn = async (reason: string) => {
    if (!returnTarget) return;
    try {
      await returnM.mutateAsync({ id: returnTarget.id, reason });
      message.success('Yozuv qaytarildi');
      setReturnTarget(null);
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Xatolik'));
    }
  };

  return (
    <div>
      <Btn $variant="ghost" onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>
        <MdArrowBack /> Orqaga
      </Btn>

      <PageTitle style={{ marginBottom: 14 }}>{name} — kundalik yozuvlari</PageTitle>

      {queryState !== 'ok' && (
        <QueryNotice state={queryState} onRetry={() => void logsQ.refetch()} />
      )}

      {resident && (
        <MetaBlock>
          <MetaItem>
            <MetaLabel>Mutaxassislik</MetaLabel>
            <MetaValue>{resident.specialtyTitle ?? '—'}</MetaValue>
          </MetaItem>
          <MetaItem>
            <MetaLabel>Kafedra</MetaLabel>
            <MetaValue>{resident.departmentTitle ?? '—'}</MetaValue>
          </MetaItem>
          <MetaItem>
            <MetaLabel>Kurs</MetaLabel>
            <MetaValue>{resident.courseNumber != null ? `${resident.courseNumber}-kurs` : '—'}</MetaValue>
          </MetaItem>
          <MetaItem>
            <MetaLabel>Guruh</MetaLabel>
            <MetaValue>{resident.groupTitle ?? '—'}</MetaValue>
          </MetaItem>
          <MetaItem>
            <MetaLabel>Jami yozuvlar</MetaLabel>
            <MetaValue>{records.length} ta</MetaValue>
          </MetaItem>
        </MetaBlock>
      )}

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th style={{ width: 48 }}>№</Th>
              <Th>Sana</Th>
              <Th>Ish turi</Th>
              <Th>Ko‘nikmalar</Th>
              <Th>Holat</Th>
              <Th>Tavsif</Th>
              <Th>Ustoz izohi</Th>
              {isMentor && <Th style={{ width: 120 }}>Amallar</Th>}
            </tr>
          </thead>
          <tbody>
            {records.map((r, i) => (
              <Tr key={r.id}>
                <Td>{i + 1}</Td>
                <Td style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.date)}</Td>
                <Td style={{ fontWeight: 500 }}>{r.workType || '—'}</Td>
                <Td>{skillsText(r.skills) || '—'}</Td>
                <Td>
                  <Badge variant={r.status}>{STATUS_LABEL[r.status]}</Badge>
                </Td>
                <Td>
                  <TruncCell text={r.clinicalWork ?? ''} />
                </Td>
                <Td>
                  <TruncCell text={r.supervisorComment ?? ''} blue />
                </Td>
                {isMentor && (
                  <Td>
                    {r.status === 'kutilmoqda' ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Btn
                          $variant="ghost"
                          $size="sm"
                          title="Tasdiqlash"
                          style={{ color: '#27AE60' }}
                          onClick={() => setApproveTarget(r)}
                        >
                          <MdCheck />
                        </Btn>
                        <Btn
                          $variant="ghost"
                          $size="sm"
                          title="Qaytarish"
                          style={{ color: '#E74C3C' }}
                          onClick={() => setReturnTarget(r)}
                        >
                          <MdClose />
                        </Btn>
                      </div>
                    ) : (
                      <span style={{ color: '#CBD5E1', fontSize: 13 }}>—</span>
                    )}
                  </Td>
                )}
              </Tr>
            ))}
            {records.length === 0 && (
              <Tr>
                <Td
                  colSpan={isMentor ? 8 : 7}
                  style={{ textAlign: 'center', color: '#7F8C8D', padding: 32 }}
                >
                  Yozuvlar topilmadi
                </Td>
              </Tr>
            )}
          </tbody>
        </Table>
      </TableWrap>

      {isMentor && approveTarget && (
        <ApproveLogModal
          target={approveTarget}
          onClose={() => setApproveTarget(null)}
          onConfirm={doApprove}
          pending={approveM.isPending}
        />
      )}
      {isMentor && returnTarget && (
        <ReturnLogModal
          target={returnTarget}
          onClose={() => setReturnTarget(null)}
          onConfirm={doReturn}
          pending={returnM.isPending}
        />
      )}
    </div>
  );
}

function ApproveLogModal({
  target,
  onClose,
  onConfirm,
  pending,
}: {
  target: DailyLog;
  onClose: () => void;
  onConfirm: (comment: string) => void;
  pending: boolean;
}) {
  const [comment, setComment] = useState('');
  return (
    <Modal open onClose={onClose} title="Yozuvni tasdiqlash" width="440px">
      <ModalBody>
        <div
          style={{
            fontSize: 13,
            marginBottom: 14,
            padding: '10px 12px',
            background: '#EAFAF1',
            border: '1px solid #A9DFBF',
            borderRadius: 8,
          }}
        >
          <b>{target.resident?.fullName ?? '—'}</b> — yozuvni tasdiqlayapsiz
        </div>
        <FormGroup>
          <Label>Izoh (ixtiyoriy)</Label>
          <Textarea
            rows={3}
            value={comment}
            onChange={(v) => setComment(v)}
            placeholder="Tasdiqlash bo‘yicha izoh..."
          />
        </FormGroup>
      </ModalBody>
      <ModalFooter>
        <Btn $variant="ghost" onClick={onClose}>
          Bekor qilish
        </Btn>
        <Btn $variant="success" disabled={pending} onClick={() => onConfirm(comment.trim())}>
          <MdCheck /> Tasdiqlash
        </Btn>
      </ModalFooter>
    </Modal>
  );
}

function ReturnLogModal({
  target,
  onClose,
  onConfirm,
  pending,
}: {
  target: DailyLog;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  pending: boolean;
}) {
  const [reason, setReason] = useState('');
  return (
    <Modal open onClose={onClose} title="Yozuvni qaytarish" width="440px">
      <ModalBody>
        <div
          style={{
            fontSize: 13,
            marginBottom: 14,
            padding: '10px 12px',
            background: '#FDEDEC',
            border: '1px solid #F1948A',
            borderRadius: 8,
          }}
        >
          <b>{target.resident?.fullName ?? '—'}</b> — yozuvni qaytarayapsiz
        </div>
        <FormGroup>
          <Label>Qaytarish sababi *</Label>
          <Textarea
            rows={3}
            value={reason}
            onChange={(v) => setReason(v)}
            placeholder="Nima sababdan qaytarilmoqda..."
          />
        </FormGroup>
      </ModalBody>
      <ModalFooter>
        <Btn $variant="ghost" onClick={onClose}>
          Bekor qilish
        </Btn>
        <Btn $variant="danger" disabled={pending || !reason.trim()} onClick={() => onConfirm(reason.trim())}>
          <MdClose /> Qaytarish
        </Btn>
      </ModalFooter>
    </Modal>
  );
}
