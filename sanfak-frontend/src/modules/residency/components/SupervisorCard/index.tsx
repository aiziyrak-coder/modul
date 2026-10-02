import styled from 'styled-components';
import Modal, { ModalBody, ModalFooter } from '../common/Modal';
import { Btn } from '../common/FormElements';
import { useSupervisorCard, type SupervisorCard } from '../../api/residency-api';

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  const empty = value === null || value === undefined || value === '';
  return (
    <InfoRow>
      <InfoLbl>{label}</InfoLbl>
      {empty ? <InfoEmpty>—</InfoEmpty> : <InfoVal>{value}</InfoVal>}
    </InfoRow>
  );
}

export interface WorkplaceLocation {
  lat: number;
  lng: number;
}

export function SupervisorInfo({
  card,
  workplaceLocation,
}: {
  card: SupervisorCard;
  workplaceLocation?: WorkplaceLocation | null;
}) {
  return (
    <Wrap>
      <Row label="F.I.SH" value={card.fullName} />
      <Row label="Ilmiy unvon" value={card.academicTitle} />
      <Row label="Lavozim" value={card.position} />
      <Row label="Kafedra" value={card.department} />
      <Row label="Fakultet" value={card.faculty} />
      <Row label="Bo‘lim" value={card.division} />
      <Row label="Telefon" value={card.phone} />
      <Row label="Xona" value={card.office} />
      <Row label="Ish vaqti" value={card.workingHours} />

      {workplaceLocation !== undefined && (
        <>
          <SectionLbl>Talabaning ish joyi</SectionLbl>
          <Row label="Ish joyi kengligi" value={workplaceLocation?.lat} />
          <Row label="Ish joyi uzunligi" value={workplaceLocation?.lng} />
        </>
      )}
    </Wrap>
  );
}

export default function SupervisorCardModal({
  supervisorId,
  workplaceLocation,
  onClose,
}: {
  supervisorId: string | null;
  workplaceLocation?: WorkplaceLocation | null;
  onClose: () => void;
}) {
  const { data, isLoading, isError } = useSupervisorCard(supervisorId);

  return (
    <Modal open={!!supervisorId} onClose={onClose} title="Ustoz ma’lumotlari" width="460px">
      <ModalBody>
        {isLoading && <Muted>Yuklanmoqda…</Muted>}
        {isError && <Muted>Ustoz ma’lumotini olib bo‘lmadi</Muted>}
        {data && (
          <SupervisorInfo card={data} workplaceLocation={workplaceLocation} />
        )}
      </ModalBody>
      <ModalFooter>
        <Btn $variant="ghost" onClick={onClose}>
          Yopish
        </Btn>
      </ModalFooter>
    </Modal>
  );
}

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
`;

const InfoRow = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  font-size: 13px;

  &:last-of-type {
    border-bottom: none;
  }
`;

const InfoLbl = styled.span`
  color: ${({ theme }) => theme.colors.textMuted};
  flex: 0 0 auto;
`;

const SectionLbl = styled.div`
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const InfoVal = styled.span`
  color: ${({ theme }) => theme.colors.text};
  text-align: right;
  word-break: break-word;
`;

const InfoEmpty = styled.span`
  color: ${({ theme }) => theme.colors.textMuted};
  text-align: right;
`;

const Muted = styled.span`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 13px;
`;
