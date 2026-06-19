import axios from 'axios';
import * as cheerio from 'cheerio';

interface ProductData {
  title: string;
  price: string;
  imageUrl: string;
}

/**
 * Faz a raspagem de metadados de links da Amazon, Shopee ou Mercado Livre.
 */
export async function scrapeProductData(url: string): Promise<ProductData> {
  const cleanUrl = url.trim();

  // Cabeçalhos otimizados: se passarmos o User-Agent do WhatsApp, as plataformas costumam renderizar as tags og:* no HTML estático sem barreiras de JS.
  const headers = {
    'User-Agent': 'WhatsApp/2.24.4.76 A',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
  };

  try {
    const response = await axios.get(cleanUrl, {
      headers,
      timeout: 10000,
      maxRedirects: 5
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // Extração genérica via tags Open Graph (comum para pré-visualização de redes sociais)
    let title = $('meta[property="og:title"]').attr('content') || 
                $('meta[name="twitter:title"]').attr('content') || 
                $('title').text();
                
    let imageUrl = $('meta[property="og:image"]').attr('content') || 
                   $('meta[name="twitter:image"]').attr('content') || '';
                   
    let price = $('meta[property="product:price:amount"]').attr('content') || 
                $('meta[property="og:description"]').attr('content')?.match(/R\$\s*\d+[\d.,]*/i)?.[0] || 
                '';

    // Se for Amazon, tenta seletores específicos adicionais se o OG falhar ou vier genérico
    if (cleanUrl.includes('amazon.com.br') || cleanUrl.includes('amzn.to')) {
      if (!price) {
        price = $('.a-price .a-offscreen').first().text() || 
                $('.a-price-whole').first().text() || 
                '';
      }
      if (!title || title.toLowerCase().includes('amazon')) {
        title = $('#productTitle').text().trim() || title;
      }
    }

    // Se for Mercado Livre
    if (cleanUrl.includes('mercadolivre.com.br') || cleanUrl.includes('mercadolivre.co')) {
      if (!price) {
        const fraction = $('.ui-pdp-price__part .andes-money-amount__fraction').first().text() ||
                         $('.andes-money-amount__fraction').first().text() ||
                         $('.price-tag-fraction').first().text() ||
                         '';
        const cents = $('.ui-pdp-price__part .andes-money-amount__cents').first().text() ||
                      $('.andes-money-amount__cents').first().text() ||
                      '';
        if (fraction) {
          price = cents ? `R$ ${fraction.trim()},${cents.trim()}` : `R$ ${fraction.trim()}`;
        }
      }
      if (!title || title.toLowerCase().includes('perfil social') || title.toLowerCase().includes('social')) {
        title = $('.ui-pdp-title').first().text().trim() || title;
      }
    }

    // Se for Shopee
    if (cleanUrl.includes('shopee.com.br') || cleanUrl.includes('shp.ee')) {
      // Como a Shopee é muito dinâmica, confiamos principalmente no OG injetado pelo bot handler.
      // Caso o preço esteja no título ou descrição (ex: "compre R$ 49,90"), o regex de price acima captura.
    }

    // Limpeza final de dados
    title = title ? title.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim() : 'Produto sem título';
    price = price ? price.trim() : 'Consulte no link';
    imageUrl = imageUrl ? imageUrl.trim() : '';

    // Remove termos indesejados de marcas no título
    if (title.length > 100) {
      title = title.substring(0, 97) + '...';
    }

    return {
      title,
      price,
      imageUrl
    };
  } catch (error) {
    console.error(`[Scraper] Error scraping URL ${url}:`, error);
    // Retorna fallback se houver falha de rede/scraping
    return {
      title: 'Produto em Oferta Especial',
      price: 'Confira no site',
      imageUrl: ''
    };
  }
}
