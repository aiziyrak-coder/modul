import { Fragment, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import styled from 'styled-components';
import { MdArrowBack, MdAdd, MdCheck } from '../../icons';
import { App, DatePicker, Input, Textarea } from '@/shared/ui';
import { usePermission } from '@/app/session';
import { getApiErrorMessage } from '@/shared/api';
import {
  PageTitle,
  Tabs,
  Tab,
  Btn,
  FormGroup,
  Label,
  HelperText,
} from '../common/FormElements';
import { NumberField } from '../common/NumberField';
import { TableWrap, Table, Th, Td, Tr } from '../common/Table';
import Badge from '../common/Badge';
import QueryNotice from '../common/QueryNotice';
import { combineState } from '../../lib/query-state';
import FileUpload from '../common/FileUpload';
import Modal, { ModalBody, ModalFooter } from '../common/Modal';
import type { PlanHooks } from '../../api/plan-api';
import type { PlanKind, WorkPlanTask } from '../../api/plan-types';
import { STATUS_LABEL, STATUS_VARIANT } from './planStatus';
import OpenLessons from '../OpenLessons';

const ROLE_LABEL: Record<string, string> = {
  magistratura_bolim: 'Bo‘lim xodimi',
  ilmiy_rahbar: 'Ilmiy rahbar',
  kafedra_mudiri: 'Kafedra mudiri',
};

const RejectNote = styled.div`
  background: #fdedec;
  border: 1px solid #f1948a;
  color: #c0392b;
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 13px;
  margin-bottom: 16px;
`;
const Approvals = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 16px;
`;

const fmtDate = (s: string | null) => (s ? s.slice(0, 10) : '—');

const MIN_DUE_DATE = '2000-01-01';
const MAX_DUE_DATE = `${new Date().getUTCFullYear() + 10}-12-31`;

const PROOF_LABEL: Record<string, string> = {
  pending: 'Tasdiq kutilmoqda',
  approved: 'Tasdiqlangan',
  rejected: 'Qaytarilgan',
};
const PROOF_VARIANT: Record<string, string> = {
  pending: 'kutilmoqda',
  approved: 'bajarildi',
  rejected: 'rad_etilgan',
};

const ProofList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 0;
`;
const ProofItem = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 12px;
`;
const ProofBody = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: ${({ theme }) => theme.colors.text};
  word-break: break-word;
`;
const ProofLink = styled.a`
  color: ${({ theme }) => theme.colors.primary};
  text-decoration: underline;
`;
const ProofNote = styled.div<{ $warn?: boolean }>`
  color: ${({ theme }) => theme.colors.textMuted};
  font-style: italic;
  ${({ $warn, theme }) =>
    $warn ? `color: ${theme.colors.warning}; font-style: normal; font-weight: 500;` : ''}
`;
const ProofDate = styled.div`
  color: ${({ theme }) => theme.colors.textMuted};
  white-space: nowrap;
`;

export default function PlanDetailView({ hooks, kind }: { hooks: PlanHooks; kind: PlanKind }) {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const can = usePermission();
  const { id } = useParams<{ id: string }>();
  const planQ = hooks.usePlan(id);
  const plan = planQ.data;
  const planState = combineState([planQ]);
  const updateM = hooks.useUpdate();
  const submitM = hooks.useSubmit();
  const proofM = hooks.useAddProof();

  const [cat, setCat] = useState(kind.categories[0]?.value ?? '');
  const [taskOpen, setTaskOpen] = useState(false);
  const [tTitle, setTTitle] = useState('');
  const [tCount, setTCount] = useState('1');
  const [tDue, setTDue] = useState('');
  const [proofFor, setProofFor] = useState<number | null>(null);
  const [pUrl, setPUrl] = useState('');
  const [pComment, setPComment] = useState('');
  const [pFile, setPFile] = useState<File | null>(null);
  const [pWorkDate, setPWorkDate] = useState(() => new Date().toISOString().slice(0, 10));

  if (planState !== 'ok') {
    return (
      <div style={{ padding: 24 }}>
        <QueryNotice state={planState} onRetry={() => void planQ.refetch()} />
      </div>
    );
  }
  if (!plan) return <div style={{ padding: 24 }}>Reja topilmadi.</div>;

  const canWrite = can(`${kind.section}:update`);
  const canEdit = canWrite && (plan.status === 'yangi' || plan.status === 'rad_etilgan');
  const inProgress = canWrite && plan.status === 'jarayonda';
  const indexed = plan.tasks.map((t, realIdx) => ({ t, realIdx }));
  const rows = indexed.filter((x) => x.t.category === cat);

  const addTask = async () => {
    if (!tTitle.trim()) {
      message.warning('Vazifa nomini kiriting');
      return;
    }
    const newTask: WorkPlanTask = {
      category: cat,
      title: tTitle.trim(),
      targetCount: Number(tCount) || 1,
      dueDate: tDue || null,
      proofs: [],
    };
    try {
      await updateM.mutateAsync({ id: plan.id, data: { tasks: [...plan.tasks, newTask] } });
      message.success('Vazifa qo‘shildi');
      setTaskOpen(false);
      setTTitle('');
      setTCount('1');
      setTDue('');
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Xatolik'));
    }
  };

  const doSubmit = async () => {
    try {
      await submitM.mutateAsync(plan.id);
      message.success('Reja yuborildi');
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Xatolik'));
    }
  };

  const addProof = async () => {
    if (proofFor === null) return;
    if (!pFile && !pUrl.trim() && !pComment.trim()) {
      message.warning('Fayl, havola yoki izohdan kamida bittasini kiriting');
      return;
    }
    try {
      await proofM.mutateAsync({
        id: plan.id,
        taskIndex: proofFor,
        data: {
          file: pFile,
          url: pUrl || undefined,
          comment: pComment || undefined,
          workDate: pWorkDate || undefined,
        },
      });
      message.success('Bajaruv qo‘shildi');
      setProofFor(null);
      setPUrl('');
      setPComment('');
      setPFile(null);
      setPWorkDate(new Date().toISOString().slice(0, 10));
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Xatolik'));
    }
  };

  return (
    <div>
      <Btn $variant="ghost" $size="sm" onClick={() => navigate(kind.routeBase)} style={{ marginBottom: 12 }}>
        <MdArrowBack /> {kind.label}
      </Btn>
      <PageTitle>
        {plan.title}{' '}
        <Badge variant={STATUS_VARIANT[plan.status]}>{STATUS_LABEL[plan.status]}</Badge>
      </PageTitle>

      {plan.status === 'rad_etilgan' && plan.rejectionReason && (
        <RejectNote>Qaytarish sababi: {plan.rejectionReason}</RejectNote>
      )}

      {plan.approvals.length > 0 && (
        <Approvals>
          {plan.approvals.map((a) => (
            <Badge key={a.role} variant="tasdiqlangan">
              {ROLE_LABEL[a.role] || a.role} ✓ {a.eriKey || ''}
              {a.eriSerialNumber ? (
                <span title={`ERI sertifikati: ${a.eriSerialNumber}`}> 🔒</span>
              ) : null}
            </Badge>
          ))}
        </Approvals>
      )}

      <Tabs>
        {kind.categories.map((c) => (
          <Tab key={c.value} $active={cat === c.value} onClick={() => setCat(c.value)}>
            {c.label}
          </Tab>
        ))}
      </Tabs>

      {canEdit && (
        <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
          <Btn $variant="outline" $size="sm" onClick={() => setTaskOpen(true)}>
            <MdAdd /> Ish reja qo‘shish
          </Btn>
          {plan.tasks.length > 0 && (
            <Btn $variant="primary" $size="sm" onClick={doSubmit} disabled={submitM.isPending}>
              <MdCheck /> Yuborish
            </Btn>
          )}
        </div>
      )}

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th style={{ width: 48 }}>T/r</Th>
              <Th>Ish turlari</Th>
              <Th style={{ width: 70 }}>Soni</Th>
              <Th style={{ width: 120 }}>Reja</Th>
              <Th>Bajaruv</Th>
              {inProgress && <Th style={{ width: 110 }}>Amallar</Th>}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ t, realIdx }, i) => {
              const approved = t.proofs.filter((p) => p.status === 'approved').length;
              const done = approved >= t.targetCount;
              return (
                <Fragment key={realIdx}>
                  <Tr>
                    <Td>{i + 1}</Td>
                    <Td>{t.title}</Td>
                    <Td>{t.targetCount}</Td>
                    <Td>{fmtDate(t.dueDate)}</Td>
                    <Td>
                      <Badge variant={done ? 'bajarildi' : t.proofs.length ? 'kutilmoqda' : 'umumiy'}>
                        {approved}/{t.targetCount}
                      </Badge>
                    </Td>
                    {inProgress && (
                      <Td>
                        <Btn $variant="outline" $size="sm" onClick={() => setProofFor(realIdx)} disabled={done}>
                          Bajarish
                        </Btn>
                      </Td>
                    )}
                  </Tr>
                  {t.proofs.length > 0 && (
                    <Tr>
                      <Td colSpan={inProgress ? 6 : 5} style={{ background: '#FAFBFC' }}>
                        <ProofList>
                          {t.proofs.map((p, pi) => (
                            <ProofItem key={pi}>
                              <Badge variant={PROOF_VARIANT[p.status]}>{PROOF_LABEL[p.status]}</Badge>
                              <ProofBody>
                                {p.lateUpload && (
                                  <ProofNote $warn>
                                    ⚠️ Kechikib yuklangan
                                    {p.workDate ? ` — ish sanasi: ${fmtDate(p.workDate)}` : ''}
                                  </ProofNote>
                                )}
                                {p.comment ? <div>{p.comment}</div> : null}
                                {p.url ? (
                                  <ProofLink href={p.url} target="_blank" rel="noreferrer noopener">
                                    {p.url}
                                  </ProofLink>
                                ) : null}
                                {p.fileUrl ? (
                                  <ProofLink href={p.fileUrl} target="_blank" rel="noreferrer noopener">
                                    Biriktirilgan fayl
                                  </ProofLink>
                                ) : null}
                                {p.reviewComment ? <ProofNote>Izoh: {p.reviewComment}</ProofNote> : null}
                              </ProofBody>
                              <ProofDate>{fmtDate(p.createdAt)}</ProofDate>
                            </ProofItem>
                          ))}
                        </ProofList>
                      </Td>
                    </Tr>
                  )}
                </Fragment>
              );
            })}
            {rows.length === 0 && (
              <Tr>
                <Td colSpan={inProgress ? 6 : 5} style={{ textAlign: 'center', color: '#7F8C8D', padding: 24 }}>
                  Bu bo‘limda vazifa yo‘q
                </Td>
              </Tr>
            )}
          </tbody>
        </Table>
      </TableWrap>

      <OpenLessons
        residentId={plan.residentId}
        planId={plan.id}
        planKind={kind.planKind}
        taskTitles={plan.tasks.map((t) => t.title)}
        canAssign={false}
      />

      <Modal open={taskOpen} onClose={() => setTaskOpen(false)} title="Ish reja qo‘shish">
        <ModalBody>
          <FormGroup>
            <Label>Vazifa nomi *</Label>
            <Input value={tTitle} style={{ width: '100%' }} onChange={(e) => setTTitle(e.target.value)} />
          </FormGroup>
          <div style={{ display: 'flex', gap: 12 }}>
            <FormGroup style={{ flex: 1 }}>
              <Label>Soni</Label>
              <NumberField
                style={{ width: '100%' }}
                value={tCount === '' ? null : Number(tCount)}
                onChange={(v) => setTCount(v === null ? '' : String(v))}
              />
            </FormGroup>
            <FormGroup style={{ flex: 1 }}>
              <Label>Bajarish muddati</Label>
              <DatePicker
                value={tDue || null}
                onChange={(v) => setTDue(v ?? '')}
                disabledDate={(d) =>
                  d.isBefore(dayjs(MIN_DUE_DATE), 'day') || d.isAfter(dayjs(MAX_DUE_DATE), 'day')
                }
              />
            </FormGroup>
          </div>
        </ModalBody>
        <ModalFooter>
          <Btn $variant="ghost" onClick={() => setTaskOpen(false)}>
            Bekor
          </Btn>
          <Btn $variant="primary" onClick={addTask} disabled={updateM.isPending}>
            Qo‘shish
          </Btn>
        </ModalFooter>
      </Modal>

      <Modal open={proofFor !== null} onClose={() => setProofFor(null)} title="Natijani kiritish">
        <ModalBody>
          <FormGroup>
            <Label>Ish qilingan sana</Label>
            <Input
              type="date"
              value={pWorkDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setPWorkDate(e.target.value)}
            />
            <HelperText>
              Ish qilingan kuni yuklansa — o‘z vaqtida. Boshqa kuni yuklansa
              yozuv saqlanadi, lekin “kechikib yuklangan” deb belgilanadi.
            </HelperText>
          </FormGroup>
          <FormGroup>
            <Label>Hujjat (ixtiyoriy)</Label>
            <FileUpload accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={setPFile} />
          </FormGroup>
          <FormGroup>
            <Label>URL havola</Label>
            <Input
              value={pUrl}
              style={{ width: '100%' }}
              onChange={(e) => setPUrl(e.target.value)}
              placeholder="http://..."
            />
          </FormGroup>
          <FormGroup>
            <Label>Izoh</Label>
            <Textarea rows={3} value={pComment} onChange={(v) => setPComment(v)} />
          </FormGroup>
        </ModalBody>
        <ModalFooter>
          <Btn $variant="ghost" onClick={() => setProofFor(null)}>
            Bekor
          </Btn>
          <Btn $variant="primary" onClick={addProof} disabled={proofM.isPending}>
            Saqlash
          </Btn>
        </ModalFooter>
      </Modal>
    </div>
  );
}
