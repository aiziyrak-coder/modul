import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { InboxOutlined } from '@ant-design/icons';
import {
  App,
  Button,
  Col,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Spin,
  Switch,
  Typography,
  Upload,
} from 'antd';
import { getApiErrorMessage } from '@/shared/api';
import { useTranslation } from '@/shared/lib/i18n';
import type { ReferenceRecord } from './reference-types';
import type { ReferenceConfig, ReferenceField } from './types';
import { toNumberList } from './number-list';
import {
  useReferenceOne,
  useReferenceCreate,
  useReferenceUpdate,
  useReferenceOptions,
  type ReferencePayload,
} from './reference-api';

const { Text } = Typography;
const LabelStyle = { fontWeight: 500, fontSize: 14, color: 'var(--color-text)' } as const;

function ReferenceSelectField({
  optionsRoot,
  multiple,
  placeholder,
  value,
  onChange,
}: {
  optionsRoot?: string;
  multiple?: boolean;
  placeholder?: string;
  value?: string | string[];
  onChange?: (v: string | string[]) => void;
}) {
  const { data, isLoading } = useReferenceOptions(optionsRoot);
  return (
    <Select
      size="large"
      mode={multiple ? 'multiple' : undefined}
      loading={isLoading}
      options={data ?? []}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      allowClear
      showSearch
      optionFilterProp="label"
      style={{ width: '100%' }}
    />
  );
}

function resolveValue(field: ReferenceField, record: ReferenceRecord): unknown {
  const raw = record[field.name];
  const toId = (v: unknown): unknown =>
    v && typeof v === 'object' && '_id' in (v as Record<string, unknown>)
      ? (v as { _id: string })._id
      : v;
  if (field.type === 'multiselect') return Array.isArray(raw) ? raw.map(toId) : [];
  if (field.type === 'select') return toId(raw);
  return raw;
}

