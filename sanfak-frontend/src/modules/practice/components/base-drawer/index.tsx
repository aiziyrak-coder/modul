import { useEffect, useMemo, useState } from 'react';
import { App, Button, Col, Drawer, Flex, Form, Input, InputNumber, Row, Select } from 'antd';
import { getApiErrorMessage } from '@/shared/api';
import { JshshirInput, PhoneInput, isPhoneComplete } from '@/shared/ui';
import type { PracticeBase, RepresentativeRef } from '../../model/types';
import type { BaseInput } from '../../api/mock-store';
import {
  useBaseCreate,
  useBaseUpdate,
  useDistrictsByRegion,
  useReferenceList,
  useRepresentativeUsers,
} from '../../api/practice-api';

interface Props {
  open: boolean;
  base: PracticeBase | null;
  onClose: () => void;
  onSuccess?: () => void;
}

interface FormValues extends Omit<BaseInput, 'capacity'> {
  capacity?: number | null;
}

export function BaseDrawer({ open, base, onClose, onSuccess }: Props) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const regionId = Form.useWatch('regionId', form);

  const orgTypes = useReferenceList('orgTypes');
  const regions = useReferenceList('regions');
  const districts = useDistrictsByRegion(regionId);

  const [userSearch, setUserSearch] = useState('');
  const [debouncedUserSearch, setDebouncedUserSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedUserSearch(userSearch), 300);
    return () => clearTimeout(t);
  }, [userSearch]);
  const repUsers = useRepresentativeUsers(debouncedUserSearch);

  const [knownUsers, setKnownUsers] = useState<Record<string, RepresentativeRef>>({});
  useEffect(() => {
    if (!repUsers.data?.length) return;
    setKnownUsers((prev) => {
      const next = { ...prev };
      for (const u of repUsers.data) next[u.id] = u;
      return next;
    });
  }, [repUsers.data]);

  const create = useBaseCreate();
  const update = useBaseUpdate();

  useEffect(() => {
    if (!open) return;
    setUserSearch('');
    setDebouncedUserSearch('');
    if (base) {
      form.setFieldsValue({
        title: base.title,
        orgTypeId: base.orgType.id,
        stir: base.stir,
        regionId: base.region.id,
        districtId: base.district.id,
        address: base.address,
        headName: base.headName,
        headJshshir: base.headJshshir,
        headPhone: base.headPhone,
        email: base.email ?? '',
        capacity: base.capacity ?? undefined,
        responsibleUserIds: base.responsibleUsers.map((u) => u.id),
      });
      setKnownUsers((prev) => {
        const next = { ...prev };
        for (const u of base.responsibleUsers) next[u.id] = u;
        return next;
      });
    } else {
      form.resetFields();
    }
  }, [open, base, form]);

  const watchedUserIds: string[] | undefined = Form.useWatch('responsibleUserIds', form);
  const representativeOptions = useMemo(() => {
    const byId = new Map<string, RepresentativeRef>();
    for (const u of repUsers.data ?? []) byId.set(u.id, u);
    for (const id of watchedUserIds ?? []) {
      if (!byId.has(id) && knownUsers[id]) byId.set(id, knownUsers[id]);
    }
    return Array.from(byId.values()).map((u) => ({
      value: u.id,
      label: [u.firstName, u.lastName].filter(Boolean).join(' ') + (u.position ? ` — ${u.position}` : ''),
    }));
  }, [repUsers.data, watchedUserIds, knownUsers]);

  const onFinish = async (values: FormValues) => {
    const input: BaseInput = {
      title: values.title,
      orgTypeId: values.orgTypeId,
      stir: values.stir,
      regionId: values.regionId,
      districtId: values.districtId,
      address: values.address,
      headName: values.headName,
      headJshshir: values.headJshshir,
      headPhone: values.headPhone,
      email: values.email || null,
      capacity: values.capacity ?? null,
      responsibleUserIds: values.responsibleUserIds ?? [],
    };
    try {
      if (base) {
        await update.mutateAsync({ id: base.id, input });
        message.success("Baza yangilandi");
      } else {
        await create.mutateAsync(input);
        message.success("Baza qo'shildi");
      }
      onSuccess?.();
      onClose();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const opts = (items: { id: string; title: string }[]) =>
    items.map((i) => ({ value: i.id, label: i.title }));

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={520}
      title={base ? 'Bazani tahrirlash' : "Baza qo'shish"}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
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

        <Form.Item name="address" label="Manzil" rules={[{ required: true, message: 'Majburiy' }]}>
          <Input placeholder="Manzil" />
        </Form.Item>

        <Form.Item name="title" label="Tashkilot nomi" rules={[{ required: true, message: 'Majburiy' }]}>
          <Input placeholder="Tashkilot nomi" />
        </Form.Item>

        <Form.Item name="orgTypeId" label="Tashkilot turi" rules={[{ required: true, message: 'Majburiy' }]}>
          <Select options={opts(orgTypes.data ?? [])} placeholder="Turi" showSearch optionFilterProp="label" />
        </Form.Item>

        <Form.Item
          name="stir"
          label="STIR (9 xonali)"
          rules={[
            { required: true, message: 'Majburiy' },
            { pattern: /^\d{9}$/, message: '9 xonali raqam' },
          ]}
        >
          <Input placeholder="123456789" maxLength={9} />
        </Form.Item>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="headName" label="Rahbar F.I.Sh." rules={[{ required: true, message: 'Majburiy' }]}>
              <Input placeholder="Rahbar F.I.Sh." />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="headJshshir"
              label="Rahbar JSHSHIR (14 xonali)"
              rules={[
                { required: true, message: 'Majburiy' },
                { pattern: /^\d{14}$/, message: '14 xonali raqam' },
              ]}
            >
              <JshshirInput placeholder="12345678901234" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item
              name="headPhone"
              label="Telefon"
              rules={[
                { required: true, message: 'Majburiy' },
                {
                  validator: (_, value) =>
                    !value || isPhoneComplete(value)
                      ? Promise.resolve()
                      : Promise.reject(new Error("To'liq raqam kiriting")),
                },
              ]}
            >
              <PhoneInput />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="email" label="Email (ixtiyoriy)" rules={[{ type: 'email', message: 'Email xato' }]}>
              <Input placeholder="email@example.uz" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="capacity" label="Qabul qila oladigan talabalar soni (ixtiyoriy)">
          <InputNumber min={0} style={{ width: '100%' }} placeholder="Masalan: 50" />
        </Form.Item>

        <Form.Item name="responsibleUserIds" label="Mas'ul vakillar (ixtiyoriy)">
          <Select
            mode="multiple"
            placeholder="F.I.Sh bo'yicha qidiring"
            showSearch
            filterOption={false}
            onSearch={setUserSearch}
            loading={repUsers.isFetching}
            notFoundContent={repUsers.isFetching ? 'Qidirilmoqda...' : "Hech kim topilmadi"}
            options={representativeOptions}
          />
        </Form.Item>

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
