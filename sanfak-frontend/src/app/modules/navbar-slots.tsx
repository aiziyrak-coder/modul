import { Component, type ErrorInfo, type ReactNode } from 'react';
import { NotificationBellSlot } from '@/modules/notifications/notifications.navbar-slot';

class SlotBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Navbar slot crashed:', error, info.componentStack);
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function NavbarSlots() {
  return (
    <SlotBoundary>
      <NotificationBellSlot />
    </SlotBoundary>
  );
}
