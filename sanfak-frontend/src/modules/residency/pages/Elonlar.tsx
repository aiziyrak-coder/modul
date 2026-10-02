import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import styled, { css } from 'styled-components';
import { App, DatePicker, Input, Select, Textarea } from '@/shared/ui';
import {
  MdAdd,
  MdAccessTime,
  MdAttachFile,
  MdCalendarToday,
  MdCampaign,
  MdDelete,
  MdEdit,
  MdPerson,
  MdWarning,
  MdBarChart,
} from '../icons';
import {
  PageTitle,
  FilterBar,
  Btn,
  FormGroup,
  Label,
} from '../components/common/FormElements';
import {
  academicYearValue,
  useAcademicYears,
  useCourses,
  withCurrent,
} from '../api/reference-api';
import Badge from '../components/common/Badge';
import Modal, { ModalBody, ModalFooter } from '../components/common/Modal';
import AttachmentUploader from '../components/common/AttachmentUploader';
import type { AttachmentUploaderHandle } from '../components/common/AttachmentUploader';
import AttachmentList from '../components/common/AttachmentList';
import MultiChipSelect from '../components/common/MultiChipSelect';
import ReadStatsModal from '../components/common/ReadStatsModal';
import { useSpecialties } from '../api/residency-api';
import {
  useAnnouncements,
  useCreateAnnouncement,
  useUpdateAnnouncement,
  useDeleteAnnouncement,
  useDeleteAttachment,
  useMarkAnnouncementRead,
} from '../api/announcement-api';
import type { AnnouncementInput } from '../api/announcement-api';
import {
  AUDIENCES,
  AUDIENCE_LABEL,
  AUDIENCE_VARIANT,
} from '../api/announcement-types';
import type { Announcement, Attachment, Audience } from '../api/announcement-types';
import { formatDate } from '../api/curriculum-types';
import { usePermission } from '@/app/session';
import { getApiErrorMessage } from '@/shared/api';


interface FormState {
  title: string;
  audience: Audience;
  content: string;
  academicYear: string;
  deadline: string;
  targetCourses: number[];
  targetSpecialties: string[];
}

const EMPTY: FormState = {
  title: '',
  audience: 'umumiy',
  content: '',
  academicYear: '',
  deadline: '',
  targetCourses: [],
  targetSpecialties: [],
};

const AUDIENCE_PROGRAM: Partial<Record<Audience, 'magistratura' | 'ordinatura'>> = {
  magistratura: 'magistratura',
  ordinatura: 'ordinatura',
};

const supportsTargeting = (a: Audience) => a !== 'kafedra_mudirlari';

const toDateInput = (value: string | null): string => (value ? value.slice(0, 10) : '');

function shortName(full: string | null): string {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return '—';
  const initials = parts
    .slice(1)
    .map((p) => `${p.charAt(0).toUpperCase()}.`)
    .join('');
  return initials ? `${first} ${initials}` : first;
}

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px;
`;

const Card = styled.div`
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.colors.white};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.lg};
  box-shadow: ${({ theme }) => theme.shadow.sm};
  overflow: hidden;
  transition: box-shadow 0.15s;
  &:hover {
    box-shadow: ${({ theme }) => theme.shadow.md};
  }
`;

const CardTop = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 14px 18px 12px;
  background: ${({ theme }) => theme.colors.bg};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const CardIcon = styled.div`
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.white};
`;

const CardTitle = styled.div`
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  color: ${({ theme }) => theme.colors.text};
`;

const CardBody = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  padding: 14px 18px;
`;

const CardText = styled.div<{ $expanded: boolean }>`
  font-size: 13px;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.textMuted};
  white-space: pre-line;
  ${({ $expanded }) =>
    $expanded
      ? ''
      : css`
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        `}
`;

const ExpandBtn = styled.button`
  align-self: flex-start;
  margin-top: 10px;
  padding: 0;
  background: none;
  border: none;
  font-size: 12px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.primary};
  cursor: pointer;
  &:hover {
    text-decoration: underline;
  }
`;

const CardMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 14px;
  margin-top: auto;
  padding-top: 12px;
