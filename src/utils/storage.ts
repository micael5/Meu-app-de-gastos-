import { AppState, Account, HistoryEntry } from '../types';

export const DEFAULT_ACCOUNTS: Account[] = [
  { id: '1', name: 'Aluguel', value: 800, dueDate: 20, percentage: 45.71 },
  { id: '2', name: 'Compras do Mês', value: 800, dueDate: 20, percentage: 45.71 },
  { id: '3', name: 'Internet', value: 100, dueDate: 20, percentage: 5.71 },
  { id: '4', name: 'Manutenção Bicicleta', value: 50, dueDate: 20, percentage: 2.86 }
];

const STORAGE_KEY = 'MEU_CONTROLE_ENTREGAS_STATE';

export function getCurrentCycleDates(baseDate?: Date) {
  const d = baseDate || new Date();
  const year = d.getFullYear();
  const month = d.getMonth(); // 0-11
  const date = d.getDate();

  let startYear = year;
  let startMonth = month;
  let endYear = year;
  let endMonth = month;

  if (date >= 21) {
    // Ciclo atual: dia 21 deste mês até dia 20 do mês seguinte
    startMonth = month;
    endMonth = month + 1;
    if (endMonth > 11) {
      endMonth = 0;
      endYear = year + 1;
    }
  } else {
    // Ciclo atual: dia 21 do mês anterior até dia 20 deste mês
    startMonth = month - 1;
    if (startMonth < 0) {
      startMonth = 11;
      startYear = year - 1;
    }
    endMonth = month;
  }

  const startDate = new Date(startYear, startMonth, 21, 0, 0, 0, 0);
  const endDate = new Date(endYear, endMonth, 20, 23, 59, 59, 999);

  const formatDateStr = (dateObj: Date): string => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dg = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${dg}`;
  };

  const startStr = formatDateStr(startDate);
  const endStr = formatDateStr(endDate);
  const cycleId = endStr; // Formato "YYYY-MM-20" identificando o ciclo

  return { start: startDate, end: endDate, startStr, endStr, cycleId };
}

export function getOffDaysCountForCurrentCycle(markedDays: { [dateStr: string]: 'work' | 'off' }, startStr: string, endStr: string): number {
  let count = 0;
  for (const dateStr in markedDays) {
    if (markedDays[dateStr] === 'off') {
      if (dateStr >= startStr && dateStr <= endStr) {
        count++;
      }
    }
  }
  return count;
}

export function loadAppState(): AppState {
  try {
    const serialized = localStorage.getItem(STORAGE_KEY);
    if (!serialized) {
      return {
        accounts: DEFAULT_ACCOUNTS,
        history: [],
        totalSavedThisMonth: 0,
        markedDays: {},
        currentCycleId: getCurrentCycleDates().cycleId
      };
    }
    const parsed = JSON.parse(serialized);
    
    // Garantir estrutura válida para evitar quebras se houver dados antigos obsoletos
    return {
      accounts: Array.isArray(parsed.accounts) ? parsed.accounts : DEFAULT_ACCOUNTS,
      history: Array.isArray(parsed.history) ? parsed.history : [],
      totalSavedThisMonth: typeof parsed.totalSavedThisMonth === 'number' ? parsed.totalSavedThisMonth : 0,
      markedDays: parsed.markedDays && typeof parsed.markedDays === 'object' ? parsed.markedDays : {},
      currentCycleId: typeof parsed.currentCycleId === 'string' ? parsed.currentCycleId : getCurrentCycleDates().cycleId,
    };
  } catch (error) {
    console.error('Erro ao ler do localStorage:', error);
    return {
      accounts: DEFAULT_ACCOUNTS,
      history: [],
      totalSavedThisMonth: 0,
      markedDays: {},
      currentCycleId: getCurrentCycleDates().cycleId
    };
  }
}

export function saveAppState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Erro ao salvar no localStorage:', error);
  }
}

export function calculateAllocations(gain: number, accounts: Account[]): { name: string; value: number }[] {
  if (accounts.length === 0) return [];
  
  // 1. Inicializar todas as alocações computando o valor base proporcional baseado em porcentagens
  const allocations = accounts.map(acc => {
    const rawVal = gain * (acc.percentage / 100);
    const roundedVal = Math.round(rawVal * 100) / 100;
    return { name: acc.name, value: roundedVal, accValue: acc.value };
  });

  // 2. Verificar a soma atual
  const sumComputed = allocations.reduce((sum, item) => sum + item.value, 0);
  let diffCentavos = Math.round((gain - sumComputed) * 100); // em inteiros de centavos

  if (diffCentavos !== 0) {
    const sign = Math.sign(diffCentavos); // +1 ou -1 centavo
    
    // Agrupar índices por valor do orçamento da conta
    const valueGroups: { [value: number]: number[] } = {};
    allocations.forEach((item, idx) => {
      if (!valueGroups[item.accValue]) {
        valueGroups[item.accValue] = [];
      }
      valueGroups[item.accValue].push(idx);
    });

    const groups = Object.entries(valueGroups).map(([val, idxs]) => ({
      value: parseFloat(val),
      idxs,
      size: idxs.length
    }));

    while (diffCentavos !== 0) {
      // Encontrar grupos elegíveis de menor tamanho cuja alteração caiba na diferença
      const eligibleGroups = groups.filter(g => g.size <= Math.abs(diffCentavos));
      
      if (eligibleGroups.length > 0) {
        // Ordenar preferencialmente por menor tamanho de grupo e maior orçamento
        eligibleGroups.sort((a, b) => {
          if (a.size !== b.size) {
            return a.size - b.size; // menor tamanho do grupo primeiro
          }
          return b.value - a.value; // maior orçamento primeiro
        });

        const groupToAdjust = eligibleGroups[0];
        groupToAdjust.idxs.forEach(idx => {
          allocations[idx].value = Math.round((allocations[idx].value + sign * 0.01) * 100) / 100;
        });
        diffCentavos -= sign * groupToAdjust.size;
      } else {
        // Caso extremo: ajusta na primeira conta do grupo de maior orçamento
        groups.sort((a, b) => b.value - a.value);
        const groupToAdjust = groups[0];
        const firstIdx = groupToAdjust.idxs[0];
        allocations[firstIdx].value = Math.round((allocations[firstIdx].value + sign * 0.01) * 100) / 100;
        diffCentavos -= sign;
      }
    }
  }

  // Retornar apenas name e value
  return allocations.map(item => ({ name: item.name, value: item.value }));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}
