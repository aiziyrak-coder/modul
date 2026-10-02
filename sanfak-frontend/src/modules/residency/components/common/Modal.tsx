import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import styled from 'styled-components';
import { MdClose } from '../../icons';

const openStack: object[] = [];
const BASE_Z = 1000;
const LAYER_STEP = 10;

const Overlay = styled.div<{ $z: number }>`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: ${({ $z }) => $z};
  padding: 16px;
`;

const Box = styled.div<{ $width?: string }>`
  background: ${({ theme }) => theme.colors.white};
  border-radius: 14px;
  box-shadow: ${({ theme }) => theme.shadow.lg};
  width: ${({ $width }) => $width || '460px'};
  max-width: calc(100vw - 32px);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  flex-shrink: 0;
`;

const HeadTitle = styled.h3`
  font-size: 15px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

const CloseBtn = styled.button`
  width: 30px;
  height: 30px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: ${({ theme }) => theme.colors.textMuted};
  transition: background 0.15s;
  &:hover {
    background: ${({ theme }) => theme.colors.bg};
  }
`;

export const ModalBody = styled.div`
  padding: 20px;
  overflow-y: auto;
  flex: 1;
`;

export const ModalFooter = styled.div`
  padding: 14px 20px;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  flex-shrink: 0;
`;

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children?: ReactNode;
  width?: string;
}

export default function Modal({ open, onClose, title = '', children, width }: ModalProps) {
  const idRef = useRef<object>({});
  const [depth, setDepth] = useState(0);

  useEffect(() => {
    if (!open) return undefined;
    const id = idRef.current;
    openStack.push(id);
    setDepth(openStack.length);
    return () => {
      const i = openStack.indexOf(id);
      if (i >= 0) openStack.splice(i, 1);
    };
  }, [open]);

  if (!open) return null;

  return (
    <Overlay $z={BASE_Z + depth * LAYER_STEP} onClick={onClose}>
      <Box $width={width} onClick={(e) => e.stopPropagation()}>
        {title !== '' && (
          <Head>
            <HeadTitle>{title}</HeadTitle>
            <CloseBtn onClick={onClose} aria-label="Yopish">
              <MdClose size={18} />
            </CloseBtn>
          </Head>
        )}
        {children}
      </Box>
    </Overlay>
  );
}
