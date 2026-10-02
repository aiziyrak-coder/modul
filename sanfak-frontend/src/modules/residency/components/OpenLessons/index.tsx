import { useMemo, useState } from 'react';
import { App, DatePicker, Input, Select, Textarea } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { MdAdd, MdDelete, MdEdit } from '../../icons';
import {
  SectionTitle,
  Btn,
  FormGroup,
  Label,
  HelperText,
} from '../common/FormElements';
import { TableWrap, Table, Th, Td, Tr } from '../common/Table';
import Badge from '../common/Badge';
import Modal, { ModalBody, ModalFooter } from '../common/Modal';
import TruncCell from '../common/TruncCell';
import { AsyncSelect } from '../common/AsyncSelect';
import { useRooms } from '../../api/reference-api';
import { useSupervisorUsers } from '../../api/residency-api';
import {
  useResidentOpenLessons,
  useCreateOpenLesson,
  useUpdateOpenLesson,
  useDeleteOpenLesson,
} from '../../api/open-lesson-api';
import {
  OPEN_LESSON_TYPE_LABEL,
  type OpenLesson,
  type OpenLessonInput,
  type OpenLessonPlanKind,
  type OpenLessonType,
} from '../../api/open-lesson-types';
import { Section, Head, Hint, Empty, ChipRow, Chip, ChipX, TaskLine, Muted } from './style';

const TEACHER_ROLES = ['oqituvchi', 'kafedra_mudiri', 'dekan', 'ilmiy_rahbar', 'klinik_ustoz'];

const TYPES: OpenLessonType[] = ['ochiq_dars', 'dars_kuzatish'];

const fmtDate = (d: string | null): string => (d ? d.slice(0, 10) : '—');

interface FormState {
  type: OpenLessonType;
  date: string;
  room: string;
  topic: string;
  taskTitle: string;
  note: string;
  attendees: { id: string; name: string }[];
}

const EMPTY: FormState = {
  type: 'ochiq_dars',
  date: '',
  room: '',
  topic: '',
  taskTitle: '',
  note: '',
  attendees: [],
};

export interface OpenLessonsProps {
  residentId: string;
  planId: string;
  planKind: OpenLessonPlanKind;
  taskTitles: string[];
  canAssign: boolean;
}

