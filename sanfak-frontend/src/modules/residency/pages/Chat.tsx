import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import styled from 'styled-components';
import { Input } from '@/shared/ui';
import { PageTitle, Btn } from '../components/common/FormElements';
import Badge from '../components/common/Badge';
import { AsyncSelect } from '../components/common/AsyncSelect';
import { theme } from '../styles/theme';
import { useAuth } from '../context/AuthContext';
import { useResidencyCapabilities } from '../lib/capabilities';
import { autoChatPartner } from '../lib/chatPartner';
import { normalizeSearch } from '../lib/use-debounced';
import { useMyResident, useMyResidents } from '../api/residency-api';
import { useConversations } from '../api/chat-api';
import { useRealtimeChat } from '../lib/use-realtime-chat';

const STICK_BOTTOM_PX = 80;

const isAtBottom = (el: HTMLDivElement | null): boolean =>
  !el || el.scrollHeight - el.scrollTop - el.clientHeight <= STICK_BOTTOM_PX;

const UNKNOWN = 'Noma’lum foydalanuvchi';

interface Partner {
  id: string;
  name: string;
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return '?';
  return parts.map((p) => p.charAt(0)).join('').toUpperCase();
}

function fmtTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function fmtStamp(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const today =
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  return today
    ? `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
    : `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

const Shell = styled.div`
  display: flex;
  height: calc(100vh - 220px);
  min-height: 420px;
  background: ${({ theme }) => theme.colors.white};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.lg};
  overflow: hidden;
`;

const ListPane = styled.aside`
  width: 300px;
  flex-shrink: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid ${({ theme }) => theme.colors.border};

  @media (max-width: 900px) {
    width: 220px;
  }
`;

const ListHead = styled.div`
  padding: 12px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const ListBody = styled.div`
  flex: 1;
  overflow-y: auto;
`;

const ConvRow = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  text-align: left;
  cursor: pointer;
  border: none;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme, $active }) => ($active ? theme.colors.primaryLight : theme.colors.white)};
  transition: background 0.15s;

  &:hover {
    background: ${({ theme, $active }) => ($active ? theme.colors.primaryLight : theme.colors.bg)};
  }
`;

const Avatar = styled.span`
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: ${({ theme }) => theme.radius.full};
  background: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.white};
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ConvMain = styled.span`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const ConvLine = styled.span`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
`;

const ConvName = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ConvStamp = styled.span`
  font-size: 11px;
  flex-shrink: 0;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const ConvLast = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textMuted};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ChatPane = styled.section`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
`;

const ChatHead = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  flex-shrink: 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const ChatName = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

const Feed = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: ${({ theme }) => theme.colors.bg};
`;

const Row = styled.div<{ $mine: boolean }>`
  display: flex;
  justify-content: ${({ $mine }) => ($mine ? 'flex-end' : 'flex-start')};
`;

const Bubble = styled.div<{ $mine: boolean }>`
  max-width: 68%;
  padding: 9px 13px;
  font-size: 13px;
  line-height: 1.5;
  box-shadow: ${({ theme }) => theme.shadow.sm};
  border: 1px solid ${({ theme, $mine }) => ($mine ? theme.colors.primary : theme.colors.border)};
  background: ${({ theme, $mine }) => ($mine ? theme.colors.primary : theme.colors.white)};
  color: ${({ theme, $mine }) => ($mine ? theme.colors.white : theme.colors.text)};
  border-radius: ${({ theme, $mine }) =>
    $mine
      ? `${theme.radius.lg} ${theme.radius.lg} ${theme.radius.sm} ${theme.radius.lg}`
      : `${theme.radius.lg} ${theme.radius.lg} ${theme.radius.lg} ${theme.radius.sm}`};
`;

const BubbleText = styled.div`
  white-space: pre-wrap;
  word-break: break-word;
`;

const BubbleTime = styled.div<{ $mine: boolean }>`
  margin-top: 3px;
  font-size: 11px;
  text-align: right;
  opacity: ${({ $mine }) => ($mine ? 0.85 : 1)};
  color: ${({ theme, $mine }) => ($mine ? theme.colors.white : theme.colors.textMuted)};
`;

const Composer = styled.form`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  flex-shrink: 0;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.white};
`;

const Notice = styled.div`
  padding: 24px 16px;
  text-align: center;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Placeholder = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textMuted};
  background: ${({ theme }) => theme.colors.bg};
`;

export default function Chat() {
  const { user, isLoading: authLoading } = useAuth();
  const myId = user.id;

  const { isStudent, isMentor } = useResidencyCapabilities();
  const canChat = isStudent || isMentor;
  const ready = !!myId && canChat;

  const [partner, setPartner] = useState<Partner | null>(null);
  const [draft, setDraft] = useState('');
  const [newBelow, setNewBelow] = useState(false);
  const feedRef = useRef<HTMLDivElement | null>(null);

  const { data: conversations = [], isLoading: convLoading } = useConversations(ready);
  const threadId = ready && partner ? partner.id : undefined;
  const chat = useRealtimeChat(threadId, myId);
  const { messages, loading: threadLoading } = chat;

  const myResidentQ = useMyResident(ready && isStudent);
  const myResidentsQ = useMyResidents({}, ready && isMentor);

  const options: Partner[] = useMemo(() => {
    const acc = new Map<string, string>();
    if (isStudent) {
      const me = myResidentQ.data;
      if (me?.supervisorId) acc.set(me.supervisorId, me.supervisorName ?? '');
    } else {
      for (const r of myResidentsQ.data ?? []) {
        if (r.userId) acc.set(r.userId, r.fullName);
      }
    }
    acc.delete(myId);
    return [...acc.entries()]
      .map(([id, name]) => ({ id, name: name || UNKNOWN }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [isStudent, myId, myResidentQ.data, myResidentsQ.data]);

  const [partnerQuery, setPartnerQuery] = useState('');
  const partnerOptions = useMemo(() => {
    const q = normalizeSearch(partnerQuery).toLowerCase();
    return q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;
  }, [options, partnerQuery]);

  const auto = autoChatPartner(isStudent, partner, options, conversations);
  useEffect(() => {
    if (auto) setPartner(auto);
  }, [auto]);

  const scrollBottomRef = useRef(true);
  const prevCountRef = useRef(0);
  const prevTickRef = useRef(chat.arrivalTick);

  if (prevTickRef.current !== chat.arrivalTick) {
    prevTickRef.current = chat.arrivalTick;
    scrollBottomRef.current = chat.lastIsMine || isAtBottom(feedRef.current);
  }

  useLayoutEffect(() => {
    const el = feedRef.current;
    const count = messages.length;
    const appended = count > prevCountRef.current && chat.anchorRef.current == null;
    prevCountRef.current = count;
    if (!el) return;

    if (chat.anchorRef.current != null) {
      el.scrollTop = el.scrollHeight - chat.anchorRef.current;
      chat.anchorRef.current = null;
      return;
    }
    if (scrollBottomRef.current) {
      el.scrollTop = el.scrollHeight;
      scrollBottomRef.current = false;
      setNewBelow(false);
    } else if (appended && !chat.lastIsMine) {
      setNewBelow(true);
    }
  }, [messages, chat.arrivalTick, chat.lastIsMine, chat.anchorRef]);

  useEffect(() => {
    scrollBottomRef.current = true;
    setNewBelow(false);
  }, [threadId]);

  const onFeedScroll = () => {
    const el = feedRef.current;
    if (!el) return;
    if (el.scrollTop <= 60 && chat.hasMore && !chat.loadingOlder) {
      chat.anchorRef.current = el.scrollHeight - el.scrollTop;
      void chat.loadOlder();
    }
    if (isAtBottom(el)) setNewBelow(false);
  };

  const jumpToBottom = () => {
    const el = feedRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    setNewBelow(false);
  };

  const pick = (id: string, label?: string) => {
    if (!id) return;
    const found = options.find((o) => o.id === id);
    setPartner({ id, name: label || found?.name || UNKNOWN });
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !partner || chat.sending) return;
    try {
      await chat.send(text);
      setDraft('');
    } catch {}
  };

  if (authLoading) {
    return (
      <div>
        <PageTitle>Chat</PageTitle>
        <Notice>Yuklanmoqda…</Notice>
      </div>
    );
  }

  if (!canChat) {
    return (
      <div>
        <PageTitle>Chat</PageTitle>
        <Notice>Chat faqat magistrant, rezident, ilmiy rahbar va klinik ustoz uchun mavjud.</Notice>
      </div>
    );
  }

  return (
    <div>
      <PageTitle>Chat</PageTitle>
      <Shell>
        <ListPane>
          {!isStudent && (
            <ListHead>
              <AsyncSelect
                value=""
                onChange={(id, opt) => pick(id, opt?.label)}
                options={partnerOptions.map((o) => ({ value: o.id, label: o.name }))}
                onSearch={setPartnerQuery}
                placeholder="Yangi suhbat — talabani tanlang"
                searchPlaceholder="F.I.Sh bo'yicha qidiring"
                allowClear={false}
              />
            </ListHead>
          )}

          <ListBody>
            {conversations.map((c) => (
              <ConvRow
                key={c.userId}
                type="button"
                $active={partner?.id === c.userId}
                onClick={() => setPartner({ id: c.userId, name: c.user.name || UNKNOWN })}
              >
                <Avatar>{initials(c.user.name)}</Avatar>
                <ConvMain>
                  <ConvLine>
                    <ConvName>{c.user.name || UNKNOWN}</ConvName>
                    <ConvStamp>{fmtStamp(c.lastMessageAt)}</ConvStamp>
                  </ConvLine>
                  <ConvLine>
                    <ConvLast>{c.lastMessage ?? '—'}</ConvLast>
                    {c.unreadCount > 0 && <Badge variant="yangi">{c.unreadCount}</Badge>}
                  </ConvLine>
                </ConvMain>
              </ConvRow>
            ))}
            {convLoading && conversations.length === 0 && <Notice>Yuklanmoqda…</Notice>}
            {!convLoading && conversations.length === 0 && <Notice>Suhbatlar yo‘q</Notice>}
          </ListBody>
        </ListPane>

        <ChatPane>
          {partner ? (
            <>
              <ChatHead>
                <Avatar>{initials(partner.name)}</Avatar>
                <ChatName>{partner.name}</ChatName>
                <ChatPresence $online={chat.peerOnline}>
                  {chat.peerOnline ? 'Onlayn' : 'Oflayn'}
                </ChatPresence>
              </ChatHead>

              <Feed ref={feedRef} onScroll={onFeedScroll}>
                {chat.loadingOlder && <Notice>Eski xabarlar yuklanmoqda…</Notice>}
                {chat.error && <ErrorNotice>{chat.error}</ErrorNotice>}
                {messages.map((m) => (
                  <Row key={m.id} $mine={m.mine}>
                    <Bubble $mine={m.mine}>
                      {m.message && <BubbleText>{m.message}</BubbleText>}
                      {m.fileUrl && (
                        <FileChip href={m.fileUrl} target="_blank" rel="noopener noreferrer" $mine={m.mine}>
                          {m.fileUrl.split('/').pop() || 'Biriktirilgan fayl'}
                        </FileChip>
                      )}
                      <BubbleTime $mine={m.mine}>{fmtTime(m.createdAt)}</BubbleTime>
                    </Bubble>
                  </Row>
                ))}
                {threadLoading && messages.length === 0 && <Notice>Yuklanmoqda…</Notice>}
                {!threadLoading && !chat.error && messages.length === 0 && (
                  <Notice>Xabarlar yo‘q. Birinchi xabarni yozing.</Notice>
                )}
              </Feed>

              <PillDock>
                {newBelow && (
                  <NewBelowPill type="button" onClick={jumpToBottom}>
                    ↓ Yangi xabar
                  </NewBelowPill>
                )}
              </PillDock>

              <Composer onSubmit={(e) => void submit(e)}>
                <Input
                  style={{ flex: 1, borderRadius: theme.radius.full }}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Xabar yozing..."
                  autoComplete="off"
                />
                <Btn type="submit" $variant="primary" disabled={!draft.trim() || chat.sending}>
                  Yuborish
                </Btn>
              </Composer>
            </>
          ) : (
            <Placeholder>Suhbatni tanlang</Placeholder>
          )}
        </ChatPane>
      </Shell>
    </div>
  );
}

const ChatPresence = styled.span<{ $online: boolean }>`
  margin-left: 8px;
  font-size: 11px;
  color: ${({ $online, theme }) => ($online ? theme.colors.primary : '#95a5a6')};
`;

const PillDock = styled.div`
  position: relative;
  height: 0;
  flex-shrink: 0;
`;

const NewBelowPill = styled.button`
  position: absolute;
  left: 50%;
  bottom: 12px;
  transform: translateX(-50%);
  z-index: 2;
  padding: 6px 14px;
  border-radius: 999px;
  border: none;
  background: ${({ theme }) => theme.colors.primary};
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
`;

const ErrorNotice = styled.div`
  margin: 8px auto;
  padding: 10px 14px;
  border-radius: 8px;
  background: #fdecea;
  color: #c0392b;
  font-size: 12px;
  text-align: center;
  max-width: 90%;
`;

const FileChip = styled.a<{ $mine: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 12px;
  text-decoration: none;
  background: ${({ $mine }) => ($mine ? 'rgba(255,255,255,0.22)' : '#eef2f5')};
  color: ${({ $mine }) => ($mine ? '#fff' : '#2c3e50')};
  &:hover { text-decoration: underline; }
`;
