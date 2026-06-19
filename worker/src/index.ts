import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { whatsappManager } from './connection/whatsapp';
import { scrapeProductData } from './processor/scraper';
import { convertToAffiliateLink } from './processor/affiliate';
import { broadcastMessage } from './broadcaster/sender';
import prisma from './lib/prisma';

dotenv.config();

const app = express();
const PORT = process.env.WORKER_PORT || 5001;

app.use(cors());
app.use(express.json());

// Rota de Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'WhatsApp Worker' });
});

// Inicia um novo número (Gera QR Code se necessário)
app.post('/instances/:id/start', async (req, res) => {
  const { id } = req.params;
  try {
    // Inicia de forma assíncrona para não travar a requisição HTTP
    whatsappManager.startInstance(id).catch(err => {
      console.error(`Error in background start for instance ${id}:`, err);
    });
    res.json({ success: true, message: `Instance ${id} starting process initiated.` });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// Desconecta um número
app.post('/instances/:id/stop', async (req, res) => {
  const { id } = req.params;
  try {
    await whatsappManager.stopInstance(id);
    res.json({ success: true, message: `Instance ${id} stopped.` });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// Rota para listar os grupos participantes de uma instância
app.get('/instances/:id/groups', async (req, res) => {
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
    res.status(500).json({ success: false, error: String(error) });
  }
});

// Rota de Disparo Manual
app.post('/instances/manual-dispatch', async (req, res) => {
  const { instanceId, destGroupIds, url, userId } = req.body;

  if (!instanceId || !destGroupIds || !url || !userId) {
    return res.status(400).json({ success: false, error: 'Missing parameters. Required: instanceId, destGroupIds, url, userId' });
  }

  const sock = whatsappManager.getSocket(instanceId);
  if (!sock) {
    return res.status(400).json({ success: false, error: `WhatsApp instance ${instanceId} is not connected.` });
  }

  try {
    // 1. Busca configurações de afiliado do usuário
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    console.log(`[Manual Dispatch] Processing manual dispatch for user ${user.email}`);

    // 2. Scraping do produto
    const productData = await scrapeProductData(url);

    // 3. Conversão para link de afiliado
    const convertedUrl = await convertToAffiliateLink(url, user);

    // 4. Montagem da Copy
    const emojiTitle = '📦';
    const emojiOffer = '🔥';
    const emojiCheck = '✅';
    
    const copy = `${emojiOffer} *SUPER OFERTA EXCLUSIVA!* ${emojiOffer}\n\n` +
                 `${emojiTitle} *Produto:* ${productData.title}\n` +
                 `💰 *Por Apenas:* ${productData.price}\n\n` +
                 `${emojiCheck} *Acesse aqui:* ${convertedUrl}\n\n` +
                 `⚠️ _Oferta por tempo limitado!_`;

    // 5. Broadcast para os grupos destinatários selecionados
    await broadcastMessage(
      instanceId,
      sock,
      destGroupIds,
      copy,
      productData.imageUrl || undefined
    );

    // 6. Registra log de sucesso
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
        userId: userId,
        instanceId: instanceId
      }
    });

    res.json({
      success: true,
      product: productData,
      convertedUrl
    });

  } catch (error) {
    console.error('[Manual Dispatch] Error executing manual dispatch:', error);
    
    // Registra log de falha
    await prisma.log.create({
      data: {
        originalUrl: url,
        status: 'FAILED',
        errorMessage: String(error),
        sourceGroup: 'MANUAL_DISPATCH',
        destGroups: Array.isArray(destGroupIds) ? destGroupIds.join(',') : String(destGroupIds),
        userId: userId,
        instanceId: instanceId
      }
    });

    res.status(500).json({ success: false, error: String(error) });
  }
});

// Inicialização do servidor
app.listen(PORT, () => {
  console.log(`WhatsApp Worker internal API running on port ${PORT}`);
  
  // Executa o auto-bootstrap para levantar instâncias salvas como conectadas anteriormente
  whatsappManager.bootstrap();
});
