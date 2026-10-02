import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  AimOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  FileTextOutlined,
  HolderOutlined,
  PlusOutlined,
  RetweetOutlined,
  SaveOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { Checkbox, Col, ConfigProvider, InputNumber, Modal, Progress, Radio, Row, Switch, Tooltip } from 'antd';
import {
  App,
  Button,
  Card,
  Flex,
  Input,
  Spin,
  Tag,
  Typography,
  useModalStore,
} from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { Can } from '@/app/session';
import { useTranslation } from '@/shared/lib/i18n';
import { TEST_TYPE } from '../../model/access-test.types';
import type {
  AccessTestInput,
  AccessTestQuestion,
  ReorderItem,
  TestType,
} from '../../model/access-test.types';
import { useSaveTestConfig, useTestConfig } from '../../api/access-test-api';
import { useConfirm } from '../../lib/use-confirm';
import QualPagination from '../qual-pagination';
import { SAMPLE_TXT, downloadSampleTxt } from '../../lib/test-sample';

const { Text } = Typography;
const { TextArea } = Input;

const SPLIT_BLOCK = /\r?\n\r?\n/;
const SAMPLE_BOX: CSSProperties = {
  margin: 0,
  padding: '10px 12px',
  background: 'var(--color-bg-elevate)',
  border: '1px solid var(--color-border-soft)',
  borderRadius: 'var(--radius-md)',
  fontSize: 12,
  lineHeight: 1.5,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  whiteSpace: 'pre-wrap',
  color: 'var(--color-text-soft)',
};

const OPT_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const SLOT_COUNT = 5;

interface QOpt {
  text: string;
  isCorrect: boolean;
}
interface QCard {
  key: string;
  id: string | null;
  testType: TestType;
  question: string;
  opts: QOpt[];
  editing: boolean;
}

interface Props {
  courseId: string;
  kind: number;
  questions: AccessTestQuestion[];
  isLoading: boolean;
  isFetching?: boolean;
  page: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  createPerm: string;
  showConfig?: boolean;
  topic?: string;
  compact?: boolean;
  onCreate: (input: AccessTestInput) => Promise<string>;
  onBulkCreate?: (items: Omit<AccessTestInput, 'course'>[]) => Promise<void>;
  onFetchAll?: () => Promise<AccessTestQuestion[]>;
  onUpdate: (id: string, input: Omit<AccessTestInput, 'course'>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReorder?: (items: ReorderItem[]) => Promise<void>;
}

const toCard = (q: AccessTestQuestion): QCard => {
  const opts: QOpt[] = q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect }));
  while (opts.length < SLOT_COUNT) opts.push({ text: '', isCorrect: false });
  return {
    key: q.id,
    id: q.id,
    testType: q.testType,
    question: q.question,
    opts,
    editing: false,
  };
};

interface ParsedQuestion {
  testType: TestType;
  question: string;
  opts: QOpt[];
}

function parseImportTxt(text: string): ParsedQuestion[] {
  const blocks = text.replace(/\r\n?/g, '\n').split(/\n[ \t]*\n/);
  const out: ParsedQuestion[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    let question = '';
    const opts: QOpt[] = [];
    for (const line of lines) {
      if (line[0] === '+') opts.push({ text: line.slice(1).trim(), isCorrect: true });
      else if (line[0] === '-') opts.push({ text: line.slice(1).trim(), isCorrect: false });
      else if (!question) question = line;
    }
    const valid = opts.filter((o) => o.text);
    if (!question || valid.length < 2 || !valid.some((o) => o.isCorrect)) continue;
    const correctCount = valid.filter((o) => o.isCorrect).length;
    out.push({
      testType: correctCount > 1 ? TEST_TYPE.MULTI : TEST_TYPE.SINGLE,
      question,
      opts: valid,
    });
  }
  return out;
}

