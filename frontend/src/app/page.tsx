"use client";

import React, { useState, useEffect } from 'react';
import { 
  QrCode, 
  Layers, 
  Send, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  LogOut,
  RefreshCw,
  Plus,
  Trash2,
  Check,
  X,
  Sliders,
  Menu,
  Clock,
  Tag
} from 'lucide-react';

// As chamadas usam path relativo (/api/...) — o Next.js faz o proxy para o backend
// via rewrite em next.config.js. Funciona em localhost e produção sem variável de ambiente.

interface Instance {
  id: string;
  name: string;
  phone: string | null;
  status: string;
  qrCode: string | null;
}

interface Mapping {
  id: string;
  name: string;
  sourceGroupId: string;
  sourceGroupName: string | null;
  destGroupIds: string;
  isActive: boolean;
  instance: { name: string } | null;
}

interface Log {
  id: string;
  originalUrl: string;
  convertedUrl: string | null;
  title: string | null;
  price: string | null;
  imageUrl: string | null;
  status: string;
  errorMessage: string | null;
  sourceGroup: string | null;
  destGroups: string | null;
  createdAt: string;
}

interface QueueItem {
  id: string;
  originalUrl: string;
  convertedUrl: string | null;
  title: string | null;
  price: string | null;
  imageUrl: string | null;
  copy: string;
  status: string;
  errorMessage: string | null;
  sourceGroup: string | null;
  destGroups: string;
  createdAt: string;
  sentAt: string | null;
}

