import { useEffect, useMemo, useState } from 'react';
import { Alert, App, Button, Checkbox, Flex, Form, Modal, Select, Typography, Upload } from 'antd';
import type { UploadFile } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { getApiErrorMessage } from '@/shared/api';
import type { RankAppInput } from '../../api/backend';
import { useDocSetting, useRankCreate, useRankUpdate, useReferenceList } from '../../api/council-api';
import type { DocItem, RankApplication, RankCategory } from '../../model/types';

const { Text } = Typography;

interface Props {
  open: boolean;
  application?: RankApplication | null;
  category: RankCategory;
  onClose: () => void;
  onSuccess?: () => void;
}

const FALLBACK_TYPES: Record<RankCategory, string[]> = {
  rank: ['Dotsent', 'Professor'],
  position: ['Stajor', "Assistent (o'qituvchi)", "Katta o'qituvchi", 'V.B. Dotsent', 'V.B. Professor'],
};

const UI: Record<RankCategory, { title: string; editTitle: string; typeLabel: string; typePlaceholder: string }> = {
  rank: {
    title: 'Unvon arizasi topshirish',
    editTitle: 'Unvon arizasini tahrirlash',
    typeLabel: 'Unvon turi',
    typePlaceholder: 'Unvon turini tanlang',
  },
  position: {
    title: 'Lavozim arizasi topshirish',
    editTitle: 'Lavozim arizasini tahrirlash',
    typeLabel: 'Lavozim turi',
    typePlaceholder: 'Lavozim turini tanlang',
  },
};

const UPLOAD_ACCEPT = '.pdf,.jpg,.jpeg,.png,.docx';

