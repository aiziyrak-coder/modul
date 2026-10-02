import { useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Button, Checkbox, Flex, Modal, Popconfirm, Select, Spin, Tabs, Tag, Timeline, Input, message } from 'antd';
import {
  ArrowLeftOutlined,
  AuditOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DownloadOutlined,
  CommentOutlined,
  DislikeOutlined,
  EditOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  HistoryOutlined,
  LikeOutlined,
  LockOutlined,
  MessageOutlined,
  MinusOutlined,
  PaperClipOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SolutionOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UploadOutlined,
  UserDeleteOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { usePageTitle } from '@/shared/lib/page-title-store';
import { usePermission, useSessionStore } from '@/app/session';
import {
  useWork,
  useChangeStatus,
  useCouncilMembers,
  useCreateReview,
  useMakeDecision,
  useMemberDecision,
  useAcceptApplication,
  useGenerateProtocol,
  useSignProtocol,
  useUploadDocument,
  useUpdateCouncilMembers,
  useUpdateDocAssignments,
} from '../api/science-council-api';
import { StatusTag } from '../components/status-tag';
import { SeminarResultTag } from '../components/seminar-result-tag';
import { DefenseResultTag } from '../components/defense-result-tag';
import { DecisionModal } from '../components/decision-modal';
import { ReviewModal } from '../components/review-modal';
import { DOCUMENT_CATEGORIES } from '../lib/document-categories';
import { formatDate } from '../lib/format-date';
import { workStep } from '../lib/work-step';
import type { AuditEntry, DecisionInput, ReviewInput, WorkReview } from '../model/types';
import {
  BackBtn,
  HeaderSub,
  ActionGroup,
  RevisionBanner,
  RejectionBanner,
  ReviewProgressBanner,
  BannerIcon,
  BannerContent,
  BannerCounter,
  DetailGrid,
  DetailCell,
  DetailLabel,
  DetailValue,
  TabCard,
  DocRow,
  DocIcon,
  ReviewCard,
  ReviewHeader,
  ReviewText,
  AuditItem,
  MemberRow,
  MemberNum,
  MemberInfo,
  ProtocolViewCard,
  ProtocolViewIcon,
  ProtocolViewContent,
  ProtocolSignedCard,
  ProtocolSignedHeader,
  ProtocolInfoGrid,
  ProtocolInfoItem,
  ESignBox,
  DecisionCard,
  SupervisorCard,
  SupervisorAvatar,
  SupervisorBody,
  SupervisorEyebrow,
  SupervisorName,
  SupervisorChips,
  SupervisorChip,
  SupervisorMeta,
} from '../components/detail-styles';
import { DalolatnomaDraft } from '../components/dalolatnoma-draft';
import {
  buildFinalConclusion,
  buildHeading,
  buildIntro,
  buildItems,
  collectVars,
  isRecommended,
} from '../lib/dalolatnoma-template';
import {
  buildDalolatnomaHtml,
  printDalolatnomaPdf,
  safeFileName,
} from '../lib/dalolatnoma-doc';

const { TextArea } = Input;

function toInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return fullName;
  const surname = parts[0];
  const initials = parts.slice(1).map((p) => `${p[0]}.`).join('');
  return `${surname} ${initials}`;
}

const AUDIT_COLORS: Record<string, string> = {
  created: '#6366f1',
  member_assigned: '#0891b2',
  doc_uploaded: '#16a34a',
  review_added: '#d97706',
  protocol_generated: '#9333ea',
  protocol_signed: '#7c3aed',
  status_changed: '#0891b2',
  rejected: '#dc2626',
  approved: '#16a34a',
  revision: '#d97706',
  decision_made: '#9333ea',
};