interface Props {
  config: ReferenceConfig;
  editId: string | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ReferenceFormModal({ config, editId, open, onClose, onSuccess }: Props) {
  const isEdit = !!editId;
  const { t } = useTranslation();
  const tp = (key?: string): string | undefined => (key ? t(key) : undefined);
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [files, setFiles] = useState<Record<string, File>>({});

  const { data: record, isLoading: loadingRecord } = useReferenceOne(
    config.root,
    editId ?? undefined,
  );
  const create = useReferenceCreate(config.root, config.multipart);
  const update = useReferenceUpdate(config.root, config.multipart);

  const imageFields = useMemo(
    () => config.fields.filter((f) => f.type === 'image'),
    [config.fields],
  );
  const numberListFields = useMemo(
    () => config.fields.filter((f) => f.type === 'numberlist'),
    [config.fields],
  );

  useEffect(() => {
    if (!open) return;
    if (!isEdit) {
      form.resetFields();
      setFiles({});
      return;
    }
    if (!record) return;
    const values: Record<string, unknown> = {};
    for (const field of config.fields) {
      if (field.type === 'image') continue;
      values[field.name] = resolveValue(field, record);
    }
    form.setFieldsValue(values);
  }, [open, record, isEdit, config.fields, form]);

  const handleClose = () => {
    form.resetFields();
    setFiles({});
    onClose();
  };

  const onFinish = async (values: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      const payload: ReferencePayload = { ...(values as ReferencePayload) };
      for (const field of imageFields) {
        if (files[field.name]) payload[field.name] = files[field.name];
        else delete payload[field.name];
      }
      for (const field of numberListFields) {
        payload[field.name] = toNumberList(payload[field.name]);
      }
      if (isEdit && editId) {
        await update.mutateAsync({ id: editId, payload });
        message.success(t('admin.common.updated'));
      } else {
        await create.mutateAsync(payload);
        message.success(t('admin.common.created'));
      }
      onSuccess();
      handleClose();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const title = t(isEdit ? config.labels.editTitleKey : config.labels.createTitleKey);

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      title={
        <Text style={{ fontWeight: 600, fontSize: 18, color: 'var(--color-text)' }}>
          {title}
        </Text>
      }
      footer={null}
      width={545}
      centered
      destroyOnClose
      style={{ maxHeight: '80vh' }}
      styles={{
        body: {
          maxHeight: 'calc(80vh - 120px)',
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingTop: 8,
        },
        content: { overflowX: 'hidden' },
      }}
    >
      {isEdit && loadingRecord ? (
        <Flex justify="center" style={{ padding: 40 }}>
          <Spin />
        </Flex>
      ) : (
        <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Row gutter={[12, 4]}>
            {config.fields.map((field) => {
              const fieldLabel = t(field.labelKey);
              const label = <Text style={LabelStyle}>{fieldLabel}</Text>;
              const isRequired = field.required || (field.requiredOnCreate && !isEdit);
              const rules = isRequired
                ? [{ required: true, message: t('admin.common.required') }]
                : undefined;

              if (field.type === 'image') {
                const existing =
                  (record?.[field.valueFrom ?? 'flag'] as string | undefined) ?? undefined;
                const picked = files[field.name];
                return (
                  <Col span={field.span ?? 24} key={field.name}>
                    <Form.Item label={label}>
                      <Upload.Dragger
                        multiple={false}
                        showUploadList={false}
                        accept="image/*"
                        beforeUpload={(file) => {
                          setFiles((prev) => ({ ...prev, [field.name]: file as File }));
                          return false;
                        }}
                      >
                        {picked ? (
                          <Text>{picked.name}</Text>
                        ) : existing ? (
                          <img
                            src={existing}
                            alt={fieldLabel}
                            style={{ maxHeight: 64, borderRadius: 6 }}
                          />
                        ) : (
                          <>
                            <p className="ant-upload-drag-icon">
                              <InboxOutlined />
                            </p>
                            <p>{tp(field.placeholderKey) ?? fieldLabel}</p>
                          </>
                        )}
                      </Upload.Dragger>
                    </Form.Item>
                  </Col>
                );
              }

              let control: ReactNode;
              switch (field.type) {
                case 'textarea':
                  control = <Input.TextArea rows={3} placeholder={tp(field.placeholderKey)} />;
                  break;
                case 'number':
                  control = (
                    <InputNumber
                      size="large"
                      style={{ width: '100%' }}
                      placeholder={tp(field.placeholderKey)}
                    />
                  );
                  break;
                case 'switch':
                  control = <Switch />;
                  break;
                case 'select':
                case 'multiselect':
                  control = (
                    <ReferenceSelectField
                      optionsRoot={field.optionsRoot}
                      multiple={field.type === 'multiselect'}
                      placeholder={tp(field.placeholderKey)}
                    />
                  );
                  break;
                case 'numberlist':
                  control = (
                    <Select
                      mode="tags"
                      size="large"
                      style={{ width: '100%' }}
                      placeholder={tp(field.placeholderKey)}
                      tokenSeparators={[',', ' ']}
                    />
                  );
                  break;
                default:
                  control = <Input size="large" placeholder={tp(field.placeholderKey)} />;
              }

              return (
                <Col span={field.span ?? 24} key={field.name}>
                  <Form.Item
                    name={field.name}
                    label={label}
                    rules={rules}
                    valuePropName={field.type === 'switch' ? 'checked' : 'value'}
                  >
                    {control}
                  </Form.Item>
                </Col>
              );
            })}
          </Row>

          <Flex
            justify="flex-end"
            gap={12}
            style={{ marginTop: 8, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}
          >
            <Button
              onClick={handleClose}
              style={{
                background: 'var(--color-border-soft)',
                color: 'var(--color-text)',
                border: 'none',
                height: 44,
                minWidth: 100,
                fontWeight: 500,
              }}
            >
              {t('admin.common.cancel')}
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              style={{ height: 44, minWidth: 120, fontWeight: 500 }}
            >
              {t(isEdit ? 'admin.common.save' : 'admin.common.create')}
            </Button>
          </Flex>
        </Form>
      )}
    </Modal>
  );
}
