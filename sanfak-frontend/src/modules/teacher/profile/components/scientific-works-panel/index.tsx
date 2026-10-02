import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { UseQueryResult } from '@tanstack/react-query';
import { PaperClipOutlined, ReloadOutlined } from '@ant-design/icons';
import { Skeleton } from 'antd';
import { Alert, Button, LineTab, Tag } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { useTranslation } from '@/shared/lib/i18n';
import {
  useMyArticles,
  useMyMethodicalRecommendations,
  useMyMonographs,
  useMyTheses,
} from '../../api/my-scientific-works-api';
import {
  SCIENTIFIC_WORK_TABS,
  type ScientificWorkItem,
  type ScientificWorkStatus,
  type ScientificWorkTabKey,
} from '../../model/types';
import { DocRow, EmptyDocs, Panel, Wrap } from './style';

const TAB_LABEL_KEY: Record<ScientificWorkTabKey, string> = {
  articles: 'teacher.scientificWorks.tab.articles',
  theses: 'teacher.scientificWorks.tab.theses',
  monographs: 'teacher.scientificWorks.tab.monographs',
  methodical: 'teacher.scientificWorks.tab.methodical',
};

const DETAIL_ROUTE: Partial<Record<ScientificWorkTabKey, string>> = {
  monographs: '/scientific-department/monographs',
  methodical: '/scientific-department/methodical',
};

const STATUS_LABEL_KEY: Record<ScientificWorkStatus, string> = {
  new: 'teacher.scientificWorks.status.new',
  pending: 'teacher.scientificWorks.status.pending',
  approved: 'teacher.scientificWorks.status.approved',
  rejected: 'teacher.scientificWorks.status.rejected',
};

const STATUS_COLOR: Record<ScientificWorkStatus, string> = {
  new: 'default',
  pending: 'processing',
  approved: 'success',
  rejected: 'error',
};

const ScientificWorksPanel = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ScientificWorkTabKey>('articles');

  const articlesQuery = useMyArticles(activeTab === 'articles');
  const thesesQuery = useMyTheses(activeTab === 'theses');
  const monographsQuery = useMyMonographs(activeTab === 'monographs');
  const methodicalQuery = useMyMethodicalRecommendations(activeTab === 'methodical');

  const queryByTab: Record<ScientificWorkTabKey, UseQueryResult<ScientificWorkItem[]>> = {
    articles: articlesQuery,
    theses: thesesQuery,
    monographs: monographsQuery,
    methodical: methodicalQuery,
  };
  const { data, isLoading, isError, error, isFetching, refetch } = queryByTab[activeTab];
  const items = data ?? [];
  const detailRoute = DETAIL_ROUTE[activeTab];

  const handleRowClick = (item: ScientificWorkItem) => {
    if (detailRoute) {
      navigate(`${detailRoute}/${item.id}`);
    } else if (item.fileUrl) {
      window.open(item.fileUrl, '_blank', 'noreferrer');
    }
  };

  return (
    <Panel>
      <LineTab
        activeTab={activeTab}
        setActiveTab={(k) => setActiveTab(k as ScientificWorkTabKey)}
        data={SCIENTIFIC_WORK_TABS.map((key) => ({ key, label: t(TAB_LABEL_KEY[key]) }))}
      />

      <Wrap>
        {isLoading ? (
          <Skeleton active title={false} paragraph={{ rows: 3 }} />
        ) : isError ? (
          <Alert
            type="error"
            showIcon
            message={getApiErrorMessage(error, t('teacher.scientificWorks.loadError'))}
            action={
              <Button size="small" icon={<ReloadOutlined />} loading={isFetching} onClick={() => void refetch()}>
                {t('teacher.common.retry')}
              </Button>
            }
          />
        ) : items.length === 0 ? (
          <EmptyDocs>{t('teacher.scientificWorks.empty')}</EmptyDocs>
        ) : (
          items.map((item) => {
            const clickable = Boolean(detailRoute) || Boolean(item.fileUrl);
            const name = item.title.trim() || t('teacher.scientificWorks.untitled');
            return clickable ? (
              <DocRow key={item.id} as="button" type="button" onClick={() => handleRowClick(item)}>
                <PaperClipOutlined className="icon" />
                <span className="name">{name}</span>
                <Tag color={STATUS_COLOR[item.status]}>{t(STATUS_LABEL_KEY[item.status])}</Tag>
              </DocRow>
            ) : (
              <DocRow key={item.id}>
                <PaperClipOutlined className="icon" />
                <span className="name">{name}</span>
                <Tag color={STATUS_COLOR[item.status]}>{t(STATUS_LABEL_KEY[item.status])}</Tag>
              </DocRow>
            );
          })
        )}
      </Wrap>
    </Panel>
  );
};

export default ScientificWorksPanel;
