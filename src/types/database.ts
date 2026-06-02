export type EntityType = 'trust' | 'company' | 'personal';
export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';
export type NormalBalance = 'debit' | 'credit';

export interface Entity {
  id: string;
  name: string;
  type: EntityType;
  tax_number: string | null;
  registration_number: string | null;
  financial_year_end: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: string;
  entity_id: string;
  code: string;
  name: string;
  type: AccountType;
  category: string | null;
  description: string | null;
  normal_balance: NormalBalance;
  is_active: boolean;
  created_at: string;
}

export interface OfficialRate {
  id: string;
  effective_date: string;
  rate: number;
  notes: string | null;
  created_at: string;
}

export interface Section7cLoan {
  id: string;
  lender_name: string;
  borrower_entity_id: string;
  description: string;
  principal_amount: number;
  loan_date: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // joined
  borrower?: Entity;
}

export interface Section7cPayment {
  id: string;
  loan_id: string;
  payment_date: string;
  amount: number;
  tax_year: number;
  notes: string | null;
  created_at: string;
}

export type Database = {
  public: {
    Tables: {
      entities: { Row: Entity; Insert: Omit<Entity, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Entity> };
      accounts: { Row: Account; Insert: Omit<Account, 'id' | 'created_at'>; Update: Partial<Account> };
      official_rates: { Row: OfficialRate; Insert: Omit<OfficialRate, 'id' | 'created_at'>; Update: Partial<OfficialRate> };
      section7c_loans: { Row: Section7cLoan; Insert: Omit<Section7cLoan, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Section7cLoan> };
      section7c_payments: { Row: Section7cPayment; Insert: Omit<Section7cPayment, 'id' | 'created_at'>; Update: Partial<Section7cPayment> };
    };
  };
};
