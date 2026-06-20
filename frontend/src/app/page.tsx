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
  Sliders
} from 'lucide-react';

const API_URL = 'http://localhost:5050';

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

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'instances' | 'mapping' | 'manual' | 'logs' | 'settings'>('instances');
  
  // Configurações de Afiliado
  const [amazonId, setAmazonId] = useState('');
  const [shopeeId, setShopeeId] = useState('');
  const [mercadolivreId, setMercadolivreId] = useState('');
  const [mercadolivreChannel, setMercadolivreChannel] = useState('');
  const [mercadolivreTool, setMercadolivreTool] = useState('');
  const [mercadolivreWord, setMercadolivreWord] = useState('');
  const [mercadolivreCookie, setMercadolivreCookie] = useState('');
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
      const res = await fetch(`${API_URL}/api/affiliate/meli-tags`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.tags) && data.tags.length > 0) {
          setMeliAvailableTags(data.tags);
          // Se o canal atual não existe na lista, usa a primeira tag disponível
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
      const res = await fetch(`${API_URL}/api/instances/${instanceId}/groups`);
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
    fetchGroups(selectedInstanceId);
  }, [selectedInstanceId]);

  useEffect(() => {
    fetchGroups(manualInstanceId);
  }, [manualInstanceId]);

  // Carrega instâncias
  const fetchInstances = async () => {
    try {
      const res = await fetch(`${API_URL}/api/instances`);
      if (res.ok) {
        const data = await res.json();
        setInstances(data);
      }
    } catch (err) {
      console.error('Error fetching instances:', err);
    }
  };

  // Carrega mapeamentos
  const fetchMappings = async () => {
    try {
      const res = await fetch(`${API_URL}/api/mappings`);
      if (res.ok) {
        const data = await res.json();
        setMappings(data);
      }
    } catch (err) {
      console.error('Error fetching mappings:', err);
    }
  };

  // Carrega logs
  const fetchLogs = async () => {
    try {
      const res = await fetch(`${API_URL}/api/logs`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
  };

  // Carrega configurações de afiliado
  const fetchAffiliateSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/api/user/affiliate`);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setAmazonId(data.amazonId || '');
          setShopeeId(data.shopeeId || '');
          setMercadolivreId(data.mercadolivreId || '');
          setMercadolivreChannel(data.mercadolivreChannel || '');
          setMercadolivreTool(data.mercadolivreTool || '');
          setMercadolivreWord(data.mercadolivreWord || '');
          setMercadolivreCookie(data.mercadolivreCookie || '');
          setCookieNotificationPhone(data.cookieNotificationPhone || '');
          setListenAmazon(data.listenAmazon !== undefined ? data.listenAmazon : true);
          setListenShopee(data.listenShopee !== undefined ? data.listenShopee : true);
          setListenMercadoLivre(data.listenMercadoLivre !== undefined ? data.listenMercadoLivre : true);
          setMercadolivreOnlyShort(data.mercadolivreOnlyShort !== undefined ? data.mercadolivreOnlyShort : false);
        }
      }
    } catch (err) {
      console.error('Error fetching affiliate settings:', err);
    }
  };

  // Salva configurações de afiliado
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setSettingsSavedMessage(false);
    try {
      const res = await fetch(`${API_URL}/api/user/affiliate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
          mercadolivreOnlyShort
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

  // Efeito inicial para carregar dados
  useEffect(() => {
    fetchInstances();
    fetchMappings();
    fetchLogs();
    fetchAffiliateSettings();
  }, []);

  // Polling para QR Code e status de conexões (de 3 em 3 segundos)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchInstances();
      // Se estiver na aba de logs ou de mapeamento, atualiza também para manter o estado síncrono
      if (activeTab === 'logs') fetchLogs();
    }, 3000);

    return () => clearInterval(interval);
  }, [activeTab]);

  // Ação: Criar Instância
  const handleCreateInstance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInstanceName) return;

    try {
      const res = await fetch(`${API_URL}/api/instances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  // Ação: Iniciar Conexão (Reconectar / QR Code)
  const handleStartInstance = async (id: string) => {
    try {
      await fetch(`${API_URL}/api/instances/${id}/start`, { method: 'POST' });
      fetchInstances();
    } catch (err) {
      console.error('Error starting instance:', err);
    }
  };

  // Ação: Parar Conexão
  const handleStopInstance = async (id: string) => {
    try {
      await fetch(`${API_URL}/api/instances/${id}/stop`, { method: 'POST' });
      fetchInstances();
    } catch (err) {
      console.error('Error stopping instance:', err);
    }
  };

  // Ação: Deletar Instância
  const handleDeleteInstance = async (id: string) => {
    if (!confirm('Deseja excluir permanentemente este dispositivo?')) return;
    try {
      await fetch(`${API_URL}/api/instances/${id}`, { method: 'DELETE' });
      fetchInstances();
    } catch (err) {
      console.error('Error deleting instance:', err);
    }
  };

  // Ação: Criar Mapeamento
  const handleCreateMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMappingName || !selectedInstanceId || !sourceGroupId || !destGroupIds) {
      alert('Preencha todos os campos!');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/mappings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  // Ação: Excluir Mapeamento
  const handleDeleteMapping = async (id: string) => {
    if (!confirm('Excluir regra de mapeamento?')) return;
    try {
      await fetch(`${API_URL}/api/mappings/${id}`, { method: 'DELETE' });
      fetchMappings();
    } catch (err) {
      console.error('Error deleting mapping:', err);
    }
  };

  // Ação: Disparo Manual
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
      const res = await fetch(`${API_URL}/api/manual-dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  return (
    <div className="min-h-screen bg-[#0d0e12] text-gray-100 flex font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-[#14161f] border-r border-gray-800 flex flex-col justify-between p-6">
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-green-500 to-emerald-400 flex items-center justify-center font-bold text-[#0d0e12] text-xl shadow-lg shadow-emerald-500/20">
              MZ
            </div>
            <div>
              <h1 className="font-bold text-lg leading-none">MandacaruZap</h1>
              <span className="text-xs text-emerald-400 font-medium">WhatsApp SaaS</span>
            </div>
          </div>

          <nav className="space-y-1">
            <button 
              onClick={() => setActiveTab('instances')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'instances' ? 'bg-[#222533] text-emerald-400 shadow-md shadow-black/10' : 'text-gray-400 hover:bg-[#1a1d29] hover:text-gray-200'}`}
            >
              <QrCode size={18} />
              Conexões WhatsApp
            </button>
            <button 
              onClick={() => setActiveTab('mapping')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'mapping' ? 'bg-[#222533] text-emerald-400 shadow-md shadow-black/10' : 'text-gray-400 hover:bg-[#1a1d29] hover:text-gray-200'}`}
            >
              <Layers size={18} />
              Mapeamento de Grupos
            </button>
            <button 
              onClick={() => {
                setActiveTab('manual');
                // Auto-seleciona a primeira conexão ativa
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
                fetchLogs();
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'logs' ? 'bg-[#222533] text-emerald-400 shadow-md shadow-black/10' : 'text-gray-400 hover:bg-[#1a1d29] hover:text-gray-200'}`}
            >
              <FileText size={18} />
              Logs & Histórico
            </button>
            <button 
              onClick={() => {
                setActiveTab('settings');
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
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#1b1d29] mb-4">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center font-bold text-emerald-400 text-sm">
              AD
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold truncate">Admin Duarte</p>
              <p className="text-[10px] text-gray-500 truncate">admin@mandacaruzap.com</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold font-mono">
              {activeTab === 'instances' && 'Conexões do WhatsApp'}
              {activeTab === 'mapping' && 'Mapeamento de Grupos'}
              {activeTab === 'manual' && 'Gerador & Disparo Manual'}
              {activeTab === 'logs' && 'Logs e Atividades'}
              {activeTab === 'settings' && 'Configurações de Afiliado'}
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              {activeTab === 'instances' && 'Gerencie seus múltiplos números de WhatsApp e sessões ativas.'}
              {activeTab === 'mapping' && 'Configure quais grupos de origem serão monitorados e quais grupos de destino receberão as ofertas.'}
              {activeTab === 'manual' && 'Cole links de produtos suportados para conversão de afiliados e disparo manual imediato.'}
              {activeTab === 'logs' && 'Histórico completo de links capturados, convertidos e mensagens enviadas.'}
              {activeTab === 'settings' && 'Configure seus IDs de afiliado da Amazon, Shopee e Mercado Livre para conversão automática.'}
            </p>
          </div>
        </header>

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
                <Plus size={16} /> Novo Mapeamento
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
                            log.status === 'SENT' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                          }`}>
                            {log.status === 'SENT' ? 'Enviado' : 'Falhou'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[10px] text-gray-400 max-w-[300px] truncate" title={log.errorMessage || log.convertedUrl || ''}>
                          {log.status === 'SENT' ? log.convertedUrl : log.errorMessage}
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

                <div className="border-t border-gray-800 pt-4 mt-2">
                  <h3 className="text-xs font-semibold text-emerald-400 mb-3 uppercase tracking-wider">Mercado Livre (Gerador via Cookies - Recomendado)</h3>
                  
                  <div className="mb-4">
                    <label className="block text-xs text-gray-400 font-semibold mb-2 flex items-center justify-between">
                      <span>Cookies de Sessão do Mercado Livre</span>
                      <span className="text-[10px] text-gray-500 font-normal">Copie os cookies de login do Portal de Afiliados</span>
                    </label>
                    <textarea 
                      placeholder="Cole aqui os cookies de sessão obtidos do Portal (ex: _csrf=...; ssid=...)"
                      value={mercadolivreCookie}
                      onChange={(e) => setMercadolivreCookie(e.target.value)}
                      onBlur={fetchMeliTags}
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
          </div>
        )}
      </main>

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
                {activeGroups.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto p-2.5 bg-[#0d0e12] border border-gray-800 rounded-xl">
                    {activeGroups.map(group => {
                      const isChecked = destGroupIds.split(',').includes(group.id);
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
                              setDestGroupIds(current.join(','));
                            }}
                            className="rounded border-gray-800 text-emerald-500 focus:ring-emerald-500/20 bg-transparent"
                          />
                          <span className="text-xs text-gray-300 truncate">{group.name}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <input 
                    type="text" 
                    placeholder="120363029411@g.us, 120363029422@g.us"
                    value={destGroupIds}
                    onChange={(e) => setDestGroupIds(e.target.value)}
                    required
                    className="w-full bg-[#0d0e12] border border-gray-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500 font-mono text-gray-200"
                  />
                )}
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
