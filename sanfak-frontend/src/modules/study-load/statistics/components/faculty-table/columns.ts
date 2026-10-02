import type { TableProps } from '@/shared/ui';
import type { FacultyRow } from '../../model/types';
import { son } from '../../lib/format';

export function facultyColumns(t: (key: string) => string): NonNullable<TableProps<FacultyRow>['columns']> {
  return [
    { title: t('studyLoad.stats.faculties.column.faculty'), dataIndex: 'faculty', key: 'faculty' },
    {
      title: t('studyLoad.stats.faculties.column.directions'),
      dataIndex: 'directions',
      key: 'directions',
      align: 'right',
      width: 90,
    },
    {
      title: t('studyLoad.stats.faculties.column.groups'),
      dataIndex: 'groups',
      key: 'groups',
      align: 'right',
      width: 90,
    },
    {
      title: t('studyLoad.stats.faculties.column.students'),
      dataIndex: 'students',
      key: 'students',
      align: 'right',
      width: 100,
      render: (v: number) => son(v),
    },
    {
      title: t('studyLoad.stats.faculties.column.totalCredit'),
      dataIndex: 'totalCredit',
      key: 'totalCredit',
      align: 'right',
      width: 100,
      render: (v: number) => son(v),
    },
    {
      title: t('studyLoad.stats.faculties.column.totalHour'),
      dataIndex: 'totalHour',
      key: 'totalHour',
      align: 'right',
      width: 110,
      render: (v: number) => son(v),
    },
    {
      title: t('studyLoad.stats.faculties.column.vacantHour'),
      dataIndex: 'vacantHour',
      key: 'vacantHour',
      align: 'right',
      width: 110,
      render: (v: number) => son(v),
    },
    {
      title: t('studyLoad.stats.faculties.column.vacancies'),
      dataIndex: 'vacancies',
      key: 'vacancies',
      align: 'right',
      width: 100,
    },
  ];
}
