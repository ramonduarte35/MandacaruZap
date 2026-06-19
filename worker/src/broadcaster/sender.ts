import { WASocket } from '@whiskeysockets/baileys';

/**
 * Envia uma mensagem (imagem + legenda ou apenas texto) para múltiplos grupos do WhatsApp.
 * Implementa a funcionalidade de mencionar todos os membros do grupo.
 */
export async function broadcastMessage(
  instanceId: string,
  sock: WASocket,
  destGroupIds: string[],
  messageText: string,
  imageUrl?: string
): Promise<void> {
  for (const jid of destGroupIds) {
    try {
      console.log(`[Broadcaster] Preparing broadcast to group ${jid}...`);

      // 1. Obtém metadados do grupo para coletar todos os participantes
      const groupMetadata = await sock.groupMetadata(jid);
      const participants = groupMetadata.participants.map(p => p.id);

      // Adiciona uma chamada visível "@todos" e associa as menções aos IDs reais dos participantes
      const textWithMention = `📢 @everyone\n\n${messageText}`;

      // 2. Se houver imagem, envia como mensagem de mídia com a copy na legenda
      if (imageUrl) {
        try {
          await sock.sendMessage(jid, {
            image: { url: imageUrl },
            caption: textWithMention,
            mentions: participants
          });
          console.log(`[Broadcaster] Message with image sent successfully to ${jid}`);
          continue; // Envio realizado, passa para o próximo grupo
        } catch (mediaError) {
          console.warn(`[Broadcaster] Failed to send image to ${jid}. Falling back to text-only message.`, mediaError);
        }
      }

      // 3. Fallback ou envio textual (caso não exista imagem ou ocorra erro)
      await sock.sendMessage(jid, {
        text: textWithMention,
        mentions: participants
      });
      
      console.log(`[Broadcaster] Text message sent successfully to ${jid}`);

    } catch (error) {
      console.error(`[Broadcaster] Failed to broadcast to group ${jid} using instance ${instanceId}:`, error);
      throw new Error(`Failed to broadcast to group ${jid}: ${String(error)}`);
    }
  }
}
