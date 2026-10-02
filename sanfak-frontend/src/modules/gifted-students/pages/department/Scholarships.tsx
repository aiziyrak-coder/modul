import { useState } from 'react';
import styled from 'styled-components';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import { Input, DatePicker, Textarea, Switch } from '@/shared/ui';
import { NumberField } from '../../components/common/NumberField';
import { FormGroup, Label } from '../../components/common/FormElements';
import { useToast } from '../../components/common/Toast';
import { useScholarships, useUpdateScholarship, useDeleteScholarship } from '../../api/gifted-api';
import type { Scholarship } from '../../data/types';
import {
  MdEdit, MdDelete, MdCalendarToday, MdStar,
  MdPeople,
} from '../../icons';

interface FormState {
  name: string;
  description: string;
  minScore: string;
  amount: string;
  deadline: string;
  active: boolean;
}

const EMPTY_FORM: FormState = { name: '', description: '', minScore: '', amount: '', deadline: '', active: true };

interface DeleteTarget {
  id: string;
  name: string;
}

export default function DepartmentScholarships() {
  const { toast } = useToast();
  const { data: scholarships = [] } = useScholarships();
  const updateSch = useUpdateScholarship();
  const deleteSch = useDeleteScholarship();
  const busy = updateSch.isPending || deleteSch.isPending;
  const [modal, setModal] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteTarget | null>(null);

  const openEdit = (sch: Scholarship) => {
    setForm({
      name: sch.name,
      description: sch.description,
      minScore: String(sch.minScore),
      amount: sch.amount,
      deadline: sch.deadline,
      active: sch.active,
    });
    setEditId(sch.id);
    setModal('edit');
  };

  const handleSave = () => {
    if (!form.name || !form.minScore || !form.amount || !form.deadline || !editId) return;
    updateSch.mutate({
      id: editId,
      data: {
        name: form.name,
        description: form.description,
        minScore: Number(form.minScore),
        amount: form.amount,
        deadline: form.deadline,
        active: form.active,
      },
    }, {
      onSuccess: () => { setModal(null); setForm(EMPTY_FORM); toast('Stipendiya yangilandi!', 'success'); },
      onError: () => toast('Xatolik yuz berdi', 'error'),
    });
  };

  const handleDelete = () => {
    if (!deleteConfirm) return;
    deleteSch.mutate(deleteConfirm.id, {
      onSuccess: () => { setDeleteConfirm(null); toast("Stipendiya o'chirildi", 'info'); },
      onError: () => toast('Xatolik yuz berdi', 'error'),
    });
  };

  const toggleActive = (id: string) => {
    const sch = scholarships.find(s => s.id === id);
    if (!sch) return;
    const next = !sch.active;
    updateSch.mutate({ id, data: { active: next } }, {
      onSuccess: () => toast(`"${sch.name}" ${next ? 'faol' : 'nofaol'} holatga o'zgartirildi`, 'success'),
      onError: () => toast('Xatolik yuz berdi', 'error'),
    });
  };

  const isValid = Boolean(form.name && form.minScore && form.amount && form.deadline);

  return (
    <>
      <Wrap>
        <TopBar>
          <Stats>
            <StatPill>
              <span>Jami:</span>
              <b>{scholarships.length}</b>
            </StatPill>
            <StatPill $color="var(--brand-primary)">
              <span>Faol:</span>
              <b>{scholarships.filter(s => s.active).length}</b>
            </StatPill>
            <StatPill $color="#7F8C8D">
              <span>Nofaol:</span>
              <b>{scholarships.filter(s => !s.active).length}</b>
            </StatPill>
          </Stats>
        </TopBar>

        {scholarships.length === 0 ? (
          <EmptyState>
            <span>🎓</span>
            <p>Hali stipendiya qo'shilmagan — Nomdor yoki Rektor bo'limidan qo'shing</p>
          </EmptyState>
        ) : (
          <Grid>
            {scholarships.map(sch => (
              <SchCard key={sch.id} $inactive={!sch.active}>
                <SchCardHead>
                  <SchName>{sch.name}</SchName>
                  <Badge variant={sch.active ? 'approved' : 'default'}>
                    {sch.active ? 'Faol' : "Nofaol"}
                  </Badge>
                </SchCardHead>

                <SchDesc>{sch.description}</SchDesc>

                <MetaList>
                  <MetaRow>
                    <MetaIcon><MdCalendarToday /></MetaIcon>
                    <MetaLabel>Muddat:</MetaLabel>
                    <MetaValue><b>{sch.deadline}</b></MetaValue>
                  </MetaRow>
                  <MetaRow>
                    <MetaIcon $yellow><MdStar /></MetaIcon>
                    <MetaLabel>Miqdor:</MetaLabel>
                    <MetaValue><b>{sch.amount}</b></MetaValue>
                  </MetaRow>
                  <MetaRow>
                    <MetaIcon $blue><MdPeople /></MetaIcon>
                    <MetaLabel>Min. ball:</MetaLabel>
                    <MetaValue><b>{sch.minScore} ball</b></MetaValue>
                  </MetaRow>
                </MetaList>

                <ScoreBar>
                  <ScoreBarTop>
                    <span>Minimal ball talabi</span>
                    <ScoreNum>{sch.minScore}</ScoreNum>
                  </ScoreBarTop>
                  <BarTrack>
                    <BarFill
                      $pct={Math.min((sch.minScore / 150) * 100, 100)}
                      $active={sch.active}
                    />
                  </BarTrack>
                </ScoreBar>

                <CardActions>
                  <ToggleRow $active={sch.active}>
                    <Switch
                      size="small"
                      checked={sch.active}
                      onChange={() => toggleActive(sch.id)}
                    />
                    <span>{sch.active ? 'Nofaol qilish' : 'Faollashtirish'}</span>
                  </ToggleRow>
                  <ActionGroup>
                    <ActionBtn onClick={() => openEdit(sch)} title="Tahrirlash">
                      <MdEdit />
                    </ActionBtn>
                    <ActionBtn
                      $danger
                      onClick={() => setDeleteConfirm({ id: sch.id, name: sch.name })}
                      title="O'chirish"
                    >
                      <MdDelete />
                    </ActionBtn>
                  </ActionGroup>
                </CardActions>
              </SchCard>
            ))}
          </Grid>
        )}
      </Wrap>

      <Modal
        open={modal === 'edit'}
        onClose={() => setModal(null)}
        title="Stipendiyani tahrirlash"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>Bekor qilish</Button>
            <Button onClick={handleSave} disabled={busy || !isValid}>
              {busy ? 'Saqlanmoqda…' : 'Saqlash'}
            </Button>
          </>
        }
      >
        <FormGroup>
          <Label>Stipendiya nomi *</Label>
          <Input
            value={form.name}
            style={{ width: '100%' }}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Masalan: Prezident stipendiyasi"
          />
        </FormGroup>
        <FormGroup>
          <Label>Tavsif</Label>
          <Textarea
            value={form.description}
            onChange={(value) => setForm(f => ({ ...f, description: value }))}
            placeholder="Stipendiya haqida qisqa ma'lumot..."
            style={{ minHeight: 80 }}
          />
        </FormGroup>
        <TwoCol>
          <FormGroup>
            <Label>Minimal ball *</Label>
            <NumberField
              min={0}
              style={{ width: '100%' }}
              value={form.minScore === '' ? null : Number(form.minScore)}
              onChange={(value) => setForm(f => ({ ...f, minScore: value === null ? '' : String(value) }))}
              placeholder="100"
            />
          </FormGroup>
          <FormGroup>
            <Label>Stipendiya muddati *</Label>
            <DatePicker
              size="middle"
              value={form.deadline || null}
              onChange={(value) => setForm(f => ({ ...f, deadline: value ?? '' }))}
            />
          </FormGroup>
        </TwoCol>
        <FormGroup>
          <Label>Miqdor / tavsif *</Label>
          <Input
            value={form.amount}
            style={{ width: '100%' }}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, amount: e.target.value }))}
            placeholder="Masalan: 3,000,000 so'm/oy yoki To'liq grant"
          />
        </FormGroup>
        <FormGroup style={{ marginBottom: 0 }}>
          <Label>Holat</Label>
          <ActiveToggleRow>
            <Switch
              checked={form.active}
              onChange={(checked) => setForm(f => ({ ...f, active: checked }))}
            />
            <ActiveToggleLabel $active={form.active}>
              {form.active ? 'Faol — talabalar ko\'ra oladi' : "Nofaol — talabalar ko'ra olmaydi"}
            </ActiveToggleLabel>
          </ActiveToggleRow>
        </FormGroup>
      </Modal>

      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Stipendiyani o'chirish"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Bekor qilish</Button>
            <Button variant="danger" onClick={handleDelete} disabled={busy}>O'chirish</Button>
          </>
        }
      >
        <p style={{ fontSize: 14, color: '#2C3E50', lineHeight: 1.6 }}>
          <b>"{deleteConfirm?.name}"</b> stipendiyasini o'chirmoqchimisiz?
          <br />
          <span style={{ fontSize: 13, color: '#E74C3C' }}>
            ⚠ Bu amalni bekor qilib bo'lmaydi.
          </span>
        </p>
      </Modal>
    </>
  );
}

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const TopBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const Stats = styled.div`
  display: flex;
  gap: 10px;
`;

