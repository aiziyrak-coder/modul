import { memo, useRef, useState, useEffect, type ReactNode } from 'react';
import { PlusOutlined, MinusOutlined, DownOutlined } from '@ant-design/icons';
import styled from 'styled-components';

const AccordionWrap = styled.div`
  background: var(--color-bg, #fff);
  border: 1px solid var(--color-border, #e3e8ef);
  border-radius: var(--radius-md, 8px);
  overflow: hidden;
`;

const AccHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  cursor: pointer;
  user-select: none;

  &:hover { background: var(--color-border-soft, #eef2f6); }
`;

const AccTitle = styled.span`
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text, #121926);
`;

const AccIcon = styled.span<{ $open: boolean }>`
  font-size: 16px;
  color: var(--color-text-soft, #697586);
  transition: transform 0.25s;
  transform: ${({ $open }) => ($open ? 'rotate(45deg)' : 'rotate(0deg)')};
`;

const AccBody = styled.div<{ $height: number }>`
  max-height: ${({ $height }) => $height}px;
  overflow: hidden;
  transition: max-height 0.3s ease;
`;

const AccContent = styled.div`
  padding: 0 20px 20px;
`;

export interface AccordionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export const Accordion = memo(function Accordion({
  title,
  children,
  defaultOpen = false,
}: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (!bodyRef.current) return;
    const updateHeight = () => {
      if (bodyRef.current) setHeight(bodyRef.current.scrollHeight);
    };
    updateHeight();
    const ro = new ResizeObserver(updateHeight);
    ro.observe(bodyRef.current);
    return () => ro.disconnect();
  }, [children]);

  return (
    <AccordionWrap>
      <AccHeader onClick={() => setOpen((v) => !v)}>
        <AccTitle>{title}</AccTitle>
        <AccIcon $open={open}>
          {open ? <MinusOutlined /> : <PlusOutlined />}
        </AccIcon>
      </AccHeader>
      <AccBody $height={open ? height : 0}>
        <AccContent ref={bodyRef}>{children}</AccContent>
      </AccBody>
    </AccordionWrap>
  );
});

const SingleWrap = styled.div<{ $active: boolean }>`
  border: 1px solid
    ${({ $active }) =>
      $active ? 'var(--brand-primary, #37cb94)' : 'var(--color-border, #e3e8ef)'};
  border-radius: var(--radius-md, 8px);
  overflow: hidden;
  transition: border-color 0.2s;
`;

const SingleHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  cursor: pointer;
  user-select: none;
`;

const ChevronIcon = styled.span<{ $active: boolean }>`
  font-size: 14px;
  color: var(--color-text-soft, #697586);
  transition: transform 0.25s;
  transform: ${({ $active }) => ($active ? 'rotate(180deg)' : 'rotate(0deg)')};
`;

const SingleBody = styled.div<{ $height: number }>`
  max-height: ${({ $height }) => $height}px;
  overflow: hidden;
  transition: max-height 0.3s ease;
`;

const SingleContent = styled.div`
  padding: 0 16px 16px;
`;

export interface SingleAccordionProps {
  headChild: ReactNode;
  children: ReactNode;
  active: boolean;
  setOpen: (id: string, open: boolean) => void;
  id: string;
}

export const SingleAccordion = memo(function SingleAccordion({
  headChild,
  children,
  active,
  setOpen,
  id,
}: SingleAccordionProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (!contentRef.current) return;
    const update = () => {
      if (contentRef.current) setHeight(contentRef.current.scrollHeight);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(contentRef.current);
    return () => ro.disconnect();
  }, [children]);

  return (
    <SingleWrap $active={active}>
      <SingleHeader onClick={() => setOpen(id, !active)}>
        {headChild}
        <ChevronIcon $active={active}>
          <DownOutlined />
        </ChevronIcon>
      </SingleHeader>
      <SingleBody $height={active ? height : 0}>
        <SingleContent ref={contentRef}>{children}</SingleContent>
      </SingleBody>
    </SingleWrap>
  );
});
