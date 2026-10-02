type Dict = Record<string, string>;

const uz: Dict = {
  'studyLoad.revokeFinal.action': 'Tasdiqni bekor qilish',
  'studyLoad.revokeFinal.title': 'Tasdiqni bekor qilish',
  'studyLoad.revokeFinal.success': 'Tasdiq bekor qilindi',
  'studyLoad.revokeFinal.notFinalRole': "Bu hujjat tasdig'ini faqat yakuniy bosqich egasi bekor qila oladi",
  'studyLoad.revokeFinal.dependentsTitle': "Avval bog'liq hujjatlarni qaytaring",
  'studyLoad.revokeFinal.dependentsHint': "Quyidagi hujjatlar shu hujjat asosida tuzilgan va hali faol. Ular qaytarilmaguncha tasdiqni bekor qilib bo'lmaydi.",
  'studyLoad.revokeFinal.untitled': 'Nomsiz hujjat',
  'studyLoad.revokeFinal.hiddenDependents': "{{type}} — {{n}} ta (sizga ko'rinmaydigan)",
  'studyLoad.revokeFinal.type.workload': 'Yuklama',
  'studyLoad.revokeFinal.type.workloadDistribution': 'Taqsimot',
  'studyLoad.revokeFinal.type.workloadSummary': 'Kafedralar soatlar hisobi',
  'studyLoad.revokeFinal.type.syllabus': 'Sillabus',
};

const ru: Dict = {
  'studyLoad.revokeFinal.action': 'Отменить утверждение',
  'studyLoad.revokeFinal.title': 'Отмена утверждения',
  'studyLoad.revokeFinal.success': 'Утверждение отменено',
  'studyLoad.revokeFinal.notFinalRole': 'Отменить утверждение этого документа может только владелец последнего этапа',
  'studyLoad.revokeFinal.dependentsTitle': 'Сначала верните связанные документы',
  'studyLoad.revokeFinal.dependentsHint': 'Следующие документы созданы на основе этого документа и ещё активны. Пока они не возвращены, отменить утверждение нельзя.',
  'studyLoad.revokeFinal.untitled': 'Документ без названия',
  'studyLoad.revokeFinal.hiddenDependents': '{{type}} — {{n}} шт. (недоступны вам)',
  'studyLoad.revokeFinal.type.workload': 'Нагрузка',
  'studyLoad.revokeFinal.type.workloadDistribution': 'Распределение',
  'studyLoad.revokeFinal.type.workloadSummary': 'Сводка часов кафедр',
  'studyLoad.revokeFinal.type.syllabus': 'Силлабус',
};

const en: Dict = {
  'studyLoad.revokeFinal.action': 'Revoke approval',
  'studyLoad.revokeFinal.title': 'Revoke approval',
  'studyLoad.revokeFinal.success': 'Approval revoked',
  'studyLoad.revokeFinal.notFinalRole': "Only the owner of the final step can revoke this document's approval",
  'studyLoad.revokeFinal.dependentsTitle': 'Return the dependent documents first',
  'studyLoad.revokeFinal.dependentsHint': 'The documents below were built from this document and are still active. The approval cannot be revoked until they are returned.',
  'studyLoad.revokeFinal.untitled': 'Untitled document',
  'studyLoad.revokeFinal.hiddenDependents': '{{type}} — {{n}} (not visible to you)',
  'studyLoad.revokeFinal.type.workload': 'Workload',
  'studyLoad.revokeFinal.type.workloadDistribution': 'Distribution',
  'studyLoad.revokeFinal.type.workloadSummary': 'Department hours summary',
  'studyLoad.revokeFinal.type.syllabus': 'Syllabus',
};

export const REVOKE_FINAL_I18N = { uz, ru, en } as const;
