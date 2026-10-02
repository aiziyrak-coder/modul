import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  CloseOutlined,
  MessageOutlined,
  SendOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Avatar, Badge, Empty, Input, Spin } from 'antd';
import { useSessionStore } from '@/app/session';
import { useTranslation } from '@/shared/lib/i18n';
import {
  personName,
  useChatContacts,
  useChatRealtime,
  useConversations,
  useOnlineUsers,
  useThread,
  useUnreadCount,
  type ChatMessage,
  type ChatPerson,
  type Conversation,
  type WorkSlot,
} from '../../api/chat-api';
import { useMyCourses } from '../../api/my-course-api';

const BRAND_GRADIENT = 'linear-gradient(135deg, #34c18c 0%, #2dab7b 100%)';

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

const MONTHS_SHORT: Record<string, string[]> = {
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
  const key = lang === 'ru' ? 'ru' : lang === 'en' ? 'en' : 'uz';
  if (d.getFullYear() === now.getFullYear()) {
    return `${pad2(d.getDate())}-${MONTHS_SHORT[key][d.getMonth()]}`;
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
          color: 'var(--color-text-soft, #697586)',
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
      ? 'var(--brand-primary, #34c18c)'
      : 'var(--color-text-soft, #697586)'
    : '#fff';
  return (
    <span
      aria-label={read ? "O'qildi" : 'Yuborildi'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        color,
        opacity: onLight ? 1 : read ? 1 : 0.55,
      }}
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

function lastSeenText(iso: string | null | undefined, lang: string, t: (k: string) => string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (isSameDay(d, now)) return `${t('qualification.chat.lastSeen')} ${hhmm(iso)}`;
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (isSameDay(d, yest))
    return `${t('qualification.chat.lastSeen')} ${t('qualification.chat.yesterday').toLowerCase()} ${hhmm(iso)}`;
  return `${t('qualification.chat.lastSeen')} ${dayLabel(iso, lang, t)}`;
}

const FULL_DAYS: { uz: string[]; ru: string[]; en: string[] } = {
  uz: ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'],
  ru: ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'],
  en: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
};
const WEEK = [1, 2, 3, 4, 5, 6, 7];

function todayDay(): number {
  const jsDay = new Date().getDay();
  return jsDay === 0 ? 7 : jsDay;
}

function TeacherSchedule({
  schedule,
  lang,
  t,
}: {
  schedule: WorkSlot[] | undefined;
  lang: string;
  t: (k: string) => string;
}) {
  const names = lang === 'ru' ? FULL_DAYS.ru : lang === 'en' ? FULL_DAYS.en : FULL_DAYS.uz;
  const today = todayDay();
  const byDay = new Map<number, WorkSlot>();
  (schedule ?? []).forEach((s) => byDay.set(s.day, s));
  const hasAny = byDay.size > 0;
  return (
    <div
      className="qual-chat-scroll"
      style={{ flex: 1, overflowY: 'auto', padding: 12, ...THIN_SCROLL }}
    >
      <div style={{ fontSize: 12, color: 'var(--color-text-soft, #67728a)', marginBottom: 8 }}>
        {hasAny
          ? t('qualification.chat.scheduleHint')
          : t('qualification.chat.scheduleEmpty')}
      </div>
      {WEEK.map((day) => {
        const slot = byDay.get(day);
        const isToday = day === today;
        return (
          <div
            key={day}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              padding: '8px 10px',
              borderRadius: 8,
              marginBottom: 2,
              background: isToday ? 'var(--color-bg-elevate, #f5f7fb)' : 'transparent',
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: isToday ? 600 : 500,
                color: 'var(--color-text, #121926)',
              }}
            >
              {names[day - 1] ?? ''}
              {isToday && (
                <span
                  style={{ marginLeft: 6, fontSize: 11, color: 'var(--brand-primary, #34c18c)' }}
                >
                  • {t('qualification.chat.today').toLowerCase()}
                </span>
              )}
            </span>
            {slot ? (
              <span
                style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text, #121926)' }}
              >
                {slot.from}–{slot.to}
              </span>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--color-text-soft, #67728a)' }}>
                {t('qualification.chat.dayOff')}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ChatWidget() {
  const { t, lang } = useTranslation();
  const qc = useQueryClient();
  const myUser = useSessionStore((s) => s.user);
  const myId = myUser?.id;
  const myName =
    [myUser?.lastName, myUser?.firstName].filter(Boolean).join(' ').trim() ||
    myUser?.fullName ||
    t('qualification.chat.title');

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<ChatPerson | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [draft, setDraft] = useState('');
  const [hoverId, setHoverId] = useState<string | null>(null);

  const unread = useUnreadCount();
  const myCourses = useMyCourses();
  const contacts = useChatContacts();
  const conversations = useConversations(open);
  const thread = useThread(active?._id);
  const { send, markRead, isSending } = useChatRealtime(true);
  const onlineIds = useOnlineUsers(true);

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
    qc.invalidateQueries({ queryKey: ['chat-conversations'] });
    qc.invalidateQueries({ queryKey: ['chat-unread'] });
  }, [activeId, threadLoadedAt, qc]);

  useEffect(() => {
    if (!open) return;
    qc.invalidateQueries({ queryKey: ['chat-conversations'] });
    qc.invalidateQueries({ queryKey: ['chat-contacts'] });
  }, [onlineIds, open, qc]);

  const submit = () => {
    const text = draft.trim();
    if (!text || !active || isSending) return;
    send(active._id, text);
    setDraft('');
  };

  const unreadCount = unread.data ?? 0;
  const contactList = contacts.data ?? [];

  const isOnline = (id?: string | null): boolean => {
    if (!id) return false;
    const key = String(id);
    if (onlineIds.has(key)) return true;
    if (convByUser.get(key)?.user?.online) return true;
    return contactList.some((c) => String(c._id) === key && c.online === true);
  };

  if (!myCourses.data?.length) return null;
  if (!contactList.length) return null;

  return (
    <>
      <style>{SCROLL_CSS}</style>
      <button
        type="button"
        onClick={() => {
          if (!open) {
            setActive(null);
            setShowSchedule(false);
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
          boxShadow: '0 8px 24px rgba(52, 193, 140, 0.42)',
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
          boxShadow: 'var(--shadow-md, 9px 8px 34px rgba(47, 66, 108, 0.22))',
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
          {active && (
            <button
              type="button"
              onClick={() => {
                if (showSchedule) setShowSchedule(false);
                else setActive(null);
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
              src={active?.photo || undefined}
              style={{ background: 'rgba(255,255,255,0.22)', color: '#fff' }}
              icon={active ? (!initials(active) ? <UserOutlined /> : undefined) : <UserOutlined />}
            >
              {active ? initials(active) || null : null}
            </Avatar>
            {active && <OnlineDot online={isOnline(active._id)} />}
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
              {active ? personName(active) : myName}
            </div>
            {showSchedule ? (
              <div style={{ fontSize: 12, opacity: 0.85 }}>
                {t('qualification.chat.scheduleTitle')}
              </div>
            ) : active ? (
              (() => {
                const status = isOnline(active._id)
                  ? t('qualification.chat.online')
                  : lastSeenText(
                      convByUser.get(String(active._id))?.user?.lastSeen ?? active.lastSeen,
                      lang,
                      t,
                    );
                return status ? (
                  <div style={{ fontSize: 12, opacity: 0.85 }}>{status}</div>
                ) : null;
              })()
            ) : (
              <div style={{ fontSize: 12, opacity: 0.85 }}>
                {t('qualification.chat.startHint')}
              </div>
            )}
          </div>
          {active && !showSchedule && (
            <button
              type="button"
              onClick={() => setShowSchedule(true)}
              aria-label={t('qualification.chat.scheduleTitle')}
              title={t('qualification.chat.scheduleTitle')}
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
          key={showSchedule ? 'schedule' : active ? 'thread' : 'list'}
          className="qual-chat-panel-anim"
          style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
        >
        {showSchedule && active ? (
          <TeacherSchedule schedule={active.workingSchedule} lang={lang} t={t} />
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
                      borderBottom: '1px solid var(--color-border-soft, #eef2f6)',
                      background:
                        hoverId === c._id ? 'var(--color-bg-elevate, #f5f7fb)' : 'transparent',
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
                      <OnlineDot online={isOnline(c._id)} size={13} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 600,
                          color: 'var(--color-text, #121926)',
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
                          color: 'var(--color-text-soft, #697586)',
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
                            color: 'var(--color-text-soft, #697586)',
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
                            background: 'var(--brand-primary, #34c18c)',
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
                background: 'var(--color-bg-elevate, #f5f7fb)',
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
                    !prev ||
                    !isSameDay(new Date(prev.createdAt), new Date(m.createdAt));
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
                          color: mine ? '#fff' : 'var(--color-text, #121926)',
                          border: mine ? 'none' : '1px solid var(--color-border-soft, #eef2f6)',
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
                borderTop: '1px solid var(--color-border, #e3e8ef)',
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
                  background: draft.trim() ? BRAND_GRADIENT : 'var(--color-border, #e3e8ef)',
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
