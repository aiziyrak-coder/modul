import { useState } from 'react';
import { App, Input } from '@/shared/ui';
import Modal, { ModalBody, ModalFooter } from '../../common/Modal';
import { Btn, FormGroup, HelperText, Label } from '../../common/FormElements';
import { sessionErrorInfo, useCancelSession } from '../../../api/session-api';
import { CANCEL_REASON, type LessonSession } from '../../../api/session-types';
import { lessonLabel } from '../../../lib/lesson-type';
import { formatDayKey } from '../../../lib/uz-day';

function ReasonField({ reason, onChange }: { reason: string; onChange: (v: string) => void }) {
  return (
    <FormGroup>
      <Label htmlFor="session-cancel-reason">Sabab *</Label>
      <Input.TextArea
        id="session-cancel-reason"
        value={reason}
        maxLength={CANCEL_REASON.max}
        showCount
        rows={3}
        onChange={(e) => onChange(e.target.value)}
      />
      <HelperText>
        Kun yopilguncha bekor qilish mumkin. Rezidentlar ro‘yxatdan chiqariladi; kerak bo‘lsa
        mashg‘ulotni qayta e’lon qiling.
      </HelperText>
    </FormGroup>
  );
}

export default function CancelSessionModal({
  session,
  onClose,
}: {
  session: LessonSession;
  onClose: () => void;
}) {
  const { message } = App.useApp();
  const cancelM = useCancelSession();
  const [reason, setReason] = useState('');
  const trimmed = reason.trim().length;
  const valid = trimmed >= CANCEL_REASON.min && trimmed <= CANCEL_REASON.max;

  const submit = async () => {
    try {
      await cancelM.mutateAsync({ id: session.id, reason });
      message.success('Mashg‘ulot bekor qilindi');
      onClose();
    } catch (e) {
      message.error(sessionErrorInfo(e, 'Bekor qilishda xatolik').message);
    }
  };

  return (
    <Modal open onClose={onClose} title="Mashg‘ulotni bekor qilish" width="480px">
      <ModalBody>
        <p style={{ marginTop: 0, fontSize: 13 }}>
          {formatDayKey(session.day)} · {session.scienceTitle ?? '—'} ·{' '}
          {lessonLabel(session.lessonType)} · {session.groupTitle ?? '—'}
        </p>
        <ReasonField reason={reason} onChange={setReason} />
      </ModalBody>
      <ModalFooter>
        <Btn $variant="ghost" disabled={cancelM.isPending} onClick={onClose}>
          Yopish
        </Btn>
        <Btn $variant="danger" disabled={!valid || cancelM.isPending} onClick={() => void submit()}>
          Bekor qilishni tasdiqlash
        </Btn>
      </ModalFooter>
    </Modal>
  );
}
