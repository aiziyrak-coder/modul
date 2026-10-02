import { useEffect } from 'react';
import { App, Button, Col, Drawer, Flex, Form, Input, Row, Select } from 'antd';
import { getApiErrorMessage } from '@/shared/api';
import type { PracticeStudent } from '../../model/types';
import type { StudentInput } from '../../api/mock-store';
import { courseSelectOptions } from '../../model/course-number';
import {
  useDistrictsByRegion,
  useReferenceList,
  useStudentCreate,
  useStudentUpdate,
} from '../../api/practice-api';

interface Props {
  open: boolean;
  student: PracticeStudent | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function StudentDrawer({ open, student, onClose, onSuccess }: Props) {
  const { message } = App.useApp();
  const [form] = Form.useForm<StudentInput>();
  const regionId = Form.useWatch('regionId', form);

  const years = useReferenceList('academicYears');
  const directions = useReferenceList('directions');
  const courses = useReferenceList('courses');
  const regions = useReferenceList('regions');
  const districts = useDistrictsByRegion(regionId);
  const create = useStudentCreate();
  const update = useStudentUpdate();

  useEffect(() => {
    if (!open) return;
    if (student) {
      form.setFieldsValue({
        fish: student.fish,
        academicYearId: student.academicYear.id,
        directionId: student.direction.id,
        course: student.course,
        group: student.group,
        regionId: student.region.id,
        districtId: student.district.id,
      });
    } else {
      form.resetFields();
    }
  }, [open, student, form]);

  const onFinish = async (values: StudentInput) => {
    try {
      if (student) {
        await update.mutateAsync({ id: student.id, input: values });
        message.success('Talaba yangilandi');
      } else {
        await create.mutateAsync(values);
        message.success("Talaba qo'shildi");
      }
      onSuccess?.();
      onClose();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const opts = (items: { id: string; title: string }[]) =>
    items.map((i) => ({ value: i.id, label: i.title }));
  const courseOpts = courseSelectOptions(courses.data ?? []);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={480}
      title={student ? 'Talabani tahrirlash' : "Talaba qo'shish"}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
        <Form.Item name="fish" label="F.I.Sh." rules={[{ required: true, message: 'Majburiy' }]}>
          <Input placeholder="Talaba F.I.Sh." />
        </Form.Item>
        <Form.Item name="academicYearId" label="O'quv yili" rules={[{ required: true, message: 'Majburiy' }]}>
          <Select options={opts(years.data ?? [])} placeholder="O'quv yili" />
        </Form.Item>
        <Form.Item name="directionId" label="Yo'nalish" rules={[{ required: true, message: 'Majburiy' }]}>
          <Select options={opts(directions.data ?? [])} placeholder="Yo'nalish" showSearch optionFilterProp="label" />
        </Form.Item>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="course" label="Kurs" rules={[{ required: true, message: 'Majburiy' }]}>
              <Select options={courseOpts} placeholder="Kurs" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="group" label="Guruh" rules={[{ required: true, message: 'Majburiy' }]}>
              <Input placeholder="Masalan: 301-A" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="regionId" label="Viloyat" rules={[{ required: true, message: 'Majburiy' }]}>
              <Select
                options={opts(regions.data ?? [])}
                placeholder="Viloyat"
                showSearch
                optionFilterProp="label"
                onChange={() => form.setFieldValue('districtId', undefined)}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="districtId" label="Shahar / Tuman" rules={[{ required: true, message: 'Majburiy' }]}>
              <Select
                options={opts(districts.data ?? [])}
                placeholder="Tuman"
                showSearch
                optionFilterProp="label"
                disabled={!regionId}
                loading={districts.isLoading}
              />
            </Form.Item>
          </Col>
        </Row>
        <Flex justify="flex-end" gap={12} style={{ marginTop: 8 }}>
          <Button onClick={onClose}>Bekor qilish</Button>
          <Button type="primary" htmlType="submit" loading={create.isPending || update.isPending}>
            Saqlash
          </Button>
        </Flex>
      </Form>
    </Drawer>
  );
}
