import { useMemo, useState } from 'react';
import { Alert, App, Button, Space, Tooltip } from 'antd';
import { ApartmentOutlined } from '@ant-design/icons';
import { usePermission } from '@/app/session';
import { useTranslation } from '@/shared/lib/i18n';
import {
  useDeptContingentDetail,
  useDeptContingents,
} from '../../../department-contingent/api/department-contingent-api';
import { buildContingentPrefill, pickContingentId } from '../assign-drawer/contingent-prefill';
import type { StreamInput, WorkloadBlockOption } from '../../model/types';

interface IProps {
  block: WorkloadBlockOption | undefined;
  availableGroupIds: string[];
  onApply: (streams: StreamInput[], groups: string[]) => void;
}

const ContingentPrefill = ({ block, availableGroupIds, onApply }: IProps) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const can = usePermission();
  const allowed = can('departmentContingent:readAll') && can('departmentContingent:read');

  const [requestedFor, setRequestedFor] = useState<string | null>(null);
  const active = Boolean(block) && requestedFor === block?.id;
  const academicYearId = block?.academicYearId ?? null;
  const departmentId = block?.departmentId ?? null;

  const list = useDeptContingents(
    {
      page: 1,
      limit: 100,
      academicYear: academicYearId ?? undefined,
      department: departmentId ?? undefined,
    },
    { enabled: active && allowed && Boolean(academicYearId) },
  );
  const docId =
    active && list.data ? pickContingentId(list.data.items, departmentId, academicYearId) : null;
  const detail = useDeptContingentDetail(docId ?? undefined);

  const availableSet = useMemo(() => new Set(availableGroupIds), [availableGroupIds]);
  const outcome = useMemo(() => {
    if (!active || !block) return null;
    if (!academicYearId) return { kind: 'noRow' as const };
    if (list.data && !docId) return { kind: 'noRow' as const };
    if (!detail.data) return null;
    return buildContingentPrefill(detail.data.rows, block, availableSet);
  }, [active, block, academicYearId, list.data, docId, detail.data, availableSet]);

  const isError = active && (list.isError || detail.isError);
  const isLoading = active && !outcome && !isError;

  const handleApply = () => {
    if (outcome?.kind !== 'found') return;
    onApply(outcome.streams, outcome.groups);
    setRequestedFor(null);
    message.success(t('studyLoad.deptContingent.prefill.applied'));
  };

  const disabledReason = !allowed
    ? t('studyLoad.deptContingent.prefill.noPermission')
    : !block
      ? t('studyLoad.deptContingent.prefill.pickBlock')
      : null;

  return (
    <div style={{ marginTop: 'var(--space-2)' }}>
      <Tooltip title={disabledReason}>
        <span style={{ display: 'block' }}>
          <Button
            block
            icon={<ApartmentOutlined />}
            disabled={disabledReason !== null}
            loading={isLoading}
            onClick={() => setRequestedFor(block?.id ?? null)}
            data-testid="assign-contingent-prefill"
          >
            {t('studyLoad.deptContingent.prefill.button')}
          </Button>
        </span>
      </Tooltip>

      {isError ? (
        <Alert
          type="error"
          showIcon
          style={{ marginTop: 'var(--space-2)' }}
          message={t('studyLoad.deptContingent.loadError')}
          action={
            <Button
              size="small"
              onClick={() => void (list.isError ? list.refetch() : detail.refetch())}
            >
              {t('studyLoad.deptContingent.retry')}
            </Button>
          }
        />
      ) : outcome?.kind === 'noRow' ? (
        <Alert
          type="info"
          showIcon
          closable
          onClose={() => setRequestedFor(null)}
          style={{ marginTop: 'var(--space-2)' }}
          message={t('studyLoad.deptContingent.prefill.noRow')}
        />
      ) : outcome?.kind === 'found' ? (
        <Alert
          type={outcome.mismatches.length > 0 ? 'warning' : 'info'}
          showIcon
          style={{ marginTop: 'var(--space-2)' }}
          message={
            outcome.mismatches.length > 0
              ? t('studyLoad.deptContingent.prefill.mismatchTitle')
              : t('studyLoad.deptContingent.prefill.found', {
                  streams: outcome.streams.length,
                  groups: outcome.groups.length,
                })
          }
          description={
            <Space direction="vertical" size={2}>
              {outcome.mismatches.map((m) => (
                <span key={m.field}>
                  {t(
                    m.field === 'stream'
                      ? 'studyLoad.deptContingent.prefill.mismatchStream'
                      : 'studyLoad.deptContingent.prefill.mismatchGroup',
                    { contingent: m.contingent, workload: m.workload },
                  )}
                </span>
              ))}
              {outcome.mismatches.length > 0 ? (
                <span>{t('studyLoad.deptContingent.prefill.mismatchHint')}</span>
              ) : null}
              {outcome.droppedGroups > 0 ? (
                <span>{t('studyLoad.deptContingent.prefill.dropped', { n: outcome.droppedGroups })}</span>
              ) : null}
              {outcome.streams.length === 0 ? (
                <span>{t('studyLoad.deptContingent.prefill.nothingLeft')}</span>
              ) : null}
            </Space>
          }
          action={
            <Space direction="vertical" size={4}>
              <Button
                size="small"
                type="primary"
                disabled={outcome.streams.length === 0}
                onClick={handleApply}
              >
                {t('studyLoad.deptContingent.prefill.apply')}
              </Button>
              <Button size="small" onClick={() => setRequestedFor(null)}>
                {t('studyLoad.common.cancel')}
              </Button>
            </Space>
          }
        />
      ) : null}
    </div>
  );
};

export default ContingentPrefill;
