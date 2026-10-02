import { type ComponentType } from 'react';
import { TeacherChat } from '../teacher-chat';

export function withTeacherChat(Page: ComponentType): ComponentType {
  return function TeacherPageWithChat() {
    return (
      <>
        <Page />
        <TeacherChat />
      </>
    );
  };
}
