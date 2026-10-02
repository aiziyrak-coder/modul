import { useState } from 'react';
import styled from 'styled-components';
import { Flex, Input, Select, Switch, Textarea } from '@/shared/ui';
import { NumberField } from '../../components/common/NumberField';
import { CardWrap } from '../../components/common/Card';
import Badge, { statusLabel } from '../../components/common/Badge';
import type { BadgeVariant } from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Table from '../../components/common/Table';
import type { Column } from '../../components/common/Table';
import { FormGroup, Label } from '../../components/common/FormElements';
import { useToast } from '../../components/common/Toast';
import { getApiErrorMessage } from '@/shared/api';
import Loader from '../../components/common/Loader';
import {
  useAchievements, useReviewAchievement, useCriteria,
  useDocumentTypes, useCreateDocType, useUpdateDocType, useDeleteDocType,
  useAcademicYears,
  useFaculties,
} from '../../api/gifted-api';
import type { Activity, DocumentType } from '../../data/types';
import {
  MdAdd, MdEdit, MdDelete, MdVisibility, MdInfoOutline, MdOpenInNew, MdDownload,
  MdCheck, MdClose, MdLock,
} from '../../icons';
import { safeExternalLink } from '../../lib/safe-link';
import { academicYearOf } from '../../lib/academic-years';
import { useYearFilter } from '../../lib/default-year';

interface DocForm {
  title: string;
  desc: string;
  personal: boolean;
}

interface DeleteDoc {
  id: string;
  title: string;
}

type EnrichedActivity = Omit<Activity, 'direction' | 'course'> & { direction: string; course: number | string };

const EMPTY_DOC: DocForm = { title: '', desc: '', personal: false };

