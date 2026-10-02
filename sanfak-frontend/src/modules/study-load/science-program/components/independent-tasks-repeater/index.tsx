import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Col, Row, Typography } from 'antd';
import { useFormikContext } from 'formik';
import { NumberField, TextField } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import type { V142FormValues } from '../../model/types';
import { DerivedCode, FieldLabel, RepeaterList, RepeaterRow } from '../../style';

const IndependentTasksRepeater = () => {
  const { t } = useTranslation();
  const { values, setFieldValue } = useFormikContext<V142FormValues>();
  const rows = values.independentTasks;
  const total = rows.reduce(
    (sum, r) => sum + (typeof r.hours === 'number' && Number.isFinite(r.hours) ? r.hours : 0),
    0,
  );

  const handleAdd = () => {
    void setFieldValue('independentTasks', [
      ...rows,
      { order: rows.length + 1, title: '', hours: 0 },
    ]);
  };
  const handleRemove = (idx: number) => {
    void setFieldValue(
      'independentTasks',
      rows.filter((_, i) => i !== idx).map((r, i) => ({ ...r, order: i + 1 })),
    );
  };

  return (
    <div>
      <FieldLabel>{t('scienceProgram.v142.section.independent')}</FieldLabel>

      <RepeaterList>
        {rows.map((_, idx) => (
          <RepeaterRow key={idx}>
            <DerivedCode aria-label={t('scienceProgram.v142.independent.order')}>{idx + 1}</DerivedCode>
            <Row gutter={[12, 8]} style={{ flex: 1 }}>
              <Col xs={16} md={20}>
                <TextField
                  name={`independentTasks[${idx}].title`}
                  placeholder="scienceProgram.v142.independent.title"
                />
              </Col>
              <Col xs={8} md={4}>
                <NumberField name={`independentTasks[${idx}].hours`} min={0} max={999} />
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

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 12,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <Button type="dashed" icon={<PlusOutlined />} onClick={handleAdd}>
          {t('scienceProgram.v142.independent.addTask')}
        </Button>
        <Typography.Text>
          {t('scienceProgram.v142.independent.total')}: <strong>{total}</strong>{' '}
          {t('scienceProgram.v142.hours.unit')}
        </Typography.Text>
      </div>
    </div>
  );
};

export default IndependentTasksRepeater;
