import type { CSSProperties } from 'react';
import type { CertTemplate } from '../../model/course-type.types';
import { CERT_PREVIEWS } from './previews';

interface Props {
  template: CertTemplate;
  style?: CSSProperties;
  radius?: number;
}

export default function CertTemplatePreview({ template, style, radius = 6 }: Props) {
  return (
    <img
      src={CERT_PREVIEWS[template]}
      alt={`Shablon ${template}`}
      style={{
        width: '100%',
        height: 'auto',
        display: 'block',
        borderRadius: radius,
        border: '1px solid var(--color-border-soft, #eef1f5)',
        ...style,
      }}
    />
  );
}
