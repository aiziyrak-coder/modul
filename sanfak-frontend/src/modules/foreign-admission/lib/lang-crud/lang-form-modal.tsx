import { useState } from 'react';
import { App, Button, Flex, Form, Input, useModalStore } from '@/shared/ui';
import { Tabs, Upload } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import { getApiErrorMessage } from '@/shared/api';
import { useTranslation } from '@/shared/lib/i18n';
import type { ContentLang, LangRecord } from '../../model/admission-types';
import { CONTENT_LANGS, langField } from '../../model/content-lang';
import { useSaveLangRecord, type LangFormValues } from '../../api/reference-api';
import type { LangCrudConfig } from './types';
import { ScrollBox } from '../../components/scroll-box';

const LANG_TAB_LABEL: Record<ContentLang, string> = {
  uz: "O'zbekcha",
  ru: 'Русский',
  en: 'English',
};

interface Props {
  config: LangCrudConfig;
  record: LangRecord | null;
}

interface ValidateError {
  errorFields?: { name: (string | number)[] }[];
}

function langOfField(field: string): ContentLang | null {
  if (field.endsWith('Ru')) return 'ru';
  if (field.endsWith('En')) return 'en';
  if (field.endsWith('Uz')) return 'uz';
  return null;
}

export default function LangForm({ config, record }: Props) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const hideModal = useModalStore((s) => s.hideModal);
  const [form] = Form.useForm<LangFormValues>();
  const [activeLang, setActiveLang] = useState<ContentLang>('uz');
  const save = useSaveLangRecord(config.root);

  const isEdit = !!record;
  const existingImage = config.imageUpload ? record?.[config.imageUpload.urlField] : undefined;

  const [fileList, setFileList] = useState<UploadFile[]>(() =>
    existingImage
      ? [{ uid: 'current', name: 'flag', status: 'done', url: existingImage }]
      : [],
  );

  const initialValues: LangFormValues = {};
  if (record) {
    config.langFields.forEach((f) =>
      CONTENT_LANGS.forEach((l) => {
        initialValues[langField(f.name, l)] = record[langField(f.name, l)] ?? '';
      }),
    );
    config.plainFields?.forEach((f) => {
      initialValues[f.name] = record[f.name] ?? '';
    });
  }


  const handleSave = () => {
    form
      .validateFields()
      .then(async (values) => {
        const picked = fileList[0];
        const payload = { ...values };
        if (config.imageUpload && existingImage && !picked) {
          payload[config.imageUpload.urlField] = '';
        }
        try {
          await save.mutateAsync({
            id: record?.id,
            values: payload,
            file: picked?.originFileObj,
          });
          message.success(
            t(isEdit ? 'foreignAdmission.crud.updated' : 'foreignAdmission.crud.created'),
          );
          hideModal();
        } catch (e) {
          message.error(getApiErrorMessage(e));
        }
      })
      .catch((err: ValidateError) => {
        const first = err.errorFields?.[0]?.name?.[0];
        const target = typeof first === 'string' ? langOfField(first) : null;
        if (target) setActiveLang(target);
      });
  };

  const renderLangFields = (contentLang: ContentLang) =>
    config.langFields.map((f) => {
      const name = langField(f.name, contentLang);
      const label = t(f.labelKey);
      return (
        <Form.Item
          key={name}
          name={name}
          label={label}
          rules={
            f.required ? [{ required: true, message: t('foreignAdmission.err.required') }] : undefined
          }
          style={{ marginBottom: 12 }}
        >
          {f.type === 'textarea' ? (
            <Input.TextArea rows={3} placeholder={f.placeholderKey ? t(f.placeholderKey) : label} />
          ) : (
            <Input placeholder={f.placeholderKey ? t(f.placeholderKey) : label} />
          )}
        </Form.Item>
      );
    });

  return (
    <>
      <Form form={form} layout="vertical" initialValues={initialValues}>
        <ScrollBox>
      {config.imageUpload ? (
        <Form.Item label={t(config.imageUpload.labelKey)} style={{ marginBottom: 12 }}>
          <Upload
            listType="picture-card"
            maxCount={1}
            accept="image/*"
            beforeUpload={() => false}
            fileList={fileList}
            onChange={({ fileList: fl }) => setFileList(fl)}
            onPreview={() => undefined}
          >
            {fileList.length === 0 && (
              <div style={{ textAlign: 'center' }}>
                <PlusOutlined />
                <div style={{ marginTop: 4, fontSize: 12 }}>{t(config.imageUpload.hintKey)}</div>
              </div>
            )}
          </Upload>
        </Form.Item>
      ) : null}

      <Tabs
        centered
        activeKey={activeLang}
        onChange={(k) => setActiveLang(k as ContentLang)}
        items={CONTENT_LANGS.map((l) => ({
          key: l,
          label: LANG_TAB_LABEL[l],
          forceRender: true,
          children: <div style={{ paddingTop: 8 }}>{renderLangFields(l)}</div>,
        }))}
      />

      {config.plainFields?.map((f) => (
        <Form.Item key={f.name} name={f.name} label={t(f.labelKey)} style={{ marginBottom: 0 }}>
          <Input placeholder={f.placeholderKey ? t(f.placeholderKey) : undefined} />
        </Form.Item>
      ))}
        </ScrollBox>
      </Form>

      <Flex gap={10} style={{ paddingTop: 12 }}>
        <Button block onClick={hideModal}>
          {t('foreignAdmission.cancel')}
        </Button>
        <Button block type="primary" loading={save.isPending} onClick={handleSave}>
          {t('foreignAdmission.save')}
        </Button>
      </Flex>
    </>
  );
}
