import { useEffect, useState } from 'react';
import { App, Modal, Radio, Space, Typography } from 'antd';
import dayjs from 'dayjs';
import { getApiErrorMessage } from '@/shared/api';
import { useCastVote } from '../../api/council-api';
import { CandidateDrawer } from '../candidate-drawer';
import type { VotingCandidate, VotingSession } from '../../model/types';

interface Props {
  open: boolean;
  session: VotingSession | null;
  onClose: () => void;
}

const isUrl = (s: string): boolean => /^https?:\/\//i.test(s);

function DiplomaInfo({ candidate }: { candidate: VotingCandidate }) {
  if (!candidate.diplomaFile && !candidate.diplomaDate) return null;
  return (
    <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
      Diplom:{' '}
      {candidate.diplomaFile ? (
        isUrl(candidate.diplomaFile) ? (
          <a href={candidate.diplomaFile} target="_blank" rel="noreferrer">
            {candidate.diplomaFile}
          </a>
        ) : (
          candidate.diplomaFile
        )
      ) : (
        '—'
      )}
      {candidate.diplomaDate ? ` · ${dayjs(candidate.diplomaDate).format('DD.MM.YYYY')}` : null}
    </Typography.Text>
  );
}

export function VoteModal({ open, session, onClose }: Props) {
  const { message } = App.useApp();
  const cast = useCastVote();

  const [single, setSingle] = useState<'for' | 'against'>();
  const [candidate, setCandidate] = useState<string>();
  const [details, setDetails] = useState<VotingCandidate | null>(null);

  useEffect(() => {
    if (open) {
      setSingle(undefined);
      setCandidate(undefined);
      setDetails(null);
    }
  }, [open, session?.id]);

  if (!session) return null;
  const isChoice = session.mode === 'choice';
  const canSubmit = isChoice ? !!candidate : !!single;
  const singleCandidate = !isChoice ? (session.candidates[0] ?? null) : null;

  const submit = async () => {
    if (!canSubmit) return;
    try {
      if (isChoice) {
        await cast.mutateAsync({ session: session.id, choice: 'for', candidate });
      } else {
        await cast.mutateAsync({ session: session.id, choice: single as 'for' | 'against' });
      }
      message.success('Ovozingiz qabul qilindi');
      onClose();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="Ovoz berish"
      cancelText="Bekor qilish"
      title="Ovoz berish"
      centered
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto', overflowX: 'hidden' } }}
      confirmLoading={cast.isPending}
      okButtonProps={{ disabled: !canSubmit }}
      destroyOnHidden
    >
      <Typography.Paragraph style={{ marginBottom: 'var(--space-4)' }}>
        <Typography.Text strong>{session.title}</Typography.Text>
        {session.department?.title ? (
          <Typography.Text type="secondary"> · {session.department.title}</Typography.Text>
        ) : null}
      </Typography.Paragraph>

      {singleCandidate ? (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Typography.Text>
            Nomzod:{' '}
            <Typography.Link onClick={() => setDetails(singleCandidate)}>
              {singleCandidate.user.fullName || '—'}
            </Typography.Link>
          </Typography.Text>
          <DiplomaInfo candidate={singleCandidate} />
        </div>
      ) : null}

      {isChoice ? (
        <Radio.Group
          value={candidate}
          onChange={(e) => setCandidate(e.target.value)}
          style={{ width: '100%' }}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            {session.candidates.map((c) => (
              <Radio key={c.user.id} value={c.user.id}>
                <div>
                  <Typography.Link
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDetails(c);
                    }}
                  >
                    {c.user.fullName || '—'}
                  </Typography.Link>
                  <DiplomaInfo candidate={c} />
                </div>
              </Radio>
            ))}
          </Space>
        </Radio.Group>
      ) : (
        <Radio.Group
          value={single}
          onChange={(e) => setSingle(e.target.value)}
          optionType="button"
          buttonStyle="solid"
        >
          <Radio.Button value="for">Ha (Roziman)</Radio.Button>
          <Radio.Button value="against">Yo'q (Qarshiman)</Radio.Button>
        </Radio.Group>
      )}

      <CandidateDrawer
        open={!!details}
        candidate={details}
        session={session}
        onClose={() => setDetails(null)}
      />
    </Modal>
  );
}
