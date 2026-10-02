import { useEffect, useRef, useState } from 'react';
import { Formik, Form as FormikForm, useFormikContext } from 'formik';
import * as Yup from 'yup';
import { Button, Row, Col } from 'antd';
import { App, Form, ModalFooter, SelectField, useModalStore } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { useTranslation } from '@/shared/lib/i18n';
import {
  useApprovedWorkloadExists,
  useCreateWorkload,
  useDepartmentsRef,
  useAcademicYearsRef,
} from '../../api/workload-api';
import type { WorkloadFormValues } from '../../model/types';
import { extractOpenVersionConflict } from '../../model/versioning';
import { FormWrapper } from './style';
import { NoteBlock } from './note-block';
import ProgressModal from '../../../components/progress-modal';

const schema = Yup.object({
  department: Yup.string().required('studyLoad.workload.form.departmentRequired'),
  academicYear: Yup.string().required('studyLoad.workload.form.academicYearRequired'),
});

const emptyValues: WorkloadFormValues = {
  department: '',
  academicYear: '',
};

interface IProgressProps {
  department: string;
  academicYear: string;
  deptTitle?: string;
  onOpenWorkload?: (id: string) => void;
}

export const WorkloadProgress = ({
  department,
  academicYear,
  deptTitle,
  onOpenWorkload,
}: IProgressProps) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const createWorkload = useCreateWorkload();
  const startedRef = useRef(false);

  const [phase, setPhase] = useState<'pending' | 'success' | 'error'>('pending');

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    createWorkload
      .mutateAsync({ department, academicYear })
      .then((result) => {
        setPhase('success');
        for (const warning of result?.warnings ?? []) message.warning(warning.message);
      })
      .catch((e) => {
        setPhase('error');
        const conflict = extractOpenVersionConflict(e);
        if (!conflict) {
          message.error(getApiErrorMessage(e));
          return;
        }
        const openId = conflict.openWorkloadId;
        const key = 'workload-open-version-conflict';
        message.error({
          key,
          duration: 10,
          content: (
            <span>
              {conflict.message || t('studyLoad.workload.version.openConflict')}
              {openId && onOpenWorkload ? (
                <Button
                  type="link"
                  size="small"
                  onClick={() => {
                    message.destroy(key);
                    onOpenWorkload(openId);
                  }}
                >
                  {t('studyLoad.workload.version.openExisting')}
                </Button>
              ) : null}
            </span>
          ),
        });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ProgressModal
      isPending={phase === 'pending'}
      isSuccess={phase === 'success'}
      isError={phase === 'error'}
      department={deptTitle}
    />
  );
};

const ApprovedVersionHint = () => {
  const { t } = useTranslation();
  const { values } = useFormikContext<WorkloadFormValues>();
  const { data: exists } = useApprovedWorkloadExists(
    values.department || undefined,
    values.academicYear || undefined,
  );
  return exists === true ? (
    <NoteBlock
      text={t('studyLoad.workload.version.createHint')}
      style={{ marginTop: 'var(--space-3)' }}
    />
  ) : null;
};

interface IFormProps {
  onOpenWorkload?: (id: string) => void;
}

const WorkloadForm = ({ onOpenWorkload }: IFormProps) => {
  const { t } = useTranslation();
  const showModal = useModalStore((s) => s.showModal);

  const { data: departments = [] } = useDepartmentsRef();
  const { data: academicYears = [] } = useAcademicYearsRef();

  const toSelectOptions = (list: { id: string; title: string }[]) =>
    list.map((opt) => ({ label: opt.title, value: opt.id }));

  const handleSubmit = (values: WorkloadFormValues) => {
    const deptTitle = departments.find((d) => d.id === values.department)?.title;

    showModal({
      withHeader: false,
      maxWidth: '545px',
      body: () => (
        <WorkloadProgress
          department={values.department}
          academicYear={values.academicYear}
          deptTitle={deptTitle}
          onOpenWorkload={onOpenWorkload}
        />
      ),
    });
  };

  return (
    <Formik
      initialValues={emptyValues}
      validationSchema={schema}
      onSubmit={handleSubmit}
      enableReinitialize
    >
      <FormWrapper>
        <FormikForm>
          <Form component={false} layout="vertical">
            <div className="form-body">
              <Row gutter={[12, 8]}>
                <Col span={24}>
                  <SelectField
                    name="department"
                    label="studyLoad.workload.form.department"
                    placeholder="studyLoad.workload.form.departmentPlaceholder"
                    options={toSelectOptions(departments)}
                  />
                </Col>
                <Col span={24}>
                  <SelectField
                    name="academicYear"
                    label="studyLoad.workload.form.academicYear"
                    placeholder="studyLoad.workload.form.academicYearPlaceholder"
                    options={toSelectOptions(academicYears)}
                  />
                </Col>
              </Row>
              <NoteBlock
                text={t('studyLoad.workload.form.note')}
                style={{ marginTop: 'var(--space-4)' }}
              />
              <ApprovedVersionHint />
            </div>

            <div className="form-footer">
              <ModalFooter
                spacing="none"
                submit
                cancelLabel={t('studyLoad.common.cancel')}
                confirmLabel={t('studyLoad.common.create')}
              />
            </div>
          </Form>
        </FormikForm>
      </FormWrapper>
    </Formik>
  );
};

export default WorkloadForm;
