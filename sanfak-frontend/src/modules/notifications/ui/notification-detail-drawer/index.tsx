import { useState } from 'react';
import { CopyOutlined, CheckOutlined } from '@ant-design/icons';
import { Tag, Typography } from 'antd';
import { Button, Drawer } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { usePermission } from '@/app/session';
import dayjs from 'dayjs';
import { resolveLinkPermission } from '../../lib/resolve-link-permission';
import { readableFallback } from '../../lib/readable-fallback';
import { resolveEvent } from '../../model/resolve-event';
import type { NotificationVM } from '../../model/types';
import MetadataList from '../metadata-list';
import NotificationBody from '../notification-body';
import { DetailActions, DetailHeader, DetailSection, DetailTime, DetailTitle } from './style';

export interface NotificationDetailDrawerProps {
  notification: NotificationVM | null;
  onClose: () => void;
}

function buildCopyText(notification: NotificationVM): string {
  const parts = [notification.title];
  if (notification.body) parts.push(notification.body);
  if (notification.metadata && Object.keys(notification.metadata).length > 0) {
    parts.push(JSON.stringify(notification.metadata, null, 2));
  }
  parts.push(dayjs(notification.createdAt).format('DD.MM.YYYY HH:mm:ss'));
  return parts.join('\n\n');
}

export default function NotificationDetailDrawer({
  notification,
  onClose,
}: NotificationDetailDrawerProps) {
  const { t } = useTranslation();
  const can = usePermission();
  const [copied, setCopied] = useState(false);

  const descriptor = notification ? resolveEvent(notification) : null;

  const displayBody =
    notification === null || notification.body === null
      ? null
      : descriptor?.bodySanitizer
        ? descriptor.bodySanitizer(notification.body)
        : notification.body;

  const rawCode = notification?.metadata?.code;
  const codeValue = typeof rawCode === 'string' && rawCode !== '' ? rawCode : null;

  const requiredPermission = notification?.safeLink
    ? resolveLinkPermission(notification.safeLink)
    : null;
  const permissionDenied = requiredPermission !== null && !can(requiredPermission);

  const clipboardAvailable = Boolean(navigator.clipboard);

  const handleCopy = () => {
    if (!notification || !clipboardAvailable) return;
    void navigator.clipboard.writeText(buildCopyText(notification)).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <Drawer
      open={notification !== null}
      onClose={onClose}
      destroyOnHidden
      width={480}
      title={t('notif.detail', { defaultValue: 'Batafsil' })}
    >
      {notification && descriptor ? (
        <div>
          <DetailHeader>
            {codeValue && descriptor.codeKind ? <Tag>{codeValue}</Tag> : null}
            <Tag>
              {t(descriptor.moduleLabelKey, {
                defaultValue: readableFallback(descriptor.moduleLabelKey),
              })}
            </Tag>
          </DetailHeader>

          <DetailTitle>
            <Typography.Text strong style={{ fontSize: 16 }}>
              {notification.title}
            </Typography.Text>
          </DetailTitle>

          {displayBody !== null ? <NotificationBody text={displayBody} /> : null}

          {descriptor.truncatedUpstream ? (
            <DetailSection>
              <Typography.Text type="warning" style={{ fontSize: 12 }}>
                {t('notif.truncated', {
                  defaultValue: "Matn qisqartirilgan — to'liqi manba sahifasida",
                })}
              </Typography.Text>
            </DetailSection>
          ) : null}
          {descriptor.missingReason ? (
            <DetailSection>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('notif.missingReason', { defaultValue: "Rad sababi tizimda ko'rsatilmagan" })}
              </Typography.Text>
            </DetailSection>
          ) : null}
          {notification.rawLink && !notification.safeLink ? (
            <DetailSection>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('notif.noLink', { defaultValue: 'Havola mavjud emas' })}
              </Typography.Text>{' '}
              <Typography.Text code style={{ fontSize: 12 }}>
                {notification.rawLink}
              </Typography.Text>
            </DetailSection>
          ) : null}
          {permissionDenied ? (
            <DetailSection>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('notif.noPermission', {
                  defaultValue: "Ushbu havolani ochish uchun ruxsatingiz yo'q",
                })}
              </Typography.Text>
            </DetailSection>
          ) : null}

          <DetailSection>
            <MetadataList metadata={notification.metadata} metaFields={descriptor.metaFields} />
          </DetailSection>

          <DetailTime>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {dayjs(notification.createdAt).format('DD.MM.YYYY HH:mm:ss')}
            </Typography.Text>
          </DetailTime>

          {clipboardAvailable ? (
            <DetailActions>
              <Button
                size="small"
                icon={copied ? <CheckOutlined /> : <CopyOutlined />}
                onClick={handleCopy}
              >
                {copied
                  ? t('notif.copied', { defaultValue: 'Nusxa olindi' })
                  : t('notif.copy', { defaultValue: 'Nusxa olish' })}
              </Button>
            </DetailActions>
          ) : null}
        </div>
      ) : null}
    </Drawer>
  );
}