const StatPill = styled.div<{ $color?: string }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: white;
  border: 1px solid ${({ $color }) => $color || '#E8ECEF'};
  border-radius: 999px;
  font-size: 13px;
  color: ${({ $color }) => $color || '#2C3E50'};

  span { color: #7F8C8D; }
  b { font-weight: 700; }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 18px;
`;

const SchCard = styled.div<{ $inactive: boolean }>`
  background: white;
  border-radius: 14px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  box-shadow: ${({ theme }) => theme.shadow.sm};
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  opacity: ${({ $inactive }) => $inactive ? 0.7 : 1};
  transition: box-shadow 0.15s;
  &:hover { box-shadow: ${({ theme }) => theme.shadow.md}; }
`;

const SchCardHead = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
`;

const SchName = styled.h3`
  font-size: 15px;
  font-weight: 700;
  color: #2C3E50;
  line-height: 1.3;
  flex: 1;
`;

const SchDesc = styled.p`
  font-size: 13px;
  color: #7F8C8D;
  line-height: 1.55;
`;

const MetaList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const MetaRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
`;

const MetaIcon = styled.span<{ $yellow?: boolean; $blue?: boolean }>`
  font-size: 15px;
  color: ${({ $yellow, $blue }) =>
    $yellow ? '#F39C12' : $blue ? '#3498DB' : '#7F8C8D'};
  display: flex;
`;

const MetaLabel = styled.span`
  color: #7F8C8D;
  min-width: 70px;
`;

const MetaValue = styled.span`
  color: #2C3E50;
`;

const ScoreBar = styled.div`
  background: #F4F6F9;
  border-radius: 10px;
  padding: 10px 12px;
`;

const ScoreBarTop = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #7F8C8D;
  margin-bottom: 8px;
`;

const ScoreNum = styled.span`
  font-weight: 700;
  color: #2C3E50;
`;

const BarTrack = styled.div`
  height: 8px;
  background: #E8ECEF;
  border-radius: 999px;
  overflow: hidden;
`;

const BarFill = styled.div<{ $pct: number; $active: boolean }>`
  height: 100%;
  width: ${({ $pct }) => $pct}%;
  background: ${({ $active }) => $active ? 'var(--brand-primary)' : '#BDC3C7'};
  border-radius: 999px;
  transition: width 0.5s ease;
`;

const CardActions = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
  padding-top: 12px;
  border-top: 1px solid #E8ECEF;
`;

const ToggleRow = styled.span<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 500;
  color: ${({ $active }) => $active ? '#E74C3C' : 'var(--brand-primary)'};
`;

const ActionGroup = styled.div`
  display: flex;
  gap: 6px;
`;

const ActionBtn = styled.button<{ $danger?: boolean }>`
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

const TwoCol = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
`;

const ActiveToggleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 4px;
`;

const ActiveToggleLabel = styled.span<{ $active: boolean }>`
  font-size: 13px;
  color: ${({ $active }) => $active ? 'var(--brand-primary)' : '#7F8C8D'};
  font-weight: 500;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px;
  background: white;
  border-radius: 14px;
  border: 1px dashed #E8ECEF;

  span { font-size: 48px; }
  p { font-size: 14px; color: #7F8C8D; }
`;
