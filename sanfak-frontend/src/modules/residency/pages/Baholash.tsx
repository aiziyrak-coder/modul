import { useMemo, useState } from 'react';
import styled from 'styled-components';
import { App, Input, Select } from '@/shared/ui';
import { usePermission } from '@/app/session';
import { getApiErrorMessage } from '@/shared/api';
import { MdAdd, MdDelete, MdSearch } from '../icons';
import {
  PageTitle,
  FilterBar,
  Btn,
  FormGroup,
  Label,
  HelperText,
} from '../components/common/FormElements';
import { TableWrap, Table, Th, Td, Tr } from '../components/common/Table';
import Modal, { ModalBody, ModalFooter } from '../components/common/Modal';
import Badge from '../components/common/Badge';
import { NumberField } from '../components/common/NumberField';
import {
  useResidents,
  useMyResidents,
  useSciences,
  useResidentAssessments,
  useAttestationEligibility,
  useGradeAssessment,
  useDeleteAssessment,
} from '../api/residency-api';
import type { AssessmentType, Program } from '../api/types';
import AttendanceContextPanel from '../components/AttendanceContextPanel';
import { useResidencyCapabilities } from '../lib/capabilities';
import { eligibilityHoursLabel } from '../lib/eligibility-label';
import { useDebouncedSearch } from '../lib/use-debounced';

const PICKER_LIMIT = 200;

const TYPES: Array<{ value: AssessmentType; label: string }> = [
  { value: 'oraliq', label: 'Oraliq nazorat' },
  { value: 'amaliy', label: 'Amaliy baholash' },
  { value: 'yakuniy', label: 'Yakuniy nazorat' },
  { value: 'attestatsiya', label: 'Attestatsiya' },
];
const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  TYPES.map((t) => [t.value, t.label]),
);

const fmtDate = (d: string | null): string => (d ? d.slice(0, 10) : '—');

const bandOf = (score: number, max: number): 'faol' | 'info' | 'shartnoma' | 'nofaol' => {
  const pct = max > 0 ? (score / max) * 100 : 0;
  if (pct >= 86) return 'faol';
  if (pct >= 71) return 'info';
  if (pct >= 60) return 'shartnoma';
  return 'nofaol';
};

