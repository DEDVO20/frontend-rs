// Tipos compartidos del módulo tributario (espejo del backend tax.service).

export interface TaxProfile {
  id?: string
  name: string
  description: string | null
  tax_regime: 'ORDINARY' | 'SIMPLE'
  iva_responsible: boolean
  grand_taxpayer: boolean
  self_withholder: boolean
  subject_income_withholding: boolean
  subject_ica_withholding: boolean
  subject_iva_withholding: boolean
  agent_income_withholding: boolean
  agent_ica_withholding: boolean
  agent_iva_withholding: boolean
  iva_rate: number | null
  income_withholding_rate: number | null
  ica_withholding_rate: number | null
  iva_withholding_rate: number | null
  active: boolean
}

export function emptyTaxProfile(): TaxProfile {
  return {
    name: '', description: '',
    tax_regime: 'ORDINARY',
    iva_responsible: false, grand_taxpayer: false, self_withholder: false,
    subject_income_withholding: false, subject_ica_withholding: false, subject_iva_withholding: false,
    agent_income_withholding: false, agent_ica_withholding: false, agent_iva_withholding: false,
    iva_rate: null, income_withholding_rate: null, ica_withholding_rate: null, iva_withholding_rate: null,
    active: true,
  }
}

export interface ThirdParty {
  id: string
  name: string
  identification: string | null
  person_type: 'NATURAL' | 'JURIDICA'
  tax_profile_id: string | null
  active: boolean
}
