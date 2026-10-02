import { useEffect, useState } from 'react';
import { App, Input, InputNumber, Modal, Select, Space, Typography } from 'antd';
import { useAddElectiveRow, type AddElectiveRowPayload } from '../../api/detail-api';
import { useElectiveSciences } from '../../api/references';
import { MAX_ALTERNATIVES, type BlockFreeQuota } from '../../model/elective-block';
import { getApiErrorMessage } from '@/shared/api';
import { useTranslation } from '@/shared/lib/i18n';

const { Text } = Typography;

export interface ElectiveRowModalBlock {
  blockCode: string;
  title: string | null;
  freeQuota: BlockFreeQuota;
}

interface IProps {
  open: boolean;
  block: ElectiveRowModalBlock | null;
  planId: string | undefined;
  onClose: () => void;
}

interface SemesterInput {
  hour: number;
  credit: number;
}

function sortedSemKeys(freeQuota: BlockFreeQuota): string[] {
  return Object.keys(freeQuota).sort((a, b) => Number(a) - Number(b));
}

const ElectiveRowModal = ({ open, block, planId, onClose }: IProps) => {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const addMutation = useAddElectiveRow(planId);
  const sciencesQuery = useElectiveSciences();

  const [scienceId, setScienceId] = useState<string | undefined>(undefined);
  const [serialNumber, setSerialNumber] = useState('');
  const [selectedSemKeys, setSelectedSemKeys] = useState<string[]>([]);
  const [semValues, setSemValues] = useState<Record<string, SemesterInput>>({});
  const [altIds, setAltIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setScienceId(undefined);
      setSerialNumber('');
      setSelectedSemKeys([]);
      setSemValues({});
      setAltIds([]);
    }
  }, [open]);

  const semKeys = block ? sortedSemKeys(block.freeQuota) : [];

  const handleSemesterToggle = (keys: string[]) => {
    setSelectedSemKeys(keys);
    setSemValues((prev) => {
      const next: Record<string, SemesterInput> = {};
      for (const k of keys) {
        next[k] = prev[k] ?? { hour: 0, credit: 0 };
      }
      return next;
    });
  };

  const handleSemesterFieldChange = (
    semKey: string,
    field: 'hour' | 'credit',
    val: number | null,
  ) => {
    setSemValues((prev) => {
      const cur = prev[semKey] ?? { hour: 0, credit: 0 };
      const next: SemesterInput = { ...cur, [field]: val ?? 0 };
      if (field === 'credit' && (cur.hour === 0 || cur.hour === cur.credit)) {
        next.hour = val ?? 0;
      }
      return { ...prev, [semKey]: next };
    });
  };

  const canSubmit = Boolean(scienceId) && selectedSemKeys.length > 0;

  const handleSubmit = async () => {
    if (!block || !scienceId || selectedSemKeys.length === 0) return;
    const payload: AddElectiveRowPayload = {
      blockCode: block.blockCode,
      science: scienceId,
      serialNumber: serialNumber || undefined,
      semesters: selectedSemKeys.map((semKey) => ({
        semester: semKey,
        hour: semValues[semKey]?.hour ?? 0,
        credit: semValues[semKey]?.credit ?? 0,
      })),
      alternatives: altIds.length > 0 ? altIds.map((id) => ({ scienceId: id })) : undefined,
    };
    try {
      const result = await addMutation.mutateAsync(payload);
      message.success(t('studyLoad.studyPlan.electiveRow.success'));
      if (result.warning) message.warning(result.warning);
      onClose();
    } catch (err) {
      message.error(getApiErrorMessage(err, t('studyLoad.studyPlan.electiveRow.errorDefault')));
    }
  };

  const scienceOptions = (sciencesQuery.data ?? []).map((s) => ({
    value: s.id,
    label: s.code ? `${s.code} — ${s.title}` : s.title,
  }));
  const alternativeOptions = scienceOptions.filter((o) => o.value !== scienceId);

  return (
    <Modal
      open={open}
      title={t('studyLoad.studyPlan.electiveRow.modalTitle')}
      okText={t('studyLoad.common.add')}
      cancelText={t('studyLoad.common.cancel')}
      confirmLoading={addMutation.isPending}
      okButtonProps={{ disabled: !canSubmit }}
      onCancel={onClose}
      onOk={() => void handleSubmit()}
      destroyOnHidden
    >
      {block ? (
        <>
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary">{t('studyLoad.studyPlan.electiveRow.blockLabel')}</Text>
            <Text strong>{block.title ?? block.blockCode}</Text>
          </div>

          <div style={{ marginBottom: 12 }}>
            <Text style={{ display: 'block', marginBottom: 4 }}>
              {t('studyLoad.studyPlan.electiveRow.scienceLabel')}
            </Text>
            <Select
              showSearch
              style={{ width: '100%' }}
              placeholder={t('studyLoad.studyPlan.electiveRow.sciencePlaceholder')}
              loading={sciencesQuery.isLoading}
              value={scienceId}
              onChange={(v) => setScienceId(v)}
              optionFilterProp="label"
              options={scienceOptions}
              notFoundContent={
                sciencesQuery.isLoading
                  ? t('studyLoad.studyPlan.electiveRow.loadingOption')
                  : t('studyLoad.studyPlan.electiveRow.emptyCatalog')
              }
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <Text style={{ display: 'block', marginBottom: 4 }}>
              {t('studyLoad.studyPlan.electiveRow.serialNumberLabel')}
            </Text>
            <Input
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              placeholder={t('studyLoad.studyPlan.electiveRow.serialNumberPlaceholder')}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <Text style={{ display: 'block', marginBottom: 4 }}>
              {t('studyLoad.studyPlan.electiveRow.semesterLabel')}
            </Text>
            <Select
              mode="multiple"
              style={{ width: '100%' }}
              placeholder={t('studyLoad.studyPlan.electiveRow.semesterPlaceholder')}
              value={selectedSemKeys}
              onChange={handleSemesterToggle}
              options={semKeys.map((k) => {
                const q = block.freeQuota[k];
                return {
                  value: k,
                  label: t('studyLoad.studyPlan.electiveRow.semesterOption', {
                    n: k,
                    hour: q?.hour ?? 0,
                    credit: q?.credit ?? 0,
                  }),
                };
              })}
              notFoundContent={t('studyLoad.studyPlan.electiveRow.noQuotaSemesters')}
            />
          </div>

          {selectedSemKeys.length > 0 ? (
            <div style={{ marginBottom: 12 }}>
              <Text style={{ display: 'block', marginBottom: 4 }}>
                {t('studyLoad.studyPlan.electiveRow.perSemesterLabel')}
              </Text>
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                {selectedSemKeys.map((semKey) => (
                  <Space key={semKey} size={8}>
                    <Text style={{ width: 64 }}>
                      {t('studyLoad.studyPlan.electiveRow.semShortLabel', { n: semKey })}
                    </Text>
                    <InputNumber
                      min={0}
                      addonAfter={t('studyLoad.studyPlan.electiveRow.hourAddon')}
                      value={semValues[semKey]?.hour ?? 0}
                      onChange={(v) => handleSemesterFieldChange(semKey, 'hour', v)}
                    />
                    <InputNumber
                      min={0}
                      addonAfter={t('studyLoad.studyPlan.electiveRow.creditAddon')}
                      value={semValues[semKey]?.credit ?? 0}
                      onChange={(v) => handleSemesterFieldChange(semKey, 'credit', v)}
                    />
                  </Space>
                ))}
              </Space>
            </div>
          ) : null}

          <div>
            <Text style={{ display: 'block', marginBottom: 4 }}>
              {t('studyLoad.studyPlan.electiveRow.alternativesLabel', { max: MAX_ALTERNATIVES })}
            </Text>
            <Select
              mode="multiple"
              maxCount={MAX_ALTERNATIVES}
              style={{ width: '100%' }}
              placeholder={t('studyLoad.studyPlan.electiveRow.alternativesPlaceholder')}
              loading={sciencesQuery.isLoading}
              value={altIds}
              onChange={(v) => setAltIds(v)}
              optionFilterProp="label"
              options={alternativeOptions}
            />
          </div>
        </>
      ) : null}
    </Modal>
  );
};

export default ElectiveRowModal;
