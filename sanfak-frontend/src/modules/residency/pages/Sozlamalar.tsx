import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { App, Input } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { usePermission } from '@/app/session';
import {
  PageTitle,
  FormGroup,
  Label,
  Btn,
  HelperText,
} from '../components/common/FormElements';
import QueryNotice from '../components/common/QueryNotice';
import { combineState } from '../lib/query-state';
import { toClockMinutes } from '../lib/clock-time';
import {
  useResidencySettings,
  useUpdateResidencySettings,
  SETTING_FALLBACK,
} from '../api/setting-api';

const isDayCount = (n: number): boolean => Number.isInteger(n) && n >= 1 && n <= 30;

export default function Sozlamalar() {
  const { message } = App.useApp();
  const can = usePermission();
  const canEdit = can('residencyLesson:update');

  const query = useResidencySettings();
  const saveM = useUpdateResidencySettings();

  const [workDayFrom, setWorkDayFrom] = useState(SETTING_FALLBACK.workDayFrom);
  const [workDayTo, setWorkDayTo] = useState(SETTING_FALLBACK.workDayTo);
  const [streak, setStreak] = useState(String(SETTING_FALLBACK.absenceStreakDays));
  const [windowDays, setWindowDays] = useState(String(SETTING_FALLBACK.absenceWindowDays));

  const savedStreak = query.data?.absenceStreakDays ?? SETTING_FALLBACK.absenceStreakDays;
  const savedWindow = query.data?.absenceWindowDays ?? null;
  const hasWindow = savedWindow !== null;

  useEffect(() => {
    if (!query.data) return;
    setWorkDayFrom(query.data.workDayFrom);
    setWorkDayTo(query.data.workDayTo);
    setStreak(String(query.data.absenceStreakDays));
    if (query.data.absenceWindowDays !== null) {
      setWindowDays(String(query.data.absenceWindowDays));
    }
  }, [query.data]);

  const submit = async () => {
    const from = toClockMinutes(workDayFrom.trim());
    const to = toClockMinutes(workDayTo.trim());
    if (from === null || to === null) {
      message.warning('Vaqt "SS:DD" ko‘rinishida bo‘lishi kerak (masalan: 09:00)');
      return;
    }
    if (from >= to) {
      message.warning('Ish kuni boshlanishi tugashidan oldin bo‘lishi kerak');
      return;
    }
    const days = Number(streak.trim());
    const win = Number(windowDays.trim());
    if (hasWindow) {
      if (!isDayCount(days)) {
        message.warning('Sababsiz kunlar soni 1 va 30 orasidagi butun son bo‘lishi kerak');
        return;
      }
      if (!isDayCount(win)) {
        message.warning('Oyna 1 va 30 kun orasidagi butun son bo‘lishi kerak');
        return;
      }
      if (days > win) {
        message.warning('Sababsiz kunlar soni oyna kunlaridan ko‘p bo‘lmasligi kerak');
        return;
      }
    } else if (!isDayCount(days)) {
      message.warning('Qoldirish ostonasi 1 va 30 kun orasidagi butun son bo‘lishi kerak');
      return;
    }

    try {
      await saveM.mutateAsync({
        workDayFrom: workDayFrom.trim(),
        workDayTo: workDayTo.trim(),
        absenceStreakDays: days,
        ...(hasWindow ? { absenceWindowDays: win } : {}),
      });
      message.success('Sozlamalar saqlandi');
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Sozlamalarni saqlab bo‘lmadi'));
    }
  };

  const state = combineState([query]);
  if (state !== 'ok') return <QueryNotice state={state} onRetry={() => void query.refetch()} />;

  return (
    <>
      <PageTitle>Sozlamalar</PageTitle>

      <Card>
        <SectionTitle>Klinik ish kuni</SectionTitle>
        <SectionNote>
          Ordinator shu oraliqda kelgan va ketgan bo‘lsagina amaliy mashg‘ulotga
          ball qo‘yish mumkin. Kechikib kelish yoki erta ketish oraliq ichida
          hisoblanadi — cheklov faqat ish kunidan tashqaridagi yozuvga tegishli.
          Magistraturaga bu qoida qo‘llanmaydi.
        </SectionNote>

        <Row>
          <FormGroup style={{ flex: 1 }}>
            <Label>Boshlanishi</Label>
            <Input
              value={workDayFrom}
              onChange={(e) => setWorkDayFrom(e.target.value)}
              placeholder="09:00"
              disabled={!canEdit}
            />
          </FormGroup>
          <FormGroup style={{ flex: 1 }}>
            <Label>Tugashi</Label>
            <Input
              value={workDayTo}
              onChange={(e) => setWorkDayTo(e.target.value)}
              placeholder="14:00"
              disabled={!canEdit}
            />
          </FormGroup>
        </Row>
        <HelperText>Format: SS:DD (24 soatlik). Masalan 09:00 va 14:00.</HelperText>
      </Card>

      {hasWindow ? (
        <Card>
          <SectionTitle>Qoldirish ostonasi</SectionTitle>
          <SectionNote>
            Rezident oxirgi kunlar oynasida kamida belgilangan sondagi kun sababsiz qoldirsa, klinik
            ustozda bo‘lim xodimiga davomat bildirgisi yuborish tugmasi ochiladi. Kunlar ketma-ket
            bo‘lishi shart emas — kun ora qoldirish ham sanaladi. Bir kunda nechta dars bo‘lsa ham
            kun bir marta sanaladi; o‘sha kuni birorta darsga kelgan yoki sababi tasdiqlangan
            bo‘lsa, kun sanalmaydi. Dam olish va bayram kunlari sanalmaydi; hali tugamagan bugungi
            kun hisobga olinmaydi.
          </SectionNote>

          <Row>
            <FormGroup style={{ flex: 1, marginBottom: 0 }}>
              <Label htmlFor="absence-streak-days">Sababsiz kunlar, kamida (1–30)</Label>
              <Input
                id="absence-streak-days"
                value={streak}
                onChange={(e) => setStreak(e.target.value)}
                placeholder="3"
                disabled={!canEdit}
              />
            </FormGroup>
            <FormGroup style={{ flex: 1, marginBottom: 0 }}>
              <Label htmlFor="absence-window-days">Oyna — oxirgi necha kun (1–30)</Label>
              <Input
                id="absence-window-days"
                value={windowDays}
                onChange={(e) => setWindowDays(e.target.value)}
                placeholder="7"
                disabled={!canEdit}
              />
            </FormGroup>
          </Row>
          <HelperText>
            {`Hozirgi qoida: oxirgi ${savedWindow} kun ichida kamida ${savedStreak} kun.`}
          </HelperText>
          {savedStreak > savedWindow && (
            <HelperText $error>
              Sababsiz kunlar soni oyna kunlaridan ko‘p — tugma hech qachon ochilmaydi
            </HelperText>
          )}
        </Card>
      ) : (
        <Card>
          <SectionTitle>Qoldirish ostonasi</SectionTitle>
          <SectionNote>
            Rezident shu kundan ko‘p ketma-ket sababsiz qoldirsa, klinik ustozda bo‘lim xodimiga
            bildirgi yuborish tugmasi ochiladi.
          </SectionNote>

          <FormGroup style={{ maxWidth: 220 }}>
            <Label>Ketma-ket kun (1–30)</Label>
            <Input
              value={streak}
              onChange={(e) => setStreak(e.target.value)}
              placeholder="3"
              disabled={!canEdit}
            />
          </FormGroup>
        </Card>
      )}

      {canEdit ? (
        <Btn onClick={submit} disabled={saveM.isPending}>
          {saveM.isPending ? 'Saqlanmoqda…' : 'Saqlash'}
        </Btn>
      ) : (
        <HelperText>
          Sozlamalarni faqat magistratura va klinik ordinatura bo‘limi
          o‘zgartira oladi.
        </HelperText>
      )}
    </>
  );
}

const Card = styled.div`
  background: ${({ theme }) => theme.colors.white};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 16px;
  max-width: 560px;
`;

const SectionTitle = styled.h3`
  margin: 0 0 6px;
  font-size: 15px;
  color: ${({ theme }) => theme.colors.text};
`;

const SectionNote = styled.p`
  margin: 0 0 14px;
  font-size: 13px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Row = styled.div`
  display: flex;
  gap: 12px;
`;
