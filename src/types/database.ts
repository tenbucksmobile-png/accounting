export type EntityType = 'trust' | 'company' | 'personal';
export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';
export type NormalBalance = 'debit' | 'credit';
export type AssetType = 'property' | 'shares' | 'cash' | 'other';

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

export interface JournalEntry {
  id: string;
  entity_id: string;
  entry_date: string;
  description: string;
  reference: string | null;
  source: 'manual' | 'import';
  is_reconciled: boolean;
  created_at: string;
  entity?: Entity;
  lines?: JournalLine[];
}

export interface JournalLine {
  id: string;
  entry_id: string;
  account_id: string;
  debit: number;
  credit: number;
  description: string | null;
  created_at: string;
  account?: Account;
}

export interface Asset {
  id: string;
  entity_id: string;
  name: string;
  type: AssetType;
  description: string | null;
  acquisition_date: string;
  cost_base_zar: number;
  current_value_zar: number | null;
  current_value_date: string | null;
  is_disposed: boolean;
  disposal_date: string | null;
  disposal_proceeds_zar: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  entity?: Entity;
  property_details?: AssetPropertyDetail;
  improvements?: AssetImprovement[];
  share_lots?: AssetShareLot[];
}

export interface AssetPropertyDetail {
  id: string;
  asset_id: string;
  address: string | null;
  erf_number: string | null;
  property_type: 'residential' | 'commercial' | 'vacant_land' | null;
  transfer_duty_paid: number;
  conveyancing_fees: number;
  building_cost_zar: number;
  s13_rate: number;
  s13_start_date: string | null;
  created_at: string;
}

export interface AssetImprovement {
  id: string;
  asset_id: string;
  description: string;
  amount_zar: number;
  date: string;
  created_at: string;
}

export interface AssetShareLot {
  id: string;
  asset_id: string;
  purchase_date: string;
  quantity: number;
  cost_per_unit_zar: number;
  currency: string;
  cost_per_unit_foreign: number | null;
  exchange_rate_at_buy: number;
  broker_fees_zar: number;
  notes: string | null;
  is_fully_disposed: boolean;
  disposed_quantity: number;
  disposal_date: string | null;
  disposal_proceeds_zar: number | null;
  created_at: string;
}

export interface TrustTrustee {
  id: string;
  name: string;
  role: string;
  is_independent: boolean;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

export interface TrustBeneficiary {
  id: string;
  name: string;
  date_of_birth: string;
  sa_resident: boolean;
  annual_other_income: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

export interface TrustLifePolicy {
  id: string;
  policy_number: string | null;
  insurer: string;
  insured_person: string;
  sum_assured_zar: number;
  annual_premium_zar: number | null;
  trust_owns_policy: boolean;
  notes: string | null;
  created_at: string;
}

export interface TrustDistributionResolution {
  id: string;
  beneficiary_id: string;
  tax_year: number;
  resolution_date: string;
  amount: number;
  income_character: 'interest' | 'dividend' | 'rental' | 'capital_gain' | 'other';
  notes: string | null;
  created_at: string;
  beneficiary?: TrustBeneficiary;
}

export type Database = { public: { Tables: Record<string, never> } };
