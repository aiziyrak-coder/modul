import { useMemo, useState } from 'react';
import { Col, Input, Row, Select } from 'antd';
import { useTranslation } from '@/shared/lib/i18n';
import {
  SPECIALTY_CATALOG,
  TEACHING_SPECIALTY_BASIS_VALUES,
  type TeachingSpecialtyBasis,
} from '../../model/specialty-catalog';
import { FieldLabel } from '../../pages/style';

const BASIS_LABEL_KEY: Record<TeachingSpecialtyBasis, string> = {
  diplom: 'teacher.hr.staff.form.specialty.basis.diplom',
  ordinatura: 'teacher.hr.staff.form.specialty.basis.ordinatura',
  sertifikat: 'teacher.hr.staff.form.specialty.basis.sertifikat',
  qayta_tayyorlash: 'teacher.hr.staff.form.specialty.basis.qaytaTayyorlash',
  tajriba: 'teacher.hr.staff.form.specialty.basis.tajriba',
  ilmiy_daraja: 'teacher.hr.staff.form.specialty.basis.ilmiyDaraja',
};

interface IProps {
  name: string;
  code: string;
  basis: TeachingSpecialtyBasis | null;
  note: string;
  codeError?: string;
  noteError?: string;
  onChangeName: (name: string, code: string | null) => void;
  onChangeCode: (code: string) => void;
  onChangeBasis: (basis: TeachingSpecialtyBasis | null) => void;
  onChangeNote: (note: string) => void;
}

const SpecialtyFields = ({
  name,
  code,
  basis,
  note,
  codeError,
  noteError,
  onChangeName,
  onChangeCode,
  onChangeBasis,
  onChangeNote,
}: IProps) => {
  const { t } = useTranslation();
  const [searchValue, setSearchValue] = useState('');

  const catalogOptions = useMemo(
    () => SPECIALTY_CATALOG.map((s) => ({ label: s.name, value: s.name })),
    [],
  );

  const trimmedSearch = searchValue.trim();
  const hasExactCatalogMatch = SPECIALTY_CATALOG.some(
    (s) => s.name.toLowerCase() === trimmedSearch.toLowerCase(),
  );

  const nameOptions = useMemo(() => {
    const extra = new Set<string>();
    if (trimmedSearch && !hasExactCatalogMatch) extra.add(trimmedSearch);
    if (name && !SPECIALTY_CATALOG.some((s) => s.name === name)) extra.add(name);
    return [...extra].map((v) => ({ label: v, value: v })).concat(catalogOptions);
  }, [catalogOptions, trimmedSearch, hasExactCatalogMatch, name]);

  const handleNameChange = (value: string | undefined) => {
    setSearchValue('');
    const v = value ?? '';
    if (!v) {
      onChangeName('', null);
      return;
    }
    const matched = SPECIALTY_CATALOG.find((s) => s.name === v);
    onChangeName(v, matched ? matched.code : null);
  };

  const basisOptions = TEACHING_SPECIALTY_BASIS_VALUES.map((value) => ({
    value,
    label: t(BASIS_LABEL_KEY[value]),
  }));

  return (
    <Row gutter={[20, 16]}>
      <Col span={24} sm={{ span: 12 }}>
        <FieldLabel>{t('teacher.hr.staff.form.specialty.name')}</FieldLabel>
        <Select
          showSearch
          allowClear
          value={name || undefined}
          searchValue={searchValue}
          onSearch={setSearchValue}
          onChange={handleNameChange}
          onClear={() => onChangeName('', null)}
          options={nameOptions}
          placeholder={t('teacher.hr.staff.form.specialty.namePlaceholder')}
          style={{ width: '100%' }}
        />
      </Col>
      <Col span={24} sm={{ span: 12 }}>
        <FieldLabel>{t('teacher.hr.staff.form.specialty.code')}</FieldLabel>
        <Input
          value={code}
          onChange={(e) => onChangeCode(e.target.value)}
          placeholder={t('teacher.hr.staff.form.specialty.codePlaceholder')}
          status={codeError ? 'error' : ''}
        />
      </Col>
      <Col span={24} sm={{ span: 12 }}>
        <FieldLabel>{t('teacher.hr.staff.form.specialty.basis')}</FieldLabel>
        <Select
          allowClear
          value={basis ?? undefined}
          onChange={(v) => onChangeBasis((v as TeachingSpecialtyBasis | undefined) ?? null)}
          onClear={() => onChangeBasis(null)}
          options={basisOptions}
          placeholder={t('teacher.hr.staff.form.specialty.basisPlaceholder')}
          style={{ width: '100%' }}
        />
      </Col>
      <Col span={24} sm={{ span: 12 }}>
        <FieldLabel>{t('teacher.hr.staff.form.specialty.note')}</FieldLabel>
        <Input.TextArea
          value={note}
          onChange={(e) => onChangeNote(e.target.value)}
          placeholder={t('teacher.hr.staff.form.specialty.notePlaceholder')}
          status={noteError ? 'error' : ''}
          rows={2}
          maxLength={2000}
        />
      </Col>
    </Row>
  );
};

export default SpecialtyFields;
