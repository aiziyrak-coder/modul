import type { ReactNode } from 'react';
import { Pagination, Spin } from 'antd';
import { useTranslation } from '@/shared/lib/i18n';
import * as S from './style';

export default function FeedPager({
  children,
  page,
  pageSize,
  total,
  loading,
  pageSizeOptions = [12, 24, 36, 48],
  onChange,
}: {
  children: ReactNode;
  page: number;
  pageSize: number;
  total: number;
  loading?: boolean;
  pageSizeOptions?: number[];
  onChange: (page: number, pageSize: number) => void;
}) {
  const { t } = useTranslation();

  return (
    <S.FeedRoot>
      <S.SpinArea>
        <Spin spinning={Boolean(loading)}>
          <S.FeedScrollArea>{children}</S.FeedScrollArea>
        </Spin>
      </S.SpinArea>
      {total > 0 ? (
        <S.PagerBar>
          <S.SizeContainer>
            <h5>{t('table_rows')}:</h5>
            {pageSizeOptions.map((size) => (
              <S.SizeButton
                key={size}
                $active={pageSize === size}
                onClick={() => onChange(1, size)}
              >
                {size}
              </S.SizeButton>
            ))}
          </S.SizeContainer>
          <Pagination
            current={page}
            pageSize={pageSize}
            total={total}
            onChange={onChange}
            showSizeChanger={false}
          />
        </S.PagerBar>
      ) : null}
    </S.FeedRoot>
  );
}
