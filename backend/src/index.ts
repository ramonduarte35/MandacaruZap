import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

dotenv.config();

// --- Item 1: JWT_SECRET não pode ser vazio ou fraco ---
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 20) {
  console.error('[FATAL] JWT_SECRET não definido ou muito fraco. Defina uma chave forte no .env e reinicie.');
  process.exit(1);
}

const WORKER_SECRET = process.env.WORKER_SECRET;
if (!WORKER_SECRET || WORKER_SECRET.length < 20) {
  console.error('[FATAL] WORKER_SECRET não definido ou muito fraco. Defina uma chave forte no .env e reinicie.');
  process.exit(1);
}

const WORKER_URL = 'http://localhost:5001';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5050;

// --- Item 4: CORS restrito à origem do frontend ---
const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:3000';
app.use(cors({
  origin: allowedOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '1mb' }));

// --- Item 5: Rate Limit no endpoint de login ---
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,                   // máx 10 tentativas por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' }
});

// Helper: chamadas autenticadas ao Worker
const workerFetch = (path: string, options: RequestInit = {}) => {
  return fetch(`${WORKER_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-worker-secret': WORKER_SECRET as string,
      ...(options.headers as Record<string, string> || {})
    }
  });
};

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autorizado. Token de sessão ausente.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET as string) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Sessão expirada ou inválida.' });
  }
};

// Middleware para proteger todas as rotas /api/* exceto auth
app.use((req, res, next) => {
  if (req.path.startsWith('/api/') && !req.path.startsWith('/api/auth/')) {
    return requireAuth(req, res, next);
  }
  next();
});

// --- Item 9: Health check sem expor detalhes do banco ---
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'OK', database: 'Connected' });
  } catch (error) {
    console.error('[Health] Database error:', error);
    res.status(500).json({ status: 'ERROR', database: 'Disconnected' });
  }
});

// 0. Autenticação (Login) — com rate limit
app.post('/api/auth/login', loginRateLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
  }

  // Validação básica de formato
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Dados inválidos.' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    // Resposta genérica para não revelar se o e-mail existe
    if (!user) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET as string, { expiresIn: '7d' });

    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (error) {
    console.error('[Login] Error:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// 2. Listar instâncias do WhatsApp do usuário
app.get('/api/instances', async (req, res) => {
  try {
    const userId = req.userId || '';
    const instances = await prisma.whatsappInstance.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(instances);
  } catch (error) {
    console.error('[Instances] List error:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// 2b. Listar grupos do WhatsApp associados a uma instância conectada
app.get('/api/instances/:id/groups', async (req, res) => {
  const { id } = req.params;
  const userId = req.userId || '';
  try {
    const instance = await prisma.whatsappInstance.findFirst({ where: { id, userId } });
    if (!instance) {
      return res.status(404).json({ error: 'Instância não encontrada ou não pertence ao seu usuário.' });
    }
    const response = await workerFetch(`/instances/${id}/groups`);
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(data);
    }
    res.json(data);
  } catch (error) {
    console.error('[Groups] Fetch error:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// 3. Criar uma nova instância do WhatsApp para o usuário
app.post('/api/instances', async (req, res) => {
  const { name } = req.body;

  // --- Item 8: Validação de input ---
  if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 100) {
    return res.status(400).json({ error: 'Nome inválido. Deve ter entre 1 e 100 caracteres.' });
  }

  try {
    const userId = req.userId || '';
    const instance = await prisma.whatsappInstance.create({
      data: { name: name.trim(), userId, status: 'DISCONNECTED' }
    });

    workerFetch(`/instances/${instance.id}/start`, { method: 'POST' }).catch(err => {
      console.error('[Backend] Failed to start instance in worker:', err);
    });

    res.json(instance);
  } catch (error) {
    console.error('[Instances] Create error:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// 4. Iniciar ou reconectar instância manualmente
app.post('/api/instances/:id/start', async (req, res) => {
  const { id } = req.params;
  const userId = req.userId || '';
  try {
    const instance = await prisma.whatsappInstance.findFirst({ where: { id, userId } });
    if (!instance) {
      return res.status(404).json({ error: 'Instância não encontrada ou não pertence ao seu usuário.' });
    }
    workerFetch(`/instances/${id}/start`, { method: 'POST' }).catch(err => {
      console.error('[Backend] Failed to start instance in worker:', err);
    });
    res.json({ success: true, message: 'Start request sent to worker.' });
  } catch (error) {
    console.error('[Instances] Start error:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// 5. Parar conexão do WhatsApp
app.post('/api/instances/:id/stop', async (req, res) => {
  const { id } = req.params;
  const userId = req.userId || '';
  try {
    const instance = await prisma.whatsappInstance.findFirst({ where: { id, userId } });
    if (!instance) {
      return res.status(404).json({ error: 'Instância não encontrada ou não pertence ao seu usuário.' });
    }
    workerFetch(`/instances/${id}/stop`, { method: 'POST' }).catch(err => {
      console.error('[Backend] Failed to stop instance in worker:', err);
    });
    res.json({ success: true, message: 'Stop request sent to worker.' });
  } catch (error) {
    console.error('[Instances] Stop error:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// 6. Excluir uma instância
app.delete('/api/instances/:id', async (req, res) => {
  const { id } = req.params;
  const userId = req.userId || '';
  try {
    const instance = await prisma.whatsappInstance.findFirst({ where: { id, userId } });
    if (!instance) {
      return res.status(404).json({ error: 'Instância não encontrada ou não pertence ao seu usuário.' });
    }
    await workerFetch(`/instances/${id}/stop`, { method: 'POST' }).catch(() => {});
    await prisma.whatsappInstance.delete({ where: { id } });
    res.json({ success: true, message: 'Instance deleted.' });
  } catch (error) {
    console.error('[Instances] Delete error:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// 7. Listar mapeamento de grupos do usuário
app.get('/api/mappings', async (req, res) => {
  const userId = req.userId || '';
  try {
    const mappings = await prisma.groupMapping.findMany({
      where: { userId },
      include: { instance: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(mappings);
  } catch (error) {
    console.error('[Mappings] List error:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// 8. Criar mapeamento de grupos
app.post('/api/mappings', async (req, res) => {
  const { name, instanceId, sourceGroupId, sourceGroupName, destGroupIds, isActive } = req.body;

  // --- Item 8: Validação de inputs ---
  if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 100) {
    return res.status(400).json({ error: 'Nome inválido. Deve ter entre 1 e 100 caracteres.' });
  }
  if (!instanceId || typeof instanceId !== 'string') {
    return res.status(400).json({ error: 'instanceId inválido.' });
  }
  if (!sourceGroupId || typeof sourceGroupId !== 'string') {
    return res.status(400).json({ error: 'sourceGroupId inválido.' });
  }
  if (!destGroupIds) {
    return res.status(400).json({ error: 'destGroupIds é obrigatório.' });
  }

  const userId = req.userId || '';
  try {
    const instance = await prisma.whatsappInstance.findFirst({ where: { id: instanceId, userId } });
    if (!instance) {
      return res.status(400).json({ error: 'Instância do WhatsApp não encontrada ou não pertence ao seu usuário.' });
    }

    const mapping = await prisma.groupMapping.create({
      data: {
        name: name.trim(),
        instanceId,
        sourceGroupId,
        sourceGroupName: sourceGroupName || 'Grupo Origem',
        destGroupIds: Array.isArray(destGroupIds) ? destGroupIds.join(',') : destGroupIds,
        isActive: isActive ?? true,
        userId
      }
    });
    res.json(mapping);
  } catch (error) {
    console.error('[Mappings] Create error:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// 9. Excluir mapeamento de grupos
app.delete('/api/mappings/:id', async (req, res) => {
  const { id } = req.params;
  const userId = req.userId || '';
  try {
    const mapping = await prisma.groupMapping.findFirst({ where: { id, userId } });
    if (!mapping) {
      return res.status(404).json({ error: 'Mapeamento não encontrado ou não pertence ao seu usuário.' });
    }
    await prisma.groupMapping.delete({ where: { id } });
    res.json({ success: true, message: 'Mapping deleted.' });
  } catch (error) {
    console.error('[Mappings] Delete error:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// 10. Listar logs de atividades do usuário
app.get('/api/logs', async (req, res) => {
  const userId = req.userId || '';
  try {
    const logs = await prisma.log.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    res.json(logs);
  } catch (error) {
    console.error('[Logs] List error:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// 11. Executar disparo manual imediato
app.post('/api/manual-dispatch', async (req, res) => {
  const { instanceId, destGroupIds, url } = req.body;

  if (!instanceId || !destGroupIds || !url) {
    return res.status(400).json({ error: 'Missing parameters. Required: instanceId, destGroupIds, url' });
  }
  if (typeof url !== 'string' || url.length > 2000) {
    return res.status(400).json({ error: 'URL inválida.' });
  }

  const userId = req.userId || '';
  try {
    const instance = await prisma.whatsappInstance.findFirst({ where: { id: instanceId, userId } });
    if (!instance) {
      return res.status(400).json({ error: 'Instância do WhatsApp não encontrada ou não pertence ao seu usuário.' });
    }

    const response = await workerFetch('/instances/manual-dispatch', {
      method: 'POST',
      body: JSON.stringify({ instanceId, destGroupIds, url, userId })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(data);
    }
    res.json(data);
  } catch (error) {
    console.error('[Manual Dispatch] Error:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// 12. Obter fila de envio de mensagens do usuário
app.get('/api/queue', async (req, res) => {
  const userId = req.userId || '';
  try {
    const queue = await prisma.messageQueue.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(queue);
  } catch (error) {
    console.error('[Queue] List error:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// Cancelar/excluir item da fila de envio
app.delete('/api/queue/:id', async (req, res) => {
  const userId = req.userId || '';
  const { id } = req.params;
  try {
    const item = await prisma.messageQueue.findFirst({
      where: { id, userId }
    });
    if (!item) {
      return res.status(404).json({ error: 'Item não encontrado na fila.' });
    }
    if (item.status !== 'PENDING') {
      return res.status(400).json({ error: 'Apenas itens pendentes podem ser cancelados.' });
    }

    await prisma.messageQueue.delete({
      where: { id }
    });

    // Grava no Log como falha/cancelado para que o usuário veja no histórico
    await prisma.log.create({
      data: {
        originalUrl: item.originalUrl,
        convertedUrl: item.convertedUrl,
        title: item.title,
        price: item.price,
        imageUrl: item.imageUrl,
        status: 'FAILED',
        errorMessage: 'Cancelado pelo usuário na fila de disparo.',
        sourceGroup: item.sourceGroup,
        destGroups: item.destGroups,
        userId: item.userId,
        instanceId: item.instanceId
      }
    });

    res.json({ success: true, message: 'Item cancelado com sucesso.' });
  } catch (error) {
    console.error('[Queue] Cancel error:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// Enviar item da fila imediatamente (ignorar janela de horário)
app.post('/api/queue/:id/dispatch', async (req, res) => {
  const userId = req.userId || '';
  const { id } = req.params;
  try {
    // Verifica se o item pertence ao usuário logado
    const item = await prisma.messageQueue.findFirst({
      where: { id, userId }
    });
    if (!item) {
      return res.status(404).json({ error: 'Item não encontrado na fila.' });
    }
    if (item.status !== 'PENDING') {
      return res.status(400).json({ error: 'Apenas itens pendentes podem ser enviados agora.' });
    }

    // Delega o envio ao worker
    const workerRes = await workerFetch(`/queue/${id}/dispatch`, { method: 'POST' });
    const data = (await workerRes.json()) as any;

    if (!workerRes.ok) {
      return res.status(workerRes.status).json({ error: data.error || 'Erro no worker ao despachar.' });
    }

    res.json({ success: true, message: 'Mensagem enviada com sucesso!' });
  } catch (error) {
    console.error('[Queue] Dispatch error:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// 13. Obter configurações de afiliado do usuário
// --- Item 7: Cookie ML NÃO é retornado — apenas hasCookie booleano ---
app.get('/api/user/affiliate', async (req, res) => {
  try {
    const userId = req.userId || '';
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        amazonId: true,
        shopeeId: true,
        mercadolivreId: true,
        mercadolivreChannel: true,
        mercadolivreTool: true,
        mercadolivreWord: true,
        mercadolivreCookie: true, // lemos internamente para computar hasCookie
        cookieNotificationPhone: true,
        listenAmazon: true,
        listenShopee: true,
        listenMercadoLivre: true,
        mercadolivreOnlyShort: true,
        sendWindowStart: true,
        sendWindowEnd: true,
        dailyLimit: true,
        minPriceAmazon: true,
        minPriceShopee: true,
        minPriceMeli: true,
        enableDeduplication: true,
        deduplicationHours: true,
        telegramBotToken: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    // Remove o cookie da resposta — retorna apenas indicador booleano
    const { mercadolivreCookie, ...safeUser } = user;
    res.json({ ...safeUser, hasCookie: Boolean(mercadolivreCookie && mercadolivreCookie.length > 0) });
  } catch (error) {
    console.error('[Affiliate] Get error:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// 14. Salvar/Atualizar configurações de afiliado do usuário
app.post('/api/user/affiliate', async (req, res) => {
  const {
    amazonId,
    shopeeId,
    mercadolivreId,
    mercadolivreChannel,
    mercadolivreTool,
    mercadolivreWord,
    mercadolivreCookie,
    cookieNotificationPhone,
    listenAmazon,
    listenShopee,
    listenMercadoLivre,
    mercadolivreOnlyShort,
    sendWindowStart,
    sendWindowEnd,
    dailyLimit,
    minPriceAmazon,
    minPriceShopee,
    minPriceMeli,
    enableDeduplication,
    deduplicationHours,
    telegramBotToken
  } = req.body;

  // Validação de limite diário
  if (dailyLimit !== undefined && (isNaN(Number(dailyLimit)) || Number(dailyLimit) < 1 || Number(dailyLimit) > 500)) {
    return res.status(400).json({ error: 'Limite diário inválido. Deve ser entre 1 e 500.' });
  }

  // Validação de deduplificação
  if (deduplicationHours !== undefined && (isNaN(Number(deduplicationHours)) || Number(deduplicationHours) < 1 || Number(deduplicationHours) > 168)) {
    return res.status(400).json({ error: 'Janela de deduplificação inválida. Deve ser entre 1 e 168 horas.' });
  }

  const userId = req.userId || '';
  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        amazonId,
        shopeeId,
        mercadolivreId,
        mercadolivreChannel,
        mercadolivreTool,
        mercadolivreWord,
        // Só atualiza o cookie se um novo valor foi enviado
        ...(mercadolivreCookie !== undefined && mercadolivreCookie !== null ? { mercadolivreCookie } : {}),
        cookieNotificationPhone,
        listenAmazon: listenAmazon !== undefined ? Boolean(listenAmazon) : undefined,
        listenShopee: listenShopee !== undefined ? Boolean(listenShopee) : undefined,
        listenMercadoLivre: listenMercadoLivre !== undefined ? Boolean(listenMercadoLivre) : undefined,
        mercadolivreOnlyShort: mercadolivreOnlyShort !== undefined ? Boolean(mercadolivreOnlyShort) : undefined,
        sendWindowStart: sendWindowStart !== undefined ? String(sendWindowStart) : undefined,
        sendWindowEnd: sendWindowEnd !== undefined ? String(sendWindowEnd) : undefined,
        dailyLimit: dailyLimit !== undefined ? Number(dailyLimit) : undefined,
        minPriceAmazon: minPriceAmazon !== undefined ? (minPriceAmazon === null || minPriceAmazon === '' ? null : Number(minPriceAmazon)) : undefined,
        minPriceShopee: minPriceShopee !== undefined ? (minPriceShopee === null || minPriceShopee === '' ? null : Number(minPriceShopee)) : undefined,
        minPriceMeli: minPriceMeli !== undefined ? (minPriceMeli === null || minPriceMeli === '' ? null : Number(minPriceMeli)) : undefined,
        enableDeduplication: enableDeduplication !== undefined ? Boolean(enableDeduplication) : undefined,
        deduplicationHours: deduplicationHours !== undefined ? Number(deduplicationHours) : undefined,
        telegramBotToken: telegramBotToken !== undefined ? (telegramBotToken === '' ? null : String(telegramBotToken)) : undefined
      },
      select: {
        amazonId: true,
        shopeeId: true,
        mercadolivreId: true,
        mercadolivreChannel: true,
        mercadolivreTool: true,
        mercadolivreWord: true,
        mercadolivreCookie: true,
        cookieNotificationPhone: true,
        listenAmazon: true,
        listenShopee: true,
        listenMercadoLivre: true,
        mercadolivreOnlyShort: true,
        sendWindowStart: true,
        sendWindowEnd: true,
        dailyLimit: true,
        minPriceAmazon: true,
        minPriceShopee: true,
        minPriceMeli: true,
        enableDeduplication: true,
        deduplicationHours: true,
        telegramBotToken: true
      }
    });
    const { mercadolivreCookie: _, ...safeUser } = updatedUser;
    res.json({ success: true, user: { ...safeUser, hasCookie: Boolean(updatedUser.mercadolivreCookie && updatedUser.mercadolivreCookie.length > 0) } });
  } catch (error) {
    console.error('[Affiliate] Save error:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// 14. Buscar tags do Mercado Livre para o usuário logado
app.get('/api/affiliate/meli-tags', async (req, res) => {
  try {
    const userId = req.userId || '';
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { mercadolivreCookie: true }
    });

    if (!user?.mercadolivreCookie) {
      return res.status(400).json({ error: 'Cookie do Mercado Livre não configurado.' });
    }

    const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

    const pageRes = await axios.get('https://www.mercadolivre.com.br/afiliados/linkbuilder', {
      headers: {
        cookie: user.mercadolivreCookie,
        'user-agent': userAgent,
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'pt-BR,pt;q=0.9'
      },
      timeout: 8000
    });

    const html: string = pageRes.data;
    const tagMatch = html.match(/"tags"\s*:\s*(\[[\s\S]*?\])/);
    let tags: string[] = [];

    if (tagMatch) {
      try {
        const tagsArray = JSON.parse(tagMatch[1]);
        tags = tagsArray
          .map((t: any) => (typeof t === 'string' ? t : t.tag || t.name || t.id))
          .filter(Boolean);
      } catch (parseErr) {
        console.error('[Backend] Erro ao parsear tags do HTML:', parseErr);
      }
    }

    res.json({ tags });
  } catch (error: any) {
    console.error('[Backend] Erro ao buscar tags ML:', error?.response?.status, error?.message);
    res.status(500).json({ error: 'Erro ao buscar etiquetas do Mercado Livre.' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend API running on port ${PORT}`);
  console.log(`CORS permitido para origem: ${allowedOrigin}`);
});
