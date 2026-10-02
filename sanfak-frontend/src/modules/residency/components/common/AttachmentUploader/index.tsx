import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { MdUpload, MdClose, MdCheckCircle, MdRefresh } from '../../../icons';
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_LIMITS,
  attachmentEmoji,
  fileExtension,
  formatFileSize,
  validateAttachmentFile,
} from '../../../api/announcement-types';
import type { Attachment } from '../../../api/announcement-types';
import {
  uploadAttachment,
  useInvalidateAnnouncements,
} from '../../../api/announcement-api';
import { getApiErrorMessage } from '@/shared/api';
import * as S from './style';

type ItemStatus = 'queued' | 'uploading' | 'done' | 'error' | 'canceled';

type RunOutcome = 'ok' | 'canceled' | 'failed';

interface QueueItem {
  key: string;
  file: File;
  status: ItemStatus;
  percent: number;
  error?: string;
  controller?: AbortController;
}

export interface UploadResult {
  ok: number;
  failed: number;
  canceled: number;
}

export interface AttachmentUploaderHandle {
  uploadPending: (announcementId: string) => Promise<UploadResult>;
  hasPending: () => boolean;
  reset: () => void;
}

interface Props {
  existing: Attachment[];
  announcementId?: string | null;
  onUploaded?: (attachments: Attachment[]) => void;
  disabled?: boolean;
}

let seq = 0;
const nextKey = () => {
  seq += 1;
  return `f${seq}`;
};

