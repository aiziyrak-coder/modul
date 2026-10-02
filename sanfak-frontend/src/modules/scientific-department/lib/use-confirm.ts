import { App } from 'antd';
import { useTranslation } from '@/shared/lib/i18n';

export function useConfirm() {
  const { modal } = App.useApp();
  const { t } = useTranslation();

  const confirmDelete = (
    onOk: () => void | Promise<void>,
    opts?: { title?: string; content?: string },
  ) =>
    modal.confirm({
      title: t(opts?.title ?? 'confirm_delete'),
      content: t(opts?.content ?? 'confirm_delete_subtitle'),
      okText: t('delete'),
      cancelText: t('cancel'),
      okButtonProps: { danger: true },
      centered: true,
      onOk,
    });

  return { confirmDelete };
}
