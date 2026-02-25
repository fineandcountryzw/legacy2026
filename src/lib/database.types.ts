export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      brand_profiles: {
        Row: {
          id: string
          user_id: string
          company_name: string
          logo_url: string | null
          contact_details: Json
          primary_color: string
          secondary_color: string
          accent_color: string
          is_global: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          company_name: string
          logo_url?: string | null
          contact_details?: Json
          primary_color?: string
          secondary_color?: string
          accent_color?: string
          is_global?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          company_name?: string
          logo_url?: string | null
          contact_details?: Json
          primary_color?: string
          secondary_color?: string
          accent_color?: string
          is_global?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      developments: {
        Row: {
          id: string
          user_id: string
          name: string
          code: string
          currency: string
          developer_name: string
          developer_contacts: string | null
          commission_rate: number
          brand_profile_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          code: string
          currency?: string
          developer_name: string
          developer_contacts?: string | null
          commission_rate?: number
          brand_profile_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          code?: string
          currency?: string
          developer_name?: string
          developer_contacts?: string | null
          commission_rate?: number
          brand_profile_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      development_stand_types: {
        Row: {
          id: string
          development_id: string
          label: string
          size_sqm: number
          base_price: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          development_id: string
          label: string
          size_sqm: number
          base_price: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          development_id?: string
          label?: string
          size_sqm?: number
          base_price?: number
          is_active?: boolean
          created_at?: string
        }
      }
      development_cost_items: {
        Row: {
          id: string
          development_id: string
          name: string
          cost_type: string
          value: number
          applies_to: string
          pay_to: string
          is_variable: boolean
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          development_id: string
          name: string
          cost_type: string
          value: number
          applies_to?: string
          pay_to: string
          is_variable?: boolean
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          development_id?: string
          name?: string
          cost_type?: string
          value?: number
          applies_to?: string
          pay_to?: string
          is_variable?: boolean
          is_active?: boolean
          created_at?: string
        }
      }
      stand_inventory: {
        Row: {
          id: string
          canonical_stand_key: string
          stand_number: string
          created_at: string
        }
        Insert: {
          id?: string
          canonical_stand_key: string
          stand_number: string
          created_at?: string
        }
        Update: {
          id?: string
          canonical_stand_key?: string
          stand_number?: string
          created_at?: string
        }
      }
      development_stands: {
        Row: {
          id: string
          development_id: string
          stand_inventory_id: string
          stand_type_id: string | null
          agreed_price: number | null
          status: string
          client_id: string | null
          client_name: string | null
          created_at: string
        }
        Insert: {
          id?: string
          development_id: string
          stand_inventory_id: string
          stand_type_id?: string | null
          agreed_price?: number | null
          status?: string
          client_id?: string | null
          client_name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          development_id?: string
          stand_inventory_id?: string
          stand_type_id?: string | null
          agreed_price?: number | null
          status?: string
          client_id?: string | null
          client_name?: string | null
          created_at?: string
        }
      }
      uploads: {
        Row: {
          id: string
          user_id: string
          development_id: string | null
          file_name: string
          file_path: string
          file_size: number | null
          status: string
          stands_detected: number
          transactions_detected: number
          error_message: string | null
          raw_data: Json | null
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          development_id?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          status?: string
          stands_detected?: number
          transactions_detected?: number
          error_message?: string | null
          raw_data?: Json | null
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          development_id?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          status?: string
          stands_detected?: number
          transactions_detected?: number
          error_message?: string | null
          raw_data?: Json | null
          created_at?: string
          completed_at?: string | null
        }
      }
      payment_transactions: {
        Row: {
          id: string
          user_id: string
          upload_id: string | null
          development_id: string
          stand_id: string | null
          transaction_date: string
          amount: number
          reference: string | null
          description: string | null
          status: string
          source_row_index: number | null
          idempotency_key: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          upload_id?: string | null
          development_id: string
          stand_id?: string | null
          transaction_date: string
          amount: number
          reference?: string | null
          description?: string | null
          status?: string
          source_row_index?: number | null
          idempotency_key?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          upload_id?: string | null
          development_id?: string
          stand_id?: string | null
          transaction_date?: string
          amount?: number
          reference?: string | null
          description?: string | null
          status?: string
          source_row_index?: number | null
          idempotency_key?: string | null
          created_at?: string
        }
      }
      transaction_allocations: {
        Row: {
          id: string
          transaction_id: string
          allocation_type: string
          pay_to: string
          amount: number
          created_at: string
        }
        Insert: {
          id?: string
          transaction_id: string
          allocation_type: string
          pay_to: string
          amount: number
          created_at?: string
        }
        Update: {
          id?: string
          transaction_id?: string
          allocation_type?: string
          pay_to?: string
          amount?: number
          created_at?: string
        }
      }
      clients: {
        Row: {
          id: string
          user_id: string
          name: string
          email: string | null
          phone: string | null
          id_number: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          email?: string | null
          phone?: string | null
          id_number?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          email?: string | null
          phone?: string | null
          id_number?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
