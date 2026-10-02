export const theme = {
  colors: {
    primary: 'var(--brand-primary)',
    primaryDark: 'var(--brand-primary-hover)',
    primaryLight: 'var(--brand-primary-soft)',
    secondary: '#2C3E50',
    accent: '#3498DB',

    success: 'var(--brand-primary)',
    successLight: 'var(--brand-primary-soft)',
    successBorder: '#A9DFBF',

    warning: '#F39C12',
    warningLight: '#FEF9E7',
    warningBorder: '#FAD7A0',

    danger: '#E74C3C',
    dangerLight: '#FDEDEC',
    dangerBorder: '#F1948A',

    info: '#3498DB',
    infoLight: '#EBF5FB',
    infoBorder: '#AED6F1',

    white: '#FFFFFF',
    bg: '#F4F6F9',
    sidebar: '#FFFFFF',

    text: '#2C3E50',
    textMuted: '#7F8C8D',
    textLight: '#BDC3C7',

    border: '#E8ECEF',
    borderDark: '#D5D8DC',

    shadow: 'rgba(0, 0, 0, 0.06)',
    shadowMd: 'rgba(0, 0, 0, 0.10)',
  },
  fonts: {
    main: "'Inter', 'Segoe UI', sans-serif",
  },
  radius: {
    sm: '6px',
    md: '10px',
    lg: '14px',
    xl: '20px',
    full: '9999px',
  },
  shadow: {
    sm: '0 1px 4px rgba(0,0,0,0.06)',
    md: '0 4px 16px rgba(0,0,0,0.08)',
    lg: '0 8px 32px rgba(0,0,0,0.12)',
  },
  sidebar: {
    width: '240px',
    collapsedWidth: '64px',
  },
  header: {
    height: '64px',
  },
} as const;

export type AppTheme = typeof theme;

declare module 'styled-components' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface DefaultTheme extends AppTheme {}
}