export default function Dashboard() {
  // Estados de Autenticação
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; name: string | null } | null>(null);

  const [activeTab, setActiveTab] = useState<'overview' | 'instances' | 'mapping' | 'manual' | 'queue' | 'logs' | 'settings' | 'offers'>('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Estatísticas do Dashboard
  const [dashboardStats, setDashboardStats] = useState<{
    totalCaptured: number;
    capturedLast24h: number;
    totalSent: number;
    totalPending: number;
    totalFailed: number;
    activeInstances: number;
    capturedByPlatform?: {
      mercadolivre: number;
      shopee: number;
      amazon: number;
    };
    sentByPlatform?: {
      mercadolivre: number;
      shopee: number;
      amazon: number;
    };
  } | null>(null);
  const [isFetchingStats, setIsFetchingStats] = useState(false);
  
  // Configurações de Afiliado
  const [amazonId, setAmazonId] = useState('');
  const [shopeeId, setShopeeId] = useState('');
  const [mercadolivreId, setMercadolivreId] = useState('');
  const [mercadolivreChannel, setMercadolivreChannel] = useState('');
  const [mercadolivreTool, setMercadolivreTool] = useState('');
  const [mercadolivreWord, setMercadolivreWord] = useState('');
  const [newCookie, setNewCookie] = useState(''); // campo para inserir NOVO cookie
  const [hasCookie, setHasCookie] = useState(false); // indica se já existe cookie salvo
  const [meliAvailableTags, setMeliAvailableTags] = useState<string[]>([]);
  const [isFetchingTags, setIsFetchingTags] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSavedMessage, setSettingsSavedMessage] = useState(false);

  // Filtro de Marketplaces Monitorados
  const [listenAmazon, setListenAmazon] = useState(true);
  const [listenShopee, setListenShopee] = useState(true);
  const [listenMercadoLivre, setListenMercadoLivre] = useState(true);

  // Alerta de Cookie via WhatsApp
  const [cookieNotificationPhone, setCookieNotificationPhone] = useState('');

  // Apenas Links Curtos Meli
  const [mercadolivreOnlyShort, setMercadolivreOnlyShort] = useState(false);

  // Controle de Envio (Fila & Limites)
  const [sendWindowStart, setSendWindowStart] = useState('08:00');
  const [sendWindowEnd, setSendWindowEnd] = useState('18:00');
  const [dailyLimit, setDailyLimit] = useState(30);

  // Preço Mínimo
  const [minPriceAmazon, setMinPriceAmazon] = useState<number | null>(null);
  const [minPriceShopee, setMinPriceShopee] = useState<number | null>(null);
  const [minPriceMeli, setMinPriceMeli] = useState<number | null>(null);

  // Deduplificação
  const [enableDeduplication, setEnableDeduplication] = useState(false);
  const [deduplicationHours, setDeduplicationHours] = useState(24);

  // Telegram
  const [telegramBotToken, setTelegramBotToken] = useState('');

  // Menções
  const [mentionEveryone, setMentionEveryone] = useState(true);

  // Alterar Senha
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState<string | null>(null);
  const [changePasswordSuccess, setChangePasswordSuccess] = useState(false);

  // Fila de Envio
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isFetchingQueue, setIsFetchingQueue] = useState(false);
  const [sendingQueueItem, setSendingQueueItem] = useState<string | null>(null);

  // Ofertas do Dia
  const [offersInstanceId, setOffersInstanceId] = useState('');
  const [offersDestGroups, setOffersDestGroups] = useState('');
  const [offersDelay, setOffersDelay] = useState(3);
  const [isFetchingOffers, setIsFetchingOffers] = useState(false);
  const [offersResult, setOffersResult] = useState<{ count: number, message: string } | null>(null);
  const [offersError, setOffersError] = useState<string | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePasswordError(null);
    setChangePasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setChangePasswordError('A nova senha e a confirmação não coincidem.');
      return;
    }
    if (newPassword.length < 8) {
      setChangePasswordError('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await authenticatedFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (!res.ok) {
        setChangePasswordError(data.error || 'Erro ao alterar senha.');
      } else {
        setChangePasswordSuccess(true);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setChangePasswordSuccess(false), 4000);
      }
    } catch (err: any) {
      setChangePasswordError(err.message || 'Erro ao alterar senha.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  const authenticatedFetch = async (path: string, options: RequestInit = {}) => {
    const activeToken = token || localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
      ...(activeToken ? { 'Authorization': `Bearer ${activeToken}` } : {})
    };

    const res = await fetch(`${path}`, {
      ...options,
      headers
    });

    if (res.status === 401) {
      handleLogout();
      throw new Error('Sessão expirada. Faça login novamente.');
    }

    return res;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const res = await fetch(`/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });

      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || 'Erro ao realizar login.');
        return;
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setToken(data.token);
      setCurrentUser(data.user);
      setIsAuthenticated(true);
    } catch (err) {
      setLoginError('Não foi possível conectar ao servidor.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Carregamento de token na inicialização
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (savedToken) {
      setToken(savedToken);
      if (savedUser) {
        try {
          setCurrentUser(JSON.parse(savedUser));
        } catch (e) {
          console.error(e);
        }
      }
      setIsAuthenticated(true);
    }
  }, []);

  
  // Estados Dinâmicos
  const [instances, setInstances] = useState<Instance[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  
  // Estado de carregamento
  const [isLoading, setIsLoading] = useState(false);

  // Estados de formulários
  const [showNewInstanceModal, setShowNewInstanceModal] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState('');
  
  const [showNewMappingModal, setShowNewMappingModal] = useState(false);
  const [newMappingName, setNewMappingName] = useState('');
  const [selectedInstanceId, setSelectedInstanceId] = useState('');
  const [sourceGroupId, setSourceGroupId] = useState('');
  const [sourceGroupName, setSourceGroupName] = useState('');
  const [destGroupIds, setDestGroupIds] = useState('');

  // Disparo manual
  const [manualLink, setManualLink] = useState('');
  const [manualInstanceId, setManualInstanceId] = useState('');
  const [manualDestGroups, setManualDestGroups] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [convertedResult, setConvertedResult] = useState<any>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);

  // Grupos ativos da instância selecionada
  const [activeGroups, setActiveGroups] = useState<{ id: string, name: string }[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);

  const fetchMeliTags = async () => {
    setIsFetchingTags(true);
    try {
      const res = await authenticatedFetch('/api/affiliate/meli-tags');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.tags) && data.tags.length > 0) {
          setMeliAvailableTags(data.tags);
          if (!mercadolivreChannel || !data.tags.includes(mercadolivreChannel)) {
            setMercadolivreChannel(data.tags[0]);
          }
        }
      }
    } catch (e) {
      console.error('Erro ao buscar tags ML:', e);
    } finally {
      setIsFetchingTags(false);
    }
  };

  const fetchGroups = async (instanceId: string) => {
    if (!instanceId) {
      setActiveGroups([]);
      return;
    }
    setIsLoadingGroups(true);
    try {
      const res = await authenticatedFetch(`/api/instances/${instanceId}/groups`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.groups) {
          setActiveGroups(data.groups);
        } else {
          setActiveGroups([]);
        }
      } else {
        setActiveGroups([]);
      }
    } catch (err) {
      console.error('Error fetching groups:', err);
      setActiveGroups([]);
    } finally {
      setIsLoadingGroups(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) fetchGroups(selectedInstanceId);
  }, [selectedInstanceId, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) fetchGroups(manualInstanceId);
  }, [manualInstanceId, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) fetchGroups(offersInstanceId);
  }, [offersInstanceId, isAuthenticated]);

  const fetchInstances = async () => {
    try {
      const res = await authenticatedFetch('/api/instances');
      if (res.ok) {
        const data = await res.json();
        setInstances(data);
      }
    } catch (err) {
      console.error('Error fetching instances:', err);
    }
  };

  const fetchDashboardStats = async () => {
    setIsFetchingStats(true);
    try {
      const res = await authenticatedFetch('/api/dashboard/stats');
      if (res.ok) {
        const data = await res.json();
        setDashboardStats(data);
      }
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    } finally {
      setIsFetchingStats(false);
    }
  };

  const fetchMappings = async () => {
    try {
      const res = await authenticatedFetch('/api/mappings');
      if (res.ok) {
        const data = await res.json();
        setMappings(data);
      }
    } catch (err) {
      console.error('Error fetching mappings:', err);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await authenticatedFetch('/api/logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
  };

  const fetchQueue = async () => {
    setIsFetchingQueue(true);
    try {
      const res = await authenticatedFetch('/api/queue');
      if (res.ok) {
        const data = await res.json();
        setQueue(data);
      }
    } catch (err) {
      console.error('Error fetching queue:', err);
    } finally {
      setIsFetchingQueue(false);
    }
  };

  const handleCancelQueueItem = async (id: string) => {
    if (!confirm('Deseja realmente cancelar este item da fila?')) return;
    try {
      const res = await authenticatedFetch(`/api/queue/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchQueue();
        fetchLogs();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Erro ao cancelar item.');
      }
    } catch (err) {
      console.error('Error cancelling queue item:', err);
      alert('Erro de conexão ao cancelar item.');
    }
  };

  const handleSendNowQueueItem = async (id: string) => {
    if (!confirm('Deseja enviar esta mensagem agora, ignorando a janela de horário?')) return;
    setSendingQueueItem(id);
    try {
      const res = await authenticatedFetch(`/api/queue/${id}/dispatch`, {
        method: 'POST'
      });
      if (res.ok) {
        fetchQueue();
        fetchLogs();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Erro ao enviar item agora.');
      }
    } catch (err) {
      console.error('Error dispatching queue item:', err);
      alert('Erro de conexão ao tentar enviar agora.');
    } finally {
      setSendingQueueItem(null);
    }
  };

  const fetchAffiliateSettings = async () => {
    try {
      const res = await authenticatedFetch('/api/user/affiliate');
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setAmazonId(data.amazonId || '');
          setShopeeId(data.shopeeId || '');
          setMercadolivreId(data.mercadolivreId || '');
          setMercadolivreChannel(data.mercadolivreChannel || '');
          setMercadolivreTool(data.mercadolivreTool || '');
          setMercadolivreWord(data.mercadolivreWord || '');
          setHasCookie(data.hasCookie === true);
          setNewCookie(''); // limpa o campo de novo cookie ao recarregar
          setCookieNotificationPhone(data.cookieNotificationPhone || '');
          setListenAmazon(data.listenAmazon !== undefined ? data.listenAmazon : true);
          setListenShopee(data.listenShopee !== undefined ? data.listenShopee : true);
          setListenMercadoLivre(data.listenMercadoLivre !== undefined ? data.listenMercadoLivre : true);
          setMercadolivreOnlyShort(data.mercadolivreOnlyShort !== undefined ? data.mercadolivreOnlyShort : false);
          setSendWindowStart(data.sendWindowStart || '08:00');
          setSendWindowEnd(data.sendWindowEnd || '18:00');
          setDailyLimit(data.dailyLimit !== undefined ? data.dailyLimit : 30);
          setMinPriceAmazon(data.minPriceAmazon !== undefined ? data.minPriceAmazon : null);
          setMinPriceShopee(data.minPriceShopee !== undefined ? data.minPriceShopee : null);
          setMinPriceMeli(data.minPriceMeli !== undefined ? data.minPriceMeli : null);
          setEnableDeduplication(data.enableDeduplication === true);
          setDeduplicationHours(data.deduplicationHours !== undefined ? data.deduplicationHours : 24);
          setTelegramBotToken(data.telegramBotToken || '');
          setMentionEveryone(data.mentionEveryone !== undefined ? data.mentionEveryone : true);
        }
      }
    } catch (err) {
      console.error('Error fetching affiliate settings:', err);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setSettingsSavedMessage(false);
    try {
      const res = await authenticatedFetch('/api/user/affiliate', {
        method: 'POST',
        body: JSON.stringify({
          amazonId,
          shopeeId,
          mercadolivreId,
          mercadolivreChannel,
          mercadolivreTool,
          mercadolivreWord,
          // Só envia mercadolivreCookie se o usuário digitou um novo
          ...(newCookie.trim() ? { mercadolivreCookie: newCookie.trim() } : {}),
          cookieNotificationPhone,
          listenAmazon,
          listenShopee,
          listenMercadoLivre,
          mercadolivreOnlyShort,
          sendWindowStart,
          sendWindowEnd,
          dailyLimit: Number(dailyLimit),
          minPriceAmazon,
          minPriceShopee,
          minPriceMeli,
          enableDeduplication,
          deduplicationHours: Number(deduplicationHours),
          telegramBotToken,
          mentionEveryone
        })
      });
      if (res.ok) {
        setSettingsSavedMessage(true);
        setTimeout(() => setSettingsSavedMessage(false), 3000);
      } else {
        alert('Erro ao salvar as configurações.');
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      alert('Erro na conexão com o servidor.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Efeitos de carregamento condicionados ao estado logado
  useEffect(() => {
    if (isAuthenticated) {
      fetchDashboardStats();
      fetchInstances();
      fetchMappings();
      fetchLogs();
      fetchAffiliateSettings();
    }
  }, [isAuthenticated]);

  // Polling condicionado ao estado logado
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(() => {
      fetchInstances();
      if (activeTab === 'overview') fetchDashboardStats();
      if (activeTab === 'logs') fetchLogs();
      if (activeTab === 'queue') fetchQueue();
    }, 3000);

    return () => clearInterval(interval);
  }, [activeTab, isAuthenticated]);

  const handleCreateInstance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInstanceName) return;

    try {
      const res = await authenticatedFetch('/api/instances', {
        method: 'POST',
        body: JSON.stringify({ name: newInstanceName })
      });
      if (res.ok) {
        setNewInstanceName('');
        setShowNewInstanceModal(false);
        fetchInstances();
      }
    } catch (err) {
      console.error('Error creating instance:', err);
    }
  };

  const handleStartInstance = async (id: string) => {
    try {
      await authenticatedFetch(`/api/instances/${id}/start`, { method: 'POST' });
      fetchInstances();
    } catch (err) {
      console.error('Error starting instance:', err);
    }
  };

  const handleStopInstance = async (id: string) => {
    try {
      await authenticatedFetch(`/api/instances/${id}/stop`, { method: 'POST' });
      fetchInstances();
    } catch (err) {
      console.error('Error stopping instance:', err);
    }
  };

  const handleDeleteInstance = async (id: string) => {
    if (!confirm('Deseja excluir permanentemente este dispositivo?')) return;
    try {
      await authenticatedFetch(`/api/instances/${id}`, { method: 'DELETE' });
      fetchInstances();
    } catch (err) {
      console.error('Error deleting instance:', err);
    }
  };

  const handleCreateMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMappingName || !selectedInstanceId || !sourceGroupId || !destGroupIds) {
      alert('Preencha todos os campos!');
      return;
    }

    try {
      const res = await authenticatedFetch('/api/mappings', {
        method: 'POST',
        body: JSON.stringify({
          name: newMappingName,
          instanceId: selectedInstanceId,
          sourceGroupId,
          sourceGroupName,
          destGroupIds
        })
      });
      if (res.ok) {
        setNewMappingName('');
        setSelectedInstanceId('');
        setSourceGroupId('');
        setSourceGroupName('');
        setDestGroupIds('');
        setShowNewMappingModal(false);
        fetchMappings();
      }
    } catch (err) {
      console.error('Error creating mapping:', err);
    }
  };

  const handleDeleteMapping = async (id: string) => {
    if (!confirm('Excluir regra de mapeamento?')) return;
    try {
      await authenticatedFetch(`/api/mappings/${id}`, { method: 'DELETE' });
      fetchMappings();
    } catch (err) {
      console.error('Error deleting mapping:', err);
    }
  };

  const handleManualConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualLink || !manualInstanceId || !manualDestGroups) {
      alert('Por favor, preencha todos os parâmetros.');
      return;
    }

    setIsProcessing(true);
    setConvertedResult(null);
    setDispatchError(null);

    const destGroupIdsArray = manualDestGroups.split(',').map(g => g.trim()).filter(Boolean);

    try {
      const res = await authenticatedFetch('/api/manual-dispatch', {
        method: 'POST',
        body: JSON.stringify({
          instanceId: manualInstanceId,
          destGroupIds: destGroupIdsArray,
          url: manualLink
        })
      });

      const data = await res.json();
      setIsProcessing(false);

      if (res.ok && data.success) {
        setConvertedResult(data);
        setManualLink('');
        fetchLogs();
      } else {
        setDispatchError(data.error || 'Ocorreu um erro ao disparar.');
      }
    } catch (err) {
      setIsProcessing(false);
      setDispatchError('Erro na conexão com o servidor.');
      console.error('Error triggering manual dispatch:', err);
    }
  };

  const handleFetchOffers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offersInstanceId || !offersDestGroups) {
      alert('Por favor, preencha todos os parâmetros.');
      return;
    }

    setIsFetchingOffers(true);
    setOffersResult(null);
    setOffersError(null);

    const destGroupIdsArray = offersDestGroups.split(',').map(g => g.trim()).filter(Boolean);

    try {
      const res = await authenticatedFetch('/api/offers/fetch-and-queue', {
        method: 'POST',
        body: JSON.stringify({
          instanceId: offersInstanceId,
          destGroupIds: destGroupIdsArray,
          delaySeconds: offersDelay
        })
      });

      const data = await res.json();
      setIsFetchingOffers(false);

      if (res.ok && data.success) {
        setOffersResult({ count: data.count, message: data.message });
      } else {
        setOffersError(data.error || 'Ocorreu um erro ao buscar ofertas.');
      }
    } catch (err) {
      setIsFetchingOffers(false);
      setOffersError('Erro na conexão com o servidor.');
      console.error('Error fetching offers:', err);
    }
  };

    if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#090a0f] text-gray-100 flex flex-col justify-center items-center p-4 relative overflow-hidden">
        {/* Fundo Decorativo Gradiente */}
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-[#222533]/20 blur-[120px] pointer-events-none" />

        <div className="w-full max-w-md">
          {/* Logo / Header */}
          <div className="flex flex-col items-center gap-2 mb-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-[#0d0e12] font-black text-xl">
              M
            </div>
            <h1 className="font-extrabold text-2xl tracking-wider bg-gradient-to-r from-gray-100 to-gray-400 bg-clip-text text-transparent font-mono">
              MandacaruZap
            </h1>
            <p className="text-xs text-gray-500 font-medium">WhatsApp Affiliate SaaS Portal</p>
          </div>

          {/* Card de Login */}
          <div className="bg-[#14161f] border border-gray-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden backdrop-blur-md">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-emerald-500 to-emerald-300" />
            
            <h2 className="text-xl font-bold mb-1">Acessar sua conta</h2>
            <p className="text-xs text-gray-400 mb-6">Entre com seu e-mail e senha padrão fornecidos.</p>

            {loginError && (
              <div className="mb-6 flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs font-semibold animate-fadeIn">
                <AlertCircle size={16} className="flex-shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-xs text-gray-400 font-semibold mb-2">E-mail</label>
                <input 
                  type="email" 
                  placeholder="admin@mandacaruzap.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  className="w-full bg-[#0d0e12] border border-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-gray-200"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 font-semibold mb-2">Senha</label>
                <input 
                  type="password" 
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  className="w-full bg-[#0d0e12] border border-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-gray-200"
                />
              </div>

              <div className="pt-2">
                <button 
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 font-bold text-[#0d0e12] text-sm shadow-lg shadow-emerald-500/15 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoggingIn ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Verificando...</span>
                    </>
                  ) : (
                    <span>Acessar Painel</span>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Dica / Footer */}
          <div className="mt-8 text-center">
            <p className="text-[10px] text-gray-600">
              Caso seja o primeiro acesso, utilize o login padrão fornecido no seed do banco de dados.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0e12] text-gray-100 flex flex-col lg:flex-row font-sans relative overflow-hidden">
      {/* Overlay Mobile */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-all duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`w-64 bg-[#14161f] border-r border-gray-800 flex flex-col justify-between p-6 fixed inset-y-0 left-0 z-50 transform ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0 lg:static transition-transform duration-300 ease-in-out`}>
        <div>
          <div className="flex items-center justify-between gap-3 mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-green-500 to-emerald-400 flex items-center justify-center font-bold text-[#0d0e12] text-xl shadow-lg shadow-emerald-500/20">
                MZ
              </div>
              <div>
                <h1 className="font-bold text-lg leading-none">MandacaruZap</h1>
                <span className="text-xs text-emerald-400 font-medium">WhatsApp SaaS</span>
              </div>
            </div>
            {/* Botão de Fechar no Mobile */}
            <button 
              onClick={() => setIsMobileMenuOpen(false)}
              className="lg:hidden p-2 text-gray-400 hover:text-gray-200 hover:bg-[#1a1d29] rounded-lg transition-all"
            >
              <X size={18} />
            </button>
          </div>

          <nav className="space-y-1">
            <button 
              onClick={() => {
                setActiveTab('overview');
                setIsMobileMenuOpen(false);
                fetchDashboardStats();
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'overview' ? 'bg-[#222533] text-emerald-400 shadow-md shadow-black/10' : 'text-gray-400 hover:bg-[#1a1d29] hover:text-gray-200'}`}
            >
              <div className="w-5 flex justify-center"><CheckCircle size={18} /></div>
              Visão Geral
            </button>
            <button 
              onClick={() => {
                setActiveTab('instances');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'instances' ? 'bg-[#222533] text-emerald-400 shadow-md shadow-black/10' : 'text-gray-400 hover:bg-[#1a1d29] hover:text-gray-200'}`}
            >
              <QrCode size={18} />
              Conexões WhatsApp
            </button>
            <button 
              onClick={() => {
                setActiveTab('mapping');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'mapping' ? 'bg-[#222533] text-emerald-400 shadow-md shadow-black/10' : 'text-gray-400 hover:bg-[#1a1d29] hover:text-gray-200'}`}
            >
              <Layers size={18} />
              Mapeamento
            </button>
            <button 
              onClick={() => {
                setActiveTab('manual');
                setIsMobileMenuOpen(false);
                const firstConnected = instances.find(i => i.status === 'CONNECTED');
                if (firstConnected) setManualInstanceId(firstConnected.id);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'manual' ? 'bg-[#222533] text-emerald-400 shadow-md shadow-black/10' : 'text-gray-400 hover:bg-[#1a1d29] hover:text-gray-200'}`}
            >
              <Send size={18} />
              Disparo Manual
            </button>
            <button 
              onClick={() => {
                setActiveTab('logs');
                setIsMobileMenuOpen(false);
                fetchLogs();
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'logs' ? 'bg-[#222533] text-emerald-400 shadow-md shadow-black/10' : 'text-gray-400 hover:bg-[#1a1d29] hover:text-gray-200'}`}
            >
              <FileText size={18} />
              Logs & Histórico
            </button>
            <button 
              onClick={() => {
                setActiveTab('queue');
                setIsMobileMenuOpen(false);
                fetchQueue();
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'queue' ? 'bg-[#222533] text-emerald-400 shadow-md shadow-black/10' : 'text-gray-400 hover:bg-[#1a1d29] hover:text-gray-200'}`}
            >
              <Clock size={18} />
              Fila de Disparo
            </button>
            <button 
              onClick={() => {
                setActiveTab('offers');
                setIsMobileMenuOpen(false);
                const firstConnected = instances.find(i => i.status === 'CONNECTED');
                if (firstConnected) setOffersInstanceId(firstConnected.id);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'offers' ? 'bg-[#222533] text-emerald-400 shadow-md shadow-black/10' : 'text-gray-400 hover:bg-[#1a1d29] hover:text-gray-200'}`}
            >
              <Tag size={18} />
              Ofertas do Dia
            </button>
            <button 
              onClick={() => {
                setActiveTab('settings');
                setIsMobileMenuOpen(false);
                fetchAffiliateSettings();
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'settings' ? 'bg-[#222533] text-emerald-400 shadow-md shadow-black/10' : 'text-gray-400 hover:bg-[#1a1d29] hover:text-gray-200'}`}
            >
              <Sliders size={18} />
              Configurações
            </button>
          </nav>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#1b1d29] mb-4">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center font-bold text-emerald-400 text-sm flex-shrink-0 uppercase">
                {currentUser?.name ? currentUser.name.substring(0, 2) : 'US'}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold truncate">{currentUser?.name || 'Usuário SaaS'}</p>
                <p className="text-[10px] text-gray-500 truncate">{currentUser?.email || 'email@provedor.com'}</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="text-gray-400 hover:text-red-400 p-1.5 hover:bg-[#222533] rounded-lg transition-all flex-shrink-0"
              title="Sair do sistema"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area Container */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Top Header Mobile */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-[#14161f] border-b border-gray-800 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 -ml-2 text-gray-400 hover:text-gray-200 rounded-lg hover:bg-[#1a1d29] transition-all"
              aria-label="Abrir menu"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-green-500 to-emerald-400 flex items-center justify-center font-bold text-[#0d0e12] text-sm shadow-md shadow-emerald-500/10">
                MZ
              </div>
              <span className="font-bold text-sm tracking-wider font-mono">MandacaruZap</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center font-bold text-emerald-400 text-xs uppercase">
              {currentUser?.name ? currentUser.name.substring(0, 2) : 'US'}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <header className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-xl md:text-2xl font-bold font-mono">
                {activeTab === 'overview' && 'Visão Geral'}
                {activeTab === 'instances' && 'Conexões do WhatsApp'}
                {activeTab === 'mapping' && 'Mapeamento'}
                {activeTab === 'manual' && 'Gerador & Disparo Manual'}
                {activeTab === 'offers' && 'Ofertas do Dia (Mercado Livre)'}
                {activeTab === 'queue' && 'Fila de Disparo'}
                {activeTab === 'logs' && 'Logs e Atividades'}
                {activeTab === 'settings' && 'Configurações de Afiliado'}
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                {activeTab === 'overview' && 'Métricas e estatísticas em tempo real da sua operação.'}
                {activeTab === 'instances' && 'Gerencie seus múltiplos números de WhatsApp e sessões ativas.'}
                {activeTab === 'mapping' && 'Configure quais grupos de origem serão monitorados e quais grupos de destino receberão as ofertas.'}
                {activeTab === 'manual' && 'Cole links de produtos suportados para conversão de afiliados e disparo manual imediato.'}
                {activeTab === 'offers' && 'Busque as ofertas diárias do Mercado Livre e adicione-as automaticamente à fila de envio.'}
                {activeTab === 'queue' && 'Visualize e gerencie a fila de envio de mensagens pendentes.'}
                {activeTab === 'logs' && 'Histórico completo de links capturados, convertidos e mensagens enviadas.'}
                {activeTab === 'settings' && 'Configure seus IDs de afiliado da Amazon, Shopee e Mercado Livre para conversão automática.'}
              </p>
            </div>
          </header>

        {/* TAB 0: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fadeIn">
            {isFetchingStats && !dashboardStats ? (
              <div className="flex items-center justify-center p-12">
                <RefreshCw size={24} className="animate-spin text-emerald-500" />
              </div>
            ) : dashboardStats ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                <div className="bg-[#1a1d29] border border-gray-800 rounded-2xl p-5 flex flex-col gap-2 relative overflow-hidden transition-all hover:border-emerald-500/30">
                  <div className="absolute top-0 right-0 p-4 opacity-5 text-gray-300">
                    <Layers size={64} />
                  </div>
                  <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Capturadas</span>
                  <div className="text-3xl font-black text-gray-100">{dashboardStats.totalCaptured}</div>
                  <div className="text-xs text-emerald-400 font-medium">+{dashboardStats.capturedLast24h} nas últimas 24h</div>
                </div>

                <div className="bg-[#1a1d29] border border-gray-800 rounded-2xl p-5 flex flex-col gap-2 relative overflow-hidden transition-all hover:border-emerald-500/30">
                  <div className="absolute top-0 right-0 p-4 opacity-5 text-emerald-500">
                    <Send size={64} />
                  </div>
                  <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Enviadas</span>
                  <div className="text-3xl font-black text-emerald-400">{dashboardStats.totalSent}</div>
                  <div className="text-xs text-gray-500 font-medium">Com sucesso</div>
                </div>

                <div className="bg-[#1a1d29] border border-gray-800 rounded-2xl p-5 flex flex-col gap-2 relative overflow-hidden transition-all hover:border-amber-500/30">
                  <div className="absolute top-0 right-0 p-4 opacity-5 text-amber-500">
                    <Clock size={64} />
                  </div>
                  <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Na Fila</span>
                  <div className="text-3xl font-black text-amber-400">{dashboardStats.totalPending}</div>
                  <div className="text-xs text-gray-500 font-medium">Aguardando envio</div>
                </div>

                <div className="bg-[#1a1d29] border border-gray-800 rounded-2xl p-5 flex flex-col gap-2 relative overflow-hidden transition-all hover:border-red-500/30">
                  <div className="absolute top-0 right-0 p-4 opacity-5 text-red-500">
                    <AlertCircle size={64} />
                  </div>
                  <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Falhas</span>
                  <div className="text-3xl font-black text-red-400">{dashboardStats.totalFailed}</div>
                  <div className="text-xs text-gray-500 font-medium">Erros de envio</div>
                </div>

                <div className="bg-[#1a1d29] border border-gray-800 rounded-2xl p-5 flex flex-col gap-2 relative overflow-hidden transition-all hover:border-blue-500/30">
                  <div className="absolute top-0 right-0 p-4 opacity-5 text-blue-500">
                    <QrCode size={64} />
                  </div>
                  <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Conexões Ativas</span>
                  <div className="text-3xl font-black text-blue-400">{dashboardStats.activeInstances}</div>
                  <div className="text-xs text-gray-500 font-medium">Sessões conectadas</div>
                </div>
              </div>
            ) : (
              <div className="text-gray-500 text-center p-8 bg-[#1a1d29] rounded-2xl border border-gray-800">
                Não foi possível carregar as estatísticas.
              </div>
            )}
            
            {dashboardStats && (
              <div className="bg-gradient-to-r from-[#14161f] to-[#1a1d29] border border-gray-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-[3px] h-full bg-emerald-500" />
                <h3 className="font-bold text-lg mb-2 text-gray-100 flex items-center gap-2">
                  Bem-vindo(a) ao Dashboard!
                </h3>
                <p className="text-sm text-gray-400 max-w-3xl">
                  Aqui você tem um resumo rápido da sua operação de afiliação via WhatsApp. 
                  Sua taxa de aproveitamento atual é de aproximadamente <strong className="text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    {dashboardStats.totalCaptured > 0 ? ((dashboardStats.totalSent / dashboardStats.totalCaptured) * 100).toFixed(1) : '0'}%
                  </strong>. 
                  Isso representa a porcentagem de produtos lidos que foram disparados com sucesso para os seus grupos.
                </p>
              </div>
            )}

            {dashboardStats?.capturedByPlatform && dashboardStats?.sentByPlatform && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 animate-fadeIn">
                <div className="bg-[#1a1d29] border border-gray-800 rounded-2xl p-5 flex flex-col gap-3 relative overflow-hidden transition-all hover:border-emerald-500/30">
                  <h4 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Quantidade Capturada por Marketplace</h4>
                  <div className="flex justify-between items-center text-sm font-medium p-2 bg-[#14161f] rounded-xl border border-gray-800/50">
                    <span className="text-gray-300">Mercado Livre</span>
                    <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded">{dashboardStats.capturedByPlatform.mercadolivre}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-medium p-2 bg-[#14161f] rounded-xl border border-gray-800/50">
                    <span className="text-gray-300">Shopee</span>
                    <span className="text-amber-400 font-bold bg-amber-500/10 px-2.5 py-0.5 rounded">{dashboardStats.capturedByPlatform.shopee}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-medium p-2 bg-[#14161f] rounded-xl border border-gray-800/50">
                    <span className="text-gray-300">Amazon</span>
                    <span className="text-blue-400 font-bold bg-blue-500/10 px-2.5 py-0.5 rounded">{dashboardStats.capturedByPlatform.amazon}</span>
                  </div>
                </div>

                <div className="bg-[#1a1d29] border border-gray-800 rounded-2xl p-5 flex flex-col gap-3 relative overflow-hidden transition-all hover:border-emerald-500/30">
                  <h4 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Quantidade Enviada por Plataforma</h4>
                  <div className="flex justify-between items-center text-sm font-medium p-2 bg-[#14161f] rounded-xl border border-gray-800/50">
                    <span className="text-gray-300">Mercado Livre</span>
                    <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded">{dashboardStats.sentByPlatform.mercadolivre}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-medium p-2 bg-[#14161f] rounded-xl border border-gray-800/50">
                    <span className="text-gray-300">Shopee</span>
                    <span className="text-amber-400 font-bold bg-amber-500/10 px-2.5 py-0.5 rounded">{dashboardStats.sentByPlatform.shopee}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-medium p-2 bg-[#14161f] rounded-xl border border-gray-800/50">
                    <span className="text-gray-300">Amazon</span>
                    <span className="text-blue-400 font-bold bg-blue-500/10 px-2.5 py-0.5 rounded">{dashboardStats.sentByPlatform.amazon}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 1: INSTANCES */}
        {activeTab === 'instances' && (
          <div className="space-y-6">
            <div className="flex justify-end">
              <button 
                onClick={() => setShowNewInstanceModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 font-semibold text-[#0d0e12] text-sm shadow-lg shadow-emerald-500/15 transition-all"
              >
                <Plus size={16} /> Nova Conexão
              </button>
            </div>

            {instances.length === 0 ? (
              <div className="bg-[#14161f] border border-gray-800 rounded-2xl p-12 text-center text-gray-400">
                <QrCode size={48} className="mx-auto mb-4 text-gray-600" />
                <p className="font-semibold text-gray-300">Nenhum número conectado</p>
                <p className="text-xs text-gray-500 mt-1">Clique em "Nova Conexão" para gerar seu primeiro QR Code.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {instances.map(inst => (
                  <div key={inst.id} className="bg-[#14161f] border border-gray-800 rounded-2xl p-6 relative overflow-hidden shadow-xl flex flex-col justify-between min-h-[320px]">
                    <div>
                      {/* Status Indicator */}
                      <span className={`absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        inst.status === 'CONNECTED' ? 'bg-emerald-500/10 text-emerald-400' :
                        inst.status === 'QRCODE' ? 'bg-amber-500/10 text-amber-400' :
                        inst.status === 'CONNECTING' ? 'bg-blue-500/10 text-blue-400' :
                        'bg-gray-500/10 text-gray-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          inst.status === 'CONNECTED' ? 'bg-emerald-400 animate-pulse' :
                          inst.status === 'QRCODE' ? 'bg-amber-400 animate-pulse' :
                          inst.status === 'CONNECTING' ? 'bg-blue-400 animate-pulse' :
                          'bg-gray-400'
                        }`}></span>
                        {inst.status === 'CONNECTED' ? 'CONECTADO' :
                         inst.status === 'QRCODE' ? 'QR CODE ATIVO' :
                         inst.status === 'CONNECTING' ? 'CONECTANDO' : 'DESCONECTADO'}
                      </span>

                      <h3 className="font-semibold text-lg mt-2 pr-20 truncate">{inst.name}</h3>
                      <p className="text-xs text-gray-500 mt-1">{inst.phone ? `+${inst.phone}` : 'Sem número associado'}</p>
                    </div>

                    <div className="mt-6 flex flex-col items-center justify-center flex-1">
                      {inst.status === 'QRCODE' && inst.qrCode && (
                        <div className="w-full text-center">
                          <div className="w-44 h-44 bg-white rounded-xl mx-auto flex items-center justify-center border border-gray-200 p-2 shadow-inner">
                            {/* Renderiza o QR Code em Base64 real do Worker */}
                            <img src={inst.qrCode} alt="WhatsApp QR Code" className="w-full h-full object-contain" />
                          </div>
                          <p className="text-[10px] text-gray-400 mt-3 font-semibold">Escaneie com a câmera do seu celular.</p>
                        </div>
                      )}

                      {inst.status === 'CONNECTED' && (
                        <div className="w-full text-center py-4">
                          <CheckCircle size={48} className="text-emerald-400 mx-auto mb-2" />
                          <p className="text-xs text-emerald-400 font-semibold">Conectado e Monitorando</p>
                        </div>
                      )}

                      {inst.status === 'CONNECTING' && (
                        <div className="w-full text-center py-4 space-y-2">
                          <RefreshCw size={40} className="text-blue-400 animate-spin mx-auto" />
                          <p className="text-xs text-blue-400 font-medium">Iniciando sessão do WhatsApp...</p>
                        </div>
                      )}

                      {inst.status === 'DISCONNECTED' && (
                        <div className="w-full text-center py-4 space-y-4">
                          <AlertCircle size={48} className="text-gray-600 mx-auto" />
                          <button 
                            onClick={() => handleStartInstance(inst.id)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold hover:bg-emerald-500/20 transition-all mx-auto"
                          >
                            <RefreshCw size={12} /> Gerar Novo QR Code
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-800 flex gap-2">
                      {inst.status === 'CONNECTED' && (
                        <button 
                          onClick={() => handleStopInstance(inst.id)}
                          className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition-all flex-1 py-2 rounded-xl bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/5"
                        >
                          Parar Sessão
                        </button>
                      )}
                      <button 
                        onClick={() => handleDeleteInstance(inst.id)}
                        className="text-xs font-semibold text-red-400 hover:text-red-300 transition-all py-2 px-3 rounded-xl bg-red-500/5 hover:bg-red-500/10 border border-red-500/5"
                        title="Deletar dispositivo"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MAPPING */}
        {activeTab === 'mapping' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-[#14161f] border border-gray-800 rounded-2xl p-6 shadow-xl">
              <div>
                <h3 className="font-bold text-lg">Regras de Roteamento</h3>
                <p className="text-xs text-gray-500 mt-1">Conecte grupos de escuta a um ou mais grupos onde os links convertidos serão postados.</p>
              </div>
              <button 
                onClick={() => {
                  if (instances.length === 0) {
                    alert('Por favor, crie uma instância de WhatsApp primeiro!');
                    return;
                  }
                  setSelectedInstanceId(instances[0].id);
                  setShowNewMappingModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 font-semibold text-[#0d0e12] text-sm shadow-lg shadow-emerald-500/15 transition-all"
              >
                <Plus size={16} /> Novo
              </button>
            </div>

            {mappings.length === 0 ? (
              <div className="bg-[#14161f] border border-gray-800 rounded-2xl p-12 text-center text-gray-400">
                <Layers size={48} className="mx-auto mb-4 text-gray-600" />
                <p className="font-semibold text-gray-300">Nenhuma regra cadastrada</p>
                <p className="text-xs text-gray-500 mt-1">Clique em "Novo Mapeamento" para vincular grupos.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {mappings.map(map => (
                  <div key={map.id} className="bg-[#14161f] border border-gray-800 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xl">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h4 className="font-semibold text-base">{map.name}</h4>
                        <span className={`w-2.5 h-2.5 rounded-full ${map.isActive ? 'bg-emerald-400 shadow-emerald-400/20' : 'bg-gray-600'}`}></span>
                      </div>
                      
                      <div className="flex flex-col md:flex-row gap-4 md:gap-8 mt-4 text-xs text-gray-400">
                        <div>
                          <span className="text-gray-500 font-semibold">Número Vinculado:</span>
                          <p className="font-medium text-emerald-400 mt-0.5">{map.instance?.name || 'Indisponível'}</p>
                        </div>
                        <div>
                          <span className="text-gray-500 font-semibold">Grupo Fonte (JID):</span>
                          <p className="font-mono text-gray-300 mt-0.5">{map.sourceGroupId}</p>
                          <p className="text-[10px] text-gray-500 font-bold">{map.sourceGroupName || 'Origem'}</p>
                        </div>
                        <div className="flex-1">
                          <span className="text-gray-500 font-semibold">Grupos Destino:</span>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {map.destGroupIds.split(',').map((d, idx) => (
                              <span key={idx} className="bg-[#1b1d29] px-2 py-0.5 rounded text-[10px] text-emerald-400 border border-emerald-500/10 font-mono font-semibold" title={d}>
                                {d.length > 25 ? `${d.substring(0, 22)}...` : d}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleDeleteMapping(map.id)}
                        className="px-3 py-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all border border-red-500/10 text-xs font-semibold"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MANUAL DISPATCH */}
        {activeTab === 'manual' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <form onSubmit={handleManualConvert} className="bg-[#14161f] border border-gray-800 rounded-2xl p-6 shadow-xl space-y-6">
              <div>
                <h3 className="font-bold text-lg">Gerador de Link e Disparo Manual</h3>
                <p className="text-xs text-gray-500 mt-1">Cole qualquer link da Amazon, Shopee ou Mercado Livre para limpar, inserir seus ids de afiliado e disparar imediatamente para grupos específicos.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 font-semibold mb-2">Selecione o Dispositivo WhatsApp de Envio</label>
                  <select 
                    value={manualInstanceId}
                    onChange={(e) => setManualInstanceId(e.target.value)}
                    className="w-full bg-[#0d0e12] border border-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 text-gray-300"
                  >
                    <option value="">-- Escolha um dispositivo conectado --</option>
                    {instances.filter(i => i.status === 'CONNECTED').map(inst => (
                      <option key={inst.id} value={inst.id}>{inst.name} ({inst.phone ? `+${inst.phone}` : 's/n'})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 font-semibold mb-2">URL do Produto</label>
                  <input 
                    type="text" 
                    placeholder="https://www.amazon.com.br/dp/..."
                    value={manualLink}
                    onChange={(e) => setManualLink(e.target.value)}
                    required
                    className="w-full bg-[#0d0e12] border border-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-all text-gray-200"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 font-semibold mb-2">
                    Grupos Destino {isLoadingGroups && <span className="text-[10px] text-emerald-400 animate-pulse">(Buscando do WhatsApp...)</span>}
                  </label>
                  {activeGroups.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-3 bg-[#0d0e12] border border-gray-800 rounded-xl">
                      {activeGroups.map(group => {
                        const isChecked = manualDestGroups.split(',').includes(group.id);
                        return (
                          <label key={group.id} className="flex items-center gap-3 p-2 hover:bg-[#1a1d29] rounded-lg cursor-pointer transition-all">
                             <input 
                               type="checkbox" 
                               checked={isChecked}
                               onChange={(e) => {
                                 const current = manualDestGroups.split(',').map(g => g.trim()).filter(Boolean);
                                 if (e.target.checked) {
                                   if (!current.includes(group.id)) current.push(group.id);
                                 } else {
                                   const idx = current.indexOf(group.id);
                                   if (idx > -1) current.splice(idx, 1);
                                 }
                                 setManualDestGroups(current.join(','));
                               }}
                               className="rounded border-gray-800 text-emerald-500 focus:ring-emerald-500/20 bg-transparent"
                             />
                             <span className="text-xs text-gray-300 font-medium truncate">{group.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <input 
                      type="text" 
                      placeholder="120363029411@g.us, 120363029422@g.us"
                      value={manualDestGroups}
                      onChange={(e) => setManualDestGroups(e.target.value)}
                      required
                      className="w-full bg-[#0d0e12] border border-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 font-mono text-gray-300"
                    />
                  )}
                  <p className="text-[10px] text-gray-500 mt-1">Selecione ou insira os IDs (JIDs) dos grupos de WhatsApp para os quais deseja disparar.</p>
                </div>

                <div className="flex items-center gap-3 p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-xs text-emerald-400 font-semibold">
                    Aviso: O bot mencionará automaticamente todos os membros do grupo (@everyone) no momento do disparo.
                  </span>
                </div>

                <button 
                  type="submit"
                  disabled={isProcessing || !manualLink || !manualInstanceId || !manualDestGroups}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 font-semibold text-[#0d0e12] text-sm shadow-lg shadow-emerald-500/15 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? 'Processando Scraper e Disparando...' : 'Converter e Disparar Agora'}
                </button>
              </div>
            </form>

            {/* Resultado da conversão manual */}
            {convertedResult && (
              <div className="bg-[#14161f] border border-emerald-500/20 rounded-2xl p-6 shadow-xl space-y-4 animate-fadeIn">
                <h4 className="font-bold text-emerald-400 text-sm flex items-center gap-2">
                  <CheckCircle size={16} /> Link Convertido e Postado com Sucesso!
                </h4>

                <div className="p-4 bg-[#0d0e12] rounded-xl border border-gray-800 space-y-3">
                  <div>
                    <span className="text-[10px] text-gray-500 block">Produto</span>
                    <p className="text-xs font-semibold text-gray-200">{convertedResult.product?.title}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 block">Preço</span>
                    <p className="text-xs font-semibold text-emerald-400">{convertedResult.product?.price}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 block">URL de Afiliado Gerada</span>
                    <a href={convertedResult.convertedUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-blue-400 hover:underline truncate block">{convertedResult.convertedUrl}</a>
                  </div>
                </div>
              </div>
            )}

            {/* Mensagem de Erro */}
            {dispatchError && (
              <div className="bg-[#14161f] border border-red-500/20 rounded-2xl p-6 shadow-xl space-y-2">
                <h4 className="font-bold text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle size={16} /> Falha no Envio
                </h4>
                <p className="text-xs text-gray-400">{dispatchError}</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: LOGS */}
        {activeTab === 'logs' && (
          <div className="bg-[#14161f] border border-gray-800 rounded-2xl p-6 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-bold text-lg">Histórico de Atividade</h3>
                <p className="text-xs text-gray-500 mt-1">Acompanhe todas as captações de links de grupos de origem e envios realizados.</p>
              </div>
              <button 
                onClick={fetchLogs}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-gray-700 text-xs font-semibold text-gray-300 hover:bg-gray-800 transition-all"
              >
                <RefreshCw size={12} /> Atualizar Logs
              </button>
            </div>

            {logs.length === 0 ? (
              <div className="text-center py-12 text-gray-500 text-xs">Nenhum log registrado ainda.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-300">
                  <thead className="bg-[#0d0e12] text-xs text-gray-500 uppercase border-b border-gray-800">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Horário</th>
                      <th className="px-6 py-4 font-semibold">Produto</th>
                      <th className="px-6 py-4 font-semibold">Preço</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      <th className="px-6 py-4 font-semibold">Detalhes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {logs.map(log => (
                      <tr key={log.id} className="hover:bg-[#1a1d29]/50 transition-colors">
                        <td className="px-6 py-4 text-xs font-medium text-gray-500">
                          {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-6 py-4 text-xs font-semibold truncate max-w-[200px]" title={log.title || ''}>
                          {log.title || 'Sem título'}
                        </td>
                        <td className="px-6 py-4 text-xs text-emerald-400 font-semibold">{log.price || 'N/A'}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            log.status === 'SENT'   ? 'bg-emerald-500/10 text-emerald-400' :
                            log.status === 'QUEUED' ? 'bg-amber-500/10 text-amber-400' :
                                                      'bg-red-500/10 text-red-400'
                          }`}>
                            {log.status === 'SENT'   ? '✓ Enviado' :
                             log.status === 'QUEUED' ? '🕐 Na Fila' :
                                                       '✕ Falhou'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[10px] text-gray-400 max-w-[300px] truncate" title={log.errorMessage || log.convertedUrl || ''}>
                          {log.status === 'SENT'   ? log.convertedUrl :
                           log.status === 'QUEUED' ? 'Aguardando janela de envio...' :
                                                     log.errorMessage}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: OFERTAS DO DIA */}
        {activeTab === 'offers' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-[#1a1d29] border border-emerald-500/20 p-6 rounded-2xl flex items-start gap-4 shadow-lg shadow-black/20">
              <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
                <Tag size={24} />
              </div>
              <div>
                <h3 className="text-gray-200 font-bold mb-1">Sobre as Ofertas do Dia</h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Esta ferramenta acessa a página de ofertas do Mercado Livre, coleta os produtos disponíveis e, em segundo plano, raspa os detalhes de cada um (foto, título, preço), gera os links com a sua tag de afiliado configurada e insere as mensagens na fila de envio automaticamente. 
                  <br /><br />
                  <span className="text-emerald-400/80">O intervalo (delay) ajuda a evitar bloqueios do Mercado Livre ao acessar muitos produtos de uma vez.</span>
                </p>
              </div>
            </div>

            <form onSubmit={handleFetchOffers} className="bg-[#14161f] border border-gray-800 rounded-2xl p-6 shadow-xl space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-2">Instância do WhatsApp (Para disparos nos grupos)</label>
                  <select 
                    value={offersInstanceId} 
                    onChange={(e) => setOffersInstanceId(e.target.value)}
                    required
                    className="w-full bg-[#0d0e12] border border-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 text-gray-200"
                  >
                    <option value="">Selecione uma instância...</option>
                    {instances.map(inst => (
                      <option key={inst.id} value={inst.id}>{inst.name} ({inst.status})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-2">Intervalo entre raspagem de cada oferta (Segundos)</label>
                  <select 
                    value={offersDelay} 
                    onChange={(e) => setOffersDelay(Number(e.target.value))}
                    className="w-full bg-[#0d0e12] border border-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 text-gray-200"
                  >
                    <option value={3}>3 Segundos (Rápido)</option>
                    <option value={5}>5 Segundos (Recomendado)</option>
                    <option value={10}>10 Segundos</option>
                    <option value={20}>20 Segundos</option>
                    <option value={30}>30 Segundos</option>
                    <option value={45}>45 Segundos (Muito Seguro)</option>
                  </select>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-semibold text-gray-400">Grupos de Destino</label>
                    {isLoadingGroups && <span className="text-xs text-emerald-500 animate-pulse">Carregando grupos...</span>}
                  </div>
                  {activeGroups.length > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2 bg-[#0d0e12] border border-gray-800 rounded-xl p-3">
                      {activeGroups.map(group => {
                        const isSelected = offersDestGroups.split(',').map(s => s.trim()).includes(group.id);
                        return (
                          <label key={group.id} className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors border ${isSelected ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-[#14161f] border-transparent hover:bg-[#1a1d29]'}`}>
                            <input 
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                let current = offersDestGroups.split(',').map(s => s.trim()).filter(Boolean);
                                if (e.target.checked) {
                                  current.push(group.id);
                                } else {
                                  current = current.filter(id => id !== group.id);
                                }
                                setOffersDestGroups(current.join(','));
                              }}
                              className="w-4 h-4 rounded border-gray-600 bg-[#0d0e12] text-emerald-500 focus:ring-emerald-500 focus:ring-offset-[#14161f]"
                            />
                            <div className="flex flex-col">
                              <span className={`text-sm font-medium ${isSelected ? 'text-emerald-400' : 'text-gray-300'}`}>{group.name}</span>
                              <span className="text-[10px] text-gray-500 font-mono">{group.id}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-[#0d0e12] border border-gray-800 rounded-xl px-4 py-4 text-sm text-gray-500 flex items-center justify-center">
                      {offersInstanceId ? 'Nenhum grupo encontrado ou carregando...' : 'Selecione uma instância para carregar os grupos.'}
                    </div>
                  )}
                  <p className="text-[10px] text-gray-500 mt-2">
                    IDs selecionados internamente: {offersDestGroups || 'Nenhum'}
                  </p>
                </div>
              </div>

              {offersError && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                  {offersError}
                </div>
              )}

              {offersResult && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm flex items-start gap-3">
                  <CheckCircle size={18} className="mt-0.5" />
                  <div>
                    <span className="font-bold">{offersResult.count} ofertas encontradas!</span><br />
                    {offersResult.message}
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button 
                  type="submit"
                  disabled={isFetchingOffers}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 font-bold text-[#0d0e12] text-sm shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isFetchingOffers ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" />
                      Iniciando processamento...
                    </>
                  ) : (
                    <>
                      <Tag size={18} />
                      Buscar e Enfileirar Ofertas
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 4.5: QUEUE */}
        {activeTab === 'queue' && (
          <div className="bg-[#14161f] border border-gray-800 rounded-2xl p-6 shadow-xl animate-fadeIn">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-bold text-lg">Fila de Disparo (Mensagens Pendentes)</h3>
                <p className="text-xs text-gray-500 mt-1">Acompanhe as mensagens que estão agendadas para disparo de acordo com a janela de horário e limite diário.</p>
              </div>
              <button 
                onClick={fetchQueue}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-gray-700 text-xs font-semibold text-gray-300 hover:bg-gray-800 transition-all"
              >
                <RefreshCw size={12} className={isFetchingQueue ? 'animate-spin' : ''} /> Atualizar Fila
              </button>
            </div>

            {queue.length === 0 ? (
              <div className="text-center py-12 text-gray-500 text-xs">Nenhuma mensagem na fila.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-300">
                  <thead className="bg-[#0d0e12] text-xs text-gray-500 uppercase border-b border-gray-800">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Adicionado</th>
                      <th className="px-6 py-4 font-semibold">Produto</th>
                      <th className="px-6 py-4 font-semibold">Preço</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      <th className="px-6 py-4 font-semibold">Destinos</th>
                      <th className="px-6 py-4 font-semibold text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {queue.map(item => (
                      <tr key={item.id} className="hover:bg-[#1a1d29]/50 transition-colors">
                        <td className="px-6 py-4 text-xs font-medium text-gray-500">
                          {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-6 py-4 text-xs font-semibold truncate max-w-[200px]" title={item.title || ''}>
                          {item.title || 'Sem título'}
                        </td>
                        <td className="px-6 py-4 text-xs text-emerald-400 font-semibold">{item.price || 'N/A'}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            item.status === 'PENDING' ? 'bg-amber-500/10 text-amber-400' :
                            item.status === 'SENT' ? 'bg-emerald-500/10 text-emerald-400' :
                            item.status === 'FAILED' ? 'bg-red-500/10 text-red-400' : 'bg-gray-500/10 text-gray-400'
                          }`}>
                            {item.status === 'PENDING' ? 'Aguardando' :
                             item.status === 'SENT' ? 'Enviado' :
                             item.status === 'FAILED' ? 'Falhou' : 'Expirado'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-400 max-w-[200px] truncate" title={item.destGroups}>
                          {item.destGroups}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {item.status === 'PENDING' && (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleSendNowQueueItem(item.id)}
                                disabled={sendingQueueItem === item.id}
                                className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 px-2 py-1.5 rounded-lg hover:bg-emerald-500/10 transition-all text-[11px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Enviar agora (ignora janela de horário)"
                              >
                                {sendingQueueItem === item.id ? (
                                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                                ) : (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                                )}
                                Enviar
                              </button>
                              <button
                                onClick={() => handleCancelQueueItem(item.id)}
                                className="text-red-400 hover:text-red-300 p-1.5 rounded-lg hover:bg-red-500/10 transition-all"
                                title="Cancelar disparo"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: SETTINGS */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl mx-auto">
            <form onSubmit={handleSaveSettings} className="bg-[#14161f] border border-gray-800 rounded-2xl p-6 shadow-xl space-y-6">
              <div>
                <h3 className="font-bold text-lg">Configurações de Parâmetros de Afiliado</h3>
                <p className="text-xs text-gray-500 mt-1">Insira seus IDs de rastreamento das lojas suportadas. O bot usará estes IDs para substituir os rastreadores de terceiros e redirecionar as vendas para a sua conta.</p>
              </div>

              {settingsSavedMessage && (
                <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs font-semibold animate-fadeIn">
                  <CheckCircle size={16} /> Configurações salvas com sucesso!
                </div>
              )}

              <div className="space-y-5">
                {/* Seleção de Marketplaces Ativos */}
                <div className="bg-[#0d0e12] p-4 rounded-xl border border-gray-800 space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Marketplaces Monitorados</h4>
                  <p className="text-[10px] text-gray-500">Escolha quais marketplaces o bot deve monitorar nos grupos de origem e encaminhar ofertas.</p>
                  <div className="flex flex-wrap gap-6 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-200 select-none">
                      <input 
                        type="checkbox" 
                        checked={listenAmazon} 
                        onChange={(e) => setListenAmazon(e.target.checked)} 
                        className="rounded border-gray-800 text-emerald-500 focus:ring-emerald-500 bg-[#14161f] w-4 h-4 cursor-pointer"
                      />
                      <span>Amazon</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-200 select-none">
                      <input 
                        type="checkbox" 
                        checked={listenShopee} 
                        onChange={(e) => setListenShopee(e.target.checked)} 
                        className="rounded border-gray-800 text-emerald-500 focus:ring-emerald-500 bg-[#14161f] w-4 h-4 cursor-pointer"
                      />
                      <span>Shopee</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-200 select-none">
                      <input 
                        type="checkbox" 
                        checked={listenMercadoLivre} 
                        onChange={(e) => setListenMercadoLivre(e.target.checked)} 
                        className="rounded border-gray-800 text-emerald-500 focus:ring-emerald-500 bg-[#14161f] w-4 h-4 cursor-pointer"
                      />
                      <span>Mercado Livre</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 font-semibold mb-2 flex items-center justify-between">
                      <span>Amazon Associate Tag (ID de Associado)</span>
                      <span className="text-[10px] text-gray-500 font-normal">Ex: seunome-20</span>
                    </label>
                    <input 
                      type="text" 
                      placeholder="Ex: seunome-20"
                      value={amazonId}
                      onChange={(e) => setAmazonId(e.target.value)}
                      className="w-full bg-[#0d0e12] border border-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-all text-gray-200"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 font-semibold mb-2 flex items-center justify-between">
                      <span>Preço Mínimo Amazon (R$)</span>
                      <span className="text-[10px] text-gray-500 font-normal">Opcional</span>
                    </label>
                    <input 
                      type="number" 
                      step="0.01"
                      min="0"
                      placeholder="Sem preço mínimo"
                      value={minPriceAmazon !== null && minPriceAmazon !== undefined ? minPriceAmazon : ''}
                      onChange={(e) => setMinPriceAmazon(e.target.value ? Number(e.target.value) : null)}
                      className="w-full bg-[#0d0e12] border border-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-all text-gray-200"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 font-semibold mb-2 flex items-center justify-between">
                      <span>Shopee Sub ID / Partner ID</span>
                      <span className="text-[10px] text-gray-500 font-normal">Ex: promocoesvip</span>
                    </label>
                    <input 
                      type="text" 
                      placeholder="Ex: promocoesvip"
                      value={shopeeId}
                      onChange={(e) => setShopeeId(e.target.value)}
                      className="w-full bg-[#0d0e12] border border-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-all text-gray-200"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 font-semibold mb-2 flex items-center justify-between">
                      <span>Preço Mínimo Shopee (R$)</span>
                      <span className="text-[10px] text-gray-500 font-normal">Opcional</span>
                    </label>
                    <input 
                      type="number" 
                      step="0.01"
                      min="0"
                      placeholder="Sem preço mínimo"
                      value={minPriceShopee !== null && minPriceShopee !== undefined ? minPriceShopee : ''}
                      onChange={(e) => setMinPriceShopee(e.target.value ? Number(e.target.value) : null)}
                      className="w-full bg-[#0d0e12] border border-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-all text-gray-200"
                    />
                  </div>
                </div>

                <div className="border-t border-gray-800 pt-4 mt-2">
                  <h3 className="text-xs font-semibold text-emerald-400 mb-3 uppercase tracking-wider">Mercado Livre (Gerador via Cookies - Recomendado)</h3>
                  
                  <div className="mb-4">
                     <label className="block text-xs text-gray-400 font-semibold mb-2 flex items-center justify-between">
                       <span>Cookies de Sessão do Mercado Livre</span>
                       <span className="text-[10px] text-gray-500 font-normal">Copie os cookies de login do Portal de Afiliados</span>
                     </label>

                     {/* Indicador de status do cookie atual */}
                     <div className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-lg text-xs font-semibold ${
                       hasCookie
                         ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                         : 'bg-red-500/10 border border-red-500/20 text-red-400'
                     }`}>
                       <span>{hasCookie ? '✅' : '❌'}</span>
                       <span>{hasCookie ? 'Cookie configurado e ativo no servidor.' : 'Nenhum cookie configurado. Cole abaixo para configurar.'}</span>
                     </div>

                     <textarea 
                       placeholder={hasCookie
                         ? 'Cole aqui para SUBSTITUIR o cookie atual (deixe em branco para manter o atual)'
                         : 'Cole aqui os cookies de sessão obtidos do Portal (ex: _csrf=...; ssid=...)'}
                       value={newCookie}
                       onChange={(e) => setNewCookie(e.target.value)}
                       onBlur={() => { if (newCookie.trim()) fetchMeliTags(); }}
                       rows={3}
                       className="w-full bg-[#0d0e12] border border-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-all text-gray-200 font-mono text-xs resize-y"
                     />
                     {isFetchingTags && (
                       <p className="text-[10px] text-emerald-400 mt-1 animate-pulse">Buscando etiquetas disponíveis...</p>
                     )}
                     {meliAvailableTags.length > 0 && !isFetchingTags && (
                       <p className="text-[10px] text-emerald-500 mt-1">✅ {meliAvailableTags.length} etiqueta(s) encontrada(s): {meliAvailableTags.join(', ')}</p>
                     )}

                   </div>

                  <div className="mb-4">
                    <label className="block text-xs text-gray-400 font-semibold mb-2 flex items-center justify-between">
                      <span>Telefone para Notificações de Cookies Expirados (WhatsApp)</span>
                      <span className="text-[10px] text-gray-500 font-normal">Código do país + DDD + Telefone (ex: 5586999999999)</span>
                    </label>
                    <input 
                      type="text" 
                      placeholder="Ex: 5586999999999"
                      value={cookieNotificationPhone}
                      onChange={(e) => setCookieNotificationPhone(e.target.value)}
                      className="w-full bg-[#0d0e12] border border-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-all text-gray-200"
                    />
                    <p className="text-[9px] text-gray-500 mt-1">Ao expirar, o bot enviará uma mensagem privada para este número. Responda-a com o novo cookie para atualizar automaticamente.</p>
                  </div>

                  <div className="mb-4">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-400 select-none">
                      <input 
                        type="checkbox" 
                        checked={mercadolivreOnlyShort} 
                        onChange={(e) => setMercadolivreOnlyShort(e.target.checked)} 
                        className="rounded border-gray-800 text-emerald-500 focus:ring-emerald-500 bg-[#14161f] w-4 h-4 cursor-pointer"
                      />
                      <span>Restringir envio: Enviar apenas se o link for encurtado oficialmente (Meli.la)</span>
                    </label>
                    <p className="text-[9px] text-gray-500 mt-1 ml-6">Impede o envio de links longos sociais do Mercado Livre quando os cookies de sessão falharem.</p>
                  </div>

                  <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">Mercado Livre (Fallback / Canais Sociais)</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-xs text-gray-400 font-semibold mb-2 flex items-center justify-between">
                        <span>Etiqueta (Tag) Ativa</span>
                        <span className="text-[10px] text-gray-500 font-normal">Ex: ramonduarte</span>
                      </label>
                      {meliAvailableTags.length > 0 ? (
                        <select
                          value={mercadolivreChannel}
                          onChange={(e) => setMercadolivreChannel(e.target.value)}
                          className="w-full bg-[#0d0e12] border border-emerald-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-all text-gray-200"
                        >
                          {meliAvailableTags.map(tag => (
                            <option key={tag} value={tag}>{tag}</option>
                          ))}
                        </select>
                      ) : (
                        <input 
                          type="text" 
                          placeholder="Nome do canal (cole o cookie primeiro)"
                          value={mercadolivreChannel}
                          onChange={(e) => setMercadolivreChannel(e.target.value)}
                          className="w-full bg-[#0d0e12] border border-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-all text-gray-200"
                        />
                      )}

                    </div>

                    <div>
                      <label className="block text-xs text-gray-400 font-semibold mb-2 flex items-center justify-between">
                        <span>Tool ID (matt_tool)</span>
                        <span className="text-[10px] text-gray-500 font-normal">Ex: 85424440</span>
                      </label>
                      <input 
                        type="text" 
                        placeholder="ID numérico"
                        value={mercadolivreTool}
                        onChange={(e) => setMercadolivreTool(e.target.value)}
                        className="w-full bg-[#0d0e12] border border-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-all text-gray-200"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-400 font-semibold mb-2 flex items-center justify-between">
                        <span>Word (matt_word)</span>
                        <span className="text-[10px] text-gray-500 font-normal">Ex: ramonduarte</span>
                      </label>
                      <input 
                        type="text" 
                        placeholder="Palavra de rastreio"
                        value={mercadolivreWord}
                        onChange={(e) => setMercadolivreWord(e.target.value)}
                        className="w-full bg-[#0d0e12] border border-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-all text-gray-200"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-400 font-semibold mb-2 flex items-center justify-between">
                        <span>Mercado Livre Custom ID (Fallback / Links Diretos)</span>
                        <span className="text-[10px] text-gray-500 font-normal">Ex: seunome_aff</span>
                      </label>
                      <input 
                        type="text" 
                        placeholder="Ex: seunome_aff"
                        value={mercadolivreId}
                        onChange={(e) => setMercadolivreId(e.target.value)}
                        className="w-full bg-[#0d0e12] border border-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-all text-gray-200"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 font-semibold mb-2 flex items-center justify-between">
                        <span>Preço Mínimo Mercado Livre (R$)</span>
                        <span className="text-[10px] text-gray-500 font-normal">Opcional</span>
                      </label>
                      <input 
                        type="number" 
                        step="0.01"
                        min="0"
                        placeholder="Sem preço mínimo"
                        value={minPriceMeli !== null && minPriceMeli !== undefined ? minPriceMeli : ''}
                        onChange={(e) => setMinPriceMeli(e.target.value ? Number(e.target.value) : null)}
                        className="w-full bg-[#0d0e12] border border-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-all text-gray-200"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-800 pt-4 mt-2">
                  <h3 className="text-xs font-semibold text-emerald-400 mb-3 uppercase tracking-wider">Controle de Envio (Fila & Limites)</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-xs text-gray-400 font-semibold mb-2 flex items-center justify-between">
                        <span>Início da Janela</span>
                        <span className="text-[10px] text-gray-500 font-normal">Ex: 08:00</span>
                      </label>
                      <input 
                        type="time" 
                        value={sendWindowStart}
                        onChange={(e) => setSendWindowStart(e.target.value)}
                        className="w-full bg-[#0d0e12] border border-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-all text-gray-200"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-400 font-semibold mb-2 flex items-center justify-between">
                        <span>Fim da Janela</span>
                        <span className="text-[10px] text-gray-500 font-normal">Ex: 18:00</span>
                      </label>
                      <input 
                        type="time" 
                        value={sendWindowEnd}
                        onChange={(e) => setSendWindowEnd(e.target.value)}
                        className="w-full bg-[#0d0e12] border border-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-all text-gray-200"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-400 font-semibold mb-2 flex items-center justify-between">
                        <span>Limite Diário (Mensagens)</span>
                        <span className="text-[10px] text-gray-500 font-normal">Ex: 30</span>
                      </label>
                      <input 
                        type="number" 
                        min="1"
                        placeholder="30"
                        value={dailyLimit}
                        onChange={(e) => setDailyLimit(Number(e.target.value))}
                        className="w-full bg-[#0d0e12] border border-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-all text-gray-200"
                      />
                    </div>
                  </div>
                  <p className="text-[9px] text-gray-500 mt-1">
                    As ofertas capturadas serão adicionadas a uma fila e enviadas respeitando o horário permitido e o limite diário de disparos (com intervalo mínimo de 5 minutos entre cada envio para evitar spam).
                  </p>
                  <div className="border-t border-gray-800/50 pt-4 mt-4 space-y-4">
                    <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Configurações do Telegram</h4>
                    <div>
                      <label className="block text-xs text-gray-400 font-semibold mb-2 flex items-center justify-between">
                        <span>Token do Bot do Telegram</span>
                        <span className="text-[10px] text-gray-500 font-normal">Ex: 123456789:ABCdef...</span>
                      </label>
                      <input 
                        type="text" 
                        placeholder="Insira o token do bot gerado no BotFather"
                        value={telegramBotToken}
                        onChange={(e) => setTelegramBotToken(e.target.value)}
                        className="w-full bg-[#0d0e12] border border-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-all text-gray-200"
                      />
                    </div>
                  </div>

                  <div className="border-t border-gray-800/50 pt-4 mt-4 space-y-4">
                    <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Configurações de Mensagens</h4>
                    <div className="flex items-center">
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-200 select-none">
                        <input 
                          type="checkbox" 
                          checked={mentionEveryone} 
                          onChange={(e) => setMentionEveryone(e.target.checked)} 
                          className="rounded border-gray-800 text-emerald-500 focus:ring-emerald-500 bg-[#14161f] w-4 h-4 cursor-pointer"
                        />
                        <span>Mencionar todos (@everyone) ao enviar mensagens no WhatsApp</span>
                      </label>
                    </div>
                  </div>

                  <div className="border-t border-gray-800/50 pt-4 mt-4 space-y-4">
                    <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Deduplificação de Ofertas</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center">
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-200 select-none">
                          <input 
                            type="checkbox" 
                            checked={enableDeduplication} 
                            onChange={(e) => setEnableDeduplication(e.target.checked)} 
                            className="rounded border-gray-800 text-emerald-500 focus:ring-emerald-500 bg-[#14161f] w-4 h-4 cursor-pointer"
                          />
                          <span>Ativar deduplificação de produtos</span>
                        </label>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 font-semibold mb-2 flex items-center justify-between">
                          <span>Janela de Deduplificação (horas)</span>
                          <span className="text-[10px] text-gray-500 font-normal">Padrão: 24h</span>
                        </label>
                        <input 
                          type="number" 
                          min="1"
                          max="168"
                          disabled={!enableDeduplication}
                          value={deduplicationHours}
                          onChange={(e) => setDeduplicationHours(Number(e.target.value))}
                          className="w-full bg-[#0d0e12] border border-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-all text-gray-200 disabled:opacity-50"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-800">
                  <button 
                    type="submit"
                    disabled={isSavingSettings}
                    className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 font-semibold text-[#0d0e12] text-sm shadow-lg shadow-emerald-500/15 transition-all disabled:opacity-50"
                  >
                    {isSavingSettings ? 'Salvando...' : 'Salvar Configurações'}
                  </button>
                </div>
              </div>
            </form>

            {/* Seção: Alterar Senha */}
            <form onSubmit={handleChangePassword} className="bg-[#14161f] border border-gray-800 rounded-2xl p-6 shadow-xl space-y-5 mt-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </div>
                <div>
                  <h3 className="font-bold text-base text-gray-100">Alterar Senha</h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">Por segurança, confirme sua senha atual antes de definir uma nova.</p>
                </div>
              </div>

              {changePasswordError && (
                <div className="flex items-center gap-3 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-semibold animate-fadeIn">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                  {changePasswordError}
                </div>
              )}

              {changePasswordSuccess && (
                <div className="flex items-center gap-3 p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs font-semibold animate-fadeIn">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  Senha alterada com sucesso!
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 font-semibold mb-2">Senha Atual</label>
                  <input
                    id="current-password"
                    type="password"
                    placeholder="••••••••"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="w-full bg-[#0d0e12] border border-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500 transition-all text-gray-200"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 font-semibold mb-2 flex items-center justify-between">
                      <span>Nova Senha</span>
                      <span className="text-[10px] text-gray-500 font-normal">Mín. 8 caracteres</span>
                    </label>
                    <input
                      id="new-password"
                      type="password"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      className="w-full bg-[#0d0e12] border border-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500 transition-all text-gray-200"
                    />
                    {newPassword.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {[...Array(4)].map((_, i) => {
                          const strength = newPassword.length >= 8 ? (newPassword.length >= 12 ? ((/[A-Z]/.test(newPassword) && /[0-9]/.test(newPassword)) ? 4 : 3) : 2) : 1;
                          return (
                            <div
                              key={i}
                              className={`h-1 flex-1 rounded-full transition-all ${
                                i < strength
                                  ? strength === 1 ? 'bg-red-500' : strength === 2 ? 'bg-amber-500' : strength === 3 ? 'bg-yellow-400' : 'bg-emerald-500'
                                  : 'bg-gray-700'
                              }`}
                            />
                          );
                        })}
                        <span className="text-[10px] text-gray-500 ml-1">
                          {newPassword.length < 8 ? 'Fraca' : newPassword.length < 12 ? 'Média' : (/[A-Z]/.test(newPassword) && /[0-9]/.test(newPassword)) ? 'Forte' : 'Boa'}
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 font-semibold mb-2">Confirmar Nova Senha</label>
                    <input
                      id="confirm-password"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      className={`w-full bg-[#0d0e12] border rounded-xl px-4 py-3 text-sm focus:outline-none transition-all text-gray-200 ${
                        confirmPassword.length > 0
                          ? confirmPassword === newPassword
                            ? 'border-emerald-500/60 focus:border-emerald-500'
                            : 'border-red-500/60 focus:border-red-500'
                          : 'border-gray-800 focus:border-amber-500'
                      }`}
                    />
                    {confirmPassword.length > 0 && confirmPassword !== newPassword && (
                      <p className="text-[10px] text-red-400 mt-1">As senhas não coincidem.</p>
                    )}
                    {confirmPassword.length > 0 && confirmPassword === newPassword && (
                      <p className="text-[10px] text-emerald-400 mt-1">✓ Senhas coincidem.</p>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isChangingPassword || !currentPassword || !newPassword || newPassword !== confirmPassword}
                className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 font-semibold text-[#0d0e12] text-sm shadow-lg shadow-amber-500/15 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isChangingPassword ? 'Alterando...' : 'Alterar Senha'}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>

      {/* MODAL: NOVA CONEXÃO */}
      {showNewInstanceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-[#14161f] border border-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl relative">
            <button 
              onClick={() => setShowNewInstanceModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-300"
            >
              <X size={20} />
            </button>
            <h3 className="font-bold text-lg mb-4">Adicionar Novo Dispositivo</h3>
            <form onSubmit={handleCreateInstance} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 font-semibold mb-2">Nome do Dispositivo</label>
                <input 
                  type="text" 
                  placeholder="Ex: Celular Comercial do João"
                  value={newInstanceName}
                  onChange={(e) => setNewInstanceName(e.target.value)}
                  required
                  className="w-full bg-[#0d0e12] border border-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 text-gray-200"
                />
              </div>
              <button 
                type="submit"
                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 font-semibold text-[#0d0e12] text-sm transition-all"
              >
                Gerar Sessão e QR Code
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NOVO MAPEAMENTO */}
      {showNewMappingModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-[#14161f] border border-gray-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl relative">
            <button 
              onClick={() => setShowNewMappingModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-300"
            >
              <X size={20} />
            </button>
            <h3 className="font-bold text-lg mb-4">Criar Regra de Roteamento</h3>
            <form onSubmit={handleCreateMapping} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 font-semibold mb-1">Nome da Regra</label>
                <input 
                  type="text" 
                  placeholder="Ex: Amazon Tech -> Vip"
                  value={newMappingName}
                  onChange={(e) => setNewMappingName(e.target.value)}
                  required
                  className="w-full bg-[#0d0e12] border border-gray-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500 text-gray-200"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 font-semibold mb-1">Selecione o Dispositivo WhatsApp</label>
                <select 
                  value={selectedInstanceId}
                  onChange={(e) => setSelectedInstanceId(e.target.value)}
                  required
                  className="w-full bg-[#0d0e12] border border-gray-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500 text-gray-300"
                >
                  <option value="">-- Escolha um dispositivo --</option>
                  {instances.map(i => (
                    <option key={i.id} value={i.id}>{i.name} ({i.status})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-400 font-semibold mb-1">
                  Grupo de Origem (Escuta) {isLoadingGroups && <span className="text-[10px] text-emerald-400 animate-pulse">(Buscando...)</span>}
                </label>
                {activeGroups.length > 0 ? (
                  <select 
                    value={sourceGroupId}
                    onChange={(e) => {
                      const jid = e.target.value;
                      setSourceGroupId(jid);
                      const gName = activeGroups.find(g => g.id === jid)?.name || '';
                      setSourceGroupName(gName);
                    }}
                    required
                    className="w-full bg-[#0d0e12] border border-gray-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500 text-gray-300"
                  >
                    <option value="">-- Selecione o grupo origem --</option>
                    {activeGroups.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-2">
                    <input 
                      type="text" 
                      placeholder="JID do grupo (Ex: 120363028329@g.us)"
                      value={sourceGroupId}
                      onChange={(e) => setSourceGroupId(e.target.value)}
                      required
                      className="w-full bg-[#0d0e12] border border-gray-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500 font-mono text-gray-200"
                    />
                    <input 
                      type="text" 
                      placeholder="Nome amigável do grupo"
                      value={sourceGroupName}
                      onChange={(e) => setSourceGroupName(e.target.value)}
                      className="w-full bg-[#0d0e12] border border-gray-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500 text-gray-200"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs text-gray-400 font-semibold mb-1">Grupos de Destino</label>
                {activeGroups.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto p-2.5 bg-[#0d0e12] border border-gray-800 rounded-xl mb-2">
                    {activeGroups.map(group => {
                      const isChecked = destGroupIds.split(',').map(g => g.trim()).includes(group.id);
                      return (
                        <label key={group.id} className="flex items-center gap-2.5 p-1.5 hover:bg-[#1a1d29] rounded-lg cursor-pointer transition-all">
                          <input 
                            type="checkbox" 
                            checked={isChecked}
                            onChange={(e) => {
                              const current = destGroupIds.split(',').map(g => g.trim()).filter(Boolean);
                              if (e.target.checked) {
                                if (!current.includes(group.id)) current.push(group.id);
                              } else {
                                const idx = current.indexOf(group.id);
                                if (idx > -1) current.splice(idx, 1);
                              }
                              setDestGroupIds(current.join(', '));
                            }}
                            className="rounded border-gray-800 text-emerald-500 focus:ring-emerald-500/20 bg-transparent"
                          />
                          <span className="text-xs text-gray-300 truncate">{group.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
                <input 
                  type="text" 
                  placeholder="JIDs do WhatsApp ou IDs do Telegram (Ex: 120363@g.us, -10012345, @meucanal)"
                  value={destGroupIds}
                  onChange={(e) => setDestGroupIds(e.target.value)}
                  required
                  className="w-full bg-[#0d0e12] border border-gray-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 font-mono text-gray-200"
                />
                <span className="text-[10px] text-gray-500 mt-1 block">
                  Você pode selecionar grupos do WhatsApp acima (se conectados) e/ou inserir manualmente outros IDs de WhatsApp ou Telegram separados por vírgula.
                </span>
              </div>

              <button 
                type="submit"
                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 font-semibold text-[#0d0e12] text-sm transition-all"
              >
                Salvar Regra de Roteamento
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
