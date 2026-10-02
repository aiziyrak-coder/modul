import { useState } from 'react';
import { Alert, Spin, Typography } from 'antd';
import { UserSwitchOutlined } from '@ant-design/icons';
import { App, ModalFooter, useModalStore } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import {
  useReassignmentSuggestions,
  useReassignVacancy,
  getApiErrorMessage,
} from '../../api/teacher-leave-api';
import { SuggestionList, SuggestionItem } from './style';

const { Text, Title } = Typography;

interface IProps {
  leaveId: string;
}

const ReassignModal = ({ leaveId }: IProps) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const hideModal = useModalStore((s) => s.hideModal);

  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);

  const { data: suggestions = [], isLoading, isError, error } = useReassignmentSuggestions(leaveId);
  const reassign = useReassignVacancy(leaveId);

  const handleConfirm = async () => {
    if (!selectedTeacherId) {
      message.warning(t('studyLoad.teacherLeave.reassign.noTeacherSelected'));
      return;
    }
    try {
      await reassign.mutateAsync(selectedTeacherId);
      message.success(t('studyLoad.teacherLeave.reassign.success'));
      hideModal();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  return (
    <div style={{ padding: 'var(--space-4)' }}>
      <Title level={5} style={{ marginBottom: 'var(--space-2)' }}>
        {t('studyLoad.teacherLeave.reassign.title')}
      </Title>

      <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 'var(--space-4)' }}>
        {t('studyLoad.teacherLeave.reassign.subtitle')}
      </Text>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
          <Spin />
        </div>
      ) : isError ? (
        <Alert
          type="error"
          showIcon
          message={getApiErrorMessage(error)}
          style={{ marginBottom: 'var(--space-4)' }}
        />
      ) : suggestions.length === 0 ? (
        <Alert
          type="warning"
          showIcon
          message={t('studyLoad.teacherLeave.reassign.empty')}
          style={{ marginBottom: 'var(--space-4)' }}
        />
      ) : (
        <SuggestionList>
          {suggestions.map((s) => (
            <SuggestionItem
              key={s.teacherId}
              $selected={selectedTeacherId === s.teacherId}
              onClick={() => setSelectedTeacherId(s.teacherId)}
              role="button"
              aria-pressed={selectedTeacherId === s.teacherId}
            >
              <Text style={{ color: 'var(--color-text)' }}>{s.teacherName}</Text>
              {s.score !== undefined ? (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t('studyLoad.teacherLeave.reassign.scoreHours', { score: s.score })}
                </Text>
              ) : null}
            </SuggestionItem>
          ))}
        </SuggestionList>
      )}

      <ModalFooter
        cancelLabel={t('studyLoad.common.cancel')}
        confirmLabel={t('studyLoad.distribution.assign')}
        confirmIcon={<UserSwitchOutlined />}
        loading={reassign.isPending}
        confirmDisabled={!selectedTeacherId || isLoading || suggestions.length === 0}
        onConfirm={() => void handleConfirm()}
      />
    </div>
  );
};

export default ReassignModal;
