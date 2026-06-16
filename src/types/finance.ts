export type ExpenseType = 'FIXED' | 'VARIABLE' | 'CARD' | 'SUBSCRIPTION';
export type BoxEntryType = 'DEPOSIT' | 'WITHDRAW';
export type InvestmentType = 'RENDA_FIXA' | 'RENDA_VARIAVEL' | 'FUNDO' | 'CRIPTO' | 'PREVIDENCIA' | 'OUTRO';

export interface ExpenseCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: ExpenseType;
  payment?: string;
  notes?: string;
  categoryId: string;
  category?: ExpenseCategory;
}

export interface SavingBoxEntry {
  id: string;
  type: BoxEntryType;
  amount: number;
  date: string;
  note?: string;
}

export interface SavingBox {
  id: string;
  name: string;
  description?: string;
  target: number;
  deadline?: string | null;
  color: string;
  icon: string;
  balance: number;
  progress: number;
  entries: SavingBoxEntry[];
}

export interface InvestmentRecord {
  id: string;
  date: string;
  investedAmount: number;
  currentValue: number;
  monthlyContribution: number;
  note?: string;
}

export interface Investment {
  id: string;
  name: string;
  type: InvestmentType;
  institution?: string;
  goal?: number | null;
  color: string;
  records: InvestmentRecord[];
  latestValue: number;
  latestInvested: number;
  profitability: number;
}

export interface NetWorthSnapshot {
  id: string;
  date: string;
  cash: number;
  otherAssets: number;
  liabilities: number;
  investments: number;
  boxes: number;
  total: number;
  note?: string;
}

export interface Overview {
  cards: {
    monthlyExpenses: number;
    boxesBalance: number;
    boxesTarget: number;
    investmentsValue: number;
    investmentsInvested: number;
    investmentsProfit: number;
    netWorth: number;
  };
  expensesByCategory: { name: string; total: number; color: string }[];
  expenseTrend: { month: string; total: number }[];
  boxes: SavingBox[];
  investmentTrend: { month: string; total: number }[];
  investments: Investment[];
  netWorthHistory: NetWorthSnapshot[];
}
