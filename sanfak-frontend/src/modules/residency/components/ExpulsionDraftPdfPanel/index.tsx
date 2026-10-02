import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MdFileDownload } from '../../icons';
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
import { downloadExpulsionDraftPdf, EXPULSION_ORDER_KEY } from '../../api/expulsion-order-api';
import type { ExpulsionOrder } from '../../api/expulsion-order-types';
import { formatUzDateTime } from '../../lib/uz-day';
import { useOrderErrorReporter } from '../../lib/use-order-error';

function DraftMeta({ order }: { order: ExpulsionOrder }) {
  const pdf = order.draftPdf;
  if (!pdf) {
    return <PanelHint $tone="muted">Loyiha PDF’i hali yaratilmagan.</PanelHint>;
  }
  return (
    <FactGrid>
      <Fact>
        <FactLabel>Fayl</FactLabel>
        <FactValue>{pdf.fileName}</FactValue>
      </Fact>
      <Fact>
        <FactLabel>Ma’lumot holati</FactLabel>
        <FactValue>{formatUzDateTime(pdf.generatedAt)}</FactValue>
      </Fact>
      <Fact>
        <FactLabel>Qog‘ozdagi jami</FactLabel>
        <FactValue>{pdf.hours === null ? '—' : `${pdf.hours} soat`}</FactValue>
      </Fact>
      <Fact>
        <FactLabel>Yaratgan</FactLabel>
        <FactValue>{pdf.generatedByName ?? '—'}</FactValue>
      </Fact>
    </FactGrid>
  );
}

function DraftHints({ order }: { order: ExpulsionOrder }) {
  const { flags } = order;
  const firstPrint = flags.canGetDraftPdf && !order.draftPdf;
  const notAnnounced = order.status === 'loyiha' && order.origin === 'tizim' && !order.noticesSentAt;
  return (
    <>
      {firstPrint && (
        <PanelHint $tone="info">PDF birinchi bosishda yaratiladi va muzlatiladi.</PanelHint>
      )}
      {firstPrint && !order.scan && (
        <PanelHint $tone="warning">
          Skan yuklangach tizim loyiha PDF’ini yaratmaydi — kerak bo‘lsa avval PDF’ni oling.
        </PanelHint>
      )}
      {notAnnounced && (
        <PanelHint $tone="muted">Loyiha hali e’lon qilinmagan — PDF birozdan keyin.</PanelHint>
      )}
    </>
  );
}

export default function ExpulsionDraftPdfPanel({ order }: { order: ExpulsionOrder }) {
  const q = useQueryClient();
  const report = useOrderErrorReporter();
  const [pending, setPending] = useState(false);

  const download = async () => {
    setPending(true);
    try {
      await downloadExpulsionDraftPdf(order);
      void q.invalidateQueries({ queryKey: [EXPULSION_ORDER_KEY] });
    } catch (err) {
      await report(err);
    } finally {
      setPending(false);
    }
  };

  return (
    <Panel aria-label="Buyruq loyihasi PDF">
      <PanelHead>
        <PanelTitle>Buyruq loyihasi (PDF)</PanelTitle>
      </PanelHead>
      {order.origin === 'meros' && (
        <PanelHint $tone="info">
          Meros loyiha — tizim PDF’i yaratilmaydi; bo‘lim o‘z qog‘ozini tayyorlaydi.
        </PanelHint>
      )}
      {order.origin !== 'meros' && <DraftMeta order={order} />}
      <DraftHints order={order} />
      {order.flags.canGetDraftPdf && (
        <PanelActions>
          <Btn $variant="outline" disabled={pending} onClick={() => void download()}>
            <MdFileDownload /> {pending ? 'Yuklanmoqda…' : 'Loyiha PDF’ini yuklab olish'}
          </Btn>
        </PanelActions>
      )}
    </Panel>
  );
}
