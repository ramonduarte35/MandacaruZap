'use client';
import Link from 'next/link';
import { useState } from 'react';

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);

const ArrowRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
);

const FEATURES = [
  { icon: '🤖', title: 'Conversão Automática', desc: 'Todo link de produto que aparece nos seus grupos é convertido para o seu link de afiliado em segundos, sem intervenção manual.' },
  { icon: '🛒', title: 'Amazon, Shopee & Meli', desc: 'Suporte nativo aos 3 maiores marketplaces do Brasil. Inclui link.amazon, amzn.to, shp.ee, meli.la e muito mais.' },
  { icon: '📱', title: 'Multi-número', desc: 'Gerencie vários números de WhatsApp no mesmo painel. Ideal para quem administra múltiplos grupos e nichos.' },
  { icon: '⏰', title: 'Fila Inteligente', desc: 'Defina horário de envio, limite diário e intervalo mínimo entre mensagens para evitar banimentos.' },
  { icon: '🔇', title: 'Deduplificação', desc: 'Nunca envie o mesmo produto duas vezes. O sistema detecta links repetidos dentro da janela que você configurar.' },
  { icon: '📊', title: 'Dashboard Completo', desc: 'Veja em tempo real quantos links foram capturados, convertidos e enviados — por marketplace e por período.' },
];

const STEPS = [
  { n: '01', title: 'Conecte seu WhatsApp', desc: 'Escaneie o QR Code no painel. Suporte a múltiplos números.' },
  { n: '02', title: 'Configure seus IDs', desc: 'Insira seus IDs de afiliado da Amazon, Shopee e Mercado Livre.' },
  { n: '03', title: 'Defina as regras', desc: 'Escolha quais grupos monitorar e para quais grupos encaminhar.' },
  { n: '04', title: 'Lucre no automático', desc: 'Todo link vira comissão sua. Sem apertar um botão.' },
];

const PLANS = [
  {
    id: 'starter', name: 'Starter', price: 49, color: 'border-gray-700',
    badge: null,
    features: ['1 número de WhatsApp', '3 regras de roteamento', '30 mensagens/dia', 'Amazon, Shopee e Meli', 'Fila de envio', 'Dashboard básico'],
  },
  {
    id: 'pro', name: 'Pro', price: 99, color: 'border-emerald-500',
    badge: 'Mais popular',
    features: ['3 números de WhatsApp', '10 regras de roteamento', '100 mensagens/dia', 'Tudo do Starter', 'Ofertas do Dia (Meli)', 'Integração Telegram', 'Deduplificação avançada'],
  },
  {
    id: 'business', name: 'Business', price: 199, color: 'border-gray-700',
    badge: null,
    features: ['10 números de WhatsApp', 'Roteamentos ilimitados', '500 mensagens/dia', 'Tudo do Pro', 'Prioridade no suporte', 'SLA de uptime'],
  },
];

