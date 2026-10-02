import { useState } from 'react';
import type { Dayjs } from 'dayjs';
import { App, DatePicker, Select } from '@/shared/ui';
import Modal, { ModalBody, ModalFooter } from '../../common/Modal';
import { Btn, FormGroup, HelperText, Label } from '../../common/FormElements';
import { useSciences } from '../../../api/residency-api';
import { sessionErrorInfo, useAnnounceSession } from '../../../api/session-api';
import { SESSION_HOURS, type AnnounceSessionInput } from '../../../api/session-types';
import type { LessonType, RefOption } from '../../../api/types';
import { useResidencyCapabilities } from '../../../lib/capabilities';
import { LESSON_LABEL, LESSON_TYPES } from '../../../lib/lesson-type';
import {
  announceableRange,
  isDayInRange,
  toDayRange,
  type DayRange,
} from '../../../lib/session-day';
import {
  useRosterPreview,
  useSessionGroupOptions,
  type GroupOptionsState,
  type RosterPreview,
} from '../../../lib/session-groups';
import { formatDayKey } from '../../../lib/uz-day';
import AnnounceSummary from './AnnounceSummary';
import * as S from './style';

interface Props {
  onClose: () => void;
  onAnnounced: (id: string | null) => void;
}

type Draft = AnnounceSessionInput;
type SetField = <K extends keyof Draft>(key: K, value: Draft[K]) => void;

const EMPTY: Draft = { day: '', science: '', lessonType: 'amaliy', group: '', hours: 2 };

const HOUR_OPTIONS = Array.from({ length: SESSION_HOURS.max - SESSION_HOURS.min + 1 }, (_, i) => ({
  value: SESSION_HOURS.min + i,
  label: `${SESSION_HOURS.min + i} soat`,
}));
const LESSON_OPTIONS = LESSON_TYPES.map((l) => ({ value: l, label: LESSON_LABEL[l] }));

function missingFields(d: Draft): string[] {
  const out: string[] = [];
  if (!d.day) out.push('Sana');
  if (!d.science) out.push('Fan');
  if (!d.group) out.push('Guruh');
  return out;
}

const titleOf = (list: readonly RefOption[], id: string): string =>
  list.find((x) => x.id === id)?.title ?? '—';

const rangeText = (r: DayRange): string =>
  `Ruxsat etilgan sana: ${formatDayKey(r.from)} — ${formatDayKey(r.to)}`;

function useAnnounceSubmit(
  onAnnounced: Props['onAnnounced'],
  onDayRejected: (text: string, serverRange: DayRange | null) => void,
) {
  const { message } = App.useApp();
  const announceM = useAnnounceSession();

  const fail = (e: unknown) => {
    const info = sessionErrorInfo(e, 'E’lon qilishda xatolik');
    if (info.reason === 'session_already_announced' && typeof info.meta.session === 'string') {
      message.info('Bu mashg‘ulot allaqachon e’lon qilingan — mavjud mashg‘ulot ochildi');
      onAnnounced(info.meta.session);
      return;
    }
    if (info.reason === 'day_not_announceable') {
      const serverRange = toDayRange(info.meta);
      onDayRejected(serverRange ? rangeText(serverRange) : info.message, serverRange);
    }
    message.error(info.message);
  };

  const run = async (draft: Draft) => {
    try {
      const res = await announceM.mutateAsync(draft);
      message.success(`Mashg‘ulot e’lon qilindi · ${res.rosterCount} ta rezident`);
      if (res.skipped.length > 0) {
        message.warning(
          `${res.skipped.length} ta rezident qo‘shilmadi — shu darsga boshqa mashg‘ulotda biriktirilgan`,
        );
      }
      onAnnounced(res.id);
    } catch (e) {
      fail(e);
    }
  };

  return { run, pending: announceM.isPending };
}

function RosterPreviewBlock({ preview }: { preview: RosterPreview }) {
  if (preview.isLoading) return <HelperText>Rezidentlar hisoblanmoqda…</HelperText>;
  if (preview.count === null) return null;
  if (preview.count === 0) {
    return (
      <HelperText $error role="alert">
        Tanlangan guruhda o‘qiyotgan ordinator yo‘q
      </HelperText>
    );
  }
  return (
    <S.Preview data-testid="roster-preview">
      <S.PreviewHead>{preview.count} ta rezident (yakuniy ro‘yxatni server tuzadi)</S.PreviewHead>
      {preview.names && <S.PreviewNames>{preview.names.join(', ')}</S.PreviewNames>}
    </S.Preview>
  );
}

interface FormProps {
  draft: Draft;
  setField: SetField;
  range: DayRange;
  dayError: string | null;
  sciences: RefOption[];
  groups: GroupOptionsState;
  isOffice: boolean;
  preview: RosterPreview;
}

function DayField({
  draft,
  setField,
  range,
  dayError,
}: Pick<FormProps, 'draft' | 'setField' | 'range' | 'dayError'>) {
  return (
    <FormGroup>
      <Label>Sana *</Label>
      <DatePicker
        aria-label="Sana"
        value={draft.day || null}
        disabledDate={(d: Dayjs) => !isDayInRange(d.format('YYYY-MM-DD'), range)}
        onChange={(v) => setField('day', v ?? '')}
      />
      <HelperText $error={!!dayError}>
        {dayError ??
          `${formatDayKey(range.from)} — ${formatDayKey(range.to)} (o‘tgan kunga e’lon yo‘q)`}
      </HelperText>
    </FormGroup>
  );
}

