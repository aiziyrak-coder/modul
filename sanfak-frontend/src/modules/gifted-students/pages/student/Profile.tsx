import styled from 'styled-components';
import { CardWrap } from '../../components/common/Card';
import { useAuth } from '../../context/AuthContext';
import { useMyGiftedProfile, useMyAchievements } from '../../api/gifted-api';
import { currentAcademicYear } from '../../lib/academic-years';

export default function StudentProfile() {
  const { user } = useAuth();
  const { data: myGifted } = useMyGiftedProfile();
  const { data: achievements = [] } = useMyAchievements();

  const totalScore = myGifted?.totalScore ?? 0;
  const yearScore = myGifted?.yearScore ?? 0;
  const approvedCount = achievements.filter((a) => a.status === 'approved').length;

  const fields: Array<[string, string | number | undefined]> = [
    ['Fakultet', user.faculty],
    ["Yo'nalish", user.direction],
    ['Kurs', user.course ? `${user.course}-kurs` : '—'],
    ['Guruh', user.group],
    ['Email', user.email],
    ['Telefon', user.phone],
  ];

  return (
    <Wrap>
      <CardWrap style={{ maxWidth: 600 }}>
        <AvatarSection>
          <Avatar>{(user.name || '·')[0]}</Avatar>
          <div>
            <Name>{user.name}</Name>
            <Sub>{[user.faculty, user.direction].filter(Boolean).join(' · ')}</Sub>
          </div>
        </AvatarSection>

        <StatsRow>
          <StatTile>
            <StatValue>{yearScore}</StatValue>
            <StatLabel>{currentAcademicYear()} reyting bali</StatLabel>
          </StatTile>
          <StatTile>
            <StatValue>{totalScore}</StatValue>
            <StatLabel>Jami to'plangan ball</StatLabel>
          </StatTile>
          <StatTile>
            <StatValue>{approvedCount}</StatValue>
            <StatLabel>Tasdiqlangan faoliyatlar</StatLabel>
          </StatTile>
        </StatsRow>

        <Divider />
        <Fields>
          {fields.map(([label, value]) => (
            <Field key={label}>
              <FieldLabel>{label}</FieldLabel>
              <FieldValue>{value}</FieldValue>
            </Field>
          ))}
        </Fields>
      </CardWrap>
    </Wrap>
  );
}

const Wrap = styled.div``;
const AvatarSection = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
`;
const Avatar = styled.div`
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--brand-primary), var(--brand-primary-hover));
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  font-weight: 700;
`;
const Name = styled.h2`
  font-size: 16px;
  font-weight: 700;
  color: #2c3e50;
`;
const Sub = styled.p`
  font-size: 13px;
  color: #7f8c8d;
`;
const StatsRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 20px;
`;
const StatTile = styled.div`
  background: var(--brand-primary-soft);
  border-radius: 10px;
  padding: 14px 16px;
  text-align: center;
`;
const StatValue = styled.div`
  font-size: 24px;
  font-weight: 700;
  color: var(--brand-primary);
`;
const StatLabel = styled.div`
  font-size: 12px;
  color: #7f8c8d;
  margin-top: 2px;
`;
const Divider = styled.hr`
  border: none;
  border-top: 1px solid #e8ecef;
  margin-bottom: 16px;
`;
const Fields = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
`;
const Field = styled.div`
  display: flex;
  align-items: center;
`;
const FieldLabel = styled.span`
  width: 150px;
  font-size: 13px;
  color: #7f8c8d;
  flex-shrink: 0;
`;
const FieldValue = styled.span`
  font-size: 13px;
  font-weight: 500;
  color: #2c3e50;
`;
