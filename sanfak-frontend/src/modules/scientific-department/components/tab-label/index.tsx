import { CheckCircleOutlined } from '@ant-design/icons';

export default function TabLabel({ text, done }: { text: string; done: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {text}
      {done ? (
        <CheckCircleOutlined aria-hidden style={{ color: 'var(--brand-primary)', fontSize: 14 }} />
      ) : null}
    </span>
  );
}
