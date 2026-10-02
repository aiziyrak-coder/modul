import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Empty, Form, Select, Spin, Typography } from 'antd';
import { SwapOutlined } from '@ant-design/icons';
import { App, ModalFooter, useModalStore } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import {
  getApiErrorMessage,
  useElectiveUsage,
  useScienceCatalog,
  useSwapElectiveScience,
  type ElectiveRowRef,
} from '../../api/working-plan-api';
import type { ElectiveSwapResult, ElectiveUsageInfo } from '../../model/types';

const { Text } = Typography;

const SEARCH_DEBOUNCE_MS = 300;

const USAGE_ROWS = [
  'scienceProgram',
  'syllabus',
  'workload',
  'workloadDistribution',
] as const;

interface IProps extends ElectiveRowRef {
  workingScheduleId: string | undefined;
  currentScienceId: string | null;
  currentCode: string | null;
  currentTitle: string | null;
  fill?: boolean;
}

function blockedReasonKey(info: ElectiveUsageInfo): string | null {
  if (info.canSwap) return null;
  if (!info.elective) return 'studyLoad.workingPlan.electiveSwap.blockedNotElective';
  if (!info.hasStudyPlan) return 'studyLoad.workingPlan.electiveSwap.blockedNoStudyPlan';
  if (info.locked) return 'studyLoad.workingPlan.electiveSwap.blockedLocked';
  if (info.usage.signedTotal > 0) return 'studyLoad.workingPlan.electiveSwap.blockedSigned';
  return 'studyLoad.workingPlan.electiveSwap.blockedUnknown';
}

