/**
 * WhatsApp Markdown Formatter
 * Helper to clean and format text before sending to WhatsApp gateways (Fonnte/Wablas).
 * - Converts double asterisks (**text**) to WhatsApp bold (*text*).
 * - Converts Markdown headers (### Header) to WhatsApp bold (*Header*).
 * - Converts Markdown strikethrough (~~text~~) to WhatsApp strikethrough (~text~).
 * - Converts Markdown links [text](url) to readable WhatsApp format: text (url).
 * - Cleans up redundant spaces and collapses excessive consecutive blank lines.
 */
export function formatWhatsAppText(text: string): string {
  if (!text || typeof text !== "string") return "";

  let formatted = text;

  // 1. Convert Markdown headers (# Header, ## Header, ### Header, etc.) to WhatsApp bold (*Header*)
  formatted = formatted.replace(/^[ \t]*#{1,6}[ \t]+(.+?)[ \t]*$/gm, "*$1*");

  // 2. Convert bold italic (***text*** or ___text___) to (*_text_*)
  formatted = formatted.replace(/\*\*\*(.*?)\*\*\*/g, "*_$1_*");
  formatted = formatted.replace(/___(.*?)___/g, "*_$1_*");

  // 3. Convert Markdown bold (**text**) to WhatsApp bold (*text*)
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, "*$1*");

  // 4. Convert Markdown strikethrough (~~text~~) to WhatsApp strikethrough (~text~)
  formatted = formatted.replace(/~~(.*?)~~/g, "~$1~");

  // 5. Convert Markdown links [label](url) to readable format: label (url)
  formatted = formatted.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_match, label, url) => {
    if (label.trim().toLowerCase() === url.trim().toLowerCase()) {
      return url;
    }
    return `${label} (${url})`;
  });

  // 6. Clean trailing whitespace per line
  formatted = formatted
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n");

  // 7. Collapse 3 or more consecutive blank lines into at most 2 newlines (1 empty line)
  formatted = formatted.replace(/\n{3,}/g, "\n\n");

  return formatted.trim();
}
