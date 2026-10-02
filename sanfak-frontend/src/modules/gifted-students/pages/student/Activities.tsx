import React, { useState } from 'react';
import styled from 'styled-components';
import { CardWrap } from '../../components/common/Card';
import Badge, { statusLabel } from '../../components/common/Badge';
import type { BadgeVariant } from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import { Input, Select, SmallUpload, Textarea } from '@/shared/ui';
import { FormGroup, Label } from '../../components/common/FormElements';
import { useToast } from '../../components/common/Toast';
import Loader from '../../components/common/Loader';
import {
  useMyAchievements, useDocumentTypes,
  useCreateMyAchievement, useUpdateAchievement,
} from '../../api/gifted-api';
import type { Activity } from '../../data/types';
import {
  MdAdd, MdEdit, MdDownload, MdOpenInNew,
  MdInfoOutline, MdAssignment, MdRemove,
} from '../../icons';
import { safeExternalLink } from '../../lib/safe-link';

const FILTER_TABS = [
  { key: 'all', label: 'Barchasi' },
  { key: 'approved', label: 'Tasdiqlangan' },
  { key: 'pending', label: 'Kutmoqda' },
  { key: 'rejected', label: 'Rad etilgan' },
];

interface ActivityForm {
  docTypeId: string;
  title: string;
  note: string;
  fileName: string;
  link: string;
}

const emptyForm: ActivityForm = { docTypeId: '', title: '', note: '', fileName: '', link: '' };