export default function WorkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, lang } = useTranslation();
  const { data: work, isLoading } = useWork(id);
  const { data: allMembers = [] } = useCouncilMembers();
  const can = usePermission();
  usePageTitle(work?.title ?? t('scienceCouncil.nav.works'));
  const [searchParams] = useSearchParams();
  const fromAssigned = searchParams.get('from') === 'assigned';
  const fromMyWorks = searchParams.get('from') === 'my-works';
  const fromSeminars = searchParams.get('from') === 'seminars';
  const fromDefenses = searchParams.get('from') === 'defenses';
  const backTarget = fromAssigned
    ? '/science-council/assigned'
    : fromMyWorks
      ? '/science-council/my-work'
      : fromSeminars
        ? '/science-council/seminars'
        : fromDefenses
          ? '/science-council/defenses'
          : '/science-council/works';
  const userId = useSessionStore((s) => s.user?.id ?? '');
  const isSecretary = (fromAssigned || fromMyWorks) ? false : can('scienceCouncil:manageMembers');
  const isTeacher = fromMyWorks ? true : (fromAssigned ? false : (can('scienceCouncil:submitWork') && !isSecretary));
  const isMember = fromAssigned ? true : (fromMyWorks ? false : (can('scienceCouncil:review') && !isSecretary && !isTeacher));
  const changeStatusMut = useChangeStatus();
  const uploadMut = useUploadDocument();
  const createReviewMut = useCreateReview();
  const makeDecisionMut = useMakeDecision();
  const memberDecisionMut = useMemberDecision();
  const acceptMut = useAcceptApplication();
  const generateMut = useGenerateProtocol();
  const signMut = useSignProtocol();
  const membersMut = useUpdateCouncilMembers();
  const docAssignMut = useUpdateDocAssignments();

  const [reviewOpen, setReviewOpen] = useState(false);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [memberDecisionOpen, setMemberDecisionOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reasonText, setReasonText] = useState('');
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'info');
  const [conclusion, setConclusion] = useState('');
  const [intro, setIntro] = useState('');
  const [reviewedDecision, setReviewedDecision] = useState<'revision' | 'rejected' | null>(null);
  const [viewDalolatnoma, setViewDalolatnoma] = useState(false);
  const [dalolatnomaModal, setDalolatnomaModal] = useState(false);
  const [eImzoLoading, setEImzoLoading] = useState(false);
  const [acceptModalOpen, setAcceptModalOpen] = useState(false);
  const [acceptMemberIds, setAcceptMemberIds] = useState<string[]>([]);
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [docAssignModalKey, setDocAssignModalKey] = useState<string | null>(null);
  const [docAssignMemberIds, setDocAssignMemberIds] = useState<string[]>([]);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [activeDocKey, setActiveDocKey] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (isLoading || !work) {
    return (
      <PageContainer title={t('scienceCouncil.title')}>
        <Flex justify="center" style={{ padding: 64 }}><Spin size="large" /></Flex>
      </PageContainer>
    );
  }


  const authorName = work.researcher?.name ?? work.externalAuthor?.name ?? '—';
  const canAccept = work.status === 'new';
  const totalMembers = work.councilMembers.length;
  const reviewedMemberIds = new Set(work.reviews.map((r) => r.memberId));
  const doneReviews = reviewedMemberIds.size;
  const allReviewsDone = totalMembers > 0 && doneReviews >= totalMembers;
  const hasProtocol = !!work.protocol?.generatedAt;
  const canTeacherUpload = isTeacher && !hasProtocol;
  const hasDecision = !!work.finalDecision;
  const canGenerateProtocol = work.status === 'reviewed' && !hasProtocol;
  const canMakeDecision =
    (work.status === 'pending' || work.status === 'not_recommended') && hasProtocol && !hasDecision;
  const openDalolatnoma = () => {
    const vars = collectVars(work);
    setIntro(work.protocol?.intro || buildIntro(vars));
    setConclusion(
      work.protocol?.finalConclusion || buildFinalConclusion(vars, isRecommended(work.reviews)),
    );
    setDalolatnomaModal(true);
  };
  const printAct = () => {
    const vars = collectVars(work);
    const html = buildDalolatnomaHtml({
      heading: buildHeading(vars),
      intro: work.protocol?.intro || buildIntro(vars),
      items: buildItems(work, lang),
      finalConclusion:
        work.protocol?.finalConclusion
        || buildFinalConclusion(vars, isRecommended(work.reviews)),
    });
    printDalolatnomaPdf(html, safeFileName(work.title));
  };

  const isPending = work.status === 'pending';
  const isAccepted = work.status === 'accepted';

  const step = workStep(work);
  const resultLabel =
    step === 'defenses'
      ? t('scienceCouncil.defense.result')
      : step === 'seminars'
        ? t('scienceCouncil.seminar.result')
        : t('scienceCouncil.work.status');
  const renderStepResult = (withReason?: boolean) => {
    if (step === 'defenses') return <DefenseResultTag result={work.defenseResult} />;
    if (step === 'seminars') return <SeminarResultTag result={work.seminarResult} />;
    return <StatusTag status={work.status} reason={withReason ? work.rejectionReason : undefined} />;
  };

  const visibleCategories = DOCUMENT_CATEGORIES;
  const isAssignedToMe = (docKey: string) =>
    isMember && (work.docAssignments[docKey] ?? []).includes(userId);
  const uploadedCount = visibleCategories.filter((c) => work.documents[c.key]?.uploaded).length;
  const totalDocs = visibleCategories.length;
  const requiredDocs = visibleCategories.filter((c) => c.required).length;
  const requiredUploaded = visibleCategories.filter(
    (c) => c.required && work.documents[c.key]?.uploaded,
  ).length;


  const handleStatusChange = (status: string, reason?: string) => {
    changeStatusMut.mutate({ id: work.id, status, reason });
  };

  const handleReviewSubmit = (values: ReviewInput) => {
    createReviewMut.mutate(values, { onSuccess: () => setReviewOpen(false) });
  };

  const header = (
    <>
      <Flex align="center" gap={16} style={{ marginBottom: 16 }}>
        <BackBtn onClick={() => navigate(backTarget)}>
          <ArrowLeftOutlined /> {t('scienceCouncil.detail.back')}
        </BackBtn>
        <div style={{ flex: 1 }}>
          <HeaderSub>{authorName} &middot; {work.year}</HeaderSub>
        </div>
        {renderStepResult(true)}
        {isSecretary && canAccept && (
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={() => { setAcceptMemberIds([]); setAcceptModalOpen(true); }}
            style={{ borderRadius: 8 }}
          >
            {t('scienceCouncil.actions.accept')}
          </Button>
        )}
        {isSecretary && canAccept && (
          <Button
            danger
            icon={<CloseCircleOutlined />}
            onClick={() => { setReasonText(''); setRejectOpen(true); }}
            style={{ borderRadius: 8 }}
          >
            {t('scienceCouncil.actions.reject')}
          </Button>
        )}
      </Flex>

      {isSecretary && (canMakeDecision || work.status === 'revision') && (
        <ActionGroup style={{ marginBottom: 12 }}>
          {canMakeDecision && (
            <Button type="primary" onClick={() => setDecisionOpen(true)}>
              {t('scienceCouncil.actions')}
            </Button>
          )}
          {work.status === 'revision' && (
            <Button
              icon={<ReloadOutlined />}
              onClick={() => handleStatusChange('pending')}
              loading={changeStatusMut.isPending}
            >
              {t('scienceCouncil.status.pending')}
            </Button>
          )}
        </ActionGroup>
      )}

      {isSecretary && isPending && totalMembers > 0 && !allReviewsDone && (
        <ReviewProgressBanner $done={false}>
          <BannerIcon $done={false}>
            <MessageOutlined />
          </BannerIcon>
          <BannerContent>
            <div className="banner-title">{t('scienceCouncil.detail.reviewsAwaiting')}</div>
            <div className="banner-desc">
              {t('scienceCouncil.detail.reviewsAwaitingDesc')
                .replace('{done}', String(doneReviews))
                .replace('{total}', String(totalMembers))}
            </div>
          </BannerContent>
          <BannerCounter>{doneReviews}/{totalMembers}</BannerCounter>
        </ReviewProgressBanner>
      )}

      {isSecretary && canGenerateProtocol && (
        <ReviewProgressBanner $done>
          <BannerIcon $done>
            <FileDoneOutlined />
          </BannerIcon>
          <BannerContent>
            <div className="banner-title">{t('scienceCouncil.detail.allReviewsDone')}</div>
            <div className="banner-desc">{t('scienceCouncil.detail.allReviewsDoneDesc')}</div>
          </BannerContent>
          <Flex gap={8} style={{ flexShrink: 0 }}>
            <Button
              type="primary"
              icon={<FileDoneOutlined />}
              onClick={openDalolatnoma}
              style={{ background: '#7c3aed', borderColor: '#7c3aed', borderRadius: 8, fontWeight: 600 }}
            >
              {t('scienceCouncil.protocol.generate')}
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => setReviewedDecision('revision')}
              style={{ borderRadius: 8 }}
            >
              {t('scienceCouncil.decision.revision')}
            </Button>
            <Button
              danger
              icon={<CloseCircleOutlined />}
              onClick={() => setReviewedDecision('rejected')}
              style={{ borderRadius: 8 }}
            >
              {t('scienceCouncil.decision.reject')}
            </Button>
          </Flex>
        </ReviewProgressBanner>
      )}

      {work.status === 'revision' && work.revisionComment && (
        <RevisionBanner style={{ marginBottom: 12 }}>
          <strong>{t('scienceCouncil.decision.revision')}:</strong> {work.revisionComment}
          {work.revisionDocs && work.revisionDocs.length > 0 && (
            <div style={{ marginTop: 6 }}>
              {t('scienceCouncil.tab.documents')}:{' '}
              {work.revisionDocs.map((dk) => {
                const cat = DOCUMENT_CATEGORIES.find((c) => c.key === dk);
                return (
                  <Tag key={dk} color="purple" style={{ marginTop: 4 }}>
                    {lang === 'ru' ? cat?.labelRu ?? dk : cat?.labelUz ?? dk}
                  </Tag>
                );
              })}
            </div>
          )}
        </RevisionBanner>
      )}

      {work.status === 'rejected' && work.rejectionReason && (
        <RejectionBanner style={{ marginBottom: 12 }}>
          <strong>{t('scienceCouncil.decision.reject')}:</strong> {work.rejectionReason}
        </RejectionBanner>
      )}
    </>
  );

  const infoTab = (
    <DetailGrid>
      <DetailCell>
        <DetailLabel>{t('scienceCouncil.work.title')}</DetailLabel>
        <DetailValue>{work.title}</DetailValue>
      </DetailCell>
      <DetailCell>
        <DetailLabel>{resultLabel}</DetailLabel>
        <DetailValue>{renderStepResult()}</DetailValue>
      </DetailCell>

      <DetailCell>
        <DetailLabel>{t('scienceCouncil.work.author')}</DetailLabel>
        <DetailValue>{authorName}</DetailValue>
      </DetailCell>
      <DetailCell>
        <DetailLabel>{t('scienceCouncil.member.position')}</DetailLabel>
        <DetailValue>{work.researcher?.position ?? work.externalAuthor?.position ?? '—'}</DetailValue>
      </DetailCell>

      <DetailCell>
        <DetailLabel>{work.authorType === 'external' ? t('scienceCouncil.form.workplace') : t('scienceCouncil.form.department')}</DetailLabel>
        <DetailValue>{work.authorType === 'external' ? work.externalAuthor?.workplace ?? '—' : work.researcher?.department ?? '—'}</DetailValue>
      </DetailCell>
      <DetailCell>
        <DetailLabel>{t('scienceCouncil.work.year')}</DetailLabel>
        <DetailValue>{work.year}</DetailValue>
      </DetailCell>

      <DetailCell>
        <DetailLabel>{t('scienceCouncil.detail.createdAt')}</DetailLabel>
        <DetailValue>{formatDate(work.createdAt)}</DetailValue>
      </DetailCell>
      <DetailCell>
        <DetailLabel>{t('scienceCouncil.detail.updatedAt')}</DetailLabel>
        <DetailValue>{formatDate(work.updatedAt)}</DetailValue>
      </DetailCell>

      {work.seminarDate && (
        <DetailCell>
          <DetailLabel>{t('scienceCouncil.detail.seminarDate')}</DetailLabel>
          <DetailValue $color="#16a34a">{formatDate(work.seminarDate)}</DetailValue>
        </DetailCell>
      )}
      {work.defenseDate && (
        <DetailCell>
          <DetailLabel>{t('scienceCouncil.defense.date')}</DetailLabel>
          <DetailValue $color="#16a34a">{formatDate(work.defenseDate)}</DetailValue>
        </DetailCell>
      )}
      {work.externalAuthor?.passportSeries && (
        <DetailCell>
          <DetailLabel>{t('scienceCouncil.form.passportSeries')}</DetailLabel>
          <DetailValue>{work.externalAuthor.passportSeries} {work.externalAuthor.passportNumber}</DetailValue>
        </DetailCell>
      )}
      {work.externalAuthor?.pinfl && (
        <DetailCell>
          <DetailLabel>{t('scienceCouncil.form.pinfl')}</DetailLabel>
          <DetailValue>{work.externalAuthor.pinfl}</DetailValue>
        </DetailCell>
      )}
      {work.specialty && (
        <DetailCell>
          <DetailLabel>{t('scienceCouncil.detail.specialty')}</DetailLabel>
          <DetailValue>{work.specialty.code} — {work.specialty.title}</DetailValue>
        </DetailCell>
      )}
      {work.externalAuthor?.phone && (
        <DetailCell>
          <DetailLabel>{t('scienceCouncil.form.phone')}</DetailLabel>
          <DetailValue>{work.externalAuthor.phone}</DetailValue>
        </DetailCell>
      )}
      {work.externalAuthor?.email && (
        <DetailCell>
          <DetailLabel>{t('scienceCouncil.form.email')}</DetailLabel>
          <DetailValue>{work.externalAuthor.email}</DetailValue>
        </DetailCell>
      )}
      {work.workFile?.uploaded && (
        <DetailCell>
          <DetailLabel>{t('scienceCouncil.apply.file')}</DetailLabel>
          <DetailValue>
            {work.workFile.fileUrl ? (
              <Button
                size="small"
                icon={<DownloadOutlined />}
                href={work.workFile.fileUrl}
                target="_blank"
                rel="noreferrer"
              >
                {t('scienceCouncil.detail.downloadApplication')}
              </Button>
            ) : (
              work.workFile.fileName ?? '—'
            )}
          </DetailValue>
        </DetailCell>
      )}
    </DetailGrid>
  );

  const supervisorName =
    (work.supervisor?.type === 'internal' ? work.supervisor.user?.name : work.supervisor?.name) ?? '—';

  const supervisorBlock = work.supervisor && (
    <SupervisorCard>
      <SupervisorAvatar>
        <SolutionOutlined />
      </SupervisorAvatar>
      <SupervisorBody>
        <SupervisorEyebrow>{t('scienceCouncil.form.supervisor')}</SupervisorEyebrow>
        <SupervisorName>{supervisorName}</SupervisorName>
        <SupervisorChips>
          {work.supervisor.academicTitle && (
            <SupervisorChip>
              <SafetyCertificateOutlined /> {work.supervisor.academicTitle}
            </SupervisorChip>
          )}
          {work.supervisor.degree && (
            <SupervisorChip>
              <AuditOutlined /> {work.supervisor.degree}
            </SupervisorChip>
          )}
        </SupervisorChips>
        <SupervisorMeta>
          <div>
            <DetailLabel>{t('scienceCouncil.form.workplace')}</DetailLabel>
            <DetailValue>
              {work.supervisor.type === 'internal' ? 'FJSTI' : (work.supervisor.workplace ?? '—')}
            </DetailValue>
          </div>
          <div>
            <DetailLabel>{t('scienceCouncil.form.email')}</DetailLabel>
            <DetailValue>{work.supervisor.email ?? '—'}</DetailValue>
          </div>
          <div>
            <DetailLabel>{t('scienceCouncil.form.phone')}</DetailLabel>
            <DetailValue>{work.supervisor.phone ?? '—'}</DetailValue>
          </div>
          <div>
            <DetailLabel>{t('scienceCouncil.member.position')}</DetailLabel>
            <DetailValue>{work.supervisor.position ?? '—'}</DetailValue>
          </div>
        </SupervisorMeta>
      </SupervisorBody>
    </SupervisorCard>
  );

  const documentsTab = (
    <TabCard>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-secondary, #eaecf0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text, #121926)' }}>
          {t('scienceCouncil.tab.documents')} ({uploadedCount}/{totalDocs})
        </span>
        <span style={{ fontSize: 12, color: 'var(--color-text-tertiary, #667085)' }}>
          {t('scienceCouncil.detail.required')}: {requiredUploaded}/{requiredDocs}
        </span>
      </div>
      {canTeacherUpload && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderBottom: '1px solid #eaecf0', fontSize: 13, color: '#166534' }}>
          <UploadOutlined />
          {lang === 'uz'
            ? "Hujjatlarni yuklash yoki yangilash uchun tegishli tugmani bosing."
            : 'Нажмите соответствующую кнопку для загрузки или обновления документов.'}
        </div>
      )}
      {visibleCategories.map((cat) => {
        const doc = work.documents[cat.key];
        const uploaded = doc?.uploaded;
        const assignedIds = work.docAssignments[cat.key] ?? [];
        const status: 'uploaded' | 'required' | 'optional' = uploaded ? 'uploaded' : cat.required ? 'required' : 'optional';
        const reviewsForDoc = work.reviews.filter((r) => r.docKey === cat.key);
        const positiveCount = reviewsForDoc.filter((r) => r.type === 'positive').length;
        const neutralCount = reviewsForDoc.filter((r) => r.type === 'neutral').length;
        const negativeCount = reviewsForDoc.filter((r) => r.type === 'negative').length;

        const memberTags = assignedIds.map((mid) => {
          const m = allMembers.find((am) => am.userId === mid);
          if (!m) return null;
          const deg = (m.degree ?? '').toLowerCase();
          const pos = m.position ?? '';
          const shortPos = deg.includes('dotsent') ? 'Dots.'
            : deg.includes('professor') ? 'Prof.'
            : deg.includes('doktor') ? 'D.f.n.'
            : pos ? `${(pos.split(' ')[0] ?? '').charAt(0).toUpperCase()}${(pos.split(' ')[0] ?? '').slice(1, 4).toLowerCase()}.` : '';
          const label = `${shortPos} ${toInitials(m.name)}`.trim();
          return { id: mid, label };
        }).filter(Boolean) as { id: string; label: string }[];

        return (
          <DocRow key={cat.key} $uploaded={uploaded} style={{ flexWrap: 'wrap', padding: '12px 16px' }}>
            <DocIcon $status={status} style={{ alignSelf: 'flex-start', marginTop: 2 }}>
              {uploaded ? <CheckCircleOutlined /> : status === 'required' ? <FileTextOutlined /> : <MinusOutlined />}
            </DocIcon>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text, #121926)' }}>
                  {lang === 'ru' ? cat.labelRu : cat.labelUz}
                </span>
                {uploaded && <PaperClipOutlined style={{ fontSize: 12, color: 'var(--color-text-tertiary, #667085)' }} />}
                <Tag
                  color={cat.required ? 'orange' : 'default'}
                  style={{ fontSize: 10, lineHeight: '18px', padding: '0 6px', borderRadius: 4 }}
                >
                  {cat.required ? t('scienceCouncil.detail.mandatory') : t('scienceCouncil.detail.optional')}
                </Tag>
                {isAssignedToMe(cat.key) && (
                  <Tag
                    color="processing"
                    style={{ fontSize: 10, lineHeight: '18px', padding: '0 6px', borderRadius: 4, margin: 0 }}
                  >
                    {t('scienceCouncil.detail.assignedToMe')}
                  </Tag>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-tertiary, #667085)', marginBottom: memberTags.length > 0 ? 6 : 0 }}>
                {uploaded && doc?.fileName ? doc.fileName.split('.').pop()?.toUpperCase() ?? 'FILE' : ''}
                {!uploaded && ''}
              </div>
              {!isTeacher && memberTags.length > 0 && (
                <Flex gap={6} wrap="wrap">
                  {memberTags.map((mt) => (
                    <Tag key={mt.id} style={{ margin: 0, fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <UserOutlined style={{ fontSize: 10, color: '#6366f1' }} /> {mt.label}
                    </Tag>
                  ))}
                </Flex>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
              {uploaded && doc?.uploadedAt && (
                <span style={{ fontSize: 12, color: 'var(--color-text-tertiary, #667085)' }}>
                  {formatDate(doc.uploadedAt)}
                </span>
              )}
              {!uploaded && (
                <span style={{ fontSize: 12, color: '#d97706', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <WarningOutlined /> {t('scienceCouncil.doc.notUploaded')}
                </span>
              )}
              {canTeacherUpload && (
                <Button
                  size="small"
                  type={uploaded ? 'default' : 'primary'}
                  icon={<UploadOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveDocKey(cat.key);
                    setSelectedFile(null);
                    setUploadModalOpen(true);
                  }}
                  style={uploaded
                    ? { borderRadius: 6, borderColor: '#0891b2', color: '#0891b2' }
                    : { borderRadius: 6, background: '#16a34a', borderColor: '#16a34a' }
                  }
                >
                  {uploaded ? (lang === 'uz' ? 'Yangilash' : 'Обновить') : t('scienceCouncil.doc.upload')}
                </Button>
              )}
              {uploaded && reviewsForDoc.length > 0 && (
                <Flex gap={8} align="center">
                  {positiveCount > 0 && (
                    <span style={{ fontSize: 12, color: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                      <LikeOutlined /> {positiveCount}
                    </span>
                  )}
                  {neutralCount > 0 && (
                    <span style={{ fontSize: 12, color: '#6b7280', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                      <MinusOutlined /> {neutralCount}
                    </span>
                  )}
                  {negativeCount > 0 && (
                    <span style={{ fontSize: 12, color: '#dc2626', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                      <DislikeOutlined /> {negativeCount}
                    </span>
                  )}
                  <Tag color="green" style={{ margin: 0, fontSize: 11 }}>
                    <TeamOutlined /> {assignedIds.length} {t('scienceCouncil.detail.memberCount')}
                  </Tag>
                </Flex>
              )}
              {isSecretary && (isPending || isAccepted) && !hasProtocol && work.councilMembers.length > 0 && (
                <Button
                  size="small"
                  type="dashed"
                  icon={<TeamOutlined />}
                  style={{ borderRadius: 6, color: '#16a34a', borderColor: '#bbf7d0', fontSize: 12 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDocAssignMemberIds(assignedIds);
                    setDocAssignModalKey(cat.key);
                  }}
                >
                  {assignedIds.length > 0
                    ? (lang === 'uz' ? `A'zolar (${assignedIds.length})` : `Члены (${assignedIds.length})`)
                    : (lang === 'uz' ? "A'zo biriktirish" : 'Назначить членов')}
                </Button>
              )}
            </div>
          </DocRow>
        );
      })}
    </TabCard>
  );

  const membersTab = (
    <TabCard>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-secondary, #eaecf0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text, #121926)' }}>
          {t('scienceCouncil.tab.members')} ({work.councilMembers.length})
        </span>
        {isSecretary && (isPending || isAccepted) && !hasProtocol && (
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            style={{ borderRadius: 8, background: '#16a34a', borderColor: '#16a34a' }}
            onClick={() => {
              setSelectedMemberIds(work.councilMembers.map((cm) => cm.id));
              setMembersModalOpen(true);
            }}
          >
            {lang === 'uz' ? "A'zolarni tahrirlash" : 'Редактировать членов'}
          </Button>
        )}
      </div>
      {work.councilMembers.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-tertiary, #667085)' }}>
          {t('scienceCouncil.noData')}
        </div>
      ) : (
        work.councilMembers.map((cm, idx) => {
          const memberDetail = allMembers.find((m) => m.userId === cm.id);
          const assignedDocs = Object.entries(work.docAssignments)
            .filter(([, ids]) => ids.includes(cm.id))
            .map(([key]) => key);
          const memberReviews = work.reviews.filter((r) => r.memberId === cm.id);

          return (
            <MemberRow key={cm.id}>
              <MemberNum>{idx + 1}</MemberNum>
              <MemberInfo>
                <div className="member-name">{cm.name}</div>
                <div className="member-pos">
                  {memberDetail ? `${memberDetail.position} — ${memberDetail.degree}` : ''}
                </div>
              </MemberInfo>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <Tag color="blue">{assignedDocs.length} {t('scienceCouncil.detail.docs')}</Tag>
                <Tag color={memberReviews.length > 0 ? 'green' : 'default'}>
                  {memberReviews.length} {t('scienceCouncil.detail.reviewCount')}
                </Tag>
                {isSecretary && (isPending || isAccepted) && !hasProtocol && (
                  <Popconfirm
                    title={lang === 'uz' ? "A'zoni olib tashlash" : 'Удалить члена'}
                    description={lang === 'uz'
                      ? `${cm.name}ni kengashdan olib tashlaysizmi?`
                      : `Удалить ${cm.name} из совета?`}
                    okText={lang === 'uz' ? 'Ha' : 'Да'}
                    cancelText={t('scienceCouncil.cancel')}
                    okButtonProps={{ danger: true }}
                    onConfirm={() => {
                      const remainingIds = work.councilMembers
                        .filter((m) => m.id !== cm.id)
                        .map((m) => m.id);
                      membersMut.mutate(
                        { workId: work.id, memberIds: remainingIds },
                        {
                          onError: (err) => {
                            const backendMessage = (err as { response?: { data?: { message?: string } } })
                              .response?.data?.message;
                            message.error(backendMessage || (lang === 'uz' ? "A'zoni olib tashlab bo'lmadi" : 'Не удалось удалить члена'));
                          },
                        },
                      );
                    }}
                  >
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<UserDeleteOutlined />}
                      loading={membersMut.isPending}
                    />
                  </Popconfirm>
                )}
              </div>
            </MemberRow>
          );
        })
      )}

    </TabCard>
  );

  const visibleReviews = isMember
    ? work.reviews.filter((r) => r.memberId === userId)
    : work.reviews;
  const myAssignedDocKeys = isMember
    ? Object.entries(work.docAssignments)
        .filter(([, ids]) => ids.includes(userId))
        .map(([key]) => key)
    : [];
  const myReviewedDocKeys = isMember
    ? work.reviews
        .filter((r) => r.memberId === userId && myAssignedDocKeys.includes(r.docKey))
        .map((r) => r.docKey)
    : [];
  const remainingDocKeys = myAssignedDocKeys.filter((k) => !myReviewedDocKeys.includes(k));
  const allReviewsDoneByMe = myAssignedDocKeys.length > 0 && remainingDocKeys.length === 0;
  const canAddReview = isMember && isPending && remainingDocKeys.length > 0 && !hasProtocol;
  const canMemberDecide = isMember && isPending;

  const reviewsTab = (
    <div>
      <Flex justify="space-between" align="center" style={{ marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text, #121926)' }}>
          {isMember ? (lang === 'uz' ? 'Mening xulosalarim' : 'Мои заключения') : t('scienceCouncil.tab.reviews')} ({visibleReviews.length})
        </span>
        <Flex gap={8}>
          {canMemberDecide && (
            <Button
              danger
              icon={<CloseCircleOutlined />}
              onClick={() => setMemberDecisionOpen(true)}
            >
              {lang === 'uz' ? 'Rad etish / Qaytarish' : 'Отклонить / Вернуть'}
            </Button>
          )}
          {canAddReview && (
            <Button
              type="primary"
              icon={<CommentOutlined />}
              onClick={() => setReviewOpen(true)}
              style={{ background: '#16a34a', borderColor: '#16a34a', borderRadius: 8 }}
            >
              {lang === 'uz' ? 'Xulosa qoldirish' : 'Оставить заключение'}
            </Button>
          )}
        </Flex>
      </Flex>

      {isMember && isPending && myAssignedDocKeys.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#fefce8', border: '1px solid #fde68a', borderRadius: 10, marginBottom: 12, fontSize: 13, color: '#92400e' }}>
          <LockOutlined />
          {lang === 'uz'
            ? "Sizga hali hujjat biriktirilmagan. Kotib hujjat biriktirgach xulosa qoldira olasiz."
            : 'Вам ещё не назначены документы. Вы сможете оставить заключение после назначения.'}
        </div>
      )}

      {isMember && isPending && allReviewsDoneByMe && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, marginBottom: 12, fontSize: 13, color: '#166534' }}>
          <CheckCircleOutlined />
          {lang === 'uz'
            ? `Barcha biriktirilgan hujjatlar (${myAssignedDocKeys.length}) bo'yicha xulosa qoldirildi.`
            : `Заключения по всем назначенным документам (${myAssignedDocKeys.length}) оставлены.`}
        </div>
      )}

      {visibleReviews.length === 0 && !(isMember && isPending && myAssignedDocKeys.length === 0) && !(isMember && isPending && allReviewsDoneByMe) ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-tertiary, #667085)', background: 'var(--bg-surface, #fff)', borderRadius: 'var(--radius-lg, 12px)', border: '1px solid var(--border-secondary, #eaecf0)' }}>
          {t('scienceCouncil.noData')}
        </div>
      ) : (
        visibleReviews.map((review: WorkReview) => {
          const cat = DOCUMENT_CATEGORIES.find((c) => c.key === review.docKey);
          const docLabel = lang === 'ru' ? cat?.labelRu ?? review.docKey : cat?.labelUz ?? review.docKey;
          const typeLabel = t(`scienceCouncil.review.${review.type}`);

          return (
            <ReviewCard key={review.id} $type={review.type}>
              <ReviewHeader>
                <div>
                  <span className="reviewer-name">{review.memberName}</span>
                  <Tag
                    color={review.type === 'positive' ? 'green' : review.type === 'negative' ? 'red' : 'default'}
                    style={{ marginLeft: 8 }}
                  >
                    {typeLabel}
                  </Tag>
                </div>
                <span className="review-date">{new Date(review.reviewedAt).toLocaleDateString()}</span>
              </ReviewHeader>
              <div style={{ fontSize: 12, color: 'var(--color-text-tertiary, #667085)', marginBottom: 6 }}>
                <FileTextOutlined style={{ marginRight: 4 }} /> {docLabel}
              </div>
              <ReviewText>{review.text}</ReviewText>
            </ReviewCard>
          );
        })
      )}
    </div>
  );

  const handleEImzo = () => {
    setEImzoLoading(true);
    generateMut.mutate(
      { workId: work.id, conclusion, intro },
      {
        onSuccess: () => {
          signMut.mutate(work.id, {
            onSuccess: () => {
              setEImzoLoading(false);
              setDalolatnomaModal(false);
              setConclusion('');
              setIntro('');
            },
            onError: () => setEImzoLoading(false),
          });
        },
        onError: () => setEImzoLoading(false),
      },
    );
  };

  const decisionHistoryBlock = work.decisionHistory.length > 0 && (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text, #121926)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <HistoryOutlined style={{ color: '#6366f1' }} />
        {t('scienceCouncil.detail.decisionHistory')}
      </div>
      {work.decisionHistory.map((dh) => (
        <DecisionCard key={dh.id} $type={dh.decision}>
          <Flex justify="space-between" align="center" style={{ marginBottom: 6 }}>
            <Tag color={dh.decision === 'seminar' ? 'green' : dh.decision === 'rejected' ? 'red' : 'purple'}>
              {t(`scienceCouncil.decision.${dh.decision}`)}
            </Tag>
            <span style={{ fontSize: 11, color: 'var(--color-text-tertiary, #9ca3af)' }}>
              {new Date(dh.date).toLocaleDateString()}
            </span>
          </Flex>
          <div style={{ fontSize: 12, color: 'var(--color-text-tertiary, #667085)', marginBottom: 4 }}>
            <strong>{lang === 'uz' ? 'Kim tomonidan:' : 'Кем:'}</strong> {dh.by}
          </div>
          {dh.seminarDate && (
            <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
              {t('scienceCouncil.seminar.label')}: {formatDate(dh.seminarDate)}
            </div>
          )}
          {dh.comment && (
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary, #475467)', marginTop: 4 }}>
              {dh.comment}
            </div>
          )}
          {dh.revisionDocs && dh.revisionDocs.length > 0 && (
            <div style={{ marginTop: 6 }}>
              {dh.revisionDocs.map((dk) => {
                const cat = DOCUMENT_CATEGORIES.find((c) => c.key === dk);
                return <Tag key={dk} style={{ marginTop: 2 }}>{lang === 'ru' ? cat?.labelRu ?? dk : cat?.labelUz ?? dk}</Tag>;
              })}
            </div>
          )}
        </DecisionCard>
      ))}
    </div>
  );

  const protocolTab = work.protocol ? (
    <div style={{ padding: 20 }}>
      {work.protocol.immutable && (
        <Alert
          icon={<LockOutlined />}
          type="warning"
          showIcon
          message={t('scienceCouncil.protocol.immutableWarning')}
          style={{ marginBottom: 16, borderRadius: 10 }}
        />
      )}

      <ProtocolViewCard onClick={() => setViewDalolatnoma(true)}>
        <ProtocolViewIcon>
          <FileDoneOutlined />
        </ProtocolViewIcon>
        <ProtocolViewContent>
          <div className="pv-title">{t('scienceCouncil.protocol.viewFull')}</div>
          <div className="pv-desc">{t('scienceCouncil.protocol.viewFullDesc')}</div>
        </ProtocolViewContent>
        <Button type="primary" style={{ background: '#7c3aed', borderColor: '#7c3aed', borderRadius: 8, flexShrink: 0 }}>
          {t('scienceCouncil.protocol.view')}
        </Button>
      </ProtocolViewCard>

      {work.protocol.eImzoSigned && (
        <ProtocolSignedCard>
          <ProtocolSignedHeader>
            <CheckCircleOutlined className="ps-icon" />
            <span className="ps-title">{t('scienceCouncil.protocol.signed')}</span>
            <Tag color="purple" style={{ marginLeft: 'auto' }}>
              {t('scienceCouncil.protocol.cryptoSign')}
            </Tag>
          </ProtocolSignedHeader>
          <ProtocolInfoGrid>
            <ProtocolInfoItem>
              <div className="pi-label">{t('scienceCouncil.detail.generatedAt')}</div>
              <div className="pi-value">{work.protocol.generatedAt}</div>
            </ProtocolInfoItem>
            <ProtocolInfoItem>
              <div className="pi-label">{t('scienceCouncil.protocol.signedDate')}</div>
              <div className="pi-value">{work.protocol.signedAt}</div>
            </ProtocolInfoItem>
            <ProtocolInfoItem>
              <div className="pi-label">{t('scienceCouncil.protocol.signedBy')}</div>
              <div className="pi-value">{work.protocol.signedBy}</div>
            </ProtocolInfoItem>
            <ProtocolInfoItem>
              <div className="pi-label">{t('scienceCouncil.protocol.certificate')}</div>
              <div className="pi-cert">{work.protocol.eImzoCert}</div>
            </ProtocolInfoItem>
          </ProtocolInfoGrid>
        </ProtocolSignedCard>
      )}

      {!work.protocol.eImzoSigned && (
        <Flex gap={8} style={{ marginBottom: 16 }}>
          {!work.protocol.immutable && (
            <Button icon={<EditOutlined />} onClick={openDalolatnoma}>
              {t('scienceCouncil.work.edit')}
            </Button>
          )}
          <Button
            type="primary"
            icon={<SafetyCertificateOutlined />}
            loading={signMut.isPending}
            onClick={() => signMut.mutate(work.id)}
            style={{ background: '#7c3aed', borderColor: '#7c3aed' }}
          >
            {t('scienceCouncil.protocol.sign')}
          </Button>
        </Flex>
      )}

      {decisionHistoryBlock}
    </div>
  ) : null;

  const auditTab = (
    <TabCard style={{ padding: 16 }}>
      {work.auditLog.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-tertiary, #667085)' }}>
          {t('scienceCouncil.noData')}
        </div>
      ) : (
        <Timeline
          items={work.auditLog.map((entry: AuditEntry) => {
            const actionKey = entry.action.toLowerCase().replace(/\s+/g, '_');
            const color = AUDIT_COLORS[actionKey] ?? '#6b7280';
            return {
              color,
              children: (
                <AuditItem>
                  <div className="audit-action">{entry.action}</div>
                  {entry.detail && <div className="audit-detail">{entry.detail}</div>}
                  <div className="audit-user">
                    {entry.user}
                    <Tag
                      style={{ marginLeft: 6, fontSize: 10 }}
                      color={entry.role === 'kotib' ? 'purple' : entry.role === "a'zo" ? 'blue' : 'default'}
                    >
                      {entry.role}
                    </Tag>
                    &middot; {new Date(entry.date).toLocaleString()}
                  </div>
                </AuditItem>
              ),
            };
          })}
        />
      )}
    </TabCard>
  );

  const protocolBadge = work.protocol?.eImzoSigned ? 'E-imzo' : undefined;

  const tabItems = [
    {
      key: 'info',
      label: <span><UserOutlined style={{ marginRight: 6 }} />{t('scienceCouncil.tab.info')}</span>,
      children: <>{infoTab}{supervisorBlock}</>,
    },
    {
      key: 'documents',
      label: <span><FileTextOutlined style={{ marginRight: 6 }} />{t('scienceCouncil.tab.documents')} <Tag style={{ marginLeft: 4 }}>{uploadedCount}/{totalDocs}</Tag></span>,
      children: documentsTab,
    },
    {
      key: 'members',
      label: <span><TeamOutlined style={{ marginRight: 6 }} />{t('scienceCouncil.tab.members')} <Tag style={{ marginLeft: 4 }}>{work.councilMembers.length}</Tag></span>,
      children: membersTab,
    },
    {
      key: 'reviews',
      label: <span><SolutionOutlined style={{ marginRight: 6 }} />{isMember ? (lang === 'uz' ? 'Mening xulosalarim' : 'Мои заключения') : t('scienceCouncil.tab.reviews')} <Tag style={{ marginLeft: 4 }}>{visibleReviews.length}</Tag></span>,
      children: reviewsTab,
    },
    ...(isSecretary && protocolTab ? [{
      key: 'protocol',
      label: <span><SafetyCertificateOutlined style={{ marginRight: 6 }} />{t('scienceCouncil.tab.protocol')} {protocolBadge && <Tag color="green" style={{ marginLeft: 4 }}>{protocolBadge}</Tag>}</span>,
      children: protocolTab,
    }] : []),
    {
      key: 'audit',
      label: <span><AuditOutlined style={{ marginRight: 6 }} />{t('scienceCouncil.tab.audit')} <Tag style={{ marginLeft: 4 }}>{work.auditLog.length}</Tag></span>,
      children: auditTab,
    },
  ];

  return (
    <PageContainer title={`${t('scienceCouncil.title')} — ${work.title}`}>
      {header}
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />

      {isMember && (
        <ReviewModal
          open={reviewOpen}
          onClose={() => setReviewOpen(false)}
          onSubmit={handleReviewSubmit}
          loading={createReviewMut.isPending}
          workId={work.id}
          assignedDocKeys={remainingDocKeys}
        />
      )}

      <DecisionModal
        open={decisionOpen}
        onClose={() => setDecisionOpen(false)}
        onSubmit={(values: DecisionInput) => {
          makeDecisionMut.mutate(values, { onSuccess: () => setDecisionOpen(false) });
        }}
        loading={makeDecisionMut.isPending}
        workId={work.id}
      />

      <DecisionModal
        open={reviewedDecision !== null}
        onClose={() => setReviewedDecision(null)}
        allowedTypes={['revision', 'rejected']}
        defaultType={reviewedDecision ?? undefined}
        onSubmit={(values: DecisionInput) => {
          makeDecisionMut.mutate(values, { onSuccess: () => setReviewedDecision(null) });
        }}
        loading={makeDecisionMut.isPending}
        workId={work.id}
      />

      <DecisionModal
        open={memberDecisionOpen}
        onClose={() => setMemberDecisionOpen(false)}
        allowedTypes={['revision', 'rejected']}
        docKeyOptions={myAssignedDocKeys}
        onSubmit={(values: DecisionInput) => {
          memberDecisionMut.mutate(
            {
              workId: values.workId,
              type: values.type as 'revision' | 'rejected',
              comment: values.comment,
              revisionDocs: values.revisionDocs,
              rejectionReason: values.rejectionReason,
            },
            { onSuccess: () => setMemberDecisionOpen(false) },
          );
        }}
        loading={memberDecisionMut.isPending}
        workId={work.id}
      />

      <Modal
        open={rejectOpen}
        title={
          <span style={{ color: '#dc2626', fontWeight: 700 }}>
            <CloseCircleOutlined style={{ marginRight: 8 }} />
            {t('scienceCouncil.quick.rejectTitle')}
          </span>
        }
        okText={t('scienceCouncil.quick.rejectOk')}
        cancelText={t('scienceCouncil.cancel')}
        okButtonProps={{
          danger: true,
          disabled: !reasonText.trim(),
          loading: makeDecisionMut.isPending,
          style: { background: '#dc2626', borderColor: '#dc2626' },
        }}
        onCancel={() => setRejectOpen(false)}
        onOk={() => {
          makeDecisionMut.mutate(
            {
              workId: work.id,
              type: 'rejected',
              comment: reasonText.trim(),
              rejectionReason: reasonText.trim(),
            },
            { onSuccess: () => setRejectOpen(false) },
          );
        }}
        width={520}
      >
        <div style={{ marginTop: 8 }}>
          <div style={{ background: '#fef2f2', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#991b1b', border: '1px solid #fecaca' }}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>{work.title}</div>
            <div style={{ fontSize: 12, color: '#b91c1c' }}>{authorName}</div>
          </div>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>{t('scienceCouncil.quick.reasonLabel')}</div>
          <TextArea
            rows={4}
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            placeholder={lang === 'uz' ? 'Batafsil sababni kiriting...' : 'Укажите причину подробно...'}
            maxLength={2000}
            showCount
          />
          <div style={{ marginTop: 12, fontSize: 13, color: '#6b7280' }}>
            {lang === 'uz'
              ? "Ilmiy ish rad etilgandan so'ng, muallif qayta topshira olmaydi. Bu qaror qaytarib bo'lmaydi."
              : 'После отклонения работы автор не сможет подать её повторно. Это решение необратимо.'}
          </div>
        </div>
      </Modal>

      <Modal
        title={
          <span style={{ color: '#7c3aed', fontWeight: 700 }}>
            <FileDoneOutlined style={{ marginRight: 8 }} />
            {t('scienceCouncil.tab.protocol')}
            {work.protocol?.eImzoSigned && (
              <Tag color="purple" style={{ marginLeft: 8 }}>E-imzo</Tag>
            )}
          </span>
        }
        open={viewDalolatnoma}
        onCancel={() => setViewDalolatnoma(false)}
        width={680}
        footer={
          <>
            <Button icon={<DownloadOutlined />} onClick={printAct}>
              {t('scienceCouncil.protocol.pdf')}
            </Button>
            <Button onClick={() => setViewDalolatnoma(false)}>
              {t('scienceCouncil.protocol.close')}
            </Button>
          </>
        }
      >
        <DalolatnomaDraft
          work={work}
          intro={work.protocol?.intro || ''}
          finalConclusion={work.protocol?.finalConclusion || ''}
        />

        {work.protocol?.eImzoSigned && (
          <div style={{ marginTop: 16, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <CheckCircleOutlined style={{ color: '#16a34a' }} />
              <span style={{ fontWeight: 700, fontSize: 13, color: '#15803d' }}>
                {t('scienceCouncil.protocol.signed')}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary, #475467)', lineHeight: 1.7 }}>
              <div><strong>{t('scienceCouncil.protocol.signedBy')}:</strong> {work.protocol.signedBy}</div>
              <div><strong>{t('scienceCouncil.protocol.date')}:</strong> {work.protocol.signedAt}</div>
              <div style={{ wordBreak: 'break-all', color: '#7c3aed', fontSize: 11, marginTop: 4 }}>{work.protocol.eImzoCert}</div>
            </div>
          </div>
        )}

        {work.decisionHistory.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {work.decisionHistory.map((dh) => (
              <DecisionCard key={dh.id} $type={dh.decision} style={{ marginTop: 8 }}>
                <Flex justify="space-between" align="center" style={{ marginBottom: 6 }}>
                  <Tag color={dh.decision === 'seminar' ? 'green' : dh.decision === 'rejected' ? 'red' : 'purple'}>
                    {t(`scienceCouncil.decision.${dh.decision}`)}
                  </Tag>
                  <span style={{ fontSize: 11, color: 'var(--color-text-tertiary, #9ca3af)' }}>
                    {new Date(dh.date).toLocaleDateString()}
                  </span>
                </Flex>
                {dh.seminarDate && (
                  <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
                    {t('scienceCouncil.seminar.label')}: {formatDate(dh.seminarDate)}
                  </div>
                )}
                {dh.comment && (
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary, #475467)', marginTop: 4 }}>
                    {dh.comment}
                  </div>
                )}
              </DecisionCard>
            ))}
          </div>
        )}
      </Modal>

      <Modal
        open={acceptModalOpen}
        onCancel={() => setAcceptModalOpen(false)}
        onOk={() => {
          if (acceptMemberIds.length === 0) {
            message.warning(t('scienceCouncil.quick.acceptMembersRequired'));
            return;
          }
          acceptMut.mutate(
            { id: work.id, memberIds: acceptMemberIds },
            { onSuccess: () => setAcceptModalOpen(false) },
          );
        }}
        okText={lang === 'uz' ? 'Ha, qabul qilish' : 'Да, принять'}
        cancelText={t('scienceCouncil.cancel')}
        okButtonProps={{ style: { background: '#0891b2', borderColor: '#0891b2' }, loading: acceptMut.isPending }}
        title={
          <span style={{ color: '#0891b2', fontWeight: 700 }}>
            <CheckCircleOutlined style={{ marginRight: 8 }} />
            {lang === 'uz' ? 'Ilmiy ishni qabul qilish' : 'Принять научную работу'}
          </span>
        }
      >
        <div style={{ marginTop: 8 }}>
          <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#374151', border: '1px solid #e5e7eb' }}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>{work.title}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{authorName}</div>
          </div>
          <div style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>
            {t('scienceCouncil.quick.acceptConfirm')}
          </div>
          <div style={{ marginBottom: 6, fontWeight: 500 }}>
            {t('scienceCouncil.form.selectMembers')}
          </div>
          <Select
            mode="multiple"
            allowClear
            style={{ width: '100%' }}
            placeholder={t('scienceCouncil.form.selectMembers')}
            value={acceptMemberIds}
            onChange={(val: string[]) => setAcceptMemberIds(val)}
            optionFilterProp="label"
            options={allMembers.filter((m) => m.active).map((m) => ({
              value: m.userId,
              label: `${m.name} (${m.degree})`,
            }))}
          />
        </div>
      </Modal>

      <Modal
        open={membersModalOpen}
        onCancel={() => setMembersModalOpen(false)}
        onOk={() => {
          membersMut.mutate(
            { workId: work.id, memberIds: selectedMemberIds },
            {
              onSuccess: () => setMembersModalOpen(false),
              onError: (err) => {
                const backendMessage = (err as { response?: { data?: { message?: string } } })
                  .response?.data?.message;
                message.error(backendMessage || (lang === 'uz' ? "A'zolarni saqlab bo'lmadi" : 'Не удалось сохранить членов'));
              },
            },
          );
        }}
        okText={lang === 'uz' ? 'Saqlash' : 'Сохранить'}
        cancelText={t('scienceCouncil.cancel')}
        okButtonProps={{ style: { background: '#16a34a', borderColor: '#16a34a' }, loading: membersMut.isPending }}
        title={
          <span style={{ color: '#16a34a', fontWeight: 700 }}>
            <TeamOutlined style={{ marginRight: 8 }} />
            {lang === 'uz' ? "Kengash a'zolarini tahrirlash" : 'Редактировать членов совета'}
          </span>
        }
        width={560}
      >
        <div style={{ marginTop: 12, marginBottom: 8, fontSize: 13, color: '#6b7280' }}>
          {lang === 'uz'
            ? "Ushbu ish uchun kengash a'zolarini tanlang:"
            : 'Выберите членов совета для этой работы:'}
        </div>
        <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, padding: '4px 12px' }}>
          {allMembers.filter((m) => m.active).map((m) => {
            const checked = selectedMemberIds.includes(m.userId);
            return (
              <div key={m.id} style={{ padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                <Checkbox
                  checked={checked}
                  onChange={() => {
                    setSelectedMemberIds((prev) =>
                      prev.includes(m.userId)
                        ? prev.filter((id) => id !== m.userId)
                        : [...prev, m.userId],
                    );
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{m.name}</span>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{m.position} — {m.degree}</div>
                </Checkbox>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 12, padding: '8px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, fontSize: 12, color: '#15803d' }}>
          {lang === 'uz' ? 'Tanlandi:' : 'Выбрано:'} <strong>{selectedMemberIds.length}</strong> {lang === 'uz' ? "a'zo" : 'членов'}
        </div>
      </Modal>

      <Modal
        open={!!docAssignModalKey}
        onCancel={() => setDocAssignModalKey(null)}
        onOk={() => {
          if (!docAssignModalKey) return;
          const updated = { ...work.docAssignments, [docAssignModalKey]: docAssignMemberIds };
          docAssignMut.mutate(
            { workId: work.id, assignments: updated },
            { onSuccess: () => setDocAssignModalKey(null) },
          );
        }}
        okText={lang === 'uz' ? 'Saqlash' : 'Сохранить'}
        cancelText={t('scienceCouncil.cancel')}
        okButtonProps={{ style: { background: '#16a34a', borderColor: '#16a34a' }, loading: docAssignMut.isPending }}
        title={
          <span style={{ color: '#16a34a', fontWeight: 700 }}>
            <TeamOutlined style={{ marginRight: 8 }} />
            {lang === 'uz' ? "A'zo biriktirish" : 'Назначить членов'}
          </span>
        }
        width={520}
      >
        {docAssignModalKey && (() => {
          const cat = DOCUMENT_CATEGORIES.find((c) => c.key === docAssignModalKey);
          return (
            <div style={{ marginTop: 8 }}>
              <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#15803d', border: '1px solid #bbf7d0' }}>
                <div style={{ fontWeight: 600 }}>
                  <FileTextOutlined style={{ marginRight: 6 }} />
                  {lang === 'ru' ? cat?.labelRu : cat?.labelUz}
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                {lang === 'uz'
                  ? "Ushbu hujjatni ko'rib chiqadigan kengash a'zolarini tanlang:"
                  : 'Выберите членов совета для рассмотрения этого документа:'}
              </div>
              <Select
                mode="multiple"
                allowClear
                style={{ width: '100%' }}
                placeholder={lang === 'uz' ? "A'zolarni tanlang..." : 'Выберите членов...'}
                value={docAssignMemberIds}
                onChange={(val: string[]) => setDocAssignMemberIds(val)}
                optionFilterProp="label"
                options={work.councilMembers.map((cm) => {
                  const detail = allMembers.find((m) => m.userId === cm.id);
                  const subtitle = detail ? `${detail.position} — ${detail.degree}` : '';
                  return {
                    value: cm.id,
                    label: `${cm.name}${subtitle ? ` (${subtitle})` : ''}`,
                  };
                })}
              />
              {docAssignMemberIds.length > 0 && (
                <div style={{ marginTop: 10, padding: '6px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, fontSize: 12, color: '#15803d' }}>
                  {lang === 'uz' ? 'Tanlandi:' : 'Выбрано:'} <strong>{docAssignMemberIds.length}</strong> {lang === 'uz' ? "a'zo" : 'членов'}
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      <Modal
        title={
          <span style={{ color: '#7c3aed', fontWeight: 700 }}>
            <FileDoneOutlined style={{ marginRight: 8 }} />
            {t('scienceCouncil.protocol.previewTitle')}
          </span>
        }
        open={dalolatnomaModal}
        onCancel={() => !eImzoLoading && setDalolatnomaModal(false)}
        width={660}
        footer={null}
        closable={!eImzoLoading}
      >
        <DalolatnomaDraft
          work={work}
          intro={intro}
          onIntroChange={setIntro}
          finalConclusion={conclusion}
          onFinalConclusionChange={setConclusion}
        />

        <ESignBox>
          <div className="es-title">
            {t('scienceCouncil.protocol.eSignConfirm')}
          </div>
          <div className="es-desc">
            {t('scienceCouncil.protocol.eSignDesc')}
          </div>
          <Button
            type="primary"
            icon={eImzoLoading ? <Spin size="small" /> : <ThunderboltOutlined />}
            loading={eImzoLoading}
            disabled={!conclusion.trim()}
            onClick={handleEImzo}
            style={{ background: '#7c3aed', borderColor: '#7c3aed', borderRadius: 8, width: '100%', height: 40, fontWeight: 600 }}
          >
            {eImzoLoading
              ? t('scienceCouncil.protocol.signing')
              : t('scienceCouncil.protocol.eSignConfirm')}
          </Button>
        </ESignBox>
      </Modal>

      <Modal
        open={uploadModalOpen}
        onCancel={() => { setUploadModalOpen(false); setSelectedFile(null); setActiveDocKey(null); }}
        onOk={() => {
          if (!activeDocKey || !selectedFile) return;
          uploadMut.mutate(
            { workId: work.id, docKey: activeDocKey, fileName: selectedFile.name },
            { onSuccess: () => { setUploadModalOpen(false); setSelectedFile(null); setActiveDocKey(null); } },
          );
        }}
        okText={lang === 'uz' ? 'Yuklash' : 'Загрузить'}
        cancelText={t('scienceCouncil.cancel')}
        okButtonProps={{
          disabled: !selectedFile,
          loading: uploadMut.isPending,
          style: { background: '#16a34a', borderColor: '#16a34a' },
        }}
        title={
          <span style={{ color: '#16a34a', fontWeight: 700 }}>
            <UploadOutlined style={{ marginRight: 8 }} />
            {lang === 'uz' ? 'Hujjat yuklash' : 'Загрузка документа'}
          </span>
        }
        width={480}
      >
        {activeDocKey && (() => {
          const cat = DOCUMENT_CATEGORIES.find((c) => c.key === activeDocKey);
          return (
            <div style={{ marginTop: 8 }}>
              <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#15803d', border: '1px solid #bbf7d0' }}>
                <div style={{ fontWeight: 600 }}>
                  <FileTextOutlined style={{ marginRight: 6 }} />
                  {lang === 'ru' ? cat?.labelRu : cat?.labelUz}
                </div>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setSelectedFile(file);
                }}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed #d1d5db',
                  borderRadius: 10,
                  padding: '28px 16px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: selectedFile ? '#f0fdf4' : '#fafafa',
                  transition: 'all 0.2s',
                }}
              >
                {selectedFile ? (
                  <div>
                    <CheckCircleOutlined style={{ fontSize: 28, color: '#16a34a', marginBottom: 8 }} />
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#15803d' }}>{selectedFile.name}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </div>
                    <div style={{ fontSize: 12, color: '#0891b2', marginTop: 8 }}>
                      {lang === 'uz' ? 'Boshqa fayl tanlash' : 'Выбрать другой файл'}
                    </div>
                  </div>
                ) : (
                  <div>
                    <UploadOutlined style={{ fontSize: 28, color: '#9ca3af', marginBottom: 8 }} />
                    <div style={{ fontSize: 13, color: '#6b7280' }}>
                      {lang === 'uz' ? 'Fayl tanlash uchun bosing' : 'Нажмите для выбора файла'}
                    </div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                      PDF, DOC, DOCX, XLS, XLSX, JPG, PNG
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>
    </PageContainer>
  );
}
