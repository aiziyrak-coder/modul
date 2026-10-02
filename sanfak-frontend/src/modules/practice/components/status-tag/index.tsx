import { Tag } from 'antd';
import type { ContractStatus, PracticeRole } from '../../model/types';
import { STATUS_META, statusLabelForRole } from '../../model/status';

export function StatusTag({ status, role }: { status: ContractStatus; role?: PracticeRole }) {
  const meta = STATUS_META[status];
  const label = role ? statusLabelForRole(status, role) : meta.label;
  return (
    <Tag color={meta.color} style={{ borderRadius: 6, fontWeight: 500, margin: 0 }}>
      {label}
    </Tag>
  );
}
