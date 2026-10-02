import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdAdd, MdVisibility, MdEdit, MdDelete, MdCheck } from '../../icons';
import { App, Input, Select } from '@/shared/ui';
import { usePermission } from '@/app/session';
import { getApiErrorMessage } from '@/shared/api';
import {
  PageTitle,
  FilterBar,
  Btn,
  StatCards,
  FormGroup,
  Label,
} from '../common/FormElements';
import { TableWrap, Table, Th, Td, Tr } from '../common/Table';
import Badge from '../common/Badge';
import StatCard from '../common/StatCard';
import Modal, { ModalBody, ModalFooter } from '../common/Modal';
import { useAcademicYears, withCurrent } from '../../api/reference-api';
import type { PlanHooks } from '../../api/plan-api';
import type { PlanKind, WorkPlan } from '../../api/plan-types';
import { STATUS_LABEL, STATUS_VARIANT } from './planStatus';

const fmtDate = (s: string | null) => (s ? s.slice(0, 10) : '—');

export default function PlanListView({ hooks, kind }: { hooks: PlanHooks; kind: PlanKind }) {
  const { message } = App.useApp();
  const navigate = useNavigate();

  const can = usePermission();
  const canCreate = can(`${kind.section}:create`);
  const canUpdate = can(`${kind.section}:update`);
  const canDelete = can(`${kind.section}:delete`);
  const [status, setStatus] = useState('');
  const [year, setYear] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [acadYear, setAcadYear] = useState('');
  const [toSubmit, setToSubmit] = useState<WorkPlan | null>(null);
  const [toDelete, setToDelete] = useState<WorkPlan | null>(null);

  const { data: academicYears = [] } = useAcademicYears();

  const { data: plans = [], isLoading } = hooks.usePlans({
    status: status || undefined,
    academicYear: year || undefined,
  });
  const { data: stats } = hooks.useStats();
  const createM = hooks.useCreate();
  const submitM = hooks.useSubmit();
  const deleteM = hooks.useDelete();

  const create = async () => {
    if (!title.trim()) {
      message.warning('Reja nomini kiriting');
      return;
    }
    try {
      await createM.mutateAsync({ title: title.trim(), academicYear: acadYear || undefined });
      message.success('Reja yaratildi');
      setCreateOpen(false);
      setTitle('');
      setAcadYear('');
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Yaratishda xatolik'));
    }
  };

  const doSubmit = async () => {
    if (!toSubmit) return;
    try {
      await submitM.mutateAsync(toSubmit.id);
      message.success('Reja yuborildi');
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Xatolik'));
    }
    setToSubmit(null);
  };

  const doDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteM.mutateAsync(toDelete.id);
      message.success('O‘chirildi');
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Xatolik'));
    }
    setToDelete(null);
  };

  return (
    <div>
      <PageTitle>{kind.label}</PageTitle>

      <StatCards>
        <StatCard icon="📄" iconBg="#EBF5FB" number={stats?.total ?? 0} label="Jami" />
        <StatCard icon="📤" iconBg="#EBF5FB" number={stats?.yuborilgan ?? 0} label="Yuborilgan" />
        <StatCard icon="⏳" iconBg="#FEF9E7" number={stats?.jarayonda ?? 0} label="Jarayonda" />
        <StatCard icon="✅" iconBg="#EAFAF1" number={stats?.bajarilgan ?? 0} label="Bajarilgan" />
      </StatCards>

      <FilterBar>
        <Select
          value={year}
          style={{ width: 'auto', minWidth: 200 }}
          onChange={(value) => setYear(value)}
          options={[
            { value: '', label: 'O‘quv yili — barchasi' },
            ...withCurrent(academicYears, year).map((y) => ({
              value: y.id,
              label: y.title,
            })),
          ]}
        />
        <Select
          value={status}
          style={{ width: 'auto', minWidth: 150 }}
          onChange={(value) => setStatus(value)}
          options={[
            { value: '', label: 'Barcha holat' },
            ...Object.entries(STATUS_LABEL).map(([k, v]) => ({ value: k, label: v })),
          ]}
        />
        {canCreate && (
          <div style={{ marginLeft: 'auto' }}>
            <Btn $variant="primary" onClick={() => setCreateOpen(true)}>
              <MdAdd /> Yaratish
            </Btn>
          </div>
        )}
      </FilterBar>

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th style={{ width: 48 }}>#</Th>
              <Th>Nomi</Th>
              <Th>O‘quv yili</Th>
              <Th>Yaratilgan sana</Th>
              <Th>Status</Th>
              <Th style={{ width: 150 }}>Amallar</Th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p, i) => (
              <Tr key={p.id}>
                <Td>{i + 1}</Td>
                <Td>{p.title}</Td>
                <Td>{p.academicYear || '—'}</Td>
                <Td>{fmtDate(p.createdAt)}</Td>
                <Td>
                  <Badge variant={STATUS_VARIANT[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                </Td>
                <Td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Btn
                      $variant="ghost"
                      $size="sm"
                      onClick={() => navigate(`${kind.routeBase}/${p.id}`)}
                      title="Ko‘rish / tahrirlash"
                    >
                      {p.status === 'yangi' || p.status === 'rad_etilgan' ? <MdEdit /> : <MdVisibility />}
                    </Btn>
                    {p.status === 'yangi' && (
                      <>
                        {canUpdate && (
                          <Btn
                            $variant="ghost"
                            $size="sm"
                            onClick={() => setToSubmit(p)}
                            title="Yuborish"
                          >
                            <MdCheck />
                          </Btn>
                        )}
                        {canDelete && (
                          <Btn
                            $variant="ghost"
                            $size="sm"
                            onClick={() => setToDelete(p)}
                            title="O‘chirish"
                          >
                            <MdDelete />
                          </Btn>
                        )}
                      </>
                    )}
                  </div>
                </Td>
              </Tr>
            ))}
            {!isLoading && plans.length === 0 && (
              <Tr>
                <Td colSpan={6} style={{ textAlign: 'center', color: '#7F8C8D', padding: 32 }}>
                  Reja topilmadi
                </Td>
              </Tr>
            )}
          </tbody>
        </Table>
      </TableWrap>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={`${kind.label} yaratish`}>
        <ModalBody>
          <FormGroup>
            <Label>Nomi *</Label>
            <Input
              value={title}
              style={{ width: '100%' }}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Reja nomi"
            />
          </FormGroup>
          <FormGroup>
            <Label>O‘quv yili</Label>
            <Input
              value={acadYear}
              style={{ width: '100%' }}
              onChange={(e) => setAcadYear(e.target.value)}
              placeholder="2025-2026"
            />
          </FormGroup>
        </ModalBody>
        <ModalFooter>
          <Btn $variant="ghost" onClick={() => setCreateOpen(false)}>
            Bekor qilish
          </Btn>
          <Btn $variant="primary" onClick={create} disabled={createM.isPending}>
            Yaratish
          </Btn>
        </ModalFooter>
      </Modal>

      <Modal open={!!toSubmit} onClose={() => setToSubmit(null)} title="Rejani yuborish" width="400px">
        <ModalBody>
          <div style={{ fontSize: 13, color: '#475569' }}>
            <b>{toSubmit?.title}</b> — yuborilgandan so‘ng tahrirlab bo‘lmaydi va tasdiqlashga
            o‘tadi. Yuborilsinmi?
          </div>
        </ModalBody>
        <ModalFooter>
          <Btn $variant="ghost" onClick={() => setToSubmit(null)}>
            Bekor
          </Btn>
          <Btn $variant="primary" onClick={doSubmit} disabled={submitM.isPending}>
            Yuborish
          </Btn>
        </ModalFooter>
      </Modal>

      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="O‘chirishni tasdiqlang" width="400px">
        <ModalBody>
          <div style={{ fontSize: 13, color: '#475569' }}>
            <b>{toDelete?.title}</b> rejasini o‘chirmoqchimisiz?
          </div>
        </ModalBody>
        <ModalFooter>
          <Btn $variant="ghost" onClick={() => setToDelete(null)}>
            Bekor
          </Btn>
          <Btn $variant="danger" onClick={doDelete} disabled={deleteM.isPending}>
            O‘chirish
          </Btn>
        </ModalFooter>
      </Modal>
    </div>
  );
}
