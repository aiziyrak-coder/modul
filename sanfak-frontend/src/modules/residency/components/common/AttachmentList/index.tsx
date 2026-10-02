import { useEffect, useState } from 'react';
import { App } from '@/shared/ui';
import { MdDownload, MdDelete, MdVisibility } from '../../../icons';
import Modal, { ModalBody } from '../Modal';
import {
  attachmentEmoji,
  isPreviewable,
} from '../../../api/announcement-types';
import type { Attachment } from '../../../api/announcement-types';
import {
  downloadAttachment,
  fetchAttachmentBlob,
} from '../../../api/announcement-api';
import { getApiErrorMessage } from '@/shared/api';
import * as S from './style';

interface Props {
  announcementId: string;
  attachments: Attachment[];
  canWrite?: boolean;
  onRemove?: (attachment: Attachment) => void;
  removing?: boolean;
}

export default function AttachmentList({
  announcementId,
  attachments,
  canWrite = false,
  onRemove,
  removing = false,
}: Props) {
  const { message } = App.useApp();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ attachment: Attachment; url: string } | null>(
    null,
  );

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );

  if (!attachments.length) {
    return <S.Empty>Biriktirilgan fayl yo‘q</S.Empty>;
  }

  const download = async (a: Attachment) => {
    setBusyId(a.id);
    try {
      await downloadAttachment(announcementId, a);
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Faylni yuklab olishda xatolik'));
    } finally {
      setBusyId(null);
    }
  };

  const openPreview = async (a: Attachment) => {
    setBusyId(a.id);
    try {
      const blob = await fetchAttachmentBlob(announcementId, a.id);
      setPreview({ attachment: a, url: URL.createObjectURL(blob) });
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Faylni ochishda xatolik'));
    } finally {
      setBusyId(null);
    }
  };

  const closePreview = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  return (
    <>
      <S.List aria-label="Biriktirilgan fayllar">
        {attachments.map((a) => (
          <S.Row key={a.id}>
            <S.Emoji aria-hidden="true">{attachmentEmoji(a.type)}</S.Emoji>

            <S.Info>
              <S.Name title={a.name}>{a.name}</S.Name>
              <S.Meta>
                {a.size}
                {a.uploadedByName && ` · ${a.uploadedByName}`}
              </S.Meta>
            </S.Info>

            {isPreviewable(a) && (
              <S.IconBtn
                type="button"
                title="Ko‘rish"
                aria-label={`${a.name} — ko‘rish`}
                disabled={busyId === a.id}
                onClick={() => openPreview(a)}
              >
                <MdVisibility size={15} />
              </S.IconBtn>
            )}

            <S.IconBtn
              type="button"
              title="Yuklab olish"
              aria-label={`${a.name} — yuklab olish`}
              disabled={busyId === a.id}
              onClick={() => download(a)}
            >
              <MdDownload size={15} />
            </S.IconBtn>

            {canWrite && onRemove && (
              <S.DangerIconBtn
                type="button"
                title="O‘chirish"
                aria-label={`${a.name} — o‘chirish`}
                disabled={removing || busyId === a.id}
                onClick={() => onRemove(a)}
              >
                <MdDelete size={15} />
              </S.DangerIconBtn>
            )}
          </S.Row>
        ))}
      </S.List>

      <Modal
        open={!!preview}
        onClose={closePreview}
        title={preview?.attachment.name ?? ''}
        width="720px"
      >
        <ModalBody>
          <S.PreviewBox>
            {preview && <img src={preview.url} alt={preview.attachment.name} />}
          </S.PreviewBox>
        </ModalBody>
      </Modal>
    </>
  );
}
