import React, { useState } from 'react';
import { Account, HistoryEntry } from '../types';
import { calculateAllocations, formatCurrency, getCurrentCycleDates, getOffDaysCountForCurrentCycle } from '../utils/storage';
import { Settings } from 'lucide-react';

interface HomeViewProps {
  accounts: Account[];
  markedDays: { [dateStr: string]: 'work' | 'off' };
  onCalculate: (gain: number, allocations: { name: string; value: number }[]) => void;
  onNavigateToSettings: () => void;
}

export default function HomeView({ accounts, markedDays, onCalculate, onNavigateToSettings }: HomeViewProps) {
  const [inputValue, setInputValue] = useState<string>('');
  const [calculatedResult, setCalculatedResult] = useState<{
    gain: number;
    allocations: { name: string; value: number }[];
  } | null>(null);
  const [error, setError] = useState<string>('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Permitir apenas números e apenas uma vírgula ou ponto
    const cleaned = val.replace(/[^0-9,.]/g, '');
    // Se houver mais de uma vírgula/ponto, manter apenas a primeira ocorrência
    const parts = cleaned.split(/[,.]/);
    if (parts.length > 2) {
      setError('Digite um valor numérico válido (ex: 154,50)');
      return;
    }
    setError('');
    setInputValue(cleaned);
  };

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Normalizar vírgula para ponto e converter para float
    const normalized = inputValue.replace(',', '.');
    const parsedGain = parseFloat(normalized);

    if (isNaN(parsedGain) || parsedGain <= 0) {
      setError('Por favor, digite um valor maior que R$ 0,00');
      setCalculatedResult(null);
      return;
    }

    setError('');
    const allocations = calculateAllocations(parsedGain, accounts);
    setCalculatedResult({
      gain: parsedGain,
      allocations
    });

    // Enviar ao componente pai para atualizar histórico e resumos persistentes
    onCalculate(parsedGain, allocations);
  };

  const totalBudget = accounts.reduce((sum, acc) => sum + acc.value, 0);

  // Cálculo de dias e meta com folgas (Regra de 30 dias - folgas)
  const { startStr, endStr } = getCurrentCycleDates();
  const totalOffDays = getOffDaysCountForCurrentCycle(markedDays || {}, startStr, endStr);
  const remainingWorkDays = Math.max(1, 30 - totalOffDays);
  const dailyMetaValue = totalBudget / remainingWorkDays;

  return (
    <div id="home-view-container" className="flex flex-col min-h-screen pb-24 px-5 pt-8 justify-between select-none bg-white text-[#1A1A1A]">
      {/* Top Header */}
      <header id="home-header" className="text-center mt-4">
        <h1 id="app-title-literal" className="font-display font-black tracking-tight text-[#1A1A1A] text-2xl uppercase leading-none">
          MEU CONTROLE DE ENTREGAS
        </h1>
      </header>

      {/* Main Form Center Area */}
      <main id="home-main" className="flex-grow flex flex-col justify-center items-center my-6 max-w-sm mx-auto w-full">
        <form onSubmit={handleCalculate} id="calculation-form" className="w-full flex flex-col gap-4">
          <div id="input-group" className="flex flex-col gap-1 w-full text-left">
            <span id="input-label" className="block text-xs font-bold uppercase tracking-wider text-[#1A1A1A]/50 mb-2">
              GANHO DO DIA
            </span>
            {/* Input Label & Styled Text Input */}
            <div id="input-sub-container" className="relative bg-white border-4 border-[#FF4500] rounded-xl p-5 transition-all duration-300 focus-within:ring-4 focus-within:ring-[#FF4500]/10">
              <div className="flex items-center justify-center">
                <span className="text-2xl font-black text-[#FF4500] mr-1 select-none">R$</span>
                <input
                  id="gain-input-field"
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={inputValue}
                  onChange={handleInputChange}
                  className="bg-transparent text-[#FF4500] text-4xl font-display font-black text-center focus:outline-none w-full placeholder-[#FF4500]/20 min-w-[150px]"
                />
              </div>
            </div>
            {error && (
              <span id="error-alert" className="text-xs font-bold text-red-500 mt-2 transition-all">
                {error}
              </span>
            )}
          </div>

          <button
            id="calculate-submit-btn"
            type="submit"
            className="w-full py-4.5 bg-[#FF4500] hover:bg-[#E03D00] text-white font-display font-black text-lg rounded-xl active:scale-97 transition-all tracking-wider uppercase cursor-pointer flex items-center justify-center h-14"
          >
            CALCULAR
          </button>
        </form>

        {/* Calculations Results Block */}
        {calculatedResult && (
          <div
            id="results-card"
            className="w-full mt-8 bg-white border-0 p-0 transition-all duration-500 animate-fadeIn"
          >
            <h2 id="results-title" className="text-sm font-black uppercase tracking-wider text-[#1A1A1A] mb-3 text-left">
              VALORES PARA GUARDAR
            </h2>
            <div id="results-items-list" className="flex flex-col">
              {calculatedResult.allocations.map((alloc, idx) => (
                <div
                  key={`${alloc.name}-${idx}`}
                  className="flex items-center justify-between border-b border-[#F4F4F4] py-3.5"
                >
                  <span className="text-sm font-bold text-[#1A1A1A] uppercase tracking-wide text-left">
                    {alloc.name}
                  </span>
                  <span className="font-mono text-base font-bold text-[#1A1A1A] text-right">
                    {formatCurrency(alloc.value)}
                  </span>
                </div>
              ))}
              
              {/* Grand Total Line */}
              <div id="results-total-line" className="flex items-center justify-between pt-3.5 mt-2 border-t-2 border-[#1A1A1A]">
                <span className="text-sm font-black uppercase tracking-wider text-[#1A1A1A] text-left">
                  TOTAL
                </span>
                <span className="font-display text-lg font-black text-[#FF4500] text-right">
                  {formatCurrency(calculatedResult.gain)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Container da Meta Diária (Adicionado conforme solicitação) */}
        <div
          id="meta-diaria-home-box"
          className="w-full mt-6 bg-[#FFEFEA] border border-[#FF4500]/30 rounded-xl p-5 text-center transition-all shadow-none flex flex-col items-center justify-center animate-fadeIn"
        >
          <span 
            id="meta-diaria-home-title" 
            className="block text-sm font-black uppercase tracking-widest text-[#CC3B00] mb-2 font-display"
          >
            META DO DIA
          </span>
          <span 
            id="meta-diaria-home-value" 
            className="block font-display text-3xl font-black text-[#FF4500]"
          >
            {formatCurrency(dailyMetaValue)}
          </span>
        </div>

        {totalOffDays >= 30 && (
          <div className="w-full mt-3 bg-red-50 border border-red-200 text-red-600 rounded-xl p-3.5 text-center text-xs font-black uppercase tracking-wider animate-fadeIn">
            ⚠️ Defina pelo menos 1 dia para trabalhar
          </div>
        )}
      </main>

      {/* Centered Fixed Settings Footer */}
      <footer id="home-footer" className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white to-transparent flex justify-center z-13">
        <button
          id="navigate-to-settings-btn"
          onClick={onNavigateToSettings}
          className="flex items-center gap-2 px-6 py-3 bg-[#F4F4F4] border border-transparent hover:border-[#FF4500]/20 text-[#1A1A1A] font-display font-bold text-xs uppercase tracking-wider rounded-xl shadow-none active:scale-95 transition-all cursor-pointer h-12"
        >
          <Settings size={15} className="animate-spin-hover text-[#1A1A1A]" />
          CONFIGURAÇÕES
        </button>
      </footer>
    </div>
  );
}