function fmtDuration(
  min: number,
  t: (k: string, o?: Record<string, unknown>) => string,
): string {
  if (min < 60) return '';
  if (min < 1440) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    const rest = m ? ` ${m} ${t('qualification.testAuthoring.minutes')}` : '';
    return `(${h} ${t('qualification.testAuthoring.unitHour')}${rest})`;
  }
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const rest = h ? ` ${h} ${t('qualification.testAuthoring.unitHour')}` : '';
  return `(${d} ${t('qualification.testAuthoring.unitDay')}${rest})`;
}

function PreviewAll({
  fetchAll,
  t,
}: {
  fetchAll: () => Promise<AccessTestQuestion[]>;
  t: (k: string) => string;
}) {
  const [items, setItems] = useState<AccessTestQuestion[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetchAll()
      .then((r) => alive && setItems(r))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [fetchAll]);
  if (items === null) {
    return (
      <Flex justify="center" style={{ padding: '32px 0' }}>
        <Spin />
      </Flex>
    );
  }
  if (items.length === 0) {
    return <Text type="secondary">{t('qualification.testAuthoring.empty')}</Text>;
  }
  return (
    <Flex
      vertical
      gap={18}
      style={{
        maxHeight: '65vh',
        overflowY: 'auto',
        paddingRight: 8,
        scrollbarWidth: 'thin',
        scrollbarColor: 'var(--color-border, #e3e8ef) transparent',
      }}
    >
      {items.map((q, i) => (
        <div key={q.id}>
          <Text strong style={{ display: 'block', marginBottom: 6 }}>
            {i + 1}. {q.question || '—'}
          </Text>
          <Flex vertical gap={4}>
            {q.options
              .filter((o) => o.text.trim())
              .map((o, j) => (
                <Text
                  key={j}
                  style={{
                    color: o.isCorrect ? 'var(--brand-primary, #37cb94)' : undefined,
                    fontWeight: o.isCorrect ? 600 : 400,
                  }}
                >
                  {OPT_LABELS[j] ?? ''}) {o.text}
                </Text>
              ))}
          </Flex>
        </div>
      ))}
    </Flex>
  );
}

