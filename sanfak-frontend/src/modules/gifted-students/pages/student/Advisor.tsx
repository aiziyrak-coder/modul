import styled from 'styled-components';
import { CardWrap } from '../../components/common/Card';
import ChatPanel from '../../components/chat';
import { useProfile, useMyGiftedProfile, useMyAdvisor } from '../../api/gifted-api';
import Loader from '../../components/common/Loader';
import { MdEmail, MdPhone, MdLocationOn, MdAccessTime } from '../../icons';

export default function StudentAdvisor() {
  const { data: profile } = useProfile();

  const { data: myGifted, isLoading: giftedLoading } = useMyGiftedProfile();
  const { data: advisor, isLoading: advisorLoading } = useMyAdvisor();
  const myId = profile?._id ?? '';
  const advisorId = myGifted?.advisorId || undefined;
  const advisorName = myGifted?.advisorName || '';
  const displayName = advisor?.fullName || advisorName;

  if (giftedLoading || advisorLoading) return <Loader />;

  const hasContact = Boolean(advisor || advisorName);
  const canChat = Boolean(advisorId);

  if (!hasContact && !canChat) {
    return (
      <EmptyCard>
        <EmptyIcon>👤</EmptyIcon>
        <EmptyText>
          {myGifted
            ? 'Sizga hali maslahatchi biriktirilmagan'
            : 'Sizning nomingizga bog‘langan iqtidorli-talaba yozuvi topilmadi'}
        </EmptyText>
      </EmptyCard>
    );
  }

  return (
    <TwoCol>
      <ProfileCol>
        <CardWrap>
          <AvatarWrap>
            <ProfAvatar>{displayName[0] ?? '?'}</ProfAvatar>
          </AvatarWrap>
          <ProfName>{displayName || '—'}</ProfName>
          {advisor?.degree && <ProfDegree>{advisor.degree}</ProfDegree>}
          {advisor?.department && <ProfDept>{advisor.department}</ProfDept>}

          {(advisor?.email || advisor?.phone || advisor?.office || advisor?.workingHours) && (
            <>
              <Divider />
              <InfoList>
                {advisor?.email && (
                  <InfoItem>
                    <InfoIcon><MdEmail /></InfoIcon>
                    <InfoText>{advisor.email}</InfoText>
                  </InfoItem>
                )}
                {advisor?.phone && (
                  <InfoItem>
                    <InfoIcon><MdPhone /></InfoIcon>
                    <InfoText>{advisor.phone}</InfoText>
                  </InfoItem>
                )}
                {advisor?.office && (
                  <InfoItem>
                    <InfoIcon><MdLocationOn /></InfoIcon>
                    <InfoText>Xona: {advisor.office}</InfoText>
                  </InfoItem>
                )}
                {advisor?.workingHours && (
                  <InfoItem>
                    <InfoIcon><MdAccessTime /></InfoIcon>
                    <InfoText>{advisor.workingHours}</InfoText>
                  </InfoItem>
                )}
              </InfoList>
            </>
          )}

          {(advisor?.publications != null || advisor?.hIndex != null) && (
            <>
              <Divider />
              <StatRow>
                <StatBox>
                  <StatNum>{advisor?.publications ?? 0}</StatNum>
                  <StatLabel>Nashrlar</StatLabel>
                </StatBox>
                <StatBox>
                  <StatNum>{advisor?.hIndex ?? 0}</StatNum>
                  <StatLabel>H-index</StatLabel>
                </StatBox>
              </StatRow>
            </>
          )}
        </CardWrap>
      </ProfileCol>

      <ChatCol>
        <ChatPanel
          peerUserId={advisorId}
          myId={myId}
          peerName={displayName}
          emptyHint="Chat mavjud emas: maslahatchi platforma akkauntiga bog‘lanmagan."
        />
      </ChatCol>
    </TwoCol>
  );
}

const EmptyCard = styled(CardWrap)`
  text-align: center;
  padding: 48px 16px;
`;

const EmptyIcon = styled.div`
  font-size: 34px;
  margin-bottom: 8px;
`;

const EmptyText = styled.p`
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const TwoCol = styled.div`
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 20px;
  align-items: stretch;
  flex: 1;
  min-height: 0;
`;

const ProfileCol = styled.div`
  min-height: 0;
`;

const ChatCol = styled.div`
  display: flex;
  min-height: 0;
`;

const AvatarWrap = styled.div`
  position: relative;
  width: fit-content;
  margin: 0 auto 12px;
`;

const ProfAvatar = styled.div`
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--brand-primary), var(--brand-primary-hover));
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
  font-weight: 700;
`;

const ProfName = styled.h3`
  text-align: center;
  font-size: 15px;
  font-weight: 700;
  color: #2C3E50;
  margin-bottom: 4px;
`;
const ProfDegree = styled.p`
  text-align: center;
  font-size: 12px;
  color: #7F8C8D;
  margin-bottom: 2px;
`;
const ProfDept = styled.p`
  text-align: center;
  font-size: 12px;
  color: var(--brand-primary);
  font-weight: 500;
`;

const Divider = styled.hr`
  border: none;
  border-top: 1px solid #E8ECEF;
  margin: 14px 0;
`;

const InfoList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;
const InfoItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;
const InfoIcon = styled.div`
  color: #7F8C8D;
  font-size: 16px;
  display: flex;
  flex-shrink: 0;
`;
const InfoText = styled.span`
  font-size: 12px;
  color: #2C3E50;
  overflow-wrap: anywhere;
`;

const StatRow = styled.div`
  display: flex;
  gap: 12px;
`;
const StatBox = styled.div`
  flex: 1;
  text-align: center;
  padding: 12px;
  background: #F4F6F9;
  border-radius: 10px;
`;
const StatNum = styled.div`
  font-size: 22px;
  font-weight: 800;
  color: var(--brand-primary);
`;
const StatLabel = styled.div`
  font-size: 11px;
  color: #7F8C8D;
`;
