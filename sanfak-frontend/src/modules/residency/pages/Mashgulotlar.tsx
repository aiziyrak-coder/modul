import { Navigate, useParams } from 'react-router-dom';
import { SESSIONS_TAB_PATH, sessionDetailPath } from '../lib/journal-tab';

export default function Mashgulotlar() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={id ? sessionDetailPath(id) : SESSIONS_TAB_PATH} replace />;
}
