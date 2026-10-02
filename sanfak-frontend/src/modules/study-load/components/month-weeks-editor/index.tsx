import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Checkbox, InputNumber, Modal, Space, Typography } from 'antd';
import styled from 'styled-components';
import { useTranslation } from '@/shared/lib/i18n';
import {
  equalMonthCounts,
  totalOf,
  validateMonthCounts,
  type MonthCount,
} from '../../lib/month-weeks';

const { Text } = Typography;

export interface MonthWeeksSavePayload {
  counts: MonthCount[];
  applyToDraftSchedules: boolean;
}

interface IProps {
  open: boolean;
  months: MonthCount[];
  showApplyToSchedules?: boolean;
  loading?: boolean;
  onCancel: () => void;
  onSave: (payload: MonthWeeksSavePayload) => void;
}

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2) var(--space-5);
`;

const Row = styled.label`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
`;

const TotalRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: var(--space-4);
`;

const MonthWeeksEditor = ({
  open,
  months,
  showApplyToSchedules = false,
  loading = false,
  onCancel,
  onSave,
}: IProps) => {
  const { t } = useTranslation();
  const [counts, setCounts] = useState<MonthCount[]>(months);
  const [applyToDraftSchedules, setApply] = useState(true);

  useEffect(() => {
    if (open) {
      setCounts(months.map((m) => ({ ...m })));
      setApply(true);
    }
  }, [open, months]);

  const expectedTotal = useMemo(() => totalOf(months), [months]);
  const sum = totalOf(counts);
  const error = validateMonthCounts(counts, expectedTotal);
  const errorText =
    error === 'total'
      ? t('studyLoad.monthWeeks.errorTotal', { total: expectedTotal, sum })
      : error === 'belowOne' || error === 'notInteger'
        ? t('studyLoad.monthWeeks.errorBelowOne')
        : null;

  const setCount = (index: number, value: number | null) => {
    setCounts((prev) =>
      prev.map((c, i) => (i === index ? { ...c, count: value ?? 0 } : c)),
    );
  };

  return (
    <Modal
      open={open}
      title={t('studyLoad.monthWeeks.title')}
      okText={t('studyLoad.monthWeeks.save')}
      cancelText={t('studyLoad.common.cancel')}
      confirmLoading={loading}
      okButtonProps={{ disabled: Boolean(error) || !counts.length }}
      onCancel={onCancel}
      onOk={() => onSave({ counts, applyToDraftSchedules })}
      destroyOnHidden
    >
      <Text type="secondary" style={{ display: 'block', marginBottom: 'var(--space-3)' }}>
        {t('studyLoad.monthWeeks.hint')}
      </Text>

      {counts.length ? (
        <Grid>
          {counts.map((c, i) => (
            <Row key={c.month || i}>
              <Text>{c.month}</Text>
              <InputNumber
                aria-label={c.month}
                min={1}
                max={expectedTotal}
                precision={0}
                value={c.count}
                onChange={(v) => setCount(i, typeof v === 'number' ? v : null)}
                style={{ width: 90 }}
              />
            </Row>
          ))}
        </Grid>
      ) : (
        <Alert type="warning" showIcon message={t('studyLoad.monthWeeks.empty')} />
      )}

      <TotalRow>
        <Text strong type={error === 'total' ? 'danger' : undefined} data-testid="month-weeks-total">
          {t('studyLoad.monthWeeks.total', { sum, total: expectedTotal })}
        </Text>
        <Button
          size="small"
          onClick={() => setCounts(equalMonthCounts(counts.map((c) => c.month), expectedTotal))}
          disabled={!counts.length}
        >
          {t('studyLoad.monthWeeks.equalize')}
        </Button>
      </TotalRow>

      {errorText ? (
        <Alert
          type="error"
          showIcon
          message={errorText}
          style={{ marginTop: 'var(--space-3)' }}
        />
      ) : null}

      {showApplyToSchedules ? (
        <Space direction="vertical" size={4} style={{ marginTop: 'var(--space-4)' }}>
          <Checkbox checked={applyToDraftSchedules} onChange={(e) => setApply(e.target.checked)}>
            {t('studyLoad.monthWeeks.applyToSchedules')}
          </Checkbox>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('studyLoad.monthWeeks.lockedNote')}
          </Text>
        </Space>
      ) : null}
    </Modal>
  );
};

export default MonthWeeksEditor;
