import { Modal as AntModal } from 'antd';
import type { ModalProps } from 'antd';
import { ScrollArea } from './style';

export default function Modal({ children, centered = true, ...props }: ModalProps) {
  return (
    <AntModal centered={centered} {...props}>
      <ScrollArea>{children}</ScrollArea>
    </AntModal>
  );
}
