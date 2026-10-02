import type { ReactNode } from 'react';
import { Button } from 'antd';
import { useTranslation } from '@/shared/lib/i18n';
import { useModalStore } from './modal-store';
import { FooterActions } from './styles';

export type ModalActionVariant = 'secondary' | 'primary' | 'danger';

export interface ModalAction {
  label: string;
  onClick?: () => void;
  variant?: ModalActionVariant;
  submit?: boolean;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
}

export type ModalFooterSpacing = 'dialog' | 'form' | 'none';

export interface ModalActionsProps {
  actions: ModalAction[];
  spacing?: ModalFooterSpacing;
}

export function ModalActions({ actions, spacing = 'form' }: ModalActionsProps) {
  return (
    <FooterActions $spacing={spacing} $count={Math.max(actions.length, 1)}>
      {actions.map((a, i) => (
        <Button
          key={`${a.label}-${i}`}
          block
          type={a.variant === 'secondary' || !a.variant ? 'link' : 'primary'}
          danger={a.variant === 'danger'}
          loading={a.loading}
          disabled={a.disabled}
          icon={a.icon}
          htmlType={a.submit ? 'submit' : 'button'}
          onClick={a.onClick}
        >
          {a.label}
        </Button>
      ))}
    </FooterActions>
  );
}

export interface ModalFooterProps {
  cancelLabel?: string;
  confirmLabel?: string;
  onCancel?: () => void;
  onConfirm?: () => void;
  submit?: boolean;
  danger?: boolean;
  loading?: boolean;
  confirmDisabled?: boolean;
  confirmIcon?: ReactNode;
  spacing?: ModalFooterSpacing;
}

export function ModalFooter({
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
  submit = false,
  danger = false,
  loading = false,
  confirmDisabled = false,
  confirmIcon,
  spacing = 'form',
}: ModalFooterProps) {
  const { t } = useTranslation();
  const hideModal = useModalStore((s) => s.hideModal);

  return (
    <ModalActions
      spacing={spacing}
      actions={[
        {
          label: cancelLabel ?? t('cancel'),
          onClick: onCancel ?? hideModal,
          disabled: loading,
        },
        {
          label: confirmLabel ?? t('save'),
          variant: danger ? 'danger' : 'primary',
          onClick: onConfirm,
          submit,
          loading,
          disabled: confirmDisabled,
          icon: confirmIcon,
        },
      ]}
    />
  );
}
