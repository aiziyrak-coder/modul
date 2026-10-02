import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import { Checkbox, Collapse, TimePicker, theme } from 'antd';
import dayjs from 'dayjs';
import { useTranslation } from '@/shared/lib/i18n';
import { getApiErrorMessage } from '@/shared/api';
import { Alert, App, Button, PageContainer, Select, Spin, Switch, Typography } from '@/shared/ui';
import { usePreferences, useUpdatePreferences } from '../../api/queries';
import { readableFallback } from '../../lib/readable-fallback';
import { COUNCIL_VARIANT_SUFFIX, EVENT_REGISTRY } from '../../model/event-registry';
import type { ChannelKey, ChannelPrefs, DigestPrefs } from '../../model/types';
import {
  ChannelGroup,
  ChannelHead,
  DigestControls,
  EventRow,
  HeaderRow,
  PageWrap,
  Row,
  SaveBar,
  Section,
  SectionHint,
  SectionTitle,
} from './style';

const CHANNELS: ChannelKey[] = ['inApp', 'telegram', 'email', 'sms'];

const CHANNEL_LABEL: Record<ChannelKey, string> = {
  inApp: 'notif.channel.inApp',
  telegram: 'notif.channel.telegram',
  email: 'notif.channel.email',
  sms: 'notif.channel.sms',
};

function groupEventsByModule(): Array<{ moduleKey: string; events: string[] }> {
  const byModule = new Map<string, string[]>();
  for (const [eventType, descriptor] of Object.entries(EVENT_REGISTRY)) {
    if (eventType.endsWith(COUNCIL_VARIANT_SUFFIX)) continue;
    const list = byModule.get(descriptor.moduleLabelKey) ?? [];
    list.push(eventType);
    byModule.set(descriptor.moduleLabelKey, list);
  }
  return [...byModule.entries()].map(([moduleKey, events]) => ({ moduleKey, events }));
}

