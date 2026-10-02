import { useMemo } from 'react';
import { Tooltip } from '@/shared/ui';
import { TableWrap } from '../common/Table';
import type {
  SamsClinicRow,
  SamsDay,
  SamsDayCell,
  SamsDayInfo,
  SamsGrid,
  SamsOutage,
} from '../../api/sams-status-types';
import {
  CELL_STATE_META,
  LEGEND_STATES,
  canDeclareOutage,
  cellText,
  coverageOf,
  deriveCellState,
  findCoveringOutage,
  shortDay,
  unmeasuredReasonLabel,
  weekdayShort,
  type SamsCellState,
} from '../../lib/sams-cell-state';
import { formatDayKey, formatUzDateTime } from '../../lib/uz-day';
import * as S from './style';

export interface SamsDeclareTarget {
  dbname: string;
  day: SamsDay;
}

interface Props {
  grid: SamsGrid;
  today: SamsDay;
  outages: readonly SamsOutage[] | null;
  outagesComplete: boolean;
  canWrite: boolean;
  onDeclare: (target: SamsDeclareTarget) => void;
}

interface MatrixCell {
  day: SamsDay;
  state: SamsCellState;
  cell: SamsDayCell | null;
  outage: SamsOutage | null;
}

interface MatrixRow {
  clinic: SamsClinicRow;
  cells: MatrixCell[];
}

function buildMatrix(
  grid: SamsGrid,
  today: SamsDay,
  outages: Props['outages'],
  known: boolean,
): MatrixRow[] {
  return grid.clinics.map((clinic) => ({
    clinic,
    cells: grid.days.map(({ day, working }) => {
      const cell = clinic.cells[day] ?? null;
      const outage = outages ? findCoveringOutage(clinic.dbname, day, outages) : null;
      const state = deriveCellState({
        cell,
        working,
        isToday: day === today,
        isFuture: day > today,
        outageCovered: coverageOf(outage, known),
      });
      return { day, state, cell, outage };
    }),
  }));
}

function CellTip({ item }: { item: MatrixCell }) {
  const { cell, outage } = item;
  return (
    <div>
      <S.TipLine>
        <b>{formatDayKey(item.day)}</b> — {CELL_STATE_META[item.state].label}
      </S.TipLine>
      {cell && <S.TipLine>Paket: {formatUzDateTime(cell.packetAt)}</S.TipLine>}
      {cell && <S.TipLine>Skan (xom): {cell.rosterScanCount ?? '—'}</S.TipLine>}
      {cell && (
        <S.TipLine>
          Kutilgan: {cell.expectedResidents ?? '—'} · skanerlangan: {cell.scannedResidents ?? '—'}
        </S.TipLine>
      )}
      {cell?.unmeasuredReason && (
        <S.TipLine>Sabab: {unmeasuredReasonLabel(cell.unmeasuredReason)}</S.TipLine>
      )}
      {outage && <div>Uzilish sababi: {outage.reason}</div>}
    </div>
  );
}

function GridCell({
  item,
  clinic,
  canWrite,
  onDeclare,
}: {
  item: MatrixCell;
  clinic: SamsClinicRow;
  canWrite: boolean;
  onDeclare: Props['onDeclare'];
}) {
  const meta = CELL_STATE_META[item.state];
  const text = cellText(item.state, item.cell);
  const label = `${clinic.orgTitle}, ${formatDayKey(item.day)}: ${meta.label}${text ? ` (${text})` : ''}`;
  const clickable = canWrite && canDeclareOutage(item.state);
  const body = clickable ? (
    <S.CellButton
      type="button"
      $tone={meta.tone}
      aria-label={`${label} — uzilish oynasini e’lon qilish`}
      onClick={() => onDeclare({ dbname: clinic.dbname, day: item.day })}
    >
      {text}
    </S.CellButton>
  ) : (
    <S.CellBox $tone={meta.tone} aria-label={label} role="img">
      {text}
    </S.CellBox>
  );
  if (item.state === 'future') return body;
  return (
    <Tooltip title={<CellTip item={item} />} mouseEnterDelay={0.2}>
      {body}
    </Tooltip>
  );
}

