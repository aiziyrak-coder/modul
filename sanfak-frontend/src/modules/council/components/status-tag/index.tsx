import { Tag } from 'antd';
import type { TaskStatus, RankStatus, VotingStatus } from '../../model/types';
import { taskStatusMeta, rankStatusMeta, votingStatusMeta } from '../../model/status';

type Kind = 'task' | 'rank' | 'voting';

export function StatusTag({ status, kind }: { status: string; kind: Kind }) {
  const meta =
    kind === 'task'
      ? taskStatusMeta(status as TaskStatus)
      : kind === 'rank'
        ? rankStatusMeta(status as RankStatus)
        : votingStatusMeta(status as VotingStatus);
  return (
    <Tag color={meta.color} style={{ borderRadius: 6, fontWeight: 500, margin: 0 }}>
      {meta.label}
    </Tag>
  );
}
