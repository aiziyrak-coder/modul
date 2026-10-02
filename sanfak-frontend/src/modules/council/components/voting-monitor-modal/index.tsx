import { useMemo } from 'react';
import { DownloadOutlined } from '@ant-design/icons';
import { App, Button, Flex, Modal, Progress, Spin, Tag, Typography, theme } from 'antd';
import dayjs from 'dayjs';
import { getApiErrorMessage } from '@/shared/api';
import { exportCsv } from '../../lib/export-csv';
import { StatusTag } from '../status-tag';
import {
  useMembers,
  useSessionParticipation,
  useSessionVotes,
  useVotingFinalize,
} from '../../api/council-api';
import type { VotingSession } from '../../model/types';

interface Props {
  open: boolean;
  session: VotingSession | null;
  onClose: () => void;
}

interface SessionVote {
  choice: 'for' | 'against' | 'abstain' | null;
  candidate: string | null;
}

const toSessionVote = (raw: unknown): SessionVote => {
  const o = (raw ?? {}) as Record<string, unknown>;
  const choice =
    o.choice === 'for' || o.choice === 'against' || o.choice === 'abstain' ? o.choice : null;
  return { choice, candidate: typeof o.candidate === 'string' ? o.candidate : null };
};

interface CandidateStat {
  id: string;
  fullName: string;
  diplomaFile: string | null;
  diplomaDate: string | null;
  forCount: number;
  againstCount: number;
  notVoted: number;
  isWinner: boolean;
}

const isUrl = (s: string): boolean => /^https?:\/\//i.test(s);

