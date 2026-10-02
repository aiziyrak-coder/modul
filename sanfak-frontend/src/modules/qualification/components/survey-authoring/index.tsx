import { useEffect, useRef, useState } from 'react';
import {
  CheckOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FileTextOutlined,
  HolderOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { Col, Radio, Row, Segmented, Tooltip } from 'antd';
import { App, Button, Card, Flex, Input, Spin, Typography, useModalStore } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { Can } from '@/app/session';
import { useTranslation } from '@/shared/lib/i18n';
import { SURVEY_TYPE } from '../../model/survey.types';
import type { SurveyQuestion, SurveyQuestionInput, SurveyType } from '../../model/survey.types';
import { useConfirm } from '../../lib/use-confirm';
import QualPagination from '../qual-pagination';
import { ScrollBox } from '../scroll-box';
import { docxToText } from '../../lib/docx-text';
import { parseSurveyText } from '../../lib/survey-import';

const { Text } = Typography;
const { TextArea } = Input;

const OPT_LABELS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
const SLOT_COUNT = 5;
const RATING_SCALE = [1, 2, 3, 4, 5];

interface QCard {
  key: string;
  id: string | null;
  question: string;
  type: SurveyType;
  required: boolean;
  opts: string[];
  editing: boolean;
}

interface Props {
  questions: SurveyQuestion[];
  isLoading: boolean;
  isFetching?: boolean;
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  createPerm: string;
  onCreate: (input: SurveyQuestionInput) => Promise<void>;
  onUpdate: (id: string, input: Partial<SurveyQuestionInput>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReorder?: (items: { _id: string; order: number }[]) => Promise<void>;
  onBulkCreate?: (items: SurveyQuestionInput[]) => Promise<void>;
}

const toCard = (q: SurveyQuestion): QCard => {
  const opts = q.options.map((o) => o.text);
  while (opts.length < SLOT_COUNT) opts.push('');
  return {
    key: q._id,
    id: q._id,
    question: q.question,
    type: q.type,
    required: q.required,
    opts,
    editing: false,
  };
};

function Preview({
  items,
  t,
}: {
  items: SurveyQuestion[];
  t: (k: string, o?: Record<string, unknown>) => string;
}) {
  if (!items.length) return <Text type="secondary">{t('qualification.survey.noQuestions')}</Text>;
  return (
    <ScrollBox $maxHeight="62vh">
      <Flex vertical gap={18} style={{ paddingRight: 4 }}>
      {items.map((q, i) => (
        <div key={q._id}>
          <Text strong>
            {i + 1}. {q.question}
          </Text>
          {q.required ? <Text type="danger"> *</Text> : null}
          <div style={{ marginTop: 8 }}>
            {q.type === SURVEY_TYPE.CHOICE ? (
              <Flex vertical gap={6}>
                {q.options.map((o, k) => (
                  <Radio key={k} disabled>
                    {o.text}
                  </Radio>
                ))}
              </Flex>
            ) : q.type === SURVEY_TYPE.RATING ? (
              <Flex gap={12}>
                {RATING_SCALE.map((n) => (
                  <Radio key={n} disabled>
                    {n}
                  </Radio>
                ))}
              </Flex>
            ) : (
              <TextArea rows={2} disabled placeholder={t('qualification.survey.textHint')} />
            )}
          </div>
          </div>
        ))}
      </Flex>
    </ScrollBox>
  );
}

export default function SurveyAuthoring({
  questions,
  isLoading,
  isFetching,
  page,
  limit,
  total,
  onPageChange,
  onPageSizeChange,
  createPerm,
  onCreate,
  onUpdate,
  onDelete,
  onReorder,
  onBulkCreate,
}: Props) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { confirmDelete } = useConfirm();
  const showModal = useModalStore((s) => s.showModal);

  const [cards, setCards] = useState<QCard[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCards((prev) => {
      const drafts = prev.filter((c) => c.id === null);
      return [...drafts, ...questions.map(toCard)];
    });
  }, [questions]);

  const patch = (key: string, fn: (c: QCard) => QCard) =>
    setCards((prev) => prev.map((c) => (c.key === key ? fn(c) : c)));

  const addCard = () => {
    if (page !== 1) onPageChange(1);
    setCards((prev) => [
      {
        key: `draft-${prev.length}-${prev.filter((c) => c.id === null).length}`,
        id: null,
        question: '',
        type: SURVEY_TYPE.CHOICE,
        required: true,
        opts: Array.from({ length: SLOT_COUNT }, () => ''),
        editing: true,
      },
      ...prev,
    ]);
  };

  const saveCard = async (c: QCard) => {
    const question = c.question.trim();
    const options = c.opts.map((o) => o.trim()).filter(Boolean);
    if (!question) return message.warning(t('qualification.survey.needQuestion'));
    if (c.type === SURVEY_TYPE.CHOICE && options.length < 2) {
      return message.warning(t('qualification.survey.needOptions'));
    }

    const input = {
      question,
      type: c.type,
      options: c.type === SURVEY_TYPE.CHOICE ? options.map((text) => ({ text })) : [],
      required: c.required,
    };

    setBusyKey(c.key);
    try {
      if (c.id) await onUpdate(c.id, input);
      else {
        const minOrder = questions.length
          ? Math.min(...questions.map((q) => q.order ?? 0))
          : 0;
        await onCreate({ ...input, order: questions.length ? minOrder - 1 : 0 });
      }
      patch(c.key, (cc) => ({ ...cc, editing: false }));
    } catch (err) {
      message.error(getApiErrorMessage(err));
    } finally {
      setBusyKey(null);
    }
  };

  const removeCard = (c: QCard) => {
    if (!c.id) {
      setCards((prev) => prev.filter((x) => x.key !== c.key));
      return;
    }
    confirmDelete(
      async () => {
        try {
          await onDelete(c.id as string);
        } catch (err) {
          message.error(getApiErrorMessage(err));
        }
      },
      { title: 'qualification.survey.deleteTitle' },
    );
  };

  const canReorder = Boolean(onReorder);

  const handleDrop = async (targetKey: string) => {
    setOverKey(null);
    if (!dragKey || dragKey === targetKey || !onReorder) return;
    const from = cards.findIndex((c) => c.key === dragKey);
    const to = cards.findIndex((c) => c.key === targetKey);
    if (from < 0 || to < 0) return;

    const next = [...cards];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    setCards(next);
    setDragKey(null);

    const base = (page - 1) * limit;
    const items = next
      .filter((c) => c.id)
      .map((c, i) => ({ _id: c.id as string, order: base + i }));
    try {
      await onReorder(items);
    } catch (err) {
      message.error(getApiErrorMessage(err));
    }
  };

  const importFile = async (file: File) => {
    if (!onBulkCreate) return;
    setImporting(true);
    try {
      const text = file.name.toLowerCase().endsWith('.docx')
        ? await docxToText(file)
        : await file.text();
      const parsed = parseSurveyText(text);
      if (!parsed.length) {
        message.warning(t('qualification.survey.importEmpty'));
        return;
      }
      await onBulkCreate(
        parsed.map((q, i) => ({
          question: q.question,
          type: q.type,
          options: q.options,
          required: true,
          order: questions.length + i,
        })),
      );
      message.success(t('qualification.survey.imported', { n: parsed.length }));
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      if (code === 'unsupported' || code === 'invalid') {
        message.error(t('qualification.survey.importBadFile'));
      } else {
        message.error(getApiErrorMessage(err));
      }
    } finally {
      setImporting(false);
    }
  };

  const typeOptions = [
    { value: SURVEY_TYPE.CHOICE, label: t('qualification.survey.typeChoice') },
    { value: SURVEY_TYPE.TEXT, label: t('qualification.survey.typeText') },
  ];

  const openPreview = () =>
    showModal({
      title: t('qualification.survey.previewTitle'),
      body: () => <Preview items={questions} t={t} />,
      maxWidth: '640px',
    });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <Card size="small" style={{ marginBottom: 'var(--space-4)', flexShrink: 0 }}>
        <Flex align="center" wrap="wrap" gap={12}>
          <Text strong>
            {t('qualification.survey.count', {
              n: total + cards.filter((c) => c.id === null).length,
            })}
          </Text>
          <div style={{ flex: 1 }} />
          {onBulkCreate && (
            <Can perform={createPerm}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,.txt,text/plain"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) void importFile(file);
                }}
                style={{ display: 'none' }}
              />
              <Button
                icon={<FileTextOutlined />}
                loading={importing}
                onClick={() => fileInputRef.current?.click()}
              >
                {t('qualification.survey.file')}
              </Button>
            </Can>
          )}
          <Button icon={<EyeOutlined />} onClick={openPreview}>
            {t('qualification.survey.preview')}
          </Button>
          <Can perform={createPerm}>
            <Button icon={<PlusOutlined />} onClick={addCard}>
              {t('qualification.survey.add')}
            </Button>
          </Can>
        </Flex>
      </Card>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: 'var(--space-6)' }}>
        <Spin spinning={Boolean(isLoading || isFetching)}>
          {cards.length === 0 && (isLoading || isFetching) ? (
            <div style={{ minHeight: 240 }} />
          ) : cards.length === 0 ? (
            <Card>
              <Flex vertical align="center" gap={16} style={{ padding: '40px 0' }}>
                <Text type="secondary">{t('qualification.survey.noQuestions')}</Text>
                <Can perform={createPerm}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={addCard}>
                    {t('qualification.survey.addFirst')}
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
                  onDrop={canReorder ? () => void handleDrop(c.key) : undefined}
                  style={{
                    borderRadius: 'var(--radius-lg)',
                    opacity: dragKey === c.key ? 0.45 : undefined,
                    outline:
                      canReorder && overKey === c.key && dragKey && dragKey !== c.key
                        ? '2px dashed var(--brand-primary)'
                        : undefined,
                    outlineOffset: 2,
                    transition: 'opacity 0.15s',
                  }}
                >
                  <Card>
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
                            title={t('qualification.survey.dragHint')}
                            style={{
                              cursor: 'grab',
                              color: 'var(--color-text-soft)',
                              fontSize: 18,
                              marginTop: 4,
                              flexShrink: 0,
                            }}
                          />
                        </Can>
                      )}

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Flex
                          align="center"
                          justify="space-between"
                          gap={8}
                          wrap
                          style={{ marginBottom: 14 }}
                        >
                          <Flex align="center" gap={10} wrap>
                            <Text strong>
                              {(page - 1) * limit + i + 1}-{t('qualification.survey.qword')}
                            </Text>
                            {c.type === SURVEY_TYPE.RATING ? (
                              <Text type="secondary">
                                {t('qualification.survey.typeRating')}
                              </Text>
                            ) : (
                              <Segmented
                                size="small"
                                value={c.type}
                                options={typeOptions}
                                onChange={(v) =>
                                  c.editing &&
                                  patch(c.key, (cc) => ({ ...cc, type: v as SurveyType }))
                                }
                                style={{ pointerEvents: c.editing ? undefined : 'none' }}
                              />
                            )}
                          </Flex>

                          <Can perform={createPerm}>
                            <Flex gap={6}>
                              {c.editing ? (
                                <Tooltip title={t('qualification.survey.saveCard')}>
                                  <Button
                                    type="primary"
                                    size="small"
                                    icon={<CheckOutlined />}
                                    loading={busyKey === c.key}
                                    aria-label={t('qualification.survey.saveCard')}
                                    onClick={() => void saveCard(c)}
                                    style={{ borderRadius: 'var(--radius-md)' }}
                                  />
                                </Tooltip>
                              ) : (
                                <Tooltip title={t('qualification.survey.editCard')}>
                                  <Button
                                    size="small"
                                    icon={<EditOutlined />}
                                    aria-label={t('qualification.survey.editCard')}
                                    onClick={() => patch(c.key, (cc) => ({ ...cc, editing: true }))}
                                    style={{ borderRadius: 'var(--radius-md)' }}
                                  />
                                </Tooltip>
                              )}
                              <Button
                                danger
                                size="small"
                                icon={<DeleteOutlined />}
                                aria-label={t('delete')}
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
                          placeholder={t('qualification.survey.questionPlaceholder')}
                          autoSize={{ minRows: 2 }}
                          maxLength={1000}
                          readOnly={!c.editing}
                          style={{ marginBottom: 14 }}
                        />

                        {c.type === SURVEY_TYPE.CHOICE ? (
                          <Row gutter={[12, 12]}>
                            {c.opts.map((o, j) => (
                              <Col xs={24} md={12} key={j}>
                                <Flex align="center" gap={8}>
                                  <Text type="secondary" style={{ width: 22 }}>
                                    {OPT_LABELS[j] ?? ''})
                                  </Text>
                                  <Input
                                    value={o}
                                    onChange={(e) =>
                                      patch(c.key, (cc) => {
                                        const opts = [...cc.opts];
                                        opts[j] = e.target.value;
                                        return { ...cc, opts };
                                      })
                                    }
                                    placeholder={t('qualification.survey.optionPlaceholder', {
                                      n: OPT_LABELS[j] ?? '',
                                    })}
                                    readOnly={!c.editing}
                                  />
                                </Flex>
                              </Col>
                            ))}
                          </Row>
                        ) : c.type === SURVEY_TYPE.RATING ? (
                          <Flex align="center" gap={16} wrap>
                            {RATING_SCALE.map((n) => (
                              <Radio key={n} disabled>
                                {n}
                              </Radio>
                            ))}
                            <Text type="secondary">{t('qualification.survey.ratingHint')}</Text>
                          </Flex>
                        ) : (
                          <TextArea rows={2} disabled placeholder={t('qualification.survey.textHint')} />
                        )}
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
        <div
          style={{
            flexShrink: 0,
            zIndex: 5,
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
      ) : null}
    </div>
  );
}