export default function StudentActivities() {
  const { toast } = useToast();
  const { data: activities = [], isLoading } = useMyAchievements();
  const { data: docTypes = [] } = useDocumentTypes();
  const createAchievement = useCreateMyAchievement();
  const updateAchievement = useUpdateAchievement();
  const [filterStatus, setFilterStatus] = useState('all');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState<Activity | null>(null);
  const [noteOf, setNoteOf] = useState<Activity | null>(null);
  const [form, setForm] = useState<ActivityForm>(emptyForm);
  const [fileObj, setFileObj] = useState<File | null>(null);

  const selectedDocType = docTypes.find(d => d.id === form.docTypeId);
  const saving = createAchievement.isPending || updateAchievement.isPending;
  const canSave = Boolean(form.docTypeId && form.title.trim()) && !saving;

  const filtered = filterStatus === 'all'
    ? activities
    : activities.filter(a => a.status === filterStatus);

  const grouped = Object.entries(
    filtered.reduce<Record<string, Activity[]>>((acc, act) => {
      const key = act.criteriaName || 'Boshqa';
      if (!acc[key]) acc[key] = [];
      acc[key]!.push(act);
      return acc;
    }, {})
  );

  const openAdd = () => { setForm(emptyForm); setFileObj(null); setAddModal(true); };
  const openEdit = (act: Activity) => {
    setForm({
      docTypeId: act.criteriaId || '',
      title: act.title || '',
      note: act.description || act.note || '',
      fileName: act.fileName || '',
      link: act.link || '',
    });
    setFileObj(null);
    setEditModal(act);
  };
  const closeForm = () => { setAddModal(false); setEditModal(null); setForm(emptyForm); setFileObj(null); };

  const handleSave = () => {
    if (!canSave || saving) return;
    createAchievement.mutate({
      criteriaId: form.docTypeId,
      title: form.title.trim(),
      description: form.note.trim(),
      link: form.link || '',
      file: fileObj,
    }, {
      onSuccess: () => { closeForm(); toast("Faoliyat muvaffaqiyatli yuborildi!", 'success'); },
      onError: () => toast("Yuborishda xatolik yuz berdi", 'error'),
    });
  };

  const handleUpdate = () => {
    if (!editModal || saving) return;
    updateAchievement.mutate({ id: editModal.id, data: {
      criteriaId: form.docTypeId,
      title: form.title.trim(),
      description: form.note.trim(),
      link: form.link,
      file: fileObj,
    } }, {
      onSuccess: () => { closeForm(); toast("Faoliyat yangilandi", 'success'); },
      onError: () => toast("Yangilashda xatolik yuz berdi", 'error'),
    });
  };

  return (
    <>
      <SectionCard>
        <SectionHead>
          <MdAssignment />
          Faoliyat va hujjatlarim
          <SectionCount>{activities.length}</SectionCount>
          <AddBtn onClick={openAdd}><MdAdd /> + Qo'shish</AddBtn>
        </SectionHead>

        <FilterRow>
          {FILTER_TABS.map(t => (
            <FilterTab key={t.key} $active={filterStatus === t.key} onClick={() => setFilterStatus(t.key)}>
              {t.label}
            </FilterTab>
          ))}
        </FilterRow>

        {isLoading ? (
          <Loader text="Faoliyatlar yuklanmoqda..." />
        ) : filtered.length === 0 ? (
          <SectionEmpty>
            {filterStatus === 'all' ? 'Hali faoliyat yuborilmagan' : 'Bu bo\'limda faoliyat yo\'q'}
          </SectionEmpty>
        ) : (
          <TableWrap>
            <InnerTable>
              <thead>
                <tr>
                  <InnerTh>Sarlavha</InnerTh>
                  <InnerTh>Izoh</InnerTh>
                  <InnerTh style={{ width: 60, textAlign: 'center' }}>Fayl</InnerTh>
                  <InnerTh style={{ width: 60, textAlign: 'center' }}>Havola</InnerTh>
                  <InnerTh style={{ width: 110 }}>Sana</InnerTh>
                  <InnerTh style={{ width: 150 }}>Status</InnerTh>
                  <InnerTh style={{ width: 80 }}>Amallar</InnerTh>
                </tr>
              </thead>
              <tbody>
                {grouped.map(([groupName, groupActs], idx) => {
                  const isOpen = !!openGroups[groupName];
                  return (
                    <React.Fragment key={groupName}>
                      {idx > 0 && <SpacerRow><td colSpan={7} /></SpacerRow>}
                      <GroupRow onClick={() => setOpenGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }))}>
                        <td colSpan={7}>
                          <GroupRowInner>
                            <GroupRowTitle>{groupName} ({groupActs.length})</GroupRowTitle>
                            <AccordionToggle $open={isOpen}>{isOpen ? <MdRemove /> : <MdAdd />}</AccordionToggle>
                          </GroupRowInner>
                        </td>
                      </GroupRow>
                      {isOpen && groupActs.map(act => (
                        <InnerTr key={act.id}>
                          <InnerTd><ActName>{act.title}</ActName></InnerTd>
                          <InnerTd>
                            {act.description || act.note
                              ? <IzohCell>{act.description || act.note}</IzohCell>
                              : <Dash>—</Dash>
                            }
                          </InnerTd>
                          <InnerTd style={{ textAlign: 'center' }}>
                            {act.fileName
                              ? <ActIconBtn as="a" href={act.fileUrl || '#'} download={act.fileName} title={act.fileName} $green>
                                  <MdDownload />
                                </ActIconBtn>
                              : <Dash>—</Dash>
                            }
                          </InnerTd>
                          <InnerTd style={{ textAlign: 'center' }}>
                            {safeExternalLink(act.link)
                              ? <ActIconBtn as="a" href={safeExternalLink(act.link)!} target="_blank" rel="noopener noreferrer" title={act.link}>
                                  <MdOpenInNew />
                                </ActIconBtn>
                              : <Dash>—</Dash>
                            }
                          </InnerTd>
                          <InnerTd><Meta>{act.submittedAt}</Meta></InnerTd>
                          <InnerTd>
                            <StatusCell>
                              <Badge variant={act.status as BadgeVariant}>{statusLabel[act.status]}</Badge>
                              {(act.status === 'rejected' || act.reviewHistory.length > 0) && (
                                <InfoBtn
                                  title={act.status === 'rejected' ? 'Rad etish sababi' : 'Oldingi qarorlar'}
                                  onClick={(e: React.MouseEvent) => { e.stopPropagation(); setNoteOf(act); }}
                                >
                                  <MdInfoOutline />
                                </InfoBtn>
                              )}
                            </StatusCell>
                          </InnerTd>
                          <InnerTd>
                            {(act.status === 'pending' || act.status === 'rejected') && (
                              <Actions>
                                <ActionBtn onClick={(e: React.MouseEvent) => { e.stopPropagation(); openEdit(act); }} title={act.status === 'rejected' ? 'Tahrirlab qayta yuborish' : 'Tahrirlash'}>
                                  <MdEdit />
                                </ActionBtn>
                              </Actions>
                            )}
                          </InnerTd>
                        </InnerTr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </InnerTable>
          </TableWrap>
        )}
      </SectionCard>

      <Modal
        open={addModal || !!editModal}
        onClose={closeForm}
        title={editModal ? "Faoliyatni tahrirlash" : "Yangi faoliyat qo'shish"}
        footer={
          <>
            <Button variant="secondary" onClick={closeForm} disabled={saving}>Bekor qilish</Button>
            <Button onClick={editModal ? handleUpdate : handleSave} disabled={!canSave}>
              {saving ? 'Saqlanmoqda…' : 'Saqlash'}
            </Button>
          </>
        }
      >
        {editModal?.status === 'rejected' && (
          <RejectHint>
            <RejectHintTitle>Rad etish sababi</RejectHintTitle>
            {editModal.reviewNote || "Sabab ko'rsatilmagan"}
          </RejectHint>
        )}
        <FormGroup>
          <Label>Faoliyat va hujjat turi *</Label>
          <Select
            value={form.docTypeId}
            showSearch
            optionFilterProp="label"
            style={{ width: '100%' }}
            onChange={(value) => setForm(f => ({ ...f, docTypeId: value }))}
            options={[
              { value: '', label: '— Tanlang —' },
              ...docTypes.filter(d => d.active).map(d => ({ value: String(d.id), label: d.title })),
            ]}
          />
          {selectedDocType && (
            <DocTypeDesc>{selectedDocType.description}</DocTypeDesc>
          )}
        </FormGroup>

        <FormGroup>
          <Label>Sarlavha *</Label>
          <Input
            value={form.title}
            style={{ width: '100%' }}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Faoliyat sarlavhasini kiriting..."
          />
        </FormGroup>

        <FormGroup>
          <Label>Izoh (ixtiyoriy)</Label>
          <Textarea
            value={form.note}
            onChange={(value) => setForm(f => ({ ...f, note: value }))}
            placeholder="Qo'shimcha izoh..."
            rows={3}
          />
        </FormGroup>

        <FormGroup>
          <Label>Fayl</Label>
          <SmallUpload
            accept=".pdf,.jpg,.jpeg,.png"
            placeholder="Fayl yuklash uchun bosing"
            value={form.fileName || null}
            width="100%"
            onFileSelect={(picked: File) => {
              setFileObj(picked);
              setForm(f => ({ ...f, fileName: picked.name }));
            }}
          />
          <UploadHint>PDF / JPG / PNG · Maks. 10 MB</UploadHint>
        </FormGroup>

        <FormGroup>
          <Label>Havola (ixtiyoriy)</Label>
          <Input
            value={form.link}
            style={{ width: '100%' }}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, link: e.target.value }))}
            placeholder="https://..."
          />
        </FormGroup>
      </Modal>

      <Modal
        open={!!noteOf}
        onClose={() => setNoteOf(null)}
        title={noteOf?.status === 'rejected' ? 'Rad etish sababi' : 'Oldingi qarorlar'}
        footer={<Button variant="secondary" onClick={() => setNoteOf(null)}>Yopish</Button>}
      >
        {noteOf?.status === 'rejected' && (
          <RejectNoteBox>{noteOf.reviewNote || "Sabab ko'rsatilmagan"}</RejectNoteBox>
        )}
        {!!noteOf?.reviewHistory.length && (
          <>
            <HistoryTitle>
              {noteOf.status === 'rejected' ? 'Avvalgi qarorlar' : 'Bu yozuv avval ko’rib chiqilgan'}
            </HistoryTitle>
            {[...noteOf.reviewHistory].reverse().map((h, i) => (
              <HistoryRow key={i}>
                <HistoryHead>
                  <Badge variant={h.status as BadgeVariant}>{statusLabel[h.status] ?? h.status}</Badge>
                  {h.reviewedAt && <Meta>{h.reviewedAt.split('T')[0]}</Meta>}
                </HistoryHead>
                <HistoryNote>{h.note || "Izoh yozilmagan"}</HistoryNote>
              </HistoryRow>
            ))}
          </>
        )}
      </Modal>
    </>
  );
}

