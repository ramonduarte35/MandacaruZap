import { proto, WASocket } from '@whiskeysockets/baileys';
import prisma from '../lib/prisma';
import { scrapeProductData } from '../processor/scraper';
import { convertToAffiliateLink, expandUrl } from '../processor/affiliate';
import { broadcastMessage } from '../broadcaster/sender';

// Cache de controle de envio de alertas de expiração de cookies (userId -> timestamp)
const lastAlertMap = new Map<string, number>();

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
    // Tratamento de mensagens privadas para atualização de cookies do administrador
    const senderNumber = fromJid.split('@')[0];
    
    try {
      // Busca se existe algum usuário cadastrado que possua este número de telefone configurado para notificações
      const user = await prisma.user.findFirst({
        where: {
          cookieNotificationPhone: {
            contains: senderNumber
          }
        }
      });

      if (user) {
        const text = getMessageText(message).trim();
        
        // Detecta se a mensagem contém indícios de cookies
        const hasCookiePrefix = text.toLowerCase().startsWith('cookie:');
        const hasCookieIndicators = text.includes('ssid=') || text.includes('_csrf=') || text.includes('client_id=');

        if (hasCookiePrefix || hasCookieIndicators) {
          let cookieVal = text;
          if (hasCookiePrefix) {
            cookieVal = text.substring(7).trim();
          }

          // Atualiza o cookie no banco de dados
          await prisma.user.update({
            where: { id: user.id },
            data: { mercadolivreCookie: cookieVal }
          });

          // Envia resposta de sucesso pelo WhatsApp
          await sock.sendMessage(fromJid, {
            text: `✅ *MandacaruZap - Cookie Atualizado!*\n\nO novo cookie do Mercado Livre foi atualizado no sistema com sucesso. Ele será utilizado nas próximas gerações de links oficiais.`
          });
          
          console.log(`[Listener] Cookie do Mercado Livre atualizado via WhatsApp pelo administrador: ${user.email}`);
          return;
        }
      }
    } catch (dbErr) {
      console.error('[Listener] Erro ao tratar mensagem privada do admin para cookies:', dbErr);
    }

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

        // Verificar se os marketplaces correspondentes estão ativados no usuário
        const isAmazon = expandedUrl.includes('amazon.com.br') || originalUrl.includes('amzn.to');
        const isShopee = expandedUrl.includes('shopee.com.br') || originalUrl.includes('shp.ee');
        const isMeli = expandedUrl.includes('mercadolivre.com.br') || expandedUrl.includes('meli.la') || originalUrl.includes('meli.la');

        if (isAmazon && !mapping.user.listenAmazon) {
          console.log(`[Listener] Amazon link ignored for user ${mapping.user.email} (listenAmazon = false)`);
          continue;
        }
        if (isShopee && !mapping.user.listenShopee) {
          console.log(`[Listener] Shopee link ignored for user ${mapping.user.email} (listenShopee = false)`);
          continue;
        }
        if (isMeli && !mapping.user.listenMercadoLivre) {
          console.log(`[Listener] Mercado Livre link ignored for user ${mapping.user.email} (listenMercadoLivre = false)`);
          continue;
        }

        // 2. Extração de Metadados (Scraping)
        const productData = await scrapeProductData(expandedUrl);

        // 3. Substituição dos IDs de Afiliados
        const convertedUrl = await convertToAffiliateLink(
          expandedUrl,
          mapping.user,
          async () => {
            const userId = mapping.userId;
            const now = Date.now();
            const lastAlert = lastAlertMap.get(userId) || 0;
            
            // Envia alerta 1 vez a cada 12 horas por usuário
            if (now - lastAlert > 12 * 60 * 60 * 1000) {
              lastAlertMap.set(userId, now);
              
              const phone = mapping.user.cookieNotificationPhone;
              if (phone) {
                const cleanPhone = phone.replace(/\D/g, '');
                const destJid = cleanPhone.includes('@') ? cleanPhone : `${cleanPhone}@s.whatsapp.net`;
                console.log(`[Listener] Enviando alerta de expiração de cookie para o admin ${destJid}`);
                
                try {
                  await sock.sendMessage(destJid, {
                    text: `⚠️ *MandacaruZap - Alerta de Sessão!*\n\nO seu cookie do Mercado Livre expirou. Os links estão sendo gerados usando o fluxo de fallback (links de canal social).\n\nPara atualizar, por favor responda a esta mensagem enviando o novo cookie (ou comece a mensagem com "cookie:").`
                  });
                } catch (sendErr) {
                  console.error('[Listener] Falha ao enviar mensagem de alerta para admin:', sendErr);
                }
              } else {
                console.warn(`[Listener] Sessão expirada para o usuário ${mapping.user.email}, mas nenhum telefone de notificação está configurado.`);
              }
            }
          }
        );

        // Validar restrição de links curtos do Mercado Livre
        if (isMeli && mapping.user.mercadolivreOnlyShort) {
          const isShortMeli = convertedUrl.includes('meli.la');
          if (!isShortMeli) {
            const warnMsg = "Link do Mercado Livre nao enviado: a geracao oficial de link encurtado falhou e a restricao de links curtos esta ativa.";
            console.warn(`[Listener] ${warnMsg}`);
            
            // Grava o log de erro específico
            await prisma.log.create({
              data: {
                originalUrl,
                status: 'FAILED',
                errorMessage: 'O link foi capturado, porem nao pode ser encurtado via cookies (opcao "Apenas Links Curtos" ativa).',
                sourceGroup: fromJid,
                destGroups: mapping.destGroupIds,
                userId: mapping.userId,
                instanceId: instanceId
              }
            });
            continue; // Ignora e pula para a próxima URL
          }
        }

        // 3. Montagem da Copy
        const copy = buildCopy(productData, convertedUrl);

        // 4. Salvar na Fila de Mensagens (MessageQueue) como PENDING
        await prisma.messageQueue.create({
          data: {
            originalUrl,
            convertedUrl,
            title: productData.title,
            price: productData.price,
            imageUrl: productData.imageUrl,
            copy,
            sourceGroup: fromJid,
            destGroups: mapping.destGroupIds,
            status: 'PENDING',
            userId: mapping.userId,
            instanceId: instanceId
          }
        });

        // 5. Salva log com status de enfileiramento (QUEUED)
        await prisma.log.create({
          data: {
            originalUrl,
            convertedUrl,
            title: productData.title,
            price: productData.price,
            imageUrl: productData.imageUrl,
            status: 'QUEUED',
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
