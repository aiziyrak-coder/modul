export type ContentLang = 'uz' | 'ru' | 'en';

export interface LangRecord {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  [field: string]: string | undefined;
}

export type SeasonName = 'bahor' | 'yoz' | 'kuz' | 'qish';
export type SeasonStatus = 'rejada' | 'ochiq' | 'yopiq';

export interface NamedRef {
  id: string;
  titleUz: string;
  titleRu?: string;
  titleEn?: string;
}

export interface SeasonItem {
  id?: string;
  direction: NamedRef | null;
  educationForms: NamedRef[];
  educationLanguages: NamedRef[];
}

export interface AdmissionSeason {
  id: string;
  titleUz: string;
  titleRu: string;
  titleEn: string;
  descriptionUz?: string;
  descriptionRu?: string;
  descriptionEn?: string;
  academicYear: string;
  season: SeasonName;
  items: SeasonItem[];
  openDate: string;
  closeDate: string;
  status: SeasonStatus;
  closedByName?: string;
  closedAt?: string;
  createdAt?: string;
}

export interface OfferBlock {
  key: string;
  titleUz: string;
  titleRu: string;
  titleEn: string;
  bodyUz: string;
  bodyRu: string;
  bodyEn: string;
}

export interface AdmissionOffer {
  blocks: OfferBlock[];
  updatedByName?: string;
  updatedAt?: string;
}

export interface AdmissionMessage {
  id: string;
  text: string;
  direction: NamedRef | null;
  educationLanguage: NamedRef | null;
  academicYear: string;
  season: SeasonName;
  recipientCount: number;
  deliveredCount: number;
  sentByName?: string;
  sentAt: string;
}

export interface SendMessageInput {
  text: string;
  direction?: string;
  educationLanguage?: string;
  academicYear: string;
  season: SeasonName;
}
