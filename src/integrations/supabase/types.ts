export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      clientes: {
        Row: {
          cnpj: string | null
          contato: string | null
          created_at: string
          email: string | null
          id: string
          nome: string
          observacoes: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          contato?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          contato?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ordens_servico: {
        Row: {
          cliente_id: string | null
          created_at: string
          created_by: string | null
          data_entrega_prev: string | null
          data_entrega_real: string | null
          data_faturamento_real: string | null
          data_inicio_prev: string | null
          descricao: string | null
          fora_escopo: string | null
          gestor: string | null
          id: string
          local_entrega: string | null
          nota_fiscal_anexo_id: string | null
          numero_nota_fiscal: string | null
          numero_os: string
          numero_pedido: string | null
          numero_ss: string | null
          orcamentista: string | null
          peso_kg: number | null
          projeto: string | null
          quantidade: number | null
          solicitante: string | null
          status: Database["public"]["Enums"]["os_status"]
          tipo_frete: string | null
          unidade: string | null
          updated_at: string
          valor_faturado_real: number | null
          valor_total: number | null
          valor_unit: number | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          data_entrega_prev?: string | null
          data_entrega_real?: string | null
          data_faturamento_real?: string | null
          data_inicio_prev?: string | null
          descricao?: string | null
          fora_escopo?: string | null
          gestor?: string | null
          id?: string
          local_entrega?: string | null
          nota_fiscal_anexo_id?: string | null
          numero_nota_fiscal?: string | null
          numero_os: string
          numero_pedido?: string | null
          numero_ss?: string | null
          orcamentista?: string | null
          peso_kg?: number | null
          projeto?: string | null
          quantidade?: number | null
          solicitante?: string | null
          status?: Database["public"]["Enums"]["os_status"]
          tipo_frete?: string | null
          unidade?: string | null
          updated_at?: string
          valor_faturado_real?: number | null
          valor_total?: number | null
          valor_unit?: number | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          data_entrega_prev?: string | null
          data_entrega_real?: string | null
          data_faturamento_real?: string | null
          data_inicio_prev?: string | null
          descricao?: string | null
          fora_escopo?: string | null
          gestor?: string | null
          id?: string
          local_entrega?: string | null
          nota_fiscal_anexo_id?: string | null
          numero_nota_fiscal?: string | null
          numero_os?: string
          numero_pedido?: string | null
          numero_ss?: string | null
          orcamentista?: string | null
          peso_kg?: number | null
          projeto?: string | null
          quantidade?: number | null
          solicitante?: string | null
          status?: Database["public"]["Enums"]["os_status"]
          tipo_frete?: string | null
          unidade?: string | null
          updated_at?: string
          valor_faturado_real?: number | null
          valor_total?: number | null
          valor_unit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ordens_servico_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_nota_fiscal_anexo_id_fkey"
            columns: ["nota_fiscal_anexo_id"]
            isOneToOne: false
            referencedRelation: "os_anexos"
            referencedColumns: ["id"]
          },
        ]
      }
      os_anexos: {
        Row: {
          created_at: string
          id: string
          mime_type: string | null
          nome: string
          os_id: string
          storage_path: string
          tamanho: number | null
          tipo: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          mime_type?: string | null
          nome: string
          os_id: string
          storage_path: string
          tamanho?: number | null
          tipo?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          mime_type?: string | null
          nome?: string
          os_id?: string
          storage_path?: string
          tamanho?: number | null
          tipo?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "os_anexos_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      os_comentarios: {
        Row: {
          created_at: string
          id: string
          os_id: string
          texto: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          os_id: string
          texto: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          os_id?: string
          texto?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "os_comentarios_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      os_etapas: {
        Row: {
          created_at: string
          data: string | null
          id: string
          observacao: string | null
          os_id: string
          status: Database["public"]["Enums"]["etapa_status"]
          tipo: Database["public"]["Enums"]["etapa_tipo"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          data?: string | null
          id?: string
          observacao?: string | null
          os_id: string
          status?: Database["public"]["Enums"]["etapa_status"]
          tipo: Database["public"]["Enums"]["etapa_tipo"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          data?: string | null
          id?: string
          observacao?: string | null
          os_id?: string
          status?: Database["public"]["Enums"]["etapa_status"]
          tipo?: Database["public"]["Enums"]["etapa_tipo"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "os_etapas_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      os_historico: {
        Row: {
          acao: string
          created_at: string
          id: string
          os_id: string
          payload: Json | null
          user_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          id?: string
          os_id: string
          payload?: Json | null
          user_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          id?: string
          os_id?: string
          payload?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "os_historico_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      os_notas_fiscais: {
        Row: {
          created_at: string
          data_emissao: string
          id: string
          nome_arquivo: string
          numero_nota_fiscal: string | null
          os_id: string
          storage_path: string
          uploaded_by: string | null
          valor: number
        }
        Insert: {
          created_at?: string
          data_emissao: string
          id?: string
          nome_arquivo: string
          numero_nota_fiscal?: string | null
          os_id: string
          storage_path: string
          uploaded_by?: string | null
          valor: number
        }
        Update: {
          created_at?: string
          data_emissao?: string
          id?: string
          nome_arquivo?: string
          numero_nota_fiscal?: string | null
          os_id?: string
          storage_path?: string
          uploaded_by?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "os_notas_fiscais_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          nome?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "pcp" | "producao" | "viewer"
      etapa_status: "pendente" | "concluido"
      etapa_tipo:
        | "abertura"
        | "solicitacao_material"
        | "chegada_material"
        | "pintura"
        | "entrega"
      os_status:
        | "aberta"
        | "aguardando_material"
        | "em_producao"
        | "em_pintura"
        | "pronta"
        | "entregue"
        | "atrasada"
        | "cancelada"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "pcp", "producao", "viewer"],
      etapa_status: ["pendente", "concluido"],
      etapa_tipo: [
        "abertura",
        "solicitacao_material",
        "chegada_material",
        "pintura",
        "entrega",
      ],
      os_status: [
        "aberta",
        "aguardando_material",
        "em_producao",
        "em_pintura",
        "pronta",
        "entregue",
        "atrasada",
        "cancelada",
      ],
    },
  },
} as const
