import { useState } from 'react';
import { App, Button, Checkbox, Empty, Form, Input, Select, Space, Spin, Tag } from 'antd';
import Modal from '../../components/scroll-modal';
import {
  DeleteOutlined,
  NotificationOutlined,
  SendOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { PageContainer, Flex } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { getApiErrorMessage } from '@/shared/api';
import { usePermission } from '@/app/session';
import { usePosts, useCreatePost, useDeletePost } from '../../api/scientific-post-api';
import FeedPager from '../../components/feed-pager';
import { useConfirm } from '../../lib/use-confirm';
import { POST_RECIPIENTS, type PostRecipient } from '../../model/types';

interface FormValues {
  title: string;
  text: string;
  recipients: PostRecipient[];
  telegram: boolean;
}

export default function PostsPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const can = usePermission();
  const { confirmDelete } = useConfirm();

  const canCreate = can('scientificPost:create');
  const canDelete = can('scientificPost:delete');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const { data, isLoading, isFetching } = usePosts(page, pageSize);
  const posts = data?.docs ?? [];
  const createPost = useCreatePost();
  const deletePost = useDeletePost();

  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm<FormValues>();

  const openAdd = () => {
    form.resetFields();
    form.setFieldsValue({ recipients: ['all'], telegram: true });
    setModalOpen(true);
  };

  const handleSend = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    try {
      await createPost.mutateAsync({
        title: values.title,
        text: values.text,
        recipients: values.recipients,
        telegram: values.telegram,
      });
      message.success(
        values.telegram
          ? t('scientificDepartment.posts.sentTelegram')
          : t('scientificDepartment.posts.sent'),
      );
      setModalOpen(false);
      form.resetFields();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePost.mutateAsync(id);
      message.success(t('scientificDepartment.posts.deleted'));
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const recipientText = (r: PostRecipient[]) =>
    r.map((x) => t(`scientificDepartment.posts.recipient.${x}`)).join(', ');

  return (
    <PageContainer title={t('scientificDepartment.posts.title')}>
      <Flex align="center" justify="space-between" style={{ marginBottom: 16 }}>
        <Flex align="center" gap={10}>
          <NotificationOutlined style={{ fontSize: 20, color: 'var(--brand-primary)' }} />
          <span style={{ fontWeight: 600 }}>{t('scientificDepartment.posts.title')}</span>
        </Flex>
        {canCreate ? (
          <Button type="primary" icon={<SendOutlined />} onClick={openAdd} style={{ height: 40 }}>
            {t('scientificDepartment.posts.send')}
          </Button>
        ) : null}
      </Flex>

      {!canCreate ? (
        <div
          style={{
            background: 'var(--brand-primary-soft)',
            border: '1px solid color-mix(in srgb, var(--brand-primary) 25%, #fff)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            marginBottom: 16,
            fontSize: 12.5,
            color: 'var(--brand-primary)',
          }}
        >
          {t('scientificDepartment.posts.hint')}
        </div>
      ) : null}

      {isLoading ? (
        <Flex align="center" justify="center" style={{ minHeight: 200 }}>
          <Spin />
        </Flex>
      ) : posts.length === 0 ? (
        <Flex flex={1} align="center" justify="center" style={{ minHeight: 240 }}>
          <Empty description={t('scientificDepartment.posts.empty')} />
        </Flex>
      ) : (
        <FeedPager
          page={page}
          pageSize={pageSize}
          total={data?.totalDocs ?? 0}
          loading={isFetching}
          onChange={(p, ps) => {
            setPage(p);
            setPageSize(ps);
          }}
        >
        <Flex vertical gap={12}>
          {posts.map((p) => (
            <div
              key={p.id}
              style={{
                background: 'var(--color-bg-container, #fff)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg, 12px)',
                padding: '14px 18px',
              }}
            >
              <Flex align="center" justify="space-between" gap={10}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{p.title}</span>
                <span style={{ fontSize: 12, color: 'var(--color-text-mute)', whiteSpace: 'nowrap' }}>
                  {p.date}
                </span>
              </Flex>
              <div style={{ fontSize: 13, color: 'var(--color-text-soft)', margin: '8px 0' }}>
                {p.text}
              </div>
              <Flex align="center" justify="space-between" gap={10} wrap="wrap">
                <Space size={6} wrap>
                  <Tag icon={<TeamOutlined />} color="default">
                    {recipientText(p.recipients)}
                  </Tag>
                  {p.telegram ? <Tag color="blue">Telegram</Tag> : null}
                </Space>
                <Flex align="center" gap={10}>
                  <span style={{ fontSize: 12, color: 'var(--color-text-mute)' }}>{p.authorName}</span>
                  {canDelete ? (
                    <Button
                      type="text"
                      size="small"
                      icon={<DeleteOutlined style={{ color: 'var(--brand-error)' }} />}
                      onClick={() =>
                        confirmDelete(() => handleDelete(p.id), {
                          title: 'scientificDepartment.posts.deleteConfirm',
                          content: 'scientificDepartment.posts.deleteDesc',
                        })
                      }
                    />
                  ) : null}
                </Flex>
              </Flex>
            </div>
          ))}
        </Flex>
        </FeedPager>
      )}

      <Modal
        centered
        title={t('scientificDepartment.posts.send')}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSend}
        okText={t('scientificDepartment.send')}
        cancelText={t('scientificDepartment.cancel')}
        confirmLoading={createPost.isPending}
        width={560}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label={t('scientificDepartment.posts.postTitle')}
            name="title"
            rules={[{ required: true, message: t('scientificDepartment.required') }]}
          >
            <Input placeholder={t('scientificDepartment.posts.titlePlaceholder')} />
          </Form.Item>
          <Form.Item
            label={t('scientificDepartment.posts.text')}
            name="text"
            rules={[{ required: true, message: t('scientificDepartment.required') }]}
          >
            <Input.TextArea rows={4} placeholder={t('scientificDepartment.posts.textPlaceholder')} />
          </Form.Item>
          <Form.Item
            label={t('scientificDepartment.posts.recipients')}
            name="recipients"
            rules={[{ required: true, message: t('scientificDepartment.required') }]}
          >
            <Select
              mode="multiple"
              placeholder={t('scientificDepartment.posts.recipientsPlaceholder')}
              options={POST_RECIPIENTS.map((r) => ({
                value: r,
                label: t(`scientificDepartment.posts.recipient.${r}`),
              }))}
            />
          </Form.Item>
          <Form.Item name="telegram" valuePropName="checked">
            <Checkbox>{t('scientificDepartment.posts.telegram')}</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
}
