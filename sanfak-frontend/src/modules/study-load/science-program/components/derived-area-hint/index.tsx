import { InfoCircleOutlined } from '@ant-design/icons';
import { useTranslation } from '@/shared/lib/i18n';
import type { DirectionRef } from '../../../study-plan/model/types';
import { derivedAreaHint, type AreaField } from '../../lib/derived-areas';
import { HintText } from './style';

interface IProps {
  field: AreaField;
  ownRows: string[] | undefined;
  selectedDirectionIds: string[] | undefined;
  directions: DirectionRef[] | undefined;
}

const DerivedAreaHint = ({ field, ownRows, selectedDirectionIds, directions }: IProps) => {
  const { t } = useTranslation();
  const value = derivedAreaHint(ownRows, selectedDirectionIds, directions, field);
  if (!value) return null;

  return (
    <HintText data-testid={`derived-${field}`}>
      <InfoCircleOutlined aria-hidden />
      {t('scienceProgram.field.areaFromDirection', { value })}
    </HintText>
  );
};

export default DerivedAreaHint;
