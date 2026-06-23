import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { whatsappManager } from './connection/whatsapp.js';
import { scrapeProductData } from './processor/scraper.js';
import { convertToAffiliateLink } from './processor/affiliate.js';
import { broadcastMessage, isTelegramId } from './broadcaster/sender.js';
import prisma from './lib/prisma.js';
import { startQueueProcessor } from './services/queueProcessor.js';
import { Request, Response, NextFunction } from 'express';

dotenv.config();

// --- Item 2: WORKER_SECRET obrigatório ---
const WORKER_SECRET = process.env.WORKER_SECRET;
if (!WORKER_SECRET || WORKER_SECRET.length < 20) {
  console.error('[FATAL] WORKER_SECRET não definido ou muito fraco. Defina uma chave forte no .env e reinicie.');
  process.exit(1);
}

const app = express();
const PORT = process.env.WORKER_PORT || 5001;

// --- Item 4: CORS restrito — apenas o Backend pode chamar o Worker ---
app.use(cors({
  origin: ['http://localhost:5050', 'http://backend:5050'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'x-worker-secret']
}));

app.use(express.json({ limit: '1mb' }));

// --- Item 2: Middleware de autenticação interna por WORKER_SECRET ---
const requireWorkerSecret = (req: Request, res: Response, next: NextFunction) => {
  const secret = req.headers['x-worker-secret'];
  if (!secret || secret !== WORKER_SECRET) {
    console.warn(`[Worker] Tentativa de acesso não autorizado em ${req.method} ${req.path} — IP: ${req.ip}`);
    return res.status(401).json({ success: false, error: 'Acesso não autorizado.' });
  }
  next();
};

// Rota de Health Check — pública (para monitoramento)
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'WhatsApp Worker' });
});

