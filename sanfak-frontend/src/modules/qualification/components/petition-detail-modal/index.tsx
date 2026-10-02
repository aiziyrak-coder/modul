import { EyeOutlined, ExclamationCircleOutlined, FileTextOutlined } from '@ant-design/icons';
import { App, Button, Flex, Spin, Tag, Typography, useModalStore } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { useTranslation } from '@/shared/lib/i18n';
import { useAcceptPetition, usePetition, useRejectPetition } from '../../api/petition-api';
import { PETITION_STATUS } from '../../model/petition.types';
import { EDU_FORM } from '../../model/course.types';
import PetitionStatusTag from '../petition-status-tag';
import { ScrollBox } from '../scroll-box';

const { Text } = Typography;
const dash = (v?: string | null): string => (v && v.length > 0 ? v : '—');

function DetailRow({ label, value, node }: { label: string; value?: string; node?: React.ReactNode }) {
  return (
    <Flex
      justify="space-between"
      align="center"
      style={{ padding: '10px 0', borderBottom: '1px solid var(--color-border-soft, #eef2f6)' }}
    >
      <Text type="secondary" style={{ width: 140, flexShrink: 0 }}>
        {label}
      </Text>
      {node ?? <Text strong>{value}</Text>}
    </Flex>
  );
}

function DocRow({ label, url }: { label: string; url: string }) {
  const fileName = ((url.split('/').pop() ?? url).split('?')[0] ?? url).replace(/^\d+-/, '');
  return (
    <Flex
      align="center"
      justify="space-between"
      style={{
        padding: '8px 12px',
        background: 'var(--color-bg-soft, #f8fafc)',
        border: '1px solid var(--color-border-soft, #eef2f6)',
        borderRadius: 8,
      }}
    >
      <Flex align="center" gap={8} style={{ minWidth: 0 }}>
        <FileTextOutlined style={{ color: 'var(--brand-primary)', flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <Text strong style={{ display: 'block', lineHeight: 1.2 }}>
            {label}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
            {fileName}
          </Text>
        </div>
      </Flex>
      <Button
        type="text"
        icon={<EyeOutlined />}
        onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
      />
    </Flex>
  );
}

export default function PetitionDetailModal({ id }: { id: string }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const hideModal = useModalStore((s) => s.hideModal);
  const { data, isLoading } = usePetition(id);
  const accept = useAcceptPetition();
  const reject = useRejectPetition();

  const onAccept = async () => {
    try {
      await accept.mutateAsync(id);
      message.success(t('qualification.enrollment.accepted'));
      hideModal();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const onReject = async () => {
    try {
      await reject.mutateAsync(id);
      message.success(t('qualification.enrollment.rejected'));
      hideModal();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  if (isLoading || !data) {
    return (
      <Flex justify="center" style={{ padding: '40px 0' }}>
        <Spin />
      </Flex>
    );
  }

  const formNode =
    data.form === EDU_FORM.ONLINE ? (
      <Tag color="blue">{t('qualification.courses.form.online')}</Tag>
    ) : data.form === EDU_FORM.OFFLINE ? (
      <Tag color="gold">{t('qualification.courses.form.offline')}</Tag>
    ) : (
      <Text>—</Text>
    );

  const eduTypeNode =
    data.educationType === 1 ? (
      <Tag color="blue">{t('qualification.students.edu.grant')}</Tag>
    ) : data.educationType === 2 ? (
      <Tag color="gold">{t('qualification.students.edu.contract')}</Tag>
    ) : (
      <Text>—</Text>
    );

  const docs = [
    { label: t('qualification.enrollment.doc.bachelor'), url: data.bachelorDiploma },
    { label: t('qualification.enrollment.doc.masters'), url: data.mastersDiploma },
    { label: t('qualification.enrollment.doc.certificate'), url: data.moCertificate },
  ].filter((d): d is { label: string; url: string } => !!d.url);

  return (
    <ScrollBox $maxHeight="72vh" style={{ paddingRight: 8 }}>
      {data.courseFull && data.status === PETITION_STATUS.PENDING ? (
        <Flex
          align="center"
          gap={8}
          style={{
            marginBottom: 14,
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            background: 'color-mix(in srgb, var(--brand-warning) 12%, #fff)',
            border: '1px solid color-mix(in srgb, var(--brand-warning) 30%, #fff)',
          }}
        >
          <ExclamationCircleOutlined style={{ color: '#a16207', flexShrink: 0 }} />
          <Text style={{ fontSize: 13, color: '#a16207' }}>
            {t('qualification.enrollment.courseFull')}
            {data.listenersLimit ? ` (${data.totalSubscribers}/${data.listenersLimit})` : ''}
          </Text>
        </Flex>
      ) : null}
      <DetailRow label={t('qualification.enrollment.col.name')} value={dash(data.fullName)} />
      <DetailRow label={t('qualification.enrollment.col.passport')} value={dash(data.passport)} />
      <DetailRow label={t('qualification.enrollment.col.course')} value={dash(data.courseTitle)} />
      <DetailRow label={t('qualification.enrollment.col.form')} node={formNode} />
      <DetailRow label={t('qualification.enrollment.field.eduType')} node={eduTypeNode} />
      <DetailRow
        label={t('qualification.enrollment.col.status')}
        node={<PetitionStatusTag status={data.status} />}
      />
      <DetailRow label={t('qualification.enrollment.field.province')} value={dash(data.provinceTitle)} />
      <DetailRow label={t('qualification.enrollment.field.region')} value={dash(data.regionTitle)} />
      <DetailRow label={t('qualification.enrollment.field.institution')} value={dash(data.institution)} />
      <DetailRow label={t('qualification.enrollment.field.phone')} value={dash(data.phone)} />

      {docs.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Text
            type="secondary"
            style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}
          >
            {t('qualification.enrollment.docs')}
          </Text>
          <Flex vertical gap={8} style={{ marginTop: 8 }}>
            {docs.map((d) => (
              <DocRow key={d.label} label={d.label} url={d.url} />
            ))}
          </Flex>
        </div>
      )}

      <Flex
        justify="flex-end"
        gap={12}
        style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}
      >
        {data.status !== PETITION_STATUS.REJECTED && (
          <Button danger onClick={onReject} loading={reject.isPending} style={{ height: 40, minWidth: 110 }}>
            {t('qualification.enrollment.reject')}
          </Button>
        )}
        {data.status === PETITION_STATUS.PENDING && (
          <Button
            type="primary"
            onClick={onAccept}
            loading={accept.isPending}
            disabled={data.courseFull}
            style={{ height: 40, minWidth: 120 }}
          >
            {t('qualification.enrollment.accept')}
          </Button>
        )}
      </Flex>
    </ScrollBox>
  );
}
