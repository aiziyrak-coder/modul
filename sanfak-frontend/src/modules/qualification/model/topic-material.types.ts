export interface TopicFileMaterial {
  id: string;
  title: string;
  fileUrl: string;
  fileName?: string | null;
}

export interface TopicVideoMaterial {
  id: string;
  title: string;
  videoUrl: string;
  fileName?: string | null;
}

export interface TopicScenarioMaterial {
  id: string;
  title: string;
  text: string;
}

export const MATERIAL_TAB = {
  LECTURE: 'lecture',
  PRACTICAL: 'practical',
  VIDEO: 'video',
  SCENARIO: 'scenario',
  FINAL_TEST: 'finalTest',
} as const;
export type MaterialTab = (typeof MATERIAL_TAB)[keyof typeof MATERIAL_TAB];
