import { useRef, useState, type ChangeEvent } from 'react';
import { App, Tooltip, Typography } from '@/shared/ui';
import { MdFileDownload, MdUpload } from '../../icons';
import { Btn } from '../common/FormElements';
import {
  Fact,
  FactGrid,
  FactLabel,
  FactValue,
  Panel,
  PanelActions,
  PanelHead,
  PanelHint,
  PanelTitle,
} from '../common/InfoPanel';
import { downloadExpulsionScan, useUploadExpulsionScan } from '../../api/expulsion-order-api';
import type { ExpulsionOrder, ExpulsionScan } from '../../api/expulsion-order-types';
import { SCAN_ACCEPT, validateScanFile } from '../../lib/sign-input';
import { formatUzDateTime } from '../../lib/uz-day';
import { useOrderErrorReporter } from '../../lib/use-order-error';

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function ScanMeta({ scan }: { scan: ExpulsionScan }) {
  return (
    <FactGrid>
      <Fact>
        <FactLabel>Fayl</FactLabel>
        <FactValue>{scan.fileName}</FactValue>
      </Fact>
      <Fact>
        <FactLabel>Hajmi</FactLabel>
        <FactValue>{formatSize(scan.size)}</FactValue>
      </Fact>
      <Fact>
        <FactLabel>Yuklangan</FactLabel>
        <FactValue>{formatUzDateTime(scan.uploadedAt)}</FactValue>
      </Fact>
      <Fact>
        <FactLabel>Yuklagan</FactLabel>
        <FactValue>{scan.uploadedByName ?? '—'}</FactValue>
      </Fact>
      <Fact>
        <FactLabel>SHA-256</FactLabel>
        <FactValue>
          <Tooltip title={scan.sha256}>
            <Typography.Text code>{scan.sha256.slice(0, 12)}…</Typography.Text>
          </Tooltip>
        </FactValue>
      </Fact>
    </FactGrid>
  );
}

function useScanDownload(order: ExpulsionOrder) {
  const report = useOrderErrorReporter();
  const [pending, setPending] = useState(false);
  const run = async () => {
    setPending(true);
    try {
      await downloadExpulsionScan(order);
    } catch (err) {
      await report(err);
    } finally {
      setPending(false);
    }
  };
  return { pending, run };
}

function useScanUpload(order: ExpulsionOrder) {
  const { message } = App.useApp();
  const report = useOrderErrorReporter();
  const upload = useUploadExpulsionScan();
  const inputRef = useRef<HTMLInputElement>(null);

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const problem = validateScanFile(file);
    if (problem) {
      message.error(problem);
      return;
    }
    upload.mutate(
      { id: order.id, file },
      {
        onSuccess: () => message.success('Skan yuklandi'),
        onError: (err) => void report(err),
      },
    );
  };

  return { inputRef, onPick, pending: upload.isPending };
}

export default function ExpulsionScanPanel({ order }: { order: ExpulsionOrder }) {
  const download = useScanDownload(order);
  const upload = useScanUpload(order);

  return (
    <Panel aria-label="Imzolangan skan">
      <PanelHead>
        <PanelTitle>Imzolangan qog‘oz skani</PanelTitle>
      </PanelHead>
      {order.scan ? (
        <ScanMeta scan={order.scan} />
      ) : (
        <PanelHint $tone="muted">Skan hali yuklanmagan.</PanelHint>
      )}
      <PanelActions>
        {order.scan && (
          <Btn $variant="outline" disabled={download.pending} onClick={() => void download.run()}>
            <MdFileDownload /> Skanni yuklab olish
          </Btn>
        )}
        {order.flags.canUploadScan && (
          <>
            <input
              ref={upload.inputRef}
              type="file"
              accept={SCAN_ACCEPT}
              hidden
              data-testid="expulsion-scan-input"
              onChange={upload.onPick}
            />
            <Btn $variant="primary" disabled={upload.pending} onClick={() => upload.inputRef.current?.click()}>
              <MdUpload /> {order.scan ? 'Skanni almashtirish' : 'Imzolangan skanni yuklash'}
            </Btn>
          </>
        )}
      </PanelActions>
      {order.flags.canUploadScan && (
        <PanelHint $tone="muted">PDF, JPG yoki PNG, 10 MB gacha.</PanelHint>
      )}
    </Panel>
  );
}
