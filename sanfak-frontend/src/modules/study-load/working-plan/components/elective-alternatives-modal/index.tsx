import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Empty, Form, List, Select, Space, Spin, Tag, Typography } from 'antd';
import { DeleteOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import { App, ModalFooter, useModalStore } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import {
  getApiErrorMessage,
  useScienceCatalog,
  useSetElectiveAlternatives,
  type ElectiveRowRef,
} from '../../api/working-plan-api';
import { MAX_ALTERNATIVES } from '../../lib/elective-block';
import type { ElectiveAlternative, ElectiveAlternativesResult } from '../../model/types';

const { Text } = Typography;

const SEARCH_DEBOUNCE_MS = 300;

interface IProps extends ElectiveRowRef {
  workingScheduleId: string | undefined;
  mainScienceId: string | null;
  mainCode: string | null;
  mainTitle: string | null;
  initialAlternatives: ElectiveAlternative[];
}

function altLabel(alt: { code: string | null; title: string | null }): string {
  const title = alt.title ?? '—';
  return alt.code ? `${alt.code} — ${title}` : title;
}

const ElectiveAlternativesModal = ({
  planDocId,
  semKey,
  blockId,
  scienceRowId,
  workingScheduleId,
  mainScienceId,
  mainCode,
  mainTitle,
  initialAlternatives,
}: IProps) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const hideModal = useModalStore((s) => s.hideModal);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [result, setResult] = useState<ElectiveAlternativesResult | null>(null);
  const [items, setItems] = useState<ElectiveAlternative[]>(initialAlternatives);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [search]);

  const mutation = useSetElectiveAlternatives(workingScheduleId);

  const isFull = items.length >= MAX_ALTERNATIVES;
  const catalogQuery = useScienceCatalog(debouncedSearch, !isFull);

  const takenIds = useMemo(
    () => new Set(items.map((a) => a.scienceId).filter((id): id is string => Boolean(id))),
    [items],
  );

  const options = useMemo(
    () =>
      (catalogQuery.data ?? []).map((s) => ({
        value: s.id,
        label: s.code ? `${s.code} — ${s.title}` : s.title,
        disabled: s.id === mainScienceId || takenIds.has(s.id),
      })),
    [catalogQuery.data, mainScienceId, takenIds],
  );

  const dirty = useMemo(() => {
    const before = initialAlternatives.map((a) => a.scienceId ?? '').join('|');
    const after = items.map((a) => a.scienceId ?? '').join('|');
    return before !== after;
  }, [initialAlternatives, items]);

  const handleAdd = () => {
    if (!picked || isFull) return;
    const found = (catalogQuery.data ?? []).find((s) => s.id === picked);
    if (!found) return;
    setItems((prev) => [
      ...prev,
      { scienceId: found.id, code: found.code, title: found.title, departmentId: null },
    ]);
    setPicked(null);
    setSearch('');
  };

  const handleRemove = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    try {
      const res = await mutation.mutateAsync({
        planDocId,
        semKey,
        blockId,
        scienceRowId,
        scienceIds: items.map((a) => a.scienceId).filter((id): id is string => Boolean(id)),
      });
      if (res.persisted) {
        message.success(t('studyLoad.workingPlan.electiveAlternatives.success'));
        hideModal();
        return;
      }
      setItems(res.alternatives);
      setResult(res);
    } catch (e) {
      message.error(getApiErrorMessage(e, t('studyLoad.common.errorOccurred')), 8);
    }
  };

  if (result) {
    return (
      <div style={{ padding: 'var(--space-4)' }}>
        <Alert
          type="warning"
          showIcon
          message={t('studyLoad.workingPlan.electiveAlternatives.notPersistedTitle')}
          description={t('studyLoad.workingPlan.electiveAlternatives.notPersisted')}
          style={{ marginBottom: 'var(--space-3)' }}
        />
        <Text type="secondary" style={{ fontSize: 13 }}>
          {t('studyLoad.workingPlan.electiveAlternatives.resultSummary', {
            rows: result.updatedRows,
            alternatives: result.alternatives.length,
          })}
        </Text>
        <div style={{ marginTop: 'var(--space-4)' }}>
          <Button block type="primary" onClick={hideModal}>
            {t('studyLoad.workingPlan.electiveAlternatives.close')}
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
          {t('studyLoad.workingPlan.electiveAlternatives.mainLabel')}
        </Text>
        <div>
          <Text strong style={{ fontSize: 14 }}>
            {mainCode ? `${mainCode} — ` : ''}
            {mainTitle ?? '—'}
          </Text>
        </div>
      </div>

      <Alert
        type="info"
        showIcon
        message={t('studyLoad.workingPlan.electiveAlternatives.creditNote')}
        style={{ marginBottom: 'var(--space-3)' }}
      />

      <Form layout="vertical">
        <Form.Item
          label={t('studyLoad.workingPlan.electiveAlternatives.addLabel', {
            max: MAX_ALTERNATIVES,
          })}
          validateStatus={catalogQuery.isError ? 'error' : ''}
          help={
            catalogQuery.isError
              ? getApiErrorMessage(catalogQuery.error, t('studyLoad.common.errorOccurred'))
              : isFull
                ? t('studyLoad.workingPlan.electiveAlternatives.limitReached', {
                    max: MAX_ALTERNATIVES,
                  })
                : undefined
          }
        >
          <Space.Compact style={{ width: '100%' }}>
            <Select
              showSearch
              allowClear
              disabled={isFull}
              loading={catalogQuery.isFetching}
              placeholder={t('studyLoad.workingPlan.electiveAlternatives.addPlaceholder')}
              filterOption={false}
              searchValue={search}
              onSearch={setSearch}
              value={picked}
              onChange={(v: string | null) => setPicked(v ?? null)}
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
                    description={t('studyLoad.workingPlan.electiveAlternatives.catalogEmpty')}
                  />
                )
              }
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              disabled={!picked || isFull}
              onClick={handleAdd}
            >
              {t('studyLoad.workingPlan.electiveAlternatives.add')}
            </Button>
          </Space.Compact>
        </Form.Item>
      </Form>

      <Text type="secondary" style={{ fontSize: 12 }}>
        {t('studyLoad.workingPlan.electiveAlternatives.listLabel', {
          n: items.length,
          max: MAX_ALTERNATIVES,
        })}
      </Text>
      <List
        size="small"
        style={{ marginTop: 'var(--space-2)' }}
        dataSource={items}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t('studyLoad.workingPlan.electiveAlternatives.listEmpty')}
            />
          ),
        }}
        renderItem={(alt, index) => (
          <List.Item
            key={alt.scienceId ?? `alt-${index}`}
            actions={[
              <Button
                key="remove"
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined />}
                aria-label={t('studyLoad.workingPlan.electiveAlternatives.remove')}
                title={t('studyLoad.workingPlan.electiveAlternatives.remove')}
                onClick={() => handleRemove(index)}
              />,
            ]}
          >
            <Space size={6}>
              <Tag color="blue" style={{ marginInlineEnd: 0 }}>
                {index + 1}
              </Tag>
              <Text style={{ fontSize: 13 }}>{altLabel(alt)}</Text>
            </Space>
          </List.Item>
        )}
      />

      <ModalFooter
        spacing="none"
        cancelLabel={t('studyLoad.common.cancel')}
        confirmLabel={t('studyLoad.workingPlan.electiveAlternatives.confirm')}
        confirmIcon={<SaveOutlined />}
        loading={mutation.isPending}
        confirmDisabled={!dirty}
        onConfirm={() => void handleSave()}
      />
    </div>
  );
};

export default ElectiveAlternativesModal;
