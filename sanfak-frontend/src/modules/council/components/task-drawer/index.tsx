import { useEffect } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import { App, Button, DatePicker, Drawer, Flex, Form, Input, Select, Spin } from 'antd';
import { getApiErrorMessage } from '@/shared/api';
import { usePermission } from '@/app/session';
import type { CouncilTask } from '../../model/types';
import { useMembers, useTaskCreate, useTaskUpdate } from '../../api/council-api';

interface FormValues {
  title: string;
  desc?: string;
  assigneeId: string;
  deadline?: Dayjs | null;
}

interface Props {
  open: boolean;
  task: CouncilTask | null;
  onClose: () => void;
}

export function TaskDrawer({ open, task, onClose }: Props) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();

  const can = usePermission();
  const members = useMembers({}, open && can('councilMember:readAll'));
  const create = useTaskCreate();
  const update = useTaskUpdate();

  useEffect(() => {
    if (!open) return;
    if (task) {
      form.setFieldsValue({
        title: task.title,
        desc: task.desc ?? undefined,
        assigneeId: task.assignee.id,
        deadline: task.deadline ? dayjs(task.deadline) : null,
      });
    } else {
      form.resetFields();
    }
  }, [open, task, form]);

  const assigneeOptions = (members.data ?? []).map((m) => ({
    value: m.user.id,
    label: m.user.fullName || m.position?.title || m.id,
  }));

  const onFinish = async (values: FormValues) => {
    const input = {
      title: values.title,
      desc: values.desc || undefined,
      assigneeId: values.assigneeId,
      deadline: values.deadline ? values.deadline.toISOString() : undefined,
    };
    try {
      if (task) {
        await update.mutateAsync({ id: task.id, input });
        message.success('Topshiriq yangilandi');
      } else {
        await create.mutateAsync(input);
        message.success('Topshiriq berildi');
      }
      onClose();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={480}
      title={task ? 'Topshiriqni tahrirlash' : 'Topshiriq berish'}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
        <Form.Item name="title" label="Topshiriq nomi" rules={[{ required: true, message: 'Majburiy' }]}>
          <Input placeholder="Topshiriq nomi" />
        </Form.Item>

        <Form.Item name="desc" label="Izoh (ixtiyoriy)">
          <Input.TextArea rows={3} placeholder="Topshiriq izohi" />
        </Form.Item>

        <Form.Item name="assigneeId" label="A'zo" rules={[{ required: true, message: 'Majburiy' }]}>
          {members.isLoading ? (
            <Flex justify="center" style={{ padding: 16 }}>
              <Spin />
            </Flex>
          ) : (
            <Select
              options={assigneeOptions}
              placeholder="Kengash a'zosini tanlang"
              showSearch
              optionFilterProp="label"
            />
          )}
        </Form.Item>

        <Form.Item name="deadline" label="Muddat (ixtiyoriy)">
          <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" placeholder="Muddatni tanlang" />
        </Form.Item>

        <Flex justify="flex-end" gap={12}>
          <Button onClick={onClose}>Bekor qilish</Button>
          <Button type="primary" htmlType="submit" loading={create.isPending || update.isPending}>
            {task ? 'Saqlash' : 'Topshiriq berish'}
          </Button>
        </Flex>
      </Form>
    </Drawer>
  );
}
