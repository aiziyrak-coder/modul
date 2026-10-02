import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/uz-latn';
import { MdAttachFile, MdDone, MdDoneAll, MdSend } from '../../icons';
import { Textarea } from '@/shared/ui';
import { useRealtimeChat } from '../../lib/use-realtime-chat';
import type { Message } from '../../data/types';
import * as S from './style';

const STICK_BOTTOM_PX = 80;

const isAtBottom = (el: HTMLDivElement | null): boolean =>
  !el || el.scrollHeight - el.scrollTop - el.clientHeight <= STICK_BOTTOM_PX;

const formatTime = (ts: string) => {
  const d = dayjs(ts);
  return d.isValid() ? d.locale('uz-latn').format('HH:mm') : '';
};

const formatDate = (ts: string) => {
  const d = dayjs(ts);
  if (!d.isValid()) return '';
  return d.isSame(dayjs(), 'day') ? 'Bugun' : d.locale('uz-latn').format('D MMMM YYYY');
};

const groupByDay = (messages: Message[]) =>
  messages.reduce<Array<{ date: string; items: Message[] }>>((acc, msg) => {
    const date = formatDate(msg.timestamp);
    const last = acc[acc.length - 1];
    if (last && last.date === date) last.items.push(msg);
    else acc.push({ date, items: [msg] });
    return acc;
  }, []);

export interface ChatPanelProps {
  peerUserId: string | undefined;
  myId: string | undefined;
  peerName: string;
  emptyHint?: string;
}

export default function ChatPanel({ peerUserId, myId, peerName, emptyHint }: ChatPanelProps) {
  const chat = useRealtimeChat(peerUserId, myId);
  const [draft, setDraft] = useState('');
  const [newBelow, setNewBelow] = useState(false);

  const bodyRef = useRef<HTMLDivElement>(null);
  const scrollBottomRef = useRef(true);
  const prevCountRef = useRef(0);

  useLayoutEffect(() => {
    const el = bodyRef.current;
    const count = chat.messages.length;
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
  }, [chat.messages, chat.arrivalTick, chat.lastIsMine, chat.anchorRef]);

  const prevTickRef = useRef(chat.arrivalTick);
  if (prevTickRef.current !== chat.arrivalTick) {
    prevTickRef.current = chat.arrivalTick;
    scrollBottomRef.current = chat.lastIsMine || isAtBottom(bodyRef.current);
  }

  const jumpToBottom = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    setNewBelow(false);
  }, []);

  const onScroll = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    if (el.scrollTop <= 60 && chat.hasMore && !chat.loadingOlder) {
      chat.anchorRef.current = el.scrollHeight - el.scrollTop;
      void chat.loadOlder();
    }
    if (isAtBottom(el)) setNewBelow(false);
  }, [chat]);

  const submit = useCallback(async () => {
    const text = draft.trim();
    if (!text) return;
    try {
      await chat.send(text);
      setDraft('');
    } catch {}
  }, [draft, chat]);

  if (!peerUserId) {
    return <S.EmptyState>{emptyHint ?? 'Chat mavjud emas: hamsuhbat platforma akkauntiga bog‘lanmagan.'}</S.EmptyState>;
  }

  const groups = groupByDay(chat.messages);

  return (
    <S.Wrap>
      <S.Head>
        <S.Avatar>{peerName.charAt(0) || '?'}</S.Avatar>
        <div>
          <S.HeadName>{peerName}</S.HeadName>
          <S.HeadStatus $online={chat.peerOnline}>
            {chat.peerOnline ? 'Onlayn' : 'Oflayn'}
          </S.HeadStatus>
        </div>
      </S.Head>

      <S.Body ref={bodyRef} onScroll={onScroll}>
        {chat.loadingOlder && <S.LoadingOlder>Eski xabarlar yuklanmoqda…</S.LoadingOlder>}
        {chat.loading && chat.messages.length === 0 && <S.Notice>Yuklanmoqda…</S.Notice>}
        {chat.error && <S.ErrorNotice>{chat.error}</S.ErrorNotice>}
        {!chat.loading && !chat.error && chat.messages.length === 0 && (
          <S.Notice>Hali xabar yo‘q. Birinchi xabarni yozing.</S.Notice>
        )}
        {groups.map((g) => (
          <div key={g.date}>
            <S.DateLabel>{g.date}</S.DateLabel>
            {g.items.map((msg) => {
              const mine = msg.senderId === myId;
              return (
                <S.Row key={msg.id} $mine={mine}>
                  {!mine && <S.MsgAvatar>{peerName.charAt(0) || '?'}</S.MsgAvatar>}
                  <S.Bubble $mine={mine}>
                    {msg.text && <S.Text>{msg.text}</S.Text>}
                    {msg.fileUrl && (
                      <S.FileChip
                        href={msg.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        $mine={mine}
                      >
                        <MdAttachFile /> {msg.fileName || 'Biriktirilgan fayl'}
                      </S.FileChip>
                    )}
                    <S.Meta>
                      <S.Time>{formatTime(msg.timestamp)}</S.Time>
                      {mine &&
                        (msg.read ? (
                          <MdDoneAll style={{ color: 'var(--brand-primary)', fontSize: 14 }} />
                        ) : (
                          <MdDone style={{ color: '#BDC3C7', fontSize: 14 }} />
                        ))}
                    </S.Meta>
                  </S.Bubble>
                </S.Row>
              );
            })}
          </div>
        ))}
      </S.Body>

      <S.PillDock>
        {newBelow && (
          <S.NewBelowPill type="button" onClick={jumpToBottom}>
            ↓ Yangi xabar
          </S.NewBelowPill>
        )}
      </S.PillDock>

      <S.Composer>
        <S.InputWrap>
          <Textarea
            value={draft}
            onChange={setDraft}
            placeholder="Xabar yozing…"
            rows={1}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
          />
        </S.InputWrap>
        <S.SendBtn type="button" onClick={() => void submit()} disabled={!draft.trim() || chat.sending}>
          <MdSend />
        </S.SendBtn>
      </S.Composer>
    </S.Wrap>
  );
}
