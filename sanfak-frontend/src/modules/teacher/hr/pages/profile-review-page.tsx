import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Col, Row, Skeleton, Alert } from 'antd';
import {
  DownloadOutlined,
  LinkOutlined,
  PaperClipOutlined,
} from '@ant-design/icons';
import { App, PageContainer, LineTab, useModalStore, phoneToDisplay } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { usePageTitle } from '@/shared/lib/page-title-store';
import { Can } from '@/app/session';
import { useHrProfile, useApproveHrProfile, useRejectHrProfile, getApiErrorMessage } from '../api/hr-api';
import { isFieldChanged, formatDate } from '../model/helper';
import { EDUCATION_TABS, type DegreeDocument, type EducationTabKey } from '../model/types';
import RejectModal from '../components/reject-modal';
import ApproveConfirm from '../components/approve-confirm';
import {
  ActionBar,
  Avatar,
  ChangedPill,
  Divider,
  DocRow,
  EmptyDocs,
  FieldHead,
  FieldLabel,
  FieldValue,
  FieldWrap,
  LeftCard,
  LinkRow,
  RightCard,
  SectionTitle,
  TabSubTitle,
} from './style';

const TAB_LABEL_KEY: Record<EducationTabKey, string> = {
  bachelorDegree: 'teacher.hr.review.tab.bachelor',
  masterDegree: 'teacher.hr.review.tab.master',
  scientificDegree: 'teacher.hr.review.tab.scientificDegree',
  scientificTitle: 'teacher.hr.review.tab.scientificTitle',
};

interface FieldProps {
  label: string;
  value: string;
  changed: boolean;
  updatedLabel: string;
}

function Field({ label, value, changed, updatedLabel }: FieldProps) {
  return (
    <FieldWrap $changed={changed}>
      <FieldHead>
        <FieldLabel>{label}</FieldLabel>
        {changed ? <ChangedPill>{updatedLabel}</ChangedPill> : null}
      </FieldHead>
      <FieldValue $changed={changed}>{value || '—'}</FieldValue>
    </FieldWrap>
  );
}