export default function Baholash() {
  const { message } = App.useApp();

  const can = usePermission();
  const canScore = can('residentAssessment:score');
  const canDelete = can('residentAssessment:delete');
  const canSeeAttendance = can('residentAttendance:readAll');

  const [search, setSearch] = useState('');
  const [program, setProgram] = useState('');
  const [residentId, setResidentId] = useState('');
  const [pickedProgram, setPickedProgram] = useState<Program | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [toDelete, setToDelete] = useState<string | null>(null);

  const { isMentor } = useResidencyCapabilities();

  const debouncedSearch = useDebouncedSearch(search);

  const { data: residentsPage } = useResidents(
    {
      limit: PICKER_LIMIT,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(program ? { program } : {}),
    },
    !isMentor,
  );
  const { data: myResidents = [] } = useMyResidents({}, isMentor);

  const residents = useMemo(() => {
    const list = isMentor ? myResidents : (residentsPage?.items ?? []);
    if (!isMentor) return list;
    const q = debouncedSearch.toLowerCase();
    return list.filter(
      (r) =>
        (!program || r.program === program) &&
        (!q || r.fullName.toLowerCase().includes(q)),
    );
  }, [isMentor, myResidents, residentsPage, debouncedSearch, program]);

  const { data: sciences = [] } = useSciences();
  const { data: rows = [], isLoading } = useResidentAssessments(residentId || undefined);
  const { data: eligibility } = useAttestationEligibility(residentId || undefined);

  const gradeM = useGradeAssessment();
  const deleteM = useDeleteAssessment();

  const selected = residents.find((r) => r.id === residentId) ?? null;

  const pickerTruncated = !isMentor && (residentsPage?.total ?? 0) > residents.length;

  return (
    <div>
      <PageTitle>Baholash</PageTitle>

      <FilterBar>
        <Input
          placeholder="F.I.Sh bo‘yicha qidirish..."
          value={search}
          style={{ width: 'auto', minWidth: 200 }}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          value={program}
          style={{ width: 'auto', minWidth: 150 }}
          onChange={(value) => setProgram(value)}
          options={[
            { value: '', label: 'Barcha dastur' },
            { value: 'magistratura', label: 'Magistratura' },
            { value: 'ordinatura', label: 'Klinik ordinatura' },
          ]}
        />
        <Select
          value={residentId}
          showSearch
          optionFilterProp="label"
          style={{ width: 'auto', minWidth: 150 }}
          onChange={(value) => {
            setResidentId(value);
            setPickedProgram(residents.find((r) => r.id === value)?.program ?? null);
          }}
          options={[
            { value: '', label: '— Talabani tanlang —' },
            ...residents.map((r) => ({ value: r.id, label: r.fullName })),
          ]}
        />
        {canScore && (
          <Btn $variant="primary" disabled={!residentId} onClick={() => setAddOpen(true)}>
            <MdAdd size={16} /> Ball qo‘yish
          </Btn>
        )}
      </FilterBar>

      {pickerTruncated && (
        <HelperText $error>
          Ro‘yxatda {residents.length} ta talaba ko‘rsatilmoqda (jami{' '}
          {residentsPage?.total ?? 0} ta). Kerakli talabani topish uchun
          yuqoridagi qidiruv maydoniga F.I.Sh yozing.
        </HelperText>
      )}

      {!residentId ? (
        <Empty>
          <MdSearch size={22} />
          <div>Ballarni ko‘rish uchun yuqoridan talabani tanlang</div>
        </Empty>
      ) : (
        <>
          {eligibility && (
            <EligibilityCard $ok={eligibility.eligible}>
              <EligTitle>
                Attestatsiyaga ruxsat:{' '}
                <Badge variant={eligibility.eligible ? 'faol' : 'nofaol'}>
                  {eligibility.eligible ? 'BOR' : 'YO‘Q'}
                </Badge>
              </EligTitle>
              {eligibility.reasons.length > 0 && (
                <EligList>
                  {eligibility.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </EligList>
              )}
              <EligMeta>
                {eligibilityHoursLabel(eligibility.details.attendance.window)}:{' '}
                <b>{eligibility.details.attendance.unexcusedHours}</b> · Kundalik tasdig‘i:{' '}
                <b>{Math.round(eligibility.details.dailyLog.approvalRatio * 100)}%</b> · Oraliq
                ballar: <b>{eligibility.details.assessment.interimCount}</b>
              </EligMeta>
            </EligibilityCard>
          )}

          {canSeeAttendance && (
            <AttendanceContextPanel
              residentId={residentId}
              program={selected?.program ?? pickedProgram}
            />
          )}

          <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th style={{ width: 48 }}>№</Th>
                    <Th>Baho turi</Th>
                    <Th>Fan</Th>
                    <Th style={{ width: 120 }}>Ball</Th>
                    <Th>Baholovchi</Th>
                    <Th style={{ width: 120 }}>Sana</Th>
                    {canDelete && <Th style={{ width: 80 }}>Amallar</Th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a, i) => (
                    <Tr key={a.id}>
                      <Td>{i + 1}</Td>
                      <Td>{a.type ? TYPE_LABEL[a.type] : '—'}</Td>
                      <Td>{a.scienceTitle || '—'}</Td>
                      <Td>
                        {a.score != null ? (
                          <Badge variant={bandOf(a.score, a.maxScore)}>
                            {a.score} / {a.maxScore}
                          </Badge>
                        ) : (
                          <span style={{ color: '#BDC3C7' }}>—</span>
                        )}
                      </Td>
                      <Td>{a.assessorName || '—'}</Td>
                      <Td>{fmtDate(a.createdAt)}</Td>
                      {canDelete && (
                        <Td>
                          <Btn
                            $variant="ghost"
                            $size="sm"
                            title="O‘chirish"
                            onClick={() => setToDelete(a.id)}
                          >
                            <MdDelete />
                          </Btn>
                        </Td>
                      )}
                    </Tr>
                  ))}
                  {!isLoading && rows.length === 0 && (
                    <Tr>
                      <Td
                        colSpan={canDelete ? 7 : 6}
                        style={{ textAlign: 'center', color: '#7F8C8D', padding: 32 }}
                      >
                        Bu talabaga hali ball qo‘yilmagan
                      </Td>
                    </Tr>
                  )}
                </tbody>
              </Table>
          </TableWrap>
        </>
      )}

      {addOpen && selected && (
        <GradeModal
          residentName={selected.fullName}
          attendance={canSeeAttendance ? { residentId, program: selected.program } : null}
          sciences={sciences}
          busy={gradeM.isPending}
          onClose={() => setAddOpen(false)}
          onSubmit={async (p) => {
            try {
              await gradeM.mutateAsync({ residentId, ...p });
              message.success('Ball qo‘yildi');
              setAddOpen(false);
            } catch (e) {
              message.error(getApiErrorMessage(e, 'Ball qo‘yishda xatolik'));
            }
          }}
        />
      )}

      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="Bahoni o‘chirish">
        <ModalBody>Bu bahoni o‘chirishni tasdiqlaysizmi?</ModalBody>
        <ModalFooter>
          <Btn $variant="ghost" onClick={() => setToDelete(null)}>
            Bekor qilish
          </Btn>
          <Btn
            $variant="danger"
            disabled={deleteM.isPending}
            onClick={async () => {
              if (!toDelete) return;
              try {
                await deleteM.mutateAsync(toDelete);
                message.success('O‘chirildi');
              } catch (e) {
                message.error(getApiErrorMessage(e, 'O‘chirishda xatolik'));
              }
              setToDelete(null);
            }}
          >
            O‘chirish
          </Btn>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function GradeModal({
  residentName,
  attendance,
  sciences,
  busy,
  onClose,
  onSubmit,
}: {
  residentName: string;
  attendance: { residentId: string; program: Program | null } | null;
  sciences: Array<{ id: string; title: string }>;
  busy: boolean;
  onClose: () => void;
  onSubmit: (p: {
    scienceId?: string | null;
    type: AssessmentType;
    score: number;
    maxScore: number;
  }) => void;
}) {
  const [type, setType] = useState<AssessmentType>('oraliq');
  const [scienceId, setScienceId] = useState('');
  const [score, setScore] = useState('');
  const [maxScore, setMaxScore] = useState('100');
  const [error, setError] = useState('');

  const submit = () => {
    const max = Number(maxScore);
    const value = Number(score.trim());

    if (score.trim() === '') {
      setError('Ball kiritilmagan');
      return;
    }
    if (!Number.isFinite(max) || max <= 0) {
      setError('Maksimal ball musbat son bo‘lishi kerak');
      return;
    }
    if (!Number.isFinite(value) || value < 0 || value > max) {
      setError(`Ball 0 va ${max} orasida bo‘lishi kerak`);
      return;
    }
    setError('');
    onSubmit({ scienceId: scienceId || null, type, score: value, maxScore: max });
  };

  return (
    <Modal open onClose={onClose} title={`Ball qo‘yish — ${residentName}`} width="460px">
      <ModalBody>
        {attendance && <AttendanceContextPanel compact {...attendance} />}
        <FormGroup>
          <Label>Baho turi *</Label>
          <Select<AssessmentType>
            value={type}
            style={{ width: '100%' }}
            onChange={(value) => setType(value)}
            options={TYPES}
          />
          <HelperText>
            TZ 4.5.6: amaliyot uchun har bir darsga emas, oraliq nazorat ballari qo‘yiladi.
          </HelperText>
        </FormGroup>
        <FormGroup>
          <Label>Fan</Label>
          <Select
            value={scienceId}
            showSearch
            optionFilterProp="label"
            style={{ width: '100%' }}
            onChange={(value) => setScienceId(value)}
            options={[
              { value: '', label: '— Tanlanmagan —' },
              ...sciences.map((s) => ({ value: s.id, label: s.title })),
            ]}
          />
        </FormGroup>
        <Row>
          <FormGroup style={{ flex: 1 }}>
            <Label>Ball *</Label>
            <NumberField
              step={0.5}
              placeholder="Masalan: 85"
              status={error ? 'error' : undefined}
              style={{ width: '100%' }}
              value={score === '' ? null : Number(score)}
              onChange={(v) => {
                setScore(v === null ? '' : String(v));
                if (error) setError('');
              }}
            />
          </FormGroup>
          <FormGroup style={{ width: 120 }}>
            <Label>Maksimal</Label>
            <NumberField
              step={1}
              style={{ width: '100%' }}
              value={maxScore === '' ? null : Number(maxScore)}
              onChange={(v) => setMaxScore(v === null ? '' : String(v))}
            />
          </FormGroup>
        </Row>
        {error && <HelperText $error>{error}</HelperText>}
      </ModalBody>
      <ModalFooter>
        <Btn $variant="ghost" onClick={onClose}>
          Bekor qilish
        </Btn>
        <Btn $variant="primary" disabled={busy} onClick={submit}>
          Saqlash
        </Btn>
      </ModalFooter>
    </Modal>
  );
}

const Empty = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 48px 16px;
  color: ${({ theme }) => theme.colors.textMuted};
  background: ${({ theme }) => theme.colors.white};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.lg};
`;

const EligibilityCard = styled.div<{ $ok: boolean }>`
  background: ${({ theme }) => theme.colors.white};
  border: 1px solid ${({ theme, $ok }) => ($ok ? theme.colors.success : theme.colors.warningBorder)};
  border-left: 4px solid
    ${({ theme, $ok }) => ($ok ? theme.colors.success : theme.colors.warning)};
  border-radius: ${({ theme }) => theme.radius.lg};
  padding: 14px 16px;
  margin-bottom: 16px;
`;

const EligTitle = styled.div`
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 6px;
`;

const EligList = styled.ul`
  margin: 6px 0;
  padding-left: 18px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.text};
`;

const EligMeta = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Row = styled.div`
  display: flex;
  gap: 12px;
`;
