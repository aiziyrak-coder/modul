import { useState } from 'react';
import styled from 'styled-components';
import { App, DatePicker, Select, Textarea } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { MdAdd, MdVisibility, MdCheck, MdClose } from '../icons';
import {
  PageTitle,
  FilterBar,
  Btn,
  FormGroup,
  Label,
  StatCards,
} from '../components/common/FormElements';
import { TableWrap, Table, Th, Td, Tr } from '../components/common/Table';
import Badge from '../components/common/Badge';
import Pager from '../components/common/Pager';
import StatCard from '../components/common/StatCard';
import FileUpload from '../components/common/FileUpload';
import TruncCell from '../components/common/TruncCell';
import Modal, { ModalBody, ModalFooter } from '../components/common/Modal';
import { useResidencyCapabilities } from '../lib/capabilities';
import {
  useApplications,
  useApplicationStats,
  useCreateApplication,
  useReviewApplication,
} from '../api/residency-api';
import type { Application, ApplicationStatus, ApplicationType } from '../api/types';

const PAGE_SIZE = 10;

const TYPE_LABEL: Record<ApplicationType, string> = {
  academic_leave: 'Akademik ta’til',
  attestation_postpone: 'Attestatsiya muddatini ko‘chirish',
  conference: 'Konferentsiyaga ruxsat',
  reference: 'Ma’lumotnoma olish',
  schedule_change: 'Jadval o‘zgarishi',
  other: 'Boshqa',
};
const STATUS_LABEL: Record<ApplicationStatus, string> = {
  yangi: 'Yangi',
  korib_chiqilmoqda: 'Ko‘rib chiqilmoqda',
  tasdiqlangan: 'Tasdiqlangan',
  rad_etilgan: 'Rad etilgan',
};
const STATUS_VARIANT: Record<ApplicationStatus, string> = {
  yangi: 'yangi',
  korib_chiqilmoqda: 'ko‘rib chiqilmoqda',
  tasdiqlangan: 'tasdiqlangan',
  rad_etilgan: 'rad etilgan',
};

const WarnNote = styled.div`
  margin-top: 10px;
  border-radius: ${({ theme }) => theme.radius.md};
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.5;
  background: ${({ theme }) => theme.colors.warningLight};
  border: 1px solid ${({ theme }) => theme.colors.warningBorder};
  color: ${({ theme }) => theme.colors.warning};
`;