export default function OpenLessons({
  residentId,
  planId,
  planKind,
  taskTitles,
  canAssign,
}: OpenLessonsProps) {
  const { message } = App.useApp();
  const { data: all = [], isLoading } = useResidentOpenLessons(residentId);
  const { data: rooms = [] } = useRooms(canAssign);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<OpenLesson | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [toDelete, setToDelete] = useState<OpenLesson | null>(null);
  const [search, setSearch] = useState('');

  const { data: teachers = [], isFetching: teachersLoading } = useSupervisorUsers(
    open && canAssign,
    search,
    TEACHER_ROLES,
  );

  const createM = useCreateOpenLesson();
  const updateM = useUpdateOpenLesson();
  const deleteM = useDeleteOpenLesson();

  const rows = useMemo(
    () => all.filter((x) => x.planId === null || x.planId === planId),
    [all, planId],
  );

  const teacherOptions = useMemo(
    () => teachers.map((t) => ({ value: t.id, label: t.name })),
    [teachers],
  );

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY);
    setSearch('');
    setOpen(true);
  };

  const openEdit = (x: OpenLesson) => {
    setEditing(x);
    setForm({
      type: x.type,
      date: x.date.slice(0, 10),
      room: x.roomId ?? '',
      topic: x.topic ?? '',
      taskTitle: x.taskTitle ?? '',
      note: x.note ?? '',
      attendees: x.attendees.map((a) => ({ id: a.userId, name: a.name ?? '—' })),
    });
    setSearch('');
    setOpen(true);
  };

  const addTeacher = (id: string, label?: string) => {
    if (!id) return;
    setForm((f) =>
      f.attendees.some((a) => a.id === id)
        ? f
        : { ...f, attendees: [...f.attendees, { id, name: label ?? id }] },
    );
  };

  const save = async () => {
    if (!form.date) {
      message.warning('Sanani kiriting');
      return;
    }
    const payload: OpenLessonInput = {
      resident: residentId,
      type: form.type,
      date: form.date,
      room: form.room || null,
      topic: form.topic.trim() || null,
      taskTitle: form.taskTitle || null,
      note: form.note.trim() || null,
      attendees: form.attendees.map((a) => ({ user: a.id })),
      plan: planId,
      planKind,
    };
    try {
      if (editing) {
        const { resident: _resident, ...rest } = payload;
        await updateM.mutateAsync({ id: editing.id, data: rest });
        message.success('Biriktirish yangilandi');
      } else {
        await createM.mutateAsync(payload);
        message.success('Ochiq dars biriktirildi');
      }
      setOpen(false);
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Saqlashda xatolik'));
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
    <Section>
      <Head>
        <SectionTitle style={{ margin: 0 }}>Ochiq dars / dars kuzatish</SectionTitle>
        {canAssign && (
          <Btn $variant="primary" $size="sm" onClick={openAdd}>
            <MdAdd /> Biriktirish
          </Btn>
        )}
      </Head>

      <Hint>
        TZ 4.5.7 — ilmiy rahbar ish reja bandiga sana, auditoriya, mavzu va kiradigan
        o‘qituvchilarni biriktiradi.
      </Hint>

      {rows.length === 0 && !isLoading ? (
        <Empty>Hozircha biriktirilgan ochiq dars yo‘q</Empty>
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th style={{ width: 40 }}>№</Th>
                <Th style={{ width: 130 }}>Turi</Th>
                <Th style={{ width: 100 }}>Sana</Th>
                <Th style={{ width: 130 }}>Auditoriya</Th>
                <Th>Mavzu / ish reja bandi</Th>
                <Th>Kiradigan o‘qituvchilar</Th>
                {canAssign && <Th style={{ width: 90 }}>Amallar</Th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((x, i) => (
                <Tr key={x.id}>
                  <Td>{i + 1}</Td>
                  <Td>
                    <Badge variant={x.type === 'ochiq_dars' ? 'info' : 'umumiy'}>
                      {OPEN_LESSON_TYPE_LABEL[x.type]}
                    </Badge>
                  </Td>
                  <Td style={{ whiteSpace: 'nowrap' }}>{fmtDate(x.date)}</Td>
                  <Td>{x.roomTitle || <Muted>—</Muted>}</Td>
                  <Td>
                    {x.topic ? <TruncCell text={x.topic} /> : <Muted>—</Muted>}
                    {x.taskTitle && <TaskLine>{x.taskTitle}</TaskLine>}
                  </Td>
                  <Td>
                    {x.attendees.length === 0 ? (
                      <Muted>—</Muted>
                    ) : (
                      <TruncCell text={x.attendees.map((a) => a.name || '—').join(', ')} />
                    )}
                  </Td>
                  {canAssign && (
                    <Td style={{ whiteSpace: 'nowrap' }}>
                      <Btn $variant="ghost" $size="sm" onClick={() => openEdit(x)} title="Tahrirlash">
                        <MdEdit />
                      </Btn>
                      <Btn
                        $variant="ghost"
                        $size="sm"
                        onClick={() => setToDelete(x)}
                        title="O‘chirish"
                      >
                        <MdDelete />
                      </Btn>
                    </Td>
                  )}
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Biriktirishni tahrirlash' : 'Ochiq dars biriktirish'}
        width="520px"
      >
        <ModalBody>
          <div style={{ display: 'flex', gap: 12 }}>
            <FormGroup style={{ flex: 1 }}>
              <Label>Turi *</Label>
              <Select
                value={form.type}
                style={{ width: '100%' }}
                onChange={(value) =>
                  setForm((f) => ({ ...f, type: value as OpenLessonType }))
                }
                options={TYPES.map((t) => ({ value: t, label: OPEN_LESSON_TYPE_LABEL[t] }))}
              />
            </FormGroup>
            <FormGroup style={{ flex: 1 }}>
              <Label>Sana *</Label>
              <DatePicker
                value={form.date || null}
                onChange={(value) => setForm((f) => ({ ...f, date: value ?? '' }))}
              />
            </FormGroup>
          </div>

          <FormGroup>
            <Label>Auditoriya</Label>
            <Select
              value={form.room}
              showSearch
              optionFilterProp="label"
              style={{ width: '100%' }}
              onChange={(value) => setForm((f) => ({ ...f, room: value }))}
              options={[
                { value: '', label: 'Tanlanmagan' },
                ...rooms.map((r) => ({ value: r.id, label: r.label })),
              ]}
            />
            {rooms.length === 0 && (
              <HelperText>
                Auditoriyalar ro‘yxati bo‘sh — ma’lumotnomada xona qo‘shilmagan yoki
                ko‘rish huquqi yo‘q.
              </HelperText>
            )}
          </FormGroup>

          <FormGroup>
            <Label>Mavzu</Label>
            <Input
              value={form.topic}
              style={{ width: '100%' }}
              onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
              placeholder="Dars mavzusi"
            />
          </FormGroup>

          <FormGroup>
            <Label>Ish reja bandi</Label>
            <Select
              value={form.taskTitle}
              style={{ width: '100%' }}
              onChange={(value) => setForm((f) => ({ ...f, taskTitle: value }))}
              options={[
                { value: '', label: 'Tanlanmagan' },
                ...taskTitles.map((t) => ({ value: t, label: t })),
              ]}
            />
            <HelperText>Reja bandining nomi saqlanadi (ma’lumot uchun)</HelperText>
          </FormGroup>

          <FormGroup>
            <Label>Kiradigan o‘qituvchilar</Label>
            <AsyncSelect
              value=""
              onChange={(v, option) => addTeacher(v, option?.label)}
              options={teacherOptions}
              onSearch={setSearch}
              loading={teachersLoading}
              placeholder="Qidirib qo‘shing"
              notFoundText="O‘qituvchi topilmadi"
            />
            <ChipRow>
              {form.attendees.length === 0 ? (
                <Muted style={{ fontSize: 12 }}>Hech kim qo‘shilmagan</Muted>
              ) : (
                form.attendees.map((a) => (
                  <Chip key={a.id}>
                    {a.name}
                    <ChipX
                      type="button"
                      aria-label={`${a.name} — olib tashlash`}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          attendees: f.attendees.filter((x) => x.id !== a.id),
                        }))
                      }
                    >
                      ×
                    </ChipX>
                  </Chip>
                ))
              )}
            </ChipRow>
          </FormGroup>

          <FormGroup style={{ marginBottom: 0 }}>
            <Label>Izoh</Label>
            <Textarea
              rows={2}
              value={form.note}
              onChange={(value) => setForm((f) => ({ ...f, note: value }))}
            />
          </FormGroup>
        </ModalBody>
        <ModalFooter>
          <Btn $variant="ghost" onClick={() => setOpen(false)}>
            Bekor qilish
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
          <div style={{ fontSize: 13, color: '#475569' }}>
            <b>{toDelete ? OPEN_LESSON_TYPE_LABEL[toDelete.type] : ''}</b> (
            {fmtDate(toDelete?.date ?? null)}) biriktirishini o‘chirmoqchimisiz?
          </div>
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
    </Section>
  );
}
