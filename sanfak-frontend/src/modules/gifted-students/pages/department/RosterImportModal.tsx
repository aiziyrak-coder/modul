import { useState } from 'react';
import styled from 'styled-components';
import Button from '../../components/common/Button';
import { useToast } from '../../components/common/Toast';
import {
  importRoster,
  fetchImportTemplate,
  isFailedRow,
  type ImportReport,
  type ImportRow,
} from '../../api/gifted-api';
import { getApiErrorMessage } from '@/shared/api';
import { Checkbox, SmallUpload } from '@/shared/ui';
import {
  MdClose, MdUploadFile, MdDownloadFile, MdWarning, MdCheckCircle, MdError, MdInfoOutline,
} from '../../icons';

const STUDENT_LABEL: Record<string, [preview: string, done: string]> = {
  created: ['yaratiladi', 'yaratildi'],
  existing: ['allaqachon bor', 'allaqachon bor edi'],
  linked: ['akkauntga bog’lanadi', 'akkauntga bog’landi'],
};

const ACCOUNT_LABEL: Record<string, [preview: string, done: string]> = {
  created: ['akkaunt ochiladi', 'akkaunt ochildi'],
  existing: ['akkaunt bor edi', 'akkaunt bor edi'],
  skipped: ['akkaunt ochilmaydi', 'akkaunt ochilmadi'],
};

const label = (map: Record<string, [string, string]>, key: string, dryRun: boolean) =>
  map[key]?.[dryRun ? 0 : 1] ?? key;

