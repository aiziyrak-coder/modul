import { useEffect } from 'react';
import { App, Button, Drawer, Flex, Form, Input, Select, Switch } from 'antd';
import { getApiErrorMessage } from '@/shared/api';
import type { CouncilMember } from '../../model/types';
import type { MemberInput } from '../../api/backend';
import { useMemberCreate, useMemberUpdate, useReferenceList, useUserOptions } from '../../api/council-api';

interface Props {
  open: boolean;
  member: CouncilMember | null;
  onClose: () => void;
  onSuccess?: () => void;
}

interface FormValues {
  userId: string;
  departmentId?: string;
  canVote: boolean;
}

export function MemberDrawer({ open, member, onClose, onSuccess }: Props) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const isEdit = !!member;

  const watchedDepartmentId = Form.useWatch('departmentId', form);
  const watchedUserId = Form.useWatch('userId', form);

  const departments = useReferenceList('departments');
  const users = useUserOptions(
    isEdit ? undefined : watchedDepartmentId,
    open && (isEdit || !!watchedDepartmentId),
  );
  const create = useMemberCreate();
  const update = useMemberUpdate();

  const userOptions = (users.data ?? []).map((u) => ({ value: u.id, label: u.fullName }));
  if (member && !userOptions.some((o) => o.value === member.user.id)) {
    userOptions.push({ value: member.user.id, label: member.user.fullName });
  }

  const selectedUser = (users.data ?? []).find((u) => u.id === watchedUserId);
  const positionText = isEdit
    ? (member?.position?.title ?? selectedUser?.position ?? '')
    : (selectedUser?.position ?? '');
  const academicTitleText = isEdit
    ? (member?.academicTitle?.title ?? selectedUser?.academicTitle ?? '')
    : (selectedUser?.academicTitle ?? '');

  useEffect(() => {
    if (!open) return;
    if (member) {
      form.setFieldsValue({
        userId: member.user.id,
        departmentId: member.department?.id,
        canVote: member.canVote,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ canVote: true });
    }
  }, [open, member, form]);

  const handleDepartmentChange = () => {
    form.setFieldsValue({ userId: undefined });
  };

  const onFinish = async (values: FormValues) => {
    const input: MemberInput = {
      userId: values.userId,
      departmentId: values.departmentId || undefined,
      canVote: values.canVote,
    };
    try {
      if (member) {
        await update.mutateAsync({ id: member.id, input });
        message.success("A'zo yangilandi");
      } else {
        await create.mutateAsync(input);
        message.success("A'zo qo'shildi");
      }
      onClose();
      onSuccess?.();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={520}
      title={member ? "A'zoni tahrirlash" : "A'zo qo'shish"}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
        {isEdit ? (
          <>
            <Form.Item
              name="userId"
              label="Foydalanuvchi"
              rules={[{ required: true, message: 'Majburiy' }]}
            >
              <Select
                options={userOptions}
                placeholder="Foydalanuvchini tanlang"
                showSearch
                optionFilterProp="label"
                loading={users.isLoading}
                disabled
              />
            </Form.Item>

            <Form.Item name="departmentId" label="Kafedra">
              <Select
                options={(departments.data ?? []).map((d) => ({ value: d.id, label: d.title }))}
                placeholder="Kafedra"
                showSearch
                allowClear
                optionFilterProp="label"
                loading={departments.isLoading}
                onChange={handleDepartmentChange}
              />
            </Form.Item>
          </>
        ) : (
          <>
            <Form.Item
              name="departmentId"
              label="Kafedra"
              rules={[{ required: true, message: 'Majburiy' }]}
            >
              <Select
                options={(departments.data ?? []).map((d) => ({ value: d.id, label: d.title }))}
                placeholder="Kafedrani tanlang"
                showSearch
                optionFilterProp="label"
                loading={departments.isLoading}
                onChange={handleDepartmentChange}
              />
            </Form.Item>

            <Form.Item
              name="userId"
              label="F.I.SH"
              rules={[{ required: true, message: 'Majburiy' }]}
            >
              <Select
                options={userOptions}
                placeholder={
                  watchedDepartmentId ? 'Foydalanuvchini tanlang' : 'Avval kafedrani tanlang'
                }
                showSearch
                optionFilterProp="label"
                loading={users.isLoading}
                disabled={!watchedDepartmentId}
              />
            </Form.Item>
          </>
        )}

        <Form.Item label="Lavozim">
          <Input
            value={positionText}
            placeholder={isEdit ? 'Foydalanuvchi profilidan' : 'User tanlanganda avtomatik'}
            disabled
          />
        </Form.Item>

        <Form.Item label="Ilmiy unvon">
          <Input
            value={academicTitleText}
            placeholder={isEdit ? 'Foydalanuvchi profilidan' : 'User tanlanganda avtomatik'}
            disabled
          />
        </Form.Item>

        <Form.Item name="canVote" label="Ovoz huquqi" valuePropName="checked">
          <Switch />
        </Form.Item>

        <Flex justify="flex-end" gap={12} style={{ marginTop: 8 }}>
          <Button onClick={onClose}>Bekor qilish</Button>
          <Button type="primary" htmlType="submit" loading={create.isPending || update.isPending}>
            {member ? 'Saqlash' : "Qo'shish"}
          </Button>
        </Flex>
      </Form>
    </Drawer>
  );
}
