import { useState } from 'react';
import { App, Input } from '@/shared/ui';
import Modal, { ModalBody, ModalFooter } from '../common/Modal';
import { Btn, FormGroup, HelperText, Label } from '../common/FormElements';
import { EXCUSE_REASON, useExcuseAbsence } from '../../api/attendance-excuse-api';
import {
  attendanceExcuseErrorText,
  excuseErrorClosesModal,
} from '../../api/attendance-write-error';
import type { Attendance } from '../../api/types';
import { lessonLabel } from '../../lib/lesson-type';

const day = (d: string | null): string => (d ? d.slice(0, 10) : '—');

function ReasonField({ reason, onChange }: { reason: string; onChange: (v: string) => void }) {
  return (
    <FormGroup>
      <Label htmlFor="attendance-excuse-reason">Sabab *</Label>
      <Input.TextArea
        id="attendance-excuse-reason"
        value={reason}
        maxLength={EXCUSE_REASON.max}
        showCount
        rows={3}
        onChange={(e) => onChange(e.target.value)}
      />
      <HelperText>
        Faqat shu dars «Sababli» bo‘ladi va sababsiz soatlardan chiqariladi. 6 soat ogohlantirishi
        va 72 soatlik buyruq loyihasi ostonadan pastga tushsa avtomatik bekor qilinadi. Bu «Keldi»
        emas — dars bahosi qo‘yilmaydi. Tasdiqlangandan keyin tizimda qaytarib bo‘lmaydi. Sabab
        rezidentga ham ko‘rinadi.
      </HelperText>
    </FormGroup>
  );
}

export default function ExcuseAbsenceModal({
  record,
  onClose,
}: {
  record: Attendance;
  onClose: () => void;
}) {
  const { message } = App.useApp();
  const excuseM = useExcuseAbsence();
  const [reason, setReason] = useState('');
  const trimmed = reason.trim().length;
  const valid = trimmed >= EXCUSE_REASON.min && trimmed <= EXCUSE_REASON.max;

  const submit = async () => {
    try {
      await excuseM.mutateAsync({ id: record.id, reason });
      message.success('Dars «Sababli» deb belgilandi');
      onClose();
    } catch (e) {
      message.error(attendanceExcuseErrorText(e));
      if (excuseErrorClosesModal(e)) onClose();
    }
  };

  return (
    <Modal open onClose={onClose} title="Darsni «Sababli» qilish" width="480px">
      <ModalBody>
        <p style={{ marginTop: 0, fontSize: 13 }}>
          {record.resident?.fullName ?? '—'} · {day(record.date)} · {record.scienceTitle ?? '—'} ·{' '}
          {lessonLabel(record.lessonType)} · {record.hours} soat
        </p>
        <ReasonField reason={reason} onChange={setReason} />
      </ModalBody>
      <ModalFooter>
        <Btn $variant="ghost" disabled={excuseM.isPending} onClick={onClose}>
          Yopish
        </Btn>
        <Btn
          $variant="primary"
          disabled={!valid || excuseM.isPending}
          onClick={() => void submit()}
        >
          Sababli deb tasdiqlash
        </Btn>
      </ModalFooter>
    </Modal>
  );
}
