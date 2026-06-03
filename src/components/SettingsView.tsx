import React, { useState } from 'react';
import { Account, HistoryEntry } from '../types';
import { formatCurrency, getCurrentCycleDates, getOffDaysCountForCurrentCycle } from '../utils/storage';
import { 
  ArrowLeft, Plus, Trash2, Calendar, Download, History, RotateCcw, 
  Percent, DollarSign, Wallet, ClipboardList, AlertCircle, X, Check, Eye
} from 'lucide-react';

interface SettingsViewProps {
  accounts: Account[];
  history: HistoryEntry[];
  totalSavedThisMonth: number;
  markedDays: { [dateStr: string]: 'work' | 'off' };
  deferredPrompt: any; // PWA installation event
  onGoBack: () => void;
  onUpdateAccounts: (accounts: Account[]) => void;
  onUpdateMarkedDays: (markedDays: { [dateStr: string]: 'work' | 'off' }) => void;
  onResetSaved: () => void;
}

export default function SettingsView({
  accounts,
  history,
  totalSavedThisMonth,
  markedDays,
  deferredPrompt,
  onGoBack,
  onUpdateAccounts,
  onUpdateMarkedDays,
  onResetSaved
}: SettingsViewProps) {
  
  // States para gerenciar edições, criação de conta e modais
  const [newAccName, setNewAccName] = useState('');
  const [newAccValue, setNewAccValue] = useState('');
  const [newAccDue, setNewAccDue] = useState('20');
  
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showInstallStatus, setShowInstallStatus] = useState<string | null>(null);

  // States para controle de folgas e calendário
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });

  const getPeriodText = () => {
    const { start, end } = getCurrentCycleDates();
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const formatDayMonth = (dateObj: Date) => {
      const day = String(dateObj.getDate()).padStart(2, '0');
      return `${day} de ${months[dateObj.getMonth()]}`;
    };
    return `${formatDayMonth(start)} até ${formatDayMonth(end)}`;
  };

  const formatLocalDate = (ymdStr: string) => {
    const parts = ymdStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return ymdStr;
  };

  // Calcular métricas gerais do orçamento
  const totalBudget = accounts.reduce((sum, acc) => sum + acc.value, 0);
  const totalSaved = totalSavedThisMonth;
  const remainingToSave = Math.max(0, totalBudget - totalSaved);
  const progressPercent = totalBudget > 0 ? Math.min(100, (totalSaved / totalBudget) * 100) : 0;

  // Cálculo da meta diária com folga (Nova regra definitiva 2026)
  const { startStr, endStr } = getCurrentCycleDates();
  const totalOffDays = getOffDaysCountForCurrentCycle(markedDays || {}, startStr, endStr);
  const remainingWorkDays = Math.max(1, 30 - totalOffDays);
  const settingsDailyMetaValue = totalBudget / remainingWorkDays;

  // Função auxiliar para re-calcular todas as porcentagens de forma proporcional e somar 100%
  const updateAndRecalculatePercentages = (updatedList: Account[]): Account[] => {
    const total = updatedList.reduce((sum, acc) => sum + acc.value, 0);
    if (total === 0) {
      return updatedList.map(acc => ({ ...acc, percentage: 0 }));
    }
    
    // Atualizar as porcentagens
    const processed = updatedList.map(acc => {
      const percentage = Math.round((acc.value / total) * 10000) / 100;
      return { ...acc, percentage };
    });

    // Se houver pequenas variações de arredondamento, compensar nos itens
    // mantendo a regra de que valores de orçamento iguais possuem porcentagens exatamente iguais.
    const sumProportions = processed.reduce((sum, acc) => sum + acc.percentage, 0);
    let diff = Math.round((100 - sumProportions) * 100); // em inteiros de centésimos (ex: +1 ou -1)
    
    if (diff !== 0 && processed.length > 0) {
      // Agrupar índices das contas por seu valor de orçamento
      const valueGroups: { [value: number]: number[] } = {};
      processed.forEach((acc, idx) => {
        if (!valueGroups[acc.value]) {
          valueGroups[acc.value] = [];
        }
        valueGroups[acc.value].push(idx);
      });

      // Transformar em array de grupos
      const groups = Object.entries(valueGroups).map(([val, idxs]) => ({
        value: parseFloat(val),
        idxs,
        size: idxs.length
      }));

      // Loopping para ajustar os centésimos remanescentes da porcentagem
      const sign = Math.sign(diff); // +1 ou -1
      
      while (diff !== 0) {
        // Encontrar grupos elegíveis de menor tamanho cuja alteração caiba no diff ou,
        // prioritariamente, grupos unitários (size == 1) para não quebrar a simetria.
        // Se houver, escolhemos os grupos de menor tamanho.
        const eligibleGroups = groups.filter(g => g.size <= Math.abs(diff));
        
        if (eligibleGroups.length > 0) {
          // Ordenar preferencialmente por menor tamanho de grupo, e em seguida por tamanho de despesa (maior valor de orçamento primeiro)
          eligibleGroups.sort((a, b) => {
            if (a.size !== b.size) {
              return a.size - b.size; // menor tamanho primeiro
            }
            return b.value - a.value; // maior orçamento primeiro
          });

          const groupToAdjust = eligibleGroups[0];
          groupToAdjust.idxs.forEach(idx => {
            processed[idx].percentage = Math.round((processed[idx].percentage + sign * 0.01) * 100) / 100;
          });
          diff -= sign * groupToAdjust.size;
        } else {
          // Caso extremo onde a diferença não cabe em nenhum grupo completo, ajustamos no maior grupo ou no primeiro item disponível
          // para preservar a soma exata de 100% que é um requisito imperativo.
          groups.sort((a, b) => b.value - a.value);
          const groupToAdjust = groups[0];
          const firstIdx = groupToAdjust.idxs[0];
          processed[firstIdx].percentage = Math.round((processed[firstIdx].percentage + sign * 0.01) * 100) / 100;
          diff -= sign;
        }
      }
    }

    return processed;
  };

  // Alterar valor de uma conta
  const handleAccountValueChange = (id: string, valueStr: string) => {
    const cleanValue = parseFloat(valueStr) || 0;
    const updated = accounts.map(acc => {
      if (acc.id === id) {
        return { ...acc, value: Math.max(0, cleanValue) };
      }
      return acc;
    });
    onUpdateAccounts(updateAndRecalculatePercentages(updated));
  };

  // Alterar dia de vencimento de uma conta
  const handleAccountDueChange = (id: string, dueStr: string) => {
    const dueDay = parseInt(dueStr, 10) || 1;
    const clampedDue = Math.min(31, Math.max(1, dueDay));
    const updated = accounts.map(acc => {
      if (acc.id === id) {
        return { ...acc, dueDate: clampedDue };
      }
      return acc;
    });
    onUpdateAccounts(updated);
  };

  // Alterar porcentagens de uma conta diretamente (Seção 4)
  const handleAccountPercentageChange = (id: string, pctStr: string) => {
    const newPct = parseFloat(pctStr) || 0;
    const clampedPct = Math.min(100, Math.max(0, newPct));
    
    // Atualiza o valor correspondente: value = totalBudget * percentage / 100
    const updated = accounts.map(acc => {
      if (acc.id === id) {
        const calculatedValue = Math.round((totalBudget * clampedPct) / 100 * 100) / 100;
        return { 
          ...acc, 
          percentage: clampedPct,
          value: calculatedValue
        };
      }
      return acc;
    });
    
    onUpdateAccounts(updated);
  };

  // Excluir conta
  const handleDeleteAccount = (id: string) => {
    if (accounts.length <= 1) {
      alert("Você deve manter pelo menos uma conta configurada.");
      return;
    }
    const filtered = accounts.filter(acc => acc.id !== id);
    onUpdateAccounts(updateAndRecalculatePercentages(filtered));
  };

  // Adicionar nova conta
  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName.trim() || !newAccValue.trim()) return;

    const valueNum = Math.max(0, parseFloat(newAccValue) || 0);
    const dueNum = Math.min(31, Math.max(1, parseInt(newAccDue, 10) || 20));

    const newAccount: Account = {
      id: Date.now().toString(),
      name: newAccName.trim(),
      value: valueNum,
      dueDate: dueNum,
      percentage: 0 // será recalculado abaixo
    };

    const updated = [...accounts, newAccount];
    onUpdateAccounts(updateAndRecalculatePercentages(updated));

    // Resetar formulário
    setNewAccName('');
    setNewAccValue('');
    setNewAccDue('20');
  };

  // Executar instalação do PWA
  const triggerInstallApp = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          setShowInstallStatus('Instalando aplicativo...');
        } else {
          setShowInstallStatus('Instalação cancelada.');
        }
      });
    } else {
      // Caso não esteja disponível o trigger nativo (Safari ou já instalado)
      setShowInstallStatus('Para instalar no iOS: toque no botão Compartilhar e selecione "Adicionar à Tela de Início".');
    }
    setTimeout(() => {
      setShowInstallStatus(null);
    }, 5000);
  };

  return (
    <div id="settings-view-container" className="flex flex-col min-h-screen bg-[#F4F4F4] pb-24 text-[#1A1A1A] select-none animate-slideIn">
      {/* Settings Top Bar */}
      <header id="settings-header" className="flex items-center justify-between px-4 py-4 bg-white border-b border-[#E2E2E2] sticky top-0 z-10">
        <button
          id="back-to-home-btn"
          onClick={onGoBack}
          className="flex items-center gap-1.5 text-[#1A1A1A] hover:text-[#FF4500] font-display font-black text-xs uppercase tracking-wider bg-transparent cursor-pointer py-1 pr-3 pl-1 active:scale-95 transition-all"
        >
          <ArrowLeft size={16} strokeWidth={2.5} />
          VOLTAR
        </button>
        <span className="text-xs font-black uppercase tracking-widest text-[#FF4500] font-display">
          CONFIGURAÇÕES
        </span>
        <div className="w-16"></div> {/* Spacer to keep aligned */}
      </header>

      {/* Main Settings Subsections Container */}
      <div id="settings-main-scroll" className="flex-grow flex flex-col gap-5 p-4 max-w-sm mx-auto w-full">
        
        {/* SEÇÃO 2: RESUMO DO MÊS */}
        <section id="section-resumo-mes" className="bg-white border border-[#E2E2E2] rounded-xl p-5 shadow-none">
          <div className="flex items-center gap-2 mb-4 border-b border-[#F4F4F4] pb-2">
            <Wallet size={16} className="text-[#FF4500]" />
            <h2 className="text-xs font-black uppercase tracking-wider text-[#1A1A1A]">
              RESUMO DO MÊS
            </h2>
          </div>
          
          {/* Progress Bar */}
          <div id="progress-container" className="mb-5">
            <div className="flex justify-between items-center text-xs font-bold text-[#1A1A1A]/50 mb-2">
              <span>PROGRESSO TOTAL</span>
              <span className="text-[#FF4500] font-black">{progressPercent.toFixed(1)}%</span>
            </div>
            {/* Real Progress Bar */}
            <div className="w-full bg-[#F4F4F4] h-3 rounded-full overflow-hidden border border-[#E2E2E2]/60">
              <div 
                className="bg-[#FF4500] h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs mb-1">
            <div className="bg-[#F4F4F4] p-3 rounded-xl border border-transparent flex flex-col justify-between">
              <span className="text-[#1A1A1A]/40 font-bold mb-1 uppercase tracking-wider text-[10px]">Guardado</span>
              <span className="font-mono text-sm font-black text-green-600 leading-tight">
                {formatCurrency(totalSaved)}
              </span>
            </div>
            <div className="bg-[#F4F4F4] p-3 rounded-xl border border-transparent flex flex-col justify-between">
              <span className="text-[#1A1A1A]/40 font-bold mb-1 uppercase tracking-wider text-[10px]">Faltante</span>
              <span className="font-mono text-sm font-black text-[#1A1A1A] leading-tight">
                {formatCurrency(remainingToSave)}
              </span>
            </div>
            <div className="bg-[#F4F4F4] p-3 rounded-xl border border-transparent flex flex-col justify-between">
              <span className="text-[#1A1A1A]/40 font-bold mb-1 uppercase tracking-wider text-[10px]">Dias para trabalhar</span>
              <span className="font-display text-sm font-black text-[#FF4500] leading-tight">
                {remainingWorkDays} {remainingWorkDays === 1 ? 'dia' : 'dias'}
              </span>
            </div>
            <div className="bg-[#F4F4F4] p-3 rounded-xl border border-transparent flex flex-col justify-between">
              <span className="text-[#1A1A1A]/40 font-bold mb-1 uppercase tracking-wider text-[10px]">Meta Diária</span>
              <span className="font-mono text-sm font-black text-[#FF4500] leading-tight">
                {formatCurrency(settingsDailyMetaValue)}
              </span>
            </div>
          </div>
        </section>

        {/* SEÇÃO DO CALENDÁRIO DE TRABALHO E FOLGA */}
        <section id="section-folgas" className="bg-white border border-[#E2E2E2] rounded-xl p-5 shadow-none">
          <div className="flex items-center gap-2 mb-4 border-b border-[#F4F4F4] pb-2">
            <Calendar size={16} className="text-[#FF4500]" />
            <h2 className="text-xs font-black uppercase tracking-wider text-[#1A1A1A]">
              MEUS DIAS DE TRABALHO E FOLGA
            </h2>
          </div>

          <div className="mb-4">
            <span className="block text-[10px] text-[#1A1A1A]/40 font-bold uppercase tracking-wider text-left">
              PERÍODO DE TRABALHO ATUAL
            </span>
            <span className="block font-display text-xs font-black text-[#FF4500] uppercase mt-1">
              Dia 21 até Dia 20 ({getPeriodText()})
            </span>
            <span className="block text-[10px] text-[#1A1A1A]/50 font-bold uppercase mt-1 text-left">
              Folgas marcadas neste período: <strong className="text-red-600 font-black">{totalOffDays} {totalOffDays === 1 ? 'dia' : 'dias'}</strong>
            </span>
            {totalOffDays >= 30 && (
              <span className="block text-[10px] text-red-600 font-black uppercase mt-1 bg-red-50 p-2 rounded-lg border border-red-100 text-left animate-fadeIn">
                ⚠️ Defina pelo menos 1 dia para trabalhar!
              </span>
            )}
          </div>

          {/* Botão de Marcar Dia */}
          {!showDatePicker ? (
            <button
              id="adicionar-dia-btn"
              type="button"
              onClick={() => setShowDatePicker(true)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#1A1A1A] hover:bg-[#FF4500] text-white font-display font-black text-xs rounded-xl active:scale-97 transition-all tracking-wider uppercase cursor-pointer"
            >
              <Plus size={14} className="stroke-[3px]" />
              ADICIONAR / MARCAR DIA
            </button>
          ) : (
            <div className="bg-[#F4F4F4] p-4 rounded-xl border border-[#E2E2E2]/60 mb-4 text-left">
              <span className="block text-[10px] text-[#1A1A1A]/50 font-black uppercase tracking-wider mb-2">
                Escolher qualquer dia:
              </span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-white border border-[#E2E2E2] rounded-lg px-3 py-2 text-xs text-[#1A1A1A] font-mono font-bold focus:outline-none focus:border-[#FF4500] mb-3"
              />
              
              <div className="grid grid-cols-2 gap-2.5 mb-3.5">
                <button
                  type="button"
                  onClick={() => {
                    const updated = { ...markedDays, [selectedDate]: 'work' as const };
                    onUpdateMarkedDays(updated);
                    setShowDatePicker(false);
                  }}
                  className="py-3 bg-green-600 hover:bg-green-700 text-white font-display font-black text-[10px] rounded-lg cursor-pointer uppercase text-center transition-all tracking-wide shadow-none border border-transparent"
                >
                  ✅ TRABALHEI
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const updated = { ...markedDays, [selectedDate]: 'off' as const };
                    onUpdateMarkedDays(updated);
                    setShowDatePicker(false);
                  }}
                  className="py-3 bg-red-600 hover:bg-red-700 text-white font-display font-black text-[10px] rounded-lg cursor-pointer uppercase text-center transition-all tracking-wide shadow-none border border-transparent"
                >
                  ❌ DIA DE FOLGA
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowDatePicker(false)}
                className="w-full text-center text-[10px] font-black text-[#1A1A1A]/50 hover:text-[#FF4500] uppercase tracking-wider bg-transparent p-1"
              >
                Cancelar
              </button>
            </div>
          )}

          {/* List of Marked Days in current cycle */}
          <div className="mt-4 border-t border-[#F4F4F4] pt-4 text-left">
            <span className="block text-[10px] text-[#1A1A1A]/40 font-bold uppercase tracking-wider mb-3.5">
              DIAS MARCADOS NESTE PERÍODO
            </span>
            {Object.entries(markedDays).filter(([dateStr]) => {
              const dates = getCurrentCycleDates();
              return dateStr >= dates.startStr && dateStr <= dates.endStr;
            }).length === 0 ? (
              <span className="block text-[10px] font-bold text-[#1A1A1A]/30 text-center py-2 uppercase tracking-wide">
                Nenhum dia de folga ou trabalho marcado
              </span>
            ) : (
              <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                {Object.entries(markedDays)
                  .filter(([dateStr]) => {
                    const dates = getCurrentCycleDates();
                    return dateStr >= dates.startStr && dateStr <= dates.endStr;
                  })
                  .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
                  .map(([dateStr, status]) => {
                    const isOff = status === 'off';
                    return (
                      <div 
                        key={dateStr}
                        className="flex items-center justify-between p-2.5 bg-[#F4F4F4] rounded-lg border border-[#E2E2E2]/40"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-[#1A1A1A]">
                            {formatLocalDate(dateStr)}
                          </span>
                          <span className={`text-[9px] font-sans font-black uppercase px-2 py-0.5 rounded-md ${
                            isOff 
                              ? 'bg-red-100 text-red-600 border border-red-200' 
                              : 'bg-green-100 text-green-700 border border-green-200'
                          }`}>
                            {isOff ? 'FOLGA' : 'TRABALHO'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = { ...markedDays };
                            delete updated[dateStr];
                            onUpdateMarkedDays(updated);
                          }}
                          className="text-[#1A1A1A]/40 hover:text-red-600 p-1 hover:bg-[#E2E2E2] rounded transition-all cursor-pointer"
                          title="Remover marcação"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </section>

        {/* SEÇÃO 1: MINHAS CONTAS MENSAIS */}
        <section id="section-minhas-contas" className="bg-white border border-[#E2E2E2] rounded-xl p-5 shadow-none">
          <div className="flex items-center justify-between mb-4 border-b border-[#F4F4F4] pb-2">
            <div className="flex items-center gap-2">
              <ClipboardList size={16} className="text-[#FF4500]" />
              <h2 className="text-xs font-black uppercase tracking-wider text-[#1A1A1A]">
                MINHAS CONTAS MENSAIS
              </h2>
            </div>
            <span className="font-mono text-xs font-bold text-[#1A1A1A]/50">
              {formatCurrency(totalBudget)}
            </span>
          </div>

          {/* List of Accounts */}
          <div id="accounts-editor-list" className="flex flex-col gap-3 mb-4">
            {accounts.map((acc) => (
              <div 
                key={acc.id} 
                className="bg-[#F4F4F4] p-4 rounded-xl border border-[#E2E2E2]/60 flex flex-col gap-2.5 relative transition-all"
              >
                {/* Delete button positioned absolute right top */}
                <button
                  type="button"
                  onClick={() => handleDeleteAccount(acc.id)}
                  className="absolute right-3 top-3 text-[#1A1A1A]/40 hover:text-red-600 p-1 hover:bg-[#E2E2E2] rounded-lg active:scale-90 transition-all cursor-pointer"
                  title="Excluir Conta"
                >
                  <Trash2 size={14} />
                </button>

                {/* Account Name Header */}
                <span className="text-xs font-extrabold text-[#1A1A1A] uppercase tracking-wide select-none max-w-[80%] truncate">
                  {acc.name}
                </span>

                {/* Value Input and Due day editor row */}
                <div className="grid grid-cols-2 gap-2.5">
                  {/* Value field */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] uppercase font-bold text-[#1A1A1A]/40 tracking-wider">Valor</span>
                    <div className="flex items-center bg-white rounded-lg px-2.5 py-1.5 border border-[#E2E2E2]">
                      <span className="text-xs font-black text-[#FF4500] mr-1">R$</span>
                      <input
                        type="number"
                        step="any"
                        placeholder="0.00"
                        value={acc.value || ''}
                        onChange={(e) => handleAccountValueChange(acc.id, e.target.value)}
                        className="bg-transparent text-[#1A1A1A] font-mono font-bold text-xs w-full focus:outline-none focus:text-[#FF4500]"
                      />
                    </div>
                  </div>

                  {/* Due day field */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] uppercase font-bold text-[#1A1A1A]/40 tracking-wider">Vencimento</span>
                    <div className="flex items-center bg-white rounded-lg px-2.5 py-1.5 border border-[#E2E2E2]">
                      <Calendar size={11} className="text-[#1A1A1A]/40 mr-1.5" />
                      <input
                        type="number"
                        min="1"
                        max="31"
                        placeholder="20"
                        value={acc.dueDate || ''}
                        onChange={(e) => handleAccountDueChange(acc.id, e.target.value)}
                        className="bg-transparent text-[#1A1A1A] font-mono font-bold text-xs w-full focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Form to Add New Account */}
          <form onSubmit={handleAddAccount} className="bg-white p-4 rounded-xl border-2 border-dashed border-[#E2E2E2] flex flex-col gap-3 mt-5">
            <span className="text-xs font-extrabold uppercase text-[#FF4500] tracking-wider flex items-center gap-1">
              <Plus size={14} />
              ADICIONAR NOVA CONTA
            </span>
            <div className="flex flex-col gap-2.5 mt-1">
              <input
                type="text"
                placeholder="Nome da conta (ex: Gasolina)"
                value={newAccName}
                onChange={(e) => setNewAccName(e.target.value)}
                className="bg-[#F4F4F4] border border-[#E2E2E2] rounded-lg px-3 py-2 text-xs text-[#1A1A1A] placeholder-[#1A1A1A]/30 focus:outline-none focus:border-[#FF4500] w-full font-bold"
              />
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center bg-[#F4F4F4] rounded-lg px-2 border border-[#E2E2E2]">
                  <span className="text-xs font-black text-[#1A1A1A]/40 mr-1">R$</span>
                  <input
                    type="number"
                    step="any"
                    placeholder="Valor"
                    value={newAccValue}
                    onChange={(e) => setNewAccValue(e.target.value)}
                    className="bg-transparent text-[#1A1A1A] font-mono font-bold text-xs py-2 w-full focus:outline-none"
                  />
                </div>
                <div className="flex items-center bg-[#F4F4F4] rounded-lg px-2 border border-[#E2E2E2]">
                  <span className="text-[9px] font-bold text-[#1A1A1A]/40 mr-1.5 uppercase">Dia:</span>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    placeholder="Venc."
                    value={newAccDue}
                    onChange={(e) => setNewAccDue(e.target.value)}
                    className="bg-transparent text-[#1A1A1A] font-mono font-bold text-xs py-2 w-full focus:outline-none"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={!newAccName.trim() || !newAccValue.trim()}
                className="w-full mt-1 bg-[#1A1A1A] hover:bg-[#FF4500] hover:text-white disabled:opacity-30 text-white font-display font-black text-xs py-2.5 rounded-lg transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1 uppercase tracking-wider"
              >
                CADASTRAR CONTA
              </button>
            </div>
          </form>
        </section>

        {/* SEÇÃO 4: EDITAR PORCENTAGENS */}
        <section id="section-porcentagens" className="bg-white border border-[#E2E2E2] rounded-xl p-5 shadow-none">
          <div className="flex items-center gap-2 mb-3 border-b border-[#F4F4F4] pb-2">
            <Percent size={16} className="text-[#FF4500]" />
            <h2 className="text-xs font-black uppercase tracking-wider text-[#1A1A1A]">
              EDITAR PORCENTAGENS
            </h2>
          </div>
          
          <p className="text-[10px] font-bold text-[#1A1A1A]/40 mb-4 text-left uppercase tracking-wider">
            * ATUALIZA AUTOMATICAMENTE AO ALTERAR O VALOR
          </p>

          <div className="flex flex-col gap-2.5">
            {accounts.map((acc) => (
              <div 
                key={`pct-${acc.id}`} 
                className="flex items-center justify-between bg-[#F4F4F4] p-3 rounded-xl border border-[#E2E2E2]/60"
              >
                <div className="flex flex-col min-w-0 max-w-[50%] mr-2">
                  <span className="text-xs font-black text-[#1A1A1A] truncate text-left uppercase">
                    {acc.name}
                  </span>
                  <span className="font-mono text-[10px] text-[#1A1A1A]/50 text-left mt-0.5 font-bold">
                    {formatCurrency(acc.value)}
                  </span>
                </div>
                
                {/* Input para Editar Porcentagem diretamente */}
                <div className="w-28 flex items-center bg-white rounded-lg px-2.5 py-1.5 border border-[#E2E2E2] justify-end">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={acc.percentage || ''}
                    onChange={(e) => handleAccountPercentageChange(acc.id, e.target.value)}
                    className="bg-transparent text-[#1A1A1A] font-mono font-bold text-xs w-full focus:outline-none text-right pr-1 focus:text-[#FF4500]"
                  />
                  <span className="text-xs font-black text-[#FF4500] select-none">%</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SEÇÃO 3: FERRAMENTAS */}
        <section id="section-ferramentas" className="bg-white border border-[#E2E2E2] rounded-xl p-5 shadow-none mb-4">
          <div className="flex items-center gap-2 mb-4 border-b border-[#F4F4F4] pb-2">
            <Plus size={16} className="text-[#FF4500]" />
            <h2 className="text-xs font-black uppercase tracking-wider text-[#1A1A1A]">
              FERRAMENTAS
            </h2>
          </div>

          <div className="flex flex-col gap-2.5">
            {/* Instalar Aplicativo */}
            <button
              type="button"
              onClick={triggerInstallApp}
              className="w-full flex items-center justify-between p-3.5 bg-[#F4F4F4] hover:bg-[#E2E2E2] border border-[#E2E2E2]/60 rounded-xl transition-all active:scale-98 cursor-pointer text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#FF4500]/10 text-[#FF4500] rounded-lg">
                  <Download size={15} strokeWidth={2.5} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-extrabold text-[#1A1A1A] uppercase tracking-wide">Instalar Aplicativo</span>
                  <span className="text-[10px] text-[#1A1A1A]/40 font-bold uppercase w-full">Utilizar PWA na tela inicial</span>
                </div>
              </div>
            </button>

            {/* Ver Histórico */}
            <button
              type="button"
              onClick={() => setShowHistoryModal(true)}
              className="w-full flex items-center justify-between p-3.5 bg-[#F4F4F4] hover:bg-[#E2E2E2] border border-[#E2E2E2]/60 rounded-xl transition-all active:scale-98 cursor-pointer text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#FF4500]/10 text-[#FF4500] rounded-lg">
                  <History size={15} strokeWidth={2.5} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-extrabold text-[#1A1A1A] uppercase tracking-wide">Ver Histórico</span>
                  <span className="text-[10px] text-[#1A1A1A]/40 font-bold uppercase w-full">Lista de ganhos anteriores</span>
                </div>
              </div>
              <span className="bg-[#1A1A1A] text-white font-mono text-[10px] font-bold py-0.5 px-2.5 rounded-full">
                {history.length}
              </span>
            </button>

            {/* Zerar Mês Novo */}
            <button
              type="button"
              onClick={() => {
                if (confirm("Deseja zerar os valores guardados neste mês? Isso resetará o progresso para R$ 0,00, mas o histórico anterior de cálculos será mantido.")) {
                  onResetSaved();
                }
              }}
              className="w-full flex items-center justify-between p-3.5 bg-[#F4F4F4] hover:bg-red-500 hover:text-white border border-[#E2E2E2]/60 group rounded-xl transition-all active:scale-98 cursor-pointer text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/10 text-red-600 group-hover:bg-white/20 group-hover:text-white rounded-lg">
                  <RotateCcw size={15} strokeWidth={2.5} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-extrabold text-[#1A1A1A] group-hover:text-white uppercase tracking-wide">Zerar Mês Novo</span>
                  <span className="text-[10px] text-[#1A1A1A]/40 group-hover:text-white/80 font-bold uppercase w-full">Resetar progresso atual</span>
                </div>
              </div>
            </button>
          </div>

          {showInstallStatus && (
            <div className="mt-3 p-3 bg-[#F4F4F4] border border-[#E2E2E2] rounded-xl flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle size={14} className="text-[#FF4500] shrink-0 mt-0.5" />
              <span className="text-[10px] font-bold uppercase tracking-wide text-[#1A1A1A]/70 leading-normal">
                {showInstallStatus}
              </span>
            </div>
          )}
        </section>
      </div>

      {/* MODAL / OVERLAY DE HISTÓRICO COM RASPAGEM DE FUNDO */}
      {showHistoryModal && (
        <div id="history-modal-overlay" className="fixed inset-0 bg-[#1A1A1A]/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 select-none animate-fadeIn">
          <div id="history-modal-card" className="bg-white border border-[#E2E2E2] rounded-2xl w-full max-w-sm flex flex-col max-h-[85vh] shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#F4F4F4]">
              <span className="text-xs font-black uppercase tracking-wider text-[#FF4500] flex items-center gap-1.5 font-display">
                <History size={15} strokeWidth={2.5} />
                Histórico de Ganhos
              </span>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="text-[#1A1A1A] hover:bg-[#F4F4F4] p-1.5 rounded-lg active:scale-95 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Scroll content area */}
            <div className="flex-grow overflow-y-auto p-4 flex flex-col gap-3 bg-[#F4F4F4]">
              {history.length === 0 ? (
                <div className="text-center py-10 flex flex-col items-center gap-2">
                  <AlertCircle size={24} className="text-[#1A1A1A]/30" />
                  <span className="text-xs font-bold text-[#1A1A1A]/40 uppercase tracking-wider">
                    Nenhum cálculo registrado ainda
                  </span>
                </div>
              ) : (
                [...history].reverse().map((entry, idx) => (
                  <div 
                    key={entry.id || idx}
                    className="bg-white p-4 rounded-xl border border-[#E2E2E2] flex flex-col gap-3"
                  >
                    {/* Entry Header date and Total calculated */}
                    <div className="flex items-center justify-between border-b border-[#F4F4F4] pb-2">
                      <span className="text-[10px] font-bold text-[#1A1A1A]/40 font-mono">
                        {entry.date}
                      </span>
                      <span className="font-display text-sm font-black text-[#FF4500]">
                        {formatCurrency(entry.gain)}
                      </span>
                    </div>

                    {/* Breakdown distribution items list */}
                    <div className="flex flex-col gap-2">
                      {entry.allocations.map((alloc, aidx) => (
                        <div key={aidx} className="flex items-center justify-between text-xs">
                          <span className="text-[#1A1A1A]/60 font-bold uppercase tracking-wide text-left text-[11px]">
                            {alloc.name}
                          </span>
                          <span className="font-mono text-[#1A1A1A] font-bold text-right text-xs">
                            {formatCurrency(alloc.value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 border-t border-[#F4F4F4] bg-white">
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="w-full bg-[#1A1A1A] hover:bg-[#FF4500] text-white font-display font-black text-xs py-3 rounded-xl active:scale-95 transition-all text-center cursor-pointer uppercase tracking-wider"
              >
                FECHAR HISTÓRICO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
