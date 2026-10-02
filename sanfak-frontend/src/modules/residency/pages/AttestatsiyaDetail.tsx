import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import { MdArrowBack, MdEdit, MdDelete, MdCheck, MdClose, MdInfo } from '../icons';
import { App, Switch, Textarea } from '@/shared/ui';
import { usePermission } from '@/app/session';
import { getApiErrorMessage } from '@/shared/api';
import {
  PageTitle,
  SectionTitle,
  Btn,
  StatCards,
} from '../components/common/FormElements';
import { TableWrap, Table, Th, Td, Tr } from '../components/common/Table';
import Badge from '../components/common/Badge';
import StatCard from '../components/common/StatCard';
import Modal, { ModalBody, ModalFooter } from '../components/common/Modal';
import { NumberField } from '../components/common/NumberField';
import {
  useAttestation,
  useAttestationResults,
  useUpdateAttestationResult,
  useDeleteAttestationResult,
} from '../api/attestation-api';
import { scoreVariant } from '../api/attestation-types';
import type { AttestationResult } from '../api/attestation-types';

const fmtDate = (d: string | null): string => (d ? d.slice(0, 10) : '—');
const nameOf = (r: AttestationResult): string => r.resident?.fullName || r.residentName || '—';

const Banner = styled.div`
  background: ${({ theme }) => theme.colors.white};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 14px;
  padding: 16px 20px;
  margin-bottom: 20px;
`;
const BannerTitle = styled.div`
  font-size: 16px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
  margin-bottom: 12px;
`;
const BannerMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
`;
const MetaItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;
const MetaLabel = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textMuted};
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;
const MetaValue = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;
const CellRow = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
`;

