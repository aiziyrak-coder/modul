import type { MouseEvent, ReactNode } from 'react';
import styled from 'styled-components';
import { MdClose } from '../../icons';

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose?: () => void;
  title?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  if (!open) return null;

  return (
    <Overlay onClick={onClose}>
      <Box onClick={(e: MouseEvent) => e.stopPropagation()}>
        <ModalHead>
          <ModalTitle>{title}</ModalTitle>
          <CloseBtn onClick={onClose}>
            <MdClose />
          </CloseBtn>
        </ModalHead>
        <ModalBody>{children}</ModalBody>
        {footer && <ModalFoot>{footer}</ModalFoot>}
      </Box>
    </Overlay>
  );
}

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
`;

const Box = styled.div`
  background: white;
  border-radius: ${({ theme }) => theme.radius.lg};
  width: 460px;
  max-width: calc(100vw - 32px);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: ${({ theme }) => theme.shadow.lg};
  overflow: hidden;
`;

const ModalHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const ModalTitle = styled.h3`
  font-size: 15px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

const CloseBtn = styled.button`
  width: 30px;
  height: 30px;
  border-radius: ${({ theme }) => theme.radius.sm};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: ${({ theme }) => theme.colors.textMuted};
  transition: all 0.15s;
  &:hover {
    background: ${({ theme }) => theme.colors.bg};
    color: ${({ theme }) => theme.colors.text};
  }
`;

const ModalBody = styled.div`
  padding: 20px;
  overflow-y: auto;
  flex: 1;
`;

const ModalFoot = styled.div`
  padding: 14px 20px;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  display: flex;
  gap: 10px;
  justify-content: flex-end;
`;