function ClinicHeader({ clinic }: { clinic: SamsClinicRow }) {
  const tip = (
    <div>
      <S.TipLine>SAMS bazasi: {clinic.dbname}</S.TipLine>
      <S.TipLine>Oxirgi paket: {formatUzDateTime(clinic.lastPacketAt)}</S.TipLine>
      <S.TipLine>
        {clinic.deliveredThrough
          ? `To‘liq yetkazilgan: ${formatDayKey(clinic.deliveredThrough)} gacha`
          : 'To‘liq yetkazilgan kun hali yo‘q'}
      </S.TipLine>
      {clinic.firstDay && (
        <S.TipLine>Kuzatuv boshlangan: {formatDayKey(clinic.firstDay)}</S.TipLine>
      )}
    </div>
  );
  return (
    <Tooltip title={tip} placement="right">
      <div>
        <S.ClinicTitle>{clinic.orgTitle}</S.ClinicTitle>
        <S.ClinicSub $warn={!clinic.live}>
          {clinic.live ? 'Paket: ' : 'Paket kelmayapti · oxirgi: '}
          {formatUzDateTime(clinic.lastPacketAt)}
        </S.ClinicSub>
      </div>
    </Tooltip>
  );
}

function DayHeader({ info, today }: { info: SamsDayInfo; today: SamsDay }) {
  return (
    <S.DayTh scope="col" $today={info.day === today} $muted={!info.working}>
      {shortDay(info.day)}
      <S.Weekday>{info.day === today ? 'bugun' : weekdayShort(info.day)}</S.Weekday>
    </S.DayTh>
  );
}

function GridLegend() {
  return (
    <>
      <S.Legend aria-label="Belgilar">
        {LEGEND_STATES.map((key) => (
          <S.LegendItem key={key}>
            <S.CellBox $tone={CELL_STATE_META[key].tone} aria-hidden="true">
              {CELL_STATE_META[key].sample}
            </S.CellBox>
            {CELL_STATE_META[key].label}
          </S.LegendItem>
        ))}
      </S.Legend>
      <S.Note>
        O‘lchanmagan kun hech qachon «kelmadi» hisoblanmaydi va 72 soatga kirmaydi. «To‘liq / qisman
        / hech kim skanerlanmadi» faqat yopilgan (yakuniy paketi kelgan) kunlarda ko‘rsatiladi.
        Uzilish oynasi kunni «o‘lchanmagan» qiladi — davomatni «sababli» qilmaydi.
      </S.Note>
    </>
  );
}

function MatrixRowView({
  row,
  today,
  canWrite,
  onDeclare,
}: {
  row: MatrixRow;
  today: SamsDay;
  canWrite: boolean;
  onDeclare: Props['onDeclare'];
}) {
  return (
    <tr>
      <S.StickyTd>
        <ClinicHeader clinic={row.clinic} />
      </S.StickyTd>
      {row.cells.map((item) => (
        <S.DayTd key={item.day} $today={item.day === today}>
          <GridCell item={item} clinic={row.clinic} canWrite={canWrite} onDeclare={onDeclare} />
        </S.DayTd>
      ))}
    </tr>
  );
}

export default function SamsStatusGrid(props: Props) {
  const { grid, today, outages, outagesComplete, canWrite, onDeclare } = props;
  const known = outages !== null && outagesComplete;
  const matrix = useMemo(
    () => buildMatrix(grid, today, outages, known),
    [grid, today, outages, known],
  );

  if (matrix.length === 0) {
    return (
      <>
        <S.Note>
          Bu oynada SAMS’dan birorta klinika ma’lumoti kelmagan — hamma kun «o‘lchanmagan».
        </S.Note>
        <GridLegend />
      </>
    );
  }

  return (
    <>
      <TableWrap>
        <S.GridTable aria-label="Klinikalar × kun">
          <thead>
            <tr>
              <S.StickyTh scope="col">Klinika</S.StickyTh>
              {grid.days.map((d) => (
                <DayHeader key={d.day} info={d} today={today} />
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row) => (
              <MatrixRowView
                key={row.clinic.dbname}
                row={row}
                today={today}
                canWrite={canWrite && known}
                onDeclare={onDeclare}
              />
            ))}
          </tbody>
        </S.GridTable>
      </TableWrap>
      <GridLegend />
    </>
  );
}
