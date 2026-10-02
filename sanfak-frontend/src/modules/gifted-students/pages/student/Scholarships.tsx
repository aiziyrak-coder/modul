import { useState } from 'react';
import { getApiErrorMessage } from '@/shared/api';
import styled from 'styled-components';
import { CardWrap } from '../../components/common/Card';
import Badge, { statusLabel } from '../../components/common/Badge';
import type { BadgeVariant } from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import { useToast } from '../../components/common/Toast';
import Loader from '../../components/common/Loader';
import { useAuth } from '../../context/AuthContext';
import { useScholarships, useMyApplications, useApplyScholarship, useMyGiftedProfile } from '../../api/gifted-api';
import { MdLock, MdCheckCircle, MdCalendarToday, MdStar } from '../../icons';
import type { Scholarship } from '../../data/types';

export default function StudentScholarships() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: scholarships = [], isLoading } = useScholarships();
  const { data: myGifted, isLoading: courseLoading } = useMyGiftedProfile();
  const loading = isLoading || courseLoading;
  const { data: applications = [] } = useMyApplications();
  const applyMut = useApplyScholarship();
  const applying = applyMut.isPending;
  const [applyModal, setApplyModal] = useState<Scholarship | null>(null);

  const yearScore = myGifted?.yearScore ?? 0;

  const handleApply = () => {
    if (!applyModal) return;
    const appliedName = applyModal.name;
    applyMut.mutate({
      scholarshipId: applyModal.id,
      scholarshipType: applyModal.type,
      scholarshipName: applyModal.name,
      academicYear: applyModal.academicYear,
    }, {
      onSuccess: () => toast(`"${appliedName}" uchun ariza yuborildi!`, 'success'),
      onError: (err) => toast(getApiErrorMessage(err, 'Ariza yuborilmadi'), 'error'),
    });
    setApplyModal(null);
  };

  const hasApplied = (id: string) => applications.some(a => a.scholarshipId === id);

  const myCourse = String(user?.course ?? '');
  const visible = scholarships.filter(
    sch => !sch.allowedCourses?.length || sch.allowedCourses.includes(myCourse)
  );

  return (
    <>
      <Wrap>
        <ScoreRow>
          <ScorePill>
            <MdStar style={{ color: '#F39C12' }} />
            Sizning ballingiz: <strong>{yearScore}</strong>
          </ScorePill>
        </ScoreRow>

        <Section>
          <SectionTitle>Mavjud stipendiyalar</SectionTitle>
          {loading ? (
            <Loader text="Stipendiyalar yuklanmoqda..." />
          ) : visible.length === 0 ? (
            <Empty>
              {scholarships.length === 0
                ? "Hozircha stipendiya e'lon qilinmagan"
                : "Sizning kursingiz uchun stipendiya e'lon qilinmagan"}
            </Empty>
          ) : (
          <SchGrid>
            {visible.map((sch) => {
              const applied = hasApplied(sch.id);

              const eligible = sch.canApply ?? true;
              const percent = sch.minScore > 0
                ? Math.min((yearScore / sch.minScore) * 100, 100)
                : 100;

              return (
                <SchCard key={sch.id} $inactive={!sch.active}>
                  <SchHead>
                    <SchName>{sch.name}</SchName>
                    {!sch.active && <Badge variant="default">Muddati o'tgan</Badge>}
                    {applied && <Badge variant="approved">Ariza berilgan</Badge>}
                  </SchHead>
                  <SchDesc>{sch.description}</SchDesc>

                  <SchMeta>
                    <MetaItem><MdCalendarToday /> Muddat: <b>{sch.deadline}</b></MetaItem>
                    <MetaItem><MdStar style={{ color: '#F39C12' }} /> Miqdor: <b>{sch.amount}</b></MetaItem>
                  </SchMeta>

                  <ScoreReq>
                    <ScoreReqTop>
                      <span>Sizning ballingiz</span>
                      <span><b>{yearScore}</b> / {sch.minScore} min</span>
                    </ScoreReqTop>
                    <ProgressBar>
                      <ProgressFill
                        $pct={percent}
                        $color={eligible ? 'var(--brand-primary)' : '#F39C12'}
                      />
                    </ProgressBar>
                    {eligible
                      ? <EligibleText><MdCheckCircle /> Ariza topshirish mumkin</EligibleText>
                      : (
                        <IneligibleText>
                          <MdLock /> {sch.canApplyReason ?? "Ariza topshirib bo'lmaydi"}
                        </IneligibleText>
                      )
                    }
                  </ScoreReq>

                  <Button
                    style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}
                    disabled={!eligible || applied || !sch.active}
                    onClick={() => setApplyModal(sch)}
                  >
                    {applied ? 'Ariza berilgan' : !eligible ? <><MdLock /> Ariza topshirib bo'lmaydi</> : 'Ariza topshirish'}
                  </Button>
                </SchCard>
              );
            })}
          </SchGrid>
          )}
        </Section>

        <Section>
          <SectionTitle>Mening arizalarim</SectionTitle>
          <CardWrap>
            {applications.length === 0 ? (
              <Empty>Hali ariza topshirilmagan</Empty>
            ) : (
              <AppList>
                {applications.map((app) => (
                  <AppItem key={app.id}>
                    <AppInfo>
                      <AppName>{app.scholarshipName}</AppName>
                      <AppDate>Yuborilgan: {app.appliedAt}</AppDate>
                      {app.note && <AppNote>{app.note}</AppNote>}
                    </AppInfo>
                    <AppRight>
                      <Badge variant={app.status as BadgeVariant}>{statusLabel[app.status]}</Badge>
                    </AppRight>
                  </AppItem>
                ))}
              </AppList>
            )}
          </CardWrap>
        </Section>
      </Wrap>

      <Modal
        open={!!applyModal}
        onClose={() => setApplyModal(null)}
        title="Ariza topshirish"
        footer={
          <>
            <Button variant="secondary" onClick={() => setApplyModal(null)}>Bekor qilish</Button>
            <Button onClick={handleApply} disabled={applying}>
              {applying ? 'Yuborilmoqda…' : 'Tasdiqlash'}
            </Button>
          </>
        }
      >
        {applyModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <ConfirmRow>
              <span>Stipendiya:</span>
              <b>{applyModal.name}</b>
            </ConfirmRow>
            <ConfirmRow>
              <span>Miqdor:</span>
              <b>{applyModal.amount}</b>
            </ConfirmRow>
            <ConfirmRow>
              <span>Sizning ballingiz:</span>
              <b style={{ color: 'var(--brand-primary)' }}>{yearScore}</b>
            </ConfirmRow>
            <ConfirmRow>
              <span>Minimal ball:</span>
              <b>{applyModal.minScore}</b>
            </ConfirmRow>
          </div>
        )}
      </Modal>
    </>
  );
}

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const ScoreRow = styled.div`
  display: flex;
`;

