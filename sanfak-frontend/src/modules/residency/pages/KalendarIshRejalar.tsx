import { useState } from 'react';
import { PageTitle, Tabs, Tab } from '../components/common/FormElements';
import PlanReviewView from '../components/plan/PlanReviewView';
import { activityPlanHooks, dissertationPlanHooks } from '../api/plan-api';
import { ACTIVITY_KIND, DISSERTATION_KIND } from '../api/plan-types';

export default function KalendarIshRejalar() {
  const [tab, setTab] = useState<'faoliyat' | 'dissertatsiya'>('faoliyat');
  const hooks = tab === 'faoliyat' ? activityPlanHooks : dissertationPlanHooks;
  const kind = tab === 'faoliyat' ? ACTIVITY_KIND : DISSERTATION_KIND;

  return (
    <div>
      <PageTitle>Kalendar ish rejalar</PageTitle>
      <Tabs>
        <Tab $active={tab === 'faoliyat'} onClick={() => setTab('faoliyat')}>
          Faoliyat rejalari
        </Tab>
        <Tab $active={tab === 'dissertatsiya'} onClick={() => setTab('dissertatsiya')}>
          Dissertatsiya rejalari
        </Tab>
      </Tabs>
      <PlanReviewView hooks={hooks} kind={kind} />
    </div>
  );
}
