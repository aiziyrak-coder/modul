import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Input, Switch } from '@/shared/ui';
import { NumberField } from '../../components/common/NumberField';
import { CardWrap, CardHeader, CardTitle } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import { FormGroup, Label } from '../../components/common/FormElements';
import { useToast } from '../../components/common/Toast';
import Loader from '../../components/common/Loader';
import { useCriteria, useCreateCriterion, useUpdateCriterion, useDeleteCriterion } from '../../api/gifted-api';
import type { Criterion, CriterionCategory } from '../../data/types';
import { MdAdd, MdEdit, MdDelete, MdExpandMore, MdExpandLess, MdChevronLeft, MdChevronRight } from '../../icons';
import { CAT_POINTS_MAX, catPointsError, catPointsValid } from '../../lib/category-points';

const ICONS = ['📄', '🏅', '🏆', '💡', '🔬', '📊', '🎨', '🌍', '💻', '🧪'];
const PAGE_SIZE = 5;

interface EditingCat {
  catId: string;
  typeId: string;
}

interface CatForm {
  name: string;
  points: string;
}

interface TypeForm {
  name: string;
  icon: string;
  ball: string;
}

interface DeleteCat {
  catId: string;
  catName: string;
}

interface DeleteType {
  id: string;
  name: string;
}

