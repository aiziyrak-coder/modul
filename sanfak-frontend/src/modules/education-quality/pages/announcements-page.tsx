import { useState, useMemo, useCallback } from 'react';
import { Button, Input, Modal, Form, Tooltip, DatePicker, App as AntApp } from 'antd';
import {
  PlusOutlined, NotificationOutlined, DeleteOutlined,
  ExclamationCircleFilled, SearchOutlined,
} from '@ant-design/icons';
import { useTranslation } from '@/shared/lib/i18n';
import type { Announcement, AnnouncementInput } from '../model/types';
import {
  useAnnouncementList,
  useCreateAnnouncement,
  useDeleteAnnouncement,
} from '../api/education-quality-api';
import { usePermission } from '@/app/session/session-store';
import * as S from '../components/announcement-card/style';
import { useDebouncedSearch } from '../lib/use-debounced';

const { TextArea } = Input;
const { RangePicker } = DatePicker;

function formatDateTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('uz-UZ', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function AnnouncementsPage() {
  const { t } = useTranslation();
  const { message } = AntApp.useApp();
  const can = usePermission();

  const [search, setSearch] = useState('');
  const [range, setRange] = useState<[unknown, unknown] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [form] = Form.useForm<AnnouncementInput>();

  const debouncedSearch = useDebouncedSearch(search);

  const { data: announcements, isLoading } = useAnnouncementList(debouncedSearch || undefined);
  const createMut = useCreateAnnouncement();
  const deleteMut = useDeleteAnnouncement();

  const filtered = useMemo(() => {
    if (!announcements) return [];
    if (!range || (!range[0] && !range[1])) return announcements;
    return announcements.filter((a) => {
      const d = new Date(a.createdAt).getTime();
      const start = range[0] ? new Date(range[0] as string).setHours(0, 0, 0, 0) : null;
      const end = range[1] ? new Date(range[1] as string).setHours(23, 59, 59, 999) : null;
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });
  }, [announcements, range]);

  const hasActiveFilters = search.trim() !== '' || !!(range && (range[0] || range[1]));

  const handleCreate = useCallback(async () => {
    const values = await form.validateFields();
    createMut.mutate(values, {
      onSuccess: () => {
        message.success(t('educationQuality.announcements.created'));
        form.resetFields();
        setCreateOpen(false);
      },
    });
  }, [form, createMut, message, t]);

  const handleDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteMut.mutate(deleteTarget._id, {
      onSuccess: () => {
        message.success(t('educationQuality.announcements.deleted'));
        setDeleteTarget(null);
      },
    });
  }, [deleteTarget, deleteMut, message, t]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0 }}>{t('educationQuality.announcements.title')}</h2>
          <div style={{ color: 'var(--color-text-tertiary, #667085)', marginTop: 4 }}>
            {t('educationQuality.announcements.subtitle')}
          </div>
        </div>
        {can('eqAnnouncement:create') && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            {t('educationQuality.announcements.new')}
          </Button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <Input
          placeholder={t('educationQuality.announcements.searchPlaceholder')}
          prefix={<SearchOutlined />}
          style={{ width: 320 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
        />
        <RangePicker
          value={range as [null, null]}
          onChange={(v) => setRange(v as [unknown, unknown] | null)}
          format="DD.MM.YYYY"
          placeholder={[
            t('educationQuality.announcements.dateFrom'),
            t('educationQuality.announcements.dateTo'),
          ]}
        />
      </div>

      {isLoading ? null : filtered.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-quaternary, #98A2B3)' }}>
          {hasActiveFilters
            ? t('educationQuality.announcements.emptyFiltered')
            : t('educationQuality.announcements.empty')}
        </div>
      ) : (
        <S.CardList>
          {filtered.map((a) => (
            <S.Card key={a._id}>
              <S.IconBox>
                <NotificationOutlined />
              </S.IconBox>
              <div style={{ flex: 1 }}>
                <S.Title>{a.title}</S.Title>
                <S.Meta>
                  {a.author.lastName} {a.author.firstName} &middot; {formatDateTime(a.createdAt)}
                </S.Meta>
                <S.Body>{a.content}</S.Body>
              </div>
              {can('eqAnnouncement:delete') && (
                <Tooltip title={t('educationQuality.common.delete')}>
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => setDeleteTarget(a)}
                    style={{ flexShrink: 0, marginTop: 2 }}
                  />
                </Tooltip>
              )}
            </S.Card>
          ))}
        </S.CardList>
      )}

      <Modal
        open={createOpen}
        title={t('educationQuality.announcements.new')}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        okText={t('educationQuality.announcements.send')}
        cancelText={t('educationQuality.common.cancel')}
        confirmLoading={createMut.isPending}
        width={560}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="title"
            label={t('educationQuality.announcements.formTitle')}
            rules={[{ required: true, message: t('educationQuality.announcements.titleRequired') }]}
          >
            <Input placeholder={t('educationQuality.announcements.titlePlaceholder')} />
          </Form.Item>
          <Form.Item
            name="content"
            label={t('educationQuality.announcements.formContent')}
            rules={[{ required: true, message: t('educationQuality.announcements.contentRequired') }]}
          >
            <TextArea rows={5} placeholder={t('educationQuality.announcements.contentPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={!!deleteTarget}
        title={
          <span>
            <ExclamationCircleFilled style={{ color: 'var(--brand-error, #F04438)', marginRight: 8 }} />
            {t('educationQuality.announcements.deleteTitle')}
          </span>
        }
        onCancel={() => setDeleteTarget(null)}
        onOk={handleDelete}
        okText={t('educationQuality.common.delete')}
        cancelText={t('educationQuality.common.cancel')}
        okButtonProps={{ danger: true }}
        confirmLoading={deleteMut.isPending}
        centered
      >
        {deleteTarget && (
          <div style={{ fontSize: 14, lineHeight: 1.7 }}>
            <div>{t('educationQuality.announcements.deleteBody', { title: deleteTarget.title })}</div>
            <div style={{ color: 'var(--color-text-tertiary, #667085)', marginTop: 4 }}>
              {t('educationQuality.common.irreversible')}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