export default function DepartmentReview() {
  const { toast } = useToast();

  const { data: activities = [], isLoading } = useAchievements();
  const { data: criteria = [] } = useCriteria();
  const reviewAchievement = useReviewAchievement();
  const { data: academicYearRows = [] } = useAcademicYears();
  const academicYears = academicYearRows.map((y) => y.title);

  const { data: facultyRows = [] } = useFaculties();

  const [filterStatus, setFilterStatus] = useState('all');
  const [filterFaculty, setFilterFaculty] = useState('all');
  const [filterYear, setFilterYear] = useYearFilter(
    activities.filter(a => a.submittedAt).map(a => academicYearOf(a.submittedAt)),
  );

  const [approveCrit, setApproveCrit] = useState('');
  const [approveCat, setApproveCat] = useState('');
  const [approveScore, setApproveScore] = useState('');
  const activeCriteria = criteria.filter(c => c.active);
  const selectedCrit = activeCriteria.find(c => c.id === approveCrit);

  const selectedCat = selectedCrit?.categories.find(c => c.id === approveCat);
  const needsCategory = (selectedCrit?.categories.length ?? 0) > 0;
  const scoreMax: number | null = selectedCrit
    ? needsCategory
      ? (selectedCat?.points ?? null)
      : (selectedCrit.ball ?? null)
    : null;

  const scoreNum = Number(approveScore);
  const scoreIsNumber = approveScore !== '' && !Number.isNaN(scoreNum) && scoreNum >= 0;
  const scoreOverMax = scoreIsNumber && scoreMax != null && scoreNum > scoreMax;
  const scoreNegative = approveScore !== '' && !Number.isNaN(scoreNum) && scoreNum < 0;
  const approveScoreValid =
    scoreIsNumber && !!selectedCrit && (!needsCategory || !!selectedCat) && !scoreOverMax;

  const { data: docTypes = [] } = useDocumentTypes();
  const createDocType = useCreateDocType();
  const updateDocType = useUpdateDocType();
  const deleteDocType = useDeleteDocType();
  const busy = reviewAchievement.isPending;
  const docBusy = createDocType.isPending || updateDocType.isPending || deleteDocType.isPending;
  const [addDocModal, setAddDocModal] = useState(false);
  const [editDocModal, setEditDocModal] = useState<string | null>(null);
  const [deleteDocConfirm, setDeleteDocConfirm] = useState<DeleteDoc | null>(null);
  const [docForm, setDocForm] = useState<DocForm>(EMPTY_DOC);

  const [viewItem, setViewItem] = useState<EnrichedActivity | null>(null);
  const [approveModal, setApproveModal] = useState<EnrichedActivity | null>(null);
  const [rejectModal, setRejectModal] = useState<EnrichedActivity | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [selectedERI, setSelectedERI] = useState('');
  const [noteViewModal, setNoteViewModal] = useState<string | null>(null);

  const approvingPersonal =
    !!approveModal &&
    docTypes.find((d) => d.id === approveModal.criteriaId)?.personal === true;

  const faculties = ['all', ...[...new Set([
    ...facultyRows.map(f => f.title),
    ...activities.map(a => a.faculty).filter(Boolean),
  ])].sort()];

  const enriched: EnrichedActivity[] = activities.map(act => ({
    ...act,
    direction: act.direction || '—',
    course: act.course ?? '—',
  }));

  const scoped = enriched.filter(a => {
    const facOk = filterFaculty === 'all' || a.faculty === filterFaculty;
    const yearOk = filterYear === 'all' || academicYearOf(a.submittedAt) === filterYear;
    return facOk && yearOk;
  });

  const filtered = scoped.filter(a => filterStatus === 'all' || a.status === filterStatus);

  const stats = {
    pending:  scoped.filter(a => a.status === 'pending').length,
    approved: scoped.filter(a => a.status === 'approved').length,
    rejected: scoped.filter(a => a.status === 'rejected').length,
    total:    scoped.length,
  };

  const openAddDoc = () => { setDocForm(EMPTY_DOC); setAddDocModal(true); };
  const handleAddDoc = () => {
    if (!docForm.title.trim()) return;
    createDocType.mutate(
      { title: docForm.title.trim(), description: docForm.desc.trim(), personal: docForm.personal, active: true },
      { onSuccess: () => { setAddDocModal(false); toast("Qo'shildi", 'success'); } },
    );
  };

  const openEditDoc = (dt: DocumentType) => { setDocForm({ title: dt.title, desc: dt.description || '', personal: dt.personal || false }); setEditDocModal(dt.id); };
  const handleEditDoc = () => {
    if (!editDocModal) return;
    updateDocType.mutate(
      { id: editDocModal, data: { title: docForm.title.trim(), description: docForm.desc.trim(), personal: docForm.personal } },
      { onSuccess: () => { setEditDocModal(null); toast('Yangilandi', 'success'); } },
    );
  };

  const handleDeleteDoc = () => {
    if (!deleteDocConfirm) return;
    deleteDocType.mutate(deleteDocConfirm.id, { onSuccess: () => { setDeleteDocConfirm(null); toast("O'chirildi", 'info'); } });
  };

  const toggleDocActive = (id: string) => {
    const dt = docTypes.find(d => d.id === id);
    if (!dt) return;
    updateDocType.mutate({ id, data: { active: !dt.active } });
  };

  const openApprove = (row: EnrichedActivity) => {
    setApproveModal(row);
    setApproveCrit(''); setApproveCat(''); setApproveScore(''); setSelectedERI('');
  };
  const closeApprove = () => {
    setApproveModal(null);
    setApproveCrit(''); setApproveCat(''); setApproveScore(''); setSelectedERI('');
  };
  const onCriterionChange = (critId: string) => {
    setApproveCrit(critId);
    setApproveCat('');
    const c = activeCriteria.find(x => x.id === critId);
    const prefill =
      c && (!c.categories || c.categories.length === 0) && c.ball != null ? String(c.ball) : '';
    setApproveScore(approvingPersonal ? '0' : prefill);
  };
  const onCategoryChange = (catId: string) => {
    setApproveCat(catId);
    const cat = selectedCrit?.categories.find(x => x.id === catId);
    if (cat) setApproveScore(approvingPersonal ? '0' : String(cat.points));
  };
  const handleApprove = () => {
    if (!approveModal || !approveScoreValid) return;
    const target = approveModal;
    const catName = selectedCrit?.categories.find(c => c.id === approveCat)?.name;
    const scoreLabel = selectedCrit
      ? `${selectedCrit.name}${catName ? ` (${catName})` : ''}`
      : undefined;
    reviewAchievement.mutate(
      {
        id: target.id,
        status: 'approved',
        score: Number(approveScore),
        scoreCriteria: approveCrit || undefined,
        scoreCategoryId: approveCat || undefined,
        scoreLabel,
      },
      {
        onSuccess: () => { closeApprove(); toast(`"${target.title}" tasdiqlandi!`, 'success'); },
        onError: (err) => toast(getApiErrorMessage(err, 'Tasdiqlashda xatolik yuz berdi'), 'error'),
      },
    );
  };

  const handleReject = () => {
    if (!rejectModal || !rejectNote.trim()) return;
    const target = rejectModal;
    reviewAchievement.mutate({ id: target.id, status: 'rejected', reviewNote: rejectNote.trim() }, { onSuccess: () => {
      setRejectModal(null); setRejectNote(''); toast('Faoliyat rad etildi', 'info');
    } });
  };

  const columns: Column<EnrichedActivity>[] = [
    {
      key: 'studentName', title: 'Talaba', width: 160,
      render: (v, row) => (
        <div>
          <SName>{v as string}</SName>
          <SMeta>{row.direction}</SMeta>
        </div>
      ),
    },
    { key: 'faculty', title: 'Fakultet', width: 120 },
    { key: 'direction', title: "Yo'nalishi", width: 130 },
    {
      key: 'course', title: 'Kurs', width: 55,
      render: v => <span>{v !== '—' ? `${v as number}-kurs` : '—'}</span>,
    },
    { key: 'title', title: 'Sarlavha', width: 150, render: v => <TitleCell>{v as string}</TitleCell> },
    {
      key: 'description', title: 'Izoh', width: 180,
      render: v => v ? <ClampCell>{v as string}</ClampCell> : <Dash>—</Dash>,
    },
    {
      key: 'fileName', title: 'Fayl', width: 50,
      render: (v, row) => v
        ? <IconLink as="a" href={row.fileUrl || '#'} download={v as string} title={v as string} $green><MdDownload /></IconLink>
        : <Dash>—</Dash>,
    },
    {
      key: 'link', title: 'Havola', width: 60,
      render: v => v
        ? <IconLink as="a" href={v as string} target="_blank" rel="noopener noreferrer" title={v as string}><MdOpenInNew /></IconLink>
        : <Dash>—</Dash>,
    },
    { key: 'submittedAt', title: 'Sana', width: 95 },
    {
      key: 'status', title: 'Status', width: 130,
      render: (v, row) => (
        <StatusCell>
          <Badge variant={v as BadgeVariant}>{statusLabel[v as string]}</Badge>
          {v === 'rejected' && (
            <RejInfoBtn
              onClick={() => setNoteViewModal(row.reviewNote || "Sabab ko'rsatilmagan")}
              title="Rad etish sababi"
            >
              <MdInfoOutline />
            </RejInfoBtn>
          )}
        </StatusCell>
      ),
    },
    {
      key: 'id', title: 'Amallar', width: 100,
      render: (_, row) => (
        <Actions>
          <ActBtn onClick={() => setViewItem(row)} title="Batafsil"><MdVisibility /></ActBtn>

          {row.status === 'pending' ? (
            <>
              <ActBtn $green onClick={() => openApprove(row)} title="Tasdiqlash"><MdCheck /></ActBtn>
              <ActBtn $red onClick={() => { setRejectModal(row); setRejectNote(''); }} title="Rad etish"><MdClose /></ActBtn>
            </>
          ) : (
            <>
              <ActBtn
                $green
                onClick={() => openApprove(row)}
                title={row.status === 'approved' ? 'Ballni tuzatish' : 'Qayta tasdiqlash'}
              >
                <MdCheck />
              </ActBtn>
              {row.status !== 'rejected' && (
                <ActBtn $red onClick={() => { setRejectModal(row); setRejectNote(''); }} title="Qarorni bekor qilish (rad etish)"><MdClose /></ActBtn>
              )}
            </>
          )}
        </Actions>
      ),
    },
  ];

  return (
    <>
      <Wrap>

        <StatsRow>
          <StatCard $color="#F39C12">
            <StatNum>{stats.pending}</StatNum>
            <StatLabel>Kutmoqda</StatLabel>
          </StatCard>
          <StatCard $color="var(--brand-primary)">
            <StatNum>{stats.approved}</StatNum>
            <StatLabel>Tasdiqlangan</StatLabel>
          </StatCard>
          <StatCard $color="#E74C3C">
            <StatNum>{stats.rejected}</StatNum>
            <StatLabel>Rad etilgan</StatLabel>
          </StatCard>
          <StatCard $color="#3498DB">
            <StatNum>{stats.total}</StatNum>
            <StatLabel>Jami</StatLabel>
          </StatCard>
        </StatsRow>

        <CardWrap style={{ padding: 0, overflow: 'hidden' }}>
          <DocListHeader>
            <DocListTitle>Faoliyat va hujjatlar ro'yxati</DocListTitle>
            <Button size="sm" onClick={openAddDoc}><MdAdd /> Qo'shish</Button>
          </DocListHeader>

          {docTypes.length === 0 ? (
            <DocEmpty>Hujjat turlari qo'shilmagan</DocEmpty>
          ) : (
            docTypes.map((dt, idx) => (
              <DocRow key={dt.id} $inactive={!dt.active}>
                <DocNum>{idx + 1}</DocNum>
                <DocInfo>
                  <DocTitleRow>
                    <DocTitle>{dt.title}</DocTitle>
                    {dt.personal && (
                      <PersonalBadge title="Shaxsga oid hujjat">
                        <MdLock style={{ fontSize: 12 }} /> Shaxsga oid
                      </PersonalBadge>
                    )}
                  </DocTitleRow>
                  {dt.description && <DocDesc>{dt.description}</DocDesc>}
                </DocInfo>
                <Flex align="center" gap="small" title={dt.active ? 'Nofaol qilish' : 'Faollashtirish'}>
                  <Switch checked={dt.active} onChange={() => toggleDocActive(dt.id)} />
                  <SwitchLabel $active={dt.active}>{dt.active ? 'Faol' : 'Nofaol'}</SwitchLabel>
                </Flex>
                <DocActions>
                  <DocBtn onClick={() => openEditDoc(dt)} title="Tahrirlash"><MdEdit /></DocBtn>
                  <DocBtn $danger onClick={() => setDeleteDocConfirm({ id: dt.id, title: dt.title })} title="O'chirish"><MdDelete /></DocBtn>
                </DocActions>
              </DocRow>
            ))
          )}
        </CardWrap>

        <CardWrap style={{ padding: 0, overflow: 'hidden' }}>
          <ActHeader>
            <ActTitle>Talabalar faoliyati va hujjatlari jadvali</ActTitle>
            <ActFilters>
              <TabRow>
                {[
                  { key: 'all',      label: 'Barchasi' },
                  { key: 'pending',  label: 'Kutmoqda' },
                  { key: 'approved', label: 'Tasdiqlangan' },
                  { key: 'rejected', label: 'Rad etilgan' },
                ].map(({ key, label }) => (
                  <FilterTab
                    key={key}
                    type="button"
                    data-active={filterStatus === key}
                    aria-pressed={filterStatus === key}
                    onClick={() => setFilterStatus(key)}
                  >
                    {label}
                    {key === 'pending' && stats.pending > 0 && <PendingBadge>{stats.pending}</PendingBadge>}
                  </FilterTab>
                ))}
              </TabRow>
              <ActRight>
                <Select
                  style={{ height: 34, fontSize: 12, width: 130 }}
                  value={filterYear}
                  onChange={(value) => setFilterYear(value)}
                  options={[
                    { value: 'all', label: "Barcha o'quv yillari" },
                    ...academicYears.map(y => ({ value: y, label: y })),
                  ]}
                />
                <Select
                  showSearch
                  optionFilterProp="label"
                  style={{ height: 34, fontSize: 12, width: 160 }}
                  value={filterFaculty}
                  onChange={(value) => setFilterFaculty(value)}
                  options={faculties.map(f => ({ value: f, label: f === 'all' ? 'Barcha fakultet' : f }))}
                />
              </ActRight>
            </ActFilters>
          </ActHeader>
          {isLoading ? <Loader text="Faoliyatlar yuklanmoqda..." /> : <Table columns={columns} data={filtered} />}
        </CardWrap>

      </Wrap>

      <Modal
        open={addDocModal}
        onClose={() => setAddDocModal(false)}
        title="Yangi faoliyat/hujjat qo'shish"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddDocModal(false)}>Bekor qilish</Button>
            <Button onClick={handleAddDoc} disabled={docBusy || !docForm.title.trim()}>Qo'shish</Button>
          </>
        }
      >
        <FormGroup>
          <Label>Sarlavha *</Label>
          <Input
            style={{ width: '100%' }}
            value={docForm.title}
            onChange={(e) => setDocForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Masalan: Talabgorning pasporti"
          />
        </FormGroup>
        <FormGroup>
          <Label>Tavsif</Label>
          <Textarea
            value={docForm.desc}
            onChange={(value) => setDocForm(f => ({ ...f, desc: value }))}
            placeholder="Hujjat haqida qisqa ma'lumot..."
            rows={3}
          />
        </FormGroup>
        <PersonalSwitchRow>
          <PersonalSwitchLeft>
            <MdLock style={{ fontSize: 16, color: docForm.personal ? '#7C3AED' : '#94A3B8' }} />
            <div>
              <PersonalSwitchLabel>Shaxsga oid hujjat</PersonalSwitchLabel>
              <PersonalSwitchHint>Faqat bo'lim xodimi va talabaning o'zi ko'ra oladi</PersonalSwitchHint>
            </div>
          </PersonalSwitchLeft>
          <Switch
            checked={docForm.personal}
            onChange={() => setDocForm(f => ({ ...f, personal: !f.personal }))}
          />
        </PersonalSwitchRow>
      </Modal>

      <Modal
        open={!!editDocModal}
        onClose={() => setEditDocModal(null)}
        title="Tahrirlash"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditDocModal(null)}>Bekor qilish</Button>
            <Button onClick={handleEditDoc} disabled={docBusy || !docForm.title.trim()}>Saqlash</Button>
          </>
        }
      >
        <FormGroup>
          <Label>Sarlavha *</Label>
          <Input
            style={{ width: '100%' }}
            value={docForm.title}
            onChange={(e) => setDocForm(f => ({ ...f, title: e.target.value }))}
          />
        </FormGroup>
        <FormGroup>
          <Label>Tavsif</Label>
          <Textarea
            value={docForm.desc}
            onChange={(value) => setDocForm(f => ({ ...f, desc: value }))}
            rows={3}
          />
        </FormGroup>
        <PersonalSwitchRow>
          <PersonalSwitchLeft>
            <MdLock style={{ fontSize: 16, color: docForm.personal ? '#7C3AED' : '#94A3B8' }} />
            <div>
              <PersonalSwitchLabel>Shaxsga oid hujjat</PersonalSwitchLabel>
              <PersonalSwitchHint>Faqat bo'lim xodimi va talabaning o'zi ko'ra oladi</PersonalSwitchHint>
            </div>
          </PersonalSwitchLeft>
          <Switch
            checked={docForm.personal}
            onChange={() => setDocForm(f => ({ ...f, personal: !f.personal }))}
          />
        </PersonalSwitchRow>
      </Modal>

      <Modal
        open={!!deleteDocConfirm}
        onClose={() => setDeleteDocConfirm(null)}
        title="O'chirishni tasdiqlash"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteDocConfirm(null)}>Bekor qilish</Button>
            <Button variant="danger" onClick={handleDeleteDoc} disabled={docBusy}>O'chirish</Button>
          </>
        }
      >
        <p style={{ fontSize: 14, lineHeight: 1.6 }}>
          <b>"{deleteDocConfirm?.title}"</b> ni o'chirishni xohlaysizmi? Bu amalni bekor qilib bo'lmaydi.
        </p>
      </Modal>

      <Modal
        open={!!viewItem}
        onClose={() => setViewItem(null)}
        title="Faoliyat tafsilotlari"
        footer={
          <>
            {viewItem && (
              <>
                {viewItem.status !== 'rejected' && (
                  <Button variant="danger" onClick={() => { setRejectModal(viewItem); setViewItem(null); setRejectNote(''); }}>
                    Rad etish
                  </Button>
                )}
                <Button onClick={() => { openApprove(viewItem); setViewItem(null); }}>
                  {viewItem.status === 'approved' ? 'Ballni tuzatish' : 'Tasdiqlash'}
                </Button>
              </>
            )}
            <Button variant="secondary" onClick={() => setViewItem(null)}>Yopish</Button>
          </>
        }
      >
        {viewItem && (
          <DetailsBox>
            <DetailRow><DLabel>Talaba:</DLabel><b>{viewItem.studentName}</b></DetailRow>
            <DetailRow><DLabel>Fakultet:</DLabel><b>{viewItem.faculty}</b></DetailRow>
            <DetailRow><DLabel>Faoliyat/hujjat:</DLabel><b>{viewItem.criteriaName}</b></DetailRow>
            {viewItem.criteriaDesc && (
              <DetailRow><DLabel>Tavsif:</DLabel><span>{viewItem.criteriaDesc}</span></DetailRow>
            )}
            <DetailRow><DLabel>Sarlavha:</DLabel><b>{viewItem.title}</b></DetailRow>
            {viewItem.description && <DetailRow><DLabel>Izoh:</DLabel><span>{viewItem.description}</span></DetailRow>}
            <DetailRow><DLabel>Yuborilgan:</DLabel><b>{viewItem.submittedAt}</b></DetailRow>
            <DetailRow><DLabel>Status:</DLabel><Badge variant={viewItem.status as BadgeVariant}>{statusLabel[viewItem.status]}</Badge></DetailRow>
            {viewItem.fileName && (
              <DetailRow>
                <DLabel>Fayl:</DLabel>
                <FileLink href={viewItem.fileUrl || '#'} download={viewItem.fileName}>{viewItem.fileName}</FileLink>
              </DetailRow>
            )}
            {viewItem.link && (
              <DetailRow>
                <DLabel>Havola:</DLabel>
                {safeExternalLink(viewItem.link) ? (
                  <FileLink
                    href={safeExternalLink(viewItem.link)!}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {viewItem.link}
                  </FileLink>
                ) : (
                  <span title="Havola qo‘llab-quvvatlanmaydigan turdagi — ochilmaydi">
                    {viewItem.link}
                  </span>
                )}
              </DetailRow>
            )}
            {viewItem.reviewNote && (
              <RejectNoteBox>{viewItem.reviewNote}</RejectNoteBox>
            )}
          </DetailsBox>
        )}
      </Modal>

      <Modal
        open={!!approveModal}
        onClose={closeApprove}
        title="Faoliyatni tasdiqlash"
        footer={
          <>
            <Button variant="secondary" onClick={closeApprove}>Bekor qilish</Button>
            <Button onClick={handleApprove} disabled={busy || !approveScoreValid}>Tasdiqlash</Button>
          </>
        }
      >
        {approveModal && (
          <DetailsBox>
            <p style={{ fontSize: 14, lineHeight: 1.6 }}>
              <b>{approveModal.studentName}</b> ning <b>{approveModal.title}</b> faoliyatiga ball bering:
            </p>
            <FormGroup style={{ marginTop: 8 }}>
              <Label>Baholash mezoni</Label>
              <Select
                value={approveCrit}
                showSearch
                optionFilterProp="label"
                style={{ width: '100%' }}
                onChange={(value) => onCriterionChange(value)}
                options={[
                  { value: '', label: 'Mezonni tanlang' },
                  ...activeCriteria.map(c => ({ value: c.id, label: c.name })),
                ]}
              />
            </FormGroup>
            {selectedCrit && selectedCrit.categories.length > 0 && (
              <FormGroup style={{ marginTop: 8 }}>
                <Label>Kategoriya</Label>
                <Select
                  value={approveCat}
                  style={{ width: '100%' }}
                  onChange={(value) => onCategoryChange(value)}
                  options={[
                    { value: '', label: 'Kategoriyani tanlang' },
                    ...selectedCrit.categories.filter(cat => cat.active).map(cat => ({
                      value: cat.id,
                      label: `${cat.name} (${cat.points} ball)`,
                    })),
                  ]}
                />
              </FormGroup>
            )}
            <FormGroup style={{ marginTop: 8 }}>
              <Label>Ball *{scoreMax != null && ` (maksimal ${scoreMax})`}</Label>

              <NumberField
                style={{ width: '100%' }}
                value={approveScore === '' ? null : Number(approveScore)}
                onChange={(v) => setApproveScore(v === null ? '' : String(v))}
                placeholder="Ball kiriting"
              />
              {scoreOverMax && (
                <HintError>
                  Ball maksimaldan katta: {scoreNum} &gt; {scoreMax}
                </HintError>
              )}
              {scoreNegative && <HintError>Ball manfiy bo‘la olmaydi</HintError>}
              {approvingPersonal && (
                <HintPersonal>
                  Shaxsiy hujjat — sukut bo&apos;yicha 0 ball. Bu tur maslahatchi va
                  hakamga ko&apos;rinmaydi, ball esa umumiy reytingga kiradi. Zarur
                  bo&apos;lsa o&apos;zgartiring.
                </HintPersonal>
              )}
              {!selectedCrit && <Hint>Avval baholash mezonini tanlang</Hint>}
              {needsCategory && !selectedCat && <Hint>Kategoriyani tanlang</Hint>}
            </FormGroup>

            <FormGroup style={{ marginTop: 8 }}>
              <Label>ERI kaliti</Label>
              <Select
                value={selectedERI}
                style={{ width: '100%' }}
                disabled
                onChange={(value) => setSelectedERI(value)}
                options={[{ value: '', label: 'ERI kalitisiz tasdiqlash' }]}
              />
              <Hint>ERI imzolash keyingi fazada qo&apos;shiladi</Hint>
            </FormGroup>
          </DetailsBox>
        )}
      </Modal>

      <Modal
        open={!!rejectModal}
        onClose={() => setRejectModal(null)}
        title="Faoliyatni rad etish"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejectModal(null)}>Bekor qilish</Button>
            <Button variant="danger" onClick={handleReject} disabled={busy || !rejectNote.trim()}>Rad etish</Button>
          </>
        }
      >
        {rejectModal && (
          <DetailsBox>
            <p style={{ fontSize: 14, lineHeight: 1.6 }}>
              <b>{rejectModal.studentName}</b> ning <b>{rejectModal.title}</b> faoliyatini rad etish sababi:
            </p>
            <FormGroup style={{ marginTop: 8 }}>
              <Label>Sabab *</Label>
              <Textarea
                value={rejectNote}
                onChange={(value) => setRejectNote(value)}
                placeholder="Rad etish sababini batafsil yozing..."
                rows={4}
              />
            </FormGroup>
          </DetailsBox>
        )}
      </Modal>

      <Modal
        open={!!noteViewModal}
        onClose={() => setNoteViewModal(null)}
        title="Rad etish sababi"
        footer={<Button variant="secondary" onClick={() => setNoteViewModal(null)}>Yopish</Button>}
      >
        <RejectNoteBox>{noteViewModal}</RejectNoteBox>
      </Modal>

    </>
  );
}

