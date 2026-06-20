import { proto, WASocket } from '@whiskeysockets/baileys';
import prisma from '../lib/prisma';
import { scrapeProductData } from '../processor/scraper';
import { convertToAffiliateLink, expandUrl } from '../processor/affiliate';
import { broadcastMessage } from '../broadcaster/sender';

// Expressões regulares para links da Amazon, Shopee e Mercado Livre
const SUPPORTED_DOMAINS_REGEX = /(https?:\/\/[^\s]*?(?:amazon\.com\.br|amzn\.to|shopee\.com\.br|shp\.ee|mercadolivre\.com\.br|mercadolivre\.co|produto\.mercadolivre\.com\.br|meli\.la)[^\s]*)/gi;

/**
   * Extrai o texto contido em uma mensagem do Baileys
   */
function getMessageText(message: proto.IWebMessageInfo): string {
  if (!message.message) return '';
  
  let msg = message.message;
  
  // Recursivamente desembrulha mensagens aninhadas (como ephemeral, view once, etc.)
  while (msg) {
    if (msg.ephemeralMessage?.message) {
      msg = msg.ephemeralMessage.message;
    } else if (msg.viewOnceMessage?.message) {
      msg = msg.viewOnceMessage.message;
    } else if (msg.viewOnceMessageV2?.message) {
      msg = msg.viewOnceMessageV2.message;
    } else if (msg.documentWithCaptionMessage?.message) {
      msg = msg.documentWithCaptionMessage.message;
    } else {
      break;
    }
  }
  
  const conversation = msg.conversation;
  const extendedText = msg.extendedTextMessage?.text;
  const imageCaption = msg.imageMessage?.caption;
  const videoCaption = msg.videoMessage?.caption;
  const documentCaption = msg.documentMessage?.caption;
  
  return conversation || extendedText || imageCaption || videoCaption || documentCaption || '';
}

/**
 * Manipula mensagens recebidas e faz o roteamento dos links de afiliados
 */
export async function handleIncomingMessage(
  instanceId: string,
  sock: WASocket,
  message: proto.IWebMessageInfo
): Promise<void> {
  const fromJid = message.key.remoteJid;
  if (!fromJid) {
    console.log(`[Listener] Message ${message.key.id} skipped: remoteJid is null/undefined.`);
    return;
  }

  // Só escuta mensagens vindas de grupos (JIDs terminando com @g.us)
  const isGroup = fromJid.endsWith('@g.us');
  if (!isGroup) {
    console.log(`[Listener] Message ${message.key.id} from ${fromJid} skipped: not a group message.`);
    return;
  }

  // Verifica se o grupo de origem está cadastrado em algum mapeamento ativo para esta instância
  const mappings = await prisma.groupMapping.findMany({
    where: {
      instanceId: instanceId,
      sourceGroupId: fromJid,
      isActive: true
    },
    include: {
      user: true
    }
  });

  if (mappings.length === 0) {
    console.log(`[Listener] Message ${message.key.id} from group ${fromJid} skipped: no active mappings found for this group.`);
    return;
  }

  const text = getMessageText(message);
  if (!text) {
    console.log(`[Listener] Message ${message.key.id} from group ${fromJid} skipped: no text content found.`);
    return;
  }

  // Busca links suportados
  const urls = text.match(SUPPORTED_DOMAINS_REGEX);
  if (!urls || urls.length === 0) {
    console.log(`[Listener] Message ${message.key.id} from group ${fromJid} skipped: did not match domain regex. Text content was: "${text.substring(0, 100)}..."`);
    return;
  }

  console.log(`[Listener] Found URLs in group ${fromJid}:`, urls);

  // Processa cada link encontrado na mensagem
  for (const originalUrl of urls) {
    for (const mapping of mappings) {
      try {
        console.log(`[Listener] Processing link for mapping: "${mapping.name}" / User: ${mapping.user.email}`);

        // 1. Expande a URL encurtada
        const expandedUrl = await expandUrl(originalUrl);

        // 2. Extração de Metadados (Scraping)
        const productData = await scrapeProductData(expandedUrl);

        // 3. Substituição dos IDs de Afiliados
        const convertedUrl = await convertToAffiliateLink(
          expandedUrl,
          mapping.user
        );

        // 3. Montagem da Copy
        const copy = buildCopy(productData, convertedUrl);

        // 4. Disparo (Broadcasting) para os grupos destino mapeados
        const destGroupsArray = mapping.destGroupIds.split(',').map(id => id.trim()).filter(Boolean);
        console.log(`[Listener] Broadcasting message for mapping ${mapping.id} to groups:`, destGroupsArray);
        
        await broadcastMessage(
          instanceId,
          sock,
          destGroupsArray,
          copy,
          productData.imageUrl || undefined
        );

        // 5. Salva log com status de sucesso
        await prisma.log.create({
          data: {
            originalUrl,
            convertedUrl,
            title: productData.title,
            price: productData.price,
            imageUrl: productData.imageUrl,
            status: 'SENT',
            sourceGroup: fromJid,
            destGroups: mapping.destGroupIds,
            userId: mapping.userId,
            instanceId: instanceId
          }
        });

      } catch (error) {
        console.error(`[Listener] Error processing link ${originalUrl}:`, error);

        // Salva log de falha
        await prisma.log.create({
          data: {
            originalUrl,
            status: 'FAILED',
            errorMessage: String(error),
            sourceGroup: fromJid,
            destGroups: mapping.destGroupIds,
            userId: mapping.userId,
            instanceId: instanceId
          }
        });
      }
    }
  }
}

/**
 * Formata o texto persuasivo final para envio no WhatsApp
 */
function buildCopy(
  product: { title: string; price: string; imageUrl: string },
  affiliateUrl: string
): string {
  const emojiTitle = '📦';
  const emojiOffer = '🔥';
  const emojiCheck = '✅';
  
  return `${emojiOffer} *SUPER OFERTA DETECTADA!* ${emojiOffer}\n\n` +
         `${emojiTitle} *Produto:* ${product.title}\n` +
         `💰 *Por Apenas:* ${product.price}\n\n` +
         `${emojiCheck} *Garanta o seu aqui:* ${affiliateUrl}\n\n` +
         `⚠️ _Preços sujeitos a alteração a qualquer momento._`;
}