function GroupField({
  draft,
  setField,
  groups,
  isOffice,
  preview,
}: Pick<FormProps, 'draft' | 'setField' | 'groups' | 'isOffice' | 'preview'>) {
  const noGroups = !isOffice && !groups.isLoading && groups.options.length === 0;
  return (
    <FormGroup>
      <Label>Guruh *</Label>
      <Select
        aria-label="Guruh"
        value={draft.group}
        showSearch
        optionFilterProp="label"
        disabled={noGroups}
        style={{ width: '100%' }}
        onChange={(v: string) => setField('group', v)}
        options={[
          { value: '', label: 'Tanlang' },
          ...groups.options.map((g) => ({ value: g.id, label: g.title })),
        ]}
      />
      {noGroups && <HelperText $error>Sizga biriktirilgan guruhli ordinator yo‘q</HelperText>}
      {groups.isError && <HelperText $error>Guruhlarni yuklab bo‘lmadi</HelperText>}
      <RosterPreviewBlock preview={preview} />
    </FormGroup>
  );
}

function SelectField<V extends string | number>({
  label,
  value,
  options,
  onChange,
  search = false,
}: {
  label: string;
  value: V;
  options: Array<{ value: V; label: string }>;
  onChange: (v: V) => void;
  search?: boolean;
}) {
  return (
    <FormGroup>
      <Label>{label} *</Label>
      <Select
        aria-label={label}
        value={value}
        showSearch={search}
        optionFilterProp="label"
        style={{ width: '100%' }}
        onChange={onChange}
        options={options}
      />
    </FormGroup>
  );
}

function AnnounceForm(p: FormProps) {
  const missing = missingFields(p.draft);
  const scienceOptions = [
    { value: '', label: 'Tanlang' },
    ...p.sciences.map((x) => ({ value: x.id, label: x.title })),
  ];
  return (
    <>
      <DayField draft={p.draft} setField={p.setField} range={p.range} dayError={p.dayError} />
      <SelectField
        label="Fan"
        search
        value={p.draft.science}
        options={scienceOptions}
        onChange={(v) => p.setField('science', v)}
      />
      <SelectField<LessonType>
        label="Dars turi"
        value={p.draft.lessonType}
        options={LESSON_OPTIONS}
        onChange={(v) => p.setField('lessonType', v)}
      />
      <GroupField
        draft={p.draft}
        setField={p.setField}
        groups={p.groups}
        isOffice={p.isOffice}
        preview={p.preview}
      />
      <SelectField
        label="Soat"
        value={p.draft.hours}
        options={HOUR_OPTIONS}
        onChange={(v) => p.setField('hours', v)}
      />
      {missing.length > 0 && (
        <S.Missing role="status">Davom etish uchun yetishmayapti: {missing.join(', ')}</S.Missing>
      )}
    </>
  );
}

function Footer({
  confirming,
  blocked,
  pending,
  onClose,
  onBack,
  onNext,
  onSubmit,
}: {
  confirming: boolean;
  blocked: boolean;
  pending: boolean;
  onClose: () => void;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
}) {
  if (confirming) {
    return (
      <ModalFooter>
        <Btn $variant="ghost" disabled={pending} onClick={onBack}>
          Orqaga
        </Btn>
        <Btn $variant="primary" disabled={pending} onClick={onSubmit}>
          E’lon qilish
        </Btn>
      </ModalFooter>
    );
  }
  return (
    <ModalFooter>
      <Btn $variant="ghost" onClick={onClose}>
        Bekor qilish
      </Btn>
      <Btn $variant="primary" disabled={blocked} onClick={onNext}>
        Davom etish
      </Btn>
    </ModalFooter>
  );
}

export default function AnnounceModal({ onClose, onAnnounced }: Props) {
  const { isOffice } = useResidencyCapabilities();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [confirming, setConfirming] = useState(false);
  const [dayError, setDayError] = useState<string | null>(null);
  const [range, setRange] = useState<DayRange>(() => announceableRange());
  const { data: sciences = [] } = useSciences();
  const groups = useSessionGroupOptions(isOffice);
  const preview = useRosterPreview(draft.group, isOffice);
  const submit = useAnnounceSubmit(onAnnounced, (text, serverRange) => {
    if (serverRange) setRange(serverRange);
    setDayError(text);
    setDraft((d) => ({ ...d, day: '' }));
    setConfirming(false);
  });

  const setField: SetField = (key, value) => {
    setDraft((d) => ({ ...d, [key]: value }));
    if (key === 'day') setDayError(null);
  };
  const blocked = missingFields(draft).length > 0 || preview.isLoading || preview.count === 0;

  return (
    <Modal open onClose={onClose} title="Mashg‘ulot e’lon qilish" width="520px">
      <ModalBody>
        {confirming ? (
          <AnnounceSummary
            draft={draft}
            scienceTitle={titleOf(sciences, draft.science)}
            groupTitle={titleOf(groups.options, draft.group)}
            count={preview.count}
          />
        ) : (
          <AnnounceForm
            {...{ draft, setField, range, dayError, sciences, groups, isOffice, preview }}
          />
        )}
      </ModalBody>
      <Footer
        confirming={confirming}
        blocked={blocked}
        pending={submit.pending}
        onClose={onClose}
        onBack={() => setConfirming(false)}
        onNext={() => setConfirming(true)}
        onSubmit={() => void submit.run(draft)}
      />
    </Modal>
  );
}
