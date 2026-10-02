import type { KeyboardEvent, MouseEvent } from 'react';
import { Badge, theme } from 'antd';
import type { GlobalToken } from 'antd';
import dayjs from 'dayjs';
import { useTranslation } from '@/shared/lib/i18n';
import { Button, Tag, Tooltip, Typography } from '@/shared/ui';
import { fromNowLocalized } from '../../lib/dayjs-relative';
import { resolveEvent } from '../../model/resolve-event';
import type { NotificationVM, Tone } from '../../model/types';
import NotificationBody from '../notification-body';
import { readableFallback } from '../../lib/readable-fallback';
import { ActionsRow, ChipRow, Content, Hint, IconAvatar, Row, SideCol, TitleClamp } from './style';

export interface NotificationItemProps {
  notification: NotificationVM;
  variant: 'compact' | 'full';
  onOpen?: (notification: NotificationVM) => void;
  onMarkRead?: (notification: NotificationVM) => void;
  onOpenDetail?: (notification: NotificationVM) => void;
  className?: string;
}

function toneTokens(tone: Tone, token: GlobalToken): { color: string; bg: string } {
  switch (tone) {
    case 'success':
      return { color: token.colorSuccess, bg: token.colorSuccessBg };
    case 'warning':
      return { color: token.colorWarning, bg: token.colorWarningBg };
    case 'danger':
      return { color: token.colorError, bg: token.colorErrorBg };
    case 'info':
      return { color: token.colorInfo, bg: token.colorInfoBg };
    case 'neutral':
    default:
      return { color: token.colorTextSecondary, bg: token.colorFillSecondary };
  }
}

export default function NotificationItem({
  notification,
  variant,
  onOpen,
  onMarkRead,
  onOpenDetail,
  className,
}: NotificationItemProps) {
  const { t, lang } = useTranslation();
  const { token } = theme.useToken();

  const descriptor = resolveEvent(notification);
  const tone = toneTokens(descriptor.tone, token);
  const isPrimaryTitle = descriptor.emphasis !== 'body';

  const displayBody =
    notification.body === null
      ? null
      : descriptor.bodySanitizer
        ? descriptor.bodySanitizer(notification.body)
        : notification.body;

  const rawCode = notification.metadata?.code;
  const codeValue = typeof rawCode === 'string' && rawCode !== '' ? rawCode : null;

  const titleClamp = variant === 'compact' ? 2 : undefined;
  const bodyClamp = variant === 'compact' ? 2 : 3;

  const handleOpen = () => onOpen?.(notification);
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleOpen();
    }
  };
  const stop = (event: MouseEvent | KeyboardEvent) => event.stopPropagation();

  const unreadLabel = t('notif.unread', { defaultValue: "o'qilmagan" });
  const ariaLabel = notification.read ? notification.title : `${notification.title}, ${unreadLabel}`;

  return (
    <Row
      className={className}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      $unread={!notification.read}
      $unreadBg={token.colorSuccessBg}
      $hoverBg={token.colorFillTertiary}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
    >
      <IconAvatar
        $size={variant === 'compact' ? 40 : 42}
        $square={variant === 'full'}
        $color={tone.color}
        $bg={tone.bg}
      >
        {descriptor.icon}
      </IconAvatar>

      <Content>
        <ChipRow>
          {codeValue && descriptor.codeKind ? (
            <Tag
              style={{
                marginInlineEnd: 0,
                fontWeight: 700,
                fontFamily: descriptor.codeKind === 'docNumber' ? 'monospace' : undefined,
                color: tone.color,
                background: tone.bg,
                borderColor: 'transparent',
              }}
            >
              {codeValue}
            </Tag>
          ) : null}
          {variant === 'full' ? (
            <Tag style={{ marginInlineEnd: 0 }}>
              {t(descriptor.moduleLabelKey, { defaultValue: readableFallback(descriptor.moduleLabelKey) })}
            </Tag>
          ) : null}
        </ChipRow>

        <TitleClamp $clamp={titleClamp}>
          <Typography.Text strong={isPrimaryTitle} type={isPrimaryTitle ? undefined : 'secondary'}>
            {notification.title}
          </Typography.Text>
        </TitleClamp>

        {displayBody !== null ? (
          <NotificationBody
            text={displayBody}
            maxLines={bodyClamp}
            emphasis={isPrimaryTitle ? 'secondary' : 'primary'}
          />
        ) : null}

        {variant === 'full' && descriptor.truncatedUpstream ? (
          <Hint>
            <Typography.Text type="warning" style={{ fontSize: 12 }}>
              {t('notif.truncated', { defaultValue: "Matn qisqartirilgan — to'liqi manba sahifasida" })}
            </Typography.Text>
          </Hint>
        ) : null}
        {variant === 'full' && descriptor.missingReason ? (
          <Hint>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t('notif.missingReason', { defaultValue: "Rad sababi tizimda ko'rsatilmagan" })}
            </Typography.Text>
          </Hint>
        ) : null}

        {variant === 'full' && ((!notification.read && onMarkRead) || onOpenDetail) ? (
          <ActionsRow>
            {!notification.read && onMarkRead ? (
              <Button
                type="link"
                size="small"
                style={{ paddingInline: 0, height: 'auto' }}
                onClick={(event) => {
                  stop(event);
                  onMarkRead(notification);
                }}
                onKeyDown={stop}
              >
                {t('notif.markOne', { defaultValue: "O'qilgan deb belgilash" })}
              </Button>
            ) : null}
            {onOpenDetail ? (
              <Button
                type="link"
                size="small"
                style={{ paddingInline: 0, height: 'auto' }}
                onClick={(event) => {
                  stop(event);
                  onOpenDetail(notification);
                }}
                onKeyDown={stop}
              >
                {t('notif.detail', { defaultValue: 'Batafsil' })}
              </Button>
            ) : null}
          </ActionsRow>
        ) : null}
      </Content>

      <SideCol>
        {!notification.read ? (
          <span aria-label={unreadLabel}>
            <Badge status="success" />
          </span>
        ) : null}
        {variant === 'compact' ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {fromNowLocalized(notification.createdAt, lang)}
          </Typography.Text>
        ) : (
          <Tooltip title={dayjs(notification.createdAt).format('DD.MM.YYYY HH:mm:ss')}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {dayjs(notification.createdAt).format('DD.MM.YYYY HH:mm')}
            </Typography.Text>
          </Tooltip>
        )}
      </SideCol>
    </Row>
  );
}
