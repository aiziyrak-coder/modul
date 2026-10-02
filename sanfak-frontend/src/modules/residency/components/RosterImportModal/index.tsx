import { useState } from 'react';
import styled from 'styled-components';
import Modal, { ModalBody, ModalFooter } from '../common/Modal';
import { Btn } from '../common/FormElements';
import { getApiErrorMessage } from '@/shared/api';
import { App, Checkbox, SmallUpload } from '@/shared/ui';
import {
  importRoster,
  fetchImportTemplate,
  isFailedRow,
  type ImportReport,
} from '../../api/residency-api';
import {
  MdUpload,
  MdDownload,
  MdCheckCircle,
  MdWarning,
  MdCancel,
  MdInfo,
} from '../../icons';

const RESIDENT_LABEL: Record<string, [string, string]> = {
  created: ['yaratiladi', 'yaratildi'],
  existing: ['allaqachon bor', 'allaqachon bor edi'],
  linked: ['akkauntga bog‘lanadi', 'akkauntga bog‘landi'],
};

const ACCOUNT_LABEL: Record<string, [string, string]> = {
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
  const { message } = App.useApp();
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkFirst, setCheckFirst] = useState(true);

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
        const done = result.resident.created + result.resident.linked;
        if (done > 0) message.success(`${done} ta talaba kontingentga olindi`);
        else message.info('Yangi talaba qo‘shilmadi — hammasi allaqachon mavjud edi');
        onImported();
      }
    } catch (err) {
      setReport(null);
      message.error(getApiErrorMessage(err, 'Faylni yuklashda xatolik'));
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
      a.download = sample ? 'kontingent-namuna.xlsx' : 'kontingent-shablon.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      message.error(
        getApiErrorMessage(err, sample ? 'Namunani yuklab bo‘lmadi' : 'Shablonni yuklab bo‘lmadi'),
      );
    }
  };

  const failed = report?.rows.filter(isFailedRow) ?? [];
  const canConfirm =
    Boolean(report?.dryRun) &&
    (report?.resident.created ?? 0) + (report?.resident.linked ?? 0) > 0;

  return (
    <Modal open={open} onClose={close} title="Excel'dan kontingent yuklash" width="920px">
      <ModalBody>
        <Intro>
          <MdInfo size={18} />
          <span>
            Shablonni yuklab oling, to‘ldiring va shu yerga yuklang.
            {checkFirst
              ? ' Fayl avval tekshiriladi — hech narsa saqlanmaydi; natijani ko‘rib, keyin tasdiqlaysiz.'
              : ' Tekshiruv o‘chirilgan — «Yuklash» bosilishi bilan ma’lumot saqlanadi.'}
          </span>
        </Intro>

        <Row>
          <Btn $variant="ghost" onClick={() => void downloadTemplate(false)}>
            <MdDownload size={16} /> Shablonni yuklab olish
          </Btn>
          <Btn
            $variant="ghost"
            onClick={() => void downloadTemplate(true)}
            title="Xuddi o‘sha ustunlar, lekin to‘ldirilgan namunaviy satrlar bilan"
          >
            <MdDownload size={16} /> Namuna (to‘ldirilgan)
          </Btn>
          <SmallUpload
            accept=".xlsx"
            placeholder="Fayl tanlash"
            value={file?.name ?? null}
            disabled={busy}
            onFileSelect={onPick}
          />
        </Row>

        <CheckRow>
          <Checkbox checked={checkFirst} disabled={busy} onChange={onToggleCheck}>
            Avval tekshirib ko‘rish (hech narsa saqlanmaydi)
          </Checkbox>
        </CheckRow>

        {!checkFirst && file && !report && (
          <Row>
            <Btn $variant="primary" disabled={busy} onClick={() => void run(file, false)}>
              <MdUpload size={16} /> Yuklash
            </Btn>
          </Row>
        )}

        {busy && <Muted>{checkFirst ? 'Fayl tekshirilmoqda…' : 'Yuklanmoqda…'}</Muted>}

        {report && (
          <>
            <Summary>
              <Stat $tone="ok">
                <b>{report.resident.created}</b>
                <span>{report.dryRun ? 'yaratiladi' : 'yaratildi'}</span>
              </Stat>
              <Stat $tone="ok">
                <b>{report.resident.linked}</b>
                <span>{report.dryRun ? 'akkauntga bog‘lanadi' : 'akkauntga bog‘landi'}</span>
              </Stat>
              <Stat $tone="muted">
                <b>{report.resident.existing}</b>
                <span>o‘tkazib yuboriladi</span>
              </Stat>
              <Stat $tone={report.resident.failed ? 'bad' : 'muted'}>
                <b>{report.resident.failed}</b>
                <span>rad etildi</span>
              </Stat>
              <Stat $tone="muted">
                <b>{report.total}</b>
                <span>jami satr</span>
              </Stat>
            </Summary>

            {report.columns.ignored.length > 0 && (
              <Notice $tone="warn">
                <MdWarning size={18} />
                <div>
                  <b>E’tiborsiz qoldirilgan ustunlar:</b>
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
                <MdCancel size={18} />
                <div>
                  <b>{failed.length} ta satr qabul qilinmadi</b> — qolganlari baribir
                  yuklanadi. Tuzatib, faylni qayta yuklashingiz mumkin.
                </div>
              </Notice>
            )}

            <ResultWrap>
              <ResultTable>
                <thead>
                  <tr>
                    <th style={{ width: 56 }}>Satr</th>
                    <th>F.I.SH</th>
                    <th style={{ width: 140 }}>JSHSHIR</th>
                    <th>Natija</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((r) => (
                    <tr key={r.row}>
                      <td>{r.row}</td>
                      <td>{r.fullName || '—'}</td>
                      <td>{r.jshshir || '—'}</td>
                      <td>
                        {isFailedRow(r) ? (
                          <Bad>
                            <MdCancel size={16} />
                            <span>{r.errors.join(' · ')}</span>
                          </Bad>
                        ) : (
                          <>
                            <Ok>
                              <MdCheckCircle size={16} />
                              <span>
                                {label(RESIDENT_LABEL, r.resident, report.dryRun)}
                                {' · '}
                                {label(ACCOUNT_LABEL, r.account, report.dryRun)}
                              </span>
                            </Ok>
                            {r.warnings?.map((w, i) => (
                              <Warn key={i}>
                                <MdWarning size={14} />
                                <span>{w}</span>
                              </Warn>
                            ))}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                  {report.rows.length === 0 && (
                    <tr>
                      <td colSpan={4}>
                        <Muted>Faylda ma’lumot topilmadi</Muted>
                      </td>
                    </tr>
                  )}
                </tbody>
              </ResultTable>
            </ResultWrap>
          </>
        )}
      </ModalBody>

      <ModalFooter>
        <Btn $variant="ghost" onClick={close}>
          {report && !report.dryRun ? 'Yopish' : 'Bekor qilish'}
        </Btn>
        {canConfirm && (
          <Btn $variant="primary" disabled={busy} onClick={() => file && void run(file, false)}>
            Tasdiqlash va yuklash
          </Btn>
        )}
      </ModalFooter>
    </Modal>
  );
}

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 12px;
`;

const Intro = styled.div`
  display: flex;
  gap: 10px;
  font-size: 13px;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.textMuted};
  background: ${({ theme }) => theme.colors.bg};
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 14px;

  svg {
    flex: 0 0 auto;
    margin-top: 2px;
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const CheckRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textMuted};
  margin-bottom: 12px;
`;

const Summary = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 12px;
`;

const Stat = styled.div<{ $tone: 'ok' | 'bad' | 'muted' }>`
  flex: 1 1 120px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;

  b {
    font-size: 20px;
    color: ${({ $tone, theme }) =>
      $tone === 'ok'
        ? theme.colors.success
        : $tone === 'bad'
          ? theme.colors.danger
          : theme.colors.text};
  }
  span {
    font-size: 12px;
    color: ${({ theme }) => theme.colors.textMuted};
  }
`;

const Notice = styled.div<{ $tone: 'warn' | 'bad' }>`
  display: flex;
  gap: 10px;
  font-size: 13px;
  line-height: 1.6;
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 12px;
  background: ${({ $tone, theme }) =>
    $tone === 'bad' ? theme.colors.dangerLight : theme.colors.warningLight};
  color: ${({ $tone, theme }) =>
    $tone === 'bad' ? theme.colors.danger : theme.colors.warning};

  svg {
    flex: 0 0 auto;
    margin-top: 2px;
  }
  ul {
    margin: 6px 0 0;
    padding-left: 18px;
  }
  code {
    font-family: inherit;
    font-weight: 600;
  }
`;

const ResultWrap = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 10px;
  overflow: auto;
  max-height: 320px;
`;

const ResultTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;

  th {
    position: sticky;
    top: 0;
    background: ${({ theme }) => theme.colors.bg};
    text-align: left;
    padding: 10px 12px;
    color: ${({ theme }) => theme.colors.textMuted};
    font-weight: 600;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  }
  td {
    padding: 10px 12px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    color: ${({ theme }) => theme.colors.text};
    vertical-align: top;
  }
  tr:last-child td {
    border-bottom: none;
  }
`;

const Ok = styled.span`
  display: flex;
  gap: 6px;
  color: ${({ theme }) => theme.colors.success};

  svg {
    flex: 0 0 auto;
    margin-top: 2px;
  }
`;

const Warn = styled.span`
  display: flex;
  gap: 6px;
  margin-top: 4px;
  color: ${({ theme }) => theme.colors.warning};

  svg {
    flex: 0 0 auto;
    margin-top: 3px;
  }
`;

const Bad = styled.span`
  display: flex;
  gap: 6px;
  color: ${({ theme }) => theme.colors.danger};

  svg {
    flex: 0 0 auto;
    margin-top: 2px;
  }
`;

const Muted = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textMuted};
`;