export function RankSubmitModal({ open, application, category, onClose, onSuccess }: Props) {
  const { message } = App.useApp();
  const isEdit = Boolean(application);

  const [rankType, setRankType] = useState<string>('');
  const [departmentId, setDepartmentId] = useState<string | undefined>();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [docFiles, setDocFiles] = useState<Record<string, UploadFile[]>>({});

  const { data: docSetting, isError: docSettingError, isLoading: docSettingLoading } = useDocSetting();
  const departments = useReferenceList('departments');
  const create = useRankCreate();
  const update = useRankUpdate();

  const rankTypes = useMemo<string[]>(() => {
    const list = (category === 'position' ? docSetting?.positionTypes : docSetting?.rankTypes) ?? [];
    return list.length ? list : FALLBACK_TYPES[category];
  }, [docSetting, category]);

  const rankOptions = useMemo(
    () => rankTypes.map((rt) => ({ value: rt, label: rt })),
    [rankTypes],
  );

  const selectedRankType = useMemo(() => {
    if (!rankType) return rankTypes[0] ?? '';
    return rankTypes.find((rt) => rt.toLowerCase() === rankType.toLowerCase()) ?? rankType;
  }, [rankType, rankTypes]);

  const checklist: DocItem[] = useMemo(() => {
    const list = docSetting?.categories[category] ?? [];
    return [...list].sort((a, b) => a.order - b.order);
  }, [docSetting, category]);

  useEffect(() => {
    if (!open) return;
    if (application) {
      setRankType(application.rankType);
      setDepartmentId(application.department?.id);
      const names = new Set(application.submittedDocs.map((d) => d.name));
      const next: Record<string, boolean> = {};
      names.forEach((n) => {
        next[n] = true;
      });
      setChecked(next);
    } else {
      setRankType('');
      setDepartmentId(undefined);
      setChecked({});
    }
    setDocFiles({});
  }, [open, application]);

  const toggle = (name: string, value: boolean) =>
    setChecked((prev) => ({ ...prev, [name]: value }));

  const setDocFileList = (name: string, fileList: UploadFile[]) =>
    setDocFiles((prev) => ({ ...prev, [name]: fileList }));

  const filesOf = (name: string): File[] =>
    (docFiles[name] ?? [])
      .map((f) => f.originFileObj)
      .filter((f): f is NonNullable<typeof f> => Boolean(f));

  const missingRequired = isEdit
    ? checklist.filter((d) => d.required && !checked[d.name])
    : checklist.filter((d) => d.required && filesOf(d.name).length === 0);
  const checklistUnavailable = docSettingError || checklist.length === 0;
  const canSubmit = !checklistUnavailable && missingRequired.length === 0 && Boolean(selectedRankType);
  const loading = create.isPending || update.isPending;

  const submit = async () => {
    if (!canSubmit) return;
    const rankTypeInput = selectedRankType as RankAppInput['rankType'];
    try {
      if (application) {
        const newFiles: { name: string; file: File }[] = [];
        checklist.forEach((d) => {
          if (!checked[d.name]) return;
          filesOf(d.name).forEach((file) => newFiles.push({ name: d.name, file }));
        });
        if (newFiles.length) {
          await update.mutateAsync({
            id: application.id,
            input: { rankType: rankTypeInput, category, departmentId },
            files: newFiles,
          });
        } else {
          const submittedDocs = checklist
            .filter((d) => checked[d.name])
            .map((d) => ({
              name: d.name,
              fileUrl: application.submittedDocs.find((x) => x.name === d.name)?.fileUrl ?? undefined,
            }));
          await update.mutateAsync({
            id: application.id,
            input: { rankType: rankTypeInput, category, departmentId, submittedDocs },
          });
        }
        message.success(
          application.status === 'returned' ? 'Ariza qayta yuborildi' : 'Ariza yangilandi',
        );
      } else {
        const files: { name: string; file: File }[] = [];
        checklist.forEach((d) => {
          filesOf(d.name).forEach((file) => files.push({ name: d.name, file }));
        });
        await create.mutateAsync({
          input: { rankType: rankTypeInput, category, departmentId },
          files,
        });
        message.success('Ariza topshirildi');
      }
      onClose();
      onSuccess?.();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText={application?.status === 'returned' ? 'Qayta yuborish' : isEdit ? 'Saqlash' : 'Topshirish'}
      cancelText="Bekor qilish"
      title={isEdit ? UI[category].editTitle : UI[category].title}
      centered
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto', overflowX: 'hidden' } }}
      width={560}
      confirmLoading={loading}
      okButtonProps={{ disabled: !canSubmit }}
      destroyOnHidden
    >
      <Form layout="vertical" style={{ marginTop: 8 }}>
        <Form.Item label={UI[category].typeLabel} required>
          <Select<string>
            value={selectedRankType || undefined}
            onChange={setRankType}
            options={rankOptions}
            placeholder={UI[category].typePlaceholder}
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Form.Item label="Kafedra">
          <Select
            value={departmentId}
            onChange={setDepartmentId}
            placeholder="Kafedrani tanlang"
            options={(departments.data ?? []).map((d) => ({ value: d.id, label: d.title }))}
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Text strong>Topshiriladigan hujjatlar</Text>
        <Flex vertical gap={10} style={{ marginTop: 10 }}>
          {checklistUnavailable && !docSettingLoading && (
            <Alert
              type="warning"
              showIcon
              message="Hujjat ro'yxati yuklanmadi"
              description="Sozlamalardagi hujjatlar ro'yxati mavjud emas — arizani topshirib bo'lmaydi."
            />
          )}
          {checklist.map((doc) =>
            isEdit ? (
              <Flex key={doc.name} vertical gap={4}>
                <Checkbox
                  checked={Boolean(checked[doc.name])}
                  onChange={(e) => toggle(doc.name, e.target.checked)}
                >
                  {doc.name}
                  {doc.required && <Text type="danger"> *</Text>}
                </Checkbox>
                <Upload
                  maxCount={doc.maxFiles ?? 1}
                  multiple={(doc.maxFiles ?? 1) > 1}
                  beforeUpload={() => false}
                  accept={UPLOAD_ACCEPT}
                  fileList={docFiles[doc.name] ?? []}
                  onChange={({ fileList }) => {
                    setDocFileList(doc.name, fileList);
                    if (fileList.length) toggle(doc.name, true);
                  }}
                >
                  <Button size="small" icon={<UploadOutlined />}>
                    {application?.submittedDocs.some((x) => x.name === doc.name && x.fileUrl)
                      ? 'Faylni almashtirish'
                      : 'Fayl tanlash'}
                  </Button>
                </Upload>
              </Flex>
            ) : (
              <Flex key={doc.name} vertical gap={4}>
                <Text>
                  {doc.name}
                  {doc.required && <Text type="danger"> *</Text>}
                  {(doc.maxFiles ?? 1) > 1 && (
                    <Text type="secondary"> — {doc.maxFiles} tagacha fayl</Text>
                  )}
                </Text>
                <Upload
                  maxCount={doc.maxFiles ?? 1}
                  multiple={(doc.maxFiles ?? 1) > 1}
                  beforeUpload={() => false}
                  accept={UPLOAD_ACCEPT}
                  fileList={docFiles[doc.name] ?? []}
                  onChange={({ fileList }) => setDocFileList(doc.name, fileList)}
                >
                  <Button icon={<UploadOutlined />}>Fayl tanlash</Button>
                </Upload>
              </Flex>
            ),
          )}
        </Flex>
      </Form>
    </Modal>
  );
}
