import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { whatsappManager } from './connection/whatsapp';
import { scrapeProductData } from './processor/scraper';
import { convertToAffiliateLink } from './processor/affiliate';
import { broadcastMessage } from './broadcaster/sender';
import prisma from './lib/prisma';
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
    whatsappManager.startInstance(id).catch(err => {
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
      name: metadata.subject
    }));
    res.json({ success: true, groups: groupList });
  } catch (error) {
    console.error(`[Worker] Error fetching groups for ${id}:`, error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor.' });
  }
});

// Rota de Disparo Manual
app.post('/instances/manual-dispatch', requireWorkerSecret, async (req, res) => {
  const { instanceId, destGroupIds, url, userId } = req.body;

  if (!instanceId || !destGroupIds || !url || !userId) {
    return res.status(400).json({ success: false, error: 'Missing parameters. Required: instanceId, destGroupIds, url, userId' });
  }

  const sock = whatsappManager.getSocket(instanceId);
  if (!sock) {
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

    await broadcastMessage(instanceId, sock, destGroupIds, copy, productData.imageUrl || undefined);

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