export default function DepartmentCriteria() {
  const { toast } = useToast();
  const { data: criteria = [], isLoading } = useCriteria();
  const createCriterion = useCreateCriterion();
  const updateCriterion = useUpdateCriterion();
  const deleteCriterion = useDeleteCriterion();
  const busy = createCriterion.isPending || updateCriterion.isPending || deleteCriterion.isPending;
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(criteria.length / PAGE_SIZE));
    if (currentPage > maxPage) setCurrentPage(maxPage);
  }, [criteria.length, currentPage]);

  useEffect(() => {
    const firstId = criteria[0]?.id;
    if (firstId) setExpanded(prev => (Object.keys(prev).length === 0 ? { [firstId]: true } : prev));
  }, [criteria]);

  const [editingCat, setEditingCat] = useState<EditingCat | null>(null);
  const [editForm, setEditForm] = useState<CatForm>({ name: '', points: '' });

  const [addCatModal, setAddCatModal] = useState<string | null>(null);
  const [newCat, setNewCat] = useState<CatForm>({ name: '', points: '' });

  const [deleteConfirm, setDeleteConfirm] = useState<DeleteCat | null>(null);

  const [addTypeModal, setAddTypeModal] = useState(false);
  const [newType, setNewType] = useState<TypeForm>({ name: '', icon: '📄', ball: '' });

  const [editTypeId, setEditTypeId] = useState<string | null>(null);
  const [editTypeForm, setEditTypeForm] = useState<TypeForm>({ name: '', icon: '📄', ball: '' });

  const [deleteTypeConfirm, setDeleteTypeConfirm] = useState<DeleteType | null>(null);

  const toggle = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const toggleCatActive = (typeId: string, catId: string) => {
    if (busy) return;
    const ct = criteria.find(c => c.id === typeId);
    if (!ct) return;
    const data = { ...ct, categories: ct.categories.map(c => c.id === catId ? { ...c, active: !c.active } : c) };
    updateCriterion.mutate({ id: typeId, data }, { onSuccess: () => toast('Holat yangilandi', 'success') });
  };

  const toggleTypeActive = (typeId: string) => {
    if (busy) return;
    const ct = criteria.find(c => c.id === typeId);
    if (!ct) return;
    updateCriterion.mutate({ id: typeId, data: { ...ct, active: !ct.active } }, { onSuccess: () => toast('Holat yangilandi', 'success') });
  };

  const startEditCat = (typeId: string, cat: CriterionCategory) => {
    setEditingCat({ catId: cat.id, typeId });
    setEditForm({ name: cat.name, points: String(cat.points) });
  };

  const saveEditCat = () => {
    if (!editingCat || !editForm.name || !catPointsValid(editForm.points)) return;
    const { catId, typeId } = editingCat;
    const ct = criteria.find(c => c.id === typeId);
    if (!ct) return;
    const data = { ...ct, categories: ct.categories.map(c =>
      c.id === catId ? { ...c, name: editForm.name, points: Number(editForm.points) } : c
    )};
    updateCriterion.mutate({ id: typeId, data }, { onSuccess: () => { setEditingCat(null); toast('Kategoriya yangilandi!', 'success'); } });
  };

  const handleAddCat = () => {
    if (!newCat.name || !catPointsValid(newCat.points) || !addCatModal) return;
    const ct = criteria.find(c => c.id === addCatModal);
    if (!ct) return;
    const data = { ...ct, categories: [...ct.categories, { id: `CC-${Date.now()}`, name: newCat.name, points: Number(newCat.points), active: true }] };
    updateCriterion.mutate({ id: addCatModal, data }, { onSuccess: () => { setAddCatModal(null); setNewCat({ name: '', points: '' }); toast("Yangi kategoriya qo'shildi!", 'success'); } });
  };

  const handleDelete = () => {
    if (!deleteConfirm) return;
    const ct = criteria.find(c => c.categories.some(x => x.id === deleteConfirm.catId));
    if (!ct) { setDeleteConfirm(null); return; }
    const data = { ...ct, categories: ct.categories.filter(c => c.id !== deleteConfirm.catId) };
    updateCriterion.mutate({ id: ct.id, data }, { onSuccess: () => { setDeleteConfirm(null); toast("Kategoriya o'chirildi", 'info'); } });
  };

  const handleAddType = () => {
    if (!newType.name) return;
    const data: Partial<Criterion> = {
      name: newType.name, icon: newType.icon, active: true, categories: [],
      ...(newType.ball !== '' ? { ball: Number(newType.ball) } : {}),
    };
    createCriterion.mutate(data, { onSuccess: () => {
      setAddTypeModal(false);
      setNewType({ name: '', icon: '📄', ball: '' });
      toast("Yangi faoliyat turi qo'shildi!", 'success');
    } });
  };

  const startEditType = (ct: Criterion) => {
    setEditTypeId(ct.id);
    setEditTypeForm({ name: ct.name, icon: ct.icon, ball: ct.ball != null ? String(ct.ball) : '' });
  };

  const saveEditType = () => {
    if (!editTypeId) return;
    const ct = criteria.find(c => c.id === editTypeId);
    if (!ct) return;
    const data: Partial<Criterion> = {
      ...ct,
      name: editTypeForm.name,
      icon: editTypeForm.icon,
      ...(editTypeForm.ball !== '' ? { ball: Number(editTypeForm.ball) } : {}),
    };
    updateCriterion.mutate({ id: editTypeId, data }, { onSuccess: () => { setEditTypeId(null); toast("Faoliyat turi yangilandi!", 'success'); } });
  };

  const handleDeleteType = () => {
    if (!deleteTypeConfirm) return;
    deleteCriterion.mutate(deleteTypeConfirm.id, { onSuccess: () => { setDeleteTypeConfirm(null); toast("Faoliyat turi o'chirildi", 'info'); } });
  };

  return (
    <>
      <Wrap>
        <CardWrap>
          <CardHeader>
            <CardTitle>Faoliyat turlari va kategoriyalar</CardTitle>
            <Button size="sm" onClick={() => { setAddTypeModal(true); setNewType({ name: '', icon: '📄', ball: '' }); }}>
              <MdAdd /> Faoliyat qo'shish
            </Button>
          </CardHeader>

          {isLoading && <Loader text="Faoliyat turlari yuklanmoqda..." />}
          {!isLoading && criteria.length === 0 && (
            <CriteriaEmpty>Faoliyat turi hali qo'shilmagan</CriteriaEmpty>
          )}

          {criteria.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map((ct) => (
            <TypeBlock key={ct.id}>
              <TypeHeader onClick={() => toggle(ct.id)}>
                <TypeLeft>
                  <TypeIcon>{ct.icon}</TypeIcon>
                  <TypeName>{ct.name}</TypeName>
                  <CatCount>
                    {ct.ball != null ? `${ct.ball} ball` : `${ct.categories.length} kategoriya`}
                  </CatCount>
                </TypeLeft>
                <TypeRight>
                  {ct.ball != null ? (
                    <>
                      <NoCatHint title="Bu turda kategoriya bo'lmaydi — ball turning o'zida belgilangan. Kategoriya kerak bo'lsa, ballsiz yangi faoliyat turi yarating.">
                        Kategoriyasiz tur
                      </NoCatHint>
                      <EditTypeBtn
                        onClick={(e: React.MouseEvent) => { e.stopPropagation(); startEditType(ct); }}
                        title="Tahrirlash"
                      >
                        <MdEdit />
                      </EditTypeBtn>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="outline"
                        onClick={(e: React.MouseEvent) => { e.stopPropagation(); setAddCatModal(ct.id); setNewCat({ name: '', points: '' }); }}>
                        <MdAdd /> Kategoriya
                      </Button>
                      <EditTypeBtn
                        onClick={(e: React.MouseEvent) => { e.stopPropagation(); startEditType(ct); }}
                        title="Tahrirlash"
                      >
                        <MdEdit />
                      </EditTypeBtn>
                    </>
                  )}
                  <DeleteTypeBtn
                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); setDeleteTypeConfirm({ id: ct.id, name: ct.name }); }}
                    title="Turni o'chirish"
                  >
                    <MdDelete />
                  </DeleteTypeBtn>
                  {expanded[ct.id] ? <MdExpandLess /> : <MdExpandMore />}
                </TypeRight>
              </TypeHeader>

              {expanded[ct.id] && (
                <CatTable>
                  <CatHead>
                    <span>Kategoriya nomi</span>
                    <span>Maksimal ball</span>
                    <span>Holat</span>
                    <span>Amallar</span>
                  </CatHead>

                  {ct.ball != null ? (
                    <TypeBallRow $inactive={ct.active === false}>
                      <TypeBallName>{ct.name}</TypeBallName>
                      <CatPoints>+{ct.ball}</CatPoints>
                      <span>
                        <Switch
                          checked={ct.active !== false}
                          disabled={busy}
                          onChange={() => toggleTypeActive(ct.id)}
                        />
                      </span>
                      <RowActions>
                        <ActionBtn onClick={() => startEditType(ct)} title="Tahrirlash">
                          <MdEdit />
                        </ActionBtn>
                      </RowActions>
                    </TypeBallRow>
                  ) : (
                    ct.categories.map((cat) => (
                      <CatRow key={cat.id} $inactive={!cat.active}>
                        <CatName>{cat.name}</CatName>
                        <CatPoints>+{cat.points}</CatPoints>
                        <span>
                          <Switch
                            checked={cat.active}
                            disabled={busy}
                            onChange={() => toggleCatActive(ct.id, cat.id)}
                          />
                        </span>
                        <RowActions>
                          <ActionBtn onClick={() => startEditCat(ct.id, cat)} title="Tahrirlash">
                            <MdEdit />
                          </ActionBtn>
                          <ActionBtn $danger
                            onClick={() => setDeleteConfirm({ catId: cat.id, catName: cat.name })}
                            title="O'chirish">
                            <MdDelete />
                          </ActionBtn>
                        </RowActions>
                      </CatRow>
                    ))
                  )}
                </CatTable>
              )}
            </TypeBlock>
          ))}
          {criteria.length > PAGE_SIZE && (() => {
            const totalPages = Math.ceil(criteria.length / PAGE_SIZE);
            const start = (currentPage - 1) * PAGE_SIZE + 1;
            const end = Math.min(currentPage * PAGE_SIZE, criteria.length);
            return (
              <PagRow>
                <PagBtn onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>
                  <MdChevronLeft />
                </PagBtn>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <PagNumBtn key={p} $active={p === currentPage} onClick={() => setCurrentPage(p)}>
                    {p}
                  </PagNumBtn>
                ))}
                <PagBtn onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}>
                  <MdChevronRight />
                </PagBtn>
                <PagInfo>{start}–{end} / {criteria.length}</PagInfo>
              </PagRow>
            );
          })()}
        </CardWrap>
      </Wrap>

      <Modal
        open={!!editingCat}
        onClose={() => setEditingCat(null)}
        title="Kategoriyani tahrirlash"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditingCat(null)}>Bekor</Button>
            <Button onClick={saveEditCat} disabled={busy || !editForm.name || !catPointsValid(editForm.points)}>Saqlash</Button>
          </>
        }
      >
        <FormGroup>
          <Label>Kategoriya nomi *</Label>
          <Input
            style={{ width: '100%' }}
            value={editForm.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Kategoriya nomini kiriting..."
          />
        </FormGroup>
        <FormGroup style={{ marginBottom: 0 }}>
          <Label>Maksimal ball * (1–{CAT_POINTS_MAX})</Label>
          <NumberField
            min={1}
            style={{ width: '100%' }}
            value={editForm.points === '' ? null : Number(editForm.points)}
            onChange={(v) => setEditForm(f => ({ ...f, points: v === null ? '' : String(v) }))}
            placeholder="Ball miqdori..."
          />
          {catPointsError(editForm.points) && <HintError>{catPointsError(editForm.points)}</HintError>}
        </FormGroup>
      </Modal>

      <Modal
        open={!!addCatModal}
        onClose={() => setAddCatModal(null)}
        title="Yangi kategoriya qo'shish"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddCatModal(null)}>Bekor</Button>
            <Button onClick={handleAddCat} disabled={busy || !newCat.name || !catPointsValid(newCat.points)}>Qo'shish</Button>
          </>
        }
      >
        <FormGroup>
          <Label>Kategoriya nomi *</Label>
          <Input style={{ width: '100%' }} value={newCat.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCat(f => ({ ...f, name: e.target.value }))}
            placeholder="Kategoriya nomini kiriting..." />
        </FormGroup>
        <FormGroup>
          <Label>Maksimal ball * (1–{CAT_POINTS_MAX})</Label>
          <NumberField value={newCat.points === '' ? null : Number(newCat.points)} min={1} style={{ width: '100%' }}
            onChange={(v) => setNewCat(f => ({ ...f, points: v === null ? '' : String(v) }))}
            placeholder="Ball miqdori..." />
          {catPointsError(newCat.points) && <HintError>{catPointsError(newCat.points)}</HintError>}
        </FormGroup>
      </Modal>

      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Kategoriyani o'chirish"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Bekor qilish</Button>
            <Button variant="danger" onClick={handleDelete} disabled={busy}>O'chirish</Button>
          </>
        }
      >
        <p style={{ fontSize: 14, color: '#2C3E50' }}>
          <b>"{deleteConfirm?.catName}"</b> kategoriyasini o'chirmoqchimisiz?
          Bu amalni bekor qilib bo'lmaydi.
        </p>
      </Modal>

      <Modal
        open={addTypeModal}
        onClose={() => setAddTypeModal(false)}
        title="Yangi faoliyat turi qo'shish"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddTypeModal(false)}>Bekor</Button>
            <Button onClick={handleAddType} disabled={busy || !newType.name}>Qo'shish</Button>
          </>
        }
      >
        <FormGroup>
          <Label>Faoliyat nomi *</Label>
          <Input
            style={{ width: '100%' }}
            value={newType.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewType(f => ({ ...f, name: e.target.value }))}
            placeholder="Masalan: Loyihalar va startaplar"
          />
        </FormGroup>
        <FormGroup>
          <Label>Maksimal ball (faoliyat kategoriyasi bo'lmasa ballni kiriting)</Label>
          <NumberField
            min={1}
            style={{ width: '100%' }}
            value={newType.ball === '' ? null : Number(newType.ball)}
            onChange={(v) => setNewType(f => ({ ...f, ball: v === null ? '' : String(v) }))}
            placeholder="Agar turning o'zida ball bo'lsa..."
          />
        </FormGroup>
        <FormGroup>
          <Label>Ikonka tanlang</Label>
          <IconGrid>
            {ICONS.map(icon => (
              <IconOpt
                key={icon}
                $active={newType.icon === icon}
                onClick={() => setNewType(f => ({ ...f, icon }))}
              >
                {icon}
              </IconOpt>
            ))}
          </IconGrid>
        </FormGroup>
        {newType.name && (
          <PreviewBox>
            <span>Ko'rinishi: </span>
            <strong>{newType.icon} {newType.name}</strong>
            {newType.ball !== '' && <BallPreview>+{newType.ball} ball</BallPreview>}
          </PreviewBox>
        )}
      </Modal>

      <Modal
        open={!!editTypeId}
        onClose={() => setEditTypeId(null)}
        title="Faoliyat turini tahrirlash"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditTypeId(null)}>Bekor</Button>
            <Button onClick={saveEditType} disabled={busy || !editTypeForm.name}>Saqlash</Button>
          </>
        }
      >
        <FormGroup>
          <Label>Faoliyat nomi *</Label>
          <Input
            style={{ width: '100%' }}
            value={editTypeForm.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditTypeForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Faoliyat nomini kiriting..."
          />
        </FormGroup>
        <FormGroup>
          <Label>Maksimal ball (faoliyat kategoriyasi bo'lmasa ballni kiriting)</Label>
          <NumberField
            min={1}
            style={{ width: '100%' }}
            value={editTypeForm.ball === '' ? null : Number(editTypeForm.ball)}
            onChange={(v) => setEditTypeForm(f => ({ ...f, ball: v === null ? '' : String(v) }))}
            placeholder="Agar turning o'zida ball bo'lsa..."
          />
        </FormGroup>
        <FormGroup>
          <Label>Ikonka tanlang</Label>
          <IconGrid>
            {ICONS.map(icon => (
              <IconOpt
                key={icon}
                $active={editTypeForm.icon === icon}
                onClick={() => setEditTypeForm(f => ({ ...f, icon }))}
              >
                {icon}
              </IconOpt>
            ))}
          </IconGrid>
        </FormGroup>
        {editTypeForm.name && (
          <PreviewBox>
            <span>Ko'rinishi: </span>
            <strong>{editTypeForm.icon} {editTypeForm.name}</strong>
            {editTypeForm.ball !== '' && <BallPreview>+{editTypeForm.ball} ball</BallPreview>}
          </PreviewBox>
        )}
      </Modal>

      <Modal
        open={!!deleteTypeConfirm}
        onClose={() => setDeleteTypeConfirm(null)}
        title="Faoliyat turini o'chirish"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTypeConfirm(null)}>Bekor qilish</Button>
            <Button variant="danger" onClick={handleDeleteType} disabled={busy}>O'chirish</Button>
          </>
        }
      >
        <p style={{ fontSize: 14, color: '#2C3E50', lineHeight: 1.6 }}>
          <b>"{deleteTypeConfirm?.name}"</b> faoliyat turini o'chirmoqchimisiz?
          <br />
          <span style={{ color: '#E74C3C', fontSize: 13 }}>
            ⚠ Unga tegishli barcha kategoriyalar ham o'chiriladi.
          </span>
        </p>
      </Modal>
    </>
  );
}

