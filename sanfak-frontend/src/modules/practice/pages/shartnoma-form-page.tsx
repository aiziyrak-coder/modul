import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import {
  App,
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Divider,
  Empty,
  Flex,
  Form,
  Input,
  Row,
  Select,
  Spin,
  Typography,
} from 'antd';
import { PageContainer } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import type { ContractInput } from '../api/mock-store';
import { courseSelectOptions } from '../model/course-number';
import {
  useBases,
  useContract,
  useContractCreate,
  useContractUpdate,
  useReferenceList,
  useStudents,
} from '../api/practice-api';

const { RangePicker } = DatePicker;
const { Text, Title } = Typography;

interface FormValues {
  academicYearId: string;
  organizationId: string;
  directionId: string;
  course: number;
  group?: string;
  studentIds: string[];
  dates: [Dayjs, Dayjs];
  note?: string;
}

const LIST_PATH = '/amaliyot/shartnomalar';

export default function ShartnomaFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();

  const directionId = Form.useWatch('directionId', form);
  const course = Form.useWatch('course', form);
  const group = Form.useWatch('group', form);
  const studentIds = Form.useWatch('studentIds', form);

  const years = useReferenceList('academicYears');
  const directions = useReferenceList('directions');
  const courses = useReferenceList('courses');
  const bases = useBases();
  const students = useStudents({ directionId, course });
  const { data: contract, isLoading } = useContract(id);
  const create = useContractCreate();
  const update = useContractUpdate();

  useEffect(() => {
    if (!isEdit || !contract) return;
    form.setFieldsValue({
      academicYearId: contract.academicYear.id,
      organizationId: contract.organization.id,
      directionId: contract.direction.id,
      course: contract.course ?? undefined,
      group: contract.group ?? undefined,
      studentIds: contract.students.map((s) => s.id),
      dates: [dayjs(contract.startDate), dayjs(contract.endDate)],
      note: contract.note ?? '',
    });
  }, [isEdit, contract, form]);

  const baseOptions = useMemo(
    () =>
      (bases.data ?? []).map((b) => ({
        value: b.id,
        label: `${b.title} (${b.district.title})`,
      })),
    [bases.data],
  );

  const studentMatches = useMemo(
    () => (students.data ?? []).filter((s) => !group || s.group === group),
    [students.data, group],
  );

  const groupOptions = useMemo(() => {
    const set = new Set((students.data ?? []).map((s) => s.group));
    return [...set].map((g) => ({ value: g, label: g }));
  }, [students.data]);

  const selected = useMemo(() => studentIds ?? [], [studentIds]);
  const visibleIds = useMemo(() => studentMatches.map((s) => s.id), [studentMatches]);
  const allChecked = visibleIds.length > 0 && visibleIds.every((sid) => selected.includes(sid));
  const someChecked = visibleIds.some((sid) => selected.includes(sid)) && !allChecked;

  const toggleAll = (checked: boolean) => {
    form.setFieldValue('studentIds', checked ? visibleIds : []);
  };

  const onFinish = async (values: FormValues) => {
    const input: ContractInput = {
      organizationId: values.organizationId,
      directionId: values.directionId,
      academicYearId: values.academicYearId,
      course: values.course,
      group: values.group,
      studentIds: values.studentIds,
      startDate: values.dates[0].toISOString(),
      endDate: values.dates[1].toISOString(),
      note: values.note || null,
    };
    try {
      if (isEdit && contract) {
        await update.mutateAsync({ id: contract.id, input });
        message.success('Shartnoma yangilandi');
      } else {
        await create.mutateAsync(input);
        message.success('Shartnoma yaratildi');
      }
      navigate(LIST_PATH);
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const opt = (items: { id: string; title: string }[]) =>
    items.map((i) => ({ value: i.id, label: i.title }));
  const courseOpts = courseSelectOptions(courses.data ?? []);

  if (isEdit && isLoading) {
    return (
      <PageContainer title={isEdit ? 'Shartnomani tahrirlash' : 'Shartnoma shakllantirish'}>
        <Flex justify="center" style={{ padding: 48 }}>
          <Spin />
        </Flex>
      </PageContainer>
    );
  }

  if (isEdit && !contract) {
    return (
      <PageContainer title="Shartnoma topilmadi">
        <Title level={4}>Shartnoma topilmadi</Title>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(LIST_PATH)}>
          Shartnomalar ro'yxatiga qaytish
        </Button>
      </PageContainer>
    );
  }

  return (
    <PageContainer title={isEdit ? 'Shartnomani tahrirlash' : 'Shartnoma shakllantirish'}>
      <Flex align="center" gap={12} style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(LIST_PATH)}>
          Orqaga
        </Button>
        <Title level={4} style={{ margin: 0 }}>
          {isEdit ? 'Shartnomani tahrirlash' : 'Shartnoma shakllantirish'}
        </Title>
      </Flex>

      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Card size="small">
            <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
              <Row gutter={12}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="academicYearId"
                    label="O'quv yili"
                    rules={[{ required: true, message: 'Majburiy' }]}
                  >
                    <Select options={opt(years.data ?? [])} placeholder="O'quv yili" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="organizationId"
                    label="Amaliyot bazasi"
                    rules={[{ required: true, message: 'Majburiy' }]}
                  >
                    <Select
                      options={baseOptions}
                      placeholder="Bazani tanlang"
                      showSearch
                      optionFilterProp="label"
                      loading={bases.isFetching}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={12}>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="directionId"
                    label="Yo'nalish"
                    rules={[{ required: true, message: 'Majburiy' }]}
                  >
                    <Select
                      options={opt(directions.data ?? [])}
                      placeholder="Yo'nalish"
                      showSearch
                      optionFilterProp="label"
                      onChange={() => {
                        form.setFieldValue('group', undefined);
                        form.setFieldValue('studentIds', []);
                      }}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="course"
                    label="Kurs"
                    rules={[{ required: true, message: 'Majburiy' }]}
                  >
                    <Select
                      options={courseOpts}
                      placeholder="Kurs"
                      onChange={() => {
                        form.setFieldValue('group', undefined);
                        form.setFieldValue('studentIds', []);
                      }}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="group" label="Guruh (ixtiyoriy)">
                    <Select
                      options={groupOptions}
                      placeholder="Guruh"
                      allowClear
                      onChange={() => form.setFieldValue('studentIds', [])}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Divider style={{ margin: '4px 0 16px' }} />

              <Form.Item
                name="studentIds"
                label={
                  <Flex align="center" gap={12} wrap>
                    <span>Talabalarni biriktirish</span>
                    {directionId && course && visibleIds.length > 0 && (
                      <>
                        <Checkbox
                          checked={allChecked}
                          indeterminate={someChecked}
                          onChange={(e) => toggleAll(e.target.checked)}
                        >
                          Hammasini tanlash
                        </Checkbox>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {selected.length} / {visibleIds.length} tanlandi
                        </Text>
                      </>
                    )}
                  </Flex>
                }
                rules={[{ required: true, message: 'Kamida 1 ta talaba' }]}
              >
                {!directionId || !course ? (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="Yo'nalish va kursni tanlang"
                  />
                ) : students.isFetching ? (
                  <Flex justify="center" style={{ padding: 24 }}>
                    <Spin />
                  </Flex>
                ) : studentMatches.length === 0 ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Mos talaba topilmadi" />
                ) : (
                  <Checkbox.Group style={{ width: '100%' }}>
                    <Flex
                      vertical
                      gap={6}
                      style={{ maxHeight: 260, overflowY: 'auto', width: '100%' }}
                    >
                      {studentMatches.map((s) => (
                        <Checkbox key={s.id} value={s.id}>
                          {s.fish} ({s.group})
                        </Checkbox>
                      ))}
                    </Flex>
                  </Checkbox.Group>
                )}
              </Form.Item>

              <Row gutter={12}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="dates"
                    label="Amaliyot muddati"
                    rules={[{ required: true, message: 'Majburiy' }]}
                  >
                    <RangePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="note" label="Izoh (ixtiyoriy)">
                    <Input.TextArea rows={1} placeholder="Izoh" />
                  </Form.Item>
                </Col>
              </Row>

              <Flex justify="flex-end" gap={12}>
                <Button onClick={() => navigate(LIST_PATH)}>Bekor qilish</Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={create.isPending || update.isPending}
                >
                  {isEdit ? 'Saqlash' : 'Generatsiya qilish'}
                </Button>
              </Flex>
            </Form>
          </Card>
        </Col>
      </Row>
    </PageContainer>
  );
}
