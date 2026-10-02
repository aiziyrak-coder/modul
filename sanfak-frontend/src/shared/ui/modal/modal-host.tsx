import { CloseOutlined } from '@ant-design/icons';
import { Spin } from 'antd';
import { useEffect } from 'react';
import { useModalStore } from './modal-store';
import { Overlay, DrawerOverlay, Content, Header, Title, CloseBtn, Body } from './styles';

export function ModalHost() {
  const { show, animating, loading, config, hideModal } = useModalStore();
  const { right, title, withHeader, maxWidth, maxHeight, bodyPadding, overflow, body: BodyComponent } = config;

  useEffect(() => {
    if (!show) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (
        document.querySelector(
          '.ant-select-dropdown:not(.ant-select-dropdown-hidden),' +
            '.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)',
        )
      )
        return;
      hideModal();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [show, hideModal]);

  const OverlayEl = right ? DrawerOverlay : Overlay;

  return (
    <OverlayEl $show={show} onClick={(e) => e.target === e.currentTarget && hideModal()}>
      <Content $maxWidth={maxWidth} $animating={animating} $right={right}>
        {withHeader !== false && (
          <Header>
            <Title>{title ?? ''}</Title>
            <CloseBtn $right={right} type="button" onClick={hideModal}>
              <CloseOutlined />
            </CloseBtn>
          </Header>
        )}
        <Body
          $maxHeight={maxHeight}
          $right={right}
          $overflow={overflow}
          $bodyPadding={bodyPadding}
        >
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
              <Spin size="large" />
            </div>
          ) : (
            BodyComponent ? <BodyComponent /> : null
          )}
        </Body>
      </Content>
    </OverlayEl>
  );
}
