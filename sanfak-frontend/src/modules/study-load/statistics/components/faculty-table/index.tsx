import { Empty, Table } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import type { FacultyRow } from '../../model/types';
import { facultyColumns } from './columns';

interface IProps {
  rows: FacultyRow[];
  loading?: boolean;
}

export default function FacultyTable({ rows, loading }: IProps) {
  const { t } = useTranslation();

  if (!loading && rows.length === 0) {
    return <Empty description={t('studyLoad.stats.empty')} />;
  }

  return (
    <Table<FacultyRow>
      rowKey="facultyId"
      size="small"
      loading={loading}
      columns={facultyColumns(t)}
      dataSource={rows}
      pagination={false}
      scroll={{ x: 720 }}
    />
  );
}
