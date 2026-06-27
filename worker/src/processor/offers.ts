import axios from 'axios';
import * as cheerio from 'cheerio';
import prisma from '../lib/prisma.js';
import { scrapeProductData } from './scraper.js';
import { convertToAffiliateLink } from './affiliate.js';

/**
 * Busca as ofertas do Mercado Livre, retorna a quantidade de links encontrados,
 * e em segundo plano (async) processa cada um e insere na fila de mensagens.
 */
export async function fetchAndQueueOffers(
  instanceId: string,
  destGroupIds: string[],
  userId: string,
  delaySeconds: number = 3
): Promise<number> {
  const url = 'https://www.mercadolivre.com.br/ofertas';
  
  // Buscar os cookies do usuário, caso precise para bypass
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('Usuário não encontrado.');
  }

  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
  };

  if (user.mercadolivreCookie) {
    headers['Cookie'] = user.mercadolivreCookie;
  }

  const response = await axios.get(url, { headers, timeout: 15000 });
  const html = response.data;
  const $ = cheerio.load(html);

  const productLinks: Set<string> = new Set();
  
  $('a').each((i, el) => {
    const href = $(el).attr('href');
    if (href && (href.includes('/p/') || href.includes('produto.mercadolivre.com.br/'))) {
      // Limpa os parametros da URL inicial para evitar duplicatas por tracking
      try {
        const parsedUrl = new URL(href.startsWith('//') ? `https:${href}` : href);
        parsedUrl.search = '';
        parsedUrl.hash = '';
        productLinks.add(parsedUrl.toString());
      } catch (e) {
        // ignora erro de parse
      }
    }
  });

  const uniqueLinks = Array.from(productLinks);

  // Inicia o processamento em segundo plano
  if (uniqueLinks.length > 0) {
    processOffersQueueBackground(uniqueLinks, instanceId, destGroupIds, user, delaySeconds).catch(err => {
      console.error('[Offers] Erro no processamento em segundo plano:', err);
    });
  }

  return uniqueLinks.length;
}

async function processOffersQueueBackground(
  links: string[],
  instanceId: string,
  destGroupIds: string[],
  user: any,
  delaySeconds: number
) {
  console.log(`[Offers] Iniciando processamento de ${links.length} ofertas em segundo plano...`);
  
  const destGroupsStr = destGroupIds.join(',');

  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    console.log(`[Offers] Processando (${i + 1}/${links.length}): ${link}`);

    try {
      // Raspar detalhes reais (Preço, Titulo, Imagem) usando o cookie do usuário
      const productData = await scrapeProductData(link, user.mercadolivreCookie);
      
      // Converte para link de afiliado
      const convertedUrl = await convertToAffiliateLink(link, user);

      // Constrói a Copy
      const emojiTitle = '📦';
      const emojiOffer = '🔥';
      const emojiCheck = '✅';
      const emojiPix = '🤑';

      let priceText = `💰 *Por Apenas:* ${productData.price}\n`;
      if (productData.pixPrice) {
        priceText += `${emojiPix} *Ou no Pix por:* ${productData.pixPrice}\n`;
      }

      const copy = `${emojiOffer} *OFERTA DO DIA!* ${emojiOffer}\n\n` +
                   `${emojiTitle} *Produto:* ${productData.title}\n` +
                   `${priceText}\n` +
                   `${emojiCheck} *Acesse aqui:* ${convertedUrl}\n\n` +
                   `⚠️ _Oferta sujeita a disponibilidade!_`;

      // Insere na fila de disparo
      await prisma.messageQueue.create({
        data: {
          originalUrl: link,
          convertedUrl,
          title: productData.title,
          price: productData.price,
          imageUrl: productData.imageUrl,
          copy,
          status: 'PENDING',
          sourceGroup: 'OFERTAS_DO_DIA',
          destGroups: destGroupsStr,
          userId: user.id,
          instanceId
        }
      });
      
      console.log(`[Offers] Oferta (${i + 1}/${links.length}) adicionada à fila com sucesso.`);

    } catch (error) {
      console.error(`[Offers] Erro ao processar oferta ${link}:`, error);
    }

    // Esperar o delay configurado antes de ir para a próxima (exceto a última)
    if (i < links.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
    }
  }

  console.log(`[Offers] Finalizado processamento das ofertas.`);
}
