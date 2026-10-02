import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Empty,
  Form,
  Input,
  Radio,
  Select,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import { App, ModalFooter, useModalStore } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import {
  getApiErrorMessage,
  useElectiveOptions,
  useSetElectiveChoice,
} from '../../api/distribution-api';
import type { ElectiveOption } from '../../model/types';
import {
  ASSIGNMENT_BASES,
  ASSIGNMENT_BASIS_LABEL_KEYS,
  buildJustificationPayload,
  justificationNoteMinLength,
  parseSuitabilityBasisError,
  type AssignmentBasis,
} from '../../lib/suitability';

const { Text } = Typography;

interface IProps {
  distributionId: string;
  blockId: string;
  currentScienceId: string | null;
}

function optionLabel(o: ElectiveOption): string {
  const title = o.title ?? '—';
  return o.code ? `${o.code} — ${title}` : title;
}

const ElectiveChoiceModal = ({ distributionId, blockId, currentScienceId }: IProps) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const hideModal = useModalStore((s) => s.hideModal);

  const optionsQuery = useElectiveOptions(distributionId, blockId, true);
  const mutation = useSetElectiveChoice(distributionId);

  const [picked, setPicked] = useState<string | null>(currentScienceId);

  const [basis, setBasis] = useState<AssignmentBasis | ''>('');
  const [note, setNote] = useState('');
  const [justificationTouched, setJustificationTouched] = useState(false);

  const options = useMemo<ElectiveOption[]>(() => {
    const data = optionsQuery.data;
    if (!data) return [];
    return data.main ? [data.main, ...data.alternatives] : [...data.alternatives];
  }, [optionsQuery.data]);

  const pickedOption = options.find((o) => o.scienceId === picked) ?? null;
  const requiresJustification = pickedOption?.suitability === 'crossDepartment';
  const noteMinLength = justificationNoteMinLength(basis || null);
  const noteValid = note.trim().length >= noteMinLength;
  const justificationValid = !requiresJustification || (Boolean(basis) && noteValid);

  const handlePick = (scienceId: string) => {
    setPicked(scienceId);
    setBasis('');
    setNote('');
    setJustificationTouched(false);
  };

  const handleConfirm = async () => {
    if (!picked) return;
    if (requiresJustification && !justificationValid) {
      setJustificationTouched(true);
      return;
    }
    try {
      await mutation.mutateAsync({
        blockId,
        scienceId: picked,
        ...buildJustificationPayload(requiresJustification ? basis : '', note),
      });
      message.success(t('studyLoad.distribution.electiveChoice.success'));
      hideModal();
    } catch (e) {
      if (parseSuitabilityBasisError(e)) {
        setJustificationTouched(true);
        message.error(t('studyLoad.distribution.suitability.basisRequiredError'), 8);
      } else {
        message.error(getApiErrorMessage(e), 8);
      }
    }
  };

  if (optionsQuery.isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-6)' }}>
        <Spin />
      </div>
    );
  }

  if (optionsQuery.isError) {
    return (
      <div style={{ padding: 'var(--space-4)' }}>
        <Alert
          type="error"
          showIcon
          message={t('studyLoad.distribution.electiveChoice.optionsError')}
          description={getApiErrorMessage(optionsQuery.error)}
        />
        <div style={{ marginTop: 'var(--space-3)' }}>
          <Button block onClick={() => void optionsQuery.refetch()}>
            {t('studyLoad.distribution.electiveChoice.retry')}
          </Button>
        </div>
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <div style={{ padding: 'var(--space-4)' }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('studyLoad.distribution.electiveChoice.empty')}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--space-4)' }}>
      <Alert
        type="info"
        showIcon
        message={t('studyLoad.distribution.electiveChoice.description')}
        style={{ marginBottom: 'var(--space-4)' }}
      />

      <Radio.Group
        value={picked}
        onChange={(e) => handlePick(String(e.target.value))}
        style={{ display: 'block', width: '100%' }}
      >
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          {options.map((o, index) => {
            const isMain = index === 0 && optionsQuery.data?.main !== null;
            const isCurrent = o.scienceId !== null && o.scienceId === currentScienceId;
            return (
              <Tooltip key={o.scienceId ?? `opt-${index}`} title={o.selectable ? undefined : o.reason}>
                <span style={{ display: 'block' }}>
                  <Radio
                    value={o.scienceId}
                    disabled={!o.selectable || o.scienceId === null}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      width: '100%',
                      padding: 'var(--space-2) var(--space-3)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    <Space size={6} wrap>
                      <Text style={{ fontSize: 13 }}>{optionLabel(o)}</Text>
                      <Tag color={isMain ? 'green' : 'blue'} style={{ marginInlineEnd: 0 }}>
                        {isMain
                          ? t('studyLoad.distribution.electiveChoice.mainTag')
                          : t('studyLoad.distribution.electiveChoice.alternativeTag')}
                      </Tag>
                      {isCurrent ? (
                        <Tag style={{ marginInlineEnd: 0 }}>
                          {t('studyLoad.distribution.electiveChoice.currentTag')}
                        </Tag>
                      ) : null}
                      {!o.selectable && o.reason ? (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {o.reason}
                        </Text>
                      ) : null}
                    </Space>
                  </Radio>
                </span>
              </Tooltip>
            );
          })}
        </Space>
      </Radio.Group>

      {requiresJustification ? (
        <div style={{ marginTop: 'var(--space-4)' }}>
          <Alert
            type="info"
            showIcon
            message={t('studyLoad.distribution.suitability.crossDepartmentTitle')}
            description={t('studyLoad.distribution.suitability.crossDepartmentDescription')}
            style={{ marginBottom: 'var(--space-3)' }}
          />
          <Form.Item
            label={t('studyLoad.distribution.suitability.basisLabel')}
            required
            validateStatus={justificationTouched && !basis ? 'error' : ''}
            help={
              justificationTouched && !basis
                ? t('studyLoad.distribution.suitability.basisRequiredHint')
                : undefined
            }
          >
            <Select
              placeholder={t('studyLoad.distribution.suitability.basisPlaceholder')}
              options={ASSIGNMENT_BASES.map((b) => ({
                value: b,
                label: t(ASSIGNMENT_BASIS_LABEL_KEYS[b]),
              }))}
              value={basis || null}
              onChange={(v) => {
                setBasis((v ?? '') as AssignmentBasis | '');
                setJustificationTouched(true);
              }}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item
            label={t('studyLoad.distribution.suitability.noteLabel')}
            required
            validateStatus={justificationTouched && !noteValid ? 'error' : ''}
            help={
              justificationTouched && !noteValid
                ? t('studyLoad.distribution.suitability.noteMinLengthHint', {
                    count: noteMinLength,
                  })
                : undefined
            }
          >
            <Input.TextArea
              rows={3}
              placeholder={t('studyLoad.distribution.suitability.notePlaceholder')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => setJustificationTouched(true)}
              style={{ resize: 'none' }}
            />
          </Form.Item>
        </div>
      ) : null}

      <ModalFooter
        spacing="none"
        cancelLabel={t('studyLoad.common.cancel')}
        confirmLabel={t('studyLoad.distribution.electiveChoice.confirm')}
        confirmIcon={<CheckOutlined />}
        loading={mutation.isPending}
        confirmDisabled={
          !picked ||
          !pickedOption?.selectable ||
          picked === currentScienceId ||
          (requiresJustification && !justificationValid)
        }
        onConfirm={() => void handleConfirm()}
      />
    </div>
  );
};

export default ElectiveChoiceModal;