export default function TestAuthoring({
  courseId,
  kind,
  questions,
  isLoading,
  isFetching,
  page,
  total,
  limit,
  onPageChange,
  onPageSizeChange,
  createPerm,
  showConfig = true,
  topic,
  compact = false,
  onCreate,
  onBulkCreate,
  onFetchAll,
  onUpdate,
  onDelete,
  onReorder,
}: Props) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { confirmDelete } = useConfirm();
  const showModal = useModalStore((s) => s.showModal);

  const { data: cfg } = useTestConfig(courseId, kind, showConfig, topic);
  const saveConfig = useSaveTestConfig();

  const [time, setTime] = useState(10);
  const [random, setRandom] = useState(10);
  const [pass, setPass] = useState(60);
  const [savedConfig, setSavedConfig] = useState({
    timeLimit: 10,
    randomCount: 10,
    passPercentage: 60,
  });
  const cfgSeeded = useRef(false);
  useEffect(() => {
    if (cfg && !cfgSeeded.current) {
      setTime(cfg.timeLimit);
      setRandom(cfg.randomCount);
      setPass(cfg.passPercentage);
      setSavedConfig({
        timeLimit: cfg.timeLimit,
        randomCount: cfg.randomCount,
        passPercentage: cfg.passPercentage,
      });
      cfgSeeded.current = true;
    }
  }, [cfg]);

  const showPass = showConfig && kind !== 1;

  const configDirty =
    (time || 0) !== savedConfig.timeLimit ||
    (random || 0) !== savedConfig.randomCount ||
    (showPass && (pass || 0) !== savedConfig.passPercentage);

  const [cards, setCards] = useState<QCard[]>([]);
  const seededKey = useRef<string | null>(null);
  const counter = useRef(0);
  useEffect(() => {
    const key = `${page}:${limit}`;
    if (!isLoading && seededKey.current !== key) {
      setCards(questions.map(toCard));
      seededKey.current = key;
    }
  }, [isLoading, page, limit, questions]);

  const [busyKey, setBusyKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileModal, setFileModal] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState<{ done: number; total: number } | null>(null);

  const canReorder = !!onReorder;
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);

  const handleDrop = (targetKey: string) => {
    const from = cards.findIndex((c) => c.key === dragKey);
    const to = cards.findIndex((c) => c.key === targetKey);
    setDragKey(null);
    setOverKey(null);
    if (from === -1 || to === -1 || from === to) return;
    const next = [...cards];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    setCards(next);
    if (!onReorder) return;
    const base = (page - 1) * limit;
    const items: ReorderItem[] = next
      .filter((c): c is QCard & { id: string } => c.id !== null)
      .map((c, idx) => ({ id: c.id, order: base + idx }));
    if (items.length) {
      onReorder(items).catch((e) => message.error(getApiErrorMessage(e)));
    }
  };

  const patch = (key: string, fn: (c: QCard) => QCard) =>
    setCards((cs) => cs.map((c) => (c.key === key ? fn(c) : c)));

  const addCard = () => {
    counter.current += 1;
    const key = `draft-${counter.current}`;
    setCards((cs) => [
      ...cs,
      {
        key,
        id: null,
        testType: TEST_TYPE.SINGLE,
        question: '',
        opts: Array.from({ length: SLOT_COUNT }, () => ({ text: '', isCorrect: false })),
        editing: true,
      },
    ]);
  };

  const startEdit = (key: string) => patch(key, (c) => ({ ...c, editing: true }));

  const setType = (key: string, multi: boolean) =>
    patch(key, (c) => {
      if (multi) return { ...c, testType: TEST_TYPE.MULTI };
      let kept = false;
      const opts = c.opts.map((o) => {
        if (o.isCorrect && !kept) {
          kept = true;
          return o;
        }
        return { ...o, isCorrect: false };
      });
      return { ...c, testType: TEST_TYPE.SINGLE, opts };
    });

  const toggleCorrect = (key: string, i: number) =>
    patch(key, (c) =>
      c.testType === TEST_TYPE.SINGLE
        ? { ...c, opts: c.opts.map((o, j) => ({ ...o, isCorrect: j === i })) }
        : {
            ...c,
            opts: c.opts.map((o, j) => (j === i ? { ...o, isCorrect: !o.isCorrect } : o)),
          },
    );

  const setOptText = (key: string, i: number, v: string) =>
    patch(key, (c) => ({
      ...c,
      opts: c.opts.map((o, j) => (j === i ? { ...o, text: v } : o)),
    }));

  const removeCard = (card: QCard) => {
    if (!card.id) {
      setCards((cs) => cs.filter((c) => c.key !== card.key));
      return;
    }
    const id = card.id;
    const wasLastOnPage = cards.length === 1;
    const hasDrafts = cards.some((c) => c.id === null);
    confirmDelete(
      async () => {
        try {
          await onDelete(id);
          setCards((cs) => cs.filter((c) => c.key !== card.key));
          message.success(t('qualification.testAuthoring.deleted'));
          if (wasLastOnPage && page > 1) {
            onPageChange(page - 1);
          } else if (!hasDrafts) {
            seededKey.current = null;
          }
        } catch (e) {
          message.error(getApiErrorMessage(e));
        }
      },
      {
        title: 'qualification.testAuthoring.deleteTitle',
        content: 'qualification.testAuthoring.deleteConfirm',
      },
    );
  };

  const saveCard = async (card: QCard) => {
    const question = card.question.trim();
    if (!question) {
      message.warning(t('qualification.testAuthoring.errNoQuestion'));
      return;
    }
    const opts = card.opts
      .map((o) => ({ text: o.text.trim(), isCorrect: o.isCorrect }))
      .filter((o) => o.text);
    if (opts.length < 2) {
      message.warning(t('qualification.testAuthoring.errMinTwo'));
      return;
    }
    if (!opts.some((o) => o.isCorrect)) {
      message.warning(t('qualification.testAuthoring.errNoCorrect'));
      return;
    }
    setBusyKey(card.key);
    try {
      if (card.id) {
        await onUpdate(card.id, { testType: card.testType, question, options: opts });
        patch(card.key, (c) => ({ ...c, editing: false }));
      } else {
        const newId = await onCreate({
          course: courseId,
          testType: card.testType,
          question,
          options: opts,
        });
        patch(card.key, (c) => ({ ...c, id: newId, editing: false }));
        setCards((cs) => cs.slice(0, limit));
      }
      message.success(t('qualification.testAuthoring.savedCard'));
    } catch (e) {
      message.error(getApiErrorMessage(e));
    } finally {
      setBusyKey(null);
    }
  };

  const importFile = async (file: File) => {
    if (!/\.txt$/i.test(file.name)) {
      message.warning(t('qualification.testAuthoring.fileWrongType'));
      return;
    }
    setFileModal(false);
    const parsed = parseImportTxt(await file.text());
    if (!parsed.length) {
      message.warning(t('qualification.testAuthoring.importEmpty'));
      return;
    }

    if (onBulkCreate) {
      setImporting({ done: 0, total: parsed.length });
      seededKey.current = null;
      try {
        await onBulkCreate(
          parsed.map((q) => ({ testType: q.testType, question: q.question, options: q.opts })),
        );
        message.success(t('qualification.testAuthoring.imported', { count: parsed.length }));
      } catch (err) {
        message.error(getApiErrorMessage(err));
      }
      setImporting(null);
      return;
    }

    setImporting({ done: 0, total: parsed.length });
    const created: QCard[] = [];
    let failed = 0;
    for (const [i, q] of parsed.entries()) {
      try {
        const id = await onCreate({
          course: courseId,
          testType: q.testType,
          question: q.question,
          options: q.opts,
        });
        const opts = [...q.opts];
        while (opts.length < SLOT_COUNT) opts.push({ text: '', isCorrect: false });
        created.push({ key: id, id, testType: q.testType, question: q.question, opts, editing: false });
      } catch {
        failed += 1;
      }
      setImporting({ done: i + 1, total: parsed.length });
    }
    setCards((cs) => [...cs, ...created].slice(0, limit));
    seededKey.current = null;
    setImporting(null);
    if (created.length) {
      message.success(t('qualification.testAuthoring.imported', { count: created.length }));
    }
    if (failed) {
      message.warning(t('qualification.testAuthoring.importSkipped', { count: failed }));
    }
  };

  const handleSaveConfig = async () => {
    try {
      await saveConfig.mutateAsync({
        course: courseId,
        kind,
        topic,
        timeLimit: time || 0,
        randomCount: random || 0,
        passPercentage: pass || 0,
      });
      message.success(t('qualification.testAuthoring.configSaved'));
      setSavedConfig({
        timeLimit: time || 0,
        randomCount: random || 0,
        passPercentage: pass || 0,
      });
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const openPreview = () =>
    showModal({
      title: t('qualification.testAuthoring.previewTitle'),
      maxWidth: '640px',
      body: onFetchAll
        ? () => <PreviewAll fetchAll={onFetchAll} t={t} />
        : () => (
        <Flex vertical gap={18}>
          {cards.length === 0 ? (
            <Text type="secondary">{t('qualification.testAuthoring.empty')}</Text>
          ) : (
            cards.map((c, i) => (
              <div key={c.key}>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>
                  {i + 1}. {c.question || '—'}
                </Text>
                <Flex vertical gap={4}>
                  {c.opts
                    .filter((o) => o.text.trim())
                    .map((o, j) => (
                      <Text
                        key={j}
                        style={{
                          color: o.isCorrect ? 'var(--brand-primary, #37cb94)' : undefined,
                          fontWeight: o.isCorrect ? 600 : 400,
                        }}
                      >
                        {OPT_LABELS[j] ?? ''}) {o.text}
                      </Text>
                    ))}
                </Flex>
              </div>
            ))
          )}
        </Flex>
      ),
    });

  return (
    <ConfigProvider
      theme={{
        components: {
          Button: { controlHeight: 40 },
          Input: { controlHeight: 40 },
          InputNumber: { controlHeight: 40 },
          Select: { controlHeight: 40 },
        },
        ...(compact ? { token: { fontSize: 12 } } : {}),
      }}
    >
      <div style={compact ? undefined : { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <Card size="small" style={{ marginBottom: 'var(--space-4)', flexShrink: 0 }}>
        <Flex align="center" wrap="wrap" gap={12}>
          <Text strong>
            {t('qualification.testAuthoring.total', {
              count: total + cards.filter((c) => c.id === null).length,
            })}
          </Text>

          {showConfig && (
            <Flex align="center" gap={6}>
              <RetweetOutlined style={{ color: 'var(--color-text-soft, #697586)' }} />
              <Text type="secondary">{t('qualification.testAuthoring.random')}</Text>
              <InputNumber
                min={0}
                value={random || null}
                placeholder={t('qualification.testAuthoring.randomAll')}
                onChange={(v) => setRandom(typeof v === 'number' ? v : 0)}
                style={{ width: 96 }}
              />
              <Text type="secondary">{t('qualification.testAuthoring.pcs')}</Text>
            </Flex>
          )}

          {showConfig && (
            <Flex align="center" gap={6}>
              <ClockCircleOutlined style={{ color: 'var(--color-text-soft, #697586)' }} />
              <Text type="secondary">{t('qualification.testAuthoring.time')}</Text>
              <InputNumber
                min={0}
                value={time}
                onChange={(v) => setTime(typeof v === 'number' ? v : 0)}
                style={{ width: 80 }}
              />
              <Text type="secondary">{t('qualification.testAuthoring.minutes')}</Text>
              {time >= 60 ? (
                <Text style={{ color: 'var(--brand-primary, #37cb94)' }}>
                  {fmtDuration(time, t)}
                </Text>
              ) : null}
            </Flex>
          )}

          {showPass && (
            <Flex align="center" gap={6}>
              <AimOutlined style={{ color: 'var(--color-text-soft, #697586)' }} />
              <Text type="secondary">{t('qualification.testAuthoring.pass')}</Text>
              <InputNumber
                min={0}
                max={100}
                value={pass}
                onChange={(v) => setPass(typeof v === 'number' ? v : 0)}
                style={{ width: 76 }}
              />
              <Text type="secondary">%</Text>
              <Tag color="green">{t('qualification.testAuthoring.passBadge', { p: pass })}</Tag>
            </Flex>
          )}

          <div style={{ flex: 1 }} />

          <Can perform={createPerm}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,text/plain"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void importFile(file);
              }}
              style={{ display: 'none' }}
            />
            <Button
              icon={<FileTextOutlined />}
              loading={!!importing}
              onClick={() => setFileModal(true)}
            >
              {t('qualification.testAuthoring.file')}
            </Button>
          </Can>
          <Button icon={<EyeOutlined />} onClick={openPreview}>
            {t('qualification.testAuthoring.preview')}
          </Button>
          <Can perform={createPerm}>
            <Button icon={<PlusOutlined />} onClick={addCard}>
              {t('qualification.testAuthoring.add')}
            </Button>
          </Can>
          {showConfig && (
            <Can perform={createPerm}>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={saveConfig.isPending}
                disabled={!configDirty}
                onClick={handleSaveConfig}
              >
                {t('qualification.testAuthoring.save')}
              </Button>
            </Can>
          )}
        </Flex>
      </Card>

      <div style={compact ? undefined : { flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: 'var(--space-6, 24px)' }}>
      <Spin spinning={!!isFetching || isLoading}>
      {cards.length === 0 && (isLoading || isFetching) ? (
        <div style={{ minHeight: 200 }} />
      ) : cards.length === 0 ? (
        <Card>
          <Flex vertical align="center" gap={16} style={{ padding: '40px 0' }}>
            <Text type="secondary">{t('qualification.testAuthoring.empty')}</Text>
            <Can perform={createPerm}>
              <Button type="primary" icon={<PlusOutlined />} onClick={addCard}>
                {t('qualification.testAuthoring.addFirst')}
              </Button>
            </Can>
          </Flex>
        </Card>
      ) : (
        <Flex vertical gap={16}>
          {cards.map((c, i) => (
            <div
              key={c.key}
              onDragOver={
                canReorder
                  ? (e) => {
                      e.preventDefault();
                      if (overKey !== c.key) setOverKey(c.key);
                    }
                  : undefined
              }
              onDragLeave={
                canReorder ? () => setOverKey((k) => (k === c.key ? null : k)) : undefined
              }
              onDrop={canReorder ? () => handleDrop(c.key) : undefined}
              style={{
                borderRadius: 'var(--radius-lg, 12px)',
                opacity: dragKey === c.key ? 0.45 : undefined,
                outline:
                  canReorder && overKey === c.key && dragKey && dragKey !== c.key
                    ? '2px dashed var(--brand-primary, #37cb94)'
                    : undefined,
                outlineOffset: 2,
                transition: 'opacity 0.15s',
              }}
            >
              <Card size={compact ? 'small' : undefined}>
                <Flex align="flex-start" gap={12}>
                  {canReorder && (
                    <Can perform={createPerm}>
                      <HolderOutlined
                        draggable
                        onDragStart={() => setDragKey(c.key)}
                        onDragEnd={() => {
                          setDragKey(null);
                          setOverKey(null);
                        }}
                        title={t('qualification.testAuthoring.dragHint')}
                        style={{
                          cursor: 'grab',
                          color: 'var(--color-text-soft, #697586)',
                          fontSize: 18,
                          marginTop: 4,
                          flexShrink: 0,
                        }}
                      />
                    </Can>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                  <Flex align="center" justify="space-between" gap={8} style={{ marginBottom: 14 }}>
                  <Flex align="center" gap={10}>
                    <Text strong>
                      {(page - 1) * limit + i + 1}-{t('qualification.testAuthoring.qword')}
                    </Text>
                  <Switch
                    size={compact ? 'small' : 'default'}
                    checked={c.testType === TEST_TYPE.MULTI}
                    onChange={(v) => {
                      if (c.editing) setType(c.key, v);
                    }}
                    style={{ pointerEvents: c.editing ? undefined : 'none' }}
                  />
                  <Text type="secondary">
                    {c.testType === TEST_TYPE.MULTI
                      ? t('qualification.testAuthoring.multi')
                      : t('qualification.testAuthoring.single')}
                  </Text>
                </Flex>
                <Can perform={createPerm}>
                  <Flex gap={6}>
                    {c.editing ? (
                      <Tooltip title={t('qualification.testAuthoring.saveCard')}>
                        <Button
                          type="primary"
                          size="small"
                          icon={<CheckOutlined />}
                          loading={busyKey === c.key}
                          onClick={() => saveCard(c)}
                          style={{ borderRadius: 'var(--radius-md)' }}
                        />
                      </Tooltip>
                    ) : (
                      <Tooltip title={t('qualification.testAuthoring.editCard')}>
                        <Button
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => startEdit(c.key)}
                          style={{ borderRadius: 'var(--radius-md)' }}
                        />
                      </Tooltip>
                    )}
                    <Button
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => removeCard(c)}
                      style={{ borderRadius: 'var(--radius-md)' }}
                    />
                  </Flex>
                </Can>
              </Flex>

              <TextArea
                value={c.question}
                onChange={(e) =>
                  patch(c.key, (cc) => ({ ...cc, question: e.target.value }))
                }
                placeholder={t('qualification.testAuthoring.questionPlaceholder')}
                autoSize={{ minRows: 2 }}
                readOnly={!c.editing}
                style={{ marginBottom: 14 }}
              />

              <Row gutter={[12, 12]} style={{ marginBottom: 8 }}>
                {c.opts.map((o, j) => (
                  <Col xs={24} md={12} key={j}>
                    <Flex align="center" gap={8}>
                      {c.testType === TEST_TYPE.MULTI ? (
                        <Checkbox
                          checked={o.isCorrect}
                          onChange={() => {
                            if (c.editing) toggleCorrect(c.key, j);
                          }}
                          style={{ pointerEvents: c.editing ? undefined : 'none' }}
                        />
                      ) : (
                        <Radio
                          checked={o.isCorrect}
                          onChange={() => {
                            if (c.editing) toggleCorrect(c.key, j);
                          }}
                          style={{ pointerEvents: c.editing ? undefined : 'none' }}
                        />
                      )}
                      <Text type="secondary" style={{ width: 22 }}>
                        {OPT_LABELS[j] ?? ''})
                      </Text>
                      <Input
                        value={o.text}
                        onChange={(e) => setOptText(c.key, j, e.target.value)}
                        placeholder={t('qualification.testAuthoring.optionPlaceholder', {
                          label: OPT_LABELS[j] ?? '',
                        })}
                        readOnly={!c.editing}
                      />
                    </Flex>
                  </Col>
                ))}
                </Row>
                  </div>
                </Flex>
              </Card>
            </div>
          ))}
        </Flex>
      )}
      </Spin>
      </div>

      {total > 0 ? (
        compact ? (
          <div style={{ marginTop: 12 }}>
            <QualPagination current={page} pageSize={limit} total={total} onChange={onPageChange} />
          </div>
        ) : (
          <div
            style={{
              flexShrink: 0,
              zIndex: 5,
              marginTop: 0,
              marginLeft: 'calc(-1 * var(--content-body-padding, 24px))',
              marginRight: 'calc(-1 * var(--content-body-padding, 24px))',
              marginBottom: 'calc(-1 * var(--content-body-padding, 24px))',
              padding: 'var(--space-4, 16px) var(--space-5, 20px)',
              background: 'var(--color-bg, #fff)',
              borderTop: '1px solid var(--color-border, #e3e8ef)',
              boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.04)',
            }}
          >
            <QualPagination
              current={page}
              pageSize={limit}
              total={total}
              onChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
            />
          </div>
        )
      ) : null}
      </div>

      <Modal
        open={fileModal}
        title={t('qualification.testAuthoring.fileModalTitle')}
        onCancel={() => setFileModal(false)}
        footer={null}
        centered
        width={460}
      >
        <Flex vertical gap={12} style={{ paddingTop: 2 }}>
          <pre style={SAMPLE_BOX}>{SAMPLE_TXT.split(SPLIT_BLOCK)[0]}</pre>

          <Flex align="center" justify="space-between" gap={12} wrap>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('qualification.testAuthoring.fileLegend')}
            </Text>
            <Button
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => downloadSampleTxt(t('qualification.testAuthoring.sampleFile'))}
            >
              {t('qualification.testAuthoring.sampleDownload')}
            </Button>
          </Flex>

          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void importFile(file);
            }}
            style={{
              border: `1px dashed ${dragOver ? 'var(--brand-primary)' : 'var(--color-border)'}`,
              background: dragOver
                ? 'color-mix(in srgb, var(--brand-primary) 6%, #fff)'
                : 'transparent',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              cursor: 'pointer',
              transition: 'border-color .15s, background .15s',
            }}
          >
            <Flex align="center" justify="center" gap={8}>
              <UploadOutlined style={{ fontSize: 16, color: 'var(--brand-primary)' }} />
              <Text style={{ fontSize: 13 }}>
                {t('qualification.testAuthoring.uploadPick')}
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                · .txt
              </Text>
            </Flex>
          </div>
        </Flex>
      </Modal>

      <Modal
        open={!!importing}
        title={t('qualification.testAuthoring.importTitle')}
        closable={false}
        maskClosable={false}
        keyboard={false}
        footer={null}
        centered
        width={420}
      >
        <Flex vertical gap={12} style={{ padding: '8px 0 4px' }}>
          <Text>{t('qualification.testAuthoring.importing')}</Text>
          <Progress
            percent={importing ? Math.round((importing.done / importing.total) * 100) : 0}
            status="active"
            strokeColor="var(--brand-primary, #37cb94)"
          />
          <Text type="secondary" style={{ textAlign: 'center' }}>
            {importing?.done ?? 0} / {importing?.total ?? 0}
          </Text>
        </Flex>
      </Modal>
    </ConfigProvider>
  );
}
