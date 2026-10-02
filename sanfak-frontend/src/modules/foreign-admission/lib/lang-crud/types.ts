export interface LangFieldConfig {
  name: string;
  labelKey: string;
  type?: 'text' | 'textarea';
  required?: boolean;
  placeholderKey?: string;
}

export interface PlainFieldConfig {
  name: string;
  labelKey: string;
  placeholderKey?: string;
}

export interface LangCrudColumn {
  key: string;
  titleKey: string;
  width?: number;
  langBase?: string;
  kind?: 'text' | 'image';
}

export interface LangCrudConfig {
  section: string;
  root: string;

  titleKey: string;
  newButtonKey: string;
  createTitleKey: string;
  editTitleKey: string;
  searchPlaceholderKey: string;
  deleteTitleKey: string;

  columns: LangCrudColumn[];
  langFields: LangFieldConfig[];
  plainFields?: PlainFieldConfig[];

  imageUpload?: {
    urlField: string;
    labelKey: string;
    hintKey: string;
  };
}