const FAQS = [
  { q: 'Meu número pode ser banido?', a: 'O MandacaruZap respeita limites de envio configuráveis (intervalo mínimo, limite diário, janela de horário) justamente para minimizar o risco de banimento. Recomendamos começar com volumes conservadores.' },
  { q: 'Funciona com qualquer número de WhatsApp?', a: 'Sim, funciona com números pessoais via WhatsApp Web. Para volumes maiores, recomendamos usar o WhatsApp Business para melhor estabilidade.' },
  { q: 'Preciso deixar o computador ligado?', a: 'Não. O MandacaruZap roda em servidor 24/7. Basta conectar o número uma vez pelo QR Code e o sistema funciona continuamente.' },
  { q: 'Posso cancelar a qualquer momento?', a: 'Sim. Sem fidelidade, sem multa. Você cancela pelo painel e o acesso continua até o fim do período pago.' },
  { q: 'O trial é realmente grátis?', a: 'Sim. 7 dias completos com funcionalidades do plano Starter, sem cartão de crédito. Só pedimos e-mail e senha.' },
];

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#090a0f] text-gray-100 font-sans overflow-x-hidden">
      {/* ── NAVBAR ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-gray-800/60 bg-[#090a0f]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center font-black text-[#0d0e12] text-sm">M</div>
            <span className="font-bold text-lg font-mono tracking-wide">MandacaruZap</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-400">
            <a href="#como-funciona" className="hover:text-gray-100 transition-colors">Como funciona</a>
            <a href="#recursos" className="hover:text-gray-100 transition-colors">Recursos</a>
            <a href="#precos" className="hover:text-gray-100 transition-colors">Preços</a>
            <a href="#faq" className="hover:text-gray-100 transition-colors">FAQ</a>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <Link href="/app" className="text-sm text-gray-400 hover:text-gray-100 transition-colors px-3 py-2">Entrar</Link>
            <Link href="/app?register=true" className="text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-[#0d0e12] px-4 py-2 rounded-xl transition-all shadow-lg shadow-emerald-500/20">
              Começar grátis
            </Link>
          </div>
          <button className="md:hidden p-2 text-gray-400" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#0d0e12] border-t border-gray-800 px-4 py-4 space-y-3">
            <a href="#como-funciona" className="block text-sm text-gray-300 py-2" onClick={() => setMobileMenuOpen(false)}>Como funciona</a>
            <a href="#recursos" className="block text-sm text-gray-300 py-2" onClick={() => setMobileMenuOpen(false)}>Recursos</a>
            <a href="#precos" className="block text-sm text-gray-300 py-2" onClick={() => setMobileMenuOpen(false)}>Preços</a>
            <a href="#faq" className="block text-sm text-gray-300 py-2" onClick={() => setMobileMenuOpen(false)}>FAQ</a>
            <div className="pt-2 flex flex-col gap-2">
              <Link href="/app" className="text-sm text-center text-gray-300 border border-gray-700 rounded-xl py-2.5">Entrar</Link>
              <Link href="/app?register=true" className="text-sm text-center font-bold bg-emerald-500 text-[#0d0e12] rounded-xl py-2.5">Começar grátis →</Link>
            </div>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section className="relative pt-32 pb-24 px-4 sm:px-6 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-emerald-500/8 blur-[120px] pointer-events-none" />
        <div className="absolute top-20 right-[-20%] w-[500px] h-[500px] rounded-full bg-emerald-900/20 blur-[100px] pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold px-4 py-2 rounded-full mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            7 dias grátis · Sem cartão de crédito
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight mb-6 bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent">
            Seus grupos de WhatsApp{' '}
            <span className="bg-gradient-to-r from-emerald-400 to-emerald-300 bg-clip-text text-transparent">gerando comissão</span>{' '}
            no automático
          </h1>

          <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            O MandacaruZap monitora seus grupos, converte todos os links de produto em links de afiliado <strong className="text-gray-200">seus</strong>, e reencaminha com a copy pronta. Amazon, Shopee e Mercado Livre.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              href="/app?register=true"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-[#0d0e12] font-bold text-base px-8 py-4 rounded-2xl transition-all shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5"
            >
              Começar trial de 7 dias grátis <ArrowRight />
            </Link>
            <Link href="/app" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white font-semibold text-base px-8 py-4 rounded-2xl transition-all">
              Já tenho conta
            </Link>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
            {[
              { value: '3', label: 'Marketplaces' },
              { value: '7 dias', label: 'Trial grátis' },
              { value: '24/7', label: 'Automação' },
            ].map((s) => (
              <div key={s.label} className="bg-[#14161f] border border-gray-800 rounded-2xl px-3 py-4 text-center">
                <div className="text-2xl font-black text-emerald-400">{s.value}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMO FUNCIONA ── */}
      <section id="como-funciona" className="py-24 px-4 sm:px-6 border-t border-gray-800/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">Como funciona</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold mt-3 mb-4">Configurado em minutos</h2>
            <p className="text-gray-400 max-w-xl mx-auto">Sem código, sem técnico. Você mesmo configura em menos de 10 minutos.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((step, i) => (
              <div key={step.n} className="relative bg-[#14161f] border border-gray-800 rounded-2xl p-6 hover:border-emerald-500/30 transition-all group">
                {i < STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-8 -right-3 z-10 text-gray-700 group-hover:text-emerald-500/50 transition-colors">
                    <ArrowRight />
                  </div>
                )}
                <div className="text-4xl font-black text-emerald-500/20 font-mono mb-4">{step.n}</div>
                <h3 className="font-bold text-base mb-2">{step.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── RECURSOS ── */}
      <section id="recursos" className="py-24 px-4 sm:px-6 bg-[#0d0e12]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">Recursos</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold mt-3 mb-4">Tudo que você precisa</h2>
            <p className="text-gray-400 max-w-xl mx-auto">Desenvolvido por afiliados para afiliados brasileiros.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-[#14161f] border border-gray-800 rounded-2xl p-6 hover:border-emerald-500/20 transition-all hover:-translate-y-1 group">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="font-bold text-base mb-2 group-hover:text-emerald-400 transition-colors">{f.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PREÇOS ── */}
      <section id="precos" className="py-24 px-4 sm:px-6 border-t border-gray-800/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">Preços</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold mt-3 mb-4">Simples e transparente</h2>
            <p className="text-gray-400 max-w-xl mx-auto">Todos os planos incluem trial de 7 dias grátis. Cancele quando quiser.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {PLANS.map((plan) => (
              <div key={plan.id} className={`relative bg-[#14161f] border-2 ${plan.color} rounded-3xl p-8 transition-all ${plan.badge ? 'shadow-2xl shadow-emerald-500/10 scale-[1.02]' : ''}`}>
                {plan.badge && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-[#0d0e12] text-xs font-black px-4 py-1.5 rounded-full whitespace-nowrap">
                    {plan.badge}
                  </div>
                )}
                <h3 className="font-black text-xl mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-gray-400 text-sm">R$</span>
                  <span className="text-5xl font-black">{plan.price}</span>
                  <span className="text-gray-400 text-sm">/mês</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-gray-300">
                      <span className="text-emerald-400 mt-0.5 flex-shrink-0"><CheckIcon /></span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/app?register=true"
                  className={`block text-center font-bold text-sm py-3.5 rounded-xl transition-all ${
                    plan.badge
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-[#0d0e12] shadow-lg shadow-emerald-500/20'
                      : 'border border-gray-700 hover:border-gray-500 text-gray-200 hover:text-white'
                  }`}
                >
                  Começar trial grátis
                </Link>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-gray-500 mt-8">
            Todos os planos incluem 7 dias de trial gratuito · Sem cartão de crédito · Cancele quando quiser
          </p>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-24 px-4 sm:px-6 bg-[#0d0e12]">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">Dúvidas</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold mt-3">Perguntas frequentes</h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className="bg-[#14161f] border border-gray-800 rounded-2xl overflow-hidden">
                <button
                  className="w-full text-left px-6 py-5 flex items-center justify-between gap-4 hover:bg-[#1a1d29] transition-colors"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="font-semibold text-sm text-gray-100">{faq.q}</span>
                  <span className={`text-emerald-400 flex-shrink-0 transition-transform duration-200 ${openFaq === i ? 'rotate-45' : ''}`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </span>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 text-sm text-gray-400 leading-relaxed border-t border-gray-800 pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="py-24 px-4 sm:px-6 border-t border-gray-800/50">
        <div className="max-w-3xl mx-auto text-center">
          <div className="relative bg-gradient-to-br from-emerald-950/60 to-[#14161f] border border-emerald-500/20 rounded-3xl p-12 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent pointer-events-none" />
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">
              Pronto para automatizar suas comissões?
            </h2>
            <p className="text-gray-400 mb-8 text-lg">
              Crie sua conta agora. 7 dias grátis, sem cartão.
            </p>
            <Link
              href="/app?register=true"
              className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-[#0d0e12] font-black text-lg px-10 py-4 rounded-2xl transition-all shadow-2xl shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:-translate-y-0.5"
            >
              Criar conta grátis <ArrowRight />
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-gray-800 py-10 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center font-black text-[#0d0e12] text-xs">M</div>
            <span className="font-bold font-mono text-sm text-gray-400">MandacaruZap</span>
          </div>
          <p className="text-xs text-gray-600 text-center">
            © {new Date().getFullYear()} MandacaruZap. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-4 text-xs text-gray-600">
            <a href="#" className="hover:text-gray-400 transition-colors">Termos</a>
            <a href="#" className="hover:text-gray-400 transition-colors">Privacidade</a>
            <Link href="/app" className="hover:text-gray-400 transition-colors">Entrar</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