export function VotingMonitorModal({ open, session, onClose }: Props) {
  const { message, modal } = App.useApp();
  const { token } = theme.useToken();

  const votesQuery = useSessionVotes(session?.id, open);
  const participationQuery = useSessionParticipation(session?.id, open);
  const membersQuery = useMembers({}, open);
  const finalize = useVotingFinalize();

  const votes = useMemo(() => (votesQuery.data ?? []).map(toSessionVote), [votesQuery.data]);

  const eligible = useMemo(
    () => (membersQuery.data ?? []).filter((m) => m.canVote && m.active).length,
    [membersQuery.data],
  );

  const stats: CandidateStat[] = useMemo(() => {
    if (!session) return [];
    const finished = session.status !== 'active';
    const isChoice = session.mode === 'choice';
    const totalVotes = votes.length;
    const missing = finished
      ? (session.results?.abstain ?? Math.max(eligible - totalVotes, 0))
      : Math.max(eligible - totalVotes, 0);

    const base = session.candidates.map((c) => {
      let forCount: number;
      let againstCount: number;
      if (isChoice) {
        forCount = votes.filter((v) => v.candidate === c.user.id).length;
        againstCount = totalVotes - forCount;
      } else if (finished && session.results) {
        forCount = session.results.for ?? 0;
        againstCount = session.results.against ?? 0;
      } else {
        forCount = votes.filter((v) => v.choice === 'for').length;
        againstCount = votes.filter((v) => v.choice === 'against').length;
      }
      return { c, forCount, againstCount };
    });

    let winnerId: string | null = null;
    if (finished) {
      winnerId =
        session.results?.winner?.id ??
        (!isChoice && session.results?.passed ? (session.candidates[0]?.user.id ?? null) : null);
    } else {
      const max = Math.max(0, ...base.map((b) => b.forCount));
      if (max > 0) winnerId = base.find((b) => b.forCount === max)?.c.user.id ?? null;
    }

    return base.map(({ c, forCount, againstCount }) => ({
      id: c.user.id,
      fullName: c.user.fullName || '—',
      diplomaFile: c.diplomaFile ?? null,
      diplomaDate: c.diplomaDate ?? null,
      forCount,
      againstCount,
      notVoted: missing,
      isWinner: c.user.id === winnerId,
    }));
  }, [session, votes, eligible]);

  if (!session) return null;

  const loading = votesQuery.isLoading || membersQuery.isLoading;
  const totalVotes = votes.length;

  const handleCsv = () => {
    exportCsv(
      `sorovnoma-natijalari-${session.id}`,
      ['Nomzod', 'Rozi', 'Qarshi', 'Qatnashmagan', 'Natija'],
      stats.map((s) => [s.fullName, s.forCount, s.againstCount, s.notVoted, s.isWinner ? "G'olib" : '—']),
    );
  };

  const handleFinalize = () => {
    modal.confirm({
      title: "So'rovnomani yakunlash",
      content: `"${session.title}" yakunlansinmi? Yakunlangach ovoz berib bo'lmaydi.`,
      okText: 'Yakunlash',
      cancelText: 'Bekor qilish',
      centered: true,
      onOk: async () => {
        try {
          await finalize.mutateAsync(session.id);
          message.success('Yakunlandi');
          onClose();
        } catch (e) {
          message.error(getApiErrorMessage(e));
        }
      },
    });
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="So'rovnomani kuzatish"
      centered
      width={640}
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto', overflowX: 'hidden' } }}
      footer={
        <Flex justify="space-between" align="center" gap={8} wrap>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleCsv}
            disabled={loading || stats.length === 0}
          >
            CSV yuklab olish
          </Button>
          <Flex gap={8}>
            <Button onClick={onClose}>Yopish</Button>
            {session.status === 'active' ? (
              <Button type="primary" loading={finalize.isPending} onClick={handleFinalize}>
                So'rovnomani yakunlash
              </Button>
            ) : null}
          </Flex>
        </Flex>
      }
    >
      <Flex vertical gap={4} style={{ marginBottom: 'var(--space-4)' }}>
        <Flex align="center" gap={8} wrap>
          <Typography.Text strong>{session.title}</Typography.Text>
          <StatusTag status={session.status} kind="voting" />
        </Flex>
        {session.department?.title || session.rankType ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {[session.department?.title, session.rankType].filter(Boolean).join(' · ')}
          </Typography.Text>
        ) : null}
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Ovoz berish huquqiga ega a'zolar: {eligible} · Ovoz berganlar: {totalVotes}
        </Typography.Text>
        {(participationQuery.data ?? []).some((p) => !p.voted) ? (
          <Flex align="center" gap={6} wrap style={{ marginTop: 4 }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Ovoz bermaganlar:
            </Typography.Text>
            {(participationQuery.data ?? [])
              .filter((p) => !p.voted)
              .map((p) => (
                <Tag key={p.user.id} style={{ margin: 0 }}>
                  {p.user.fullName || '—'}
                </Tag>
              ))}
          </Flex>
        ) : null}
      </Flex>

      {loading ? (
        <Flex justify="center" style={{ padding: 'var(--space-6)' }}>
          <Spin />
        </Flex>
      ) : (
        stats.map((s) => {
          const pct = eligible > 0 ? Math.round((s.forCount / eligible) * 100) : 0;
          return (
            <div
              key={s.id}
              style={{
                border: s.isWinner
                  ? '1px solid var(--brand-primary)'
                  : `1px solid ${token.colorBorderSecondary}`,
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3)',
                marginBottom: 'var(--space-3)',
              }}
            >
              <Flex justify="space-between" align="center" gap={8}>
                <Typography.Text strong>{s.fullName}</Typography.Text>
                {s.isWinner ? <Tag color="green">G'olib</Tag> : null}
              </Flex>
              <Typography.Text
                type="secondary"
                style={{ fontSize: 12, display: 'block', marginTop: 4 }}
              >
                Rozilar: {s.forCount} · Qarshilar: {s.againstCount} · Qatnashmaganlar: {s.notVoted}
              </Typography.Text>
              <Progress percent={pct} size="small" strokeColor="var(--brand-primary)" />
              {s.diplomaFile || s.diplomaDate ? (
                <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                  Diplom:{' '}
                  {s.diplomaFile ? (
                    isUrl(s.diplomaFile) ? (
                      <a href={s.diplomaFile} target="_blank" rel="noreferrer">
                        {s.diplomaFile}
                      </a>
                    ) : (
                      s.diplomaFile
                    )
                  ) : (
                    '—'
                  )}
                  {s.diplomaDate ? ` · ${dayjs(s.diplomaDate).format('DD.MM.YYYY')}` : null}
                </Typography.Text>
              ) : null}
            </div>
          );
        })
      )}
    </Modal>
  );
}