`;

const MetaItem = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const DeadlineItem = styled(MetaItem)`
  font-weight: 500;
  color: ${({ theme }) => theme.colors.warning};
`;

const CardActions = styled.div`
  display: flex;
  gap: 6px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`;

const EmptyBox = styled.div`
  grid-column: 1 / -1;
  padding: 48px 0;
  text-align: center;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const WarnRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.warning};
`;

const HintText = styled.span`
  font-weight: 400;
  color: ${({ theme }) => theme.colors.textLight};
`;

const ModalGrid2 = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
`;

const TargetLabel = styled.div`
  margin: 8px 0 5px;
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const TargetNote = styled.div`
  margin-top: 8px;
  padding: 7px 10px;
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.colors.infoLight};
  font-size: 11.5px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.text};
`;

const TargetChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: ${({ theme }) => theme.radius.full};
  background: ${({ theme }) => theme.colors.infoLight};
  border: 1px solid ${({ theme }) => theme.colors.infoBorder};
  font-size: 11px;
  color: ${({ theme }) => theme.colors.text};
`;

const TargetRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 10px;
`;

const NewDot = styled.span`
  display: inline-block;
  width: 7px;
  height: 7px;
  margin-right: 6px;
  vertical-align: middle;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.primary};
`;

const AttachmentsBlock = styled.div`
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`;

const AttachmentsTitle = styled.div`
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textMuted};
`;

export default function Elonlar() {
  const { message } = App.useApp();

  const { data: academicYears = [] } = useAcademicYears();
  const { data: courses = [] } = useCourses();

  const can = usePermission();
  const canWrite = can('residencyAnnouncement:create');

  const [fAudience, setFAudience] = useState('');
  const [fYear, setFYear] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [searchParams, setSearchParams] = useSearchParams();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [toDelete, setToDelete] = useState<Announcement | null>(null);

  const [savedId, setSavedId] = useState<string | null>(null);
  const [statsFor, setStatsFor] = useState<Announcement | null>(null);
  const [modalAttachments, setModalAttachments] = useState<Attachment[]>([]);
  const uploaderRef = useRef<AttachmentUploaderHandle>(null);

  const { data: rows = [], isLoading } = useAnnouncements({
    audience: fAudience || undefined,
    academicYear: fYear || undefined,
  });

  const { data: specialties = [], isLoading: specLoading } = useSpecialties();
  const specialtyTitle = (id: string) =>
    specialties.find((s) => s.id === id)?.title ?? 'Noma’lum mutaxassislik';

  const createM = useCreateAnnouncement();
  const updateM = useUpdateAnnouncement();
  const deleteM = useDeleteAnnouncement();
  const deleteAttachmentM = useDeleteAttachment();
  const markReadM = useMarkAnnouncementRead();

  const toggle = (a: Announcement) => {
    const opening = !expanded[a.id];
    setExpanded((p) => ({ ...p, [a.id]: opening }));
    if (opening && !a.isRead) {
      markReadM.mutate(a.id);
    }
  };

  useEffect(() => {
    const id = searchParams.get('id');
    if (!id || isLoading) return;
    const target = rows.find((a) => a.id === id);
    if (target) {
      setExpanded((p) => ({ ...p, [id]: true }));
      if (!target.isRead) markReadM.mutate(id);
      requestAnimationFrame(() => {
        document.getElementById(`elon-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
    setSearchParams((p) => {
      const next = new URLSearchParams(p);
      next.delete('id');
      return next;
    }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, isLoading, searchParams]);

  const closeModal = () => {
    uploaderRef.current?.reset();
    setModalOpen(false);
    setEditing(null);
    setSavedId(null);
    setModalAttachments([]);
  };

  const openAdd = () => {
    setEditing(null);
    setSavedId(null);
    setModalAttachments([]);
    setForm(EMPTY);
    setModalOpen(true);
  };

  const openEdit = (a: Announcement) => {
    setEditing(a);
    setSavedId(a.id);
    setModalAttachments(a.attachments);
    setForm({
      title: a.title,
      audience: a.audience,
      content: a.content,
      academicYear: academicYearValue(a),
      deadline: toDateInput(a.deadline),
      targetCourses: a.targetCourses,
      targetSpecialties: a.targetSpecialties,
    });
    setModalOpen(true);
  };

  const changeAudience = (audience: Audience) =>
    setForm((f) => ({
      ...f,
      audience,
      targetSpecialties: [],
      targetCourses: supportsTargeting(audience) ? f.targetCourses : [],
    }));

  const save = async () => {
    if (!form.title.trim()) {
      message.warning('Sarlavhani kiriting');
      return;
    }
    if (!form.content.trim()) {
      message.warning('E’lon matnini kiriting');
      return;
    }
    const payload: AnnouncementInput = {
      title: form.title.trim(),
      content: form.content.trim(),
      audience: form.audience,
      academicYear: form.academicYear || null,
      deadline: form.deadline || null,
      targetCourses: supportsTargeting(form.audience) ? form.targetCourses : [],
      targetSpecialties: supportsTargeting(form.audience) ? form.targetSpecialties : [],
    };
    try {
      let id = savedId;
      if (id) {
        await updateM.mutateAsync({ id, data: payload });
      } else {
        const created = await createM.mutateAsync(payload);
        id = created._id;
        setSavedId(id);
      }

      const result = await uploaderRef.current?.uploadPending(id);
      if (result && result.failed > 0) {
        message.warning(
          `E’lon saqlandi, lekin ${result.failed} ta fayl yuklanmadi — qayta urinib ko‘ring`,
        );
        return;
      }
      if (result && result.canceled > 0) {
        message.info(
          `E’lon saqlandi · ${result.canceled} ta fayl yuklanishi bekor qilindi`,
        );
        return;
      }

      message.success(editing ? 'Yangilandi' : 'E’lon yaratildi');
      closeModal();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Saqlashda xatolik'));
    }
  };

  const removeAttachment = async (attachment: Attachment) => {
    if (!savedId) return;
    try {
      await deleteAttachmentM.mutateAsync({
        announcementId: savedId,
        attachmentId: attachment.id,
      });
      setModalAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
      message.success('Fayl o‘chirildi');
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Faylni o‘chirishda xatolik'));
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteM.mutateAsync(toDelete.id);
      message.success('O‘chirildi');
    } catch (e) {
      message.error(getApiErrorMessage(e, 'O‘chirishda xatolik'));
    }
    setToDelete(null);
  };

  return (
    <div>
      <PageTitle>E’lonlar</PageTitle>

      <FilterBar>
        <Select
          value={fAudience}
          style={{ width: 'auto', minWidth: 150 }}
          onChange={(value) => setFAudience(value)}
          options={[
            { value: '', label: 'Kategoriya — barchasi' },
            ...AUDIENCES.map((a) => ({ value: String(a), label: AUDIENCE_LABEL[a] })),
          ]}
        />

        <Select
          value={fYear}
          style={{ width: 'auto', minWidth: 150 }}
          onChange={(value) => setFYear(value)}
          options={[
            { value: '', label: 'O‘quv yili — barchasi' },
            ...withCurrent(academicYears, fYear).map((y) => ({
              value: y.id,
              label: y.title,
            })),
          ]}
        />

        {canWrite && (
          <div style={{ marginLeft: 'auto' }}>
            <Btn $variant="primary" onClick={openAdd}>
              <MdAdd /> E’lon yaratish
            </Btn>
          </div>
        )}
      </FilterBar>

      <Grid>
        {rows.map((a) => {
          const isOpen = !!expanded[a.id];
          return (
            <Card key={a.id} id={`elon-${a.id}`}>
              <CardTop>
                <CardIcon>
                  <MdCampaign size={18} />
                </CardIcon>
                <CardTitle>
                  {!a.isRead && <NewDot title="O‘qilmagan" aria-label="O‘qilmagan" />}
                  {a.title}
                </CardTitle>
                <Badge variant={AUDIENCE_VARIANT[a.audience]}>{AUDIENCE_LABEL[a.audience]}</Badge>
              </CardTop>

              <CardBody>
                <CardText $expanded={isOpen}>{a.content}</CardText>
                <ExpandBtn onClick={() => toggle(a)}>
                  {isOpen ? 'Yopish ↑' : 'To‘liq o‘qish →'}
                </ExpandBtn>

                <CardMeta>
                  <MetaItem>
                    <MdCalendarToday size={13} />
                    {formatDate(a.createdAt)}
                  </MetaItem>
                  {a.deadline && (
                    <DeadlineItem>
                      <MdAccessTime size={13} />
                      Muddat: {formatDate(a.deadline)}
                    </DeadlineItem>
                  )}
                  {a.createdByName && (
                    <MetaItem>
                      <MdPerson size={13} />
                      {shortName(a.createdByName)}
                    </MetaItem>
                  )}
                  {a.attachments.length > 0 && (
                    <MetaItem>
                      <MdAttachFile size={13} />
                      {a.attachments.length} ta fayl
                    </MetaItem>
                  )}
                </CardMeta>

                {(a.targetCourses.length > 0 || a.targetSpecialties.length > 0) && (
                  <TargetRow>
                    {a.targetCourses.map((c) => (
                      <TargetChip key={`c${c}`}>{c}-kurs</TargetChip>
                    ))}
                    {a.targetSpecialties.map((id) => (
                      <TargetChip key={id}>{specialtyTitle(id)}</TargetChip>
                    ))}
                  </TargetRow>
                )}

                {isOpen && a.attachments.length > 0 && (
                  <AttachmentsBlock>
                    <AttachmentsTitle>Biriktirilgan fayllar</AttachmentsTitle>
                    <AttachmentList announcementId={a.id} attachments={a.attachments} />
                  </AttachmentsBlock>
                )}

                {canWrite && (
                  <CardActions>
                    <Btn $variant="ghost" $size="sm" onClick={() => openEdit(a)} title="Tahrirlash">
                      <MdEdit /> Tahrirlash
                    </Btn>
                    <Btn $variant="ghost" $size="sm" onClick={() => setToDelete(a)} title="O‘chirish">
                      <MdDelete /> O‘chirish
                    </Btn>
                    <Btn
                      $variant="ghost"
                      $size="sm"
                      onClick={() => setStatsFor(a)}
                      title="Kim o‘qigani bo‘yicha hisobot"
                    >
                      <MdBarChart /> Hisobot
                    </Btn>
                  </CardActions>
                )}
              </CardBody>
            </Card>
          );
        })}

        {!isLoading && rows.length === 0 && <EmptyBox>E’lonlar topilmadi</EmptyBox>}
      </Grid>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'E’lonni tahrirlash' : 'Yangi e’lon yaratish'}
        width="540px"
      >
        <ModalBody>
          <FormGroup>
            <Label>Sarlavha *</Label>
            <Input
              value={form.title}
              style={{ width: '100%' }}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="E’lon sarlavhasi"
            />
          </FormGroup>

          <ModalGrid2>
            <FormGroup>
              <Label>Jo‘natish manzili *</Label>
              <Select
                value={form.audience}
                style={{ width: '100%' }}
                onChange={(value) => changeAudience(value as Audience)}
                options={AUDIENCES.map((a) => ({ value: a, label: AUDIENCE_LABEL[a] }))}
              />
            </FormGroup>
            <FormGroup>
              <Label>
                O‘quv yili <HintText>(ixtiyoriy)</HintText>
              </Label>
              <Select
                value={form.academicYear}
                style={{ width: '100%' }}
                onChange={(value) => setForm((f) => ({ ...f, academicYear: value }))}
                options={[
                  { value: '', label: 'Barchasi' },
                  ...withCurrent(academicYears, form.academicYear).map((y) => ({
                    value: y.id,
                    label: y.title,
                  })),
                ]}
              />
            </FormGroup>
          </ModalGrid2>

          <FormGroup>
            <Label>Matn *</Label>
            <Textarea
              rows={6}
              value={form.content}
              onChange={(value) => setForm((f) => ({ ...f, content: value }))}
              placeholder="E’lon matni..."
            />
          </FormGroup>

          <FormGroup>
            <Label>
              Muddat <HintText>(ixtiyoriy)</HintText>
            </Label>
            <DatePicker
              value={form.deadline || null}
              onChange={(value) => setForm((f) => ({ ...f, deadline: value ?? '' }))}
            />
          </FormGroup>

          {supportsTargeting(form.audience) && (
            <FormGroup>
              <Label>
                Kimga yuboriladi <HintText>(ixtiyoriy — tanlanmasa barchasiga)</HintText>
              </Label>

              <TargetLabel id="target-course-label">Kurs</TargetLabel>
              <MultiChipSelect
                ariaLabel="Kurs bo‘yicha yo‘naltirish"
                options={courses.map((c) => ({
                  value: String(c.number),
                  label: c.title,
                }))}
                value={form.targetCourses.map(String)}
                onChange={(next) =>
                  setForm((f) => ({ ...f, targetCourses: next.map(Number) }))
                }
                emptyHint="Barcha kurslar"
              />

              <TargetLabel id="target-spec-label">Mutaxassislik</TargetLabel>
              <MultiChipSelect
                ariaLabel="Mutaxassislik bo‘yicha yo‘naltirish"
                loading={specLoading}
                notFoundText="Mutaxassislik topilmadi"
                options={specialties
                  .filter((sp) => {
                    const program = AUDIENCE_PROGRAM[form.audience];
                    return !program || sp.program === program;
                  })
                  .map((sp) => ({ value: sp.id, label: sp.title }))}
                value={form.targetSpecialties}
                onChange={(next) => setForm((f) => ({ ...f, targetSpecialties: next }))}
                emptyHint="Barcha mutaxassisliklar"
              />

              {(form.targetCourses.length > 0 || form.targetSpecialties.length > 0) && (
                <TargetNote>
                  Ikkala shart ham qo‘llanadi: e’lonni faqat tanlangan kursdagi
                  <b> va </b> tanlangan mutaxassislikdagi talabalar ko‘radi.
                  Ustozlar va bo‘lim xodimi cheklovsiz ko‘raveradi.
                </TargetNote>
              )}
            </FormGroup>
          )}

          <FormGroup>
            <Label>
              Fayllar <HintText>(ixtiyoriy)</HintText>
            </Label>
            {modalAttachments.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <AttachmentList
                  announcementId={savedId ?? ''}
                  attachments={modalAttachments}
                  canWrite
                  onRemove={removeAttachment}
                  removing={deleteAttachmentM.isPending}
                />
              </div>
            )}
            <AttachmentUploader
              ref={uploaderRef}
              announcementId={savedId}
              existing={modalAttachments}
              onUploaded={setModalAttachments}
            />
          </FormGroup>
        </ModalBody>
        <ModalFooter>
          <Btn $variant="ghost" onClick={closeModal}>
            {savedId && !editing ? 'Yopish' : 'Bekor qilish'}
          </Btn>
          <Btn
            $variant="primary"
            onClick={save}
            disabled={createM.isPending || updateM.isPending}
          >
            Saqlash
          </Btn>
        </ModalFooter>
      </Modal>

      <Modal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="O‘chirishni tasdiqlang"
        width="420px"
      >
        <ModalBody>
          <div style={{ fontSize: 13 }}>
            <b>{toDelete?.title}</b> e’lonini o‘chirmoqchimisiz?
          </div>
          <WarnRow>
            <MdWarning size={15} /> Bu amalni bekor qilib bo‘lmaydi.
          </WarnRow>
        </ModalBody>
        <ModalFooter>
          <Btn $variant="ghost" onClick={() => setToDelete(null)}>
            Bekor qilish
          </Btn>
          <Btn $variant="danger" onClick={confirmDelete} disabled={deleteM.isPending}>
            O‘chirish
          </Btn>
        </ModalFooter>
      </Modal>
      <ReadStatsModal
        announcementId={statsFor?.id ?? null}
        announcementTitle={statsFor?.title ?? ''}
        onClose={() => setStatsFor(null)}
      />
    </div>
  );
}
