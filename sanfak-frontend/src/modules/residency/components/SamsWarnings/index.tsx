import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Checkbox } from '@/shared/ui';
import { usePermission } from '@/app/session';
import Badge from '../common/Badge';
import QueryNotice from '../common/QueryNotice';
import RefreshNotice from '../common/RefreshNotice';
import { TableWrap, Table, Th, Td, Tr } from '../common/Table';
import { useSamsWarnings } from '../../api/sams-status-api';
import type {
  SamsAmbiguousPerson,
  SamsGroupedSection,
  SamsTenantChange,
  SamsWarnGroup,
  SamsWarnPerson,
  SamsWarnings as SamsWarningsData,
} from '../../api/sams-status-types';
import { combineState } from '../../lib/query-state';
import { formatDayKey, formatUzDateTime } from '../../lib/uz-day';
import * as S from './style';

const UNKNOWN_CLINIC = 'Klinika aniqlanmagan (hech qachon topilmagan)';

const TEXT = {
  unresolved:
    'SAMS’da topilmadi — JSHSHIR hech bir klinika tashkilotida yo‘q. SAMS xodim kartochkasidagi JSHSHIR’ni yoki SANFAK’dagi JSHSHIR’ni tekshiring. Bu rezidentning kunlari o‘lchanmagan hisoblanadi.',
  ambiguous:
    'Bir JSHSHIR bir necha klinikada (yoki bir klinikada ikki marta) — aniqlanmaguncha kunlar o‘lchanmagan.',
  noSchedule:
    'SAMS’da smena biriktirilmagan — turniket skanlari jimgina tashlanadi. Kunlar o‘lchanmagan.',
  inactiveUser: 'SAMS’da xodim nofaol (active=false).',
  tenant:
    'Skanerlanadigan klinikalar soni o‘zgardi — tashkilot o‘chirilgan, nofaol qilingan yoki turi «Klinika» emas bo‘lib qolgan bo‘lishi mumkin.',
};

const onlyNew = <T extends { isNew: boolean }>(rows: T[], filter: boolean): T[] =>
  filter ? rows.filter((r) => r.isNew) : rows;

function Section({
  title,
  count,
  text,
  children,
}: {
  title: string;
  count: ReactNode;
  text: string;
  children: ReactNode;
}) {
  return (
    <S.Section>
      <S.SectionHead>
        <S.SectionTitle>{title}</S.SectionTitle>
        <Badge variant="umumiy">{count}</Badge>
      </S.SectionHead>
      <S.SectionText>{text}</S.SectionText>
      {children}
    </S.Section>
  );
}

function EmptyState({ kind }: { kind: 'noData' | 'none' | 'noNew' }) {
  const text = { noData: 'Ma’lumot kelmagan', none: 'Muammo yo‘q', noNew: 'Yangi holat yo‘q' }[
    kind
  ];
  return <S.Empty $muted={kind === 'noData'}>{text}</S.Empty>;
}

function PersonName({ person }: { person: SamsWarnPerson }) {
  const can = usePermission();
  if (person.residentId && can('residentAttendance:readAll')) {
    return <Link to={`/residency/jurnal/${person.residentId}`}>{person.fullName}</Link>;
  }
  return <>{person.fullName}</>;
}

function PersonRow({
  person,
  extra,
  edit,
}: {
  person: SamsWarnPerson;
  extra?: ReactNode;
  edit: boolean;
}) {
  return (
    <Tr>
      <Td>
        <PersonName person={person} />
        {person.isNew && (
          <S.NewMark>
            <Badge variant="yangi">yangi</Badge>
          </S.NewMark>
        )}
      </Td>
      <Td style={{ fontVariantNumeric: 'tabular-nums' }}>{person.jshshir ?? '—'}</Td>
      {extra !== undefined && <Td>{extra}</Td>}
      {edit && (
        <Td>
          {person.residentId && (
            <Link to={`/residency/kontingent/tahrir/${person.residentId}`}>
              Kontingentda tahrirlash
            </Link>
          )}
        </Td>
      )}
    </Tr>
  );
}

function GroupRows({
  group,
  filter,
  edit,
}: {
  group: SamsWarnGroup;
  filter: boolean;
  edit: boolean;
}) {
  const people = onlyNew(group.people, filter);
  if (people.length === 0) return null;
  return (
    <>
      <tr>
        <S.GroupTd colSpan={edit ? 3 : 2}>
          {group.clinic.orgTitle ?? group.clinic.dbname ?? UNKNOWN_CLINIC} · {people.length}
        </S.GroupTd>
      </tr>
      {people.map((p, i) => (
        <PersonRow key={p.residentId ?? `${p.fullName}-${i}`} person={p} edit={edit} />
      ))}
    </>
  );
}

function PersonWarningTable({
  section,
  filter,
  edit,
}: {
  section: SamsGroupedSection | null;
  filter: boolean;
  edit: boolean;
}) {
  if (!section) return <EmptyState kind="noData" />;
  const shown = section.groups.some((g) => onlyNew(g.people, filter).length > 0);
  if (!shown) return <EmptyState kind={section.count === 0 || !filter ? 'none' : 'noNew'} />;
  return (
    <TableWrap>
      <Table>
        <thead>
          <tr>
            <Th>F.I.Sh</Th>
            <Th>JSHSHIR</Th>
            {edit && <Th>Amal</Th>}
          </tr>
        </thead>
        <tbody>
          {section.groups.map((g, i) => (
            <GroupRows
              key={g.clinic.dbname ?? `unknown-${i}`}
              group={g}
              filter={filter}
              edit={edit}
            />
          ))}
        </tbody>
      </Table>
    </TableWrap>
  );
}

