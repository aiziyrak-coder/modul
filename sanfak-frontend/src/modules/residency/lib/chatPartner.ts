export interface ChatPartner {
  id: string;
  name: string;
}

export interface ConversationLike {
  userId: string;
  user: { name?: string | null };
}

export const UNKNOWN_PARTNER = 'Noma’lum foydalanuvchi';

export function autoChatPartner(
  isStudent: boolean,
  picked: ChatPartner | null,
  options: readonly ChatPartner[],
  conversations: readonly ConversationLike[],
): ChatPartner | null {
  if (!isStudent || picked) return null;

  const supervisor = options[0];
  if (supervisor) return supervisor;

  const first = conversations[0];
  if (first?.userId) return { id: first.userId, name: first.user.name || UNKNOWN_PARTNER };

  return null;
}