export default function AttestatsiyaDetail() {
  const { message } = App.useApp();

  const can = usePermission();
  const canUpdate = can('residencyAttestation:update');
  const canDelete = can('residencyAttestation:delete');

  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: detail, isLoading } = useAttestation(id);
  const { data: results = [] } = useAttestationResults(id);
  const updateM = useUpdateAttestationResult();
  const deleteM = useDeleteAttestationResult();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editScore, setEditScore] = useState('');
  const [excludeTarget, setExcludeTarget] = useState<AttestationResult | null>(null);
  const [excludeReason, setExcludeReason] = useState('');
  const [reasonView, setReasonView] = useState<AttestationResult | null>(null);
  const [toDelete, setToDelete] = useState<AttestationResult | null>(null);

  const attestation = detail?.attestation;
  const summary = detail?.summary;

  const startEdit = (r: AttestationResult) => {
    setEditingId(r.id);
    setEditScore(r.score === null ? '' : String(r.score));
  };

  const saveScore = async (r: AttestationResult) => {
    if (!id) return;
    const value = Number(editScore);
    if (editScore.trim() === '' || Number.isNaN(value) || value < 0 || value > 100) {
      message.warning('Ball 0–100 oralig‘ida bo‘lishi kerak');
      return;
    }
    try {
      await updateM.mutateAsync({ id, resultId: r.id, data: { score: value } });
      message.success('Ball saqlandi');
      setEditingId(null);
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Saqlashda xatolik'));
    }
  };

  const toggleIncluded = async (r: AttestationResult) => {
    if (r.included) {
      setExcludeTarget(r);
      setExcludeReason(r.excludeReason ?? '');
      return;
    }
    if (!id) return;
    try {
      await updateM.mutateAsync({ id, resultId: r.id, data: { included: true } });
      message.success('Attestatsiyaga qo‘yildi');
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Xatolik'));
    }
  };

  const confirmExclude = async () => {
    if (!id || !excludeTarget) return;
    if (!excludeReason.trim()) {
      message.warning('Chetlatish sababini kiriting');
      return;
    }
    try {
      await updateM.mutateAsync({
        id,
        resultId: excludeTarget.id,
        data: { included: false, excludeReason: excludeReason.trim() },
      });
      message.success('Talaba attestatsiyadan chetlatildi');
      setExcludeTarget(null);
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Xatolik'));
    }
  };

  const confirmDelete = async () => {
    if (!id || !toDelete) return;
    try {
      await deleteM.mutateAsync({ id, resultId: toDelete.id });
      message.success('O‘chirildi');
    } catch (e) {
      message.error(getApiErrorMessage(e, 'O‘chirishda xatolik'));
    }
    setToDelete(null);
  };

  return (
    <div>
      <Btn
        $variant="ghost"
        onClick={() => navigate('/residency/attestatsiyalar')}
        style={{ marginBottom: 16 }}
      >
        <MdArrowBack /> Attestatsiyalar
      </Btn>

      <PageTitle style={{ marginBottom: 14 }}>Attestatsiya natijalari</PageTitle>

      {!isLoading && !attestation && (
        <div style={{ textAlign: 'center', color: '#7F8C8D', padding: 40 }}>
          Attestatsiya topilmadi
        </div>
      )}

      {attestation && (
        <>
          <Banner>
            <BannerTitle>{attestation.scienceTitle}</BannerTitle>
            <BannerMeta>
              <MetaItem>
                <MetaLabel>Mutaxassislik</MetaLabel>
                <MetaValue>{attestation.specialtyTitle || 'Barchasi'}</MetaValue>
              </MetaItem>
              <MetaItem>
                <MetaLabel>O‘quv yili</MetaLabel>
                <MetaValue>{attestation.academicYear || '—'}</MetaValue>
              </MetaItem>
              <MetaItem>
                <MetaLabel>Kurs</MetaLabel>
                <MetaValue>
                  {attestation.courseNumber ? `${attestation.courseNumber}-kurs` : 'Barchasi'}
                </MetaValue>
              </MetaItem>
              <MetaItem>
                <MetaLabel>Guruh</MetaLabel>
                <MetaValue>{attestation.groupTitle || 'Barchasi'}</MetaValue>
              </MetaItem>
              <MetaItem>
                <MetaLabel>Sana</MetaLabel>
                <MetaValue>{fmtDate(attestation.date)}</MetaValue>
              </MetaItem>
            </BannerMeta>
          </Banner>

          <StatCards>
            <StatCard icon="👥" iconBg="#EBF5FB" number={summary?.total ?? 0} label="Talabalar" />
            <StatCard
              icon="✅"
              iconBg="#EAFAF1"
              number={summary?.included ?? 0}
              label="Attestatsiyaga qo‘yilgan"
            />
            <StatCard icon="📝" iconBg="#FEF9E7" number={summary?.scored ?? 0} label="Baholangan" />
            <StatCard
              icon="⭐"
              iconBg="#F5EEF8"
              number={summary?.avgScore ?? '—'}
              label="O‘rtacha ball"
            />
          </StatCards>
        </>
      )}

      <SectionTitle>Talabalar natijalari ({results.length})</SectionTitle>

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th style={{ width: 48 }}>№</Th>
              <Th>F.I.Sh</Th>
              <Th style={{ width: 170 }}>Ball</Th>
              <Th style={{ width: 190 }}>Attestatsiyaga qo‘yilgan</Th>
              {canDelete && <Th style={{ width: 90 }}>Amallar</Th>}
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => {
              const isEditing = editingId === r.id;
              return (
                <Tr key={r.id}>
                  <Td>{i + 1}</Td>
                  <Td style={{ fontWeight: 500 }}>{nameOf(r)}</Td>
                  <Td>
                    {isEditing ? (
                      <CellRow>
                        <NumberField
                          autoFocus
                          style={{ width: 96 }}
                          value={editScore === '' ? null : Number(editScore)}
                          onChange={(v) => setEditScore(v === null ? '' : String(v))}
                          placeholder="0–100"
                        />
                        <Btn
                          $variant="ghost"
                          $size="sm"
                          onClick={() => saveScore(r)}
                          disabled={updateM.isPending}
                          title="Saqlash"
                        >
                          <MdCheck />
                        </Btn>
                        <Btn
                          $variant="ghost"
                          $size="sm"
                          onClick={() => setEditingId(null)}
                          title="Bekor qilish"
                        >
                          <MdClose />
                        </Btn>
                      </CellRow>
                    ) : (
                      <CellRow>
                        <Badge variant={scoreVariant(r.score)}>{r.score ?? '—'}</Badge>
                        {canUpdate && (
                          <Btn
                            $variant="ghost"
                            $size="sm"
                            onClick={() => startEdit(r)}
                            title="Ballni tahrirlash"
                          >
                            <MdEdit />
                          </Btn>
                        )}
                      </CellRow>
                    )}
                  </Td>
                  <Td>
                    <CellRow>
                      {canUpdate ? (
                        <Switch
                          checked={r.included}
                          loading={updateM.isPending}
                          onChange={() => toggleIncluded(r)}
                          title={r.included ? 'Chetlatish' : 'Attestatsiyaga qo‘yish'}
                          aria-label="Attestatsiyaga qo‘yilgan"
                        />
                      ) : (
                        <Badge variant={r.included ? 'faol' : 'umumiy'}>
                          {r.included ? 'Ha' : 'Yo‘q'}
                        </Badge>
                      )}
                      {!r.included && (
                        <Btn
                          $variant="ghost"
                          $size="sm"
                          onClick={() => setReasonView(r)}
                          title="Chetlatish sababini ko‘rish"
                        >
                          <MdInfo />
                        </Btn>
                      )}
                    </CellRow>
                  </Td>
                  {canDelete && (
                    <Td>
                      <Btn
                        $variant="ghost"
                        $size="sm"
                        onClick={() => setToDelete(r)}
                        title="O‘chirish"
                      >
                        <MdDelete />
                      </Btn>
                    </Td>
                  )}
                </Tr>
              );
            })}
            {results.length === 0 && (
              <Tr>
                <Td
                  colSpan={canDelete ? 5 : 4}
                  style={{ textAlign: 'center', color: '#7F8C8D', padding: 32 }}
                >
                  Hali talabalar qo‘shilmagan
                </Td>
              </Tr>
            )}
          </tbody>
        </Table>
      </TableWrap>

      <Modal
        open={!!excludeTarget}
        onClose={() => setExcludeTarget(null)}
        title="Attestatsiyadan chetlatish sababi"
        width="440px"
      >
        <ModalBody>
          <div style={{ fontSize: 13, color: '#475569', marginBottom: 10 }}>
            <b>{excludeTarget ? nameOf(excludeTarget) : ''}</b> ni attestatsiyadan chetlatish
            sababini kiriting:
          </div>
          <Textarea
            autoFocus
            rows={3}
            value={excludeReason}
            onChange={(v) => setExcludeReason(v)}
            placeholder="Sababni kiriting..."
          />
        </ModalBody>
        <ModalFooter>
          <Btn $variant="ghost" onClick={() => setExcludeTarget(null)}>
            Bekor qilish
          </Btn>
          <Btn
            $variant="danger"
            onClick={confirmExclude}
            disabled={updateM.isPending || !excludeReason.trim()}
          >
            Tasdiqlash
          </Btn>
        </ModalFooter>
      </Modal>

      <Modal
        open={!!reasonView}
        onClose={() => setReasonView(null)}
        title="Chetlatish sababi"
        width="440px"
      >
        <ModalBody>
          <div style={{ fontSize: 12, color: '#7F8C8D', marginBottom: 6, fontWeight: 500 }}>
            {reasonView ? nameOf(reasonView) : ''}
          </div>
          <Textarea readOnly rows={3} value={reasonView?.excludeReason ?? ''} />
        </ModalBody>
        <ModalFooter>
          <Btn $variant="primary" onClick={() => setReasonView(null)}>
            Yopish
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
            <b>{toDelete ? nameOf(toDelete) : ''}</b> talabaning natijasini o‘chirmoqchimisiz? Bu
            amalni bekor qilib bo‘lmaydi.
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
    </div>
  );
}