const ScorePill = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: white;
  border: 1px solid #E8ECEF;
  border-radius: 999px;
  font-size: 14px;
  color: #2C3E50;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
`;

const Section = styled.div``;
const SectionTitle = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: #2C3E50;
  margin-bottom: 14px;
`;

const SchGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
`;

const SchCard = styled(CardWrap)<{ $inactive: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 10px;
  opacity: ${({ $inactive }) => $inactive ? 0.65 : 1};
`;

const SchHead = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
`;
const SchName = styled.h4`
  font-size: 15px;
  font-weight: 700;
  color: #2C3E50;
  flex: 1;
`;
const SchDesc = styled.p`
  font-size: 13px;
  color: #7F8C8D;
  line-height: 1.5;
`;

const SchMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;
const MetaItem = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #7F8C8D;
  svg { font-size: 14px; }
`;

const ScoreReq = styled.div`
  background: #F4F6F9;
  border-radius: 10px;
  padding: 12px;
`;
const ScoreReqTop = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  margin-bottom: 8px;
  color: #7F8C8D;
`;
const ProgressBar = styled.div`
  height: 8px;
  background: #E8ECEF;
  border-radius: 999px;
  overflow: hidden;
  margin-bottom: 6px;
`;
const ProgressFill = styled.div<{ $pct: number; $color: string }>`
  height: 100%;
  width: ${({ $pct }) => $pct}%;
  background: ${({ $color }) => $color};
  border-radius: 999px;
  transition: width 0.6s;
`;
const EligibleText = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--brand-primary);
  font-weight: 600;
`;
const IneligibleText = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #F39C12;
  font-weight: 600;
`;

const AppList = styled.div`
  display: flex;
  flex-direction: column;
`;
const AppItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0;
  border-bottom: 1px solid #E8ECEF;
  &:last-child { border-bottom: none; }
`;
const AppInfo = styled.div``;
const AppName = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: #2C3E50;
`;
const AppDate = styled.div`
  font-size: 12px;
  color: #7F8C8D;
  margin-top: 2px;
`;
const AppNote = styled.div`
  font-size: 12px;
  color: var(--brand-primary);
  margin-top: 4px;
`;
const AppRight = styled.div``;

const Empty = styled.p`
  text-align: center;
  color: #7F8C8D;
  font-size: 13px;
  padding: 24px;
`;

const ConfirmRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  span { color: #7F8C8D; min-width: 120px; }
`;
