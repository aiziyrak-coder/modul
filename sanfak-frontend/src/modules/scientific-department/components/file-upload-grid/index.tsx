import { Upload } from 'antd';
import { CheckCircleFilled, CloseCircleOutlined, UploadOutlined } from '@ant-design/icons';
import FileTypeIcon from '../file-type-icon';
import { useTranslation } from '@/shared/lib/i18n';
import type { FileSlotConfig } from '../../model/types';
import { SlotCell, SlotGrid } from './style';

const GROUP_KEYS: Record<'main' | 'review', string> = {
  main: 'scientificDepartment.fileGroups.main',
  review: 'scientificDepartment.fileGroups.review',
};

function SlotBox({
  cfg,
  file,
  existingUrl,
  onPick,
  onClear,
}: {
  cfg: FileSlotConfig;
  file: File | undefined;
  existingUrl: string | undefined;
  onPick: (f: File) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  const filledName = file?.name || (existingUrl ? t('scientificDepartment.articles.existingPdf') : null);

  return (
    <SlotCell>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <FileTypeIcon name={cfg.format} size={14} />
        <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--color-text)' }}>
          {cfg.label ?? t(`scientificDepartment.${cfg.labelKey}`)}
        </span>
        <span
          style={{
            fontSize: 10.5,
            color: 'var(--color-text-mute)',
            background: 'var(--color-bg-elevate)',
            borderRadius: 4,
            padding: '1px 5px',
          }}
        >
          {cfg.format}
        </span>
      </div>
      <Upload
        accept={cfg.accept}
        maxCount={1}
        showUploadList={false}
        beforeUpload={(f) => {
          onPick(f as unknown as File);
          return false;
        }}
      >
        <div
          style={{
            height: 38,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '0 10px',
            borderRadius: 'var(--radius-md)',
            border: filledName
              ? '1px solid color-mix(in srgb, var(--brand-primary) 40%, #fff)'
              : '1px dashed var(--color-border)',
            background: filledName ? 'var(--brand-primary-soft)' : '#fff',
            cursor: 'pointer',
            minWidth: 0,
            width: '100%',
          }}
        >
          {filledName ? (
            <>
              <CheckCircleFilled style={{ color: 'var(--brand-primary)', fontSize: 14 }} />
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--color-text)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                }}
              >
                {filledName}
              </span>
              {file ? (
                <CloseCircleOutlined
                  style={{ color: 'var(--color-text-mute)', fontSize: 13 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onClear();
                  }}
                />
              ) : null}
            </>
          ) : (
            <>
              <UploadOutlined style={{ color: 'var(--brand-primary)', fontSize: 14 }} />
              <span style={{ fontSize: 12, color: 'var(--color-text-mute)' }}>
                {t('scientificDepartment.chooseFile')}
              </span>
            </>
          )}
        </div>
      </Upload>
    </SlotCell>
  );
}

export default function FileUploadGrid({
  slots,
  value,
  onChange,
  existingFiles,
}: {
  slots: FileSlotConfig[];
  value: Partial<Record<string, File>>;
  onChange: (next: Partial<Record<string, File>>) => void;
  existingFiles?: Partial<Record<string, string>>;
}) {
  const { t } = useTranslation();
  const groups: Array<'main' | 'review'> = ['main', 'review'];

  return (
    <div>
      {groups.map((group) => {
        const groupSlots = slots.filter((s) => s.group === group);
        if (!groupSlots.length) return null;
        return (
          <div key={group} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span
                style={{
                  width: 4,
                  height: 14,
                  borderRadius: 2,
                  background: 'var(--brand-primary)',
                  display: 'inline-block',
                }}
              />
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--color-text-soft)',
                  letterSpacing: 0.4,
                }}
              >
                {t(GROUP_KEYS[group])}
              </span>
            </div>
            <SlotGrid>
              {groupSlots.map((cfg) => (
                <SlotBox
                  key={cfg.slot}
                  cfg={cfg}
                  file={value[cfg.slot]}
                  existingUrl={existingFiles?.[cfg.slot]}
                  onPick={(f) => onChange({ ...value, [cfg.slot]: f })}
                  onClear={() => {
                    const next = { ...value };
                    delete next[cfg.slot];
                    onChange(next);
                  }}
                />
              ))}
            </SlotGrid>
          </div>
        );
      })}
    </div>
  );
}
