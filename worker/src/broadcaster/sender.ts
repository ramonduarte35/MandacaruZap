import { WASocket } from '@whiskeysockets/baileys';
import axios from 'axios';

export function isTelegramId(id: string): boolean {
  const cleanId = id.trim();
  return cleanId.startsWith('tg:') || cleanId.startsWith('-100') || (cleanId.startsWith('-') && !isNaN(Number(cleanId))) || cleanId.startsWith('@');
}

/**
 * Envia uma mensagem (imagem + legenda ou apenas texto) para múltiplos grupos do WhatsApp e/ou Telegram.
 * Implementa a funcionalidade de mencionar todos os membros do grupo para WhatsApp.
 */
export async function broadcastMessage(
  instanceId: string,
  sock: WASocket | null | undefined,
  destGroupIds: string[],
  messageText: string,
  imageUrl?: string,
  telegramBotToken?: string | null,
  mentionEveryone: boolean = true
): Promise<void> {
  for (const jid of destGroupIds) {
    const cleanJid = jid.trim();
    if (!cleanJid) continue;

    try {
      if (isTelegramId(cleanJid)) {
        // Envio para o Telegram
        if (!telegramBotToken) {
          console.warn(`[Broadcaster] Telegram destination "${cleanJid}" skipped: telegramBotToken is not configured.`);
          continue;
        }

        // Remove o prefixo tg: se houver
        const targetId = cleanJid.startsWith('tg:') ? cleanJid.substring(3) : cleanJid;
        console.log(`[Broadcaster] Sending message to Telegram chat ${targetId}...`);

        if (imageUrl) {
          try {
            await axios.post(`https://api.telegram.org/bot${telegramBotToken}/sendPhoto`, {
              chat_id: targetId,
              photo: imageUrl,
              caption: messageText,
              parse_mode: 'Markdown'
            });
            console.log(`[Broadcaster] Message with image sent successfully to Telegram ${targetId}`);
            continue;
          } catch (tgMediaError) {
            console.warn(`[Broadcaster] Failed to send Telegram photo to ${targetId}. Falling back to text message.`, tgMediaError);
          }
        }

        // Fallback para mensagem de texto no Telegram
        await axios.post(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
          chat_id: targetId,
          text: imageUrl ? `${messageText}\n\n🔗 ${imageUrl}` : messageText,
          parse_mode: 'Markdown'
        });
        console.log(`[Broadcaster] Text message sent successfully to Telegram ${targetId}`);

      } else {
        // Envio para o WhatsApp
        if (!sock) {
          console.warn(`[Broadcaster] WhatsApp destination "${cleanJid}" skipped: WhatsApp socket is not connected.`);
          continue;
        }

        console.log(`[Broadcaster] Preparing broadcast to WhatsApp group ${cleanJid}...`);

        // 1. Obtém metadados do grupo para coletar todos os participantes se for mencionar todos
        let participants: string[] = [];
        let textWithMention = messageText;

        if (mentionEveryone) {
          try {
            const groupMetadata = await sock.groupMetadata(cleanJid);
            participants = groupMetadata.participants.map(p => p.id);
            textWithMention = `📢 @everyone\n\n${messageText}`;
          } catch (metaErr) {
            console.warn(`[Broadcaster] Failed to fetch group metadata for ${cleanJid}. Cannot mention everyone.`, metaErr);
          }
        }

        // 2. Se houver imagem, envia como mensagem de mídia com a copy na legenda
        if (imageUrl) {
          try {
            await sock.sendMessage(cleanJid, {
              image: { url: imageUrl },
              caption: textWithMention,
              ...(mentionEveryone && participants.length > 0 ? { mentions: participants } : {})
            });
            console.log(`[Broadcaster] Message with image sent successfully to WhatsApp ${cleanJid}`);
            continue;
          } catch (mediaError) {
            console.warn(`[Broadcaster] Failed to send image to WhatsApp ${cleanJid}. Falling back to text-only message.`, mediaError);
          }
        }

        // 3. Fallback ou envio textual (caso não exista imagem ou ocorra erro)
        await sock.sendMessage(cleanJid, {
          text: textWithMention,
          ...(mentionEveryone && participants.length > 0 ? { mentions: participants } : {})
        });
        
        console.log(`[Broadcaster] Text message sent successfully to WhatsApp ${cleanJid}`);
      }

    } catch (error) {
      console.error(`[Broadcaster] Failed to broadcast to ${cleanJid}:`, error);
      throw new Error(`Failed to broadcast to ${cleanJid}: ${String(error)}`);
    }
  }
}
