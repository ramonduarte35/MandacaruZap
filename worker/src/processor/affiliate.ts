import axios from 'axios';
import * as cheerio from 'cheerio';

// Cache de tags em memória: userId → { tags: string[], expiry: number }
const tagsCache = new Map<string, { tags: string[]; expiry: number }>();
const TAGS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora

/**
 * Busca as etiquetas (tags) cadastradas na conta de afiliado do Mercado Livre.
 * O resultado é cacheado por 1 hora para evitar requisições desnecessárias.
 */
async function getMeliAvailableTags(
  userId: string,
  cookie: string,
  userAgent: string
): Promise<string[]> {
  const now = Date.now();
  const cached = tagsCache.get(userId);
  if (cached && cached.expiry > now) {
    console.log(`[Affiliate] Tags (cache): ${JSON.stringify(cached.tags)}`);
    return cached.tags;
  }

  try {
    // As tags estão embutidas no HTML da página do linkbuilder como "tags":[...]
    const res = await axios.get('https://www.mercadolivre.com.br/afiliados/linkbuilder', {
      headers: {
        cookie,
        'user-agent': userAgent,
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'pt-BR,pt;q=0.9'
      },
      timeout: 8000
    });

    const html: string = res.data;
    const tagMatch = html.match(/"tags"\s*:\s*(\[[\s\S]*?\])/);

    if (tagMatch) {
      const tagsArray = JSON.parse(tagMatch[1]);
      const tags: string[] = tagsArray
        .map((t: any) => (typeof t === 'string' ? t : t.tag || t.name || t.id))
        .filter(Boolean);

      if (tags.length > 0) {
        tagsCache.set(userId, { tags, expiry: now + TAGS_CACHE_TTL_MS });
        console.log(`[Affiliate] Tags disponíveis (via HTML scraping): ${JSON.stringify(tags)}`);
        return tags;
      }
    }

    console.warn('[Affiliate] Nenhuma tag encontrada no HTML do linkbuilder.');
  } catch (err: any) {
    console.warn('[Affiliate] Falha ao buscar tags do ML:', err?.response?.status, err?.message);
  }

  return [];
}

/**
 * Acessa a página de perfil social do Mercado Livre e extrai o link direto da página de produto (PDP).
 */
