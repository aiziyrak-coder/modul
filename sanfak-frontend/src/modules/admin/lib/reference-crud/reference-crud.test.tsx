import { afterEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { i18n } from '@/shared/lib/i18n';
import { mapReference } from './reference-types';
import type { ReferenceConfig } from './types';
import { ReferenceFormModal } from './reference-form-modal';
import { toNumberList } from './number-list';
import { facultyConfig } from '../../faculties/faculty.config';

const fixtureConfig: ReferenceConfig = {
  section: 'fixtureEntity',
  root: '/fixture-entities',
  basePath: '/admin/fixture-entities',
  multipart: true,
  labels: {
    listTitleKey: 'admin.fixtureEntity.listTitle',
    newButtonKey: 'admin.fixtureEntity.newButton',
    createTitleKey: 'admin.fixtureEntity.createTitle',
    editTitleKey: 'admin.fixtureEntity.editTitle',
    searchPlaceholderKey: 'admin.fixtureEntity.searchPlaceholder',
  },
  columns: [{ key: 'title', titleKey: 'admin.fixtureEntity.columns.title' }],
  fields: [
    { name: 'photo', labelKey: 'admin.fixtureEntity.fields.photo.label', type: 'image', valueFrom: 'image', placeholderKey: 'admin.fixtureEntity.fields.photo.placeholder' },
    { name: 'title', labelKey: 'admin.fixtureEntity.fields.title.label', type: 'text', required: true, placeholderKey: 'admin.fixtureEntity.fields.title.placeholder' },
    { name: 'code', labelKey: 'admin.fixtureEntity.fields.code.label', type: 'text', span: 8, requiredOnCreate: true, placeholderKey: 'admin.fixtureEntity.fields.code.placeholder' },
    { name: 'allowedStakes', labelKey: 'admin.fixtureEntity.fields.allowedStakes.label', type: 'numberlist', placeholderKey: 'admin.fixtureEntity.fields.allowedStakes.placeholder' },
  ],
};

describe('mapReference', () => {
  it('maps _id → id and keeps other fields', () => {
    const r = mapReference({ _id: 'abc', title: 'Namuna', image: 'http://x/f.png' });
    expect(r.id).toBe('abc');
    expect(r.title).toBe('Namuna');
    expect(r.image).toBe('http://x/f.png');
    expect('_id' in r).toBe(false);
  });
});

describe('ReferenceFormModal (config-driven)', () => {
  it('renders all configured field labels in create mode (open=true)', () => {
    renderWithProviders(
      <ReferenceFormModal
        config={fixtureConfig}
        editId={null}
        open={true}
        onClose={() => undefined}
        onSuccess={() => undefined}
      />,
    );
    for (const field of fixtureConfig.fields) {
      expect(screen.getAllByText(field.labelKey).length).toBeGreaterThan(0);
    }
    expect(screen.getByText(fixtureConfig.labels.createTitleKey)).toBeInTheDocument();
  });
});

describe('ReferenceFormModal — requiredOnCreate (yaratishda majburiy, tahrirda ixtiyoriy)', () => {
  const requiredOf = (labelKey: string) =>
    screen.getAllByText(labelKey)[0]!.closest('.ant-form-item')!.querySelector('input')!.getAttribute('aria-required');

  it('create rejimida `code` majburiy (aria-required=true), `title` ham', () => {
    renderWithProviders(
      <ReferenceFormModal config={fixtureConfig} editId={null} open={true} onClose={() => undefined} onSuccess={() => undefined} />,
    );
    expect(requiredOf('admin.fixtureEntity.fields.code.label')).toBe('true');
    expect(requiredOf('admin.fixtureEntity.fields.title.label')).toBe('true');
  });
});

describe('ReferenceFormModal — i18n (FAZA 1)', () => {
  afterEach(() => {
    void i18n.changeLanguage('uz');
  });

  it('tilni ru ga almashtirganda config maydon label rus tiliga o\'tadi', async () => {
    await i18n.changeLanguage('ru');
    renderWithProviders(
      <ReferenceFormModal
        config={facultyConfig}
        editId={null}
        open={true}
        onClose={() => undefined}
        onSuccess={() => undefined}
      />,
    );
    expect(screen.getAllByText('Название факультета').length).toBeGreaterThan(0);
    expect(screen.queryByText('Fakultet nomi')).not.toBeInTheDocument();
  });
});

describe('toNumberList — numberlist submit-transform', () => {
  it('matn tag\'larni songa aylantiradi ("0.5" → 0.5)', () => {
    expect(toNumberList(['0.5', '1'])).toEqual([0.5, 1]);
  });

  it('NaN/bo\'sh qiymatlarni tashlaydi', () => {
    expect(toNumberList(['0.5', '', 'abc', '1'])).toEqual([0.5, 1]);
  });

  it('dublikatlarni olib tashlaydi va tartiblaydi', () => {
    expect(toNumberList(['1', '0.25', '0.25', '0.5'])).toEqual([0.25, 0.5, 1]);
  });

  it('massiv bo\'lmasa bo\'sh massiv qaytaradi', () => {
    expect(toNumberList(undefined)).toEqual([]);
    expect(toNumberList(null)).toEqual([]);
  });
});
