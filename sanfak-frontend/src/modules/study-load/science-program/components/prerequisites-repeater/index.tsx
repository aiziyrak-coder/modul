import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Col, Row } from 'antd';
import { useFormikContext } from 'formik';
import { TextField } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import type { V142FormValues } from '../../model/types';
import { FieldLabel, RepeaterList, RepeaterRow } from '../../style';

const PrerequisitesRepeater = () => {
  const { t } = useTranslation();
  const { values, setFieldValue } = useFormikContext<V142FormValues>();
  const rows = values.prerequisites;

  const handleAdd = () => {
    void setFieldValue('prerequisites', [...rows, { code: '', title: '' }]);
  };
  const handleRemove = (idx: number) => {
    void setFieldValue(
      'prerequisites',
      rows.filter((_, i) => i !== idx),
    );
  };

  return (
    <div>
      <FieldLabel>{t('scienceProgram.v142.field.prerequisites')}</FieldLabel>

      <RepeaterList>
        {rows.map((_, idx) => (
          <RepeaterRow key={idx}>
            <Row gutter={[12, 8]} style={{ flex: 1 }}>
              <Col xs={8} md={5}>
                <TextField
                  name={`prerequisites[${idx}].code`}
                  placeholder="scienceProgram.v142.field.prerequisiteCode"
                />
              </Col>
              <Col xs={16} md={19}>
                <TextField
                  name={`prerequisites[${idx}].title`}
                  placeholder="scienceProgram.v142.field.prerequisiteTitle"
                />
              </Col>
            </Row>
            <Button
              type="text"
              danger
              aria-label={t('studyLoad.common.delete')}
              icon={<DeleteOutlined />}
              onClick={() => handleRemove(idx)}
              style={{ height: 44 }}
            />
          </RepeaterRow>
        ))}
      </RepeaterList>

      <Button type="dashed" icon={<PlusOutlined />} onClick={handleAdd} style={{ marginTop: 12 }}>
        {t('studyLoad.common.add')}
      </Button>
    </div>
  );
};

export default PrerequisitesRepeater;
