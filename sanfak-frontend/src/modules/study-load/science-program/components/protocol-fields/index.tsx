import { Col, Row } from 'antd';
import { DateField, TextField } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { FieldLabel } from '../../style';

interface IProps {
  name: 'councilProtocol' | 'departmentProtocol';
  label: string;
}

const ProtocolFields = ({ name, label }: IProps) => {
  const { t } = useTranslation();
  return (
    <div>
      <FieldLabel>{t(label)}</FieldLabel>
      <Row gutter={[16, 0]}>
        <Col xs={24} sm={12}>
          <DateField name={`${name}.date`} label="scienceProgram.v142.field.protocolDate" />
        </Col>
        <Col xs={24} sm={12}>
          <TextField
            name={`${name}.number`}
            label="scienceProgram.v142.field.protocolNumber"
            placeholder="studyLoad.common.protocolPlaceholder"
          />
        </Col>
      </Row>
    </div>
  );
};

export default ProtocolFields;
