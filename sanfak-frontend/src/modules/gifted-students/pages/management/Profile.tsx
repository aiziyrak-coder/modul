import styled from 'styled-components';
import { CardWrap } from '../../components/common/Card';
import { useAuth } from '../../context/AuthContext';

export default function ManagementProfile() {
  const { user } = useAuth();
  const fields: Array<[string, string | undefined]> = [
    ['ID', user.id],
    ['Lavozim', user.position],
  ];

  return (
    <CardWrap style={{ maxWidth: 500 }}>
      <AvatarSection>
        <Avatar>{(user.name || '·')[0]}</Avatar>
        <div>
          <Name>{user.name}</Name>
          <Sub>{user.position}</Sub>
        </div>
      </AvatarSection>
      <hr style={{ border: 'none', borderTop: '1px solid #E8ECEF', margin: '16px 0' }} />
      {fields.map(([l, v]) => (
        <Field key={l}>
          <FieldLabel>{l}</FieldLabel>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{v}</span>
        </Field>
      ))}
    </CardWrap>
  );
}

const AvatarSection = styled.div`display:flex;align-items:center;gap:16px;margin-bottom:16px;`;
const Avatar = styled.div`width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#9B59B6,#8E44AD);color:white;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;`;
const Name = styled.h2`font-size:16px;font-weight:700;color:#2C3E50;`;
const Sub = styled.p`font-size:13px;color:#7F8C8D;`;
const Field = styled.div`display:flex;align-items:center;gap:16px;margin-bottom:12px;`;
const FieldLabel = styled.span`width:120px;font-size:13px;color:#7F8C8D;flex-shrink:0;`;
