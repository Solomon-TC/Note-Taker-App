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
      achievements: {
        Row: {
          created_at: string | null
          description: string
          icon: string
          id: string
          name: string
          xp_reward: number | null
        }
        Insert: {
          created_at?: string | null
          description: string
          icon: string
          id?: string
          name: string
          xp_reward?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string
          icon?: string
          id?: string
          name?: string
          xp_reward?: number | null
        }
        Relationships: []
      }
      ai_sessions: {
        Row: {
          context: Json | null
          created_at: string | null
          id: string
          messages: Json | null
          metadata: Json | null
          session_type: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          context?: Json | null
          created_at?: string | null
          id?: string
          messages?: Json | null
          metadata?: Json | null
          session_type: string
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          context?: Json | null
          created_at?: string | null
          id?: string
          messages?: Json | null
          metadata?: Json | null
          session_type?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_summaries: {
        Row: {
          content: string
          created_at: string | null
          id: string
          note_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          note_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          note_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_summaries_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_summaries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          note_count: number | null
          progress: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          note_count?: number | null
          progress?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          note_count?: number | null
          progress?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          content: string
          created_at: string
          id: string
          user_id: string | null
          vote_count: number
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          user_id?: string | null
          vote_count?: number
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          user_id?: string | null
          vote_count?: number
        }
        Relationships: []
      }
      feedback_votes: {
        Row: {
          created_at: string
          feedback_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          feedback_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          feedback_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_votes_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "feedback"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_requests: {
        Row: {
          created_at: string | null
          id: string
          receiver_id: string
          sender_id: string
          status: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          receiver_id: string
          sender_id: string
          status?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          receiver_id?: string
          sender_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "friend_requests_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_requests_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      friends: {
        Row: {
          created_at: string | null
          friend_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          friend_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          friend_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "friends_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friends_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notebooks: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          sort_order: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          sort_order?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          sort_order?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          class_id: string | null
          content: string
          created_at: string | null
          id: string
          tags: string[] | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          class_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          tags?: string[] | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          class_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          content: string | null
          content_json: Json | null
          created_at: string | null
          id: string
          parent_page_id: string | null
          section_id: string
          sort_order: number | null
          title: string
          updated_at: string | null
          user_id: string
          visibility: string
        }
        Insert: {
          content?: string | null
          content_json?: Json | null
          created_at?: string | null
          id?: string
          parent_page_id?: string | null
          section_id: string
          sort_order?: number | null
          title?: string
          updated_at?: string | null
          user_id: string
          visibility?: string
        }
        Update: {
          content?: string | null
          content_json?: Json | null
          created_at?: string | null
          id?: string
          parent_page_id?: string | null
          section_id?: string
          sort_order?: number | null
          title?: string
          updated_at?: string | null
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "pages_parent_page_id_fkey"
            columns: ["parent_page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pages_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_problems: {
        Row: {
          completed: boolean | null
          correct_answer: number
          created_at: string | null
          id: string
          note_id: string
          options: string[]
          question: string
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          correct_answer: number
          created_at?: string | null
          id?: string
          note_id: string
          options: string[]
          question: string
          user_id: string
        }
        Update: {
          completed?: boolean | null
          correct_answer?: number
          created_at?: string | null
          id?: string
          note_id?: string
          options?: string[]
          question?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_problems_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_problems_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sections: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
          notebook_id: string
          sort_order: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          notebook_id: string
          sort_order?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          notebook_id?: string
          sort_order?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sections_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achievement_id: string
          id: string
          unlocked_at: string | null
          user_id: string
        }
        Insert: {
          achievement_id: string
          id?: string
          unlocked_at?: string | null
          user_id: string
        }
        Update: {
          achievement_id?: string
          id?: string
          unlocked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_progress: {
        Row: {
          created_at: string | null
          current_xp: number | null
          id: string
          last_activity_date: string | null
          level: number | null
          max_xp: number | null
          streak_days: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_xp?: number | null
          id?: string
          last_activity_date?: string | null
          level?: number | null
          max_xp?: number | null
          streak_days?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_xp?: number | null
          id?: string
          last_activity_date?: string | null
          level?: number | null
          max_xp?: number | null
          streak_days?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          current_period_end: string | null
          email: string
          full_name: string | null
          id: string
          is_pro: boolean
          plan: string | null
          stripe_customer_id: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          current_period_end?: string | null
          email: string
          full_name?: string | null
          id: string
          is_pro?: boolean
          plan?: string | null
          stripe_customer_id?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          current_period_end?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_pro?: boolean
          plan?: string | null
          stripe_customer_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _update_feedback_vote_count: {
        Args: { feedback_id_param: string }
        Returns: undefined
      }
      accept_friend_request_transaction: {
        Args: { p_friend_id: string; p_request_id: string; p_user_id: string }
        Returns: undefined
      }
      can_user_access_page: {
        Args: { p_page_id: string; p_user_id: string }
        Returns: Json
      }
      check_friendship_status: {
        Args: { p_user1_id: string; p_user2_id: string }
        Returns: Json
      }
      debug_friends_page_access: {
        Args: { p_current_user_id: string; p_friend_user_id: string }
        Returns: Json
      }
      debug_friendship_access: {
        Args: { p_current_user_id: string; p_page_owner_id: string }
        Returns: Json
      }
      debug_user_friendships: {
        Args: { p_user_id: string }
        Returns: Json
      }
      get_friend_shared_pages: {
        Args: { friend_user_id: string }
        Returns: {
          content: string
          content_json: Json
          created_at: string
          id: string
          section_id: string
          title: string
          updated_at: string
        }[]
      }
      get_friend_shared_pages_for_user: {
        Args: { p_user_id: string }
        Returns: Json
      }
      get_friendship_and_pages_debug: {
        Args: { p_current_user_id: string; p_friend_id: string }
        Returns: Json
      }
      get_user_accessible_pages: {
        Args: { p_user_id: string }
        Returns: Json
      }
      get_user_friends: {
        Args: { user_uuid: string }
        Returns: {
          friend_email: string
          friend_id: string
          friend_name: string
          friendship_created_at: string
        }[]
      }
      recalculate_all_feedback_vote_counts: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      search_user_by_email_exact: {
        Args: { p_email: string }
        Returns: {
          email: string
          id: string
        }[]
      }
      simulate_friends_page_query: {
        Args: { p_current_user_id: string; p_friend_user_id: string }
        Returns: {
          access_granted: boolean
          access_reason: string
          page_created_at: string
          page_id: string
          page_title: string
          page_visibility: string
        }[]
      }
      test_friends_rls_logic: {
        Args: {
          p_current_user_id: string
          p_page_owner_id: string
          p_page_visibility: string
        }
        Returns: Json
      }
      test_page_access: {
        Args: { p_page_id: string; p_user_id: string }
        Returns: Json
      }
      test_page_select_with_rls: {
        Args: { p_user_id: string }
        Returns: Json
      }
      test_page_visibility_access: {
        Args: { p_page_id: string; p_test_user_id: string }
        Returns: Json
      }
      test_user_page_access: {
        Args: { p_user_id: string }
        Returns: {
          access_type: string
          can_access: boolean
          page_id: string
          page_owner_id: string
          page_title: string
          page_visibility: string
        }[]
      }
      verify_shared_pages_schema: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
