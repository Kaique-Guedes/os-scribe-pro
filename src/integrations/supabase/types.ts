export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          nome: string;
          email: string | null;
          notif_atraso_email: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          nome?: string;
          email?: string | null;
          notif_atraso_email?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nome?: string;
          email?: string | null;
          notif_atraso_email?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: Database["public"]["Enums"]["app_role"];
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: Database["public"]["Enums"]["app_role"];
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          created_at?: string;
        };
        Relationships: [];
      };
      clientes: {
        Row: {
          id: string;
          nome: string;
          contato: string | null;
          email: string | null;
          telefone: string | null;
          cnpj: string | null;
          observacoes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          nome: string;
          contato?: string | null;
          email?: string | null;
          telefone?: string | null;
          cnpj?: string | null;
          observacoes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nome?: string;
          contato?: string | null;
          email?: string | null;
          telefone?: string | null;
          cnpj?: string | null;
          observacoes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ordens_servico: {
        Row: {
          id: string;
          numero_os: string;
          cliente_id: string | null;
          solicitante: string | null;
          numero_ss: string | null;
          numero_pedido: string | null;
          projeto: string | null;
          gestor: string | null;
          orcamentista: string | null;
          data_inicio_prev: string | null;
          data_entrega_prev: string | null;
          data_entrega_real: string | null;
          unidade: string | null;
          quantidade: number | null;
          valor_unit: number | null;
          valor_total: number | null;
          peso_kg: number | null;
          local_entrega: string | null;
          tipo_frete: string | null;
          descricao: string | null;
          fora_escopo: string | null;
          status: Database["public"]["Enums"]["os_status"];
          created_by: string | null;
          created_at: string;
          updated_at: string;
          // campos legados, substituídos por os_notas_fiscais
          valor_faturado_real: number | null;
          data_faturamento_real: string | null;
          numero_nota_fiscal: string | null;
          nota_fiscal_anexo_id: string | null;
        };
        Insert: {
          id?: string;
          numero_os: string;
          cliente_id?: string | null;
          solicitante?: string | null;
          numero_ss?: string | null;
          numero_pedido?: string | null;
          projeto?: string | null;
          gestor?: string | null;
          orcamentista?: string | null;
          data_inicio_prev?: string | null;
          data_entrega_prev?: string | null;
          data_entrega_real?: string | null;
          unidade?: string | null;
          quantidade?: number | null;
          valor_unit?: number | null;
          valor_total?: number | null;
          peso_kg?: number | null;
          local_entrega?: string | null;
          tipo_frete?: string | null;
          descricao?: string | null;
          fora_escopo?: string | null;
          status?: Database["public"]["Enums"]["os_status"];
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          valor_faturado_real?: number | null;
          data_faturamento_real?: string | null;
          numero_nota_fiscal?: string | null;
          nota_fiscal_anexo_id?: string | null;
        };
        Update: {
          id?: string;
          numero_os?: string;
          cliente_id?: string | null;
          solicitante?: string | null;
          numero_ss?: string | null;
          numero_pedido?: string | null;
          projeto?: string | null;
          gestor?: string | null;
          orcamentista?: string | null;
          data_inicio_prev?: string | null;
          data_entrega_prev?: string | null;
          data_entrega_real?: string | null;
          unidade?: string | null;
          quantidade?: number | null;
          valor_unit?: number | null;
          valor_total?: number | null;
          peso_kg?: number | null;
          local_entrega?: string | null;
          tipo_frete?: string | null;
          descricao?: string | null;
          fora_escopo?: string | null;
          status?: Database["public"]["Enums"]["os_status"];
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          valor_faturado_real?: number | null;
          data_faturamento_real?: string | null;
          numero_nota_fiscal?: string | null;
          nota_fiscal_anexo_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ordens_servico_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ordens_servico_nota_fiscal_anexo_id_fkey";
            columns: ["nota_fiscal_anexo_id"];
            isOneToOne: false;
            referencedRelation: "os_anexos";
            referencedColumns: ["id"];
          }
        ];
      };
      os_etapas: {
        Row: {
          id: string;
          os_id: string;
          tipo: Database["public"]["Enums"]["etapa_tipo"];
          data: string | null;
          status: Database["public"]["Enums"]["etapa_status"];
          observacao: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
          // novos campos (almoxarifado)
          data_pedido: string | null;
          pedido_compra_anexo_id: string | null;
          nota_fiscal_compra_anexo_id: string | null;
        };
        Insert: {
          id?: string;
          os_id: string;
          tipo: Database["public"]["Enums"]["etapa_tipo"];
          data?: string | null;
          status?: Database["public"]["Enums"]["etapa_status"];
          observacao?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
          data_pedido?: string | null;
          pedido_compra_anexo_id?: string | null;
          nota_fiscal_compra_anexo_id?: string | null;
        };
        Update: {
          id?: string;
          os_id?: string;
          tipo?: Database["public"]["Enums"]["etapa_tipo"];
          data?: string | null;
          status?: Database["public"]["Enums"]["etapa_status"];
          observacao?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
          data_pedido?: string | null;
          pedido_compra_anexo_id?: string | null;
          nota_fiscal_compra_anexo_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "os_etapas_os_id_fkey";
            columns: ["os_id"];
            isOneToOne: false;
            referencedRelation: "ordens_servico";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "os_etapas_pedido_compra_anexo_id_fkey";
            columns: ["pedido_compra_anexo_id"];
            isOneToOne: false;
            referencedRelation: "os_anexos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "os_etapas_nota_fiscal_compra_anexo_id_fkey";
            columns: ["nota_fiscal_compra_anexo_id"];
            isOneToOne: false;
            referencedRelation: "os_anexos";
            referencedColumns: ["id"];
          }
        ];
      };
      os_comentarios: {
        Row: {
          id: string;
          os_id: string;
          user_id: string;
          texto: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          os_id: string;
          user_id: string;
          texto: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          os_id?: string;
          user_id?: string;
          texto?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "os_comentarios_os_id_fkey";
            columns: ["os_id"];
            isOneToOne: false;
            referencedRelation: "ordens_servico";
            referencedColumns: ["id"];
          }
        ];
      };
      os_historico: {
        Row: {
          id: string;
          os_id: string;
          user_id: string | null;
          acao: string;
          payload: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          os_id: string;
          user_id?: string | null;
          acao: string;
          payload?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          os_id?: string;
          user_id?: string | null;
          acao?: string;
          payload?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "os_historico_os_id_fkey";
            columns: ["os_id"];
            isOneToOne: false;
            referencedRelation: "ordens_servico";
            referencedColumns: ["id"];
          }
        ];
      };
      os_anexos: {
        Row: {
          id: string;
          os_id: string;
          storage_path: string;
          nome: string;
          mime_type: string | null;
          tipo: string | null;
          tamanho: number | null;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          os_id: string;
          storage_path: string;
          nome: string;
          mime_type?: string | null;
          tipo?: string | null;
          tamanho?: number | null;
          uploaded_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          os_id?: string;
          storage_path?: string;
          nome?: string;
          mime_type?: string | null;
          tipo?: string | null;
          tamanho?: number | null;
          uploaded_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "os_anexos_os_id_fkey";
            columns: ["os_id"];
            isOneToOne: false;
            referencedRelation: "ordens_servico";
            referencedColumns: ["id"];
          }
        ];
      };
      os_notas_fiscais: {
        Row: {
          id: string;
          os_id: string;
          numero_nota_fiscal: string | null;
          valor: number;
          data_emissao: string;
          storage_path: string;
          nome_arquivo: string;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          os_id: string;
          numero_nota_fiscal?: string | null;
          valor: number;
          data_emissao: string;
          storage_path: string;
          nome_arquivo: string;
          uploaded_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          os_id?: string;
          numero_nota_fiscal?: string | null;
          valor?: number;
          data_emissao?: string;
          storage_path?: string;
          nome_arquivo?: string;
          uploaded_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "os_notas_fiscais_os_id_fkey";
            columns: ["os_id"];
            isOneToOne: false;
            referencedRelation: "ordens_servico";
            referencedColumns: ["id"];
          }
        ];
      };
      material_cotacoes: {
        Row: {
          id: string;
          os_id: string;
          categoria: Database["public"]["Enums"]["material_categoria"];
          descricao: string;
          valor: number;
          prazo_entrega_dias: number | null;
          anexo_id: string | null;
          selecionada: boolean;
          chegou: boolean;
          data_chegada: string | null;
          pedido_compra_anexo_id: string | null;
          nota_fiscal_compra_anexo_id: string | null;
          observacoes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          os_id: string;
          categoria: Database["public"]["Enums"]["material_categoria"];
          descricao: string;
          valor: number;
          prazo_entrega_dias?: number | null;
          anexo_id?: string | null;
          selecionada?: boolean;
          chegou?: boolean;
          data_chegada?: string | null;
          pedido_compra_anexo_id?: string | null;
          nota_fiscal_compra_anexo_id?: string | null;
          observacoes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          os_id?: string;
          categoria?: Database["public"]["Enums"]["material_categoria"];
          descricao?: string;
          valor?: number;
          prazo_entrega_dias?: number | null;
          anexo_id?: string | null;
          selecionada?: boolean;
          chegou?: boolean;
          data_chegada?: string | null;
          pedido_compra_anexo_id?: string | null;
          nota_fiscal_compra_anexo_id?: string | null;
          observacoes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "material_cotacoes_os_id_fkey";
            columns: ["os_id"];
            isOneToOne: false;
            referencedRelation: "ordens_servico";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "material_cotacoes_anexo_id_fkey";
            columns: ["anexo_id"];
            isOneToOne: false;
            referencedRelation: "os_anexos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "material_cotacoes_pedido_compra_anexo_id_fkey";
            columns: ["pedido_compra_anexo_id"];
            isOneToOne: false;
            referencedRelation: "os_anexos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "material_cotacoes_nota_fiscal_compra_anexo_id_fkey";
            columns: ["nota_fiscal_compra_anexo_id"];
            isOneToOne: false;
            referencedRelation: "os_anexos";
            referencedColumns: ["id"];
          }
        ];
      };
      material_cotacao_itens: {
        Row: {
          id: string;
          cotacao_id: string;
          descricao: string;
          quantidade: number;
          unidade: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          cotacao_id: string;
          descricao: string;
          quantidade: number;
          unidade?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          cotacao_id?: string;
          descricao?: string;
          quantidade?: number;
          unidade?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "material_cotacao_itens_cotacao_id_fkey";
            columns: ["cotacao_id"];
            isOneToOne: false;
            referencedRelation: "material_cotacoes";
            referencedColumns: ["id"];
          }
        ];
      };
      material_conferencias: {
        Row: {
          id: string;
          os_id: string;
          cotacao_id: string;
          status: Database["public"]["Enums"]["conferencia_status"];
          resultado: Database["public"]["Enums"]["conferencia_resultado"] | null;
          observacoes: string | null;
          iniciado_by: string | null;
          iniciado_em: string | null;
          concluido_by: string | null;
          concluido_em: string | null;
          email_enviado: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          os_id: string;
          cotacao_id: string;
          status?: Database["public"]["Enums"]["conferencia_status"];
          resultado?: Database["public"]["Enums"]["conferencia_resultado"] | null;
          observacoes?: string | null;
          iniciado_by?: string | null;
          iniciado_em?: string | null;
          concluido_by?: string | null;
          concluido_em?: string | null;
          email_enviado?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          os_id?: string;
          cotacao_id?: string;
          status?: Database["public"]["Enums"]["conferencia_status"];
          resultado?: Database["public"]["Enums"]["conferencia_resultado"] | null;
          observacoes?: string | null;
          iniciado_by?: string | null;
          iniciado_em?: string | null;
          concluido_by?: string | null;
          concluido_em?: string | null;
          email_enviado?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "material_conferencias_os_id_fkey";
            columns: ["os_id"];
            isOneToOne: false;
            referencedRelation: "ordens_servico";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "material_conferencias_cotacao_id_fkey";
            columns: ["cotacao_id"];
            isOneToOne: true;
            referencedRelation: "material_cotacoes";
            referencedColumns: ["id"];
          }
        ];
      };
      material_conferencia_itens: {
        Row: {
          id: string;
          conferencia_id: string;
          cotacao_item_id: string | null;
          descricao: string;
          quantidade_esperada: number;
          unidade: string | null;
          veio_certo: boolean | null;
          quantidade_recebida: number | null;
          observacao: string | null;
        };
        Insert: {
          id?: string;
          conferencia_id: string;
          cotacao_item_id?: string | null;
          descricao: string;
          quantidade_esperada: number;
          unidade?: string | null;
          veio_certo?: boolean | null;
          quantidade_recebida?: number | null;
          observacao?: string | null;
        };
        Update: {
          id?: string;
          conferencia_id?: string;
          cotacao_item_id?: string | null;
          descricao?: string;
          quantidade_esperada?: number;
          unidade?: string | null;
          veio_certo?: boolean | null;
          quantidade_recebida?: number | null;
          observacao?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "material_conferencia_itens_conferencia_id_fkey";
            columns: ["conferencia_id"];
            isOneToOne: false;
            referencedRelation: "material_conferencias";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "material_conferencia_itens_cotacao_item_id_fkey";
            columns: ["cotacao_item_id"];
            isOneToOne: false;
            referencedRelation: "material_cotacao_itens";
            referencedColumns: ["id"];
          }
        ];
      };
      reunioes: {
        Row: {
          id: string;
          tipo: Database["public"]["Enums"]["reuniao_tipo"];
          os_id: string | null;
          titulo: string;
          data_reuniao: string;
          pauta: string | null;
          dados_snapshot: Json;
          participantes: Json;
          status: Database["public"]["Enums"]["reuniao_status"];
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tipo: Database["public"]["Enums"]["reuniao_tipo"];
          os_id?: string | null;
          titulo: string;
          data_reuniao?: string;
          pauta?: string | null;
          dados_snapshot?: Json;
          participantes?: Json;
          status?: Database["public"]["Enums"]["reuniao_status"];
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tipo?: Database["public"]["Enums"]["reuniao_tipo"];
          os_id?: string | null;
          titulo?: string;
          data_reuniao?: string;
          pauta?: string | null;
          dados_snapshot?: Json;
          participantes?: Json;
          status?: Database["public"]["Enums"]["reuniao_status"];
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reunioes_os_id_fkey";
            columns: ["os_id"];
            isOneToOne: false;
            referencedRelation: "ordens_servico";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      has_role: {
        Args: { _user_id: string; _role: Database["public"]["Enums"]["app_role"] };
        Returns: boolean;
      };
      has_any_role: {
        Args: { _user_id: string; _roles: Database["public"]["Enums"]["app_role"][] };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "pcp" | "producao" | "viewer" | "almoxarifado";
      os_status:
        | "aberta"
        | "aguardando_material"
        | "em_producao"
        | "em_pintura"
        | "pronta"
        | "entregue"
        | "faturado"
        | "faturado_parcialmente"
        | "atrasada"
        | "cancelada";
      etapa_tipo:
        | "abertura"
        | "solicitacao_material"
        | "chegada_material"
        | "pintura"
        | "entrega";
      etapa_status: "pendente" | "concluido";
      material_categoria: "longos" | "planos" | "fixadores" | "acessorios" | "consumo";
      conferencia_status: "nao_iniciada" | "em_andamento" | "concluida";
      conferencia_resultado: "ok" | "divergente";
      reuniao_tipo: "individual" | "geral";
      reuniao_status: "rascunho" | "finalizada";
    };
    CompositeTypes: Record<string, never>;
  };
};

// Helpers padrão gerados pelo Supabase CLI, usados no projeto (ex: os-utils.ts, ordens.nova.tsx)
export type Tables<
  T extends keyof Database["public"]["Tables"]
> = Database["public"]["Tables"][T]["Row"];

export type TablesInsert<
  T extends keyof Database["public"]["Tables"]
> = Database["public"]["Tables"][T]["Insert"];

export type TablesUpdate<
  T extends keyof Database["public"]["Tables"]
> = Database["public"]["Tables"][T]["Update"];

export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];