export default function Arizalar() {
  const { message } = App.useApp();

  const { isStudent, canDecideApplication: isAdmin } = useResidencyCapabilities();

  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [decision, setDecision] = useState<Application | null>(null);

  const { data: stats } = useApplicationStats({ type: type || undefined });
  const { data: paged, isFetching } = useApplications({
    status: status || undefined,
    type: type || undefined,
    page,
    limit: PAGE_SIZE,
  });
  const createM = useCreateApplication();
  const reviewM = useReviewApplication();

  const rows = paged?.items ?? [];
  const totalPages = Math.max(1, paged?.totalPages ?? 1);
  const hasFilter = !!(status || type);

  return (
    <div>
      <PageTitle>Arizalar</PageTitle>

      <StatCards>
        <StatCard icon="📄" iconBg="#EBF5FB" number={stats?.total ?? 0} label="Jami arizalar" />
        <StatCard icon="⏳" iconBg="#FEF9E7" number={stats?.pending ?? 0} label="Kutilmoqda" />
        <StatCard icon="✅" iconBg="#EAFAF1" number={stats?.tasdiqlangan ?? 0} label="Tasdiqlangan" />
        <StatCard icon="❌" iconBg="#FDEDEC" number={stats?.rad_etilgan ?? 0} label="Rad etilgan" />
      </StatCards>

      <FilterBar>
        <Select
          value={status}
          style={{ width: 'auto', minWidth: 150 }}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          options={[
            { value: '', label: 'Barcha holat' },
            ...Object.entries(STATUS_LABEL).map(([k, v]) => ({ value: k, label: v })),
          ]}
        />
        <Select
          value={type}
          style={{ width: 'auto', minWidth: 150 }}
          onChange={(value) => {
            setType(value);
            setPage(1);
          }}
          options={[
            { value: '', label: 'Barcha tur' },
            ...Object.entries(TYPE_LABEL).map(([k, v]) => ({ value: k, label: v })),
          ]}
        />
        {isStudent && (
          <div style={{ marginLeft: 'auto' }}>
            <Btn $variant="primary" onClick={() => setCreateOpen(true)}>
              <MdAdd /> Ariza yaratish
            </Btn>
          </div>
        )}
      </FilterBar>

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th style={{ width: 48 }}>#</Th>
              {!isStudent && <Th>Rezident</Th>}
              <Th>Ariza turi</Th>
              <Th>Sabab</Th>
              <Th>Bo‘lim izohi</Th>
              <Th>Holat</Th>
              {isAdmin && <Th style={{ width: 150 }}>Amallar</Th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((a, i) => (
              <Tr key={a.id}>
                <Td>{i + 1}</Td>
                {!isStudent && <Td>{a.resident?.fullName || '—'}</Td>}
                <Td>{TYPE_LABEL[a.type]}</Td>
                <Td>
                  <TruncCell text={a.reason ?? ''} />
                </Td>
                <Td>
                  <TruncCell text={a.comment ?? ''} blue />
                </Td>
                <Td>
                  <Badge variant={STATUS_VARIANT[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                </Td>
                {isAdmin && (
                  <Td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <Btn
                        $variant="ghost"
                        $size="sm"
                        onClick={() => setDecision(a)}
                        title={
                          a.status === 'yangi' || a.status === 'korib_chiqilmoqda'
                            ? 'Ko‘rib chiqish'
                            : 'Batafsil ko‘rish'
                        }
                      >
                        <MdVisibility />
                      </Btn>
                    </div>
                  </Td>
                )}
              </Tr>
            ))}
            {rows.length === 0 && (
              <Tr>
                <Td colSpan={isStudent ? 5 : isAdmin ? 7 : 6} style={{ textAlign: 'center', color: '#7F8C8D', padding: 32 }}>
                  {isFetching
                    ? 'Yuklanmoqda…'
                    : hasFilter
                      ? 'Filtrga mos ariza topilmadi'
                      : 'Ariza topilmadi'}
                </Td>
              </Tr>
            )}
          </tbody>
        </Table>
      </TableWrap>

      <Pager page={page} totalPages={totalPages} onPage={setPage} />

      {isStudent && (
        <CreateApplicationModal
          key={createOpen ? 'open' : 'closed'}
          open={createOpen}
          onClose={() => { if (!createM.isPending) setCreateOpen(false); }}
          onSubmit={async (payload) => {
            try {
              await createM.mutateAsync(payload);
              message.success('Ariza yuborildi');
              setCreateOpen(false);
            } catch (e) {
              message.error(getApiErrorMessage(e, 'Yuborishda xatolik'));
            }
          }}
          pending={createM.isPending}
        />
      )}

      {isAdmin && (
        <DecisionModal
          key={decision?.id ?? 'closed'}
          application={decision}
          onClose={() => setDecision(null)}
          onDecide={async (data) => {
            if (!decision) return;
            try {
              await reviewM.mutateAsync({ id: decision.id, data });
              message.success('Qaror saqlandi');
              setDecision(null);
            } catch (e) {
              message.error(getApiErrorMessage(e, 'Xatolik'));
            }
          }}
          pending={reviewM.isPending}
        />
      )}
    </div>
  );
}

function CreateApplicationModal({
  open,
  onClose,
  onSubmit,
  pending,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (p: { type: ApplicationType; reason: string; file: File | null }) => void;
  pending: boolean;
}) {
  const [type, setType] = useState<ApplicationType>('academic_leave');
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);
  return (
    <Modal open={open} onClose={onClose} title="Ariza yaratish">
      <ModalBody>
        <FormGroup>
          <Label>Ariza turi</Label>
          <Select<ApplicationType>
            value={type}
            style={{ width: '100%' }}
            onChange={(value) => setType(value)}
            options={(Object.entries(TYPE_LABEL) as Array<[ApplicationType, string]>).map(
              ([k, v]) => ({ value: k, label: v }),
            )}
          />
        </FormGroup>
        <FormGroup>
          <Label>Sabab *</Label>
          <Textarea
            rows={3}
            value={reason}
            maxLength={2000}
            showCount
            onChange={(v) => setReason(v)}
            placeholder="Ariza sababini yozing..."
          />
        </FormGroup>
        <FormGroup>
          <Label>Hujjat (ixtiyoriy)</Label>
          <FileUpload accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={setFile} />
        </FormGroup>
      </ModalBody>
      <ModalFooter>
        <Btn $variant="ghost" onClick={onClose} disabled={pending}>
          Bekor qilish
        </Btn>
        <Btn
          $variant="primary"
          disabled={pending || !reason.trim()}
          onClick={() => onSubmit({ type, reason: reason.trim(), file })}
        >
          Yuborish
        </Btn>
      </ModalFooter>
    </Modal>
  );
}

function DecisionModal({
  application,
  onClose,
  onDecide,
  pending,
}: {
  application: Application | null;
  onClose: () => void;
  onDecide: (d: { status: 'tasdiqlangan' | 'rad_etilgan'; comment?: string; fromDate?: string; toDate?: string }) => void;
  pending: boolean;
}) {
  const { message } = App.useApp();

  const [comment, setComment] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const decided = !!application && application.status !== 'yangi' && application.status !== 'korib_chiqilmoqda';

  const [noRangeAck, setNoRangeAck] = useState(false);
  const rangeEmpty = !fromDate && !toDate;
  const rangeHalf = !fromDate !== !toDate;

  const approve = () => {
    if (rangeHalf) {
      message.warning('Sababli oralig‘i uchun ikkala sanani ham to‘ldiring');
      return;
    }
    if (rangeEmpty && !noRangeAck) {
      setNoRangeAck(true);
      return;
    }
    onDecide({
      status: 'tasdiqlangan',
      comment: comment || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    });
  };

  return (
    <Modal open={!!application} onClose={onClose} title="Arizani ko‘rib chiqish" width="480px">
      {application && (
        <ModalBody>
          <div style={{ marginBottom: 14, fontSize: 13 }}>
            <div>
              <b>Rezident:</b> {application.resident?.fullName || '—'}
            </div>
            <div>
              <b>Turi:</b> {TYPE_LABEL[application.type]}
            </div>
            <div>
              <b>Sabab:</b> {application.reason || '—'}
            </div>
            <div>
              <b>Hujjat:</b>{' '}
              {application.fileUrl ? (
                <a href={application.fileUrl} target="_blank" rel="noreferrer">
                  Hujjatni ochish
                </a>
              ) : (
                <span style={{ color: '#7F8C8D' }}>biriktirilmagan</span>
              )}
            </div>
          </div>
          <FormGroup>
            <Label>{decided ? 'Izoh' : 'Izoh (rad etish uchun majburiy)'}</Label>
            <Textarea
              rows={3}
              value={comment}
              maxLength={2000}
              showCount
              onChange={(v) => setComment(v)}
              disabled={decided}
            />
          </FormGroup>
          <div style={{ display: 'flex', gap: 12 }}>
            <FormGroup style={{ flex: 1 }}>
              <Label>Sababli: dan</Label>
              <DatePicker value={fromDate || null} onChange={(v) => setFromDate(v ?? '')} />
            </FormGroup>
            <FormGroup style={{ flex: 1 }}>
              <Label>gacha</Label>
              <DatePicker value={toDate || null} onChange={(v) => setToDate(v ?? '')} />
            </FormGroup>
          </div>
          <div style={{ fontSize: 11, color: '#7F8C8D' }}>
            Sana oralig‘i to‘ldirilsa, tasdiqlashda o‘sha davrdagi davomat “sababli” bo‘ladi.
          </div>
          {noRangeAck && rangeEmpty && (
            <WarnNote role="alert">
              <b>Sana oralig‘i to‘ldirilmadi.</b> Ariza tasdiqlanadi, lekin talabaning
              davomatidagi “kelmadi” yozuvlari <b>o‘zgarmaydi</b>. Agar bu ariza qoldirilgan
              kunlarni oqlashi kerak bo‘lsa — yuqoridagi ikkala sanani to‘ldiring.
              Aks holda “Baribir tasdiqlash”ni bosing.
            </WarnNote>
          )}
        </ModalBody>
      )}
      <ModalFooter>
        {decided ? (
          <Btn $variant="ghost" onClick={onClose}>
            Yopish
          </Btn>
        ) : (
          <>
            <Btn
              $variant="danger"
              disabled={pending || !comment.trim()}
              onClick={() => onDecide({ status: 'rad_etilgan', comment: comment.trim() })}
            >
              <MdClose /> Rad etish
            </Btn>
            <Btn $variant="success" disabled={pending} onClick={approve}>
              <MdCheck /> {noRangeAck && rangeEmpty ? 'Baribir tasdiqlash' : 'Tasdiqlash'}
            </Btn>
          </>
        )}
      </ModalFooter>
    </Modal>
  );
}
