import { useCallback, useEffect, useLayoutEffect, useRef, useState, type UIEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import { Radio, Upload } from 'antd';
import {
  Alert,
  App,
  Avatar,
  Button,
  Checkbox,
  DatePicker,
  Empty,
  Modal,
  Space,
  Spin,
  Tag,
  Textarea,
  Tooltip,
} from '@/shared/ui';
import {
  ArrowDownOutlined,
  ArrowLeftOutlined,
  CalendarOutlined,
  CheckOutlined,
  CloseCircleOutlined,
  DownloadOutlined,
  EditOutlined,
  ExclamationCircleFilled,
  FileOutlined,
  MessageOutlined,
  PaperClipOutlined,
  RedoOutlined,
  SendOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd';
import type { RcFile } from 'antd/es/upload';
import dayjs from 'dayjs';
import { usePermission, useSessionStore } from '@/app/session';
import { getApiErrorMessage } from '@/shared/api';
import StatusBadge from '../status-badge';
import PriorityBadge from '../priority-badge';
import { fetchTaskDetail, loadOlderResponses } from '../../api/task-management-api';
import { useTaskActions } from '../../api/queries';
import { adaptResponse, type BackendResponse } from '../../api/mapper';
import { colors } from '../../lib/theme';
import { months } from '../../lib/constants';
import { RANGE_DISPLAY_FORMAT, displayToIso } from '../../lib/date-range';
import {
  ALLOWED_FILE_EXTS,
  ALLOWED_FILE_LABEL,
  MAX_FILE_MB,
} from '../../lib/file-rules';
import { getTaskSocket } from '../../lib/task-socket';
import type { Task } from '../../model/types';

const uzDate = (d: string): string => {
  const dt = dayjs(d);
  return `${dt.date()} ${months[dt.month()] ?? ''} ${dt.year()}`;
};

const STICK_BOTTOM_PX = 80;

const isAtBottom = (el: HTMLDivElement | null): boolean =>
  !el || el.scrollHeight - el.scrollTop - el.clientHeight <= STICK_BOTTOM_PX;

const PageWrap = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
`;
const TopBar = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 0 16px;
  flex-shrink: 0;
`;
const BackBtn = styled(Button)`
  border-radius: 8px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
`;
const TaskHeading = styled.div`
  flex: 1;
  min-width: 0;
`;
const TaskTitle = styled.h1`
  font-size: 18px;
  font-weight: 700;
  color: ${colors.textPrimary};
  margin: 0 0 4px;
  line-height: 1.3;
`;
const TaskMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;
const Columns = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: minmax(0, 1fr);
  gap: 20px;
  flex: 1;
  min-height: 460px;
  @media (max-width: 960px) {
    grid-template-columns: 1fr;
    grid-template-rows: auto;
    flex: none;
    min-height: auto;
  }
`;
const Card = styled.div`
  background: #fff;
  border: 1px solid ${colors.border};
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
`;
const SectionTitle = styled.div`
  font-size: 12px;
  font-weight: 700;
  color: ${colors.textSecondary};
  text-transform: uppercase;
  letter-spacing: 0.6px;
  margin-bottom: 12px;
`;
const MetaRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: ${colors.textPrimary};
  margin-bottom: 10px;
  .anticon {
    color: ${colors.textSecondary};
  }
`;
const Description = styled.div`
  font-size: 14px;
  color: ${colors.textPrimary};
  line-height: 1.7;
  background: ${colors.bgGray};
  padding: 14px;
  border-radius: 8px;
`;
const FileChip = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  background: ${colors.bgGray};
  border: 1px solid ${colors.border};
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
  &:hover {
    background: #f2f4f7;
  }
`;
const LeftCol = styled.div`
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
  &::-webkit-scrollbar {
    width: 5px;
  }
  &::-webkit-scrollbar-thumb {
    background: #d0d5dd;
    border-radius: 4px;
  }
  @media (max-width: 960px) {
    overflow: visible;
  }
`;
const RightCol = styled.div`
  min-height: 0;
  display: flex;
  flex-direction: column;
  @media (max-width: 960px) {
    height: 70vh;
  }
`;
const ResponsesCard = styled.div`
  background: #fff;
  border: 1px solid ${colors.border};
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
`;
const ResponsesHeader = styled.div`
  padding: 16px 20px 12px;
  border-bottom: 1px solid ${colors.border};
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
`;
const ResponsesBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  &::-webkit-scrollbar {
    width: 5px;
  }
  &::-webkit-scrollbar-thumb {
    background: #d0d5dd;
    border-radius: 4px;
  }
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
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: none;
  border-radius: 999px;
  background: ${colors.primary};
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(16, 24, 40, 0.22);
  transition: filter 0.15s, transform 0.15s;
  z-index: 2;
  &:hover {
    filter: brightness(0.94);
  }
  &:active {
    transform: translateX(-50%) scale(0.97);
  }
`;
const ResponseCard = styled.div<{ $self?: boolean; $rejected?: boolean; $deadline?: boolean }>`
  background: ${({ $self, $rejected, $deadline }) =>
    $deadline ? '#FFF7E6' : $rejected ? '#FFF2F0' : $self ? '#F0FDF4' : colors.bgGray};
  border: 1px solid ${({ $self, $rejected, $deadline }) =>
    $deadline ? '#FFD666' : $rejected ? '#FFCCC7' : $self ? '#BBF7D0' : colors.border};
  border-radius: 10px;
  padding: 12px 14px;
`;
const ResponseHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
`;
const RejectedNote = styled.div`
  background: #fff2f0;
  border: 1px solid #ffccc7;
  border-radius: 6px;
  padding: 8px 10px;
  margin-top: 8px;
  font-size: 12px;
  color: ${colors.danger};
`;
const ReplyBox = styled.div`
  border-top: 1px solid ${colors.border};
  padding: 16px;
  background: #fafafa;
  flex-shrink: 0;
`;

const fileTypeColors: Record<string, string> = {
  pdf: '#F04438',
  docx: '#1677ff',
  xlsx: colors.primary,
  jpg: '#FA8C16',
  png: '#FA8C16',
};


type CloseStatus = 'bajarildi' | 'bajarilmadi';

export default function TaskDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const can = usePermission();
  const user = useSessionStore((s) => s.user);
  const { addResponse, completeTask, reassignTask, resumeTask, extendDeadline } = useTaskActions();

  const [task, setTask] = useState<Task | null>(null);
  const [loadingTask, setLoadingTask] = useState(true);

  const bodyRef = useRef<HTMLDivElement>(null);
  const scrollBottomRef = useRef(true);
  const prevRespCountRef = useRef(0);
  const [newBelow, setNewBelow] = useState(false);
  const anchorRef = useRef<number | null>(null);
  const respPageRef = useRef(1);
  const hasMoreRef = useRef(false);
  const loadingRef = useRef(false);
  const sendingRef = useRef(false);

  const validateFileUpload = useCallback(
    (file: RcFile): boolean | typeof Upload.LIST_IGNORE => {
      if (!ALLOWED_FILE_EXTS.test(file.name)) {
        message.error(`${file.name}: ${ALLOWED_FILE_LABEL} formatlar qabul qilinadi`);
        return Upload.LIST_IGNORE;
      }
      if (file.size / 1024 / 1024 > MAX_FILE_MB) {
        message.error(`${file.name}: Hajm ${MAX_FILE_MB} MB dan oshmasligi kerak`);
        return Upload.LIST_IGNORE;
      }
      return false;
    },
    [message],
  );

  const loadReqRef = useRef(0);

  const loadTask = useCallback(async (opts?: { forceBottom?: boolean }) => {
    const reqId = ++loadReqRef.current;
    const wantBottom = opts?.forceBottom === true || isAtBottom(bodyRef.current);
    try {
      const t = await fetchTaskDetail(id);
      if (reqId !== loadReqRef.current) return;
      scrollBottomRef.current = wantBottom;
      setTask(t);
      respPageRef.current = t.responsesMeta?.page ?? 1;
      hasMoreRef.current = !!t.responsesMeta?.hasMore;
    } catch {
      if (reqId !== loadReqRef.current) return;
      setTask(null);
    } finally {
      if (reqId === loadReqRef.current) setLoadingTask(false);
    }
  }, [id]);

  useEffect(() => {
    setLoadingTask(true);
    void loadTask();
  }, [loadTask]);

  useEffect(() => {
    const socket = getTaskSocket();
    const onNewResponse = (payload: { taskId?: string; response?: BackendResponse }) => {
      if (!payload?.response || String(payload.taskId ?? '') !== id) return;
      const fresh = adaptResponse(payload.response);
      scrollBottomRef.current = isAtBottom(bodyRef.current);
      setTask((prev) => {
        if (!prev) return prev;
        if (prev.responses.some((r) => r.id === fresh.id)) return prev;
        return {
          ...prev,
          responses: [...prev.responses, fresh],
          responseCount: prev.responseCount + 1,
        };
      });
    };
    socket.on('taskResponse:new', onNewResponse);
    return () => {
      socket.off('taskResponse:new', onNewResponse);
    };
  }, [id]);

  useLayoutEffect(() => {
    const el = bodyRef.current;
    const count = task?.responses.length ?? 0;
    const lastIsMine = task?.responses[count - 1]?.userId === user?.id;
    const appended = count > prevRespCountRef.current && anchorRef.current == null;
    prevRespCountRef.current = count;
    if (!el) return;

    if (anchorRef.current != null) {
      el.scrollTop = el.scrollHeight - anchorRef.current;
      anchorRef.current = null;
      return;
    }
    if (scrollBottomRef.current) {
      el.scrollTop = el.scrollHeight;
      scrollBottomRef.current = false;
      setNewBelow(false);
    } else if (appended && !lastIsMine) {
      setNewBelow(true);
    }
  }, [task?.responses, user?.id]);

  const jumpToBottom = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    setNewBelow(false);
  }, []);

  const loadOlder = useCallback(async () => {
    const el = bodyRef.current;
    if (!el || loadingRef.current || !hasMoreRef.current) return;
    loadingRef.current = true;
    anchorRef.current = el.scrollHeight;
    scrollBottomRef.current = false;
    try {
      const nextPage = respPageRef.current + 1;
      const { responses, hasMore } = await loadOlderResponses(id, nextPage);
      respPageRef.current = nextPage;
      hasMoreRef.current = hasMore;
      setTask((prev) => {
        if (!prev) return prev;
        const seen = new Set(prev.responses.map((r) => r.id));
        const fresh = responses.filter((r) => !seen.has(r.id));
        return { ...prev, responses: [...fresh, ...prev.responses] };
      });
    } catch {
      anchorRef.current = null;
    } finally {
      loadingRef.current = false;
    }
  }, [id]);

  const onBodyScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop <= 60) void loadOlder();
    if (isAtBottom(el)) setNewBelow(false);
  };

  const [replyText, setReplyText] = useState('');
  const [replyFiles, setReplyFiles] = useState<UploadFile[]>([]);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [markCompleted, setMarkCompleted] = useState(false);
  const [sending, setSending] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [closeStatus, setCloseStatus] = useState<CloseStatus>('bajarildi');
  const [confirmReassign, setConfirmReassign] = useState(false);
  const [reassignReason, setReassignReason] = useState('');
  const [editDeadlineOpen, setEditDeadlineOpen] = useState(false);
  const [newDeadline, setNewDeadline] = useState<string | null>(null);

  if (loadingTask) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }
  if (!task) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Empty description="Topshiriq topilmadi" />
        <Button style={{ marginTop: 16 }} onClick={() => navigate(-1)}>
          Orqaga
        </Button>
      </div>
    );
  }

  const isManager = can('task:export');
  const isTaskCreator = !!task.createdBy.id && task.createdBy.id === user?.id;
  const showCreatorView = isManager || isTaskCreator;
  const canRespond = can('task:update');

  const isOverdue = dayjs(task.deadline).isBefore(dayjs(), 'day');
  const daysLeft = dayjs(task.deadline).startOf('day').diff(dayjs().startOf('day'), 'day');
  const taskClosed = ['bajarildi', 'bajarilmadi'].includes(task.status);
  const isRejected = task.status === 'rad etildi';
  const canComplete = showCreatorView && !taskClosed;

  const singleAssignee = task.assignees[0];
  const creatorThread = task.responses.filter((r) => r.userId === singleAssignee?.id || r.isComment);
  const xodimThread = task.responses.filter((r) => r.userId === user?.id || r.isComment);

  const collectReplyFiles = (): File[] =>
    replyFiles.map((f) => f.originFileObj).filter((f): f is RcFile => !!f);

  const handleSend = async (asRejected = false, isComment = false) => {
    const text = replyText;
    if (asRejected) {
      if (!rejectReason.trim()) {
        message.error('Rad etish sababini kiriting');
        return;
      }
    } else if (!text.trim() && replyFiles.length === 0) {
      message.warning('Matn yoki fayl kiriting');
      return;
    }
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    try {
      await addResponse(task.id, {
        text: asRejected ? '' : text,
        rejectionReason: asRejected ? rejectReason : undefined,
        isRejected: asRejected,
        isCompleted: !asRejected && !isComment && markCompleted,
        files: collectReplyFiles(),
      });
      await loadTask({ forceBottom: true });
      setReplyText('');
      setReplyFiles([]);
      setMarkCompleted(false);
      setRejecting(false);
      setRejectReason('');
      if (asRejected) message.error({ content: 'Topshiriq rad etildi', icon: <CloseCircleOutlined /> });
      else if (isComment) message.success('Izoh yuborildi');
      else if (markCompleted) message.success("Javob yuborildi. Rahbar tasdig'ini kutmoqda...");
      else message.success('Javob yuborildi');
    } catch (e) {
      message.error(getApiErrorMessage(e, "Yuborishda xatolik. Qayta urinib ko'ring."));
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const handleResume = async () => {
    if (resuming) return;
    setResuming(true);
    try {
      await resumeTask(task.id);
      await loadTask();
      message.success('Topshiriq qayta jarayonga olindi');
    } catch (e) {
      message.error(getApiErrorMessage(e, "Qaytarib olishda xatolik. Qayta urinib ko'ring."));
    } finally {
      setResuming(false);
    }
  };

  const handleComplete = async () => {
    try {
      await completeTask(task.id, closeStatus);
      await loadTask();
      setConfirmComplete(false);
      if (closeStatus === 'bajarildi') message.success('Topshiriq bajarildi deb yakunlandi!');
      else message.warning('Topshiriq bajarilmadi deb yopildi.');
    } catch (e) {
      message.error(getApiErrorMessage(e, "Yakunlashda xatolik. Qayta urinib ko'ring."));
    }
  };

  const handleReassign = async () => {
    if (!reassignReason.trim()) {
      message.error('Qayta topshirish sababini kiriting');
      return;
    }
    try {
      await reassignTask(task.id, reassignReason.trim());
      await loadTask();
      setConfirmReassign(false);
      setReassignReason('');
      message.info('Topshiriq ijrochiga qayta topshirildi.');
    } catch (e) {
      message.error(getApiErrorMessage(e, "Qayta topshirishda xatolik. Qayta urinib ko'ring."));
    }
  };

  const handleSaveDeadline = async () => {
    if (!newDeadline) return;
    try {
      await extendDeadline(task.id, newDeadline);
      await loadTask();
      setEditDeadlineOpen(false);
      setNewDeadline(null);
      message.success('Muddat yangilandi, ijrochiga xabar yuborildi');
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Muddatni yangilashda xatolik.'));
    }
  };

  const canReassign = showCreatorView && ['jarayonda', 'kechikdi', 'tekshiruvda'].includes(task.status);
  const closeMeta =
    closeStatus === 'bajarildi'
      ? { color: colors.primary, text: 'Bajarildi deb yakunlash' }
      : { color: '#cf1322', text: 'Bajarilmadi deb yopish' };

  return (
    <PageWrap>
      <TopBar>
        <BackBtn icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
          Orqaga
        </BackBtn>
        <TaskHeading>
          <TaskTitle>{task.title}</TaskTitle>
          <TaskMeta>
            <Tag style={{ borderRadius: 6, fontWeight: 700, margin: 0 }}>{task.code || task.id}</Tag>
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            {task.category && <Tag style={{ borderRadius: 4, margin: 0 }}>{task.category}</Tag>}
          </TaskMeta>
        </TaskHeading>
        {canReassign && (
          <Button
            icon={<RedoOutlined />}
            onClick={() => {
              setReassignReason('');
              setConfirmReassign(true);
            }}
            style={{ borderColor: '#fa8c16', color: '#fa8c16', borderRadius: 8, height: 38 }}
          >
            Qayta topshirish
          </Button>
        )}
        {canComplete && (
          <Button
            type="primary"
            icon={<CheckOutlined />}
            onClick={() => {
              setCloseStatus('bajarildi');
              setConfirmComplete(true);
            }}
            style={{ background: colors.primary, borderColor: colors.primary, borderRadius: 8, height: 38 }}
          >
            Yakunlash
          </Button>
        )}
      </TopBar>

      <Columns>
        <LeftCol>
          <Card>
            <SectionTitle>Umumiy ma'lumot</SectionTitle>
            <MetaRow>
              <UserOutlined />
              <span style={{ color: colors.textSecondary }}>Yaratdi:</span>
              <Avatar size={22} style={{ background: '#1677ff', fontSize: 12 }}>
                {task.createdBy.name.charAt(0)}
              </Avatar>
              <strong>{task.createdBy.name}</strong>
              {task.createdBy.position && (
                <span style={{ fontSize: 12, color: colors.textSecondary }}>— {task.createdBy.position}</span>
              )}
            </MetaRow>

            <MetaRow>
              <CalendarOutlined />
              <span style={{ color: colors.textSecondary }}>Muddat:</span>
              <strong style={{ color: isOverdue ? colors.danger : colors.textPrimary }}>
                {uzDate(task.deadline)}
              </strong>
              {isOverdue ? (
                <Tag color="error" style={{ borderRadius: 4, margin: 0 }}>
                  {Math.abs(daysLeft)} kun kechikdi
                </Tag>
              ) : daysLeft === 0 ? (
                <Tag color="warning" style={{ borderRadius: 4, margin: 0 }}>
                  Bugun tugaydi
                </Tag>
              ) : daysLeft <= 3 ? (
                <Tag color="warning" style={{ borderRadius: 4, margin: 0 }}>
                  {daysLeft} kun qoldi
                </Tag>
              ) : (
                <Tag color="success" style={{ borderRadius: 4, margin: 0 }}>
                  {daysLeft} kun qoldi
                </Tag>
              )}
              {showCreatorView && !taskClosed && (
                <Tooltip title="Muddatni o'zgartirish">
                  <Button
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => {
                      setNewDeadline(dayjs(task.deadline).format('YYYY-MM-DD'));
                      setEditDeadlineOpen(true);
                    }}
                    style={{ borderRadius: 6, marginLeft: 4 }}
                  />
                </Tooltip>
              )}
            </MetaRow>

            <MetaRow>
              <CalendarOutlined />
              <span style={{ color: colors.textSecondary }}>Yaratildi:</span>
              <span>{dayjs(task.createdAt).format('DD.MM.YYYY HH:mm')}</span>
            </MetaRow>
          </Card>

          {task.description && (
            <Card>
              <SectionTitle>Tavsif</SectionTitle>
              <Description>{task.description}</Description>
            </Card>
          )}

          {task.attachments.length > 0 && (
            <Card>
              <SectionTitle>Biriktirilgan fayllar ({task.attachments.length})</SectionTitle>
              {task.attachments.map((f, i) => (
                <FileChip key={i} onClick={() => f.url && window.open(f.url, '_blank')}>
                  <FileOutlined style={{ color: fileTypeColors[f.type ?? ''] ?? colors.textSecondary, fontSize: 20 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{f.name}</div>
                    <div style={{ fontSize: 12, color: colors.textSecondary }}>{f.size}</div>
                  </div>
                  <DownloadOutlined style={{ color: colors.textSecondary }} />
                </FileChip>
              ))}
            </Card>
          )}
        </LeftCol>

        <RightCol>
          <ResponsesCard>
            {showCreatorView ? (
              <>
                <ResponsesHeader>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>
                      Yozishmalar
                      {singleAssignee && (
                        <span style={{ fontWeight: 400, color: colors.textSecondary, fontSize: 13 }}>
                          {' '}
                          — {singleAssignee.name}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                      {creatorThread.length} ta xabar
                    </div>
                  </div>
                  {taskClosed && (
                    <Tag color={task.status === 'bajarildi' ? 'success' : 'error'} style={{ borderRadius: 6 }}>
                      {task.status === 'bajarildi' ? '✓ Tasdiqlangan' : '✗ Yopilgan'}
                    </Tag>
                  )}
                </ResponsesHeader>

                <ResponsesBody ref={bodyRef} onScroll={onBodyScroll}>
                  {creatorThread.length === 0 && (
                    <Empty description="Hali xabar yo'q" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: '20px 0' }} />
                  )}
                  {creatorThread.map((r) => (
                    <ResponseCard key={r.id} $self={r.isComment && !r.isDeadlineChange} $rejected={r.isRejected} $deadline={r.isDeadlineChange}>
                      <ResponseHeader>
                        <Avatar
                          size={28}
                          style={{
                            background: r.isDeadlineChange
                              ? '#FA8C16'
                              : r.isReassign
                                ? '#FA8C16'
                                : r.isComment
                                  ? '#1677ff'
                                  : r.isRejected
                                    ? colors.danger
                                    : r.isCompleted
                                      ? '#722ed1'
                                      : colors.primary,
                            fontSize: 12,
                            flexShrink: 0,
                          }}
                        >
                          {r.user.name.charAt(0)}
                        </Avatar>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{r.user.name}</div>
                          <div style={{ fontSize: 12, color: colors.textSecondary }}>{dayjs(r.createdAt).format('DD.MM HH:mm')}</div>
                        </div>
                        {r.isDeadlineChange ? (
                          <Tag color="gold" style={{ borderRadius: 4, fontSize: 12 }}>📅 Muddat o'zgardi</Tag>
                        ) : r.isReassign ? (
                          <Tag color="orange" style={{ borderRadius: 4, fontSize: 12 }}>↻ Qayta topshirildi</Tag>
                        ) : r.isRejected ? (
                          <Tag color="error" style={{ borderRadius: 4, fontSize: 12 }}>Rad etdi</Tag>
                        ) : r.isComment ? (
                          <Tag color="blue" style={{ borderRadius: 4, fontSize: 12 }}>Izoh</Tag>
                        ) : r.isCompleted ? (
                          <Tag color="purple" style={{ borderRadius: 4, fontSize: 12 }}>Bajarildi ✓</Tag>
                        ) : (
                          <Tag color="default" style={{ borderRadius: 4, fontSize: 12 }}>Javob</Tag>
                        )}
                      </ResponseHeader>
                      {r.text && <div style={{ fontSize: 13, color: colors.textPrimary, lineHeight: 1.6 }}>{r.text}</div>}
                      {r.isRejected && r.rejectionReason && (
                        <RejectedNote>
                          <strong>Sabab:</strong> {r.rejectionReason}
                        </RejectedNote>
                      )}
                      {r.attachments.map((f, i) => (
                        <FileChip key={i} style={{ marginTop: 8, cursor: f.url ? 'pointer' : 'default' }} onClick={() => f.url && window.open(f.url, '_blank')}>
                          <FileOutlined style={{ color: fileTypeColors[f.type ?? ''] ?? colors.textSecondary }} />
                          <span style={{ flex: 1, fontSize: 12 }}>{f.name}</span>
                          <span style={{ fontSize: 12, color: colors.textSecondary }}>{f.size}</span>
                        </FileChip>
                      ))}
                    </ResponseCard>
                  ))}
                </ResponsesBody>

                <PillDock>
                  {newBelow && (
                    <NewBelowPill type="button" onClick={jumpToBottom}>
                      <ArrowDownOutlined /> Yangi xabar
                    </NewBelowPill>
                  )}
                </PillDock>

                {taskClosed ? (
                  <ReplyBox>
                    <Alert
                      message={task.status === 'bajarildi' ? 'Topshiriq bajarildi va yopilgan' : 'Topshiriq yopilgan'}
                      type={task.status === 'bajarildi' ? 'success' : 'error'}
                      showIcon
                      style={{ borderRadius: 8 }}
                    />
                  </ReplyBox>
                ) : (
                  canRespond && (
                    <ReplyBox>
                      <div style={{ fontSize: 12, fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
                        <MessageOutlined style={{ marginRight: 6 }} />
                        Izoh yozish
                      </div>
                      <Textarea
                        placeholder="Ijrochiga izoh yozing..."
                        rows={2}
                        value={replyText}
                        onChange={(v) => setReplyText(v)}
                        style={{ borderRadius: 8, marginBottom: 10 }}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Upload fileList={replyFiles} onChange={({ fileList }) => setReplyFiles(fileList)} beforeUpload={validateFileUpload} multiple>
                          <Button icon={<PaperClipOutlined />} size="small" style={{ borderRadius: 6 }}>
                            Fayl
                          </Button>
                        </Upload>
                        <Button
                          type="primary"
                          icon={<SendOutlined />}
                          loading={sending}
                          disabled={!replyText.trim() && replyFiles.length === 0}
                          onClick={() => handleSend(false, true)}
                          style={{ marginLeft: 'auto', borderRadius: 8 }}
                        >
                          Yuborish
                        </Button>
                      </div>
                    </ReplyBox>
                  )
                )}
              </>
            ) : (
              <>
                <ResponsesHeader>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>Javoblar</div>
                    <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{xodimThread.length} ta xabar</div>
                  </div>
                </ResponsesHeader>

                <ResponsesBody ref={bodyRef} onScroll={onBodyScroll}>
                  {xodimThread.length === 0 && (
                    <Empty description="Hali javob yo'q" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: '20px 0' }} />
                  )}
                  {xodimThread.map((r) => (
                    <ResponseCard key={r.id} $self={r.userId === user?.id} $rejected={r.isRejected} $deadline={r.isReassign || r.isDeadlineChange}>
                      <ResponseHeader>
                        <Avatar
                          size={28}
                          style={{
                            background: r.isDeadlineChange
                              ? '#FA8C16'
                              : r.isReassign
                                ? '#FA8C16'
                                : r.isRejected
                                  ? colors.danger
                                  : r.isCompleted
                                    ? '#722ed1'
                                    : r.isComment
                                      ? '#1677ff'
                                      : colors.primary,
                            fontSize: 12,
                          }}
                        >
                          {r.user.name.charAt(0)}
                        </Avatar>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{r.user.name}</div>
                          <div style={{ fontSize: 12, color: colors.textSecondary }}>{dayjs(r.createdAt).format('DD.MM.YYYY HH:mm')}</div>
                        </div>
                        {r.isDeadlineChange ? (
                          <Tag color="gold" style={{ borderRadius: 4, fontSize: 12 }}>📅 Muddat o'zgardi</Tag>
                        ) : r.isReassign ? (
                          <Tag color="orange" style={{ borderRadius: 4, fontSize: 12 }}>↻ Qayta topshirildi</Tag>
                        ) : r.isRejected ? (
                          <Tag color="error" style={{ borderRadius: 4, fontSize: 12 }}>Rad etdi</Tag>
                        ) : r.isCompleted ? (
                          <Tag color="purple" style={{ borderRadius: 4, fontSize: 12 }}>Bajarildi ✓</Tag>
                        ) : r.isComment ? (
                          <Tag color="blue" style={{ borderRadius: 4, fontSize: 12 }}>Rahbar izohi</Tag>
                        ) : (
                          <Tag color="default" style={{ borderRadius: 4, fontSize: 12 }}>Javob</Tag>
                        )}
                      </ResponseHeader>
                      {r.text && <div style={{ fontSize: 13, lineHeight: 1.6 }}>{r.text}</div>}
                      {r.isRejected && r.rejectionReason && (
                        <RejectedNote>
                          <strong>Sabab:</strong> {r.rejectionReason}
                        </RejectedNote>
                      )}
                      {r.attachments.map((f, i) => (
                        <FileChip key={i} style={{ marginTop: 8, cursor: f.url ? 'pointer' : 'default' }} onClick={() => f.url && window.open(f.url, '_blank')}>
                          <FileOutlined style={{ color: fileTypeColors[f.type ?? ''] ?? colors.textSecondary }} />
                          <span style={{ flex: 1, fontSize: 12 }}>{f.name}</span>
                          <span style={{ fontSize: 12, color: colors.textSecondary }}>{f.size}</span>
                        </FileChip>
                      ))}
                    </ResponseCard>
                  ))}
                </ResponsesBody>

                <PillDock>
                  {newBelow && (
                    <NewBelowPill type="button" onClick={jumpToBottom}>
                      <ArrowDownOutlined /> Yangi xabar
                    </NewBelowPill>
                  )}
                </PillDock>

                <ReplyBox>
                  {taskClosed ? (
                    <Alert message="Topshiriq yakunlangan" type="info" showIcon style={{ borderRadius: 8 }} />
                  ) : !canRespond ? (
                    <Alert message="Javob berish uchun ruxsat yo'q" type="info" showIcon style={{ borderRadius: 8 }} />
                  ) : rejecting ? (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 700, color: colors.danger, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
                        Rad etish sababi
                      </div>
                      <Textarea placeholder="Rad etish sababini kiriting..." rows={3} value={rejectReason} onChange={(v) => setRejectReason(v)} style={{ borderRadius: 8, marginBottom: 10 }} />
                      <Space>
                        <Button onClick={() => setRejecting(false)} style={{ borderRadius: 8 }}>
                          Orqaga
                        </Button>
                        <Button danger loading={sending} onClick={() => handleSend(true)} style={{ borderRadius: 8 }} icon={<CloseCircleOutlined />}>
                          Tasdiqlash
                        </Button>
                      </Space>
                    </>
                  ) : (
                    <>
                      {isRejected && (
                        <Alert
                          type="warning"
                          showIcon
                          message="Siz bu topshiriqni rad etgansiz"
                          description="Rahbar bilan yozishishingiz mumkin (holat o'zgarmaydi). Ishni bajarishga qaror qilsangiz — &laquo;Bajaraman&raquo; tugmasi bilan topshiriqni qayta jarayonga oling."
                          style={{ borderRadius: 8, marginBottom: 12 }}
                        />
                      )}
                      <div style={{ fontSize: 12, fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
                        Javob berish
                      </div>
                      <Textarea
                        placeholder={isRejected ? 'Rahbarga javob yozing...' : 'Javobingizni yozing...'}
                        rows={3}
                        value={replyText}
                        onChange={(v) => setReplyText(v)}
                        style={{ borderRadius: 8, marginBottom: 10 }}
                      />
                      {!isRejected && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            background: markCompleted ? '#f0fdf4' : '#f9fafb',
                            border: `1.5px solid ${markCompleted ? '#86efac' : colors.border}`,
                            borderRadius: 8,
                            padding: '10px 14px',
                            marginBottom: 12,
                            cursor: 'pointer',
                          }}
                          onClick={() => setMarkCompleted(!markCompleted)}
                        >
                          <Checkbox checked={markCompleted} />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: markCompleted ? colors.primary : colors.textPrimary }}>Bajarildi deb belgilash</div>
                            <div style={{ fontSize: 12, color: colors.textSecondary }}>Rahbar tasdig'idan so'ng yakunlanadi</div>
                          </div>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, marginTop: isRejected ? 4 : 0 }}>
                        <Upload fileList={replyFiles} onChange={({ fileList }) => setReplyFiles(fileList)} beforeUpload={validateFileUpload} multiple>
                          <Button icon={<PaperClipOutlined />} size="small" style={{ borderRadius: 6 }}>
                            Fayl
                          </Button>
                        </Upload>
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                          {isRejected ? (
                            <Button type="primary" icon={<RedoOutlined />} loading={resuming} onClick={handleResume} style={{ borderRadius: 8 }}>
                              Bajaraman
                            </Button>
                          ) : (
                            <Button danger icon={<CloseCircleOutlined />} onClick={() => setRejecting(true)} style={{ borderRadius: 8 }}>
                              Rad etish
                            </Button>
                          )}
                          <Button
                            type={isRejected ? 'default' : 'primary'}
                            icon={<CheckOutlined />}
                            loading={sending}
                            disabled={!replyText.trim() && replyFiles.length === 0}
                            onClick={() => handleSend(false, false)}
                            style={{ borderRadius: 8 }}
                          >
                            {markCompleted ? 'Bajarildi deb yuborish' : 'Yuborish'}
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </ReplyBox>
              </>
            )}
          </ResponsesCard>
        </RightCol>
      </Columns>

      <Modal
        open={confirmComplete}
        onCancel={() => setConfirmComplete(false)}
        onOk={handleComplete}
        okText={closeMeta.text}
        cancelText="Bekor qilish"
        okButtonProps={{ style: { background: closeMeta.color, borderColor: closeMeta.color, borderRadius: 8 } }}
        cancelButtonProps={{ style: { borderRadius: 8 } }}
        width={440}
        centered
        closable={false}
        styles={{ body: { padding: '24px 24px 8px' } }}
      >
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <ExclamationCircleFilled style={{ fontSize: 24, color: closeMeta.color, marginTop: 2, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#101828', marginBottom: 8 }}>Topshiriqni yakunlash</div>
            <div style={{ fontSize: 13, color: '#667085', marginBottom: 14 }}>
              <strong style={{ color: '#101828' }}>&quot;{task.title}&quot;</strong> — qanday holda yopasiz?
            </div>
            <Radio.Group value={closeStatus} onChange={(e) => setCloseStatus(e.target.value)} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Radio value="bajarildi" style={{ padding: '10px 14px', border: `1.5px solid ${closeStatus === 'bajarildi' ? colors.primary : colors.border}`, borderRadius: 8, background: closeStatus === 'bajarildi' ? '#f0fdf4' : '#fff', fontSize: 13 }}>
                <span style={{ fontWeight: 600, color: colors.primary }}>✓ Bajarildi</span>
                <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>Ish qoniqarli — topshiriq muvaffaqiyatli yakunlandi</div>
              </Radio>
              <Radio value="bajarilmadi" style={{ padding: '10px 14px', border: `1.5px solid ${closeStatus === 'bajarilmadi' ? '#cf1322' : colors.border}`, borderRadius: 8, background: closeStatus === 'bajarilmadi' ? '#fff1f0' : '#fff', fontSize: 13 }}>
                <span style={{ fontWeight: 600, color: '#cf1322' }}>✗ Bajarilmadi</span>
                <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>Topshiriq bajarilmadi — butunlay yopiladi</div>
              </Radio>
            </Radio.Group>
          </div>
        </div>
      </Modal>

      <Modal
        open={confirmReassign}
        onCancel={() => {
          setConfirmReassign(false);
          setReassignReason('');
        }}
        onOk={handleReassign}
        okText="Qayta topshirish"
        cancelText="Bekor qilish"
        okButtonProps={{ disabled: !reassignReason.trim(), style: { ...(reassignReason.trim() ? { background: '#fa8c16', borderColor: '#fa8c16' } : {}), borderRadius: 8 } }}
        cancelButtonProps={{ style: { borderRadius: 8 } }}
        width={440}
        centered
        closable={false}
        styles={{ body: { padding: '24px 24px 8px' } }}
      >
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <RedoOutlined style={{ fontSize: 22, color: '#fa8c16', marginTop: 2, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#101828', marginBottom: 6 }}>Ijrochiga qayta topshirish</div>
            <div style={{ fontSize: 14, color: '#667085', lineHeight: 1.6, marginBottom: 14 }}>
              <strong style={{ color: '#101828' }}>&quot;{task.title}&quot;</strong> topshirig&apos;i
              <strong style={{ color: '#fa8c16' }}> jarayonda</strong> holatiga qaytariladi. Ijrochiga sababini yozing:
            </div>
            <Textarea placeholder="Nima uchun qayta topshirilyapti?" rows={3} value={reassignReason} onChange={(v) => setReassignReason(v)} style={{ borderRadius: 8 }} autoFocus />
          </div>
        </div>
      </Modal>

      <Modal
        open={editDeadlineOpen}
        onCancel={() => {
          setEditDeadlineOpen(false);
          setNewDeadline(null);
        }}
        onOk={handleSaveDeadline}
        okText="Saqlash"
        cancelText="Bekor qilish"
        okButtonProps={{ disabled: !newDeadline, style: { borderRadius: 8 } }}
        cancelButtonProps={{ style: { borderRadius: 8 } }}
        width={380}
        centered
        title={
          <span>
            <EditOutlined style={{ marginRight: 8, color: colors.primary }} />
            Muddatni o&apos;zgartirish
          </span>
        }
      >
        <div style={{ padding: '16px 0 8px' }}>
          <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 10 }}>
            Joriy muddat: <strong>{uzDate(task.deadline)}</strong>
          </div>
          <DatePicker
            value={newDeadline}
            format={RANGE_DISPLAY_FORMAT}
            onChange={(val) => setNewDeadline(displayToIso(val))}
            style={{ width: '100%', borderRadius: 8 }}
            disabledDate={(d) => !!d && d < dayjs().startOf('day')}
            placeholder="Yangi muddatni tanlang"
          />
        </div>
      </Modal>
    </PageWrap>
  );
}