const Hint = styled.div`
  margin-top: 4px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const HintError = styled(Hint)`
  color: ${({ theme }) => theme.colors.danger};
  font-weight: 500;
`;

const HintPersonal = styled(Hint)`
  color: ${({ theme }) => theme.colors.warning};
  font-weight: 500;
`;

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const StatsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
`;

const StatCard = styled(CardWrap)<{ $color: string }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  text-align: center;
  border-top: 3px solid ${({ $color }) => $color};
`;

const StatNum = styled.div`
  font-size: 32px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.text};
`;

const StatLabel = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textMuted};
  margin-top: 4px;
`;

const DocListHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const DocListTitle = styled.h3`
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
`;

const DocEmpty = styled.div`
  padding: 32px 20px;
  text-align: center;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const DocRow = styled.div<{ $inactive: boolean }>`
  display: grid;
  grid-template-columns: 32px 1fr auto auto;
  align-items: center;
  gap: 14px;
  padding: 14px 20px;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  opacity: ${({ $inactive }) => $inactive ? 0.55 : 1};
  transition: background 0.12s;
  &:hover { background: ${({ theme }) => theme.colors.bg}; }
`;

const DocNum = styled.span`
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: ${({ theme }) => theme.colors.primaryLight};
  color: ${({ theme }) => theme.colors.primary};
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

