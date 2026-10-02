export const ACTION_LABEL_KEYS: Record<string, string> = {
  create: 'admin.action.create',
  read: 'admin.action.read',
  readAll: 'admin.action.readAll',
  readOwn: 'admin.action.readOwn',
  update: 'admin.action.update',
  delete: 'admin.action.delete',
  search: 'admin.action.search',
  filter: 'admin.action.filter',
  idFilter: 'admin.action.idFilter',
  changeStatus: 'admin.action.changeStatus',
  approve: 'admin.action.approve',
  reject: 'admin.action.reject',
  verifyDoc: 'admin.action.verifyDoc',
  sign: 'admin.action.sign',
  review: 'admin.action.review',
  score: 'admin.action.score',
  export: 'admin.action.export',
  import: 'admin.action.import',
  assign: 'admin.action.assign',
  publish: 'admin.action.publish',
  archive: 'admin.action.archive',
  dashboard: 'admin.action.dashboard',
  manageMembers: 'admin.action.manageMembers',
  submitWork: 'admin.action.submitWork',
  notifications: 'admin.action.notifications',
  grantAny: 'admin.action.grantAny',
};

export function actionLabelKey(key: string): string {
  return ACTION_LABEL_KEYS[key] ?? key;
}
