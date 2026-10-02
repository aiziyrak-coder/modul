import { useMemo, useState } from 'react';
import { Alert, App, Button, Input, Select, Typography } from 'antd';
import { BulbOutlined } from '@ant-design/icons';
import { ModalFooter, useModalStore } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { useTranslation } from '@/shared/lib/i18n';
import {
  apiErrorDetail,
  useDeptContingentPrefill,
  useDirectionOptions,
  useUpdateDeptContingent,
} from '../../api/department-contingent-api';
import { draftToInput, languageTitlesOf, rowToDraft, rowToInput } from '../../api/mapper';
import {
  MAX_COURSE,
  MAX_NOTE,
  type ContingentGroup,
  type DeptContingentRow,
  type RowDraft,
  type SaveResult,
} from '../../model/types';
import { cohortKey, deriveCounts, rowDraftErrors, unassignedGroups } from '../../model/invariants';
import StreamEditor from '../stream-editor';

const { Text } = Typography;
const COURSES = Array.from({ length: MAX_COURSE }, (_, i) => i + 1);
const EMPTY_POOL: ContingentGroup[] = [];
const MODAL_BODY_MAX_HEIGHT = 'calc(100vh - 200px)';

interface IProps {
  contingentId: string;
  academicYearId: string | null;
  rows: DeptContingentRow[];
  editKey?: string;
  onSaved: (res: SaveResult) => void;
}

