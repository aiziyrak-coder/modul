export interface ChatUser {
  id: string;
  name: string;
  photo: string | null;
}

export interface ChatConversation {
  userId: string;
  user: ChatUser;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

export interface ChatMessage {
  id: string;
  senderId: string | null;
  senderName: string | null;
  receiverId: string | null;
  message: string;
  fileUrl: string | null;
  fileType: string | null;
  readAt: string | null;
  createdAt: string | null;
  mine: boolean;
}
