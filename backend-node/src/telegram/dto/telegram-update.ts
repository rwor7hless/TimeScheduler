/**
 * Shape of the JSON body Telegram POSTs to our webhook. Telegram's payload is
 * enormous and largely optional; we type only the fields we actually use
 * (message.text + chat.id) and accept anything else opaquely.
 *
 * Reference: https://core.telegram.org/bots/api#update
 */
export interface TelegramChat {
  id: number | string;
  type?: string;
  [key: string]: unknown;
}

export interface TelegramMessage {
  message_id?: number;
  text?: string;
  chat?: TelegramChat;
  from?: { id: number | string; [key: string]: unknown };
  [key: string]: unknown;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  [key: string]: unknown;
}