// Inicia um novo número (Gera QR Code se necessário)
app.post('/instances/:id/start', requireWorkerSecret, async (req, res) => {
  const { id } = req.params;
  try {
    whatsappManager.startInstance(id).catch((err: any) => {
      console.error(`Error in background start for instance ${id}:`, err);
    });
    res.json({ success: true, message: `Instance ${id} starting process initiated.` });
  } catch (error) {
    console.error(`[Worker] Start error for ${id}:`, error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor.' });
  }
});

// Desconecta um número
app.post('/instances/:id/stop', requireWorkerSecret, async (req, res) => {
  const { id } = req.params;
  try {
    await whatsappManager.stopInstance(id);
    res.json({ success: true, message: `Instance ${id} stopped.` });
  } catch (error) {
    console.error(`[Worker] Stop error for ${id}:`, error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor.' });
  }
});

// Rota para listar os grupos participantes de uma instância
app.get('/instances/:id/groups', requireWorkerSecret, async (req, res) => {
  const { id } = req.params;
  const sock = whatsappManager.getSocket(id);
  if (!sock) {
    return res.status(400).json({ success: false, error: `WhatsApp instance ${id} is not connected.` });
  }
  try {
    const groups = await sock.groupFetchAllParticipating();
    const groupList = Object.entries(groups).map(([jid, metadata]) => ({
      id: jid,
      name: (metadata as any).subject
    }));
    res.json({ success: true, groups: groupList });
  } catch (error) {
    console.error(`[Worker] Error fetching groups for ${id}:`, error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor.' });
  }
});

// Rota de Envio Imediato de Item da Fila
app.post('/queue/:id/dispatch', requireWorkerSecret, async (req, res) => {
  const { id } = req.params;
  let item: any = null;

  try {
    // Busca o item da fila
    item = await prisma.messageQueue.findUnique({ where: { id } });
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item não encontrado na fila.' });
    }
    if (item.status !== 'PENDING') {
      return res.status(400).json({ success: false, error: 'Apenas itens com status PENDING podem ser enviados imediatamente.' });
    }

    const user = await prisma.user.findUnique({ where: { id: item.userId } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuário não encontrado.' });
    }

    const sock = whatsappManager.getSocket(item.instanceId);
    const destGroupsArray = item.destGroups.split(',').map((g: string) => g.trim()).filter(Boolean);
    const hasWhatsAppDest = destGroupsArray.some((gId: string) => !isTelegramId(gId));

    if (hasWhatsAppDest && !sock) {
      return res.status(400).json({ success: false, error: `Instância WhatsApp ${item.instanceId} não está conectada.` });
    }

    console.log(`[Queue Dispatch] Forced dispatch of queue item ${id} for user ${user.email}`);

    // Envia a mensagem imediatamente usando a copy e dados já salvos na fila
    await broadcastMessage(item.instanceId, sock, destGroupsArray, item.copy, item.imageUrl || undefined, user.telegramBotToken);

    // Atualiza o status para SENT
    await prisma.messageQueue.update({
      where: { id },
      data: { status: 'SENT', sentAt: new Date() }
    });

    // Grava log de sucesso
    await prisma.log.create({
      data: {
        originalUrl: item.originalUrl,
        convertedUrl: item.convertedUrl,
        title: item.title,
        price: item.price,
        imageUrl: item.imageUrl,
        status: 'SENT',
        sourceGroup: item.sourceGroup,
        destGroups: item.destGroups,
        userId: item.userId,
        instanceId: item.instanceId
      }
    });

    res.json({ success: true, message: 'Mensagem enviada com sucesso.' });

  } catch (error) {
    console.error('[Queue Dispatch] Error dispatching queue item:', error);

    // Marca como FAILED e loga
    await prisma.messageQueue.update({
      where: { id },
      data: { status: 'FAILED', errorMessage: String(error) }
    }).catch(() => {});

    await prisma.log.create({
      data: {
        originalUrl: item?.originalUrl || '',
        convertedUrl: item?.convertedUrl || '',
        status: 'FAILED',
        errorMessage: String(error),
        userId: item?.userId || '',
        instanceId: item?.instanceId || ''
      }
    }).catch(() => {});

    res.status(500).json({ success: false, error: 'Erro interno ao despachar item da fila.' });
  }
});

// Rota de Disparo Manual
app.post('/instances/manual-dispatch', requireWorkerSecret, async (req, res) => {
  const { instanceId, destGroupIds, url, userId } = req.body;

  if (!instanceId || !destGroupIds || !url || !userId) {
    return res.status(400).json({ success: false, error: 'Missing parameters. Required: instanceId, destGroupIds, url, userId' });
  }

  const sock = whatsappManager.getSocket(instanceId);
  const destGroupsArray = Array.isArray(destGroupIds)
    ? destGroupIds
    : String(destGroupIds).split(',').map((g: string) => g.trim()).filter(Boolean);

  const hasWhatsAppDest = destGroupsArray.some((id: string) => !isTelegramId(id));

  if (hasWhatsAppDest && !sock) {
    return res.status(400).json({ success: false, error: `WhatsApp instance ${instanceId} is not connected.` });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    console.log(`[Manual Dispatch] Processing manual dispatch for user ${user.email}`);

    const productData = await scrapeProductData(url);
    const convertedUrl = await convertToAffiliateLink(url, user);

    const emojiTitle = '📦';
    const emojiOffer = '🔥';
    const emojiCheck = '✅';

    const copy = `${emojiOffer} *SUPER OFERTA EXCLUSIVA!* ${emojiOffer}\n\n` +
                 `${emojiTitle} *Produto:* ${productData.title}\n` +
                 `💰 *Por Apenas:* ${productData.price}\n\n` +
                 `${emojiCheck} *Acesse aqui:* ${convertedUrl}\n\n` +
                 `⚠️ _Oferta por tempo limitado!_`;

    await broadcastMessage(instanceId, sock, destGroupsArray, copy, productData.imageUrl || undefined, user.telegramBotToken);

    await prisma.log.create({
      data: {
        originalUrl: url,
        convertedUrl,
        title: productData.title,
        price: productData.price,
        imageUrl: productData.imageUrl,
        status: 'SENT',
        sourceGroup: 'MANUAL_DISPATCH',
        destGroups: Array.isArray(destGroupIds) ? destGroupIds.join(',') : String(destGroupIds),
        userId,
        instanceId
      }
    });

    res.json({ success: true, product: productData, convertedUrl });

  } catch (error) {
    console.error('[Manual Dispatch] Error executing manual dispatch:', error);

    await prisma.log.create({
      data: {
        originalUrl: url,
        status: 'FAILED',
        errorMessage: String(error),
        sourceGroup: 'MANUAL_DISPATCH',
        destGroups: Array.isArray(destGroupIds) ? destGroupIds.join(',') : String(destGroupIds),
        userId,
        instanceId
      }
    }).catch(() => {});

    res.status(500).json({ success: false, error: 'Erro interno ao processar o disparo.' });
  }
});

// Inicialização do servidor
app.listen(PORT, () => {
  console.log(`WhatsApp Worker internal API running on port ${PORT}`);
  console.log(`[Worker] Autenticação por WORKER_SECRET: ativada`);

  whatsappManager.bootstrap();
  startQueueProcessor();
});
