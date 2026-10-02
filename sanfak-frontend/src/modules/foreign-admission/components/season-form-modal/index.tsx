import { useState } from 'react';
import { App, Button, Flex, Form, Input, Select, useModalStore } from '@/shared/ui';
import { AutoComplete, Col, DatePicker, Row, Tabs } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { getApiErrorMessage } from '@/shared/api';
import { useTranslation } from '@/shared/lib/i18n';
import type { AdmissionSeason, ContentLang, SeasonName } from '../../model/admission-types';
import { CONTENT_LANGS, toOptions } from '../../model/content-lang';
import { REF_ROOTS, useAllLangRecords } from '../../api/reference-api';
import { useAcademicYears, useSaveSeason, type SeasonInput } from '../../api/season-api';
import { ACADEMIC_YEAR_PATTERN, SEASON_META, SEASON_ORDER } from '../../lib/season-options';
import { ScrollBox } from '../scroll-box';

const LANG_TAB_LABEL: Record<ContentLang, string> = {
  uz: "O'zbekcha",
  ru: 'Русский',
  en: 'English',
};

interface ItemValue {
  direction?: string;
  educationForms?: string[];
  educationLanguages?: string[];
}

interface FormValues {
  titleUz: string;
  titleRu: string;
  titleEn: string;
  descriptionUz?: string;
  descriptionRu?: string;
  descriptionEn?: string;
  academicYear: string;
  season: SeasonName;
  items: ItemValue[];
  openDate: Dayjs;
  closeDate: Dayjs;
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

interface Props {
  season: AdmissionSeason | null;
  readOnly?: boolean;
}

export default function SeasonForm({ season, readOnly = false }: Props) {
  const { t, lang } = useTranslation();
  const { message } = App.useApp();
  const hideModal = useModalStore((s) => s.hideModal);
  const [form] = Form.useForm<FormValues>();
  const [activeLang, setActiveLang] = useState<ContentLang>('uz');
  const save = useSaveSeason();

  const academicYears = useAcademicYears();
  const directions = useAllLangRecords(REF_ROOTS.directions);
  const eduForms = useAllLangRecords(REF_ROOTS.educationForms);
  const eduLangs = useAllLangRecords(REF_ROOTS.educationLanguages);

  const asRefs = (records: ReturnType<typeof useAllLangRecords>['data']) =>
    (records ?? []).map((r) => ({
      id: r.id,
      titleUz: r.titleUz ?? '',
      titleRu: r.titleRu,
      titleEn: r.titleEn,
    }));

  const initialValues: Partial<FormValues> = season
    ? {
        titleUz: season.titleUz,
        titleRu: season.titleRu,
        titleEn: season.titleEn,
        descriptionUz: season.descriptionUz ?? '',
        descriptionRu: season.descriptionRu ?? '',
        descriptionEn: season.descriptionEn ?? '',
        academicYear: season.academicYear,
        season: season.season,
        openDate: dayjs(season.openDate),
        closeDate: dayjs(season.closeDate),
        items: season.items.map((i) => ({
          direction: i.direction?.id,
          educationForms: i.educationForms.map((f) => f.id),
          educationLanguages: i.educationLanguages.map((l) => l.id),
        })),
      }
    : { items: [{}] };

  const handleSave = () => {
    form
      .validateFields()
      .then(async (values) => {
        if (!values.closeDate.isAfter(values.openDate)) {
          message.error(t('foreignAdmission.seasons.date_order'));
          return;
        }
        const input: SeasonInput = {
          titleUz: values.titleUz,
          titleRu: values.titleRu,
          titleEn: values.titleEn,
          descriptionUz: values.descriptionUz || '',
          descriptionRu: values.descriptionRu || '',
          descriptionEn: values.descriptionEn || '',
          academicYear: values.academicYear,
          season: values.season,
          openDate: values.openDate.format('YYYY-MM-DD'),
          closeDate: values.closeDate.format('YYYY-MM-DD'),
          items: values.items.map((i) => ({
            direction: i.direction as string,
            educationForms: i.educationForms ?? [],
            educationLanguages: i.educationLanguages ?? [],
          })),
        };
        try {
          await save.mutateAsync({ id: season?.id, input });
          message.success(
            t(season ? 'foreignAdmission.crud.updated' : 'foreignAdmission.seasons.created'),
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

  return (
    <>
      <Form form={form} layout="vertical" disabled={readOnly} initialValues={initialValues}>
        <ScrollBox>
      <Tabs
        centered
        activeKey={activeLang}
        onChange={(k) => setActiveLang(k as ContentLang)}
        items={CONTENT_LANGS.map((l) => {
          const suffix = l === 'uz' ? 'Uz' : l === 'ru' ? 'Ru' : 'En';
          return {
            key: l,
            label: LANG_TAB_LABEL[l],
            forceRender: true,
            children: (
              <div style={{ paddingTop: 8 }}>
                <Form.Item
                  name={`title${suffix}`}
                  label={t('foreignAdmission.seasons.title')}
                  rules={[{ required: true, message: t('foreignAdmission.err.required') }]}
                  style={{ marginBottom: 10 }}
                >
                  <Input placeholder={t('foreignAdmission.seasons.title_ph')} />
                </Form.Item>
                <Form.Item
                  name={`description${suffix}`}
                  label={t('foreignAdmission.seasons.description')}
                  style={{ marginBottom: 4 }}
                >
                  <Input.TextArea
                    rows={2}
                    placeholder={t('foreignAdmission.seasons.description_ph')}
                  />
                </Form.Item>
              </div>
            ),
          };
        })}
      />

      <Form.List name="items">
        {(fields, { add, remove }) => (
          <>
            {fields.map((field) => (
              <div
                key={field.key}
                style={{
                  border: '1px solid var(--color-border, #e2e8f0)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 12px',
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 6,
                  }}
                >
                  <span style={{ fontWeight: 500, fontSize: 13 }}>
                    {t('foreignAdmission.seasons.direction')}
                  </span>
                  {fields.length > 1 && !readOnly && (
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => remove(field.name)}
                    />
                  )}
                </div>

                <Form.Item
                  name={[field.name, 'direction']}
                  rules={[{ required: true, message: t('foreignAdmission.err.required') }]}
                  style={{ marginBottom: 8 }}
                >
                  <Select
                    placeholder={t('foreignAdmission.seasons.direction_ph')}
                    loading={directions.isLoading}
                    options={toOptions(asRefs(directions.data), lang)}
                    showSearch
                    optionFilterProp="label"
                  />
                </Form.Item>

                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item
                      name={[field.name, 'educationForms']}
                      label={t('foreignAdmission.nav.educationForms')}
                      style={{ marginBottom: 0 }}
                    >
                      <Select
                        mode="multiple"
                        placeholder={t('foreignAdmission.seasons.forms_ph')}
                        loading={eduForms.isLoading}
                        options={toOptions(asRefs(eduForms.data), lang)}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name={[field.name, 'educationLanguages']}
                      label={t('foreignAdmission.nav.educationLanguages')}
                      style={{ marginBottom: 0 }}
                    >
                      <Select
                        mode="multiple"
                        placeholder={t('foreignAdmission.seasons.langs_ph')}
                        loading={eduLangs.isLoading}
                        options={toOptions(asRefs(eduLangs.data), lang)}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </div>
            ))}

            {!readOnly && (
              <Button
                type="dashed"
                block
                icon={<PlusOutlined />}
                onClick={() => add({})}
                style={{ marginBottom: 12 }}
              >
                {t('foreignAdmission.seasons.add_direction')}
              </Button>
            )}
          </>
        )}
      </Form.List>

      <Row gutter={12}>
        <Col span={12}>
          <Form.Item
            name="academicYear"
            label={t('foreignAdmission.field.academic_year')}
            rules={[
              { required: true, message: t('foreignAdmission.err.required') },
              { pattern: ACADEMIC_YEAR_PATTERN, message: t('foreignAdmission.seasons.year_format') },
            ]}
          >
            <AutoComplete
              placeholder={t('foreignAdmission.seasons.year_ph')}
              options={(academicYears.data ?? []).map((y) => ({ value: y }))}
              filterOption={(input, option) => String(option?.value ?? '').includes(input)}
            />
          </Form.Item>
        </Col>
        <Col span={12}>
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
        </Col>
      </Row>

      <Row gutter={12}>
        <Col span={12}>
          <Form.Item
            name="openDate"
            label={t('foreignAdmission.seasons.open_date')}
            rules={[{ required: true, message: t('foreignAdmission.err.required') }]}
          >
            <DatePicker
              format="DD/MM/YYYY"
              style={{ width: '100%' }}
              placeholder={t('foreignAdmission.seasons.date_ph')}
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="closeDate"
            label={t('foreignAdmission.seasons.close_date')}
            rules={[{ required: true, message: t('foreignAdmission.err.required') }]}
          >
            <DatePicker
              format="DD/MM/YYYY"
              style={{ width: '100%' }}
              placeholder={t('foreignAdmission.seasons.date_ph')}
            />
          </Form.Item>
        </Col>
        </Row>
        </ScrollBox>
      </Form>

      <Flex gap={10} style={{ paddingTop: 12 }}>
        {readOnly ? (
          <Button block onClick={hideModal}>
            {t('foreignAdmission.close')}
          </Button>
        ) : (
          <>
            <Button block onClick={hideModal}>
              {t('foreignAdmission.cancel')}
            </Button>
            <Button block type="primary" loading={save.isPending} onClick={handleSave}>
              {t('foreignAdmission.save')}
            </Button>
          </>
        )}
      </Flex>
    </>
  );
}
