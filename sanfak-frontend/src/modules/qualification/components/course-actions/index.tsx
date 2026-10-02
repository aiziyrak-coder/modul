import { BookOutlined, DeleteOutlined, EditOutlined, TeamOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';
import { useTranslation } from '@/shared/lib/i18n';
import { COURSE_STATUS, EDU_FORM } from '../../model/course.types';
import type { CourseStatus, EduForm } from '../../model/course.types';
import { IconBtn, Wrap } from './style';

interface IProps {
  status: CourseStatus;
  form: EduForm;
  onStudents: () => void;
  onCurriculum: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function CourseActions({
  status,
  form,
  onStudents,
  onCurriculum,
  onEdit,
  onDelete,
}: IProps) {
  const { t } = useTranslation();
  const isPlanned = status === COURSE_STATUS.PLANNED;
  const isOnline = form === EDU_FORM.ONLINE;

  return (
    <Wrap>
      <Tooltip title={t('qualification.courses.action.students')}>
        <IconBtn type="button" onClick={onStudents}>
          <TeamOutlined />
        </IconBtn>
      </Tooltip>

      {isOnline ? (
        <Tooltip title={t('qualification.courses.action.curriculum')}>
          <IconBtn type="button" onClick={onCurriculum}>
            <BookOutlined />
          </IconBtn>
        </Tooltip>
      ) : null}

      {isPlanned ? (
        <>
          <Tooltip title={t('qualification.courses.action.edit')}>
            <IconBtn type="button" onClick={onEdit}>
              <EditOutlined />
            </IconBtn>
          </Tooltip>
          <Tooltip title={t('qualification.courses.action.delete')}>
            <IconBtn type="button" $danger onClick={onDelete}>
              <DeleteOutlined />
            </IconBtn>
          </Tooltip>
        </>
      ) : null}
    </Wrap>
  );
}
