import type { ReactElement } from 'react';
import styled from 'styled-components';
import { Dropdown } from 'antd';
import { DownOutlined } from '@ant-design/icons';
import { LANG_LABELS, SUPPORTED_LANGS, useTranslation, type Lang } from '@/shared/lib/i18n';
import { FlagEn, FlagRu, FlagUz } from './flags';

const LANG_FLAGS: Record<string, (props: { size?: number }) => ReactElement> = {
  uz: FlagUz,
  ru: FlagRu,
  en: FlagEn,
};

const Trigger = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--color-border, #e3e8ef);
  border-radius: var(--radius-md, 8px);
  background: transparent;
  cursor: pointer;
  font-family: Inter, sans-serif;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text, #121926);
  transition: background 0.15s, border-color 0.15s;

  &:hover {
    background: var(--color-border-soft, #eef2f6);
    border-color: var(--color-text-mute, #9aa3b2);
  }
`;

const FlagIcon = styled.span`
  display: inline-flex;
  align-items: center;
  line-height: 0;
  svg {
    display: block;
    border-radius: 2px;
  }
`;

const MenuItem = styled.span`
  display: flex;
  align-items: center;
  gap: 8px;
`;

export function LanguageSwitcher() {
  const { lang, changeLanguage } = useTranslation();
  const CurrentFlag = LANG_FLAGS[lang];

  return (
    <Dropdown
      menu={{
        selectedKeys: [lang],
        items: SUPPORTED_LANGS.map((code) => {
          const Flag = LANG_FLAGS[code];
          return {
            key: code,
            label: (
              <MenuItem>
                {Flag ? <Flag size={20} /> : null}
                {LANG_LABELS[code]}
              </MenuItem>
            ),
          };
        }),
        onClick: ({ key }) => changeLanguage(key as Lang),
      }}
      placement="bottomRight"
    >
      <Trigger aria-label={LANG_LABELS[lang]}>
        {CurrentFlag ? (
          <FlagIcon>
            <CurrentFlag />
          </FlagIcon>
        ) : null}
        <span>{lang.toUpperCase()}</span>
        <DownOutlined style={{ fontSize: 10, color: 'var(--color-text-mute)' }} />
      </Trigger>
    </Dropdown>
  );
}