function AmbiguousTable({ rows, filter }: { rows: SamsAmbiguousPerson[] | null; filter: boolean }) {
  if (!rows) return <EmptyState kind="noData" />;
  const shown = onlyNew(rows, filter);
  if (shown.length === 0)
    return <EmptyState kind={rows.length === 0 || !filter ? 'none' : 'noNew'} />;
  return (
    <TableWrap>
      <Table>
        <thead>
          <tr>
            <Th>F.I.Sh</Th>
            <Th>JSHSHIR</Th>
            <Th>Klinikalar</Th>
          </tr>
        </thead>
        <tbody>
          {shown.map((p, i) => (
            <PersonRow
              key={p.residentId ?? `${p.fullName}-${i}`}
              person={p}
              edit={false}
              extra={p.clinics.map((c) => c.orgTitle ?? c.dbname ?? '—').join(', ') || '—'}
            />
          ))}
        </tbody>
      </Table>
    </TableWrap>
  );
}

const names = (refs: SamsTenantChange['added']): string =>
  (refs ?? []).map((r) => r.orgTitle ?? r.dbname ?? '—').join(', ');

function TenantChangeList({ rows, filter }: { rows: SamsTenantChange[] | null; filter: boolean }) {
  if (!rows) return <EmptyState kind="noData" />;
  const shown = onlyNew(rows, filter);
  if (shown.length === 0)
    return <EmptyState kind={rows.length === 0 || !filter ? 'none' : 'noNew'} />;
  return (
    <S.ChangeList>
      {shown.map((c, i) => (
        <li key={`${c.at ?? 'x'}-${i}`}>
          <b>{formatUzDateTime(c.at)}</b> — klinikalar soni: {c.previousCount ?? '—'} →{' '}
          {c.currentCount ?? '—'}
          {c.isNew && (
            <S.NewMark>
              <Badge variant="yangi">yangi</Badge>
            </S.NewMark>
          )}
          {names(c.added) && <S.ChangeSub>Qo‘shilgan: {names(c.added)}</S.ChangeSub>}
          {names(c.removed) && <S.ChangeSub>Chiqib ketgan: {names(c.removed)}</S.ChangeSub>}
        </li>
      ))}
    </S.ChangeList>
  );
}

const countOf = (v: { count: number } | null): ReactNode => (v ? v.count : '—');

function WarningSections({
  w,
  filter,
  canEdit,
}: {
  w: SamsWarningsData;
  filter: boolean;
  canEdit: boolean;
}) {
  return (
    <>
      <Section
        title="1. JSHSHIR SAMS’da topilmadi"
        count={countOf(w.unresolved)}
        text={TEXT.unresolved}
      >
        <PersonWarningTable section={w.unresolved} filter={filter} edit={canEdit} />
      </Section>
      <Section title="2. Bir necha klinikada" count={countOf(w.ambiguous)} text={TEXT.ambiguous}>
        <AmbiguousTable rows={w.ambiguous?.items ?? null} filter={filter} />
      </Section>
      <Section
        title="3. Smena biriktirilmagan"
        count={countOf(w.noSchedule)}
        text={TEXT.noSchedule}
      >
        <PersonWarningTable section={w.noSchedule} filter={filter} edit={false} />
      </Section>
      <Section
        title="4. SAMS’da nofaol xodim"
        count={countOf(w.inactiveUser)}
        text={TEXT.inactiveUser}
      >
        <PersonWarningTable section={w.inactiveUser} filter={filter} edit={false} />
      </Section>
      <Section
        title="5. Klinikalar soni o‘zgardi"
        count={w.tenantSetChanged ? w.tenantSetChanged.length : '—'}
        text={TEXT.tenant}
      >
        <TenantChangeList rows={w.tenantSetChanged} filter={filter} />
      </Section>
    </>
  );
}

export default function SamsWarnings() {
  const can = usePermission();
  const canEdit = can('resident:update');
  const query = useSamsWarnings();
  const [filter, setFilter] = useState(false);
  const state = combineState([query]);

  const retry = () => void query.refetch();

  if (!query.data) {
    return <QueryNotice state={state === 'ok' ? 'loading' : state} onRetry={retry} compact />;
  }
  const w = query.data;
  return (
    <div>
      <RefreshNotice state={state} updatedAt={query.dataUpdatedAt} onRetry={retry} />
      <S.Toolbar>
        <Checkbox checked={filter} onChange={setFilter}>
          Faqat yangilari
        </Checkbox>
        <S.Muted>Holat kuni: {formatDayKey(w.day)}</S.Muted>
        <S.Muted>
          {w.digestDay
            ? `Oxirgi kunlik yig‘ma: ${formatDayKey(w.digestDay)}`
            : 'Kunlik yig‘ma hali yuborilmagan'}
        </S.Muted>
      </S.Toolbar>
      <WarningSections w={w} filter={filter} canEdit={canEdit} />
    </div>
  );
}
