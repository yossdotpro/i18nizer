import { MessagesFormat } from "../../types/config.js";

export const INLANG_MESSAGE_FORMAT_SCHEMA_URL =
  "https://inlang.com/schema/inlang-message-format";

export function formatMessageKey(
  key: string,
  format: MessagesFormat = "json"
): string {
  if (format !== "inlang-message-format") {
    return key;
  }

  return key
    .replaceAll(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replaceAll(/[\s-]+/g, "_")
    .toLowerCase();
}
