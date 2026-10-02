import { useState } from 'react';
import { Alert, App, Button, Flex, Form, Input, Select, useModalStore } from '@/shared/ui';
import { Col, Row } from 'antd';
import { InfoCircleOutlined, SendOutlined } from '@ant-design/icons';
import { getApiErrorMessage } from '@/shared/api';
import { useTranslation } from '@/shared/lib/i18n';
import type { SeasonName } from '../../model/admission-types';
import { toOptions } from '../../model/content-lang';
import { REF_ROOTS, useAllLangRecords } from '../../api/reference-api';
import { useRecipientCount, useSendMessage } from '../../api/message-api';
import { useAcademicYears } from '../../api/season-api';
import { SEASON_META, SEASON_ORDER } from '../../lib/season-options';
import { ScrollBox } from '../scroll-box';

interface FormValues {
  text: string;
  direction?: string;
  educationLanguage?: string;
  academicYear: string;
  season: SeasonName;
}

export default function SendMessageForm() {
  const { t, lang } = useTranslation();
  const { message, modal } = App.useApp();
  const hideModal = useModalStore((s) => s.hideModal);
  const [form] = Form.useForm<FormValues>();
  const send = useSendMessage();

  const academicYears = useAcademicYears();
  const directions = useAllLangRecords(REF_ROOTS.directions);
  const eduLangs = useAllLangRecords(REF_ROOTS.educationLanguages);

  const asRefs = (records: ReturnType<typeof useAllLangRecords>['data']) =>
    (records ?? []).map((r) => ({
      id: r.id,
      titleUz: r.titleUz ?? '',
      titleRu: r.titleRu,
      titleEn: r.titleEn,
    }));

  const [scope, setScope] = useState<{
    direction?: string;
    educationLanguage?: string;
    academicYear?: string;
  }>({});

  const { data: recipientCount, isFetching: countLoading } = useRecipientCount(scope, true);

  const syncScope = () => {
    const values = form.getFieldsValue();
    setScope({
      direction: values.direction,
      educationLanguage: values.educationLanguage,
      academicYear: values.academicYear,
    });
  };

  const submit = () => {
    form
      .validateFields()
      .then((values) => {
      modal.confirm({
        title: t('foreignAdmission.messages.confirm_title'),
        content: t('foreignAdmission.messages.confirm_body', { n: recipientCount ?? 0 }),
        okText: t('foreignAdmission.messages.confirm_ok'),
        cancelText: t('foreignAdmission.cancel'),
        centered: true,
        onOk: async () => {
          try {
            const res = await send.mutateAsync({
              text: values.text,
              direction: values.direction || undefined,
              educationLanguage: values.educationLanguage || undefined,
              academicYear: values.academicYear,
              season: values.season,
            });
            message.success(
              t('foreignAdmission.messages.sent', {
                delivered: res.deliveredCount,
                total: res.recipientCount,
              }),
            );
            hideModal();
          } catch (e) {
            message.error(getApiErrorMessage(e));
          }
        },
      });
      })
      .catch(() => {});
  };

  return (
    <>
      <ScrollBox>
      <Alert
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        message={t('foreignAdmission.messages.info')}
        description={
          countLoading
            ? t('foreignAdmission.messages.counting')
            : t('foreignAdmission.messages.recipients', { n: recipientCount ?? 0 })
        }
        style={{ marginBottom: 16 }}
      />

      <Form form={form} layout="vertical" onValuesChange={syncScope}>
        <Form.Item name="direction" label={t('foreignAdmission.col.direction')}>
          <Select
            allowClear
            placeholder={t('foreignAdmission.messages.direction_all')}
            loading={directions.isLoading}
            options={toOptions(asRefs(directions.data), lang)}
            showSearch
            optionFilterProp="label"
          />
        </Form.Item>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="educationLanguage" label={t('foreignAdmission.nav.educationLanguages')}>
              <Select
                allowClear
                placeholder={t('foreignAdmission.messages.lang_all')}
                loading={eduLangs.isLoading}
                options={toOptions(asRefs(eduLangs.data), lang)}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="academicYear"
              label={t('foreignAdmission.field.academic_year')}
              rules={[{ required: true, message: t('foreignAdmission.err.required') }]}
            >
              <Select
                placeholder={t('foreignAdmission.seasons.year_ph')}
                loading={academicYears.isLoading}
                options={(academicYears.data ?? []).map((y) => ({ value: y, label: y }))}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="season"
          label={t('foreignAdmission.seasons.season')}
          rules={[{ required: true, message: t('foreignAdmission.err.required') }]}
        >
          <Select
            placeholder={t('foreignAdmission.seasons.season_ph')}
            options={SEASON_ORDER.map((s) => ({ value: s, label: t(SEASON_META[s].titleKey) }))}
          />
        </Form.Item>

        <Form.Item
          name="text"
          label={t('foreignAdmission.messages.text')}
          rules={[{ required: true, message: t('foreignAdmission.err.required') }]}
          style={{ marginBottom: 0 }}
        >
          <Input.TextArea rows={4} placeholder={t('foreignAdmission.messages.text_ph')} />
        </Form.Item>
      </Form>
      </ScrollBox>

      <Flex gap={10} style={{ paddingTop: 12 }}>
          <Button block onClick={hideModal}>
            {t('foreignAdmission.cancel')}
          </Button>
          <Button
            block
            type="primary"
            icon={<SendOutlined />}
            loading={send.isPending}
            onClick={submit}
          >
          {t('foreignAdmission.messages.send_ok')}
        </Button>
      </Flex>
    </>
  );
}
