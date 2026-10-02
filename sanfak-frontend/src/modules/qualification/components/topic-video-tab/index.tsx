import { useEffect, useState } from 'react';
import { DeleteOutlined, PlayCircleOutlined, SaveOutlined } from '@ant-design/icons';
import { App, Button, Flex, Input, Spin, Typography } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { Can } from '@/app/session';
import { useTranslation } from '@/shared/lib/i18n';
import { useConfirm } from '../../lib/use-confirm';
import {
  useCreateVideo,
  useDeleteVideo,
  useUpdateVideo,
  useVideos,
} from '../../api/topic-material-api';
import FileUploadZone from '../file-upload-zone';

const { Text } = Typography;
const VIDEO_ACCEPT = 'video/*';
const fileName = (url: string) => ((url.split('/').pop() ?? url).split('?')[0] ?? url).replace(/^\d+-/, '');

interface IProps {
  courseId: string;
  topicId: string;
}

export default function TopicVideoTab({ courseId, topicId }: IProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { confirmDelete } = useConfirm();

  const { data = [], isLoading } = useVideos(courseId, topicId);
  const create = useCreateVideo();
  const update = useUpdateVideo();
  const remove = useDeleteVideo();

  const current = data[0];
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(current?.title ?? '');
    setFile(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, current?.id]);

  const submit = async () => {
    if (!title.trim() || (!current && !file)) {
      message.warning(t('qualification.materials.fileRequired'));
      return;
    }
    setSaving(true);
    try {
      if (current) {
        await update.mutateAsync({ id: current.id, title: title.trim(), videoRaw: file ?? undefined });
      } else if (file) {
        await create.mutateAsync({
          course: courseId,
          topic: topicId,
          title: title.trim(),
          videoRaw: file,
        });
      }
      message.success(t('qualification.materials.saved'));
    } catch (e) {
      message.error(getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    if (!current) return;
    confirmDelete(
      async () => {
        try {
          await remove.mutateAsync(current.id);
          setTitle('');
          setFile(null);
          message.success(t('qualification.materials.deleted'));
        } catch (e) {
          message.error(getApiErrorMessage(e));
        }
      },
      {
        title: 'qualification.materials.deleteTitle',
        content: 'qualification.materials.deleteConfirm',
      },
    );
  };

  if (isLoading) {
    return (
      <Flex justify="center" style={{ padding: '32px 0' }}>
        <Spin />
      </Flex>
    );
  }

  return (
    <Flex vertical gap={12}>
      <Input
        placeholder={t('qualification.materials.titlePh')}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <div>
        <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>
          {t('qualification.materials.videoLabel')}
        </Text>
        <FileUploadZone
          dropText={t('qualification.materials.dropHint')}
          hint=".mp4"
          maxText={t('qualification.materials.maxSize', { mb: 200 })}
          accept={VIDEO_ACCEPT}
          value={
            file?.name ??
            current?.fileName ??
            (current?.videoUrl ? fileName(current.videoUrl) : null)
          }
          onFileSelect={setFile}
        />
      </div>
      {current?.videoUrl ? (
        <Button
          type="link"
          icon={<PlayCircleOutlined />}
          onClick={() => window.open(current.videoUrl, '_blank', 'noopener,noreferrer')}
          style={{ padding: 0, alignSelf: 'flex-start', color: 'var(--brand-primary, #37cb94)' }}
        >
          {t('qualification.materials.currentFile')}
        </Button>
      ) : null}

      <Flex justify="flex-end" gap={8}>
        {current ? (
          <Can perform="qualTopicVideo:delete">
            <Button danger icon={<DeleteOutlined />} onClick={onDelete}>
              {t('qualification.materials.deleteTitle')}
            </Button>
          </Can>
        ) : null}
        <Can perform="qualTopicVideo:create">
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={submit}>
            {t('qualification.materials.save')}
          </Button>
        </Can>
      </Flex>
    </Flex>
  );
}
