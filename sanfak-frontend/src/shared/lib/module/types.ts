import type { ComponentType, ReactNode } from 'react';

export interface ModuleRouteNode {
  path?: string;
  index?: boolean;
  permission?: string;
  public?: boolean;
  element: ComponentType;
}

export interface ModuleMenuItem {
  titleKey: string;
  icon?: ReactNode;
  path: string;
  order?: number;
  permission?: string | readonly string[];
  parent?: string;
  subGroup?: {
    titleKey: string;
    order?: number;
  };
}

export interface ModulePermission {
  key: string;
  description: string;
}

export type Lang = 'uz' | 'ru' | 'en';

export interface ModuleManifest {
  name: string;
  basePath?: string;
  routes: ModuleRouteNode[];
  menu?: ModuleMenuItem[];
  menuGroup?: {
    titleKey: string;
    order?: number;
  };
  i18n?: Partial<Record<Lang, Record<string, string>>>;
  permissions?: ModulePermission[];
}
