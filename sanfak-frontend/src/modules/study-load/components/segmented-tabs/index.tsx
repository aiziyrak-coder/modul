import { Segmented } from 'antd';
import styled from 'styled-components';

interface TabOption {
  key: string;
  label: string;
}

interface IProps {
  options: TabOption[];
  value: string;
  onChange: (value: string) => void;
}

const Wrapper = styled.div<{ $colLength: number }>`
  overflow: auto;

  .ant-segmented {
    background: #fff;
    border-radius: 10px;
    padding: 4px;

    .ant-segmented-group {
      display: grid;
      grid-template-columns: ${({ $colLength }) =>
        `repeat(${$colLength}, 1fr)`};
      overflow: auto;

      .ant-segmented-item {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .ant-segmented-item-label {
        padding: 0 16px;
      }
    }

    span.ant-segmented-item-label {
      font-weight: 500;
      font-size: 14px;
      line-height: 20px;
      color: var(--color-text-soft, #697586);
    }

    .ant-segmented-item-selected span.ant-segmented-item-label {
      color: var(--color-text, #121926);
    }

    .tab-item-content {
      height: 36px;
      display: flex;
      align-items: center;
      gap: 8px;
      border-radius: 6px;
    }
  }

  .ant-segmented-item-selected {
    box-shadow: 0px 1px 2px -1px #0a0d121a;
    background: #e3e8ef;
    border-radius: 6px;
  }

  .ant-segmented-thumb {
    background: #e3e8ef;
  }
`;

const SegmentedTabs = ({ options, value, onChange }: IProps) => {
  return (
    <Wrapper $colLength={options.length}>
      <Segmented
        value={value}
        onChange={(v) => onChange(String(v))}
        options={options.map((item) => ({
          value: item.key,
          label: (
            <div className="tab-item-content">
              <span>{item.label}</span>
            </div>
          ),
        }))}
      />
    </Wrapper>
  );
};

export default SegmentedTabs;
