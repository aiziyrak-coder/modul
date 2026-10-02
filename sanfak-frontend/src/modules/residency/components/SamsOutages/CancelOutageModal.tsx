import { useRef, useState } from 'react';
import { App } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import Modal, { ModalBody, ModalFooter } from '../common/Modal';
import { Btn } from '../common/FormElements';
import { OutageReasonField } from '../SamsOutageModal/OutageFields';
import { useCancelSamsOutage } from '../../api/sams-status-api';
import type { SamsOutage } from '../../api/sams-status-types';
import { validateOutageReason } from '../../lib/sams-outage-draft';
import { formatDayKey } from '../../lib/uz-day';

interface Props {
  outage: SamsOutage;
  onClose: () => void;
}

function useCancel(outage: SamsOutage, onClose: () => void) {
  const { message } = App.useApp();
  const cancel = useCancelSamsOutage();
  const [reason, setReason] = useState('');
  const inFlight = useRef(false);
  const error = validateOutageReason(reason);

  const submit = async () => {
    if (inFlight.current || error) return;
    inFlight.current = true;
    try {
      await cancel.mutateAsync({ id: outage.id, reason });
      message.success('Uzilish oynasi bekor qilindi');
      onClose();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Uzilish oynasini bekor qilib bo‘lmadi'));
    } finally {
      inFlight.current = false;
    }
  };

  return { reason, setReason, error, submit, pending: cancel.isPending };
}

export default function CancelOutageModal({ outage, onClose }: Props) {
  const { reason, setReason, error, submit, pending } = useCancel(outage, onClose);

  return (
    <Modal
      open
      onClose={pending ? () => undefined : onClose}
      title="Uzilish oynasini bekor qilish"
      width="520px"
    >
      <ModalBody>
        <p style={{ margin: '0 0 8px', fontSize: 13 }}>
          <b>
            {formatDayKey(outage.from)} – {formatDayKey(outage.to)}
          </b>{' '}
          · {outage.orgTitle ?? outage.dbname ?? 'Barcha klinikalar'}
        </p>
        <p style={{ margin: '0 0 12px', fontSize: 13 }}>
          Bekor qilinsa, bu kunlar yana o‘lchangan hisoblanadi va sababsiz soatlar SAMS ma’lumoti
          bo‘yicha qayta hisoblanishi mumkin.
        </p>
        <OutageReasonField label="Bekor qilish sababi" value={reason} onChange={setReason} />
      </ModalBody>
      <ModalFooter>
        <Btn $variant="ghost" disabled={pending} onClick={onClose}>
          Yopish
        </Btn>
        <Btn $variant="danger" disabled={pending || error !== null} onClick={() => void submit()}>
          Bekor qilish
        </Btn>
      </ModalFooter>
    </Modal>
  );
}
