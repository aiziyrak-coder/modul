import { useEffect, useState } from 'react';
import { useTranslation } from '@/shared/lib/i18n';
import { Button, Typography } from '@/shared/ui';
import { useClampDetect } from '../../lib/use-clamp-detect';
import { ClampBox } from './style';

const CLAMP_MEASURE_THRESHOLD = 120;

export interface NotificationBodyProps {
  text: string;
  maxLines?: number;
  emphasis?: 'primary' | 'secondary';
  className?: string;
}

export default function NotificationBody({
  text,
  maxLines,
  emphasis = 'secondary',
  className,
}: NotificationBodyProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [canToggle, setCanToggle] = useState(false);

  const shouldMeasure =
    Boolean(maxLines) && (text.length > CLAMP_MEASURE_THRESHOLD || text.includes('\n'));
  const { ref, isClamped } = useClampDetect<HTMLDivElement>(shouldMeasure && !expanded);

  useEffect(() => {
    if (isClamped) setCanToggle(true);
  }, [isClamped]);

  const clamp = maxLines && !expanded ? maxLines : undefined;

  return (
    <div className={className}>
      <ClampBox ref={ref} $clamp={clamp}>
        <Typography.Text type={emphasis === 'secondary' ? 'secondary' : undefined} strong={emphasis === 'primary'}>
          {text}
        </Typography.Text>
      </ClampBox>
      {canToggle ? (
        <Button
          type="link"
          size="small"
          style={{ paddingInline: 0, height: 'auto' }}
          onClick={(event) => {
            event.stopPropagation();
            setExpanded((value) => !value);
          }}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {expanded ? t('notif.less', { defaultValue: 'Kamroq' }) : t('notif.more', { defaultValue: "Ko'proq" })}
        </Button>
      ) : null}
    </div>
  );
}