function eventLabelKey(eventType: string): string {
  const camel = eventType.replace(/_([a-z])/g, (_match, ch: string) => ch.toUpperCase());
  return `notif.event.${camel}`;
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const navigate = useNavigate();

  const { data, isLoading, isError, error, refetch, isFetching } = usePreferences();
  const update = useUpdatePreferences();

  const [draft, setDraft] = useState<Record<string, ChannelPrefs> | null>(null);
  const prefs = draft ?? data?.preferences ?? {};
  const dirty = draft !== null;

  const groups = useMemo(groupEventsByModule, []);

  const setChannel = (eventType: string, channel: ChannelKey, checked: boolean) => {
    setDraft((current) => {
      const base = current ?? { ...(data?.preferences ?? {}) };
      const existing: ChannelPrefs = base[eventType] ?? {
        inApp: false,
        telegram: false,
        email: false,
        sms: false,
      };
      return { ...base, [eventType]: { ...existing, [channel]: checked } };
    });
  };

  const savePreferences = async () => {
    if (!draft) return;
    try {
      await update.mutateAsync({ preferences: draft });
      setDraft(null);
      message.success(t('notif.settings.saved', { defaultValue: 'Sozlamalar saqlandi' }));
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const saveInstant = async (patch: { paused?: boolean; digest?: DigestPrefs }) => {
    try {
      await update.mutateAsync(patch);
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  if (isLoading) {
    return (
      <PageContainer title={t('notif.settings.title', { defaultValue: 'Bildirishnoma sozlamalari' })}>
        <Spin />
      </PageContainer>
    );
  }

  if (isError || !data) {
    return (
      <PageContainer title={t('notif.settings.title', { defaultValue: 'Bildirishnoma sozlamalari' })}>
        <Alert
          type="error"
          showIcon
          message={getApiErrorMessage(error, t('notif.error.title', { defaultValue: 'Yuklanmadi' }))}
          action={
            <Button size="small" icon={<ReloadOutlined />} loading={isFetching} onClick={() => void refetch()}>
              {t('notif.retry', { defaultValue: 'Qayta urinish' })}
            </Button>
          }
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer title={t('notif.settings.title', { defaultValue: 'Bildirishnoma sozlamalari' })}>
      <PageWrap>
        <HeaderRow>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/bildirishnomalar')}>
            {t('notif.title', { defaultValue: 'Bildirishnomalar' })}
          </Button>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {t('notif.settings.title', { defaultValue: 'Bildirishnoma sozlamalari' })}
          </Typography.Title>
        </HeaderRow>

        <Section>
          <SectionTitle>{t('notif.settings.global', { defaultValue: 'Umumiy' })}</SectionTitle>
          <Row>
            <div>
              <Typography.Text>
                {t('notif.settings.pause', { defaultValue: "Bildirishnomalarni to'xtatish" })}
              </Typography.Text>
              <SectionHint style={{ margin: 0 }}>
                {t('notif.settings.pauseHint', {
                  defaultValue:
                    "Yoqilganda yangi bildirishnoma yuborilmaydi. Mavjudlari o'chirilmaydi.",
                })}
              </SectionHint>
            </div>
            <Switch
              checked={data.paused}
              loading={update.isPending}
              onChange={(checked) => void saveInstant({ paused: checked })}
            />
          </Row>
        </Section>

        <Section>
          <SectionTitle>{t('notif.settings.digest', { defaultValue: 'Xulosa xabari' })}</SectionTitle>
          <SectionHint>
            {t('notif.settings.digestHint', {
              defaultValue: "Har bir hodisa uchun alohida emas, bitta yig'ma xabar yuboriladi.",
            })}
          </SectionHint>
          <Row>
            <Typography.Text>{t('notif.settings.digestEnable', { defaultValue: 'Yoqish' })}</Typography.Text>
            <Switch
              checked={data.digest.enabled}
              loading={update.isPending}
              onChange={(checked) =>
                void saveInstant({ digest: { ...data.digest, enabled: checked } })
              }
            />
          </Row>
          {data.digest.enabled ? (
            <DigestControls>
              <Select
                value={data.digest.frequency}
                style={{ width: 160 }}
                onChange={(value) =>
                  void saveInstant({
                    digest: { ...data.digest, frequency: value as DigestPrefs['frequency'] },
                  })
                }
                options={[
                  { value: 'daily', label: t('notif.settings.daily', { defaultValue: 'Har kuni' }) },
                  { value: 'weekly', label: t('notif.settings.weekly', { defaultValue: 'Har hafta' }) },
                ]}
              />
              <TimePicker
                format="HH:mm"
                allowClear={false}
                value={dayjs(data.digest.time, 'HH:mm')}
                onChange={(value) => {
                  if (!value) return;
                  void saveInstant({ digest: { ...data.digest, time: value.format('HH:mm') } });
                }}
              />
            </DigestControls>
          ) : null}
        </Section>

        <Section>
          <SectionTitle>{t('notif.settings.channels', { defaultValue: 'Kanallar' })}</SectionTitle>
          <SectionHint>
            {t('notif.settings.channelsHint', {
              defaultValue:
                "Belgilanmagan hodisa tizim sozlamasi bo'yicha yuboriladi. Bir marta o'zgartirsangiz, o'sha tanlov saqlanadi.",
            })}
          </SectionHint>

          <Collapse
            expandIconPosition="end"
            items={groups.map((group) => ({
              key: group.moduleKey,
              label: t(group.moduleKey, { defaultValue: readableFallback(group.moduleKey) }),
              children: (
                <>
                  <ChannelHead>
                    {CHANNELS.map((channel) => (
                      <span key={channel} style={{ minWidth: 64, textAlign: 'center' }}>
                        {t(CHANNEL_LABEL[channel], { defaultValue: channel })}
                      </span>
                    ))}
                  </ChannelHead>
                  {group.events.map((eventType) => {
                    const current = prefs[eventType];
                    return (
                      <EventRow key={eventType}>
                        <span className="name">
                          {t(eventLabelKey(eventType), { defaultValue: readableFallback(eventLabelKey(eventType)) })}
                          {current === undefined ? (
                            <Typography.Text
                              type="secondary"
                              style={{ fontSize: 12, marginInlineStart: 8, color: token.colorTextTertiary }}
                            >
                              {t('notif.settings.systemDefault', { defaultValue: 'tizim sozlamasi' })}
                            </Typography.Text>
                          ) : null}
                        </span>
                        <ChannelGroup>
                          {CHANNELS.map((channel) => (
                            <span key={channel} style={{ minWidth: 64, textAlign: 'center' }}>
                              <Checkbox
                                indeterminate={current === undefined}
                                checked={current?.[channel] ?? false}
                                onChange={(e) => setChannel(eventType, channel, e.target.checked)}
                                aria-label={`${eventType} — ${channel}`}
                              />
                            </span>
                          ))}
                        </ChannelGroup>
                      </EventRow>
                    );
                  })}
                </>
              ),
            }))}
          />

          {dirty ? (
            <SaveBar>
              <Button type="primary" loading={update.isPending} onClick={() => void savePreferences()}>
                {t('notif.settings.save', { defaultValue: 'Saqlash' })}
              </Button>
              <Button onClick={() => setDraft(null)} disabled={update.isPending}>
                {t('notif.settings.cancel', { defaultValue: 'Bekor qilish' })}
              </Button>
            </SaveBar>
          ) : null}
        </Section>
      </PageWrap>
    </PageContainer>
  );
}