const Wrap = styled.div``;

const CriteriaEmpty = styled.div`
  padding: 32px 16px;
  text-align: center;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const PagRow = styled.div`
  display: flex; align-items: center; gap: 4px;
  padding: 14px 16px;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`;

const PagBtn = styled.button`
  width: 32px; height: 32px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; color: ${({ theme }) => theme.colors.textMuted};
  background: ${({ theme }) => theme.colors.bg};
  border: 1px solid ${({ theme }) => theme.colors.border};
  transition: all 0.15s;
  &:hover:not(:disabled) { border-color: ${({ theme }) => theme.colors.primary}; color: ${({ theme }) => theme.colors.primary}; }
  &:disabled { opacity: 0.35; cursor: default; }
`;

const PagNumBtn = styled.button<{ $active: boolean }>`
  min-width: 32px; height: 32px; padding: 0 6px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: ${({ $active }) => $active ? '700' : '500'};
  color: ${({ $active, theme }) => $active ? 'white' : theme.colors.textMuted};
  background: ${({ $active, theme }) => $active ? theme.colors.primary : theme.colors.bg};
  border: 1px solid ${({ $active, theme }) => $active ? theme.colors.primary : theme.colors.border};
  transition: all 0.15s;
  &:hover:not([disabled]) { border-color: ${({ theme }) => theme.colors.primary}; color: ${({ $active, theme }) => $active ? 'white' : theme.colors.primary}; }
