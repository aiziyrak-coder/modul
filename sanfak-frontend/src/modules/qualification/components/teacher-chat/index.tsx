import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  CloseOutlined,
  MessageOutlined,
  SendOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Avatar, Badge, Button, Empty, Input, Spin, Switch, TimePicker } from 'antd';
import dayjs from 'dayjs';
import { useQueryClient } from '@tanstack/react-query';
import { usePermission, useSessionStore } from '@/app/session';
import { useTranslation } from '@/shared/lib/i18n';
import {
  personName,
  useChatContacts,
  useChatRealtime,
  useConversations,
  useMyProfile,
  useOnlineUsers,
  useTeacherProfile,
  useThread,
  useUnreadCount,
  useUpdateTeacherProfile,
  type ChatMessage,
  type ChatPerson,
  type Conversation,
  type WorkSlot,
} from '../../api/chat-api';

const BRAND_GRADIENT =
  'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-primary-hover) 100%)';

const SCROLL_CSS = `
.qual-chat-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
.qual-chat-scroll::-webkit-scrollbar-track { background: transparent; }
.qual-chat-scroll::-webkit-scrollbar-thumb { background: rgba(120,130,145,0.35); border-radius: 8px; }
.qual-chat-scroll::-webkit-scrollbar-thumb:hover { background: rgba(120,130,145,0.55); }
@keyframes qualChatPanelIn {
  from { opacity: 0; transform: translateX(10px); }
  to { opacity: 1; transform: translateX(0); }
}
.qual-chat-panel-anim { animation: qualChatPanelIn .22s ease; min-height: 0; }
.qual-chat-sched-switch { transform: scale(0.8); transform-origin: left center; }
`;

const THIN_SCROLL = {
  scrollbarWidth: 'thin' as const,
  scrollbarColor: 'rgba(120,130,145,0.35) transparent',
};

const initials = (p?: ChatPerson): string => {
  const a = (p?.lastName ?? '')[0] ?? '';
  const b = (p?.firstName ?? '')[0] ?? '';
  return (a + b).toUpperCase();
};

const hhmm = (iso?: string): string =>
  iso
    ? new Date(iso).toLocaleTimeString('uz', { hour: '2-digit', minute: '2-digit' })
    : '';

const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const MONTHS_SHORT: { uz: string[]; ru: string[]; en: string[] } = {
  uz: ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'],
  ru: ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};
const pad2 = (n: number): string => String(n).padStart(2, '0');

