import { useEffect, useState } from 'react';
import { App, Button, Card, Empty, Flex, Input, Spin, Tabs, Typography } from 'antd';
import { DeleteOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import { PageContainer } from '@/shared/ui';
import { usePageTitle } from '@/shared/lib/page-title-store';
import { getApiErrorMessage } from '@/shared/api';
import { Can } from '@/app/session';
import { useTranslation } from '@/shared/lib/i18n';
import { useAdmissionOffer, useSaveAdmissionOffer } from '../api/offer-api';
import type { ContentLang, OfferBlock } from '../model/admission-types';
import { CONTENT_LANGS, langField } from '../model/content-lang';
import { useConfirm } from '../lib/use-confirm';
import { PageBottomGap } from '../components/page-bottom-gap';

const LANG_TAB_LABEL: Record<ContentLang, string> = {
  uz: "O'zbekcha",
  ru: 'Русский',
  en: 'English',
};

let localSeq = 0;
const newBlock = (): OfferBlock => ({
  key: `new-${(localSeq += 1)}`,
  titleUz: '',
  titleRu: '',
  titleEn: '',
  bodyUz: '',
  bodyRu: '',
  bodyEn: '',
});

export default function OfferPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { confirmDelete } = useConfirm();
  usePageTitle(t('foreignAdmission.nav.offer'));
  const { data, isLoading } = useAdmissionOffer();
  const save = useSaveAdmissionOffer();

  const [lang, setLang] = useState<ContentLang>('uz');
  const [blocks, setBlocks] = useState<OfferBlock[]>([]);

  useEffect(() => {
    if (data) setBlocks(data.blocks.length ? data.blocks : [newBlock()]);
  }, [data]);

  const patch = (key: string, field: keyof OfferBlock, value: string) =>
    setBlocks((list) => list.map((b) => (b.key === key ? { ...b, [field]: value } : b)));

  const removeBlock = (key: string) => {
    if (blocks.length <= 1) {
      message.warning(t('foreignAdmission.offer.min_one'));
      return;
    }
    confirmDelete(() => setBlocks((list) => list.filter((b) => b.key !== key)), {
      title: t('foreignAdmission.offer.delete_title'),
      content: t('foreignAdmission.crud.delete_warning'),
    });
  };

  const handleSave = async () => {
    const filled = blocks.filter((b) => b.titleUz.trim() || b.titleRu.trim() || b.titleEn.trim());
    if (!filled.length) {
      message.warning(t('foreignAdmission.offer.empty'));
      return;
    }
    const missingUz = filled.find((b) => !b.titleUz.trim());
    if (missingUz) {
      message.warning(t('foreignAdmission.offer.uz_required'));
      setLang('uz');
      return;
    }
    try {
      await save.mutateAsync(filled);
      message.success(t('foreignAdmission.offer.saved'));
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  if (isLoading) {
    return (
      <PageContainer title={t('foreignAdmission.nav.offer')}>
        <Flex justify="center" style={{ padding: 64 }}>
          <Spin size="large" />
        </Flex>
      </PageContainer>
    );
  }

  const titleKey = langField('title', lang) as keyof OfferBlock;
  const bodyKey = langField('body', lang) as keyof OfferBlock;

  return (
    <PageContainer title={t('foreignAdmission.nav.offer')}>
      <div style={{ maxWidth: 760 }}>
        <Tabs
          activeKey={lang}
          onChange={(k) => setLang(k as ContentLang)}
          items={CONTENT_LANGS.map((l) => ({ key: l, label: LANG_TAB_LABEL[l] }))}
        />

        {blocks.length === 0 ? (
          <Empty description={t('foreignAdmission.offer.empty')} />
        ) : (
          blocks.map((block, index) => (
            <Card
              key={block.key}
              size="small"
              style={{ borderRadius: 'var(--radius-lg)', marginBottom: 12 }}
              title={
                <Typography.Text strong>
                  {index + 1}. {t('foreignAdmission.offer.block_title')}
                </Typography.Text>
              }
              extra={
                <Can perform="admissionOffer:update">
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => removeBlock(block.key)}
                  />
                </Can>
              }
            >
              <Input
                value={block[titleKey]}
                onChange={(e) => patch(block.key, titleKey, e.target.value)}
                placeholder={t('foreignAdmission.offer.title_ph')}
                style={{ marginBottom: 10 }}
              />
              <Typography.Text
                style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}
              >
                {t('foreignAdmission.offer.body')}
              </Typography.Text>
              <Input.TextArea
                value={block[bodyKey]}
                onChange={(e) => patch(block.key, bodyKey, e.target.value)}
                placeholder={t('foreignAdmission.offer.body_ph')}
                autoSize={{ minRows: 4, maxRows: 10 }}
              />
            </Card>
          ))
        )}

        <Can perform="admissionOffer:update">
          <Flex justify="space-between" align="center" style={{ marginTop: 16 }}>
            <Button icon={<PlusOutlined />} onClick={() => setBlocks((l) => [...l, newBlock()])}>
              {t('foreignAdmission.offer.add')}
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={save.isPending}
              onClick={handleSave}
            >
              {t('foreignAdmission.save')}
            </Button>
          </Flex>
        </Can>

        <PageBottomGap />
      </div>
    </PageContainer>
  );
}
