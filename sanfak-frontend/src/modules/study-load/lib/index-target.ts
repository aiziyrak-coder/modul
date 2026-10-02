export const INDEX_CANDIDATES: ReadonlyArray<{ path: string; permission: string | string[] }> =
  [
    { path: '/study-load/statistics', permission: 'statistics:read' },
    {
      path: '/study-load/approval-inbox',
      permission: [
        'workload:approve',
        'workloadDistribution:approve',
        'syllabus:approve',
        'scienceProgram:approve',
        'workingSchedule:approve',
        'workloadSummary:approve',
        'contingentReport:approve',
      ],
    },
    { path: '/study-load/study-plans', permission: 'studyPlan:readAll' },
    { path: '/study-load/working-schedules', permission: 'workingSchedule:readAll' },
    { path: '/study-load/workloads', permission: 'workload:readAll' },
    { path: '/study-load/workload-summaries', permission: 'workloadSummary:readAll' },
    { path: '/study-load/contingent-reports', permission: 'contingentReport:readAll' },
    { path: '/study-load/department-contingents', permission: 'departmentContingent:readAll' },
    { path: '/study-load/distributions', permission: 'workloadDistribution:readAll' },
    { path: '/study-load/distributions/vacancies', permission: 'workloadDistribution:readAll' },
    { path: '/study-load/science-programs', permission: 'scienceProgram:readAll' },
    { path: '/study-load/syllabi', permission: 'syllabus:readAll' },
    { path: '/study-load/contingent', permission: 'group:create' },
    { path: '/study-load/my-workloads', permission: 'workloadDistribution:changeStatus' },
    { path: '/study-load/teacher-leaves', permission: 'teacherLeave:readAll' },
  ];

export const INDEX_FALLBACK = '/study-load/approval-inbox';

export function pickIndexTarget(can: {
  (permission: string): boolean;
  any: (perms: string[]) => boolean;
}): string {
  const hit = INDEX_CANDIDATES.find((c) =>
    Array.isArray(c.permission) ? can.any(c.permission) : can(c.permission),
  );
  return hit?.path ?? INDEX_FALLBACK;
}