const dayLabel = (iso: string, lang: string, t: (k: string) => string): string => {
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(d, now)) return t('qualification.chat.today');
  if (isSameDay(d, yesterday)) return t('qualification.chat.yesterday');
  const key: 'uz' | 'ru' | 'en' = lang === 'ru' ? 'ru' : lang === 'en' ? 'en' : 'uz';
  if (d.getFullYear() === now.getFullYear()) {
    return `${pad2(d.getDate())}-${MONTHS_SHORT[key][d.getMonth()] ?? ''}`;
  }
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${String(d.getFullYear()).slice(-2)}`;
};

function DateDivider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0 12px' }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: 'var(--color-text-soft)',
          background: 'rgba(255,255,255,0.9)',
          padding: '3px 10px',
          borderRadius: 10,
          boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
        }}
      >
        {label}
      </span>
    </div>
  );
}

function ReadTicks({ read, onLight = false }: { read: boolean; onLight?: boolean }) {
  const color = onLight
    ? read
      ? 'var(--brand-primary)'
      : 'var(--color-text-soft)'
    : '#fff';
  return (
    <span
      aria-label={read ? "O'qildi" : 'Yuborildi'}
      style={{ display: 'inline-flex', alignItems: 'center', color, opacity: onLight ? 1 : read ? 1 : 0.55 }}
    >
      <CheckOutlined style={{ fontSize: 12 }} />
      {read && <CheckOutlined style={{ fontSize: 12, marginLeft: -6 }} />}
    </span>
  );
}

function OnlineDot({ online, size = 12 }: { online: boolean; size?: number }) {
  if (!online) return null;
  return (
    <span
      aria-label="online"
      style={{
        position: 'absolute',
        right: 0,
        bottom: 0,
        width: size,
        height: size,
        borderRadius: '50%',
        background: '#22c55e',
        border: '2px solid #fff',
        boxSizing: 'border-box',
      }}
    />
  );
}

const DAY_NAMES: { uz: string[]; ru: string[]; en: string[] } = {
  uz: ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'],
  ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
};
const WEEK = [1, 2, 3, 4, 5, 6, 7];

function lastSeenText(iso: string | null | undefined, lang: string, t: (k: string) => string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const time = hhmm(iso);
  if (isSameDay(d, now)) return `${t('qualification.chat.lastSeen')} ${time}`;
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (isSameDay(d, yest)) return `${t('qualification.chat.lastSeen')} ${t('qualification.chat.yesterday').toLowerCase()} ${time}`;
  return `${t('qualification.chat.lastSeen')} ${dayLabel(iso, lang, t)}`;
}

function todayHours(schedule?: WorkSlot[]): string {
  if (!schedule?.length) return '';
  const jsDay = new Date().getDay();
  const day = jsDay === 0 ? 7 : jsDay;
  const slot = schedule.find((s) => s.day === day);
  return slot ? `${slot.from}–${slot.to}` : '';
}

function hhmmToDayjs(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return dayjs().hour(h ?? 0).minute(m ?? 0).second(0).millisecond(0);
}

function ProfilePanel({ lang, t }: { lang: string; t: (k: string) => string }) {
  const profile = useTeacherProfile(true);
  const update = useUpdateTeacherProfile();
  const [map, setMap] = useState<Map<number, { from: string; to: string }>>(new Map());

  useEffect(() => {
    if (!profile.data) return;
    const m = new Map<number, { from: string; to: string }>();
    (profile.data.workingSchedule ?? []).forEach((s) => m.set(s.day, { from: s.from, to: s.to }));
    setMap(m);
  }, [profile.data]);

  const toggle = (day: number, on: boolean) =>
    setMap((prev) => {
      const m = new Map(prev);
      if (on) m.set(day, { from: '09:00', to: '18:00' });
      else m.delete(day);
      return m;
    });
  const setTime = (day: number, key: 'from' | 'to', v: string) =>
    setMap((prev) => {
      const m = new Map(prev);
      const cur = m.get(day) ?? { from: '09:00', to: '18:00' };
      m.set(day, { ...cur, [key]: v });
      return m;
    });
  const save = () => {
    const ws: WorkSlot[] = [...map.entries()]
      .map(([day, tt]) => ({ day, from: tt.from, to: tt.to }))
      .sort((a, b) => a.day - b.day);
    update.mutate(ws);
  };
  const names = lang === 'ru' ? DAY_NAMES.ru : lang === 'en' ? DAY_NAMES.en : DAY_NAMES.uz;

  if (profile.isLoading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }

  return (
    <div
      className="qual-chat-scroll"
      style={{ flex: 1, overflowY: 'auto', padding: 12, ...THIN_SCROLL }}
    >
      <div style={{ fontSize: 12, color: 'var(--color-text-soft)', marginBottom: 8 }}>
        {t('qualification.chat.workHoursHint')}
      </div>
      {WEEK.map((day) => {
        const slot = map.get(day);
        return (
          <div
            key={day}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '5px 0',
              borderBottom: '1px solid var(--color-border-soft)',
            }}
          >
            <Switch
              className="qual-chat-sched-switch"
              size="small"
              checked={!!slot}
              onChange={(on) => toggle(day, on)}
            />
            <span style={{ width: 74, fontSize: 12, fontWeight: 500 }}>{names[day - 1]}</span>
            {slot ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1 }}>
                <TimePicker
                  value={hhmmToDayjs(slot.from)}
                  onChange={(d) => d && setTime(day, 'from', d.format('HH:mm'))}
                  format="HH:mm"
                  minuteStep={5}
                  size="small"
                  allowClear={false}
                  suffixIcon={null}
                  inputReadOnly
                  style={{ width: 84 }}
                />
                <span style={{ color: 'var(--color-text-soft)' }}>–</span>
                <TimePicker
                  value={hhmmToDayjs(slot.to)}
                  onChange={(d) => d && setTime(day, 'to', d.format('HH:mm'))}
                  format="HH:mm"
                  minuteStep={5}
                  size="small"
                  allowClear={false}
                  suffixIcon={null}
                  inputReadOnly
                  style={{ width: 84 }}
                />
              </div>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--color-text-soft)', flex: 1 }}>
                {t('qualification.chat.dayOff')}
              </span>
            )}
          </div>
        );
      })}
      <Button
        type="primary"
        block
        size="small"
        onClick={save}
        loading={update.isPending}
        style={{ marginTop: 12 }}
      >
        {t('qualification.chat.save')}
      </Button>
      {update.isSuccess && (
        <div
          style={{
            textAlign: 'center',
            color: 'var(--brand-primary)',
            fontSize: 12,
            marginTop: 8,
          }}
        >
          {t('qualification.chat.saved')}
        </div>
      )}
    </div>
  );
}

export function TeacherChat() {
  const { t, lang } = useTranslation();
  const qc = useQueryClient();
  const can = usePermission();
  const allowed = can('qualTopicLecture:create');
  const myId = useSessionStore((s) => s.user?.id);
  const myFullName = useSessionStore((s) => s.user?.fullName);
  const me = useMyProfile(allowed);
  const myName =
    [me.data?.lastName, me.data?.firstName].filter(Boolean).join(' ').trim() ||
    myFullName ||
    t('qualification.chat.title');

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<ChatPerson | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [draft, setDraft] = useState('');
  const [hoverId, setHoverId] = useState<string | null>(null);

  const unread = useUnreadCount(allowed);
  const contacts = useChatContacts(allowed);
  const conversations = useConversations(open && allowed);
  const thread = useThread(allowed ? active?._id : undefined);
  const { send, markRead, isSending } = useChatRealtime(allowed);
  const onlineIds = useOnlineUsers(allowed);

  const convByUser = useMemo(() => {
    const m = new Map<string, Conversation>();
    (conversations.data ?? []).forEach((c) => m.set(String(c.user._id), c));
    return m;
  }, [conversations.data]);

  const messages = useMemo<ChatMessage[]>(
    () => [...(thread.data?.docs ?? [])].reverse(),
    [thread.data],
  );

  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [messages.length, active]);

  const activeId = active?._id;
  useEffect(() => {
    if (!open || !activeId) return;
    markRead(activeId);
  }, [open, activeId, markRead]);

  const threadLoadedAt = thread.dataUpdatedAt;
  useEffect(() => {
    if (!activeId || !threadLoadedAt) return;
    qc.invalidateQueries({ queryKey: ['qual-chat', 'conversations'] });
    qc.invalidateQueries({ queryKey: ['qual-chat', 'unread'] });
  }, [activeId, threadLoadedAt, qc]);

  useEffect(() => {
    if (!open) return;
    qc.invalidateQueries({ queryKey: ['qual-chat', 'conversations'] });
    qc.invalidateQueries({ queryKey: ['qual-chat', 'contacts'] });
  }, [onlineIds, open, qc]);

  const submit = () => {
    const text = draft.trim();
    if (!text || !active || isSending) return;
    send(active._id, text);
    setDraft('');
  };

  if (!allowed) return null;

  const unreadCount = unread.data ?? 0;
  const contactList = contacts.data ?? [];

  return (
    <>
      <style>{SCROLL_CSS}</style>
      <button
        type="button"
        onClick={() => {
          if (!open) {
            setActive(null);
            setShowProfile(false);
          }
          setOpen((v) => !v);
        }}
        aria-label={t('qualification.chat.title')}
        style={{
          position: 'fixed',
          right: 24,
          bottom: 84,
          zIndex: 1001,
          width: 56,
          height: 56,
          borderRadius: '50%',
          border: 'none',
          background: BRAND_GRADIENT,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 24px color-mix(in srgb, var(--brand-primary) 42%, transparent)',
        }}
      >
        <Badge count={open ? 0 : unreadCount} size="small" offset={[4, -2]}>
          <span style={{ color: '#fff', fontSize: 22, display: 'flex' }}>
            {open ? <CloseOutlined /> : <MessageOutlined />}
          </span>
        </Badge>
      </button>

      <div
        style={{
          position: 'fixed',
          right: 24,
          bottom: 152,
          zIndex: 1000,
          width: 'min(380px, calc(100vw - 32px))',
          height: 'min(600px, calc(100vh - 192px))',
          background: '#fff',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          flexDirection: 'column',
          transformOrigin: 'bottom right',
          opacity: open ? 1 : 0,
          transform: open ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.96)',
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity .18s ease, transform .18s ease',
        }}
      >
        <div
          style={{
            background: BRAND_GRADIENT,
            color: '#fff',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexShrink: 0,
          }}
        >
          {(active || showProfile) && (
            <button
              type="button"
              onClick={() => {
                setActive(null);
                setShowProfile(false);
              }}
              aria-label="back"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                fontSize: 18,
                padding: 0,
              }}
            >
              <ArrowLeftOutlined />
            </button>
          )}
          <div style={{ position: 'relative', flexShrink: 0, display: 'flex' }}>
            <Avatar
              size={40}
              src={(active ? active.photo : me.data?.photo) || undefined}
              style={{ background: 'rgba(255,255,255,0.22)', color: '#fff' }}
              icon={active ? (!initials(active) ? <UserOutlined /> : undefined) : <UserOutlined />}
            >
              {active ? initials(active) || null : null}
            </Avatar>
            {active && <OnlineDot online={onlineIds.has(String(active._id))} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: 15,
                lineHeight: 1.3,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {showProfile ? t('qualification.chat.profileTitle') : active ? personName(active) : myName}
            </div>
            {active ? (
              <div style={{ fontSize: 12, opacity: 0.85 }}>
                {onlineIds.has(String(active._id))
                  ? t('qualification.chat.online')
                  : lastSeenText(
                      convByUser.get(String(active._id))?.user?.lastSeen ?? active.lastSeen,
                      lang,
                      t,
                    ) ||
                    (todayHours(active.workingSchedule)
                      ? `${t('qualification.chat.workHours')}: ${todayHours(active.workingSchedule)}`
                      :
                        t('qualification.chat.offline'))}
              </div>
            ) : !showProfile ? (
              <div style={{ fontSize: 12, opacity: 0.85 }}>
                {t('qualification.chat.subtitle')}
              </div>
            ) : null}
          </div>
          {!active && !showProfile && (
            <button
              type="button"
              onClick={() => setShowProfile(true)}
              aria-label={t('qualification.chat.workHours')}
              title={t('qualification.chat.workHours')}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                fontSize: 17,
                padding: 0,
              }}
            >
              <ClockCircleOutlined />
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="close"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              fontSize: 16,
              padding: 0,
            }}
          >
            <CloseOutlined />
          </button>
        </div>

        <div
          key={showProfile ? 'profile' : active ? 'thread' : 'list'}
          className="qual-chat-panel-anim"
          style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
        >
        {showProfile ? (
          <ProfilePanel lang={lang} t={t} />
        ) : !active ? (
          contacts.isLoading ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <Spin />
            </div>
          ) : contactList.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={t('qualification.chat.noContacts')}
              />
            </div>
          ) : (
            <div className="qual-chat-scroll" style={{ flex: 1, overflowY: 'auto', ...THIN_SCROLL }}>
              {contactList.map((c) => {
                const conv = convByUser.get(String(c._id));
                return (
                  <button
                    type="button"
                    key={c._id}
                    onClick={() => setActive(c)}
                    onMouseEnter={() => setHoverId(c._id)}
                    onMouseLeave={() => setHoverId(null)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      width: '100%',
                      padding: '12px 16px',
                      border: 'none',
                      borderBottom: '1px solid var(--color-border-soft)',
                      background: hoverId === c._id ? 'var(--color-bg-elevate)' : 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'inherit',
                      transition: 'background .12s ease',
                    }}
                  >
                    <div style={{ position: 'relative', flexShrink: 0, display: 'flex' }}>
                      <Avatar
                        size={44}
                        src={c.photo || undefined}
                        style={{ background: BRAND_GRADIENT, color: '#fff' }}
                        icon={!initials(c) ? <UserOutlined /> : undefined}
                      >
                        {initials(c) || null}
                      </Avatar>
                      <OnlineDot online={onlineIds.has(String(c._id))} size={13} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 600,
                          color: 'var(--color-text)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {personName(c)}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--color-text-soft)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {conv?.lastMessage?.message || t('qualification.chat.startHint')}
                      </div>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        gap: 4,
                        flexShrink: 0,
                      }}
                    >
                      {conv?.lastMessage?.createdAt && (
                        <span
                          style={{
                            fontSize: 11,
                            color: 'var(--color-text-soft)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                        >
                          {conv.lastMessage.sender &&
                            String(conv.lastMessage.sender) === String(myId) && (
                              <ReadTicks read={!!conv.lastMessage.readAt} onLight />
                            )}
                          {hhmm(conv.lastMessage.createdAt)}
                        </span>
                      )}
                      {(conv?.unreadCount ?? 0) > 0 && (
                        <span
                          style={{
                            minWidth: 18,
                            height: 18,
                            padding: '0 5px',
                            borderRadius: 9,
                            background: 'var(--brand-primary)',
                            color: '#fff',
                            fontSize: 11,
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {conv?.unreadCount}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )
        ) : (
          <>
            <div
              ref={bodyRef}
              className="qual-chat-scroll"
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: 16,
                background: 'var(--color-bg-elevate)',
                ...THIN_SCROLL,
              }}
            >
              {thread.isLoading ? (
                <div style={{ textAlign: 'center', paddingTop: 24 }}>
                  <Spin />
                </div>
              ) : messages.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  style={{ marginTop: 48 }}
                  description={t('qualification.chat.startHint')}
                />
              ) : (
                messages.map((m, i) => {
                  const mine = String(m.sender?._id) === String(myId);
                  const prev = messages[i - 1];
                  const showDate =
                    !prev || !isSameDay(new Date(prev.createdAt), new Date(m.createdAt));
                  return (
                    <Fragment key={m._id}>
                      {showDate && <DateDivider label={dayLabel(m.createdAt, lang, t)} />}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: mine ? 'flex-end' : 'flex-start',
                          marginBottom: 8,
                        }}
                      >
                        <div
                          style={{
                            maxWidth: '78%',
                            padding: '8px 12px',
                            borderRadius: 14,
                            borderBottomRightRadius: mine ? 4 : 14,
                            borderBottomLeftRadius: mine ? 14 : 4,
                            background: mine ? BRAND_GRADIENT : '#fff',
                            color: mine ? '#fff' : 'var(--color-text)',
                            border: mine ? 'none' : '1px solid var(--color-border-soft)',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                          }}
                        >
                          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {m.message}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              marginTop: 2,
                              opacity: 0.7,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              gap: 4,
                            }}
                          >
                            <span>{hhmm(m.createdAt)}</span>
                            {mine && <ReadTicks read={!!m.readAt} />}
                          </div>
                        </div>
                      </div>
                    </Fragment>
                  );
                })
              )}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 8,
                padding: 12,
                background: '#fff',
                borderTop: '1px solid var(--color-border)',
                flexShrink: 0,
              }}
            >
              <Input.TextArea
                className="qual-chat-scroll"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onPressEnter={(e) => {
                  if (!e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder={t('qualification.chat.placeholder')}
                autoSize={{ minRows: 1, maxRows: 4 }}
                style={{ borderRadius: 20, resize: 'none' }}
              />
              <button
                type="button"
                onClick={submit}
                disabled={isSending || !draft.trim()}
                aria-label="send"
                style={{
                  width: 40,
                  height: 40,
                  flexShrink: 0,
                  borderRadius: '50%',
                  border: 'none',
                  background: draft.trim() ? BRAND_GRADIENT : 'var(--color-border)',
                  color: '#fff',
                  cursor: draft.trim() ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  transition: 'background .12s ease',
                }}
              >
                <SendOutlined />
              </button>
            </div>
          </>
        )}
        </div>
      </div>
    </>
  );
}
