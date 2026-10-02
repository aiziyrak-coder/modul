import { useEffect, useMemo } from 'react';
import { App, DatePicker, Form, InputNumber, Modal, Select, Tag, Typography } from 'antd';
import type { Dayjs } from 'dayjs';
import { getApiErrorMessage } from '@/shared/api';
import { useDocSetting, useRankApps, useVotingCreate } from '../../api/council-api';
import type { VotingInput } from '../../api/backend';
import type { RankApplication } from '../../model/types';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface FormValues {
  rankType: string;
  departmentId?: string;
  range: [Dayjs, Dayjs];
  passingPercent: number;
}

const matches = (a: RankApplication, rank?: string, deptId?: string): boolean =>
  (!rank || a.rankType.toLowerCase() === rank.toLowerCase()) &&
  (!deptId || a.department?.id === deptId);

export function VotingCreateModal({ open, onClose }: Props) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();

  const acceptedApps = useRankApps({ status: 'accepted', category: 'position' });
  const docSetting = useDocSetting();
  const create = useVotingCreate();

  const watchedRankType = Form.useWatch('rankType', form);
  const watchedDepartmentId = Form.useWatch('departmentId', form);

  useEffect(() => {
    if (open && docSetting.data) {
      form.setFieldsValue({ passingPercent: docSetting.data.passingPercent });
    }
  }, [open, docSetting.data, form]);

  const eligible = useMemo(
    () => (acceptedApps.data ?? []).filter((a) => !a.archived),
    [acceptedApps.data],
  );

  const rankOptions = (docSetting.data?.positionTypes ?? []).map((rt) => ({ value: rt, label: rt }));

  const departmentOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const a of eligible) {
      if (!matches(a, watchedRankType)) continue;
      if (a.department && !seen.has(a.department.id)) seen.set(a.department.id, a.department.title);
    }
    return Array.from(seen.entries()).map(([value, label]) => ({ value, label }));
  }, [eligible, watchedRankType]);

  const candidates = useMemo(() => {
    const byUser = new Map<string, { userId: string; label: string; department: string | null }>();
    for (const a of eligible) {
      if (!matches(a, watchedRankType, watchedDepartmentId)) continue;
      if (byUser.has(a.applicant.id)) continue;
      byUser.set(a.applicant.id, {
        userId: a.applicant.id,
        label: a.applicant.fullName || '—',
        department: a.department?.title ?? null,
      });
    }
    return [...byUser.values()];
  }, [eligible, watchedRankType, watchedDepartmentId]);

  const close = () => {
    form.resetFields();
    onClose();
  };

  const submit = async () => {
    const values = await form.validateFields();
    if (!candidates.length) {
      message.error("Tanlangan unvon turi bo'yicha tasdiqlangan ariza yo'q");
      return;
    }
    const input: VotingInput = {
      departmentId: values.departmentId || undefined,
      rankType: values.rankType,
      candidates: candidates.map((c) => ({ userId: c.userId })),
      startDate: values.range[0].toISOString(),
      endDate: values.range[1].toISOString(),
      passingPercent: values.passingPercent,
    };
    try {
      await create.mutateAsync(input);
      message.success('So‘rovnoma yaratildi');
      close();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  return (
    <Modal
      open={open}
      onCancel={close}
      onOk={submit}
      okText="Yaratish"
      cancelText="Bekor qilish"
      title="So'rovnoma yaratish"
      centered
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto', overflowX: 'hidden' } }}
      width={560}
      confirmLoading={create.isPending}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item
          name="rankType"
          label="Lavozim turi"
          rules={[{ required: true, message: 'Lavozim turini tanlang' }]}
        >
          <Select
            placeholder="Lavozim turi"
            loading={docSetting.isLoading}
            options={rankOptions}
            onChange={() => form.setFieldsValue({ departmentId: undefined })}
          />
        </Form.Item>

        <Form.Item name="departmentId" label="Kafedra (ixtiyoriy)">
          <Select
            allowClear
            placeholder="Barcha kafedralar"
            loading={acceptedApps.isLoading}
            options={departmentOptions}
            disabled={!watchedRankType}
            showSearch
            optionFilterProp="label"
          />
        </Form.Item>

        <Form.Item
          label={`Nomzodlar${candidates.length ? ` (${candidates.length})` : ''}`}
          extra="Lavozimlar → Tasdiqlangan bo'limidagi mos arizalar avtomatik kiritiladi. Bir nomzod — Ha/Yo'q ovozi; ikki va undan ortiq — nomzod tanlab ovoz berish."
        >
          {!watchedRankType ? (
            <Typography.Text type="secondary">Avval lavozim turini tanlang</Typography.Text>
          ) : candidates.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {candidates.map((c) => (
                <Tag key={c.userId} style={{ margin: 0 }}>
                  {c.label}
                  {c.department ? ` · ${c.department}` : ''}
                </Tag>
              ))}
            </div>
          ) : (
            <Typography.Text type="danger">
              Bu unvon turi bo'yicha tasdiqlangan ariza yo'q
            </Typography.Text>
          )}
        </Form.Item>

        <Form.Item
          name="range"
          label="Muddat"
          rules={[{ required: true, message: 'Boshlanish va tugash sanasini tanlang' }]}
        >
          <DatePicker.RangePicker
            style={{ width: '100%' }}
            showTime
            format="DD.MM.YYYY HH:mm"
            placeholder={['Boshlanish sanasi', 'Tugash sanasi']}
          />
        </Form.Item>

        <Form.Item
          name="passingPercent"
          label="O'tish foizi"
          rules={[{ required: true, message: "O'tish foizini kiriting" }]}
        >
          <InputNumber min={1} max={100} style={{ width: '100%' }} addonAfter="%" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
