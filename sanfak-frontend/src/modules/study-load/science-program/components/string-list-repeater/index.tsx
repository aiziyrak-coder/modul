import { useRef } from 'react';
import type { ClipboardEvent, KeyboardEvent } from 'react';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Form, Input, Typography } from 'antd';
import { useField } from 'formik';
import { useTranslation } from '@/shared/lib/i18n';
import { MAX_LIST_ITEMS, MAX_LIST_ITEM_LENGTH, splitPastedItems } from '../../lib/list-items';
import { ItemIndex, ItemList, ItemRow } from './style';

interface IProps {
  name: string;
  label: string;
  placeholder?: string;
  hint?: string;
}

const StringListRepeater = ({ name, label, placeholder, hint }: IProps) => {
  const { t } = useTranslation();
  const [field, meta, helpers] = useField<string[]>(name);
  const listRef = useRef<HTMLDivElement>(null);
  const stored = Array.isArray(field.value) ? field.value : [];
  const items = stored.length > 0 ? stored : [''];
  const filled = items.filter((s) => s.trim().length > 0).length;
  const error = meta.touched && meta.error ? t(meta.error) : undefined;
  const canAdd = items.length < MAX_LIST_ITEMS;

  const focusRow = (idx: number) => {
    window.setTimeout(() => {
      listRef.current?.querySelector<HTMLTextAreaElement>(`textarea[data-row="${idx}"]`)?.focus();
    }, 0);
  };

  const replaceAt = (idx: number, replacement: string[]) => {
    const room = MAX_LIST_ITEMS - (items.length - 1);
    const chunk = replacement.slice(0, Math.max(room, 1));
    void helpers.setValue([...items.slice(0, idx), ...chunk, ...items.slice(idx + 1)]);
    focusRow(idx + chunk.length - 1);
  };

  const setAt = (idx: number, val: string) => {
    const next = [...items];
    next[idx] = val;
    void helpers.setValue(next);
  };
  const removeAt = (idx: number) => {
    const next = items.filter((_, i) => i !== idx);
    void helpers.setValue(next.length > 0 ? next : ['']);
  };
  const handleAdd = () => {
    if (!canAdd) return;
    void helpers.setValue([...items, '']);
    focusRow(items.length);
  };
  const handleEnter = (idx: number, e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.shiftKey) return;
    e.preventDefault();
    if (canAdd) replaceAt(idx, [items[idx] ?? '', '']);
  };
  const handlePaste = (idx: number, e: ClipboardEvent<HTMLTextAreaElement>) => {
    const parts = splitPastedItems(e.clipboardData.getData('text'));
    if (parts.length <= 1) return;
    e.preventDefault();
    const current = items[idx] ?? '';
    replaceAt(idx, current.trim().length > 0 ? [current, ...parts] : parts);
  };

  const extra = [hint ? t(hint) : '', t('scienceProgram.v142.common.enterAddsItem')]
    .filter(Boolean)
    .join(' ');

  return (
    <Form.Item
      label={
        <span>
          {t(label)}{' '}
          <Typography.Text type="secondary">
            ({filled} {t('scienceProgram.v142.common.items')})
          </Typography.Text>
        </span>
      }
      extra={extra}
      validateStatus={error ? 'error' : ''}
      help={error}
    >
      <div>
        <ItemList ref={listRef} data-testid={`list-${name}`}>
          {items.map((val, idx) => (
            <ItemRow key={idx}>
              <ItemIndex>{idx + 1}.</ItemIndex>
              <Input.TextArea
                data-row={idx}
                value={val}
                maxLength={MAX_LIST_ITEM_LENGTH}
                autoSize={{ minRows: 1, maxRows: 6 }}
                placeholder={t(placeholder ?? 'scienceProgram.v142.common.itemPlaceholder')}
                aria-label={`${t(label)} ${idx + 1}`}
                onChange={(e) => setAt(idx, e.target.value)}
                onPressEnter={(e) => handleEnter(idx, e)}
                onPaste={(e) => handlePaste(idx, e)}
                onBlur={() => helpers.setTouched(true)}
              />
              <Button
                type="text"
                danger
                title={t('studyLoad.common.delete')}
                aria-label={t('studyLoad.common.delete')}
                icon={<DeleteOutlined />}
                onClick={() => removeAt(idx)}
              />
            </ItemRow>
          ))}
        </ItemList>
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          disabled={!canAdd}
          onClick={handleAdd}
          style={{ marginTop: 12 }}
        >
          {t('scienceProgram.v142.common.addItem')}
        </Button>
      </div>
    </Form.Item>
  );
};

export default StringListRepeater;