const ElectiveSwapModal = ({
  planDocId,
  semKey,
  blockId,
  scienceRowId,
  workingScheduleId,
  currentScienceId,
  currentCode,
  currentTitle,
  fill = false,
}: IProps) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const hideModal = useModalStore((s) => s.hideModal);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [result, setResult] = useState<ElectiveSwapResult | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [search]);

  const rowRef = useMemo<ElectiveRowRef>(
    () => ({ planDocId, semKey, blockId, scienceRowId }),
    [planDocId, semKey, blockId, scienceRowId],
  );

  const usageQuery = useElectiveUsage(rowRef);
  const catalogQuery = useScienceCatalog(debouncedSearch, usageQuery.data?.canSwap === true);
  const swapMutation = useSwapElectiveScience(workingScheduleId);

  const info = usageQuery.data;
  const blockedKey = info ? blockedReasonKey(info) : null;

  const options = useMemo(
    () =>
      (catalogQuery.data ?? []).map((s) => ({
        value: s.id,
        label: s.code ? `${s.code} — ${s.title}` : s.title,
        disabled: currentScienceId !== null && s.id === currentScienceId,
      })),
    [catalogQuery.data, currentScienceId],
  );

  const handleConfirm = async () => {
    if (!selectedId) return;
    try {
      const res = await swapMutation.mutateAsync({ ...rowRef, scienceId: selectedId });
      if (res.persisted && res.siblingErrors.length === 0) {
        message.success(
          t(
            fill || res.filled
              ? 'studyLoad.workingPlan.electiveSlot.success'
              : 'studyLoad.workingPlan.electiveSwap.success',
          ),
        );
        hideModal();
        return;
      }
      setResult(res);
    } catch (e) {
      message.error(getApiErrorMessage(e, t('studyLoad.common.errorOccurred')), 8);
    }
  };

  if (result) {
    return (
      <div style={{ padding: 'var(--space-4)' }}>
        {result.persisted ? null : (
          <Alert
            type="warning"
            showIcon
            message={t('studyLoad.workingPlan.electiveSwap.notPersistedTitle')}
            description={t('studyLoad.workingPlan.electiveSwap.notPersisted')}
            style={{ marginBottom: 'var(--space-3)' }}
          />
        )}

        {result.siblingErrors.length > 0 ? (
          <Alert
            type="warning"
            showIcon
            message={t('studyLoad.workingPlan.electiveSwap.siblingErrorsTitle')}
            description={
              <ul style={{ margin: 0, paddingInlineStart: 'var(--space-4)' }}>
                {result.siblingErrors.map((err) => (
                  <li key={err}>
                    <Text style={{ fontSize: 13 }}>{err}</Text>
                  </li>
                ))}
              </ul>
            }
            style={{ marginBottom: 'var(--space-3)' }}
          />
        ) : null}

        <Text type="secondary" style={{ fontSize: 13 }}>
          {t('studyLoad.workingPlan.electiveSwap.resultSummary', {
            plans: result.updatedPlans,
            rows: result.updatedRows,
          })}
        </Text>

        <div style={{ marginTop: 'var(--space-4)' }}>
          <Button block type="primary" onClick={hideModal}>
            {t('studyLoad.workingPlan.electiveSwap.close')}
          </Button>
        </div>
      </div>
    );
  }

  if (usageQuery.isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-6)' }}>
        <Spin />
      </div>
    );
  }

  if (usageQuery.isError || !info) {
    return (
      <div style={{ padding: 'var(--space-4)' }}>
        <Alert
          type="error"
          showIcon
          message={t('studyLoad.workingPlan.electiveSwap.usageError')}
          description={getApiErrorMessage(
            usageQuery.error,
            t('studyLoad.common.errorOccurred'),
          )}
        />
        <div style={{ marginTop: 'var(--space-3)' }}>
          <Button block onClick={() => void usageQuery.refetch()}>
            {t('studyLoad.workingPlan.electiveSwap.retry')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--space-4)' }}>
      <div
        style={{
          background: 'var(--color-bg-layout, #F5F7FB)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-3) var(--space-4)',
          marginBottom: 'var(--space-4)',
        }}
      >
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('studyLoad.workingPlan.electiveSwap.currentLabel')}
        </Text>
        <div>
          <Text strong style={{ fontSize: 14 }}>
            {currentCode ? `${currentCode} — ` : ''}
            {fill ? t('studyLoad.workingPlan.electiveSlot.notChosen') : (currentTitle ?? '—')}
          </Text>
        </div>
      </div>

      {info.affectedWorkingPlans > 0 ? (
        <Alert
          type="info"
          showIcon
          message={t('studyLoad.workingPlan.electiveSwap.affected', {
            n: info.affectedWorkingPlans,
          })}
          description={
            info.lockedWorkingPlans > 0
              ? t('studyLoad.workingPlan.electiveSwap.lockedSkipped', { n: info.lockedWorkingPlans })
              : undefined
          }
          style={{ marginBottom: 'var(--space-3)' }}
        />
      ) : null}

      {info.usage.total > 0 ? (
        <Alert
          type="warning"
          showIcon
          message={t('studyLoad.workingPlan.electiveSwap.downstreamTitle', {
            n: info.usage.total,
          })}
          description={
            <ul style={{ margin: 0, paddingInlineStart: 'var(--space-4)' }}>
              {USAGE_ROWS.filter((key) => info.usage[key].total > 0).map((key) => (
                <li key={key}>
                  <Text style={{ fontSize: 13 }}>
                    {t(`studyLoad.workingPlan.electiveSwap.usage.${key}`)}:{' '}
                    {t('studyLoad.workingPlan.electiveSwap.usageCount', {
                      total: info.usage[key].total,
                      signed: info.usage[key].signed,
                    })}
                  </Text>
                </li>
              ))}
            </ul>
          }
          style={{ marginBottom: 'var(--space-3)' }}
        />
      ) : null}

      {info.usage.signedTotal > 0 ? (
        <Alert
          type="error"
          showIcon
          message={t('studyLoad.workingPlan.electiveSwap.signedWarning', {
            n: info.usage.signedTotal,
          })}
          style={{ marginBottom: 'var(--space-3)' }}
        />
      ) : null}

      {blockedKey ? (
        <Alert
          type="error"
          showIcon
          message={t(blockedKey, { status: info.status ?? '—' })}
          style={{ marginBottom: 'var(--space-3)' }}
        />
      ) : null}

      <Form layout="vertical">
        <Form.Item
          label={t('studyLoad.workingPlan.electiveSwap.newLabel')}
          required
          validateStatus={catalogQuery.isError ? 'error' : ''}
          help={
            catalogQuery.isError
              ? getApiErrorMessage(catalogQuery.error, t('studyLoad.common.errorOccurred'))
              : undefined
          }
        >
          <Select
            showSearch
            allowClear
            disabled={!info.canSwap}
            loading={catalogQuery.isFetching}
            placeholder={t('studyLoad.workingPlan.electiveSwap.newPlaceholder')}
            filterOption={false}
            searchValue={search}
            onSearch={setSearch}
            value={selectedId}
            onChange={(v: string | null) => setSelectedId(v ?? null)}
            options={options}
            style={{ width: '100%' }}
            notFoundContent={
              catalogQuery.isFetching ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-3)' }}>
                  <Spin size="small" />
                </div>
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={t('studyLoad.workingPlan.electiveSwap.catalogEmpty')}
                />
              )
            }
          />
        </Form.Item>
      </Form>

      <ModalFooter
        spacing="none"
        cancelLabel={t('studyLoad.common.cancel')}
        confirmLabel={t(
          fill
            ? 'studyLoad.workingPlan.electiveSlot.confirm'
            : 'studyLoad.workingPlan.electiveSwap.confirm',
        )}
        confirmIcon={<SwapOutlined />}
        loading={swapMutation.isPending}
        confirmDisabled={!info.canSwap || !selectedId}
        onConfirm={() => void handleConfirm()}
      />
    </div>
  );
};

export default ElectiveSwapModal;
