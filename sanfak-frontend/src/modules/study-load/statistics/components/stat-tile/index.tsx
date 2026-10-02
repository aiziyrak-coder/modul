import { Typography } from 'antd';
import { Tile, TileValue, type TileTone } from './style';

export type { TileTone };

interface IProps {
  label: string;
  value: string;
  tone?: TileTone;
  loading?: boolean;
}

export default function StatTile({ label, value, tone = 'default', loading }: IProps) {
  return (
    <Tile $tone={tone}>
      <TileValue>{loading ? '···' : value}</TileValue>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {label}
      </Typography.Text>
    </Tile>
  );
}
