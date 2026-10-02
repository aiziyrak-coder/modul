import { theme as antdTheme, type ThemeConfig } from 'antd';
import { appConfig, type ThemeMode } from '../config';

export function buildTheme(mode: ThemeMode): ThemeConfig {
  const primary = appConfig.ui.primaryColor;

  return {
    cssVar: true,
    algorithm: mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: primary,
      colorSuccess: '#34C18C',
      colorError: '#F04438',
      colorWarning: '#F0C000',
      colorInfo: '#4A82C8',
      colorTextBase: '#121926',
      colorTextSecondary: '#697586',
      colorBorder: '#E3E8EF',
      colorBorderSecondary: '#EEF2F6',
      colorBgContainer: '#FFFFFF',
      colorBgLayout: '#F5F7FB',
      colorBgElevated: '#FFFFFF',

      fontFamily:
        "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontSize: 14,
      fontSizeSM: 12,
      fontSizeLG: 16,
      fontSizeHeading1: 28,
      fontSizeHeading2: 24,
      fontSizeHeading3: 20,
      fontSizeHeading4: 16,
      fontSizeHeading5: 14,
      fontWeightStrong: 600,

      borderRadius: 8,
      borderRadiusLG: 12,
      borderRadiusSM: 4,
      borderRadiusXS: 2,

      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      boxShadowSecondary: '9px 8px 34px 0 rgba(47, 66, 108, 0.22)',
      boxShadowTertiary: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',

      controlHeight: 44,
      controlHeightSM: 28,
      controlHeightLG: 50,
      controlHeightXS: 22,

      motionUnit: 0.08,
      motionEaseInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    },
    components: {
      Button: {
        controlHeight: 44,
        borderRadius: 10,
        fontWeight: 500,
      },
      Input: {
        controlHeight: 44,
        borderRadius: 8,
        colorBorder: '#E3E8EF',
        activeBorderColor: primary,
        hoverBorderColor: primary,
      },
      Select: {
        controlHeight: 44,
        borderRadius: 8,
      },
      DatePicker: {
        controlHeight: 44,
        borderRadius: 8,
      },
      InputNumber: {
        controlHeight: 44,
        borderRadius: 8,
      },
      Card: {
        borderRadiusLG: 12,
        boxShadowTertiary: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      },
      Table: {
        headerBg: '#EEF2F6',
        headerColor: '#697586',
        headerSplitColor: 'transparent',
        rowHoverBg: '#F9FAFB',
        borderColor: '#E4E7EC',
        cellPaddingBlock: 14,
      },
      Layout: {
        siderBg: '#E8ECF3',
        headerBg: '#F5F7FB',
        bodyBg: '#F5F7FB',
        headerHeight: 64,
      },
      Menu: {
        itemBorderRadius: 10,
        itemHeight: 44,
        itemColor: '#697586',
        itemActiveBg: 'rgba(52, 193, 140, 0.10)',
        itemSelectedBg: primary,
        itemSelectedColor: '#FFFFFF',
        itemHoverBg: 'rgba(52, 193, 140, 0.10)',
      },
      Modal: {
        borderRadiusLG: 16,
        headerBg: '#FFFFFF',
        titleFontSize: 18,
        titleColor: '#121926',
      },
      Tag: {
        borderRadiusSM: 6,
        fontSizeSM: 12,
      },
      Form: {
        labelFontSize: 14,
        labelColor: '#121926',
        verticalLabelPadding: '0 0 6px',
      },
      Badge: {
        dotSize: 8,
      },
      Tabs: {
        inkBarColor: primary,
        itemActiveColor: primary,
        itemSelectedColor: primary,
        itemHoverColor: primary,
      },
    },
  };
}
