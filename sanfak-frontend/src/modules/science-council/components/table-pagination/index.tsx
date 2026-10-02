import { Pagination } from 'antd';
import { useTranslation } from '@/shared/lib/i18n';
import * as S from './style';

const DEFAULT_OPTIONS = [12, 24, 36, 48];

interface TablePaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number, pageSize: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

export function TablePagination({
  page,
  pageSize,
  total,
  onChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_OPTIONS,
}: TablePaginationProps) {
  const { t } = useTranslation();
  if (total === 0) return null;

  return (
    <S.Wrap>
      <S.SizeBox>
        <span className="label">{t('scienceCouncil.table.rows')}:</span>
        {pageSizeOptions.map((size) => (
          <S.SizeBtn
            key={size}
            type="button"
            $active={pageSize === size}
            onClick={() => onPageSizeChange?.(size)}
          >
            {size}
          </S.SizeBtn>
        ))}
      </S.SizeBox>

      <Pagination
        current={page}
        pageSize={pageSize}
        total={total}
        onChange={onChange}
        showSizeChanger={false}
        showTotal={(count) => `${t('scienceCouncil.stats.total')}: ${count}`}
      />
    </S.Wrap>
  );
}

export default TablePagination;
