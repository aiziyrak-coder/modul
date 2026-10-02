import { useMemo } from 'react';
import { Input, Empty } from 'antd';
import styled from 'styled-components';
import { useTranslation } from '@/shared/lib/i18n';
import {
  buildHeading,
  buildItems,
  collectVars,
  type DalolatnomaItem,
} from '../lib/dalolatnoma-template';
import type { ScientificWork } from '../model/types';

const { TextArea } = Input;

interface DalolatnomaDraftProps {
  work: ScientificWork;
  intro: string;
  finalConclusion: string;
  onIntroChange?: (val: string) => void;
  onFinalConclusionChange?: (val: string) => void;
}

const Wrapper = styled.div`
  background: var(--bg-surface, #fff);
  border: 1px solid var(--border-secondary, #eaecf0);
  border-radius: var(--radius-lg, 12px);
  padding: 24px;
  font-size: 13px;
  line-height: 1.7;
`;

const Heading = styled.div`
  text-align: center;
  font-weight: 700;
  color: var(--color-text, #121926);
  margin-bottom: 2px;

  &.main {
    font-size: 20px;
    letter-spacing: 0.1em;
    margin: 6px 0 18px;
  }
`;

const SectionTitle = styled.div`
  font-weight: 700;
  font-size: 13px;
  margin: 18px 0 8px;
  color: var(--color-text-tertiary, #667085);
  text-transform: uppercase;
  letter-spacing: 0.03em;
`;

const ReadBox = styled.div`
  font-size: 12.5px;
  color: var(--color-text-secondary, #475467);
  white-space: pre-wrap;
  text-align: justify;
  background: var(--bg-tertiary, #f9fafb);
  border: 1px solid var(--border-secondary, #f0f0f0);
  border-radius: 6px;
  padding: 10px 14px;
  min-height: 40px;
`;

const Item = styled.div`
  margin-bottom: 10px;
  text-align: justify;

  .no {
    font-weight: 700;
    color: var(--color-text, #121926);
    margin-right: 4px;
  }
  .text {
    color: var(--color-text-secondary, #475467);
    white-space: pre-wrap;
  }
  .meta {
    margin-top: 2px;
    font-size: 11px;
    color: var(--color-text-quaternary, #98a2b3);
  }
`;

export function DalolatnomaDraft({
  work,
  intro,
  finalConclusion,
  onIntroChange,
  onFinalConclusionChange,
}: DalolatnomaDraftProps) {
  const { t, lang } = useTranslation();

  const heading = useMemo(() => buildHeading(collectVars(work)), [work]);
  const items: DalolatnomaItem[] = useMemo(() => buildItems(work, lang), [work, lang]);

  return (
    <Wrapper>
      {heading.map((line, i) => (
        <Heading key={line} className={i === heading.length - 1 ? 'main' : undefined}>
          {line}
        </Heading>
      ))}

      <SectionTitle>{t('scienceCouncil.protocol.intro')}</SectionTitle>
      {onIntroChange ? (
        <TextArea
          value={intro}
          onChange={(e) => onIntroChange(e.target.value)}
          autoSize={{ minRows: 3, maxRows: 10 }}
          maxLength={2000}
          placeholder={t('scienceCouncil.protocol.introPlaceholder')}
        />
      ) : (
        <ReadBox>{intro || `— ${t('scienceCouncil.protocol.noIntroYet')} —`}</ReadBox>
      )}

      <SectionTitle>{t('scienceCouncil.protocol.memberReviews')}</SectionTitle>
      {items.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('scienceCouncil.protocol.noReviewsYet')}
          style={{ margin: '8px 0' }}
        />
      ) : (
        items.map((it) => (
          <Item key={`${it.no}-${it.memberName}`}>
            <div>
              <span className="no">№ {it.no}.</span>
              <span className="text">{it.text}</span>
            </div>
            <div className="meta">
              {it.memberName} · {it.docLabel}
            </div>
          </Item>
        ))
      )}

      <SectionTitle>{t('scienceCouncil.protocol.finalConclusion')}</SectionTitle>
      {onFinalConclusionChange ? (
        <TextArea
          value={finalConclusion}
          onChange={(e) => onFinalConclusionChange(e.target.value)}
          maxLength={3000}
          showCount={{
            formatter: ({ count }: { count: number }) =>
              `${count} / 3000 ${lang === 'uz' ? 'belgi' : 'симв.'}`,
          }}
          autoSize={{ minRows: 5, maxRows: 16 }}
          placeholder={t('scienceCouncil.protocol.conclusionPlaceholder')}
        />
      ) : (
        <ReadBox>
          {finalConclusion || `— ${t('scienceCouncil.protocol.noConclusionYet')} —`}
        </ReadBox>
      )}
    </Wrapper>
  );
}
