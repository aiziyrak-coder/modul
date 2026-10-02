export default function StageDesc({ label, date }: { label: string; date?: string | null }) {
  if (!date) return <>{label}</>;

  return (
    <>
      {label ? <div>{label}</div> : null}
      <div style={{ whiteSpace: 'nowrap' }}>{date}</div>
    </>
  );
}
