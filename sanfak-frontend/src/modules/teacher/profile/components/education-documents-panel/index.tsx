import { useRef, useState } from 'react';
import {
  DeleteOutlined,
  DownloadOutlined,
  MoreOutlined,
  PaperClipOutlined,
  PlusOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { App, Dropdown, LineTab, Note, useConfirm } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { EDUCATION_TABS, type DegreesByType, type EducationTabKey } from '../../model/types';
import { useDeleteMyDegree, useUploadMyDegrees, getApiErrorMessage } from '../../api/teacher-profile-api';
import { AddBtn, DocRow, EmptyDocs, MoreTrigger, UploadPlaceholder, UploadRow, Wrap } from './style';

const TAB_LABEL_KEY: Record<EducationTabKey, string> = {
  bachelorDegree: 'teacher.profile.education.tab.bachelor',
  masterDegree: 'teacher.profile.education.tab.master',
  scientificDegree: 'teacher.profile.education.tab.scientificDegree',
  scientificTitle: 'teacher.profile.education.tab.scientificTitle',
};

const DOC_PLACEHOLDER_KEY: Record<EducationTabKey, string> = {
  bachelorDegree: 'teacher.profile.education.docPlaceholder.bachelor',
  masterDegree: 'teacher.profile.education.docPlaceholder.master',
  scientificDegree: 'teacher.profile.education.docPlaceholder.scientificDegree',
  scientificTitle: 'teacher.profile.education.docPlaceholder.scientificTitle',
};

const ACCEPT = '.pdf,.doc,.docx,.jpg,.jpeg,.png';
const MAX_COUNT = 10;

interface IProps {
  editing: boolean;
  degrees: DegreesByType;
}

const EducationDocumentsPanel = ({ editing, degrees }: IProps) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { confirmDelete } = useConfirm();
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<EducationTabKey>('bachelorDegree');

  const uploadMutation = useUploadMyDegrees();
  const deleteMutation = useDeleteMyDegree();

  const activeDocs = degrees[activeTab];
  const canAddMore = activeDocs.length < MAX_COUNT;

  const openPicker = () => inputRef.current?.click();

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    const room = Math.max(MAX_COUNT - activeDocs.length, 0);
    if (room === 0) return;
    try {
      await uploadMutation.mutateAsync({ type: activeTab, files: files.slice(0, room) });
      message.success(t('teacher.profile.education.uploaded'));
    } catch (err) {
      message.error(getApiErrorMessage(err));
    }
  };

  const handleDelete = (fileId: string) => {
    confirmDelete(
      async () => {
        try {
          await deleteMutation.mutateAsync({ type: activeTab, fileId });
          message.success(t('teacher.profile.education.deleted'));
        } catch (err) {
          message.error(getApiErrorMessage(err));
        }
      },
      {
        title: 'teacher.profile.education.deleteConfirmTitle',
        content: 'teacher.profile.education.deleteConfirmSubtitle',
      },
    );
  };

  return (
    <div>
      <LineTab
        activeTab={activeTab}
        setActiveTab={(k) => setActiveTab(k as EducationTabKey)}
        data={EDUCATION_TABS.map((key) => ({ key, label: t(TAB_LABEL_KEY[key]) }))}
      />

      {editing ? (
        <Note
          warning
          text={t('teacher.profile.education.uploadNote.title')}
          margin="var(--space-3) 0"
        />
      ) : null}

      <Wrap>
        {activeDocs.length === 0 && !editing ? (
          <EmptyDocs>{t('teacher.profile.education.noDocuments')}</EmptyDocs>
        ) : (
          activeDocs.map((doc) =>
            editing ? (
              <DocRow key={doc.id} as="div">
                <PaperClipOutlined className="icon" />
                <span className="name">{doc.title}</span>
                <Dropdown
                  trigger={['click']}
                  menu={{
                    items: [
                      {
                        key: 'download',
                        label: t('teacher.profile.education.menu.download'),
                        icon: <DownloadOutlined />,
                        onClick: () => window.open(doc.path, '_blank', 'noreferrer'),
                      },
                      {
                        key: 'delete',
                        label: t('teacher.profile.education.menu.delete'),
                        icon: <DeleteOutlined />,
                        danger: true,
                        onClick: () => handleDelete(doc.id),
                      },
                    ],
                  }}
                >
                  <MoreTrigger type="button" aria-label={t('teacher.profile.education.menu.more')}>
                    <MoreOutlined />
                  </MoreTrigger>
                </Dropdown>
              </DocRow>
            ) : (
              <DocRow key={doc.id} href={doc.path} target="_blank" rel="noreferrer" download>
                <PaperClipOutlined className="icon" />
                <span className="name">{doc.title}</span>
              </DocRow>
            ),
          )
        )}

        {editing && canAddMore ? (
          <UploadRow>
            <UploadOutlined className="icon" />
            <UploadPlaceholder
              type="button"
              onClick={openPicker}
              disabled={uploadMutation.isPending}
            >
              {t(DOC_PLACEHOLDER_KEY[activeTab])}
            </UploadPlaceholder>
            <AddBtn
              type="button"
              onClick={openPicker}
              disabled={uploadMutation.isPending}
              aria-label={t('teacher.profile.education.add')}
            >
              <PlusOutlined />
            </AddBtn>
          </UploadRow>
        ) : null}

        <input ref={inputRef} type="file" multiple hidden accept={ACCEPT} onChange={(e) => void handleFiles(e)} />
      </Wrap>
    </div>
  );
};

export default EducationDocumentsPanel;
