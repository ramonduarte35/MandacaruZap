import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5050;
const JWT_SECRET = process.env.JWT_SECRET || 'mandacaruzap-secret-key-123';

app.use(cors());
app.use(express.json());

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autorizado. Token de sessão ausente.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
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

// 1. Health check
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'OK', database: 'Connected' });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', database: 'Disconnected', error: String(error) });
  }
});

// 0. Autenticação (Login)
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
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
    res.status(500).json({ error: String(error) });
  }
});

// 2b. Listar grupos do WhatsApp associados a uma instância conectada
app.get('/api/instances/:id/groups', async (req, res) => {
  const { id } = req.params;
  const userId = req.userId || '';
  try {
    const instance = await prisma.whatsappInstance.findFirst({
      where: { id, userId }
    });
    if (!instance) {
      return res.status(404).json({ error: 'Instância não encontrada ou não pertence ao seu usuário.' });
    }
    const response = await fetch(`http://localhost:5001/instances/${id}/groups`);
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(data);
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// 3. Criar uma nova instância do WhatsApp para o usuário
app.post('/api/instances', async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    const userId = req.userId || '';
    const instance = await prisma.whatsappInstance.create({
      data: {
        name,
        userId,
        status: 'DISCONNECTED'
      }
    });

    // Notifica o Worker para iniciar a conexão
    fetch(`http://localhost:5001/instances/${instance.id}/start`, { method: 'POST' }).catch(err => {
      console.error('[Backend] Failed to start instance in worker:', err);
    });

    res.json(instance);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// 4. Iniciar ou reconectar instância manualmente
app.post('/api/instances/:id/start', async (req, res) => {
  const { id } = req.params;
  const userId = req.userId || '';
  try {
    const instance = await prisma.whatsappInstance.findFirst({
      where: { id, userId }
    });
    if (!instance) {
      return res.status(404).json({ error: 'Instância não encontrada ou não pertence ao seu usuário.' });
    }
    fetch(`http://localhost:5001/instances/${id}/start`, { method: 'POST' }).catch(err => {
      console.error('[Backend] Failed to start instance in worker:', err);
    });
    res.json({ success: true, message: 'Start request sent to worker.' });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// 5. Parar conexão do WhatsApp
app.post('/api/instances/:id/stop', async (req, res) => {
  const { id } = req.params;
  const userId = req.userId || '';
  try {
    const instance = await prisma.whatsappInstance.findFirst({
      where: { id, userId }
    });
    if (!instance) {
      return res.status(404).json({ error: 'Instância não encontrada ou não pertence ao seu usuário.' });
    }
    fetch(`http://localhost:5001/instances/${id}/stop`, { method: 'POST' }).catch(err => {
      console.error('[Backend] Failed to stop instance in worker:', err);
    });
    res.json({ success: true, message: 'Stop request sent to worker.' });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// 6. Excluir uma instância
app.delete('/api/instances/:id', async (req, res) => {
  const { id } = req.params;
  const userId = req.userId || '';
  try {
    const instance = await prisma.whatsappInstance.findFirst({
      where: { id, userId }
    });
    if (!instance) {
      return res.status(404).json({ error: 'Instância não encontrada ou não pertence ao seu usuário.' });
    }
    // Tenta parar a conexão no worker
    await fetch(`http://localhost:5001/instances/${id}/stop`, { method: 'POST' }).catch(() => {});
    
    // Deleta do banco
    await prisma.whatsappInstance.delete({
      where: { id }
    });
    res.json({ success: true, message: 'Instance deleted.' });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// 7. Listar mapeamento de grupos do usuário
app.get('/api/mappings', async (req, res) => {
  const userId = req.userId || '';
  try {
    const mappings = await prisma.groupMapping.findMany({
      where: { userId },
      include: {
        instance: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(mappings);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// 8. Criar mapeamento de grupos
app.post('/api/mappings', async (req, res) => {
  const { name, instanceId, sourceGroupId, sourceGroupName, destGroupIds, isActive } = req.body;
  
  if (!name || !instanceId || !sourceGroupId || !destGroupIds) {
    return res.status(400).json({ error: 'Missing parameters. Required: name, instanceId, sourceGroupId, destGroupIds' });
  }

  const userId = req.userId || '';
  try {
    const instance = await prisma.whatsappInstance.findFirst({
      where: { id: instanceId, userId }
    });
    if (!instance) {
      return res.status(400).json({ error: 'Instância do WhatsApp não encontrada ou não pertence ao seu usuário.' });
    }

    const mapping = await prisma.groupMapping.create({
      data: {
        name,
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
    res.status(500).json({ error: String(error) });
  }
});

// 9. Excluir mapeamento de grupos
app.delete('/api/mappings/:id', async (req, res) => {
  const { id } = req.params;
  const userId = req.userId || '';
  try {
    const mapping = await prisma.groupMapping.findFirst({
      where: { id, userId }
    });
    if (!mapping) {
      return res.status(404).json({ error: 'Mapeamento não encontrado ou não pertence ao seu usuário.' });
    }
    await prisma.groupMapping.delete({
      where: { id }
    });
    res.json({ success: true, message: 'Mapping deleted.' });
  } catch (error) {
    res.status(500).json({ error: String(error) });
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
    res.status(500).json({ error: String(error) });
  }
});

// 11. Executar disparo manual imediato
app.post('/api/manual-dispatch', async (req, res) => {
  const { instanceId, destGroupIds, url } = req.body;

  if (!instanceId || !destGroupIds || !url) {
    return res.status(400).json({ error: 'Missing parameters. Required: instanceId, destGroupIds, url' });
  }

  const userId = req.userId || '';
  try {
    const instance = await prisma.whatsappInstance.findFirst({
      where: { id: instanceId, userId }
    });
    if (!instance) {
      return res.status(400).json({ error: 'Instância do WhatsApp não encontrada ou não pertence ao seu usuário.' });
    }
    
    // Encaminha a chamada de disparo para o Worker
    const response = await fetch('http://localhost:5001/instances/manual-dispatch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        instanceId,
        destGroupIds,
        url,
        userId
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// 12. Obter configurações de afiliado do usuário
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
        mercadolivreCookie: true,
        cookieNotificationPhone: true,
        listenAmazon: true,
        listenShopee: true,
        listenMercadoLivre: true,
        mercadolivreOnlyShort: true,
        sendWindowStart: true,
        sendWindowEnd: true,
        dailyLimit: true
      }
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// 13. Salvar/Atualizar configurações de afiliado do usuário
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
    dailyLimit
  } = req.body;
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
        mercadolivreCookie,
        cookieNotificationPhone,
        listenAmazon: listenAmazon !== undefined ? Boolean(listenAmazon) : undefined,
        listenShopee: listenShopee !== undefined ? Boolean(listenShopee) : undefined,
        listenMercadoLivre: listenMercadoLivre !== undefined ? Boolean(listenMercadoLivre) : undefined,
        mercadolivreOnlyShort: mercadolivreOnlyShort !== undefined ? Boolean(mercadolivreOnlyShort) : undefined,
        sendWindowStart: sendWindowStart !== undefined ? String(sendWindowStart) : undefined,
        sendWindowEnd: sendWindowEnd !== undefined ? String(sendWindowEnd) : undefined,
        dailyLimit: dailyLimit !== undefined ? Number(dailyLimit) : undefined
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
        dailyLimit: true
      }
    });
    res.json({ success: true, user: updatedUser });
  } catch (error) {
    res.status(500).json({ error: String(error) });
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

    if (tags.length === 0) {
      console.warn('[Backend] Nenhuma tag encontrada no HTML do linkbuilder.');
    }

    res.json({ tags });
  } catch (error: any) {
    console.error('[Backend] Erro ao buscar tags ML:', error?.response?.status, error?.message);
    res.status(500).json({ error: String(error?.message || error) });
  }
});

app.listen(PORT, () => {
  console.log(`Backend API running on port ${PORT}`);
});