const AttachmentUploader = forwardRef<AttachmentUploaderHandle, Props>(
  function AttachmentUploader(
    { existing, announcementId = null, onUploaded, disabled = false },
    ref,
  ) {
    const [items, setItems] = useState<QueueItem[]>([]);
    const [dragging, setDragging] = useState(false);
    const [notice, setNotice] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const invalidateAnnouncements = useInvalidateAnnouncements();
    const itemsRef = useRef<QueueItem[]>([]);
    itemsRef.current = items;

    const patch = useCallback((key: string, next: Partial<QueueItem>) => {
      setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...next } : i)));
    }, []);

    const existingBytes = existing.reduce((sum, a) => sum + a.bytes, 0);

    const enqueue = useCallback(
      (picked: FileList | File[]) => {
        const problems: string[] = [];
        const accepted: QueueItem[] = [];

        const live = itemsRef.current.filter((i) => i.status !== 'done');
        let pendingBytes = live.reduce((sum, i) => sum + i.file.size, 0);
        let liveCount = existing.length + live.length;

        for (const file of Array.from(picked)) {
          const problem = validateAttachmentFile(file, {
            existingCount: liveCount,
            existingBytes,
            pendingBytes,
          });
          if (problem) {
            problems.push(problem);
            continue;
          }
          accepted.push({ key: nextKey(), file, status: 'queued', percent: 0 });
          pendingBytes += file.size;
          liveCount += 1;
        }

        if (accepted.length) setItems((prev) => [...prev, ...accepted]);
        setNotice(problems.join('; '));
      },
      [existing.length, existingBytes],
    );

    const openPicker = () => inputRef.current?.click();

    const onDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (disabled) return;
      if (e.dataTransfer.files?.length) enqueue(e.dataTransfer.files);
    };

    const runOne = useCallback(
      async (item: QueueItem, announcementId: string): Promise<RunOutcome> => {
        if (!navigator.onLine) {
          patch(item.key, {
            status: 'error',
            error: 'Internet aloqasi yo‘q — qayta urinib ko‘ring',
          });
          return 'failed';
        }

        const controller = new AbortController();
        patch(item.key, {
          status: 'uploading',
          percent: 0,
          error: undefined,
          controller,
        });

        try {
          const attachments = await uploadAttachment({
            announcementId,
            file: item.file,
            signal: controller.signal,
            onProgress: (percent) => patch(item.key, { percent }),
          });
          patch(item.key, { status: 'done', percent: 100, controller: undefined });
          onUploaded?.(attachments);
          invalidateAnnouncements();
          return 'ok';
        } catch (err) {
          const canceled =
            controller.signal.aborted ||
            (err instanceof Error && err.name === 'CanceledError');
          patch(item.key, {
            status: canceled ? 'canceled' : 'error',
            controller: undefined,
            error: canceled
              ? 'Bekor qilindi'
              : getApiErrorMessage(err, 'Yuklashda xatolik'),
          });
          return canceled ? 'canceled' : 'failed';
        }
      },
      [invalidateAnnouncements, onUploaded, patch],
    );

    useImperativeHandle(
      ref,
      () => ({
        hasPending: () =>
          itemsRef.current.some(
            (i) => i.status === 'queued' || i.status === 'error' || i.status === 'canceled',
          ),
        reset: () => {
          itemsRef.current.forEach((i) => i.controller?.abort());
          setItems([]);
          setNotice('');
        },
        uploadPending: async (announcementId: string) => {
          let ok = 0;
          let failed = 0;
          let canceled = 0;
          for (const item of itemsRef.current) {
            if (item.status === 'done') continue;
            const outcome = await runOne(item, announcementId);
            if (outcome === 'ok') ok += 1;
            else if (outcome === 'canceled') canceled += 1;
            else failed += 1;
          }
          return { ok, failed, canceled };
        },
      }),
      [runOne],
    );

    const retry = async (item: QueueItem) => {
      if (!announcementId) {
        patch(item.key, { status: 'queued', percent: 0, error: undefined });
        return;
      }
      await runOne(item, announcementId);
    };

    return (
      <div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ATTACHMENT_ACCEPT}
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files?.length) enqueue(e.target.files);
            e.target.value = '';
          }}
        />

        <S.Zone
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
          aria-label="Fayl biriktirish — bosing yoki fayllarni bu yerga tashlang"
          aria-describedby="attachment-hint"
          $dragging={dragging}
          $disabled={disabled}
          onClick={openPicker}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openPicker();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <MdUpload size={20} />
          <S.ZoneTitle>Fayllarni bu yerga tashlang yoki bosing</S.ZoneTitle>
          <S.ZoneHint id="attachment-hint">
            PDF · Word · Excel · PowerPoint · rasm · arxiv —{' '}
            {ATTACHMENT_LIMITS.maxFiles} tagacha, har biri{' '}
            {formatFileSize(ATTACHMENT_LIMITS.maxFileSize)} gacha
          </S.ZoneHint>
        </S.Zone>

        {notice && (
          <S.ErrorText role="alert" style={{ display: 'block', marginTop: 8 }}>
            {notice}
          </S.ErrorText>
        )}

        {items.length > 0 && (
          <S.List aria-label="Yuklanadigan fayllar">
            {items.map((item) => {
              const state =
                item.status === 'error' ? 'error' : item.status === 'done' ? 'done' : 'idle';
              const stopped = item.status === 'error' || item.status === 'canceled';
              return (
                <S.Row key={item.key} $state={state}>
                  <S.Emoji aria-hidden="true">
                    {attachmentEmoji(fileExtension(item.file.name))}
                  </S.Emoji>

                  <S.Info>
                    <S.Name title={item.file.name}>{item.file.name}</S.Name>

                    {item.status === 'uploading' ? (
                      <S.Track
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={item.percent}
                        aria-label={`${item.file.name} yuklanmoqda`}
                      >
                        <S.Bar $percent={item.percent} />
                      </S.Track>
                    ) : stopped ? (
                      <S.ErrorText>{item.error}</S.ErrorText>
                    ) : (
                      <S.Meta>
                        {formatFileSize(item.file.size)}
                        {item.status === 'done' && ' · yuklandi'}
                      </S.Meta>
                    )}
                  </S.Info>

                  {item.status === 'uploading' && (
                    <S.IconBtn
                      type="button"
                      title="Bekor qilish"
                      aria-label={`${item.file.name} — yuklashni bekor qilish`}
                      onClick={() => item.controller?.abort()}
                    >
                      <MdClose size={15} />
                    </S.IconBtn>
                  )}

                  {stopped && (
                    <S.IconBtn
                      type="button"
                      title="Qayta urinish"
                      aria-label={`${item.file.name} — qayta urinish`}
                      onClick={() => retry(item)}
                    >
                      <MdRefresh size={15} />
                    </S.IconBtn>
                  )}

                  {item.status === 'done' ? (
                    <S.DoneMark aria-label="Yuklandi">
                      <MdCheckCircle size={16} />
                    </S.DoneMark>
                  ) : (
                    <S.DangerIconBtn
                      type="button"
                      title="Ro‘yxatdan olib tashlash"
                      aria-label={`${item.file.name} — ro‘yxatdan olib tashlash`}
                      disabled={item.status === 'uploading'}
                      onClick={() => {
                        item.controller?.abort();
                        setItems((prev) => prev.filter((i) => i.key !== item.key));
                      }}
                    >
                      <MdClose size={15} />
                    </S.DangerIconBtn>
                  )}
                </S.Row>
              );
            })}
          </S.List>
        )}
      </div>
    );
  },
);

export default AttachmentUploader;