const SectionCard = styled(CardWrap)`padding: 0; overflow: hidden;`;

const SectionHead = styled.div`
  display: flex; align-items: center; gap: 8px;
  padding: 14px 18px;
  font-size: 14px; font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
  background: var(--brand-primary-soft);
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  svg { font-size: 18px; color: ${({ theme }) => theme.colors.primary}; }
`;

const SectionCount = styled.span`
  background: ${({ theme }) => theme.colors.primaryLight};
  color: ${({ theme }) => theme.colors.primary};
  font-size: 11px; font-weight: 700;
  padding: 2px 8px; border-radius: 999px;
`;

const AddBtn = styled.button`
  margin-left: auto;
  display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 14px; border-radius: ${({ theme }) => theme.radius.md};
  font-size: 13px; font-weight: 600;
  background: ${({ theme }) => theme.colors.primary};
  color: white; transition: opacity 0.15s;
  &:hover { opacity: 0.85; }
  svg { font-size: 17px; }
`;

const FilterRow = styled.div`
  display: flex; gap: 4px;
  padding: 12px 18px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const FilterTab = styled.button<{ $active: boolean }>`
  padding: 6px 14px; border-radius: 999px;
  font-size: 13px; font-weight: 500; white-space: nowrap;
  border: 1px solid ${({ $active, theme }) => $active ? theme.colors.primary : theme.colors.border};
  background: ${({ $active, theme }) => $active ? theme.colors.primary : 'white'};
  color: ${({ $active, theme }) => $active ? 'white' : theme.colors.textMuted};
  transition: all 0.15s;
