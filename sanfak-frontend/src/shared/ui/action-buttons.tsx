import styled from 'styled-components';
import { Tooltip } from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  StopOutlined,
  CheckOutlined,
  SendOutlined,
  RollbackOutlined,
  DownloadOutlined,
  PrinterOutlined,
} from '@ant-design/icons';

const Wrap = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
`;

const Btn = styled.button<{ $variant?: 'edit' | 'delete' | 'view' | 'block' | 'unblock' }>`
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease-in-out;
  padding: 0;
  outline: none;
  box-sizing: border-box;

  .anticon {
    font-size: 13px;
  }

  ${({ $variant = 'edit' }) => {
    if ($variant === 'delete')
      return `
        background: #fef3f2;
        color: #f04438;
        &:hover { background: #fee2e0; }
      `;
    if ($variant === 'view')
      return `
        background: #eef2f6;
        color: #9ca3af;
        &:hover { color: var(--brand-primary); }
      `;
    if ($variant === 'block')
      return `
        background: #eef2f6;
        color: #697586;
        &:hover { background: #ffe4e4; color: #f04438; }
      `;
    if ($variant === 'unblock')
      return `
        background: #ecfdf3;
        color: var(--brand-primary);
        &:hover { background: #d1fae5; }
      `;
    return `
      background: #eef2f6;
      color: #121926;
      &:hover { color: var(--brand-primary); }
    `;
  }}
`;

export interface ActionButtonsProps {
  onView?: () => void;
  onEdit?: () => void;
  onToggleActive?: () => void;
  onDelete?: () => void;
  onSend?: () => void;
  onAccept?: () => void;
  onConfirm?: () => void;
  onReturn?: () => void;
  onDownload?: () => void;
  onPrint?: () => void;
  isActive?: boolean;
  hideEdit?: boolean;
  hideDelete?: boolean;
  hideToggle?: boolean;
  viewLabel?: string;
  editLabel?: string;
  sendLabel?: string;
  acceptLabel?: string;
  confirmLabel?: string;
  returnLabel?: string;
  downloadLabel?: string;
  printLabel?: string;
}

export function ActionButtons({
  onView,
  onEdit,
  onToggleActive,
  onDelete,
  onSend,
  onAccept,
  onConfirm,
  onReturn,
  onDownload,
  onPrint,
  isActive = true,
  hideEdit,
  hideDelete,
  hideToggle,
  viewLabel = "Ko'rish",
  editLabel = 'Tahrirlash',
  sendLabel = 'Yuborish',
  acceptLabel = 'Qabul qilish',
  confirmLabel = 'Tasdiqlash',
  returnLabel = 'Qaytarish',
  downloadLabel = 'Yuklab olish',
  printLabel = 'Chop etish',
}: ActionButtonsProps) {
  return (
    <Wrap>
      {onView && (
        <Tooltip title={viewLabel}>
          <Btn $variant="view" type="button" onClick={onView}>
            <EyeOutlined />
          </Btn>
        </Tooltip>
      )}
      {!hideEdit && onEdit && (
        <Tooltip title={editLabel}>
          <Btn $variant="edit" type="button" onClick={onEdit}>
            <EditOutlined />
          </Btn>
        </Tooltip>
      )}
      {onSend && (
        <Tooltip title={sendLabel}>
          <Btn $variant="edit" type="button" onClick={onSend}>
            <SendOutlined />
          </Btn>
        </Tooltip>
      )}
      {onAccept && (
        <Tooltip title={acceptLabel}>
          <Btn $variant="unblock" type="button" onClick={onAccept}>
            <CheckOutlined />
          </Btn>
        </Tooltip>
      )}
      {onConfirm && (
        <Tooltip title={confirmLabel}>
          <Btn $variant="unblock" type="button" onClick={onConfirm}>
            <CheckOutlined />
          </Btn>
        </Tooltip>
      )}
      {onReturn && (
        <Tooltip title={returnLabel}>
          <Btn $variant="block" type="button" onClick={onReturn}>
            <RollbackOutlined />
          </Btn>
        </Tooltip>
      )}
      {onDownload && (
        <Tooltip title={downloadLabel}>
          <Btn $variant="edit" type="button" onClick={onDownload}>
            <DownloadOutlined />
          </Btn>
        </Tooltip>
      )}
      {onPrint && (
        <Tooltip title={printLabel}>
          <Btn $variant="edit" type="button" onClick={onPrint}>
            <PrinterOutlined />
          </Btn>
        </Tooltip>
      )}
      {!hideToggle && onToggleActive && (
        <Tooltip title={isActive ? 'Bloklash' : 'Faollashtirish'}>
          <Btn $variant={isActive ? 'block' : 'unblock'} type="button" onClick={onToggleActive}>
            {isActive ? <StopOutlined /> : <CheckOutlined />}
          </Btn>
        </Tooltip>
      )}
      {!hideDelete && onDelete && (
        <Tooltip title="O'chirish">
          <Btn $variant="delete" type="button" onClick={onDelete}>
            <DeleteOutlined />
          </Btn>
        </Tooltip>
      )}
    </Wrap>
  );
}
