import { useMemo, useState } from 'react';
import { Alert, Checkbox, Col, Input, Modal, Row, Skeleton, Space, Typography } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import { ModalFooter } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { useSupersedePreview } from '../../../working-schedule/api/working-schedule-api';
import { useStudyPlanDetail } from '../../api/detail-api';
import { coursesParam, planCourseNumbers } from './course-selection';

const { Text } = Typography;
const { TextArea } = Input;

interface IProps {
  open: boolean;
  learningProcessId: string;
  onConfirm: (approval: string, courses?: number[]) => void;
  onCancel: () => void;
}

const CreateWorkingPlanConfirm = ({
  open,
  learningProcessId,
  onConfirm,
  onCancel,
}: IProps) => {
  const [approval, setApproval] = useState('');
  const { t } = useTranslation();

  const {
    data: preview,
    isPending: isPreviewPending,
    isError: isPreviewError,
  } = useSupersedePreview(open ? learningProcessId : undefined);

  const isPreviewLoading = open && isPreviewPending && !isPreviewError;

  const totalExisting = preview?.totalExisting ?? 0;
  const totalLocked = preview?.totalLocked ?? 0;
  const showSupersedeWarning = totalExisting > 0;

  const {
    data: detail,
    isPending: isDetailPending,
    isError: isDetailError,
  } = useStudyPlanDetail(open ? learningProcessId : undefined);
  const isDetailLoading = open && isDetailPending && !isDetailError;
  const allCourses = useMemo(() => planCourseNumbers(detail?.courses ?? []), [detail]);
  const [pickedCourses, setPickedCourses] = useState<number[] | null>(null);
  const selectedCourses = pickedCourses ?? allCourses;
  const showCourseSelect = allCourses.length > 0;
  const isSelectionEmpty = showCourseSelect && selectedCourses.length === 0;

  const handleConfirm = () => {
    onConfirm(approval, showCourseSelect ? coursesParam(allCourses, selectedCourses) : undefined);
    setApproval('');
    setPickedCourses(null);
  };

  const handleCancel = () => {
    setApproval('');
    setPickedCourses(null);
    onCancel();
  };

  return (
    <Modal
      open={open}
      onCancel={handleCancel}
      footer={null}
      centered
      width={480}
      destroyOnHidden
      title={null}
    >
      <Row gutter={[12, 20]}>
        {isPreviewError ? (
          <Col span={24}>
            <Alert
              type="warning"
              showIcon
              message={t('studyLoad.studyPlan.supersede.loadFailedTitle')}
              description={t('studyLoad.studyPlan.supersede.loadFailedText')}
            />
          </Col>
        ) : null}

        {showSupersedeWarning ? (
          <Col span={24}>
            <Alert
              type={totalLocked > 0 ? 'warning' : 'info'}
              showIcon
              message={t('studyLoad.studyPlan.supersede.title')}
              description={
                totalLocked > 0
                  ? t('studyLoad.studyPlan.supersede.textLocked', {
                      total: totalExisting,
                      locked: totalLocked,
                    })
                  : t('studyLoad.studyPlan.supersede.text', { total: totalExisting })
              }
            />
          </Col>
        ) : null}

        <Col span={24}>
          <Space
            align="start"
            size={12}
            style={{
              background: 'var(--color-bg-elevate, #F5F7FB)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3) var(--space-4)',
              width: '100%',
              border: '1px solid var(--color-border)',
            }}
          >
            <WarningOutlined
              style={{ color: '#EF6820', fontSize: 22, marginTop: 2, flexShrink: 0 }}
            />
            <div>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>
                {t('studyLoad.studyPlan.createConfirm.checkTitle')}
              </Text>
              <Text type="secondary" style={{ fontSize: 13 }}>
                {t('studyLoad.studyPlan.createConfirm.checkText')}
              </Text>
            </div>
          </Space>
        </Col>

        <Col span={24}>
          <div>
            <Text style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>
              {t('studyLoad.studyPlan.createConfirm.protocolLabel')}
            </Text>
            <TextArea
              placeholder={t('studyLoad.studyPlan.createConfirm.protocolPlaceholder')}
              value={approval}
              onChange={(e) => setApproval(e.target.value)}
              rows={3}
              style={{ width: '100%', resize: 'none' }}
            />
          </div>
        </Col>

        <Col span={24}>
          <Text style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>
            {t('studyLoad.studyPlan.createConfirm.coursesLabel')}
          </Text>
          {isDetailLoading ? (
            <Skeleton.Input active size="small" block />
          ) : showCourseSelect ? (
            <>
              <Checkbox.Group
                aria-label={t('studyLoad.studyPlan.createConfirm.coursesLabel')}
                value={selectedCourses}
                onChange={(values) => setPickedCourses(values)}
                options={allCourses.map((course) => ({
                  value: course,
                  label: t('studyLoad.workingSchedule.generate.courseLabel', { course }),
                }))}
                style={{ flexWrap: 'wrap', rowGap: 'var(--space-2)' }}
              />
              {isSelectionEmpty ? (
                <Text type="danger" role="alert" style={{ display: 'block', marginTop: 6, fontSize: 12 }}>
                  {t('studyLoad.studyPlan.createConfirm.coursesRequired')}
                </Text>
              ) : null}
              <Text type="secondary" style={{ display: 'block', marginTop: 6, fontSize: 12 }}>
                {t('studyLoad.studyPlan.createConfirm.coursesHint')}
              </Text>
            </>
          ) : (
            <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
              {t('studyLoad.studyPlan.createConfirm.coursesUnavailable')}
            </Text>
          )}
        </Col>

        <Col span={24}>
          <ModalFooter
            spacing="none"
            cancelLabel={t('studyLoad.common.cancel')}
            confirmLabel={t('studyLoad.common.create')}
            loading={isPreviewLoading || isDetailLoading}
            confirmDisabled={isSelectionEmpty}
            onCancel={handleCancel}
            onConfirm={handleConfirm}
          />
        </Col>
      </Row>
    </Modal>
  );
};

export default CreateWorkingPlanConfirm;