`;

const PagInfo = styled.span`
  margin-left: auto;
  font-size: 12px; color: ${({ theme }) => theme.colors.textMuted};
`;

const TypeBlock = styled.div`
  border: 1px solid #E8ECEF;
  border-radius: 12px;
  margin-bottom: 12px;
  overflow: hidden;
`;

const TypeHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  cursor: pointer;
  background: #F9FAFB;
  transition: background 0.15s;
  &:hover { background: var(--brand-primary-soft); }
  svg { font-size: 20px; color: #7F8C8D; }
`;

const TypeLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
`;
const TypeIcon = styled.span`font-size: 20px; flex-shrink: 0;`;
const TypeName = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: #2C3E50;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
const CatCount = styled.span`
  flex-shrink: 0;
  font-size: 11px;
  color: #7F8C8D;
  background: #E8ECEF;
  padding: 2px 8px;
  border-radius: 999px;
`;

const TypeRight = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
`;

const CatTable = styled.div`border-top: 1px solid #E8ECEF;`;

const CatHead = styled.div`
  display: grid;
  grid-template-columns: 1fr 80px 80px 100px;
  padding: 8px 16px;
  background: #F4F6F9;
  font-size: 11px;
  font-weight: 600;
  color: #7F8C8D;
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const CatRow = styled.div<{ $inactive: boolean }>`
  display: grid;
  grid-template-columns: 1fr 80px 80px 100px;
  align-items: center;
  padding: 10px 16px;
  border-top: 1px solid #E8ECEF;
  opacity: ${({ $inactive }) => $inactive ? 0.5 : 1};
  transition: background 0.1s;
  &:hover { background: #F9FAFB; }
`;

const TypeBallRow = styled.div<{ $inactive: boolean }>`
  display: grid;
  grid-template-columns: 1fr 80px 80px 100px;
  align-items: center;
  padding: 10px 16px;
  border-top: 1px solid #E8ECEF;
  background: #F0FDF4;
  opacity: ${({ $inactive }) => $inactive ? 0.5 : 1};
  transition: background 0.1s;
  &:hover { background: #DCFCE7; }
`;

const TypeBallName = styled.span`
  font-size: 13px;
  color: #166534;
  font-weight: 600;
  font-style: italic;
`;

const CatName = styled.span`font-size: 13px; color: #2C3E50;`;
const CatPoints = styled.span`font-size: 13px; font-weight: 700; color: var(--brand-primary);`;

const RowActions = styled.div`display: flex; gap: 4px;`;

const ActionBtn = styled.button<{ $danger?: boolean }>`
  width: 28px; height: 28px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  font-size: 15px;
  color: ${({ $danger }) => $danger ? '#E74C3C' : '#7F8C8D'};
  background: ${({ $danger }) => $danger ? '#FDEDEC' : '#F4F6F9'};
  transition: all 0.15s;
  &:hover { opacity: 0.7; }
`;

const NoCatHint = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textMuted};
  background: ${({ theme }) => theme.colors.bg};
  border: 1px dashed ${({ theme }) => theme.colors.borderDark};
  padding: 4px 10px;
  border-radius: ${({ theme }) => theme.radius.full};
  white-space: nowrap;
  cursor: help;
`;

const EditTypeBtn = styled.button`
  width: 30px; height: 30px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; color: #3498DB; background: #EBF5FB;
  flex-shrink: 0; transition: all 0.15s;
  &:hover { background: #D6EAF8; }
`;

const DeleteTypeBtn = styled.button`
  width: 30px; height: 30px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; color: #E74C3C; background: #FDEDEC;
  flex-shrink: 0; transition: all 0.15s;
  &:hover { opacity: 0.7; }
`;

const IconGrid = styled.div`display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px;`;

const IconOpt = styled.button<{ $active: boolean }>`
  width: 42px; height: 42px; border-radius: 10px; font-size: 20px;
  display: flex; align-items: center; justify-content: center;
  border: 2px solid ${({ $active }) => $active ? 'var(--brand-primary)' : '#E8ECEF'};
  background: ${({ $active }) => $active ? 'var(--brand-primary-soft)' : 'white'};
  cursor: pointer; transition: all 0.15s;
  &:hover { border-color: var(--brand-primary); }
`;

const PreviewBox = styled.div`
  margin-top: 12px; padding: 10px 14px;
  background: #F4F6F9; border-radius: 8px;
  font-size: 13px; color: #7F8C8D;
  display: flex; align-items: center; gap: 6px;
  strong { color: #2C3E50; }
`;

const BallPreview = styled.span`
  font-size: 12px; font-weight: 700; color: var(--brand-primary);
  background: var(--brand-primary-soft); padding: 2px 8px; border-radius: 999px;
`;

const HintError = styled.div`
  margin-top: 6px; font-size: 12px; color: var(--brand-error);
`;