export default function RosterImportModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const { toast } = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkFirst, setCheckFirst] = useState(true);

  if (!open) return null;

  const reset = () => {
    setFile(null);
    setReport(null);
    setBusy(false);
    setCheckFirst(true);
  };

  const close = () => {
    reset();
    onClose();
  };

  const run = async (chosen: File, dryRun: boolean) => {
    setBusy(true);
    try {
      const result = await importRoster(chosen, dryRun);
      setReport(result);
      if (!dryRun) {
        const done = result.student.created + result.student.linked;
        toast(
          done > 0
            ? `${done} ta talaba ro'yxatga olindi`
            : "Yangi talaba qo'shilmadi — hammasi allaqachon mavjud edi",
          done > 0 ? 'success' : 'info',
        );
        onImported();
      }
    } catch (err) {
      setReport(null);
      toast(getApiErrorMessage(err, "Faylni yuklashda xatolik"), 'error');
    } finally {
      setBusy(false);
    }
  };

  const onPick = (chosen: File) => {
    setFile(chosen);
    setReport(null);
    if (checkFirst) void run(chosen, true);
  };

  const onToggleCheck = (next: boolean) => {
    setCheckFirst(next);
    setReport(null);
    if (next && file) void run(file, true);
  };

  const downloadTemplate = async (sample = false) => {
    try {
      const blob = await fetchImportTemplate(sample);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = sample
        ? 'iqtidorli-talabalar-namuna.xlsx'
        : 'iqtidorli-talabalar-shablon.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast(
        getApiErrorMessage(
          err,
          sample ? "Namunani yuklab bo'lmadi" : "Shablonni yuklab bo'lmadi",
        ),
        'error',
      );
    }
  };

  const failed = report?.rows.filter(isFailedRow) ?? [];
  const okRows = report?.rows.filter((r) => !isFailedRow(r)) ?? [];
  const canConfirm = Boolean(report?.dryRun) && (report?.student.created ?? 0) + (report?.student.linked ?? 0) > 0;

  return (
    <Overlay onClick={close}>
      <Box onClick={(e) => e.stopPropagation()}>
        <Head>
          <Title><MdUploadFile /> Excel'dan talaba yuklash</Title>
          <CloseBtn onClick={close}><MdClose /></CloseBtn>
        </Head>

        <Body>
          <Intro>
            <MdInfoOutline />
            <span>
              Shablonni yuklab oling, to'ldiring va shu yerga yuklang.
              {checkFirst ? (
                <>
                  {' '}Fayl avval <b>tekshiriladi</b> — hech narsa saqlanmaydi;
                  natijani ko'rib, keyin tasdiqlaysiz.
                </>
              ) : (
                <>
                  {' '}Tekshiruv <b>o'chirilgan</b> — &laquo;Yuklash&raquo; bosilishi
                  bilan ma'lumot saqlanadi.
                </>
              )}
            </span>
          </Intro>

          <Row>
            <Button variant="secondary" onClick={() => void downloadTemplate(false)}>
              <MdDownloadFile /> Shablonni yuklab olish
            </Button>
            <Button
              variant="secondary"
              onClick={() => void downloadTemplate(true)}
              title="Xuddi o'sha ustunlar, lekin to'ldirilgan namunaviy satrlar bilan"
            >
              <MdDownloadFile /> Namuna (to'ldirilgan)
            </Button>
            <SmallUpload
              accept=".xlsx"
              placeholder="Fayl tanlash"
              value={file?.name ?? null}
              disabled={busy}
              onFileSelect={onPick}
            />
          </Row>

          <CheckRow>
            <Checkbox
              checked={checkFirst}
              disabled={busy}
              onChange={onToggleCheck}
            >
              Avval tekshirib ko'rish (hech narsa saqlanmaydi)
            </Checkbox>
          </CheckRow>

          {!checkFirst && file && !report && (
            <Row>
              <Button disabled={busy} onClick={() => void run(file, false)}>
                <MdUploadFile /> Yuklash
              </Button>
            </Row>
          )}

          {busy && <Muted>{checkFirst ? 'Fayl tekshirilmoqda…' : 'Yuklanmoqda…'}</Muted>}

          {report && (
            <>
              <Summary>
                <Stat $tone="ok">
                  <b>{report.student.created}</b>
                  <span>{report.dryRun ? 'yaratiladi' : 'yaratildi'}</span>
                </Stat>
                <Stat $tone="ok">
                  <b>{report.student.linked}</b>
                  <span>{report.dryRun ? 'akkauntga bog’lanadi' : 'akkauntga bog’landi'}</span>
                </Stat>
                <Stat $tone="muted">
                  <b>{report.student.existing}</b>
                  <span>o'tkazib yuboriladi</span>
                </Stat>
                <Stat $tone={report.student.failed ? 'bad' : 'muted'}>
                  <b>{report.student.failed}</b>
                  <span>rad etildi</span>
                </Stat>
                <Stat $tone="muted">
                  <b>{report.total}</b>
                  <span>jami satr</span>
                </Stat>
              </Summary>

              {report.columns.ignored.length > 0 && (
                <Notice $tone="warn">
                  <MdWarning />
                  <div>
                    <b>E'tiborsiz qoldirilgan ustunlar:</b>
                    <ul>
                      {report.columns.ignored.map((c) => (
                        <li key={c.header}>
                          <code>{c.header}</code> — {c.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                </Notice>
              )}

              {failed.length > 0 && (
                <Notice $tone="bad">
                  <MdError />
                  <div>
                    <b>{failed.length} ta satr qabul qilinmadi</b> — qolganlari
                    baribir yuklanadi. Tuzatib, faylni qayta yuklashingiz mumkin.
                  </div>
                </Notice>
              )}

              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <th style={{ width: 56 }}>Satr</th>
                      <th>F.I.SH</th>
                      <th style={{ width: 140 }}>JSHSHIR</th>
                      <th>Natija</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((r: ImportRow) => (
                      <tr key={r.row}>
                        <td>{r.row}</td>
                        <td>{r.fullName || '—'}</td>
                        <td><Mono>{r.jshshir || '—'}</Mono></td>
                        <td>
                          {isFailedRow(r) ? (
                            <Bad>
                              <MdError />
                              <span>{r.errors.join(' · ')}</span>
                            </Bad>
                          ) : (
                            <Ok>
                              <MdCheckCircle />
                              <span>
                                {label(STUDENT_LABEL, r.student, report.dryRun)}
                                {' · '}
                                {label(ACCOUNT_LABEL, r.account, report.dryRun)}
                                {r.warnings?.length ? ` · ${r.warnings.join(' · ')}` : ''}
                              </span>
                            </Ok>
                          )}
                        </td>
                      </tr>
                    ))}
                    {report.rows.length === 0 && (
                      <tr>
                        <td colSpan={4}><Muted>Faylda ma'lumot topilmadi</Muted></td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </TableWrap>

              {!report.dryRun && okRows.length > 0 && (
                <Notice $tone="ok">
                  <MdCheckCircle />
                  <div>Yuklash yakunlandi.</div>
                </Notice>
              )}
            </>
          )}
        </Body>

        <Foot>
          <Button variant="secondary" onClick={close}>
            {report && !report.dryRun ? 'Yopish' : 'Bekor qilish'}
          </Button>
          {canConfirm && (
            <Button disabled={busy} onClick={() => file && run(file, false)}>
              Tasdiqlash va yuklash
            </Button>
          )}
        </Foot>
      </Box>
    </Overlay>
  );
}

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
  padding: 24px;
`;

const Box = styled.div`
  background: #fff;
  border-radius: ${({ theme }) => theme.radius.lg};
  width: min(920px, 100%);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #EAECF0;
`;

const Title = styled.h3`
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 16px;
  color: #101828;
`;

const CloseBtn = styled.button`
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 20px;
  color: #667085;
  display: flex;
`;

const Body = styled.div`
  padding: 20px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const Foot = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid #EAECF0;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
`;

const CheckRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #475467;
`;

const Intro = styled.div`
  display: flex;
  gap: 10px;
  font-size: 13px;
  line-height: 1.6;
  color: #475467;
  background: var(--brand-soft, #F4F7FF);
  border-radius: ${({ theme }) => theme.radius.md};
  padding: 12px 14px;

  svg { flex: 0 0 auto; margin-top: 2px; color: var(--brand-primary, #2F6BFF); }
`;

const Summary = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`;

const Stat = styled.div<{ $tone: 'ok' | 'bad' | 'muted' }>`
  flex: 1 1 120px;
  border: 1px solid #EAECF0;
  border-radius: ${({ theme }) => theme.radius.md};
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;

  b {
    font-size: 20px;
    color: ${({ $tone }) =>
      $tone === 'ok' ? '#12B76A' : $tone === 'bad' ? '#F04438' : '#344054'};
  }
  span { font-size: 12px; color: #667085; }
`;

const Notice = styled.div<{ $tone: 'warn' | 'bad' | 'ok' }>`
  display: flex;
  gap: 10px;
  font-size: 13px;
  line-height: 1.6;
  border-radius: ${({ theme }) => theme.radius.md};
  padding: 12px 14px;
  background: ${({ $tone }) =>
    $tone === 'bad' ? '#FEF3F2' : $tone === 'warn' ? '#FFFAEB' : '#ECFDF3'};
  color: ${({ $tone }) =>
    $tone === 'bad' ? '#B42318' : $tone === 'warn' ? '#B54708' : '#027A48'};

  svg { flex: 0 0 auto; margin-top: 2px; }
  ul { margin: 6px 0 0; padding-left: 18px; }
  code { font-family: inherit; font-weight: 600; }
`;

const TableWrap = styled.div`
  border: 1px solid #EAECF0;
  border-radius: ${({ theme }) => theme.radius.md};
  overflow: auto;
  max-height: 320px;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;

  th {
    position: sticky;
    top: 0;
    background: #F9FAFB;
    text-align: left;
    padding: 10px 12px;
    color: #475467;
    font-weight: 600;
    border-bottom: 1px solid #EAECF0;
  }
  td {
    padding: 10px 12px;
    border-bottom: 1px solid #F2F4F7;
    color: #344054;
    vertical-align: top;
  }
  tr:last-child td { border-bottom: none; }
`;

const Mono = styled.span`
  font-variant-numeric: tabular-nums;
`;

const Ok = styled.span`
  display: flex;
  gap: 6px;
  color: #027A48;
  svg { flex: 0 0 auto; margin-top: 2px; }
`;

const Bad = styled.span`
  display: flex;
  gap: 6px;
  color: #B42318;
  svg { flex: 0 0 auto; margin-top: 2px; }
`;

const Muted = styled.div`
  font-size: 13px;
  color: #667085;
`;