const DocInfo = styled.div`
  min-width: 0;
`;

const DocTitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

const DocTitle = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
  overflow-wrap: anywhere;
`;

const PersonalBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  background: #EDE9FE;
  color: #7C3AED;
  flex-shrink: 0;
`;

const PersonalSwitchRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: ${({ theme }) => theme.radius.md};
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.bg};
  margin-top: 4px;
`;

const PersonalSwitchLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const PersonalSwitchLabel = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

const PersonalSwitchHint = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textMuted};
  margin-top: 1px;
`;

const DocDesc = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textMuted};
  margin-top: 2px;
  line-height: 1.4;
  overflow-wrap: anywhere;
`;

const SwitchLabel = styled.span<{ $active: boolean }>`
  font-size: 12px;
  font-weight: 600;
  color: ${({ $active }) => $active ? 'var(--brand-primary)' : '#95A5A6'};
`;

const DocActions = styled.div`
  display: flex;
  gap: 4px;
`;

const DocBtn = styled.button<{ $danger?: boolean }>`
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: ${({ $danger }) => $danger ? '#E74C3C' : '#7F8C8D'};
  background: ${({ $danger }) => $danger ? '#FDEDEC' : '#F4F6F9'};
  transition: all 0.15s;
  &:hover { opacity: 0.7; }
