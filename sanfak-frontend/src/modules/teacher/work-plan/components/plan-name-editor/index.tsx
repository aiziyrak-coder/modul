import { useState } from 'react';
import { Input, Tooltip, Typography } from 'antd';
import { CheckOutlined, CloseOutlined, EditOutlined, LoadingOutlined } from '@ant-design/icons';
import { Can } from '@/app/session';
import { useTranslation } from '@/shared/lib/i18n';
import { Row } from './style';

interface IProps {
  name: string;
  editable: boolean;
  saving: boolean;
  onSave: (name: string) => void;
}

const PlanNameEditor = ({ name, editable, saving, onSave }: IProps) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(name);

  const startEdit = () => {
    setValue(name);
    setIsEditing(true);
  };

  const cancelEdit = () => setIsEditing(false);

  const confirmEdit = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== name) {
      onSave(trimmed);
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <Row>
        <Input
          className="name-input"
          value={value}
          autoFocus
          disabled={saving}
          placeholder={t('teacher.personalPlan.name.placeholder')}
          onChange={(e) => setValue(e.target.value)}
          onPressEnter={confirmEdit}
        />
        <div className="name-actions">
          {saving ? (
            <LoadingOutlined />
          ) : (
            <>
              <Tooltip title={t('save')}>
                <CheckOutlined style={{ color: 'var(--brand-success, #37CB94)', cursor: 'pointer' }} onClick={confirmEdit} />
              </Tooltip>
              <Tooltip title={t('cancel')}>
                <CloseOutlined style={{ color: 'var(--brand-error)', cursor: 'pointer' }} onClick={cancelEdit} />
              </Tooltip>
            </>
          )}
        </div>
      </Row>
    );
  }

  return (
    <Row>
      <Typography.Text className="name-text">{name}</Typography.Text>
      {editable ? (
        <Can perform="personalWorkPlan:update">
          <div className="name-actions">
            <Tooltip title={t('edit')}>
              <EditOutlined style={{ cursor: 'pointer' }} onClick={startEdit} />
            </Tooltip>
          </div>
        </Can>
      ) : null}
    </Row>
  );
};

export default PlanNameEditor;
