import { Button, Empty, InputNumber, Select, Space, Tag, Tooltip, Typography } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useTranslation } from '@/shared/lib/i18n';
import { MAX_STREAMS, type ContingentGroup, type StreamDraft } from '../../model/types';
import { deriveCounts, nextStreamNumber, streamLanguageIds } from '../../model/invariants';

const { Text } = Typography;

interface IProps {
  streams: StreamDraft[];
  options: ContingentGroup[];
  groupsById: ReadonlyMap<string, ContingentGroup>;
  languageTitles: ReadonlyMap<string, string>;
  onChange: (streams: StreamDraft[]) => void;
}

const StreamEditor = ({ streams, options, groupsById, languageTitles, onChange }: IProps) => {
  const { t } = useTranslation();

  const update = (index: number, patch: Partial<StreamDraft>) =>
    onChange(streams.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  const remove = (index: number) => onChange(streams.filter((_, i) => i !== index));
  const add = () => onChange([...streams, { number: nextStreamNumber(streams), groupIds: [] }]);

  const groupLabel = (g: ContingentGroup) => {
    const lang = g.langId ? languageTitles.get(g.langId) : undefined;
    const parts = [g.title || g.id, lang, t('studyLoad.deptContingent.studentsShort', { count: g.studentNumber })];
    const label = parts.filter(Boolean).join(' · ');
    if (g.missing) return `${label} — ${t('studyLoad.deptContingent.group.missing')}`;
    if (g.inactive) return `${label} — ${t('studyLoad.deptContingent.group.inactive')}`;
    return label;
  };

  return (
    <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
      {streams.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('studyLoad.deptContingent.stream.empty')} />
      ) : null}
      {streams.map((stream, index) => {
        const usedElsewhere = new Set(streams.filter((_, i) => i !== index).flatMap((s) => s.groupIds));
        const counts = deriveCounts([stream], groupsById);
        const langs = streamLanguageIds(stream, groupsById);
        const langNames = langs.map((id) => languageTitles.get(id)).filter((x): x is string => Boolean(x));
        const numberLabel = t('studyLoad.deptContingent.stream.number');
        return (
          <div
            key={index}
            style={{
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3)',
              display: 'grid',
              gap: 'var(--space-2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <Text strong>{numberLabel}</Text>
              <InputNumber
                size="small"
                min={1}
                max={MAX_STREAMS}
                precision={0}
                value={stream.number}
                onChange={(v) => update(index, { number: typeof v === 'number' ? v : 0 })}
                aria-label={numberLabel}
                style={{ width: 72 }}
              />
              <Space size={4} wrap style={{ flex: 1 }}>
                {langNames.map((name) => (
                  <Tag key={name}>{name}</Tag>
                ))}
                {langs.length > 1 ? <Tag color="warning">{t('studyLoad.deptContingent.stream.mixedLanguages')}</Tag> : null}
              </Space>
              <Tooltip title={t('studyLoad.deptContingent.stream.remove')}>
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => remove(index)}
                  aria-label={t('studyLoad.deptContingent.stream.remove')}
                />
              </Tooltip>
            </div>
            <Select
              mode="multiple"
              style={{ width: '100%' }}
              value={stream.groupIds}
              onChange={(ids: string[]) => update(index, { groupIds: ids })}
              placeholder={t('studyLoad.deptContingent.stream.groupsPlaceholder')}
              options={options.map((g) => ({
                value: g.id,
                label: groupLabel(g),
                disabled: usedElsewhere.has(g.id),
              }))}
              optionFilterProp="label"
              status={stream.groupIds.length === 0 ? 'error' : undefined}
              aria-label={t('studyLoad.deptContingent.stream.groups')}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('studyLoad.deptContingent.stream.counts', {
                groups: counts.groupCount,
                students: counts.studentCount,
              })}
            </Text>
          </div>
        );
      })}
      <div>
        <Button icon={<PlusOutlined />} onClick={add} disabled={streams.length >= MAX_STREAMS}>
          {t('studyLoad.deptContingent.stream.add')}
        </Button>
      </div>
    </div>
  );
};

export default StreamEditor;