`;

const SectionEmpty = styled.p`
  padding: 32px 18px; font-size: 13px;
  color: ${({ theme }) => theme.colors.textMuted}; text-align: center;
`;

const TableWrap = styled.div`overflow-x: auto;`;

const InnerTable = styled.table`width: 100%; border-collapse: collapse;`;

const InnerTh = styled.th`
  padding: 8px 14px; text-align: left;
  font-size: 11px; font-weight: 600;
  color: ${({ theme }) => theme.colors.textMuted};
  background: ${({ theme }) => theme.colors.bg};
  text-transform: uppercase; letter-spacing: 0.04em;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  white-space: nowrap;
`;

const SpacerRow = styled.tr`
  height: 5px; background: white;
  td { border: none; padding: 0; }
`;

const GroupRow = styled.tr`
  background: ${({ theme }) => theme.colors.bg};
  cursor: pointer; user-select: none;
  &:hover { background: ${({ theme }) => theme.colors.primaryLight}; }
  td {
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    border-top: 1px solid ${({ theme }) => theme.colors.border};
  }
`;

const GroupRowInner = styled.div`
  display: flex; align-items: center; gap: 8px;
  padding: 11px 14px;
`;

const GroupRowTitle = styled.span`
  font-size: 13px; font-weight: 700;
  color: ${({ theme }) => theme.colors.text}; flex: 1;
`;

const AccordionToggle = styled.span<{ $open: boolean }>`
  display: flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; border-radius: 4px; flex-shrink: 0;
  font-size: 16px;
  color: ${({ $open, theme }) => $open ? theme.colors.primary : theme.colors.textMuted};
  background: ${({ $open, theme }) => $open ? theme.colors.primaryLight : 'white'};
  border: 1px solid ${({ $open, theme }) => $open ? theme.colors.primary : theme.colors.border};
  transition: all 0.15s;
