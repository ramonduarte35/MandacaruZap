import prisma from '../lib/prisma.js';
import { broadcastMessage } from '../broadcaster/sender.js';
import { whatsappManager } from '../connection/whatsapp.js';

/**
 * Verifica se a hora atual está dentro da janela configurada
 */
function isInsideWindow(startStr: string, endStr: string): boolean {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = startStr.split(':').map(Number);
  const startMinutes = startH * 60 + startM;

  const [endH, endM] = endStr.split(':').map(Number);
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  } else {
    // Se a janela passa da meia-noite (ex: 22:00 às 06:00)
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }
}

/**
 * Processador de Fila periódico
 */
export function startQueueProcessor(): void {
  console.log('[Queue Processor] Starting background queue processor...');
  
  // Executa o processamento a cada 1 minuto (60000ms)
  setInterval(async () => {
    try {
      // 1. Limpeza de mensagens PENDING obsoletas (mais de 24 horas)
      const expirationLimit = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const expiredCount = await prisma.messageQueue.updateMany({
        where: {
          status: 'PENDING',
          createdAt: {
            lt: expirationLimit
          }
        },
        data: {
          status: 'EXPIRED',
          errorMessage: 'Mensagem expirada na fila (limite de 24 horas excedido).'
        }
      });
      if (expiredCount.count > 0) {
        console.log(`[Queue Processor] Expired ${expiredCount.count} outdated pending messages in the queue.`);
      }

      // 2. Busca todos os usuários cadastrados
      const users = await prisma.user.findMany();

      for (const user of users) {
        // A. Verifica se o horário atual está dentro da janela permitida
        const startStr = user.sendWindowStart || '08:00';
        const endStr = user.sendWindowEnd || '18:00';
        if (!isInsideWindow(startStr, endStr)) {
          // Fora da janela de envio para este usuário. Pula para o próximo.
          continue;
        }

        // B. Verifica o limite diário de mensagens (enviadas com status SENT no dia de hoje)
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const sentToday = await prisma.messageQueue.count({
          where: {
            userId: user.id,
            status: 'SENT',
            sentAt: {
              gte: startOfDay,
              lte: endOfDay
            }
          }
        });

        const dailyLimit = user.dailyLimit ?? 30;
        if (sentToday >= dailyLimit) {
          // Já atingiu o limite diário de envios.
          continue;
        }

        // C. Verifica se o intervalo mínimo de 5 minutos desde o último envio foi respeitado
        const lastSent = await prisma.messageQueue.findFirst({
          where: {
            userId: user.id,
            status: 'SENT'
          },
          orderBy: {
            sentAt: 'desc'
          }
        });

        if (lastSent && lastSent.sentAt) {
          const minIntervalMs = 5 * 60 * 1000; // 5 minutos
          const elapsed = Date.now() - new Date(lastSent.sentAt).getTime();
          if (elapsed < minIntervalMs) {
            // Muito recente, pula este ciclo para respeitar o intervalo mínimo de envio
            continue;
          }
        }

        // D. Busca a mensagem pendente mais antiga da fila para este usuário
        const nextMessage = await prisma.messageQueue.findFirst({
          where: {
            userId: user.id,
            status: 'PENDING'
          },
          orderBy: {
            createdAt: 'asc'
          }
        });

        if (!nextMessage) {
          // Nenhuma mensagem pendente para este usuário.
          continue;
        }

        // E. Obtém a conexão ativa do WhatsApp (socket) correspondente
        const sock = whatsappManager.getSocket(nextMessage.instanceId);
        if (!sock) {
          console.warn(`[Queue Processor] Socket not connected for instance ${nextMessage.instanceId} (User: ${user.email}). Message will stay in queue.`);
          continue;
        }

        // F. Executa o broadcast da mensagem
        const destGroupsArray = nextMessage.destGroups.split(',').map((id: string) => id.trim()).filter(Boolean);
        console.log(`[Queue Processor] Dispatching queued message ${nextMessage.id} (User: ${user.email}) to groups:`, destGroupsArray);

        try {
          await broadcastMessage(
            nextMessage.instanceId,
            sock,
            destGroupsArray,
            nextMessage.copy,
            nextMessage.imageUrl || undefined
          );

          // Atualiza a mensagem da fila para SENT
          await prisma.messageQueue.update({
            where: { id: nextMessage.id },
            data: {
              status: 'SENT',
              sentAt: new Date()
            }
          });

          // Grava o log histórico de sucesso
          await prisma.log.create({
            data: {
              originalUrl: nextMessage.originalUrl,
              convertedUrl: nextMessage.convertedUrl,
              title: nextMessage.title,
              price: nextMessage.price,
              imageUrl: nextMessage.imageUrl,
              status: 'SENT',
              sourceGroup: nextMessage.sourceGroup,
              destGroups: nextMessage.destGroups,
              userId: nextMessage.userId,
              instanceId: nextMessage.instanceId
            }
          });

          console.log(`[Queue Processor] Message ${nextMessage.id} successfully sent and logged.`);
        } catch (sendErr) {
          console.error(`[Queue Processor] Failed to send message ${nextMessage.id}:`, sendErr);

          // Atualiza a fila para FAILED
          await prisma.messageQueue.update({
            where: { id: nextMessage.id },
            data: {
              status: 'FAILED',
              errorMessage: String(sendErr)
            }
          });

          // Grava o log de erro
          await prisma.log.create({
            data: {
              originalUrl: nextMessage.originalUrl,
              convertedUrl: nextMessage.convertedUrl,
              title: nextMessage.title,
              price: nextMessage.price,
              imageUrl: nextMessage.imageUrl,
              status: 'FAILED',
              errorMessage: String(sendErr),
              sourceGroup: nextMessage.sourceGroup,
              destGroups: nextMessage.destGroups,
              userId: nextMessage.userId,
              instanceId: nextMessage.instanceId
            }
          });
        }
      }
    } catch (err) {
      console.error('[Queue Processor] Error in queue processing iteration:', err);
    }
  }, 60000); // 1 minuto
}
