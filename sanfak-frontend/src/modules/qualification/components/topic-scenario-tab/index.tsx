import { useEffect, useState } from 'react';
import { DeleteOutlined, SaveOutlined } from '@ant-design/icons';
import { App, Button, Flex, Input, Spin } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { Can } from '@/app/session';
import { useTranslation } from '@/shared/lib/i18n';
import { useConfirm } from '../../lib/use-confirm';
import {
  useCreateScenario,
  useDeleteScenario,
  useScenarios,
  useUpdateScenario,
} from '../../api/topic-material-api';

const { TextArea } = Input;

interface IProps {
  courseId: string;
  topicId: string;
}

export default function TopicScenarioTab({ courseId, topicId }: IProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { confirmDelete } = useConfirm();

  const { data = [], isLoading } = useScenarios(courseId, topicId);
  const create = useCreateScenario();
  const update = useUpdateScenario();
  const remove = useDeleteScenario();

  const current = data[0];
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(current?.title ?? '');
    setText(current?.text ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, current?.id]);

  const submit = async () => {
    if (!title.trim() || !text.trim()) {
      message.warning(t('qualification.materials.required'));
      return;
    }
    setSaving(true);
    try {
      if (current) {
        await update.mutateAsync({ id: current.id, title: title.trim(), text: text.trim() });
      } else {
        await create.mutateAsync({
          course: courseId,
          topic: topicId,
          title: title.trim(),
          text: text.trim(),
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
          setText('');
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
      <TextArea
        placeholder={t('qualification.materials.textPh')}
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoSize={{ minRows: 6 }}
      />
      <Flex justify="flex-end" gap={8}>
        {current ? (
          <Can perform="qualTopicScenario:delete">
            <Button danger icon={<DeleteOutlined />} onClick={onDelete}>
              {t('qualification.materials.deleteTitle')}
            </Button>
          </Can>
        ) : null}
        <Can perform="qualTopicScenario:create">
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={submit}>
            {t('qualification.materials.save')}
          </Button>
        </Can>
      </Flex>
    </Flex>
  );
}
