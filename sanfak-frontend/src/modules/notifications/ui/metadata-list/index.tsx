import { useState, type ReactNode } from 'react';
import { CopyOutlined } from '@ant-design/icons';
import { Collapse } from 'antd';
import dayjs from 'dayjs';
import { useTranslation } from '@/shared/lib/i18n';
import { Button, Typography } from '@/shared/ui';
import type { MetaFieldDescriptor, MetaFieldFormat } from '../../model/types';
import { readableFallback } from '../../lib/readable-fallback';
import { ArrayList, FieldRow, IdWrap, List, ObjectPre, Wrap } from './style';

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

function truncateMiddle(value: string, head = 6, tail = 4): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

function IdValue({ value }: { value: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const onCopy = () => {
    if (!navigator.clipboard?.writeText) return;
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <IdWrap>
      <Typography.Text code title={value}>
        {truncateMiddle(value)}
      </Typography.Text>
      <Button
        type="text"
        size="small"
        icon={<CopyOutlined />}
        aria-label={t('notif.copy', { defaultValue: 'Nusxa olish' })}
        onClick={onCopy}
      />
      {copied ? (
        <Typography.Text type="success" style={{ fontSize: 11 }}>
          ✓
        </Typography.Text>
      ) : null}
    </IdWrap>
  );
}

function ArrayValue({ items }: { items: unknown[] }) {
  const { t } = useTranslation();
  return (
    <Collapse
      expandIconPosition="end"
      items={[
        {
          key: 'array',
          label: t('notif.meta.arrayCount', { defaultValue: `${items.length} ta`, count: items.length }),
          children: (
            <ArrayList>
              {items.map((item, index) => (
                <li key={index}>{renderMetaValue(item)}</li>
              ))}
            </ArrayList>
          ),
        },
      ]}
    />
  );
}

function ObjectValue({ value }: { value: object }) {
  return <ObjectPre>{JSON.stringify(value, null, 2)}</ObjectPre>;
}

function renderMetaValue(value: unknown, fmt?: MetaFieldFormat): ReactNode {
  if (value === null || value === undefined || value === '') return null;
  if (Array.isArray(value)) return <ArrayValue items={value} />;
  if (typeof value === 'object') return <ObjectValue value={value} />;
  if (fmt === 'id' || (typeof value === 'string' && OBJECT_ID_RE.test(value))) {
    return <IdValue value={String(value)} />;
  }
  if (fmt === 'date') {
    const parsed = dayjs(value as string | number);
    return <span>{parsed.isValid() ? parsed.format('DD.MM.YYYY HH:mm') : String(value)}</span>;
  }
  return <span>{String(value)}</span>;
}

export interface MetadataListProps {
  metadata: Record<string, unknown> | null;
  metaFields?: MetaFieldDescriptor[];
  className?: string;
}

export default function MetadataList({ metadata, metaFields, className }: MetadataListProps) {
  const { t } = useTranslation();

  if (!metadata) return null;

  const declaredKeys = new Set((metaFields ?? []).map((field) => field.key));
  const knownEntries = (metaFields ?? [])
    .map((field) => ({ ...field, value: metadata[field.key] }))
    .filter((field) => field.value !== null && field.value !== undefined && field.value !== '');
  const unknownEntries = Object.entries(metadata).filter(
    ([key, value]) => !declaredKeys.has(key) && value !== null && value !== undefined && value !== '',
  );

  if (knownEntries.length === 0 && unknownEntries.length === 0) return null;

  return (
    <Wrap className={className}>
      {knownEntries.length > 0 ? (
        <List>
          {knownEntries.map((field) => (
            <FieldRow key={field.key}>
              <Typography.Text type="secondary">
                {t(field.labelKey, { defaultValue: readableFallback(field.labelKey) })}
              </Typography.Text>
              <span>{renderMetaValue(field.value, field.fmt)}</span>
            </FieldRow>
          ))}
        </List>
      ) : null}

      {unknownEntries.length > 0 ? (
        <Collapse
          expandIconPosition="end"
          items={[
            {
              key: 'tech',
              label: t('notif.tech', { defaultValue: "Texnik ma'lumot" }),
              children: (
                <List>
                  {unknownEntries.map(([key, value]) => (
                    <FieldRow key={key}>
                      <Typography.Text code>{key}</Typography.Text>
                      <span>{renderMetaValue(value)}</span>
                    </FieldRow>
                  ))}
                </List>
              ),
            },
          ]}
        />
      ) : null}
    </Wrap>
  );
}
