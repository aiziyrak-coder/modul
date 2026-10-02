import { useState } from 'react';
import { FileTextOutlined, UserOutlined } from '@ant-design/icons';
import { Col, Input, Row, Select, Spin } from 'antd';
import { App, Button, Card, Flex, Tag, Typography } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { useTranslation } from '@/shared/lib/i18n';
import { EDU_FORM } from '../../model/course.types';
import type { Course } from '../../model/course.types';
import { useProvinces, useRegions } from '../../api/geo-api';
import { useCreatePetition, useMyOneIdProfile } from '../../api/petition-api';
import FileUploadZone from '../file-upload-zone';

const { Text } = Typography;
const fmtDate = (s?: string) =>
  s ? new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '…';
const Label = { fontWeight: 500, fontSize: 14, color: 'var(--color-text)', display: 'block', marginBottom: 6 } as const;
const oneIdBox = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '9px 12px',
  border: '1px solid var(--color-border, #e3e8ef)',
  borderRadius: 'var(--radius-md, 8px)',
  background: 'var(--color-bg-soft, #f8fafc)',
} as const;

export default function EnrollmentForm({
  course,
  onBack,
  onSuccess,
}: {
  course: Course;
  onBack: () => void;
  onSuccess: () => void;
}) {
  const { t } = useTranslation();
  const { message } = App.useApp();

  const [province, setProvince] = useState<string | undefined>(undefined);
  const [region, setRegion] = useState<string | undefined>(undefined);
  const [institution, setInstitution] = useState('');
  const [phone, setPhone] = useState('');
  const [bachelor, setBachelor] = useState<File | null>(null);
  const [masters, setMasters] = useState<File | null>(null);
  const [moCert, setMoCert] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: provinceOptions = [] } = useProvinces();
  const { data: regionOptions = [] } = useRegions(province);
  const { data: profile, isLoading: profileLoading } = useMyOneIdProfile();
  const create = useCreatePetition();

  const formLabel =
    course.form === EDU_FORM.ONLINE
      ? t('qualification.courses.form.online')
      : t('qualification.courses.form.offline');

  const handlePhone = (val: string) => {
    const digits = val.replace(/\D/g, '');
    const d = digits.startsWith('998') ? digits.slice(3) : digits;
    if (d.length === 0) return setPhone('');
    let f = '+998 ';
    if (d.length <= 2) f += d;
    else if (d.length <= 5) f += `${d.slice(0, 2)} ${d.slice(2)}`;
    else if (d.length <= 7) f += `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`;
    else if (d.length <= 9) f += `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7)}`;
    else f += `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)}`;
    return setPhone(f);
  };

  const onSubmit = async () => {
    if (!bachelor) return message.error(t('qualification.enroll.docBachelorRequired'));
    if (!province) return message.error(t('qualification.enroll.provinceRequired'));
    if (!region) return message.error(t('qualification.enroll.regionRequired'));
    setSubmitting(true);
    try {
      await create.mutateAsync({
        course: course.id,
        province,
        region,
        institution: institution.trim() || undefined,
        phone: phone.trim() || undefined,
        bachelorDiploma: bachelor,
        mastersDiploma: masters ?? undefined,
        moCertificate: moCert ?? undefined,
      });
      onSuccess();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
    return undefined;
  };

  return (
    <Flex vertical gap={16}>
      <Card size="small">
        <Text strong style={{ display: 'block', marginBottom: 10 }}>
          {t('qualification.enroll.selectedCourse')}
        </Text>
        <div
          style={{
            background: 'var(--brand-primary-bg, #eafaf3)',
            border: '1px solid var(--brand-primary, #37cb94)',
            borderRadius: 'var(--radius-md, 8px)',
            padding: '12px 14px',
          }}
        >
          <Text strong style={{ display: 'block', marginBottom: 4 }}>
            {course.title}
          </Text>
          <Flex align="center" gap={8} wrap>
            <Tag color={course.form === EDU_FORM.ONLINE ? 'blue' : 'gold'} style={{ margin: 0 }}>
              {formLabel}
            </Tag>
            {course.startDate ? (
              <Text type="secondary" style={{ fontSize: 13 }}>
                {fmtDate(course.startDate)} — {fmtDate(course.endDate)}
              </Text>
            ) : null}
            <Text style={{ fontSize: 13, color: 'var(--brand-primary, #37cb94)', fontWeight: 500 }}>
              · {course.price.toLocaleString('ru-RU')} so'm
            </Text>
          </Flex>
        </div>
      </Card>

      <Card size="small">
        <Text strong style={{ display: 'block', marginBottom: 14 }}>
          {t('qualification.enroll.personalOneId')}
        </Text>
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12}>
            <Text style={Label}>{t('qualification.enroll.fullName')}</Text>
            <div style={oneIdBox}>
              <UserOutlined style={{ color: 'var(--color-text-mute, #9aa3b2)' }} />
              {profileLoading ? (
                <Spin size="small" />
              ) : profile?.fullName ? (
                <Text style={{ fontSize: 13, fontWeight: 500 }}>{profile.fullName}</Text>
              ) : (
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {t('qualification.enroll.oneId')}
                </Text>
              )}
            </div>
          </Col>
          <Col xs={24} sm={12}>
            <Text style={Label}>{t('qualification.enroll.passport')}</Text>
            <div style={oneIdBox}>
              <FileTextOutlined style={{ color: 'var(--color-text-mute, #9aa3b2)' }} />
              {profileLoading ? (
                <Spin size="small" />
              ) : profile?.passport ? (
                <Text style={{ fontSize: 13, fontWeight: 500 }}>{profile.passport}</Text>
              ) : (
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {t('qualification.enroll.oneId')}
                </Text>
              )}
            </div>
          </Col>
          <Col xs={24} sm={12}>
            <Text style={Label}>
              {t('qualification.enroll.province')} <Text type="danger">*</Text>
            </Text>
            <Select
              size="large"
              style={{ width: '100%' }}
              showSearch
              optionFilterProp="label"
              options={provinceOptions}
              value={province}
              placeholder={t('qualification.enroll.provincePh')}
              onChange={(v) => {
                setProvince(v);
                setRegion(undefined);
              }}
            />
          </Col>
          <Col xs={24} sm={12}>
            <Text style={Label}>
              {t('qualification.enroll.region')} <Text type="danger">*</Text>
            </Text>
            <Select
              size="large"
              style={{ width: '100%' }}
              showSearch
              optionFilterProp="label"
              options={regionOptions}
              value={region}
              disabled={!province}
              placeholder={t('qualification.enroll.regionPh')}
              onChange={setRegion}
            />
          </Col>
          <Col xs={24} sm={12}>
            <Text style={Label}>{t('qualification.enroll.institution')}</Text>
            <Input
              size="large"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder={t('qualification.enroll.institutionPh')}
            />
          </Col>
          <Col xs={24} sm={12}>
            <Text style={Label}>{t('qualification.enroll.phone')}</Text>
            <Input
              size="large"
              value={phone}
              onChange={(e) => handlePhone(e.target.value)}
              maxLength={17}
              placeholder="+998 XX XXX XX XX"
            />
          </Col>
        </Row>
      </Card>

      <Card size="small">
        <Text strong style={{ display: 'block', marginBottom: 14 }}>
          {t('qualification.enroll.docs')}
        </Text>
        <Flex vertical gap={12}>
          <div>
            <Text style={Label}>
              {t('qualification.enroll.docBachelor')} <Text type="danger">*</Text>
            </Text>
            <FileUploadZone
              dropText={t('qualification.enroll.dropText')}
              hint=".pdf, .jpg, .png"
              accept=".pdf,.jpg,.jpeg,.png"
              value={bachelor?.name ?? null}
              onFileSelect={setBachelor}
            />
          </div>
          <div>
            <Text style={Label}>{t('qualification.enroll.docMasters')}</Text>
            <FileUploadZone
              dropText={t('qualification.enroll.dropText')}
              hint=".pdf, .jpg, .png"
              accept=".pdf,.jpg,.jpeg,.png"
              value={masters?.name ?? null}
              onFileSelect={setMasters}
            />
          </div>
          <div>
            <Text style={Label}>{t('qualification.enroll.docMo')}</Text>
            <FileUploadZone
              dropText={t('qualification.enroll.dropText')}
              hint=".pdf, .jpg, .png"
              accept=".pdf,.jpg,.jpeg,.png"
              value={moCert?.name ?? null}
              onFileSelect={setMoCert}
            />
          </div>
        </Flex>
      </Card>

      <Flex justify="flex-end" gap={12}>
        <Button onClick={onBack} disabled={submitting} style={{ height: 44, minWidth: 110 }}>
          {t('qualification.enroll.cancel')}
        </Button>
        <Button
          type="primary"
          loading={submitting}
          onClick={onSubmit}
          style={{ height: 44, minWidth: 130 }}
        >
          {t('qualification.enroll.submit')}
        </Button>
      </Flex>
    </Flex>
  );
}
