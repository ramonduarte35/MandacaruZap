import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';


dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5050;

app.use(cors());
app.use(express.json());

// Função auxiliar para obter o ID do primeiro usuário (seeded admin)
const getUserId = async (): Promise<string> => {
  const user = await prisma.user.findFirst();
  return user?.id || '';
};

// 1. Health check
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'OK', database: 'Connected' });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', database: 'Disconnected', error: String(error) });
  }
});

// 2. Listar instâncias do WhatsApp
app.get('/api/instances', async (req, res) => {
  try {
    const instances = await prisma.whatsappInstance.findMany({
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
  try {
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

// 3. Criar uma nova instância do WhatsApp
app.post('/api/instances', async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    const userId = await getUserId();
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
  try {
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
  try {
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
  try {
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

// 7. Listar mapeamento de grupos
app.get('/api/mappings', async (req, res) => {
  try {
    const mappings = await prisma.groupMapping.findMany({
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

  try {
    const userId = await getUserId();
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

// 9. Deletar mapeamento
app.delete('/api/mappings/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.groupMapping.delete({
      where: { id }
    });
    res.json({ success: true, message: 'Mapping deleted.' });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// 10. Listar logs de atividades
app.get('/api/logs', async (req, res) => {
  try {
    const logs = await prisma.log.findMany({
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

  try {
    const userId = await getUserId();
    
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
    const userId = await getUserId();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        amazonId: true,
        shopeeId: true,
        mercadolivreId: true,
        mercadolivreChannel: true,
        mercadolivreTool: true,
        mercadolivreWord: true,
        mercadolivreCookie: true
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
    mercadolivreCookie
  } = req.body;
  try {
    const userId = await getUserId();
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        amazonId,
        shopeeId,
        mercadolivreId,
        mercadolivreChannel,
        mercadolivreTool,
        mercadolivreWord,
        mercadolivreCookie
      },
      select: {
        amazonId: true,
        shopeeId: true,
        mercadolivreId: true,
        mercadolivreChannel: true,
        mercadolivreTool: true,
        mercadolivreWord: true,
        mercadolivreCookie: true
      }
    });
    res.json({ success: true, user: updatedUser });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.get('/api/affiliate/meli-tags', async (req, res) => {
  try {
    const userId = await getUserId();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { mercadolivreCookie: true }
    });

    if (!user?.mercadolivreCookie) {
      return res.status(400).json({ error: 'Cookie do Mercado Livre não configurado.' });
    }

    const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

    // As tags estão embutidas no HTML da página do linkbuilder como "tags":[...]
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
    // Extrai o array de tags do HTML: "tags":[{tag:"ramonduarte",...},...]
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
