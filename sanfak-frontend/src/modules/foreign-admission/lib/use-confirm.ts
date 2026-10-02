import { App } from 'antd';
import { useTranslation } from '@/shared/lib/i18n';

export function useConfirm() {
  const { modal } = App.useApp();
  const { t } = useTranslation();

  const confirmDelete = (
    onOk: () => void | Promise<void>,
    opts: { title: string; content: string },
  ) =>
    modal.confirm({
      title: opts.title,
      content: opts.content,
      okText: t('foreignAdmission.crud.delete'),
      cancelText: t('foreignAdmission.cancel'),
      okButtonProps: { danger: true },
      centered: true,
      onOk,
    });

  const confirm = (
    onOk: () => void | Promise<void>,
    opts: { title: string; content: string; okText: string; danger?: boolean },
  ) =>
    modal.confirm({
      title: opts.title,
      content: opts.content,
      okText: opts.okText,
      cancelText: t('foreignAdmission.cancel'),
      okButtonProps: opts.danger ? { danger: true } : undefined,
      centered: true,
      onOk,
    });

  return { confirmDelete, confirm };
}