`;

const InnerTr = styled.tr`
  background: white;
  &:not(:last-child) td { border-bottom: 1px solid ${({ theme }) => theme.colors.border}; }
  &:hover { background: ${({ theme }) => theme.colors.primaryLight}; }
`;

const InnerTd = styled.td`
  padding: 10px 14px; font-size: 13px;
  color: ${({ theme }) => theme.colors.text}; vertical-align: middle;
`;

const ActName = styled.div`font-size: 13px; font-weight: 600;`;

const IzohCell = styled.div`
  font-size: 12px; color: ${({ theme }) => theme.colors.textMuted};
  overflow: hidden; display: -webkit-box;
  -webkit-line-clamp: 2; -webkit-box-orient: vertical; max-width: 240px;
`;

const Dash = styled.span`color: #CBD5E1;`;

const Meta = styled.span`font-size: 12px; color: ${({ theme }) => theme.colors.textMuted};`;

const ActIconBtn = styled.button<{ $green?: boolean }>`
  width: 28px; height: 28px; border-radius: 6px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 16px;
  color: ${({ $green }) => $green ? 'var(--brand-primary)' : '#3498DB'};
  background: ${({ $green }) => $green ? 'var(--brand-primary-soft)' : '#EBF5FB'};
  text-decoration: none; transition: all 0.15s;
  &:hover { opacity: 0.75; }
`;

const StatusCell = styled.div`display: inline-flex; align-items: center; gap: 5px;`;

const InfoBtn = styled.button`
  flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  font-size: 20px; color: #DC2626; background: transparent;
  transition: opacity 0.15s; &:hover { opacity: 0.7; }
`;

const Actions = styled.div`display: flex; gap: 4px;`;

const ActionBtn = styled.button<{ $danger?: boolean }>`
  width: 28px; height: 28px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center; font-size: 15px;
  color: ${({ $danger, theme }) => $danger ? theme.colors.danger : theme.colors.textMuted};
  background: ${({ $danger, theme }) => $danger ? theme.colors.dangerLight : theme.colors.bg};
  transition: all 0.15s; &:hover { opacity: 0.7; }
`;

const DocTypeDesc = styled.p`
  margin-top: 6px; padding: 8px 12px;
  font-size: 12px; color: ${({ theme }) => theme.colors.textMuted}; line-height: 1.5;
  background: ${({ theme }) => theme.colors.bg};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
`;

const UploadHint = styled.p`font-size: 11px; color: #7F8C8D;`;

const RejectNoteBox = styled.p`
  font-size: 14px; color: #1E293B; line-height: 1.6;
  padding: 12px 16px;
  background: #FEF2F2; border-left: 3px solid #EF4444; border-radius: 6px;
`;

const RejectHint = styled.div`
  margin-bottom: 16px;
  padding: 12px 16px;
  font-size: 13px; color: #1E293B; line-height: 1.6;
  background: #FEF2F2; border-left: 3px solid #EF4444; border-radius: 6px;
  overflow-wrap: anywhere;
`;

const RejectHintTitle = styled.div`
  margin-bottom: 4px;
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.04em; color: #B91C1C;
`;

const HistoryTitle = styled.h4`
  margin: 18px 0 8px;
  font-size: 12px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.04em; color: #7F8C8D;
`;

const HistoryRow = styled.div`
  padding: 10px 14px;
  border-left: 3px solid #E8ECEF;
  background: #F9FAFB;
  border-radius: 6px;
  & + & { margin-top: 8px; }
`;

const HistoryHead = styled.div`
  display: flex; align-items: center; gap: 8px; margin-bottom: 6px;
`;

const HistoryNote = styled.p`
  margin: 0;
  font-size: 13px; color: #1E293B; line-height: 1.55;
  overflow-wrap: anywhere;
`;