`;

const ActHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 20px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const ActTitle = styled.h3`
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
`;

const ActFilters = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const TabRow = styled.div`
  display: flex;
  gap: 4px;
`;

const ActRight = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
`;

const FilterTab = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  border: 1.5px solid ${({ theme }) => theme.colors.border};
  background: white;
  color: ${({ theme }) => theme.colors.textMuted};
  transition: all 0.15s;
  &[data-active='true'] {
    border-color: ${({ theme }) => theme.colors.primary};
    background: ${({ theme }) => theme.colors.primaryLight};
    color: ${({ theme }) => theme.colors.primary};
  }
  &:hover { border-color: ${({ theme }) => theme.colors.primary}; }
`;

const PendingBadge = styled.span`
  background: #E74C3C;
  color: white;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 999px;
  font-weight: 700;
`;

const SName = styled.div`
  font-weight: 600;
  font-size: 13px;
`;

const SMeta = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textMuted};
  margin-top: 2px;
`;

const TitleCell = styled.div`
  font-weight: 600;
  font-size: 13px;
`;

const ClampCell = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textMuted};
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.45;
`;

const Dash = styled.span`
  color: #CBD5E1;
  font-size: 12px;
`;

const IconLink = styled.button<{ $green?: boolean }>`
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  text-decoration: none;
  transition: all 0.15s;
  color: ${({ $green }) => $green ? 'var(--brand-primary)' : '#3498DB'};
  background: ${({ $green }) => $green ? 'var(--brand-primary-soft)' : '#EBF5FB'};
  &:hover { opacity: 0.75; }