const RowEditorModal = ({ contingentId, academicYearId, rows, editKey, onSaved }: IProps) => {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const hideModal = useModalStore((s) => s.hideModal);
  const initial = editKey ? rows.find((r) => r.key === editKey) : undefined;

  const [draft, setDraft] = useState<RowDraft>(() =>
    initial ? rowToDraft(initial) : { directionId: '', courseNum: 1, streams: [], note: '' },
  );
  const [error, setError] = useState<{ message: string; detail: string | null } | null>(null);

  const { data: directions = [], isLoading: directionsLoading } = useDirectionOptions();
  const prefill = useDeptContingentPrefill({
    academicYearId,
    directionId: draft.directionId || undefined,
    courseNum: draft.courseNum,
  });
  const update = useUpdateDeptContingent();

  const pool = prefill.data?.groups ?? EMPTY_POOL;

  const { groupsById, options } = useMemo(() => {
    const map = new Map<string, ContingentGroup>();
    for (const s of initial?.streams ?? []) for (const g of s.groups) map.set(g.id, g);
    for (const g of pool) map.set(g.id, g);
    const poolIds = new Set(pool.map((g) => g.id));
    const legacy = [...map.values()].filter((g) => !poolIds.has(g.id));
    return { groupsById: map, options: [...pool, ...legacy] };
  }, [initial, pool]);
  const languageTitles = useMemo(() => languageTitlesOf(groupsById.values()), [groupsById]);

  const otherKeys = rows.filter((r) => r.key !== editKey).map((r) => cohortKey(r.directionId, r.courseNum));
  const errors = rowDraftErrors(draft, otherKeys);
  const counts = deriveCounts(draft.streams, groupsById);
  const unassigned = prefill.data ? unassignedGroups(pool, draft.streams) : [];

  const setCohort = (patch: Partial<Pick<RowDraft, 'directionId' | 'courseNum'>>) => {
    setDraft((d) => ({ ...d, ...patch, streams: [] }));
    setError(null);
  };

  const applySuggestion = async () => {
    const res = await prefill.refetch();
    if (res.error) {
      message.error(getApiErrorMessage(res.error));
      return;
    }
    if (!res.data || res.data.groups.length === 0) {
      message.warning(t('studyLoad.deptContingent.editor.noGroups'));
      return;
    }
    const streams = res.data.streams;
    setDraft((d) => ({ ...d, streams }));
    setError(null);
  };

  const handleSuggest = () => {
    if (draft.streams.length === 0) {
      void applySuggestion();
      return;
    }
    modal.confirm({
      title: t('studyLoad.deptContingent.editor.suggestConfirmTitle'),
      content: t('studyLoad.deptContingent.editor.suggestConfirmContent', { count: draft.streams.length }),
      okText: t('studyLoad.deptContingent.editor.suggest'),
      cancelText: t('studyLoad.common.cancel'),
      onOk: applySuggestion,
    });
  };

  const handleSave = async () => {
    if (errors.length) return;
    setError(null);
    const input = draftToInput(draft);
    const payload = editKey
      ? rows.map((r) => (r.key === editKey ? input : rowToInput(r)))
      : [...rows.map(rowToInput), input];
    try {
      const res = await update.mutateAsync({ id: contingentId, rows: payload });
      hideModal();
      onSaved(res);
    } catch (err) {
      setError({ message: getApiErrorMessage(err), detail: apiErrorDetail(err) });
    }
  };

  const directionLabel = t('studyLoad.deptContingent.col.direction');
  const courseLabel = t('studyLoad.deptContingent.col.course');
  const noteLabel = t('studyLoad.deptContingent.editor.note');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', maxHeight: MODAL_BODY_MAX_HEIGHT }}>
      <div
        style={{
          padding: 'var(--space-5) var(--space-6)',
          display: 'grid',
          gap: 'var(--space-4)',
          overflowY: 'auto',
          flex: '1 1 auto',
          minHeight: 0,
        }}
      >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
        <div>
          <Text strong style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
            {directionLabel}
          </Text>
          <Select
            style={{ width: '100%' }}
            value={draft.directionId || undefined}
            placeholder={t('studyLoad.deptContingent.editor.directionPlaceholder')}
            loading={directionsLoading}
            disabled={Boolean(initial)}
            onChange={(v: string) => setCohort({ directionId: v })}
            options={
              initial && !directions.some((d) => d.id === initial.directionId)
                ? [{ value: initial.directionId, label: initial.directionTitle }]
                : directions.map((d) => ({ value: d.id, label: d.code ? `${d.code} — ${d.title}` : d.title }))
            }
            showSearch
            optionFilterProp="label"
            aria-label={directionLabel}
          />
        </div>
        <div>
          <Text strong style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
            {courseLabel}
          </Text>
          <Select
            style={{ width: '100%' }}
            value={draft.courseNum}
            disabled={Boolean(initial)}
            onChange={(v: number) => setCohort({ courseNum: v })}
            options={COURSES.map((c) => ({ value: c, label: t('studyLoad.deptContingent.courseLabel', { n: c }) }))}
            aria-label={courseLabel}
          />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <Text strong>{t('studyLoad.deptContingent.editor.streams')}</Text>
        <Button
          icon={<BulbOutlined />}
          onClick={handleSuggest}
          loading={prefill.isFetching}
          disabled={!draft.directionId || !academicYearId}
        >
          {t('studyLoad.deptContingent.editor.suggest')}
        </Button>
      </div>
      {draft.directionId && prefill.isError ? (
        <Alert type="error" showIcon message={t('studyLoad.deptContingent.editor.poolError')} />
      ) : null}
      {draft.directionId && prefill.data && pool.length === 0 ? (
        <Alert type="warning" showIcon message={t('studyLoad.deptContingent.editor.noGroups')} />
      ) : null}

      <StreamEditor
        streams={draft.streams}
        options={options}
        groupsById={groupsById}
        languageTitles={languageTitles}
        onChange={(streams) => {
          setDraft((d) => ({ ...d, streams }));
          setError(null);
        }}
      />

      <div
        style={{
          background: 'var(--color-bg-elevate)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-2) var(--space-3)',
        }}
        aria-live="polite"
      >
        <Text>
          {t('studyLoad.deptContingent.editor.totals', {
            groups: counts.groupCount,
            students: counts.studentCount,
            streams: counts.streamCount,
          })}
        </Text>
      </div>

      {unassigned.length ? (
        <Alert
          type="info"
          showIcon
          message={t('studyLoad.deptContingent.editor.unassigned', { count: unassigned.length })}
          description={unassigned.map((g) => g.title || g.id).join(', ')}
        />
      ) : null}

      <div>
        <Text strong style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
          {noteLabel}
        </Text>
        <Input.TextArea
          value={draft.note}
          maxLength={MAX_NOTE}
          showCount
          autoSize={{ minRows: 2, maxRows: 4 }}
          onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
          aria-label={noteLabel}
        />
      </div>

      {errors.length ? (
        <Alert
          type="warning"
          showIcon
          message={t('studyLoad.deptContingent.invariant.title')}
          description={
            <ul style={{ margin: 0, paddingInlineStart: 'var(--space-5)' }}>
              {errors.map((k) => (
                <li key={k}>{t(k)}</li>
              ))}
            </ul>
          }
        />
      ) : null}
      {error ? <Alert type="error" showIcon message={error.message} description={error.detail ?? undefined} /> : null}
      </div>

      <div style={{ padding: '0 var(--space-6) var(--space-5)', flex: '0 0 auto' }}>
        <ModalFooter
          confirmLabel={t('studyLoad.common.save')}
          onConfirm={() => void handleSave()}
          loading={update.isPending}
          confirmDisabled={errors.length > 0}
          spacing="form"
        />
      </div>
    </div>
  );
};

export default RowEditorModal;
