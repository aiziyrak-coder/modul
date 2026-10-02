import { useEffect, useMemo } from 'react';
import {
  Drawer, Form, Input, InputNumber, Select, Button, Divider, Switch,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from '@/shared/lib/i18n';
import type { Indicator, IndicatorInput } from '../../model/types';
import * as S from './style';

const { TextArea } = Input;

const FIELD_TYPE_VALUES = ['text', 'number', 'money', 'date', 'url', 'textarea', 'file'];

interface Props {
  open: boolean;
  indicator: Indicator | null;
  onClose: () => void;
  onSave: (data: IndicatorInput, id?: string) => void;
}

interface FieldFormValue {
  key?: string;
  label: string;
  type: string;
  required: boolean;
  options?: string;
}

interface FormValues {
  title: string;
  desc: string;
  coefficient: number;
  active: boolean;
  fields: FieldFormValue[];
}

export default function IndicatorDrawer({ open, indicator, onClose, onSave }: Props) {
  const [form] = Form.useForm<FormValues>();
  const { t } = useTranslation();
  const isEdit = !!indicator;

  const fieldTypeOptions = useMemo(
    () => FIELD_TYPE_VALUES.map((value) => ({
      value,
      label: t(`educationQuality.fieldType.${value}`),
    })),
    [t],
  );

  useEffect(() => {
    if (!open) return;
    if (indicator) {
      form.setFieldsValue({
        title: indicator.title,
        desc: indicator.desc ?? '',
        coefficient: indicator.coefficient,
        active: indicator.active,
        fields: indicator.dataFields.map((f) => ({
          key: f.key,
          label: f.label,
          type: f.type,
          required: f.required ?? false,
          options: f.options?.join(', '),
        })),
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        title: '',
        desc: '',
        coefficient: 10,
        active: true,
        fields: [{ label: '', type: 'text', required: false }],
      });
    }
  }, [open, indicator, form]);

  const handleSave = async () => {
    const values = await form.validateFields();
    const dataFields = (values.fields ?? []).map((f, idx) => ({
      key: f.key || `field_${idx}`,
      label: f.label,
      type: f.type as IndicatorInput['dataFields'][number]['type'],
      required: f.required,
      ...(f.type === 'select' && f.options
        ? { options: f.options.split(',').map((s) => s.trim()) }
        : {}),
    }));
    onSave(
      {
        title: values.title,
        desc: values.desc || undefined,
        coefficient: values.coefficient,
        active: values.active,
        dataFields,
      },
      indicator?._id,
    );
  };

  return (
    <Drawer
      title={isEdit
        ? t('educationQuality.indicatorDrawer.editTitle')
        : t('educationQuality.indicatorDrawer.createTitle')}
      width={620}
      open={open}
      onClose={onClose}
      destroyOnHidden
      footer={
        <S.DrawerFooter>
          <Button onClick={onClose}>{t('educationQuality.common.cancel')}</Button>
          <Button type="primary" onClick={handleSave}>
            {t('educationQuality.common.save')}
          </Button>
        </S.DrawerFooter>
      }
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="title"
          label={t('educationQuality.indicatorDrawer.nameLabel')}
          rules={[{ required: true, message: t('educationQuality.indicatorDrawer.nameRequired') }]}
        >
          <Input placeholder={t('educationQuality.indicatorDrawer.namePlaceholder')} />
        </Form.Item>

        <Form.Item name="desc" label={t('educationQuality.indicatorDrawer.descLabel')}>
          <TextArea rows={2} placeholder={t('educationQuality.indicatorDrawer.descPlaceholder')} />
        </Form.Item>

        <div style={{ display: 'flex', gap: 16 }}>
          <Form.Item
            name="coefficient"
            label={t('educationQuality.common.score')}
            rules={[{
              required: true,
              message: t('educationQuality.indicatorDrawer.coefficientRequired'),
            }]}
            style={{ flex: 1 }}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="active"
            label={t('educationQuality.common.status')}
            valuePropName="checked"
            style={{ flex: 1 }}
          >
            <Switch
              checkedChildren={t('educationQuality.indicatorDrawer.active')}
              unCheckedChildren={t('educationQuality.indicatorDrawer.inactive')}
            />
          </Form.Item>
        </div>

        <Divider style={{ margin: '8px 0 16px' }} />
        <div style={{ fontWeight: 600, marginBottom: 12 }}>
          {t('educationQuality.indicatorDrawer.fieldsSection')}
        </div>

        <Form.List name="fields">
          {(items, { add, remove }) => (
            <>
              {items.map((field) => (
                <S.FieldRow key={field.key}>
                  <Form.Item
                    name={[field.name, 'label']}
                    rules={[{ required: true, message: '' }]}
                    style={{ margin: 0 }}
                  >
                    <Input
                      placeholder={t('educationQuality.indicatorDrawer.fieldLabelPlaceholder')}
                    />
                  </Form.Item>
                  <Form.Item name={[field.name, 'type']} style={{ margin: 0 }}>
                    <Select
                      options={fieldTypeOptions}
                      placeholder={t('educationQuality.indicatorDrawer.typePlaceholder')}
                    />
                  </Form.Item>
                  <Form.Item name={[field.name, 'required']} style={{ margin: 0 }}>
                    <Select
                      options={[
                        { label: t('educationQuality.indicatorDrawer.required'), value: true },
                        { label: t('educationQuality.indicatorDrawer.optional'), value: false },
                      ]}
                    />
                  </Form.Item>
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => remove(field.name)}
                  />
                </S.FieldRow>
              ))}
              <Button
                type="dashed"
                onClick={() => add({ label: '', type: 'text', required: false })}
                icon={<PlusOutlined />}
                block
              >
                {t('educationQuality.indicatorDrawer.addField')}
              </Button>
            </>
          )}
        </Form.List>
      </Form>
    </Drawer>
  );
}
