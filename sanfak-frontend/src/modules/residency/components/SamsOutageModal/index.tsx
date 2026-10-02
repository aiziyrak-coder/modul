import { useRef, useState } from 'react';
import { Alert, App, Select } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import Modal, { ModalBody, ModalFooter } from '../common/Modal';
import { Btn, FormGroup, Label } from '../common/FormElements';
import { OutageDateFields, OutageReasonField } from './OutageFields';
import { useCreateSamsOutage } from '../../api/sams-status-api';
import type { SamsDay, SamsOutageDraft } from '../../api/sams-status-types';
import {
  OUTAGE_ALL_CLINICS,
  outageScopeLabel,
  outageSpanDays,
  validateOutageDraft,
} from '../../lib/sams-outage-draft';

export interface SamsClinicOption {
  dbname: string;
  orgTitle: string;
}

interface Props {
  draft: SamsOutageDraft;
  clinics: readonly SamsClinicOption[];
  today: SamsDay | null;
  onClose: () => void;
}

const D_MODE_TEXT =
  'Oraliqdagi kunlar SAMS bo‘yicha «o‘lchanmagan» deb belgilanadi: hech kim «kelmadi» hisoblanmaydi va bu kunlar sababsiz soatlarga kirmaydi. Bu davomatni «sababli» qilmaydi. Oynani tahrirlab yoki o‘chirib bo‘lmaydi — faqat sabab bilan bekor qilinadi.';

function clinicOptions(clinics: readonly SamsClinicOption[], selected: string) {
  const list = [{ value: OUTAGE_ALL_CLINICS, label: 'Barcha klinikalar' }];
  clinics.forEach((c) => list.push({ value: c.dbname, label: c.orgTitle }));
  const known = selected === OUTAGE_ALL_CLINICS || clinics.some((c) => c.dbname === selected);
  if (selected && !known) list.push({ value: selected, label: selected });
  return list;
}

function submitLabel(draft: SamsOutageDraft, clinics: readonly SamsClinicOption[]): string {
  const span = outageSpanDays(draft.from, draft.to);
  const parts = [outageScopeLabel(draft.dbname, clinics), span ? `${span} kun` : null];
  const text = parts.filter(Boolean).join(', ');
  return text ? `E’lon qilish — ${text}` : 'E’lon qilish';
}

function useDeclare(initial: SamsOutageDraft, today: SamsDay | null, onClose: () => void) {
  const { message } = App.useApp();
  const create = useCreateSamsOutage();
  const [draft, setDraft] = useState<SamsOutageDraft>(initial);
  const inFlight = useRef(false);
  const set = (patch: Partial<SamsOutageDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const submit = async () => {
    if (inFlight.current) return;
    const error = validateOutageDraft(draft, today);
    if (error) {
      message.warning(error);
      return;
    }
    inFlight.current = true;
    try {
      await create.mutateAsync(draft);
      message.success('Uzilish oynasi e’lon qilindi');
      onClose();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Uzilish oynasini saqlab bo‘lmadi'));
    } finally {
      inFlight.current = false;
    }
  };

  return { draft, set, submit, pending: create.isPending };
}

export default function SamsOutageModal({ draft: initial, clinics, today, onClose }: Props) {
  const { draft, set, submit, pending } = useDeclare(initial, today, onClose);

  return (
    <Modal
      open
      onClose={pending ? () => undefined : onClose}
      title="Uzilish oynasini e’lon qilish"
      width="560px"
    >
      <ModalBody>
        <Alert type="info" showIcon style={{ marginBottom: 16 }} message={D_MODE_TEXT} />
        <FormGroup>
          <Label htmlFor="sams-outage-clinic">Klinika</Label>
          <Select
            id="sams-outage-clinic"
            aria-label="Klinika"
            value={draft.dbname || undefined}
            placeholder="Klinikani yoki «Barcha klinikalar»ni tanlang"
            style={{ width: '100%' }}
            options={clinicOptions(clinics, draft.dbname)}
            onChange={(v: string) => set({ dbname: v })}
          />
        </FormGroup>
        <OutageDateFields from={draft.from} to={draft.to} today={today} onChange={set} />
        <OutageReasonField
          label="Sabab"
          value={draft.reason}
          onChange={(v) => set({ reason: v })}
        />
      </ModalBody>
      <ModalFooter>
        <Btn $variant="ghost" disabled={pending} onClick={onClose}>
          Bekor qilish
        </Btn>
        <Btn $variant="primary" disabled={pending} onClick={() => void submit()}>
          {submitLabel(draft, clinics)}
        </Btn>
      </ModalFooter>
    </Modal>
  );
}
