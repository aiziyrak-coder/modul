import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Btn, PageTitle } from '../components/common/FormElements';
import SessionRoster from '../components/LessonSession/SessionRoster';
import { MdArrowBack } from '../icons';
import { SESSIONS_TAB_PATH as LIST_PATH } from '../lib/journal-tab';

export default function MashgulotDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  if (!id) return <Navigate to={LIST_PATH} replace />;
  return (
    <div>
      <Btn $variant="ghost" $size="sm" onClick={() => navigate(LIST_PATH)}>
        <MdArrowBack /> Mashg‘ulotlar
      </Btn>
      <PageTitle>Mashg‘ulot</PageTitle>
      <SessionRoster id={id} />
    </div>
  );
}
