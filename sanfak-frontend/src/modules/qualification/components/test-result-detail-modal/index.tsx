import { CheckCircleFilled, CloseCircleFilled, DownloadOutlined } from '@ant-design/icons';
import { Button, Flex, Tag, Typography } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { EDU_FORM } from '../../model/course.types';
import type { TestOption, TestResultDetail } from '../../model/test-result.types';
import { downloadExcel } from '../../lib/excel';
import { ScrollBox } from '../scroll-box';

const { Text } = Typography;

function optionStyle(o: TestOption): React.CSSProperties {
  if (o.isCorrect) {
    return { background: '#f0fdf9', border: '1px solid var(--brand-primary, #37cb94)' };
  }
  if (o.isSelected) {
    return { background: '#fef3f2', border: '1px solid var(--brand-error, #f04438)' };
  }
  return { background: 'var(--color-bg-soft, #f8fafc)', border: '1px solid var(--color-border-soft, #eef2f6)' };
}

export default function TestResultDetailModal({ result }: { result: TestResultDetail }) {
  const { t } = useTranslation();

  const formLabel =
    result.form === EDU_FORM.ONLINE
      ? t('qualification.courses.form.online')
      : result.form === EDU_FORM.OFFLINE
        ? t('qualification.courses.form.offline')
        : '—';

  const exportDetail = () => {
    const rows = result.questions.map((q, i) => ({
      '#': i + 1,
      [t('qualification.test.colQuestion')]: q.question,
      [t('qualification.test.colCorrect')]: q.options
        .filter((o) => o.isCorrect)
        .map((o) => o.text)
        .join('; '),
      [t('qualification.test.colSelected')]: q.options
        .filter((o) => o.isSelected)
        .map((o) => o.text)
        .join('; '),
      [t('qualification.test.colOutcome')]: q.isCorrect
        ? t('qualification.test.correct')
        : t('qualification.test.wrong'),
    }));
    const name = `${result.listenerName}_${result.courseTitle ?? ''}`
      .replace(/\s+/g, '_')
      .slice(0, 60);
    downloadExcel(rows, name || 'test-natija', 'Natija', [5, 50, 28, 28, 12]);
  };

  const incorrect = Math.max(0, result.totalCount - result.correctCount);
  const scoreColor = result.score >= 80 ? 'green' : result.score >= 60 ? 'gold' : 'red';

  return (
    <ScrollBox $maxHeight="72vh">
      <Flex
        align="center"
        justify="space-between"
        gap={12}
        wrap
        style={{
          background: 'var(--color-fill-tertiary, #f8fafc)',
          border: '1px solid var(--color-border-soft, #eef2f6)',
          borderRadius: 10,
          padding: '12px 16px',
          marginBottom: 12,
        }}
      >
        <Text style={{ fontSize: 14 }}>
          <Text type="secondary">{t('qualification.test.result')}:</Text>{' '}
          <Text strong style={{ color: 'var(--brand-primary)' }}>
            {result.correctCount} {t('qualification.test.correct').toLocaleLowerCase()}
          </Text>
          {' / '}
          <Text strong style={{ color: 'var(--brand-error)' }}>
            {incorrect} {t('qualification.test.wrong').toLocaleLowerCase()}
          </Text>
        </Text>
        <Flex align="center" gap={12}>
          <Tag color={scoreColor} style={{ fontSize: 14, fontWeight: 700, padding: '3px 12px', margin: 0 }}>
            {result.score}%
          </Tag>
          <Button
            icon={<DownloadOutlined />}
            onClick={exportDetail}
            disabled={result.questions.length === 0}
          >
            {t('qualification.test.exportExcel')}
          </Button>
        </Flex>
      </Flex>

      <Flex align="center" gap={16} wrap style={{ marginBottom: 16 }}>
        <Flex align="center" gap={6}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {t('qualification.test.course')}:
          </Text>
          <Text style={{ fontSize: 13 }}>
            {result.courseTitle ?? '—'}
            {result.creditHours ? `, ${t('qualification.test.totalHours', { h: result.creditHours })}` : ''}
          </Text>
          <Tag color={result.form === EDU_FORM.ONLINE ? 'blue' : 'gold'} style={{ margin: 0 }}>
            {formLabel}
          </Tag>
        </Flex>
        <Flex align="center" gap={6}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {t('qualification.test.listener')}:
          </Text>
          <Text strong style={{ fontSize: 13 }}>
            {result.listenerName}
          </Text>
        </Flex>
      </Flex>

      {result.questions.length === 0 ? (
        <Text type="secondary">{t('qualification.test.noQuestions')}</Text>
      ) : (
        <Flex vertical gap={12}>
          {result.questions.map((q, i) => (
            <div
              key={i}
              style={{
                border: '1px solid var(--color-border-soft, #eef2f6)',
                borderRadius: 10,
                padding: 12,
              }}
            >
              <Flex align="flex-start" justify="space-between" gap={8} style={{ marginBottom: 8 }}>
                <Text strong>
                  {i + 1}. {q.question}
                </Text>
                {q.isCorrect ? (
                  <CheckCircleFilled style={{ color: 'var(--brand-primary, #37cb94)', fontSize: 16 }} />
                ) : (
                  <CloseCircleFilled style={{ color: 'var(--brand-error, #f04438)', fontSize: 16 }} />
                )}
              </Flex>
              <Flex vertical gap={6}>
                {q.options.map((o, j) => (
                  <div key={j} style={{ padding: '6px 10px', borderRadius: 8, ...optionStyle(o) }}>
                    <Text style={{ fontSize: 13 }}>{o.text}</Text>
                  </div>
                ))}
              </Flex>
            </div>
          ))}
        </Flex>
      )}
    </ScrollBox>
  );
}
