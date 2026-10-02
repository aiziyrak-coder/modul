import { Pagination } from 'antd';
import { useTranslation } from '@/shared/lib/i18n';
import { Wrap, SizeBox, SizeBtn } from './style';

const DEFAULT_OPTS = [12, 24, 36, 48];

interface IProps {
  current: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

export default function QualPagination({
  current,
  pageSize,
  total,
  onChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_OPTS,
}: IProps) {
  const { t } = useTranslation();
  const withSize = !!onPageSizeChange;
  if (total === 0) return null;
  if (!withSize && total <= pageSize) return null;
  return (
    <Wrap $withSize={withSize}>
      {withSize ? (
        <SizeBox>
          <h5>{t('table_rows')}:</h5>
          {pageSizeOptions.map((opt) => (
            <SizeBtn key={opt} $active={pageSize === opt} onClick={() => onPageSizeChange?.(opt)}>
              {opt}
            </SizeBtn>
          ))}
        </SizeBox>
      ) : null}
      <Pagination
        current={current}
        pageSize={pageSize}
        total={total}
        onChange={onChange}
        showSizeChanger={false}
      />
    </Wrap>
  );
}
