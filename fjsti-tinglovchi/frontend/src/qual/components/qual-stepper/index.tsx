import type { CSSProperties } from 'react';
import { CheckOutlined } from '@ant-design/icons';

interface Step {
  label: string;
}

export default function QualStepper({ steps, current }: { steps: Step[]; current: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
      {steps.map((step, idx) => {
        const stepNum = idx + 1;
        const done = stepNum < current;
        const active = stepNum === current;
        const isLast = idx === steps.length - 1;

        const circle: CSSProperties = {
          width: 32,
          height: 32,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14,
          fontWeight: 600,
          border: '2px solid',
          transition: 'all 0.2s ease',
          ...(done
            ? {
                background: 'var(--brand-primary, #37cb94)',
                borderColor: 'var(--brand-primary, #37cb94)',
                color: '#fff',
              }
            : active
              ? {
                  background: 'var(--color-bg, #fff)',
                  borderColor: 'var(--brand-primary, #37cb94)',
                  color: 'var(--brand-primary, #37cb94)',
                }
              : {
                  background: 'var(--color-bg, #fff)',
                  borderColor: 'var(--color-border, #e3e8ef)',
                  color: 'var(--color-text-mute, #9aa3b2)',
                }),
        };

        const label: CSSProperties = {
          fontSize: 12,
          fontWeight: 500,
          whiteSpace: 'nowrap',
          color: active
            ? 'var(--brand-primary, #37cb94)'
            : done
              ? 'var(--color-text, #121926)'
              : 'var(--color-text-mute, #9aa3b2)',
        };

        return (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', flex: isLast ? '0 0 auto' : 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={circle}>{done ? <CheckOutlined /> : stepNum}</div>
              <span style={label}>{step.label}</span>
            </div>
            {!isLast ? (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  margin: '0 12px 24px',
                  borderRadius: 2,
                  background: done ? 'var(--brand-primary, #37cb94)' : 'var(--color-border-soft, #eef2f6)',
                }}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
