import { AvatarCircle, Email, Name, TextCol, Wrap } from './style';

interface IProps {
  fullName: string;
  email?: string | null;
  photo?: string | null;
}

function initialsOf(fullName: string): string {
  return fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

const StaffAvatarCell = ({ fullName, email, photo }: IProps) => (
  <Wrap>
    <AvatarCircle $src={photo}>{photo ? null : initialsOf(fullName) || '—'}</AvatarCircle>
    <TextCol>
      <Name title={fullName}>{fullName || '—'}</Name>
      <Email title={email ?? undefined}>{email || '—'}</Email>
    </TextCol>
  </Wrap>
);

export default StaffAvatarCell;