async function extractMeliSocialProduct(socialUrl: string): Promise<string> {
  try {
    console.log(`[Affiliate] Social link detected. Trying to extract direct product URL from: ${socialUrl}`);
    const response = await axios.get(socialUrl, {
      headers: {
        'User-Agent': 'WhatsApp/2.24.4.76 A',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      timeout: 8000
    });
    
    const $ = cheerio.load(response.data);
    let productUrl = '';
    
    $('a').each((i, el) => {
      const href = $(el).attr('href') || '';
      if (href.includes('produto.mercadolivre.com.br/MLB-') || href.includes('mercadolivre.com.br/p/MLB-')) {
        const absoluteHref = href.startsWith('//') ? `https:${href}` : href;
        const parsed = new URL(absoluteHref);
        const searchVariation = parsed.searchParams.get('searchVariation');
        parsed.search = '';
        parsed.hash = '';
        if (searchVariation) {
          parsed.searchParams.set('searchVariation', searchVariation);
        }
        productUrl = parsed.toString();
        return false; // break
      }
    });
    
    if (productUrl) {
      console.log(`[Affiliate] Extracted direct product link from social page: ${productUrl}`);
      return productUrl;
    }
  } catch (err) {
    console.warn(`[Affiliate] Failed to extract product URL from social link: ${socialUrl}`, err);
  }
  return socialUrl;
}

interface UserAffiliateConfig {
  id?: string;
  amazonId?: string | null;
  shopeeId?: string | null;
  mercadolivreId?: string | null;
  mercadolivreChannel?: string | null;
  mercadolivreTool?: string | null;
  mercadolivreWord?: string | null;
  mercadolivreCookie?: string | null;
}

/**
 * Resolve encurtadores e redirecionamentos para obter a URL final real do produto.
 */
export async function expandUrl(url: string): Promise<string> {
  const shortDomains = ['amzn.to', 'shp.ee', 'mercadolivre.co', 'meli.la', 't.co', 'bit.ly', 'tinyurl.com'];
  const parsedUrl = new URL(url);

  if (!shortDomains.some(domain => parsedUrl.hostname.includes(domain))) {
    if (parsedUrl.hostname.includes('mercadolivre.com.br') && parsedUrl.pathname.includes('/social/')) {
      return extractMeliSocialProduct(url);
    }
    return url;
  }

  try {
    // Tenta HEAD primeiro para performance
    const response = await axios.head(url, {
      maxRedirects: 5,
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    let expanded = response.request.res.responseUrl || url;
    if (expanded.includes('account-verification') || expanded.includes('login') || expanded.includes('captcha')) {
      expanded = url;
    }
    if (expanded.includes('mercadolivre.com.br') && expanded.includes('/social/')) {
      return extractMeliSocialProduct(expanded);
    }
    return expanded;
  } catch (error) {
    try {
      // Fallback para GET caso o servidor rejeite HEAD
      const response = await axios.get(url, {
        maxRedirects: 5,
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      });
      let expanded = response.request.res.responseUrl || url;
      if (expanded.includes('account-verification') || expanded.includes('login') || expanded.includes('captcha')) {
        expanded = url;
      }
      if (expanded.includes('mercadolivre.com.br') && expanded.includes('/social/')) {
        return extractMeliSocialProduct(expanded);
      }
      return expanded;
    } catch (err) {
      console.warn(`[Affiliate] Failed to expand URL: ${url}. Using original.`, err);
      if (parsedUrl.hostname.includes('mercadolivre.com.br') && parsedUrl.pathname.includes('/social/')) {
        return extractMeliSocialProduct(url);
      }
      return url;
    }
  }
}

/**
 * Converte a URL do produto inserindo a tag/parâmetro de afiliado do usuário.
 */
export async function convertToAffiliateLink(
  url: string,
  user: UserAffiliateConfig
): Promise<string> {
  const expandedUrl = await expandUrl(url);
  const parsedUrl = new URL(expandedUrl);
  const hostname = parsedUrl.hostname.toLowerCase();

  // --- AMAZON ---
  if (hostname.includes('amazon.com.br')) {
    const amazonTag = user.amazonId || 'default-amazon-20'; // Tag padrão ou do usuário
    
    // Procura o ASIN na URL (10 caracteres alfanuméricos começando por B ou números)
    const asinMatch = expandedUrl.match(/\/([A-Z0-9]{10})(?:[\/?]|$)/i);
    
    if (asinMatch && asinMatch[1]) {
      const asin = asinMatch[1];
      return `https://www.amazon.com.br/dp/${asin}?tag=${amazonTag}`;
    }
    
    // Fallback: Apenas anexa a tag se não achar o ASIN estruturado
    parsedUrl.searchParams.set('tag', amazonTag);
    return parsedUrl.toString();
  }

  // --- SHOPEE ---
  if (hostname.includes('shopee.com.br')) {
    const shopeeSubId = user.shopeeId || 'defaultshopee';
    
    // Remove parâmetros de rastreamento de terceiros
    const paramsToRemove = ['spm', 'smtt', 'utm_source', 'utm_medium', 'utm_campaign', 'cv_id'];
    paramsToRemove.forEach(p => parsedUrl.searchParams.delete(p));
    
    // O sistema de afiliados da Shopee permite o parâmetro sub_id ou customId para links diretos de afiliados
    parsedUrl.searchParams.set('sub_id', shopeeSubId);
    parsedUrl.searchParams.set('utm_source', 'whatsapp-bot');
    
    return parsedUrl.toString();
  }

  // --- MERCADO LIVRE ---
  if (hostname.includes('mercadolivre.com.br')) {
    // --- FLOW 1: GERADOR VIA COOKIES (Recomendado) ---
    if (user.mercadolivreCookie) {
      try {
        console.log(`[Affiliate] Iniciando geração de link via cookie para: ${expandedUrl}`);

        let currentCookie = user.mercadolivreCookie.trim();
        const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

        // 1. GET na página do linkbuilder para refrescar cookies e obter CSRF token
        const pageResponse = await axios.get('https://www.mercadolivre.com.br/afiliados/linkbuilder', {
          headers: {
            cookie: currentCookie,
            'user-agent': userAgent,
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
          },
          timeout: 8000
        });

        // 2. Mesclar novos cookies do set-cookie para manter sessão viva
        const setCookieHeaders: string[] = pageResponse.headers['set-cookie'] || [];
        const cookieMap: Record<string, string> = {};

        currentCookie.split(';').forEach(c => {
          const [key, ...val] = c.trim().split('=');
          if (key) cookieMap[key.trim()] = val.join('=');
        });
        setCookieHeaders.forEach(c => {
          const cookiePart = c.split(';')[0];
          const [key, ...val] = cookiePart.trim().split('=');
          if (key) cookieMap[key.trim()] = val.join('=');
        });

        const mergedCookie = Object.entries(cookieMap)
          .map(([k, v]) => `${k}=${v}`)
          .join('; ');

        // Persiste o cookie atualizado no banco
        if (user.id) {
          try {
            const prisma = (await import('../lib/prisma')).default;
            await prisma.user.update({
              where: { id: user.id },
              data: { mercadolivreCookie: mergedCookie }
            });
            console.log(`[Affiliate] Cookie atualizado e persistido para o usuário ${user.id}`);
          } catch (dbErr) {
            console.error('[Affiliate] Erro ao salvar cookie no banco:', dbErr);
          }
        }

        // 3. Extrair CSRF token do HTML da página
        const html = pageResponse.data as string;
        const csrfMatch =
          html.match(/csrf-token"\s+content="([^"]+)"/i) ||
          html.match(/"csrfToken"\s*:\s*"([^"]+)"/i) ||
          html.match(/csrfToken\s*=\s*"([^"]+)"/i);
        const csrfToken = csrfMatch ? csrfMatch[1] : '';
        console.log(`[Affiliate] CSRF Token: ${csrfToken ? 'ENCONTRADO' : 'NÃO ENCONTRADO'}`);

        // 4. Buscar tags disponíveis via API e escolher a correta
        const availableTags = user.id
          ? await getMeliAvailableTags(user.id, mergedCookie, userAgent)
          : [];

        let chosenTag = user.mercadolivreChannel || '';

        if (availableTags.length > 0) {
          if (chosenTag && availableTags.includes(chosenTag)) {
            // Tag configurada pelo usuário é válida — usa ela
            console.log(`[Affiliate] Tag configurada é válida: "${chosenTag}"`);
          } else {
            // Tag configurada não existe ou não está definida — usa a primeira disponível
            chosenTag = availableTags[0];
            console.log(`[Affiliate] Tag configurada não encontrada. Usando primeira disponível: "${chosenTag}"`);
          }
        } else if (!chosenTag) {
          chosenTag = 'myshoplist'; // último fallback
          console.warn(`[Affiliate] Não foi possível obter tags da API. Usando fallback: "${chosenTag}"`);
        }

        // 5. Chamada POST para gerar o link afiliado encurtado
        const postHeaders: Record<string, string> = {
          cookie: mergedCookie,
          'user-agent': userAgent,
          accept: 'application/json, text/plain, */*',
          'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'content-type': 'application/json',
          origin: 'https://www.mercadolivre.com.br',
          referer: 'https://www.mercadolivre.com.br/afiliados/linkbuilder',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin'
        };
        if (csrfToken) postHeaders['x-csrf-token'] = csrfToken;

        console.log(`[Affiliate] Chamando createLink com tag="${chosenTag}"`);
        const createLinkResponse = await axios.post(
          'https://www.mercadolivre.com.br/affiliate-program/api/v2/affiliates/createLink',
          { urls: [expandedUrl], tag: chosenTag },
          { headers: postHeaders, timeout: 10000 }
        );

        const responseData = createLinkResponse.data;
        console.log('[Affiliate] Resposta da API ML:', JSON.stringify(responseData).substring(0, 500));

        // 6. Extrair o link gerado da resposta (a API retorna urls[].short_url)
        let generatedUrl = '';
        if (responseData && Array.isArray(responseData.urls)) {
          const successItem = responseData.urls.find((u: any) => !u.error_code && (u.short_url || u.shortened_url || u.shortenedUrl || u.link || u.url));
          if (successItem) {
            generatedUrl = successItem.short_url || successItem.shortened_url || successItem.shortenedUrl || successItem.link || successItem.url || '';
          }
        } else if (Array.isArray(responseData)) {
          const successItem = responseData.find((u: any) => !u.error_code && (u.short_url || u.shortened_url || u.shortenedUrl || u.link || u.url));
          if (successItem) {
            generatedUrl = successItem.short_url || successItem.shortened_url || successItem.shortenedUrl || successItem.link || successItem.url || '';
          }
        } else if (responseData) {
          generatedUrl =
            responseData.short_url ||
            responseData.shortened_url ||
            responseData.shortenedUrl ||
            responseData.link ||
            responseData.url ||
            '';
        }

        if (generatedUrl) {
          console.log(`[Affiliate] ✅ Link afiliado gerado: ${generatedUrl}`);
          return generatedUrl;
        }

        // Loga os erros detalhados da resposta para diagnóstico
        if (responseData?.urls) {
          const errors = responseData.urls.filter((u: any) => u.error_code);
          if (errors.length > 0) {
            console.warn('[Affiliate] Erros na criação de link:', JSON.stringify(errors));
          }
        }
        console.warn('[Affiliate] Não foi possível extrair URL gerada. Indo para fallback.');
      } catch (apiErr: any) {
        console.error('[Affiliate] Erro no fluxo de cookie ML:', apiErr?.response?.status, apiErr?.message);
      }
    }

    // --- FLOW 2: RECONSTRUÇÃO DE LINK SOCIAL (Fallback 1) ---
    if (parsedUrl.pathname.includes('/social/')) {
      const channel = user.mercadolivreChannel || 'defaultchannel';
      const tool = user.mercadolivreTool || '';
      const word = user.mercadolivreWord || '';

      const pathSegments = parsedUrl.pathname.split('/');
      const socialIndex = pathSegments.indexOf('social');
      if (socialIndex !== -1 && socialIndex + 1 < pathSegments.length) {
        pathSegments[socialIndex + 1] = channel;
      }
      parsedUrl.pathname = pathSegments.join('/');

      const paramsToRemove = ['matt_tool', 'matt_word', 'matt_source', 'matt_campaign', 'utm_source', 'utm_medium', 'utm_campaign'];
      paramsToRemove.forEach(p => parsedUrl.searchParams.delete(p));

      if (tool) parsedUrl.searchParams.set('matt_tool', tool);
      if (word) parsedUrl.searchParams.set('matt_word', word);
      parsedUrl.searchParams.set('forceInApp', 'true');
      
      if (!parsedUrl.hash) {
        parsedUrl.hash = 'origin=copy_link';
      }
      
      return parsedUrl.toString();
    }

    // --- FLOW 3: CUSTOM ID (Fallback 2) ---
    const mlTag = user.mercadolivreId || 'defaultml';
    const paramsToRemove = ['matt_tool', 'matt_word', 'matt_source', 'matt_campaign', 'utm_source', 'utm_medium', 'utm_campaign'];
    paramsToRemove.forEach(p => parsedUrl.searchParams.delete(p));
    
    parsedUrl.searchParams.set('customId', mlTag);
    parsedUrl.searchParams.set('utm_source', 'whatsapp-bot');
    
    return parsedUrl.toString();
  }

  // Se não pertencer a nenhuma plataforma mapeada, retorna a URL limpa de parâmetros comuns de tracking
  const commonTrackers = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'];
  commonTrackers.forEach(p => parsedUrl.searchParams.delete(p));
  
  return parsedUrl.toString();
}
