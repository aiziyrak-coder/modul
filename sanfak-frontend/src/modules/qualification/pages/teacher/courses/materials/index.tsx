import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import { ConfigProvider, Tabs } from 'antd';
import { MinusOutlined, PlusOutlined } from '@ant-design/icons';
import { PageContainer, Card, Empty, Flex, Spin, Typography } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { useCourse } from '../../../../api/course-api';
import { useTopicsByCoursePaginated } from '../../../../api/topic-api';
import { EDU_FORM } from '../../../../model/course.types';
import {
  useCreateLecture,
  useCreatePractical,
  useDeleteLecture,
  useDeletePractical,
  useLectures,
  usePracticals,
  useUpdateLecture,
  useUpdatePractical,
} from '../../../../api/topic-material-api';
import CourseHeader from '../../../../components/course-header';
import CourseTabs from '../../../../components/course-tabs';
import TopicScenarioTab from '../../../../components/topic-scenario-tab';
import TopicFileTab from '../../../../components/topic-file-tab';
import TopicVideoTab from '../../../../components/topic-video-tab';
import TopicFinalTestTab from '../../../../components/topic-final-test-tab';

const DOC_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx';

const { Text } = Typography;

const TopicHeader = styled.div`
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;

  &:hover .topic-toggle {
    background: var(--brand-primary, #37cb94);
    border-color: var(--brand-primary, #37cb94);
    color: #fff;
  }
`;

const Toggle = styled.span<{ $open: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-size: 12px;
  flex-shrink: 0;
  border: 1px solid
    ${(p) => (p.$open ? 'var(--brand-primary, #37cb94)' : 'var(--color-border, #e3e8ef)')};
  color: ${(p) => (p.$open ? '#fff' : 'var(--color-text-soft, #697586)')};
  background: ${(p) => (p.$open ? 'var(--brand-primary, #37cb94)' : 'transparent')};
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease;
`;

export default function TeacherMaterialsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id = '' } = useParams<{ id: string }>();

  const course = useCourse(id);
  const { data: topicsData, isLoading } = useTopicsByCoursePaginated({
    course: id,
    page: 1,
    limit: 100,
  });
  const topics = topicsData?.items ?? [];

  const [activeKey, setActiveKey] = useState<string | undefined>(undefined);

  const tabItems = (topicId: string) => [
    {
      key: 'lecture',
      label: t('qualification.materials.tab.lecture'),
      children: (
        <TopicFileTab
          courseId={id}
          topicId={topicId}
          useList={useLectures}
          useCreate={useCreateLecture}
          useUpdate={useUpdateLecture}
          useDelete={useDeleteLecture}
          createPerm="qualTopicLecture:create"
          deletePerm="qualTopicLecture:delete"
          accept={DOC_ACCEPT}
        />
      ),
    },
    {
      key: 'practical',
      label: t('qualification.materials.tab.practical'),
      children: (
        <TopicFileTab
          courseId={id}
          topicId={topicId}
          useList={usePracticals}
          useCreate={useCreatePractical}
          useUpdate={useUpdatePractical}
          useDelete={useDeletePractical}
          createPerm="qualTopicPractical:create"
          deletePerm="qualTopicPractical:delete"
          accept={DOC_ACCEPT}
        />
      ),
    },
    {
      key: 'video',
      label: t('qualification.materials.tab.video'),
      children: <TopicVideoTab courseId={id} topicId={topicId} />,
    },
    {
      key: 'scenario',
      label: t('qualification.materials.tab.scenario'),
      children: <TopicScenarioTab courseId={id} topicId={topicId} />,
    },
    {
      key: 'finalTest',
      label: t('qualification.materials.tab.finalTest'),
      children: <TopicFinalTestTab courseId={id} topicId={topicId} />,
    },
  ];

  const offline = course.data && course.data.form !== EDU_FORM.ONLINE;

  return (
    <PageContainer title={course.data?.title ?? t('qualification.courseTabs.materials')}>
      <CourseHeader
        course={course.data}
        fallbackTitle={t('qualification.courseTabs.materials')}
        onBack={() => navigate('/qualification/teacher/courses')}
      />

      <CourseTabs courseId={id} form={course.data?.form} />

      <Spin spinning={isLoading}>
      {offline ? (
        <Flex align="center" justify="center" style={{ flex: 1, minHeight: 'calc(100vh - 280px)' }}>
          <Empty description={t('qualification.materials.onlineOnly')} />
        </Flex>
      ) : topics.length === 0 && isLoading ? (
        <div style={{ minHeight: 'calc(100vh - 280px)' }} />
      ) : topics.length === 0 ? (
        <Flex align="center" justify="center" style={{ flex: 1, minHeight: 'calc(100vh - 280px)' }}>
          <Empty description={t('qualification.materials.noTopics')} />
        </Flex>
      ) : (
        <Flex vertical gap={10}>
          {topics.map((tp) => {
            const open = activeKey === tp.id;
            return (
              <Card key={tp.id} styles={{ body: { padding: 0 } }}>
                <TopicHeader onClick={() => setActiveKey(open ? undefined : tp.id)}>
                  <Text strong style={{ color: 'var(--brand-primary, #37cb94)' }}>
                    {tp.orderNumber}.
                  </Text>
                  <Text strong>{tp.title}</Text>
                  {tp.duration > 0 ? (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {t('qualification.materials.duration', { h: tp.duration })}
                    </Text>
                  ) : null}
                  <div style={{ flex: 1 }} />
                  <Toggle className="topic-toggle" $open={open}>
                    {open ? <MinusOutlined /> : <PlusOutlined />}
                  </Toggle>
                </TopicHeader>
                {open ? (
                  <div
                    style={{
                      padding: '4px 20px 20px',
                      borderTop: '1px solid var(--color-border-soft, #eef2f6)',
                    }}
                  >
                    <ConfigProvider
                      theme={{
                        components: {
                          Button: { controlHeight: 40 },
                          Input: { controlHeight: 40 },
                          InputNumber: { controlHeight: 40 },
                          Select: { controlHeight: 40 },
                        },
                      }}
                    >
                      <Tabs
                        defaultActiveKey="lecture"
                        items={tabItems(tp.id)}
                        destroyInactiveTabPane
                      />
                    </ConfigProvider>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </Flex>
      )}
      </Spin>
      <div style={{ height: 24, flexShrink: 0 }} />
    </PageContainer>
  );
}
