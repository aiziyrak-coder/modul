import styled from 'styled-components';
import { CardWrap } from '../../components/common/Card';
import { useAuth } from '../../context/AuthContext';
import { MdPerson, MdBadge } from '../../icons';

export default function JudgeProfile() {
  const { user } = useAuth();

  return (
    <CardWrap>
      <ProfileWrap>
        <AvatarCircle>{user?.name?.[0]}</AvatarCircle>
        <Name>{user?.name}</Name>
        <RoleBadge><MdBadge /> {user?.position}</RoleBadge>
        <InfoRow>
          <InfoLabel><MdPerson /> ID</InfoLabel>
          <InfoValue>{user?.id}</InfoValue>
        </InfoRow>
      </ProfileWrap>
    </CardWrap>
  );
}

const ProfileWrap = styled.div`
  display: flex; flex-direction: column; align-items: center;
  gap: 12px; padding: 24px 0;
`;

const AvatarCircle = styled.div`
  width: 72px; height: 72px; border-radius: 50%;
  background: ${({ theme }) => theme.colors.primary};
  color: white;
  display: flex; align-items: center; justify-content: center;
  font-size: 28px; font-weight: 700;
`;

const Name = styled.h2`
  font-size: 18px; font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
`;

const RoleBadge = styled.div`
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 14px; border-radius: 999px;
  background: ${({ theme }) => theme.colors.primaryLight};
  color: ${({ theme }) => theme.colors.primary};
  font-size: 13px; font-weight: 600;
  svg { font-size: 15px; }
`;

const InfoRow = styled.div`
  display: flex; align-items: center; gap: 10px;
  font-size: 13px; margin-top: 8px;
`;
const InfoLabel = styled.span`
  display: flex; align-items: center; gap: 4px;
  color: ${({ theme }) => theme.colors.textMuted};
  svg { font-size: 15px; }
`;
const InfoValue = styled.span`
  font-weight: 600; color: ${({ theme }) => theme.colors.text};
`;
