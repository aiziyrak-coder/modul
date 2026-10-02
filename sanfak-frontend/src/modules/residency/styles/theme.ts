export const theme = {
  colors: {
    primary: '#27AE60',
    primaryDark: '#1E8449',
    primaryLight: '#EAFAF1',

    secondary: '#2C3E50',
    accent: '#3498DB',

    text: '#2C3E50',
    textMuted: '#7F8C8D',
    textLight: '#BDC3C7',

    bg: '#F4F6F9',
    white: '#FFFFFF',

    border: '#E8ECEF',
    borderDark: '#D5D8DC',

    success: '#27AE60',
    successLight: '#EAFAF1',
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
  },
  fonts: {
    main: "'Inter', 'Segoe UI', -apple-system, sans-serif",
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
  },
  header: {
    height: '64px',
  },
} as const;

export type AppTheme = typeof theme;
