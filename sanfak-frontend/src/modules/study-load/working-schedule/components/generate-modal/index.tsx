import { useEffect, useMemo } from 'react';
import { Alert, Button, Modal, Progress, Typography, Space, Tag } from 'antd';
import {
  ClockCircleOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons';
import { useTranslation } from '@/shared/lib/i18n';
import {
  useWorkingScheduleStream,
  type StreamCourse,
  type StreamCourseStatus,
  type WorkingScheduleDoneData,
} from '../../lib/use-working-schedule-stream';

const { Text, Title } = Typography;

interface IProps {
  open: boolean;
  learningProcessId: string;
  approval?: string;
  courses?: number[];
  onDone: (data: WorkingScheduleDoneData) => void;
  onClose: () => void;
}

interface ResultRow {
  courseNum: number;
  status: StreamCourseStatus;
  replaced: number;
  lockedReplaced: number;
  reason: string | null;
}

function buildResultRows(
  courses: StreamCourse[],
  done: WorkingScheduleDoneData | null,
): ResultRow[] {
  const createdMap = new Map(done?.created.map((c) => [c.courseNum, c]) ?? []);
  const skippedMap = new Map(done?.skipped.map((s) => [s.courseNum, s]) ?? []);

  const courseNums: number[] = courses.map((c) => c.courseNum);
  if (done) {
    for (const num of [...createdMap.keys(), ...skippedMap.keys()]) {
      if (!courseNums.includes(num)) courseNums.push(num);
    }
  }
  courseNums.sort((a, b) => a - b);

  const byNum = new Map(courses.map((c) => [c.courseNum, c]));

  return courseNums.map((courseNum) => {
    const streamed = byNum.get(courseNum);
    const created = createdMap.get(courseNum);
    const skipped = skippedMap.get(courseNum);

    let status: StreamCourseStatus = streamed?.status ?? 'pending';
    if (created) status = 'created';
    if (skipped) status = 'skipped';

    return {
      courseNum,
      status,
      replaced: created?.replaced ?? streamed?.replaced ?? 0,
      lockedReplaced: created?.lockedReplaced ?? streamed?.lockedReplaced ?? 0,
      reason: skipped?.reason ?? (streamed?.status === 'skipped' ? streamed.message ?? null : null),
    };
  });
}

function CourseStatusIcon({ status }: { status: StreamCourseStatus }) {
  if (status === 'created') {
    return <CheckCircleOutlined style={{ color: 'var(--brand-primary)' }} />;
  }
  if (status === 'in_progress') {
    return <LoadingOutlined style={{ color: 'var(--brand-warning)' }} />;
  }
  if (status === 'skipped') {
    return <MinusCircleOutlined style={{ color: 'var(--brand-error)' }} />;
  }
  return <ClockCircleOutlined style={{ color: 'var(--color-text-soft)' }} />;
}

function courseStatusColor(status: StreamCourseStatus): string {
  if (status === 'created') return 'success';
  if (status === 'in_progress') return 'processing';
  if (status === 'skipped') return 'error';
  return 'default';
}

const GenerateModal = ({
  open,
  learningProcessId,
  approval,
  courses: selectedCourses,
  onDone,
  onClose,
}: IProps) => {
  const { t } = useTranslation();
  const { progress, courses, streamError, isRunning, doneData, start, stop } =
    useWorkingScheduleStream({
      learningProcessId,
      approval,
      courses: selectedCourses,
      autoStart: false,
      onDone: (data) => {
        onDone(data);
      },
    });

  useEffect(() => {
    if (open) {
      start();
    } else {
      stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const rows = useMemo(() => buildResultRows(courses, doneData), [courses, doneData]);

  const isDone = doneData !== null;
  const isSuccess = doneData?.success === true;

  const courseStatusLabel = (status: StreamCourseStatus): string => {
    if (status === 'created') return t('studyLoad.workingSchedule.generate.status.created');
    if (status === 'in_progress')
      return t('studyLoad.workingSchedule.generate.status.inProgress');
    if (status === 'skipped') return t('studyLoad.workingSchedule.generate.status.skipped');
    return t('studyLoad.workingSchedule.generate.status.pending');
  };

  const headline = (() => {
    if (streamError) return t('studyLoad.workingSchedule.generate.failed');
    if (isDone) return t('studyLoad.workingSchedule.generate.finished');
    if (isRunning) return t('studyLoad.workingSchedule.generate.running');
    return t('studyLoad.workingSchedule.generate.preparing');
  })();

  const doneMessage = (() => {
    const backendMessage = doneData?.message.trim() ?? '';
    if (backendMessage !== '') return backendMessage;
    return isSuccess
      ? t('studyLoad.workingSchedule.generate.finished')
      : t('studyLoad.workingSchedule.generate.noResult');
  })();

  return (
    <Modal
      title={t('studyLoad.workingSchedule.generate.title')}
      open={open}
      onCancel={() => {
        stop();
        onClose();
      }}
      footer={null}
      closable={!isRunning}
      maskClosable={!isRunning}
      centered
      width={480}
      destroyOnHidden
    >
      <Space direction="vertical" size="large" style={{ width: '100%', paddingTop: 8 }}>
        <div>
          <Progress
            percent={progress}
            status={
              streamError || (isDone && !isSuccess)
                ? 'exception'
                : isDone
                  ? 'success'
                  : 'active'
            }
            strokeColor={
              streamError || (isDone && !isSuccess) ? undefined : 'var(--brand-primary)'
            }
            style={{ marginBottom: 4 }}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {headline}
          </Text>
        </div>

        {streamError ? <Alert type="error" message={streamError} showIcon /> : null}

        {isDone ? (
          <Alert
            type={isSuccess ? 'success' : 'warning'}
            message={doneMessage}
            description={t('studyLoad.workingSchedule.generate.closeHint')}
            showIcon
          />
        ) : null}

        {rows.length > 0 ? (
          <div>
            <Title level={5} style={{ marginBottom: 8, fontSize: 13 }}>
              {t('studyLoad.workingSchedule.generate.coursesTitle')}
            </Title>
            <Space direction="vertical" size={6} style={{ width: '100%' }}>
              {rows.map((row) => (
                <div
                  key={row.courseNum}
                  style={{
                    padding: '6px 12px',
                    background: 'var(--color-bg-elevate)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <Space size={8}>
                      <CourseStatusIcon status={row.status} />
                      <Text style={{ fontSize: 13 }}>
                        {t('studyLoad.workingSchedule.generate.courseLabel', {
                          course: row.courseNum,
                        })}
                      </Text>
                    </Space>
                    <Tag
                      color={courseStatusColor(row.status)}
                      style={{ margin: 0, fontSize: 12 }}
                    >
                      {courseStatusLabel(row.status)}
                    </Tag>
                  </div>

                  {row.replaced > 0 ? (
                    <Text
                      type={row.lockedReplaced > 0 ? 'warning' : 'secondary'}
                      style={{ fontSize: 12, display: 'block', marginTop: 4 }}
                    >
                      {row.lockedReplaced > 0
                        ? t('studyLoad.workingSchedule.generate.replacedLocked', {
                            total: row.replaced,
                            locked: row.lockedReplaced,
                          })
                        : t('studyLoad.workingSchedule.generate.replaced', {
                            total: row.replaced,
                          })}
                    </Text>
                  ) : null}

                  {row.status === 'skipped' ? (
                    <Text
                      type="danger"
                      style={{ fontSize: 12, display: 'block', marginTop: 4 }}
                    >
                      {row.reason ?? t('studyLoad.workingSchedule.generate.skippedNoReason')}
                    </Text>
                  ) : null}
                </div>
              ))}
            </Space>
          </div>
        ) : null}

        {isRunning ? (
          <Alert
            type="warning"
            message={t('studyLoad.workingSchedule.generate.doNotLeave')}
            showIcon
            style={{ fontSize: 12 }}
          />
        ) : null}

        {isRunning ? null : (
          <Button
            block
            type="primary"
            onClick={() => {
              stop();
              onClose();
            }}
          >
            {t('studyLoad.workingSchedule.generate.close')}
          </Button>
        )}
      </Space>
    </Modal>
  );
};

export default GenerateModal;