`;

const StatusCell = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 5px;
`;

const RejInfoBtn = styled.button`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #DC2626;
  background: transparent;
  transition: opacity 0.15s;
  &:hover { opacity: 0.7; }
`;

const Actions = styled.div`
  display: flex;
  gap: 5px;
`;

const ActBtn = styled.button<{ $green?: boolean; $red?: boolean }>`
  width: 28px;
  height: 28px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  transition: all 0.15s;
  ${({ $green }) => $green && `color: #15803D; background: #DCFCE7; &:hover { background: #BBF7D0; }`}
  ${({ $red }) => $red && `color: #991B1B; background: #FEE2E2; &:hover { background: #FECACA; }`}
  ${({ $green, $red }) => !$green && !$red && `color: #7F8C8D; background: #F4F6F9; &:hover { background: #EBF5FB; color: #3498DB; }`}
`;

const DetailsBox = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const DetailRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 13px;
`;

const DLabel = styled.span`
  color: ${({ theme }) => theme.colors.textMuted};
  min-width: 90px;
  flex-shrink: 0;
`;

const FileLink = styled.a`
  color: #3498DB;
  font-size: 13px;
  text-decoration: underline;
  word-break: break-all;
`;

const RejectNoteBox = styled.p`
  font-size: 14px;
  color: #1E293B;
  line-height: 1.6;
  padding: 12px 16px;
  background: #FEF2F2;
  border-left: 3px solid #EF4444;
  border-radius: 6px;
`;
