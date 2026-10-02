import { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { Col, Row, Upload } from 'antd';
import {
  App,
  Button,
  DatePicker,
  Divider,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Textarea,
} from '@/shared/ui';
import { InboxOutlined, PaperClipOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';
import type { RcFile } from 'antd/es/upload';
import dayjs from 'dayjs';
import { getApiErrorMessage } from '@/shared/api';
import { useAssignableUsers, useCategoriesData, useTaskActions } from '../../api/queries';
import { colors } from '../../lib/theme';
import { RANGE_DISPLAY_FORMAT, displayToIso } from '../../lib/date-range';
import type { Task, TaskPriorityUz, TaskUser } from '../../model/types';
import {
  ALLOWED_FILE_EXTS,
  ALLOWED_FILE_LABEL,
  MAX_FILE_MB,
} from '../../lib/file-rules';

const StyledModal = styled(Modal)`
  .ant-modal-content { border-radius: 16px; padding: 0; overflow: hidden; }
  .ant-modal-header { padding: 20px 24px 16px; border-bottom: 1px solid ${colors.border}; margin: 0; }
  .ant-modal-title { font-size: 18px; font-weight: 700; color: ${colors.textPrimary}; }
  .ant-modal-body { padding: 20px 24px; }
  .ant-modal-footer { padding: 16px 24px; border-top: 1px solid ${colors.border}; margin: 0; }
  .ant-modal-close { top: 16px; }
`;

const FormLabel = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: ${colors.textPrimary};
  margin-bottom: 6px;
`;

const UploadArea = styled.div`
  border: 2px dashed ${colors.border};
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s;
  background: ${colors.bgGray};

  &:hover { border-color: ${colors.primary}; }
  .anticon { font-size: 24px; color: ${colors.textSecondary}; }
`;

const UploadText = styled.div`
  font-size: 13px;
  color: ${colors.textSecondary};
  margin-top: 6px;
`;

const PickerBar = styled.div`
  padding: 8px 12px 6px;
`;
const PickerHint = styled.div`
  font-size: 12px;
  color: ${colors.textSecondary};
  margin-bottom: 2px;
`;
const SelectedCount = styled.span`
  margin-left: 8px;
  font-weight: 600;
  color: ${colors.primary};
`;


interface FormValues {
  title: string;
  description?: string;
  assignees: string | string[];
  deadline: string;
  priority: TaskPriorityUz;
  category?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  editTask?: Task | null;
  onSuccess?: () => void;
}

export default function CreateTaskModal({ open, onClose, editTask = null, onSuccess }: Props) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const { addTask, updateTask } = useTaskActions();
  const { categories, categoryId } = useCategoriesData();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigneeQuery, setAssigneeQuery] = useState('');

  const isEdit = !!editTask;

  const validateFileUpload = (file: RcFile): boolean | typeof Upload.LIST_IGNORE => {
    if (!ALLOWED_FILE_EXTS.test(file.name)) {
      message.error(`${file.name}: ${ALLOWED_FILE_LABEL} formatlar qabul qilinadi`);
      return Upload.LIST_IGNORE;
    }
    if (file.size / 1024 / 1024 > MAX_FILE_MB) {
      message.error(`${file.name}: Hajm ${MAX_FILE_MB} MB dan oshmasligi kerak`);
      return Upload.LIST_IGNORE;
    }
    return false;
  };

  const watchedAssignees = Form.useWatch('assignees', form);
  const selectedIds = useMemo(
    () => (Array.isArray(watchedAssignees) ? watchedAssignees : []),
    [watchedAssignees],
  );

  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(assigneeQuery), 350);
    return () => clearTimeout(t);
  }, [assigneeQuery]);

  const { users, total: scopeTotal, loading: usersLoading } = useAssignableUsers(debouncedQuery);

  const [knownUsers, setKnownUsers] = useState<Map<string, TaskUser>>(new Map());
  useEffect(() => {
    if (!users.length) return;
    setKnownUsers((prev) => {
      const next = new Map(prev);
      users.forEach((u) => next.set(u.id, u));
      return next;
    });
  }, [users]);

  const toOption = (u: TaskUser) => ({ value: u.id, label: u.name, desc: u.position });

  const loadedOptions = useMemo(() => users.map(toOption), [users]);

  const assigneeOptions = useMemo(() => {
    const map = new Map(loadedOptions.map((o) => [o.value, o]));
    selectedIds.forEach((id) => {
      if (!map.has(id)) {
        const u = knownUsers.get(id);
        if (u) map.set(id, toOption(u));
      }
    });
    if (isEdit && editTask) {
      const cur = editTask.assignees[0];
      if (cur && !map.has(cur.id)) map.set(cur.id, toOption(cur));
    }
    return [...map.values()];
  }, [loadedOptions, selectedIds, knownUsers, isEdit, editTask]);

  const isFiltering = debouncedQuery.trim().length > 0;
  const hasMore = scopeTotal > loadedOptions.length;

  const selectAllVisible = () =>
    form.setFieldValue('assignees', [...new Set([...selectedIds, ...loadedOptions.map((o) => o.value)])]);
  const clearAssignees = () => form.setFieldValue('assignees', []);

  useEffect(() => {
    if (open) {
      setAssigneeQuery('');
      setDebouncedQuery('');
    }
    if (open && isEdit && editTask) {
      form.setFieldsValue({
        title: editTask.title,
        description: editTask.description || '',
        assignees: editTask.assignees[0]?.id,
        deadline: editTask.deadline ? dayjs(editTask.deadline).format('YYYY-MM-DD') : undefined,
        priority: editTask.priority,
        category: editTask.category ?? undefined,
      });
      setFileList([]);
    }
    if (open && !isEdit) {
      form.resetFields();
      setFileList([]);
    }
  }, [open, isEdit, editTask, form]);

  const collectFiles = (): File[] =>
    fileList.map((f) => f.originFileObj).filter((f): f is RcFile => !!f);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const values = await form.validateFields();
      const files = collectFiles();

      if (isEdit && editTask) {
        const catName = values.category;
        const catFound = catName != null ? categoryId(catName) : undefined;
        const catUpdate =
          catName == null ? { categoryId: null } : catFound != null ? { categoryId: catFound } : {};
        await updateTask(editTask.id, {
          title: values.title,
          description: values.description || '',
          deadline: values.deadline,
          priority: values.priority,
          ...catUpdate,
          files,
        });
        message.success('Topshiriq yangilandi!');
      } else {
        await addTask({
          title: values.title,
          description: values.description || '',
          assigneeIds: values.assignees as string[],
          deadline: values.deadline,
          priority: values.priority,
          categoryId: categoryId(values.category),
          files,
        });
        message.success('Topshiriq muvaffaqiyatli yaratildi!');
      }

      form.resetFields();
      setFileList([]);
      onSuccess?.();
      onClose();
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error(getApiErrorMessage(err, 'Xatolik yuz berdi'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <StyledModal
      title={isEdit ? 'Topshiriqni tahrirlash' : 'Yangi topshiriq yaratish'}
      open={open}
      onCancel={onClose}
      width={680}
      footer={[
        <Button key="cancel" onClick={onClose} size="large" style={{ borderRadius: 8 }}>
          Bekor qilish
        </Button>,
        <Button
          key="submit"
          type="primary"
          size="large"
          loading={loading}
          onClick={handleSubmit}
          style={{ background: colors.primary, borderColor: colors.primary, borderRadius: 8 }}
        >
          {isEdit ? 'Saqlash' : 'Yuborish'}
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item
          name="title"
          label={<FormLabel>Topshiriq sarlavhasi <span style={{ color: colors.danger }}>*</span></FormLabel>}
          rules={[{ required: true, message: 'Topshiriq sarlavhasini kiriting' }]}
        >
          <Input placeholder="Topshiriq nomini kiriting" size="large" style={{ borderRadius: 8 }} />
        </Form.Item>

        <Form.Item name="description" label={<FormLabel>Tavsif</FormLabel>}>
          <Textarea
            placeholder="Topshiriq haqida batafsil ma'lumot kiriting..."
            rows={3}
            style={{ borderRadius: 8, resize: 'none' }}
          />
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="assignees"
              label={
                <FormLabel>
                  {isEdit ? 'Ijrochi' : 'Ijrochilar'} <span style={{ color: colors.danger }}>*</span>
                  {!isEdit && selectedIds.length > 0 && (
                    <SelectedCount>{selectedIds.length} ta tanlandi</SelectedCount>
                  )}
                </FormLabel>
              }
              rules={[{ required: true, message: isEdit ? 'Ijrochi tanlang' : 'Kamida bitta ijrochi tanlang' }]}
            >
              <Select
                mode={isEdit ? undefined : 'multiple'}
                disabled={isEdit}
                placeholder="Xodimlarni tanlang"
                size="large"
                style={{ width: '100%' }}
                showSearch
                filterOption={false}
                onSearch={setAssigneeQuery}
                notFoundContent={usersLoading ? <Spin size="small" /> : 'Xodim topilmadi'}
                maxTagCount={isEdit ? undefined : 'responsive'}
                options={assigneeOptions}
                optionRender={(opt) => (
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{opt.data.label}</div>
                    <div style={{ fontSize: 12, color: colors.textSecondary }}>{opt.data.desc}</div>
                  </div>
                )}
                popupRender={
                  isEdit
                    ? undefined
                    : (menu) => (
                        <>
                          <PickerBar>
                            <PickerHint>
                              {isFiltering
                                ? `Qidiruv natijasi: ${scopeTotal} ta`
                                : `Sizga ruxsat etilgan: ${scopeTotal} ta`}
                              {hasMore && ` · ${loadedOptions.length} tasi ko'rsatilyapti`}
                              {selectedIds.length > 0 && ` · ${selectedIds.length} ta tanlandi`}
                            </PickerHint>
                            <Space size={12}>
                              <Button
                                type="link"
                                size="small"
                                style={{ padding: 0, height: 'auto' }}
                                disabled={!loadedOptions.length}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={selectAllVisible}
                              >
                                {isFiltering || hasMore
                                  ? "Ko'rinayotganlarni belgilash"
                                  : 'Barchasini belgilash'}
                              </Button>
                              <Button
                                type="link"
                                size="small"
                                danger
                                style={{ padding: 0, height: 'auto' }}
                                disabled={!selectedIds.length}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={clearAssignees}
                              >
                                Tanlovni bekor qilish
                              </Button>
                            </Space>
                          </PickerBar>
                          <Divider style={{ margin: 0 }} />
                          {menu}
                        </>
                      )
                }
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="deadline"
              label={<FormLabel>Bajarish muddati <span style={{ color: colors.danger }}>*</span></FormLabel>}
              rules={[{ required: true, message: 'Muddat belgilang' }]}
              getValueFromEvent={displayToIso}
            >
              <DatePicker
                style={{ width: '100%', borderRadius: 8 }}
                disabledDate={(d) => !!d && d < dayjs().startOf('day')}
                format={RANGE_DISPLAY_FORMAT}
                placeholder="Muddatni tanlang"
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="priority" initialValue="o'rta" label={<FormLabel>Muhimlik darajasi</FormLabel>}>
              <Select
                size="large"
                style={{ width: '100%' }}
                options={[
                  { value: 'yuqori', label: '🔴 Yuqori' },
                  { value: "o'rta", label: "🟡 O'rta" },
                  { value: 'past', label: '🟢 Past' },
                ]}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="category" label={<FormLabel>Kategoriya</FormLabel>}>
              <Select
                size="large"
                style={{ width: '100%' }}
                allowClear
                placeholder="Kategoriya tanlang"
                options={categories.map((c) => ({ value: c, label: c }))}
              />
            </Form.Item>
          </Col>
        </Row>

        <div>
          <FormLabel>{isEdit ? "Qo'shimcha fayllar" : 'Fayllar biriktirish'}</FormLabel>
          <Upload
            fileList={fileList}
            onChange={({ fileList: fl }) => setFileList(fl)}
            beforeUpload={validateFileUpload}
            multiple
          >
            <UploadArea>
              <InboxOutlined />
              <UploadText>
                Fayllarni bu yerga sudrab tashlang yoki{' '}
                <span style={{ color: colors.primary, cursor: 'pointer' }}>tanlang</span>
              </UploadText>
              <div style={{ fontSize: 12, color: '#bbb', marginTop: 4 }}>
                <PaperClipOutlined /> PDF, DOCX, XLSX, JPG, PNG qabul qilinadi
              </div>
            </UploadArea>
          </Upload>
        </div>
      </Form>
    </StyledModal>
  );
}
