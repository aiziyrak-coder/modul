import { useState } from 'react';
import { MdCheckCircle } from '../../icons';
import { Btn } from '../common/FormElements';
import { useResidencyCapabilities } from '../../lib/capabilities';
import type { Attendance } from '../../api/types';
import ExcuseAbsenceModal from './ExcuseAbsenceModal';

export function ExcuseAbsenceButton({ record }: { record: Attendance }) {
  const { canExcuseAttendance } = useResidencyCapabilities();
  const [open, setOpen] = useState(false);
  if (!canExcuseAttendance || record.status !== 'absent') return null;

  return (
    <>
      <Btn
        $variant="ghost"
        $size="sm"
        title="Sababli qilish"
        aria-label={`${record.resident?.fullName ?? 'Rezident'} — ${record.date.slice(0, 10)} — sababli qilish`}
        onClick={() => setOpen(true)}
      >
        <MdCheckCircle />
      </Btn>
      {open && <ExcuseAbsenceModal record={record} onClose={() => setOpen(false)} />}
    </>
  );
}
