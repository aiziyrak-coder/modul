import { App, Form, Select, Typography } from 'antd';
import { useGeneratePersonalPlan, useAcademicYearsForSelect, getApiErrorMessage } from '../../api/work-plan-api';
import { ModalFooter, useModalStore } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import SuccessModal from '../../../components/success-modal';

const { Text } = Typography;

interface IProps {
  onDone?: () => void;
}

const GenerateModal = ({ onDone }: IProps) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const showModal = useModalStore((s) => s.showModal);
  const [form] = Form.useForm<{ academicYear: string }>();

  const { data: academicYears = [], isLoading: ayLoading } = useAcademicYearsForSelect();
  const generate = useGeneratePersonalPlan();

  const handleFinish = async (values: { academicYear: string }) => {
    try {
      const result = await generate.mutateAsync({ academicYear: values.academicYear });
      showModal({
        withHeader: false,
        maxWidth: '460px',
        bodyPadding: '40px',
        body: () => (
          <SuccessModal
            title={t('teacher.personalPlan.generate.successTitle')}
            text={t('teacher.personalPlan.generate.successText', {
              scienceCount: result.scienceCount,
              plannedHour: result.plannedHour,
            })}
            onClose={onDone}
          />
        ),
      });
    } catch (err) {
      message.error(getApiErrorMessage(err));
    }
  };

  return (
    <div style={{ padding: 'var(--space-4) 0' }}>
      <Text type="secondary" style={{ display: 'block', marginBottom: 'var(--space-4)', fontSize: 13 }}>
        {t('teacher.personalPlan.generate.hint')}
      </Text>

      <Form form={form} layout="vertical" onFinish={handleFinish}>
        <Form.Item
          name="academicYear"
          label={t('teacher.personalPlan.generate.academicYearLabel')}
          rules={[{ required: true, message: t('teacher.personalPlan.generate.academicYearPlaceholder') }]}
        >
          <Select
            placeholder={t('teacher.personalPlan.generate.academicYearPlaceholder')}
            loading={ayLoading}
            options={academicYears.map((ay) => ({ label: ay.title, value: ay.id }))}
            showSearch
            optionFilterProp="label"
            style={{ width: '100%' }}
          />
        </Form.Item>

        <ModalFooter submit confirmLabel={t('teacher.personalPlan.generate.confirm')} loading={generate.isPending} />
      </Form>
    </div>
  );
};

export default GenerateModal;
