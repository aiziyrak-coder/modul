import { useField } from 'formik';
import { InboxOutlined } from '@ant-design/icons';
import { Form, Upload } from 'antd';
import type { UploadFile } from 'antd';
import { useTranslation } from '@/shared/lib/i18n';

export function FileUploadField({ name, label }: { name: string; label?: string }) {
  const { t } = useTranslation();
  const [field, , helpers] = useField(name);

  const fileList: UploadFile[] = field.value
    ? [{ uid: '-1', name: (field.value as File).name ?? 'file', status: 'done' }]
    : [];

  return (
    <Form.Item label={label ? t(label) : undefined}>
      <Upload.Dragger
        multiple={false}
        fileList={fileList}
        beforeUpload={(file) => {
          void helpers.setValue(file);
          return false;
        }}
        onRemove={() => {
          void helpers.setValue(undefined);
        }}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p>{t('search')}</p>
      </Upload.Dragger>
    </Form.Item>
  );
}
