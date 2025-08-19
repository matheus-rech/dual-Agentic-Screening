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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      academic_papers: {
        Row: {
          abstract: string
          authors: string[]
          citation_count: number | null
          created_at: string | null
          doi: string | null
          embedding: string | null
          id: number
          journal: string
          keywords: string[] | null
          publication_date: string
          title: string
          updated_at: string | null
        }
        Insert: {
          abstract: string
          authors: string[]
          citation_count?: number | null
          created_at?: string | null
          doi?: string | null
          embedding?: string | null
          id?: never
          journal: string
          keywords?: string[] | null
          publication_date: string
          title: string
          updated_at?: string | null
        }
        Update: {
          abstract?: string
          authors?: string[]
          citation_count?: number | null
          created_at?: string | null
          doi?: string | null
          embedding?: string | null
          id?: never
          journal?: string
          keywords?: string[] | null
          publication_date?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_screening_config: {
        Row: {
          additional_instructions: Json | null
          agreement_threshold: number | null
          confidence_threshold: number | null
          conflict_resolution_method: string | null
          created_at: string | null
          id: string
          model_type: Database["public"]["Enums"]["ai_model_type"]
          primary_model_name: string | null
          project_id: string | null
          screening_stage: Database["public"]["Enums"]["screening_stage"]
          secondary_model_name: string | null
          system_prompt: string | null
          updated_at: string | null
          user_prompt_template: string | null
        }
        Insert: {
          additional_instructions?: Json | null
          agreement_threshold?: number | null
          confidence_threshold?: number | null
          conflict_resolution_method?: string | null
          created_at?: string | null
          id?: string
          model_type: Database["public"]["Enums"]["ai_model_type"]
          primary_model_name?: string | null
          project_id?: string | null
          screening_stage: Database["public"]["Enums"]["screening_stage"]
          secondary_model_name?: string | null
          system_prompt?: string | null
          updated_at?: string | null
          user_prompt_template?: string | null
        }
        Update: {
          additional_instructions?: Json | null
          agreement_threshold?: number | null
          confidence_threshold?: number | null
          conflict_resolution_method?: string | null
          created_at?: string | null
          id?: string
          model_type?: Database["public"]["Enums"]["ai_model_type"]
          primary_model_name?: string | null
          project_id?: string | null
          screening_stage?: Database["public"]["Enums"]["screening_stage"]
          secondary_model_name?: string | null
          system_prompt?: string | null
          updated_at?: string | null
          user_prompt_template?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_screening_config_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "review_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_screening_log: {
        Row: {
          created_at: string | null
          decision_reason: Json | null
          final_decision: string | null
          id: string
          model_agreement_score: number | null
          primary_model_confidence: number | null
          primary_model_decision: string | null
          processing_duration_ms: number | null
          project_id: string | null
          reference_id: string | null
          screening_end_time: string | null
          screening_stage: Database["public"]["Enums"]["screening_stage"]
          screening_start_time: string | null
          secondary_model_confidence: number | null
          secondary_model_decision: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          decision_reason?: Json | null
          final_decision?: string | null
          id?: string
          model_agreement_score?: number | null
          primary_model_confidence?: number | null
          primary_model_decision?: string | null
          processing_duration_ms?: number | null
          project_id?: string | null
          reference_id?: string | null
          screening_end_time?: string | null
          screening_stage: Database["public"]["Enums"]["screening_stage"]
          screening_start_time?: string | null
          secondary_model_confidence?: number | null
          secondary_model_decision?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          decision_reason?: Json | null
          final_decision?: string | null
          id?: string
          model_agreement_score?: number | null
          primary_model_confidence?: number | null
          primary_model_decision?: string | null
          processing_duration_ms?: number | null
          project_id?: string | null
          reference_id?: string | null
          screening_end_time?: string | null
          screening_stage?: Database["public"]["Enums"]["screening_stage"]
          screening_start_time?: string | null
          secondary_model_confidence?: number | null
          secondary_model_decision?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_screening_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "review_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_screening_log_reference_id_fkey"
            columns: ["reference_id"]
            isOneToOne: false
            referencedRelation: "references"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          changed_at: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          operation: string
          table_name: string
          user_id: string | null
        }
        Insert: {
          changed_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          operation: string
          table_name: string
          user_id?: string | null
        }
        Update: {
          changed_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          operation?: string
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      paper_references: {
        Row: {
          created_at: string | null
          id: number
          paper_id: number
          reference_authors: string[]
          reference_doi: string | null
          reference_journal: string | null
          reference_title: string
          reference_year: number
        }
        Insert: {
          created_at?: string | null
          id?: never
          paper_id: number
          reference_authors: string[]
          reference_doi?: string | null
          reference_journal?: string | null
          reference_title: string
          reference_year: number
        }
        Update: {
          created_at?: string | null
          id?: never
          paper_id?: number
          reference_authors?: string[]
          reference_doi?: string | null
          reference_journal?: string | null
          reference_title?: string
          reference_year?: number
        }
        Relationships: [
          {
            foreignKeyName: "paper_references_paper_id_fkey"
            columns: ["paper_id"]
            isOneToOne: false
            referencedRelation: "academic_papers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      references: {
        Row: {
          abstract: string | null
          ai_analysis: Json | null
          ai_confidence: number | null
          ai_confidence_scores: Json | null
          ai_conflict_details: Json | null
          ai_conflict_flag: boolean | null
          ai_model_version: string | null
          ai_reasoning: string | null
          ai_recommendation: string | null
          ai_screening_details: Json | null
          authors: string | null
          created_at: string | null
          doi: string | null
          id: string
          journal: string | null
          metadata: Json | null
          pmid: string | null
          project_id: string | null
          reviewer1_confidence: number | null
          reviewer1_decision: string | null
          reviewer1_reasoning: string | null
          reviewer2_confidence: number | null
          reviewer2_decision: string | null
          reviewer2_reasoning: string | null
          status: string | null
          tags: string[] | null
          title: string | null
          updated_at: string | null
          url: string | null
          user_decision: string | null
          user_id: string | null
          user_notes: string | null
          year: number | null
        }
        Insert: {
          abstract?: string | null
          ai_analysis?: Json | null
          ai_confidence?: number | null
          ai_confidence_scores?: Json | null
          ai_conflict_details?: Json | null
          ai_conflict_flag?: boolean | null
          ai_model_version?: string | null
          ai_reasoning?: string | null
          ai_recommendation?: string | null
          ai_screening_details?: Json | null
          authors?: string | null
          created_at?: string | null
          doi?: string | null
          id?: string
          journal?: string | null
          metadata?: Json | null
          pmid?: string | null
          project_id?: string | null
          reviewer1_confidence?: number | null
          reviewer1_decision?: string | null
          reviewer1_reasoning?: string | null
          reviewer2_confidence?: number | null
          reviewer2_decision?: string | null
          reviewer2_reasoning?: string | null
          status?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string | null
          url?: string | null
          user_decision?: string | null
          user_id?: string | null
          user_notes?: string | null
          year?: number | null
        }
        Update: {
          abstract?: string | null
          ai_analysis?: Json | null
          ai_confidence?: number | null
          ai_confidence_scores?: Json | null
          ai_conflict_details?: Json | null
          ai_conflict_flag?: boolean | null
          ai_model_version?: string | null
          ai_reasoning?: string | null
          ai_recommendation?: string | null
          ai_screening_details?: Json | null
          authors?: string | null
          created_at?: string | null
          doi?: string | null
          id?: string
          journal?: string | null
          metadata?: Json | null
          pmid?: string | null
          project_id?: string | null
          reviewer1_confidence?: number | null
          reviewer1_decision?: string | null
          reviewer1_reasoning?: string | null
          reviewer2_confidence?: number | null
          reviewer2_decision?: string | null
          reviewer2_reasoning?: string | null
          status?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string | null
          url?: string | null
          user_decision?: string | null
          user_id?: string | null
          user_notes?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "references_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "review_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "references_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      review_projects: {
        Row: {
          additional_criteria: Json | null
          comparator: string | null
          created_at: string | null
          criteria: Json | null
          description: string | null
          id: string
          intervention: string | null
          name: string
          outcome: string | null
          population: string | null
          status: string | null
          study_designs: string[] | null
          timeframe_description: string | null
          timeframe_end: string | null
          timeframe_start: string | null
          total_references: number | null
          updated_at: string | null
          use_advanced_ai: boolean | null
          user_id: string | null
        }
        Insert: {
          additional_criteria?: Json | null
          comparator?: string | null
          created_at?: string | null
          criteria?: Json | null
          description?: string | null
          id?: string
          intervention?: string | null
          name: string
          outcome?: string | null
          population?: string | null
          status?: string | null
          study_designs?: string[] | null
          timeframe_description?: string | null
          timeframe_end?: string | null
          timeframe_start?: string | null
          total_references?: number | null
          updated_at?: string | null
          use_advanced_ai?: boolean | null
          user_id?: string | null
        }
        Update: {
          additional_criteria?: Json | null
          comparator?: string | null
          created_at?: string | null
          criteria?: Json | null
          description?: string | null
          id?: string
          intervention?: string | null
          name?: string
          outcome?: string | null
          population?: string | null
          status?: string | null
          study_designs?: string[] | null
          timeframe_description?: string | null
          timeframe_end?: string | null
          timeframe_start?: string | null
          total_references?: number | null
          updated_at?: string | null
          use_advanced_ai?: boolean | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      screening_criteria: {
        Row: {
          comparator: string | null
          created_at: string | null
          exclusion_criteria: Json | null
          id: string
          inclusion_criteria: Json | null
          intervention: string | null
          outcome: string | null
          population: string | null
          project_id: string | null
          study_designs: string[] | null
          timeframe_description: string | null
          timeframe_end: string | null
          timeframe_start: string | null
          updated_at: string | null
        }
        Insert: {
          comparator?: string | null
          created_at?: string | null
          exclusion_criteria?: Json | null
          id?: string
          inclusion_criteria?: Json | null
          intervention?: string | null
          outcome?: string | null
          population?: string | null
          project_id?: string | null
          study_designs?: string[] | null
          timeframe_description?: string | null
          timeframe_end?: string | null
          timeframe_start?: string | null
          updated_at?: string | null
        }
        Update: {
          comparator?: string | null
          created_at?: string | null
          exclusion_criteria?: Json | null
          id?: string
          inclusion_criteria?: Json | null
          intervention?: string | null
          outcome?: string | null
          population?: string | null
          project_id?: string | null
          study_designs?: string[] | null
          timeframe_description?: string | null
          timeframe_end?: string | null
          timeframe_start?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "screening_criteria_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "review_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      screening_runs: {
        Row: {
          agreement_rate: number | null
          completed_references: number | null
          configuration: Json | null
          created_at: string | null
          criteria_snapshot: Json
          end_time: string | null
          id: string
          project_id: string | null
          run_name: string
          start_time: string | null
          status: string | null
          total_references: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          agreement_rate?: number | null
          completed_references?: number | null
          configuration?: Json | null
          created_at?: string | null
          criteria_snapshot: Json
          end_time?: string | null
          id?: string
          project_id?: string | null
          run_name: string
          start_time?: string | null
          status?: string | null
          total_references?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          agreement_rate?: number | null
          completed_references?: number | null
          configuration?: Json | null
          created_at?: string | null
          criteria_snapshot?: Json
          end_time?: string | null
          id?: string
          project_id?: string | null
          run_name?: string
          start_time?: string | null
          status?: string | null
          total_references?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "screening_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "review_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_decisions: {
        Row: {
          confidence_level: number | null
          created_at: string | null
          decision_reason: string | null
          id: string
          notes: string | null
          original_ai_decision: string | null
          project_id: string | null
          reference_id: string | null
          updated_at: string | null
          user_decision: string
          user_id: string | null
        }
        Insert: {
          confidence_level?: number | null
          created_at?: string | null
          decision_reason?: string | null
          id?: string
          notes?: string | null
          original_ai_decision?: string | null
          project_id?: string | null
          reference_id?: string | null
          updated_at?: string | null
          user_decision: string
          user_id?: string | null
        }
        Update: {
          confidence_level?: number | null
          created_at?: string | null
          decision_reason?: string | null
          id?: string
          notes?: string | null
          original_ai_decision?: string | null
          project_id?: string | null
          reference_id?: string | null
          updated_at?: string | null
          user_decision?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_decisions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "review_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_decisions_reference_id_fkey"
            columns: ["reference_id"]
            isOneToOne: false
            referencedRelation: "references"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      can_access_profile: {
        Args: { profile_user_id: string }
        Returns: boolean
      }
      create_embeddings_column_function: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      evaluate_ai_screening_agreement: {
        Args: {
          primary_confidence: number
          primary_decision: string
          secondary_confidence: number
          secondary_decision: string
        }
        Returns: {
          agreement_score: number
          conflict_flag: boolean
          final_decision: string
        }[]
      }
      get_current_user_profile: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_at: string
          email: string
          full_name: string
          id: string
          updated_at: string
        }[]
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      increment_project_references: {
        Args: { project_id: string }
        Returns: undefined
      }
      increment_project_references_by: {
        Args: { count: number; project_id: string }
        Returns: undefined
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: string
      }
      search_papers: {
        Args:
          | { match_count?: number; query_text: string }
          | { search_query: string }
        Returns: {
          abstract: string
          authors: string[]
          citation_count: number
          doi: string
          id: number
          journal: string
          keywords: string[]
          publication_date: string
          similarity: number
          title: string
        }[]
      }
      semantic_search: {
        Args:
          | {
              match_count?: number
              match_threshold?: number
              query_embedding: string
            }
          | { match_count?: number; query_text: string }
        Returns: {
          abstract: string
          authors: string[]
          id: number
          journal: string
          keywords: string[]
          publication_date: string
          similarity: number
          title: string
        }[]
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      ai_model_type:
        | "zero_shot_classification"
        | "few_shot_classification"
        | "semantic_similarity"
        | "named_entity_recognition"
        | "abstract_summarization"
        | "full_text_analysis"
      screening_stage:
        | "title_abstract_screening"
        | "full_text_screening"
        | "data_extraction"
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
      ai_model_type: [
        "zero_shot_classification",
        "few_shot_classification",
        "semantic_similarity",
        "named_entity_recognition",
        "abstract_summarization",
        "full_text_analysis",
      ],
      screening_stage: [
        "title_abstract_screening",
        "full_text_screening",
        "data_extraction",
      ],
    },
  },
} as const
