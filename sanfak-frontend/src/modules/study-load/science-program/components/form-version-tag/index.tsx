import { Tag, Tooltip } from 'antd';
import { useTranslation } from '@/shared/lib/i18n';
import type { ScienceProgramFormVersion } from '../../model/types';

interface IProps {
  version: ScienceProgramFormVersion;
}

const FormVersionTag = ({ version }: IProps) => {
  const { t } = useTranslation();
  const isV142 = version === 'v142';

  return (
    <Tooltip
      trigger={['hover', 'focus']}
      title={t(
        isV142
          ? 'studyLoad.scienceProgram.formVersionTooltipV142'
          : 'studyLoad.scienceProgram.formVersionTooltipV259',
      )}
    >
      <Tag
        color={isV142 ? 'processing' : 'default'}
        tabIndex={0}
        style={{ margin: 0, cursor: 'help' }}
      >
        {t(
          isV142
            ? 'studyLoad.scienceProgram.formVersionBadgeV142'
            : 'studyLoad.scienceProgram.formVersionBadgeV259',
        )}
      </Tag>
    </Tooltip>
  );
};

export default FormVersionTag;
