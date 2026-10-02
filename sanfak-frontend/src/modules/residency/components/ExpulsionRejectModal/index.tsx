import { useState } from 'react';
import { Textarea } from '@/shared/ui';
import Modal, { ModalBody, ModalFooter } from '../common/Modal';
import { Btn, HelperText } from '../common/FormElements';
import { REJECT_REASON_MAX, validateRejectReason } from '../../lib/sign-input';

interface Props {
  residentName: string;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (reason: string) => Promise<void>;
}

export default function ExpulsionRejectModal({ residentName, pending, onCancel, onSubmit }: Props) {
  const [reason, setReason] = useState('');
  const error = validateRejectReason(reason);
  const length = reason.trim().length;

  return (
    <Modal open onClose={pending ? () => undefined : onCancel} title="Loyihani rad etish" width="520px">
      <ModalBody>
        <p style={{ margin: '0 0 12px', fontSize: 13 }}>
          <b>{residentName}</b> uchun chetlatish buyrug‘i loyihasi rad etiladi. Rezident holati
          o‘zgarmaydi.
        </p>
        <Textarea
          label="Rad etish sababi"
          aria-label="Rad etish sababi"
          rows={5}
          value={reason}
          onChange={setReason}
          status={reason && error ? 'error' : undefined}
        />
        <HelperText $error={Boolean(reason && error)}>
          {reason && error ? `${error} · ` : ''}
          {length}/{REJECT_REASON_MAX}
        </HelperText>
      </ModalBody>
      <ModalFooter>
        <Btn $variant="ghost" disabled={pending} onClick={onCancel}>
          Bekor qilish
        </Btn>
        <Btn $variant="danger" disabled={pending || error !== null} onClick={() => void onSubmit(reason)}>
          Loyihani rad etish
        </Btn>
      </ModalFooter>
    </Modal>
  );
}