const ProfileReviewPage = () => {
  const { t } = useTranslation();
  usePageTitle(t('teacher.hr.review.title'), { back: true });
  const { message } = App.useApp();
  const { id } = useParams<{ id: string }>();
  const showModal = useModalStore((s) => s.showModal);
  const [activeTab, setActiveTab] = useState<EducationTabKey>('bachelorDegree');

  const { data: profile, isLoading, isError } = useHrProfile(id);
  const approveMutation = useApproveHrProfile();
  const rejectMutation = useRejectHrProfile();

  const updatedLabel = t('teacher.hr.review.updatedBadge');

  const isChanged = (keys: string[]) => isFieldChanged(profile?.changedFields ?? [], keys);

  const handleApprove = () => {
    if (!profile) return;
    showModal({
      withHeader: false,
      maxWidth: '460px',
      body: () => (
        <ApproveConfirm
          loading={approveMutation.isPending}
          onConfirm={async () => {
            try {
              await approveMutation.mutateAsync({ id: profile.id });
              message.success(t('teacher.hr.approve.success'));
              useModalStore.getState().hideModal();
            } catch (err) {
              message.error(getApiErrorMessage(err));
            }
          }}
        />
      ),
    });
  };

  const handleReject = () => {
    if (!profile) return;
    const teacherName = [profile.lastName, profile.firstName, profile.middleName]
      .filter(Boolean)
      .join(' ');
    showModal({
      title: t('teacher.hr.reject.title'),
      maxWidth: '460px',
      body: () => (
        <RejectModal
          teacherName={teacherName}
          loading={rejectMutation.isPending}
          onConfirm={async (comment) => {
            try {
              await rejectMutation.mutateAsync({ id: profile.id, comment });
              message.success(t('teacher.hr.reject.success'));
              useModalStore.getState().hideModal();
            } catch (err) {
              message.error(getApiErrorMessage(err));
            }
          }}
        />
      ),
    });
  };

  if (isLoading) {
    return (
      <PageContainer title={t('teacher.hr.review.title')}>
        <Skeleton active avatar paragraph={{ rows: 6 }} />
      </PageContainer>
    );
  }

  if (isError || !profile) {
    return (
      <PageContainer title={t('teacher.hr.review.title')}>
        <Alert type="error" showIcon message={t('teacher.hr.notFound')} />
      </PageContainer>
    );
  }

  const fullName = [profile.lastName, profile.firstName, profile.middleName]
    .filter(Boolean)
    .join(' ');
  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  const passportValue =
    profile.passportSeries || profile.passportNumber
      ? `${profile.passportSeries ?? ''} ${profile.passportNumber ?? ''}`.trim()
      : '';
  const addressValue = [profile.addressRegion, profile.addressDistrict, profile.addressStreet]
    .filter(Boolean)
    .join(', ');

  const tabDocs: Record<EducationTabKey, DegreeDocument[]> = {
    bachelorDegree: profile.bachelorDegree,
    masterDegree: profile.masterDegree,
    scientificDegree: profile.scientificDegree,
    scientificTitle: profile.scientificTitle,
  };
  const activeDocs = tabDocs[activeTab];

  return (
    <PageContainer title={t('teacher.hr.review.title')}>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={13}>
          <LeftCard>
            <Avatar $src={profile.photo}>{profile.photo ? null : initials || '—'}</Avatar>

            <Row gutter={[20, 16]}>
              <Col span={12}>
                <Field
                  label={t('teacher.hr.review.field.firstName')}
                  value={profile.firstName ?? ''}
                  changed={isChanged(['firstName'])}
                  updatedLabel={updatedLabel}
                />
              </Col>
              <Col span={12}>
                <Field
                  label={t('teacher.hr.review.field.lastName')}
                  value={profile.lastName ?? ''}
                  changed={isChanged(['lastName'])}
                  updatedLabel={updatedLabel}
                />
              </Col>
              <Col span={12}>
                <Field
                  label={t('teacher.hr.review.field.middleName')}
                  value={profile.middleName ?? ''}
                  changed={isChanged(['middleName'])}
                  updatedLabel={updatedLabel}
                />
              </Col>
              <Col span={12}>
                <Field
                  label={t('teacher.hr.review.field.phone')}
                  value={phoneToDisplay(profile.phone)}
                  changed={isChanged(['phone', 'contactInfo.phone'])}
                  updatedLabel={updatedLabel}
                />
              </Col>
              <Col span={12}>
                <Field
                  label={t('teacher.hr.review.field.jshshir')}
                  value={profile.jshshir ?? ''}
                  changed={isChanged(['jshshir'])}
                  updatedLabel={updatedLabel}
                />
              </Col>
              <Col span={12}>
                <Field
                  label={t('teacher.hr.review.field.passport')}
                  value={passportValue}
                  changed={isChanged(['passportSeries', 'passportNumber'])}
                  updatedLabel={updatedLabel}
                />
              </Col>
              <Col span={12}>
                <Field
                  label={t('teacher.hr.review.field.email')}
                  value={profile.email ?? ''}
                  changed={isChanged(['email', 'contactInfo.email'])}
                  updatedLabel={updatedLabel}
                />
              </Col>
              <Col span={12}>
                <Field
                  label={t('teacher.hr.review.field.birthDate')}
                  value={formatDate(profile.birthDate)}
                  changed={isChanged(['birthDate'])}
                  updatedLabel={updatedLabel}
                />
              </Col>
              <Col span={24}>
                <Field
                  label={t('teacher.hr.review.field.address')}
                  value={addressValue}
                  changed={isChanged(['address', 'address.region', 'address.district', 'address.street'])}
                  updatedLabel={updatedLabel}
                />
              </Col>
            </Row>

            <Divider />

            <Row gutter={[20, 16]}>
              <Col span={12}>
                <Field
                  label={t('teacher.hr.review.field.faculty')}
                  value={profile.facultyTitle ?? ''}
                  changed={isChanged(['faculty'])}
                  updatedLabel={updatedLabel}
                />
              </Col>
              <Col span={12}>
                <Field
                  label={t('teacher.hr.review.field.department')}
                  value={profile.departmentTitle ?? ''}
                  changed={isChanged(['department'])}
                  updatedLabel={updatedLabel}
                />
              </Col>
              <Col span={12}>
                <Field
                  label={t('teacher.hr.review.field.position')}
                  value={profile.positionTitle ?? ''}
                  changed={isChanged(['position'])}
                  updatedLabel={updatedLabel}
                />
              </Col>
            </Row>

            <Divider />

            <SectionTitle>{t('teacher.hr.review.section.internationalLinks')}</SectionTitle>
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <FieldLabel>{t('teacher.hr.review.field.googleScholar')}</FieldLabel>
              {profile.googleScholarUrl ? (
                <LinkRow>
                  <LinkOutlined />
                  <a href={profile.googleScholarUrl} target="_blank" rel="noreferrer">
                    {profile.googleScholarUrl}
                  </a>
                </LinkRow>
              ) : (
                <FieldValue>—</FieldValue>
              )}
            </div>
            <div>
              <FieldLabel>{t('teacher.hr.review.field.scopus')}</FieldLabel>
              {profile.scopusUrl ? (
                <LinkRow>
                  <LinkOutlined />
                  <a href={profile.scopusUrl} target="_blank" rel="noreferrer">
                    {profile.scopusUrl}
                  </a>
                </LinkRow>
              ) : (
                <FieldValue>—</FieldValue>
              )}
            </div>
          </LeftCard>
        </Col>

        <Col xs={24} lg={11}>
          <RightCard>
            <h3>{t('teacher.hr.review.section.education')}</h3>
            <LineTab
              activeTab={activeTab}
              setActiveTab={(k) => setActiveTab(k as EducationTabKey)}
              data={EDUCATION_TABS.map((key) => ({ key, label: t(TAB_LABEL_KEY[key]) }))}
            />

            <TabSubTitle>{t(TAB_LABEL_KEY[activeTab])}</TabSubTitle>

            {activeDocs.length === 0 ? (
              <EmptyDocs>{t('teacher.hr.review.noDocuments')}</EmptyDocs>
            ) : (
              activeDocs.map((doc, idx) => {
                const changed = isChanged([
                  `degrees.${activeTab}.${idx}`,
                  `user.degrees.${activeTab}.${idx}`,
                ]);
                return (
                  <DocRow
                    key={`${doc.title}-${idx}`}
                    href={doc.path}
                    target="_blank"
                    rel="noreferrer"
                    download
                    $changed={changed}
                  >
                    {changed ? <DownloadOutlined className="icon" /> : <PaperClipOutlined className="icon" />}
                    <span className="name">{doc.title}</span>
                    {changed ? <ChangedPill>{updatedLabel}</ChangedPill> : null}
                  </DocRow>
                );
              })
            )}
          </RightCard>
        </Col>
      </Row>

      {profile.hrApprovalStatus === 'pending' ? (
        <ActionBar>
          <Can perform="teacher:reject">
            <Button danger onClick={handleReject}>
              {t('teacher.hr.action.reject')}
            </Button>
          </Can>
          <Can perform="teacher:approve">
            <Button type="primary" onClick={handleApprove}>
              {t('teacher.hr.action.approve')}
            </Button>
          </Can>
        </ActionBar>
      ) : null}
    </PageContainer>
  );
};

export default ProfileReviewPage;
