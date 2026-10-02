import type { ReactNode } from 'react';
import dayjs from 'dayjs';
import { DownloadOutlined } from '@ant-design/icons';
import { Alert, Button, Drawer, Flex, Typography } from 'antd';
import type { CouncilTask } from '../../model/types';
import { StatusTag } from '../status-tag';

const { Text, Title } = Typography;

interface Props {
  open: boolean;
  task: CouncilTask | null;
  isKotib: boolean;
  onClose: () => void;
  onApprove?: (task: CouncilTask) => void;
  onReject?: (task: CouncilTask) => void;
}

const fileName = (url: string): string => {
  const last = url.split('/').pop() ?? url;
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Text type="secondary" style={{ display: 'block', fontSize: 12.5, marginBottom: 4 }}>
        {label}
      </Text>
      <div style={{ color: 'var(--color-text)', fontSize: 14 }}>{children}</div>
    </div>
  );
}

export function TaskDetailDrawer({ open, task, isKotib, onClose, onApprove, onReject }: Props) {
  const showFooter = isKotib && task !== null && task.status === 'done';

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={480}
      title="Topshiriq tafsilotlari"
      destroyOnHidden
      footer={
        showFooter && task ? (
          <Flex justify="flex-end" gap={12}>
            {onReject && (
              <Button danger onClick={() => onReject(task)}>
                Rad etish
              </Button>
            )}
            {onApprove && (
              <Button type="primary" onClick={() => onApprove(task)}>
                Tasdiqlash
              </Button>
            )}
          </Flex>
        ) : undefined
      }
    >
      {task && (
        <Flex vertical gap="middle">
          <Flex align="center" justify="space-between" gap={8} wrap>
            <Title level={5} style={{ margin: 0 }}>
              {task.title}
            </Title>
            <StatusTag status={task.status} kind="task" />
          </Flex>

          <Field label="A'zo">{task.assignee.fullName || '—'}</Field>
          <Field label="Muddat">
            {task.deadline ? dayjs(task.deadline).format('DD.MM.YYYY') : '—'}
          </Field>
          <Field label="Izoh">{task.desc || '—'}</Field>

          <Field label="Natija fayllari">
            {task.resultFiles.length > 0 ? (
              <Flex vertical gap={8}>
                {task.resultFiles.map((f, i) => (
                  <a key={`${f}-${i}`} href={f} target="_blank" rel="noreferrer">
                    <DownloadOutlined style={{ marginRight: 6 }} />
                    {fileName(f)}
                  </a>
                ))}
              </Flex>
            ) : (
              <Text type="secondary">Natija hali yuklanmagan</Text>
            )}
          </Field>

          {task.status === 'rejected' && task.rejectReason && (
            <Alert
              type="error"
              showIcon
              message="Rad etish sababi"
              description={task.rejectReason}
            />
          )}
        </Flex>
      )}
    </Drawer>
  );
}
