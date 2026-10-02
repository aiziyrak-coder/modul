import { useMemo, useState } from 'react';
import { Alert, Select, Typography } from 'antd';
import { ModalFooter, useModalStore } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { CONTINGENT_CATEGORIES, type ContingentCategory, type ContingentRow } from '../../model/types';
import { hasDuplicateRow, zeroNumbers } from '../../model/invariants';

const { Text } = Typography;
const COURSES = [1, 2, 3, 4, 5, 6];

interface IProps {
  rows: ContingentRow[];
  onAdd: (row: ContingentRow) => void;
}

const AddRowModal = ({ rows, onAdd }: IProps) => {
  const { t } = useTranslation();
  const hideModal = useModalStore((s) => s.hideModal);

  const directions = useMemo(() => {
    const seen = new Map<string, { id: string; code: string; title: string }>();
    for (const r of rows) {
      if (!seen.has(r.directionId)) seen.set(r.directionId, { id: r.directionId, code: r.directionCode, title: r.directionTitle });
    }
    return [...seen.values()];
  }, [rows]);

  const [directionId, setDirectionId] = useState<string | undefined>(directions[0]?.id);
  const [course, setCourse] = useState<number>(1);
  const [category, setCategory] = useState<ContingentCategory>('milliy');

  const direction = directions.find((d) => d.id === directionId);
  const duplicate = Boolean(directionId) && hasDuplicateRow(rows, { directionId: directionId ?? '', course, category });

  const handleConfirm = () => {
    if (!direction || duplicate) return;
    onAdd({
      directionId: direction.id,
      directionCode: direction.code,
      directionTitle: direction.title,
      category,
      course,
      ...zeroNumbers(),
      source: { total: 'manual', groupCount: 'manual', streamCount: 'manual' },
    });
    hideModal();
  };

  const field = (label: string, node: React.ReactNode) => (
    <div>
      <Text strong style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
        {label}
      </Text>
      {node}
    </div>
  );

  return (
    <div style={{ padding: 'var(--space-5) var(--space-6)', display: 'grid', gap: 'var(--space-4)' }}>
      {directions.length === 0 ? (
        <Alert type="warning" showIcon message={t('studyLoad.contingentReport.addRow.noDirections')} />
      ) : null}
      {field(
        t('studyLoad.contingentReport.col.direction'),
        <Select
          style={{ width: '100%' }}
          value={directionId}
          onChange={(v: string) => setDirectionId(v)}
          options={directions.map((d) => ({ value: d.id, label: d.code ? `${d.code} — ${d.title}` : d.title }))}
          showSearch
          optionFilterProp="label"
          aria-label={t('studyLoad.contingentReport.col.direction')}
        />,
      )}
      {field(
        t('studyLoad.contingentReport.col.course'),
        <Select
          style={{ width: '100%' }}
          value={course}
          onChange={(v: number) => setCourse(v)}
          options={COURSES.map((c) => ({
            value: c,
            label: t('studyLoad.contingentReport.courseLabel', { n: c }),
          }))}
          aria-label={t('studyLoad.contingentReport.col.course')}
        />,
      )}
      {field(
        t('studyLoad.contingentReport.col.category'),
        <Select
          style={{ width: '100%' }}
          value={category}
          onChange={(v: ContingentCategory) => setCategory(v)}
          options={CONTINGENT_CATEGORIES.map((c) => ({ value: c, label: t(`studyLoad.contingentReport.category.${c}`) }))}
          aria-label={t('studyLoad.contingentReport.col.category')}
        />,
      )}
      {duplicate ? <Alert type="error" showIcon message={t('studyLoad.contingentReport.addRow.duplicate')} /> : null}
      <ModalFooter
        confirmLabel={t('studyLoad.contingentReport.addRow.submit')}
        onConfirm={handleConfirm}
        confirmDisabled={!direction || duplicate}
        spacing="form"
      />
    </div>
  );
};

export default AddRowModal;
