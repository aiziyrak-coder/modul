import { describe, expect, it } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { Formik } from 'formik';
import { Form } from 'antd';
import { renderWithProviders } from '@/test/test-utils';
import { MAX_LIST_ITEMS, splitPastedItems } from '../../lib/list-items';
import StringListRepeater from './index';

function renderList(initial: string[]) {
  return renderWithProviders(
    <Formik initialValues={{ techMethods: initial }} onSubmit={() => undefined}>
      <Form layout="vertical">
        <StringListRepeater name="techMethods" label="scienceProgram.v142.field.techMethods" />
      </Form>
    </Formik>,
  );
}

const boxes = () => screen.getAllByRole('textbox') as HTMLTextAreaElement[];
const values = () => boxes().map((b) => b.value);
const addButton = () => screen.getByRole('button', { name: /Band qo'shish/ });

describe('StringListRepeater — band-ma-band ro\'yxat (DOM)', () => {
  it('har band alohida raqamlangan qator, sanoq yorliqda', () => {
    renderList(['Ma\'ruza', 'Amaliy mashg\'ulot']);

    expect(values()).toEqual(['Ma\'ruza', 'Amaliy mashg\'ulot']);
    expect(screen.getByText('1.')).toBeInTheDocument();
    expect(screen.getByText('2.')).toBeInTheDocument();
    expect(screen.getByText('(2 ta band)')).toBeInTheDocument();
    expect(screen.queryByText(/Har qator/)).not.toBeInTheDocument();
  });

  it('bo\'sh ro\'yxat — bitta bo\'sh kiritish qatori, sanoq 0', () => {
    renderList([]);

    expect(values()).toEqual(['']);
    expect(screen.getByText('(0 ta band)')).toBeInTheDocument();
  });

  it('«Band qo\'shish» yangi bo\'sh qator qo\'shadi va fokuslaydi', async () => {
    renderList(['a']);

    await act(async () => {
      fireEvent.click(addButton());
    });

    expect(values()).toEqual(['a', '']);
    await waitFor(() => expect(document.activeElement).toBe(boxes()[1]));
  });

  it('o\'chirish — bandni olib tashlaydi; oxirgisi o\'chsa bo\'sh qator qoladi', async () => {
    renderList(['a', 'b']);
    const del = () => screen.getAllByRole('button', { name: "O'chirish" });

    await act(async () => {
      fireEvent.click(del()[1]!);
    });
    expect(values()).toEqual(['a']);

    await act(async () => {
      fireEvent.click(del()[0]!);
    });
    expect(values()).toEqual(['']);
  });

  it('Enter — joriy banddan keyin yangi band; Shift+Enter — qo\'shmaydi', async () => {
    renderList(['a', 'b']);

    await act(async () => {
      fireEvent.keyDown(boxes()[0]!, { key: 'Enter', code: 'Enter', keyCode: 13 });
    });
    expect(values()).toEqual(['a', '', 'b']);

    await act(async () => {
      fireEvent.keyDown(boxes()[0]!, { key: 'Enter', code: 'Enter', keyCode: 13, shiftKey: true });
    });
    expect(values()).toEqual(['a', '', 'b']);
  });

  it('ko\'p qatorli yopishtirish — har qator alohida band (bo\'sh qatorlar tashlanadi)', async () => {
    renderList(['', 'z']);

    await act(async () => {
      fireEvent.paste(boxes()[0]!, {
        clipboardData: { getData: () => 'birinchi\r\n  ikkinchi  \n\nuchinchi' },
      });
    });
    expect(values()).toEqual(['birinchi', 'ikkinchi', 'uchinchi', 'z']);
  });

  it('to\'lgan bandga yopishtirilsa — mavjud matn saqlanadi, bandlar ostiga tushadi', async () => {
    renderList(['bor']);

    await act(async () => {
      fireEvent.paste(boxes()[0]!, { clipboardData: { getData: () => 'x\ny' } });
    });
    expect(values()).toEqual(['bor', 'x', 'y']);
  });

  it(`backend chegarasi (${MAX_LIST_ITEMS}) — qo'shish tugmasi o'chadi`, () => {
    renderList(Array.from({ length: MAX_LIST_ITEMS }, (_, i) => `band ${i + 1}`));

    expect(boxes()).toHaveLength(MAX_LIST_ITEMS);
    expect(addButton()).toBeDisabled();
  });
});

describe('splitPastedItems', () => {
  it('CRLF/LF bo\'yicha bo\'ladi, trim qiladi, bo\'sh qatorlarni tashlaydi', () => {
    expect(splitPastedItems(' a \r\nb\n\n c\n')).toEqual(['a', 'b', 'c']);
    expect(splitPastedItems('yagona')).toEqual(['yagona']);
    expect(splitPastedItems('')).toEqual([]);
  });
});
