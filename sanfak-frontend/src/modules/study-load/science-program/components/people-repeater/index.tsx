import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Col, Row, Select } from 'antd';
import { useFormikContext } from 'formik';
import { TextField } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import type { PersonInput, V142FormValues } from '../../model/types';
import { EMPTY_PERSON } from '../../lib/v142-defaults';
import { staffPersonToInput } from '../../api/mapper';
import { useStaffForSelect } from '../../api/science-program-api';
import { FieldLabel, RepeaterList, TopicCard } from '../../style';

interface IProps {
  name: 'authors' | 'reviewers';
  label: string;
}

const PeopleRepeater = ({ name, label }: IProps) => {
  const { t } = useTranslation();
  const { values, setFieldValue } = useFormikContext<V142FormValues>();
  const rows: PersonInput[] = values[name];
  const { data: staff = [], isLoading: staffLoading, isError: staffError } = useStaffForSelect();
  const canPick = !staffError && (staffLoading || staff.length > 0);

  const staffOptions = staff.map((p) => ({
    value: p.id,
    label: p.department ? `${p.fullName} — ${p.department}` : p.fullName,
  }));

  const handleAdd = () => {
    void setFieldValue(name, [...rows, { ...EMPTY_PERSON }]);
  };
  const handleRemove = (idx: number) => {
    void setFieldValue(
      name,
      rows.filter((_, i) => i !== idx),
    );
  };
  const handlePick = (idx: number, userId: string | undefined) => {
    if (!userId) return;
    const person = staff.find((p) => p.id === userId);
    if (!person) return;
    void setFieldValue(`${name}[${idx}]`, staffPersonToInput(person));
  };

  return (
    <div>
      <FieldLabel>{t(label)}</FieldLabel>

      <RepeaterList>
        {rows.map((_, idx) => (
          <TopicCard key={idx}>
            {canPick ? (
              <Select
                showSearch
                allowClear
                loading={staffLoading}
                options={staffOptions}
                optionFilterProp="label"
                placeholder={t('scienceProgram.v142.person.pickPlaceholder')}
                onChange={(v: string | undefined) => handlePick(idx, v)}
                value={undefined}
                style={{ width: '100%', marginBottom: 12 }}
                aria-label={t('scienceProgram.v142.person.pick')}
              />
            ) : null}
            {rows.length > 1 ? (
              <Button
                type="text"
                danger
                size="small"
                shape="circle"
                title={t('studyLoad.common.delete')}
                aria-label={t('studyLoad.common.delete')}
                icon={<DeleteOutlined />}
                onClick={() => handleRemove(idx)}
                style={{ position: 'absolute', top: 8, right: 8 }}
              />
            ) : null}

            <Row gutter={[16, 0]}>
              <Col xs={24} md={12}>
                <TextField
                  name={`${name}[${idx}].fio`}
                  label="scienceProgram.v142.person.fio"
                  placeholder="scienceProgram.v142.person.fioPlaceholder"
                />
              </Col>
              <Col xs={24} sm={12} md={6}>
                <TextField
                  name={`${name}[${idx}].degree`}
                  label="scienceProgram.v142.person.degree"
                  placeholder="scienceProgram.v142.person.degreePlaceholder"
                />
              </Col>
              <Col xs={24} sm={12} md={6}>
                <TextField
                  name={`${name}[${idx}].title`}
                  label="scienceProgram.v142.person.title"
                  placeholder="scienceProgram.v142.person.titlePlaceholder"
                />
              </Col>
              <Col xs={24} md={12}>
                <TextField
                  name={`${name}[${idx}].department`}
                  label="scienceProgram.v142.person.department"
                  placeholder="scienceProgram.v142.person.departmentPlaceholder"
                />
              </Col>
              <Col xs={24} md={12}>
                <TextField
                  name={`${name}[${idx}].position`}
                  label="scienceProgram.v142.person.position"
                  placeholder="scienceProgram.v142.person.positionPlaceholder"
                />
              </Col>
            </Row>
          </TopicCard>
        ))}
      </RepeaterList>

      <Button type="dashed" icon={<PlusOutlined />} onClick={handleAdd} style={{ marginTop: 12 }}>
        {t('scienceProgram.v142.person.add')}
      </Button>
    </div>
  );
};

export default PeopleRepeater;
