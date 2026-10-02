import { useState, useMemo } from 'react';
import { Button, Input, Modal, DatePicker } from 'antd';
import {
  NotificationOutlined, ArrowRightOutlined, SearchOutlined,
} from '@ant-design/icons';
import { useTranslation } from '@/shared/lib/i18n';
import type { Announcement } from '../model/types';
import { useAnnouncementList } from '../api/education-quality-api';
import * as S from '../components/announcement-card/style';
import { useDebouncedSearch } from '../lib/use-debounced';

const { RangePicker } = DatePicker;

function formatDateTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('uz-UZ', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function TeacherAnnouncementsPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [range, setRange] = useState<[unknown, unknown] | null>(null);
  const [selected, setSelected] = useState<Announcement | null>(null);

  const debouncedSearch = useDebouncedSearch(search);

  const { data: announcements } = useAnnouncementList(debouncedSearch || undefined);

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

  const hasActiveFilters = !!(search.trim() || (range && (range[0] || range[1])));

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>{t('educationQuality.teacherAnnouncements.title')}</h2>
        <div style={{ color: 'var(--color-text-tertiary, #667085)', marginTop: 4 }}>
          {t('educationQuality.teacherAnnouncements.subtitle')}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <Input
          placeholder={t('educationQuality.teacherAnnouncements.searchPlaceholder')}
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
            t('educationQuality.teacherAnnouncements.dateFrom'),
            t('educationQuality.teacherAnnouncements.dateTo'),
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-quaternary, #98A2B3)' }}>
          {hasActiveFilters
            ? t('educationQuality.teacherAnnouncements.emptyFiltered')
            : t('educationQuality.teacherAnnouncements.empty')}
        </div>
      ) : (
        <S.CardList>
          {filtered.map((a) => (
            <S.Card key={a._id} style={{ cursor: 'pointer', borderLeft: '4px solid var(--brand-primary, #37cb94)' }} onClick={() => setSelected(a)}>
              <S.IconBox>
                <NotificationOutlined />
              </S.IconBox>
              <div style={{ flex: 1, minWidth: 0 }}>
                <S.Title>{a.title}</S.Title>
                <S.Meta>
                  {a.author.lastName} {a.author.firstName} &middot; {formatDateTime(a.createdAt)}
                </S.Meta>
                <S.Body style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>
                  {a.content}
                </S.Body>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setSelected(a); }}
                  style={{
                    marginTop: 10,
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: 'var(--brand-primary, #37cb94)',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {t('educationQuality.common.details')} <ArrowRightOutlined />
                </button>
              </div>
            </S.Card>
          ))}
        </S.CardList>
      )}

      <Modal
        open={!!selected}
        title={selected?.title}
        onCancel={() => setSelected(null)}
        centered
        footer={
          <Button type="primary" onClick={() => setSelected(null)}>
            {t('educationQuality.common.close')}
          </Button>
        }
      >
        {selected && (
          <div>
            <div style={{ color: 'var(--color-text-tertiary, #98A2B3)', fontSize: 13, marginBottom: 16 }}>
              {selected.author.lastName} {selected.author.firstName} &middot; {formatDateTime(selected.createdAt)}
            </div>
            <div style={{
              color: 'var(--color-text-secondary, #475467)',
              fontSize: 14,
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
            }}>
              {selected.content}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
