import { DownloadOutlined, UserOutlined } from '@ant-design/icons';
import { Avatar, Divider, Drawer, Flex, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import type { VotingCandidate, VotingSession } from '../../model/types';

const { Text, Title } = Typography;

export interface CandidateDrawerProps {
  open: boolean;
  candidate: VotingCandidate | null;
  session: VotingSession | null;
  onClose: () => void;
}

const isUrl = (s: string): boolean => /^https?:\/\//i.test(s);
const fmt = (d?: string | null) => (d ? dayjs(d).format('DD.MM.YYYY') : '—');

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Flex justify="space-between" align="center" gap={12}>
      <Text type="secondary">{label}</Text>
      <span style={{ textAlign: 'right', color: 'var(--color-text)' }}>{children}</span>
    </Flex>
  );
}

export function CandidateDrawer({ open, candidate, session, onClose }: CandidateDrawerProps) {
  if (!candidate || !session) return null;

  return (
    <Drawer open={open} onClose={onClose} width={420} title="Nomzod ma'lumotlari" destroyOnHidden>
      <Flex vertical align="center" gap={8} style={{ marginBottom: 16 }}>
        <Avatar size={64} icon={<UserOutlined />} />
        <Title level={5} style={{ margin: 0, textAlign: 'center' }}>
          {candidate.user.fullName || '—'}
        </Title>
        {session.rankType ? <Tag color="green">{session.rankType}</Tag> : null}
      </Flex>

      <Divider style={{ margin: '12px 0' }} />

      <Flex vertical gap={10}>
        <InfoRow label="Unvon turi">{session.rankType ?? '—'}</InfoRow>
        <InfoRow label="Kafedra">{session.department?.title ?? '—'}</InfoRow>
        <InfoRow label="Diplom fayli">
          {candidate.diplomaFile ? (
            isUrl(candidate.diplomaFile) ? (
              <Typography.Link href={candidate.diplomaFile} target="_blank" rel="noreferrer">
                <DownloadOutlined /> Yuklab olish
              </Typography.Link>
            ) : (
              candidate.diplomaFile
            )
          ) : (
            <Text type="secondary">Fayl yo'q</Text>
          )}
        </InfoRow>
        <InfoRow label="Diplom sanasi">{fmt(candidate.diplomaDate)}</InfoRow>
      </Flex>

      <Divider style={{ margin: '12px 0' }} />

      <Flex vertical gap={10}>
        <InfoRow label="So'rovnoma">{session.title}</InfoRow>
        <InfoRow label="Muddat">
          {fmt(session.startDate)} — {fmt(session.endDate)}
        </InfoRow>
        <InfoRow label="O'tish foizi">{session.passingPercent}%</InfoRow>
      </Flex>
    </Drawer>
  );
}
