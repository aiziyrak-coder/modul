import styled from 'styled-components';
import { CardWrap } from '../../components/common/Card';
import { useAuth } from '../../context/AuthContext';

export default function DepartmentProfile() {
  const { user } = useAuth();
  const fields: Array<[string, string | number | undefined]> = [
    ['ID', user.id],
    ['Lavozim', user.position],
    ["Bo'lim", user.department],
  ];

  return (
    <Wrap>
      <CardWrap style={{ maxWidth: 500 }}>
        <AvatarSection>
          <Avatar>{(user.name || '·')[0]}</Avatar>
          <div>
            <Name>{user.name}</Name>
            <Sub>{user.position}{user.department ? ` · ${user.department}` : ''}</Sub>
          </div>
        </AvatarSection>
        <Divider />
        <Fields>
          {fields.map(([l, v]) => (
            <Field key={l}>
              <FieldLabel>{l}</FieldLabel>
              <FieldValue>{v}</FieldValue>
            </Field>
          ))}
        </Fields>
      </CardWrap>
    </Wrap>
  );
}

const Wrap = styled.div``;
const AvatarSection = styled.div`display:flex;align-items:center;gap:16px;margin-bottom:20px;`;
const Avatar = styled.div`width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#3498DB,#2980B9);color:white;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;`;
const Name = styled.h2`font-size:16px;font-weight:700;color:#2C3E50;`;
const Sub = styled.p`font-size:13px;color:#7F8C8D;`;
const Divider = styled.hr`border:none;border-top:1px solid #E8ECEF;margin-bottom:16px;`;
const Fields = styled.div`display:flex;flex-direction:column;gap:14px;`;
const Field = styled.div`display:flex;align-items:center;`;
const FieldLabel = styled.span`width:130px;font-size:13px;color:#7F8C8D;flex-shrink:0;`;
const FieldValue = styled.span`font-size:13px;font-weight:500;color:#2C3E50;`;
