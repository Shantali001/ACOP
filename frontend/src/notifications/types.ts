export type NotificationItem = { id: string; message: string; read: boolean; createdAt: string };
export type NotificationsResponse = { unreadCount: number; data: NotificationItem[] };