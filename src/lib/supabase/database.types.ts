// Hand-written Database type for Supabase typing.
// Covers lungnote_* tables. Regenerate with `supabase gen types typescript --linked` once stable.

export type Database = {
  public: {
    Tables: {
      lungnote_profiles: {
        Row: {
          id: string;
          line_user_id: string;
          line_display_name: string | null;
          line_picture_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          line_user_id: string;
          line_display_name?: string | null;
          line_picture_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          line_user_id?: string;
          line_display_name?: string | null;
          line_picture_url?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      lungnote_auth_link_tokens: {
        Row: {
          id: string;
          line_user_id: string;
          token_hash: string;
          expires_at: string;
          used_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          line_user_id: string;
          token_hash: string;
          expires_at: string;
          used_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          line_user_id?: string;
          token_hash?: string;
          expires_at?: string;
          used_at?: string | null;
        };
        Relationships: [];
      };
      lungnote_folders: {
        Row: {
          id: string;
          user_id: string;
          parent_folder_id: string | null;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          parent_folder_id?: string | null;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          parent_folder_id?: string | null;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      lungnote_notebooks: {
        Row: {
          id: string;
          user_id: string;
          folder_id: string | null;
          name: string;
          cover_color: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          folder_id?: string | null;
          name: string;
          cover_color?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          folder_id?: string | null;
          name?: string;
          cover_color?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      lungnote_notes: {
        Row: {
          id: string;
          user_id: string;
          notebook_id: string | null;
          title: string;
          body: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          notebook_id?: string | null;
          title: string;
          body?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          notebook_id?: string | null;
          title?: string;
          body?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      lungnote_todos: {
        Row: {
          id: string;
          user_id: string;
          note_id: string;
          text: string;
          done: boolean;
          position: number;
          due_at: string | null;
          due_text: string | null;
          source: "chat" | "web" | "liff" | "email";
          source_external_id: string | null;
          source_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          note_id: string;
          text: string;
          done?: boolean;
          position?: number;
          due_at?: string | null;
          due_text?: string | null;
          source?: "chat" | "web" | "liff" | "email";
          source_external_id?: string | null;
          source_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          note_id?: string;
          text?: string;
          done?: boolean;
          position?: number;
          due_at?: string | null;
          due_text?: string | null;
          source?: "chat" | "web" | "liff" | "email";
          source_external_id?: string | null;
          source_url?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      lungnote_tags: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          color?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          color?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      lungnote_notes_tags: {
        Row: {
          note_id: string;
          tag_id: string;
          created_at: string;
        };
        Insert: {
          note_id: string;
          tag_id: string;
          created_at?: string;
        };
        Update: {
          note_id?: string;
          tag_id?: string;
        };
        Relationships: [];
      };
      lungnote_user_memory: {
        Row: {
          line_user_id: string;
          memory: unknown;
          updated_at: string;
        };
        Insert: {
          line_user_id: string;
          memory?: unknown;
          updated_at?: string;
        };
        Update: {
          line_user_id?: string;
          memory?: unknown;
          updated_at?: string;
        };
        Relationships: [];
      };
      lungnote_agent_settings: {
        Row: {
          id: string;
          system_prompt_override: string | null;
          notes: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          system_prompt_override?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          system_prompt_override?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      lungnote_chat_traces: {
        Row: {
          id: string;
          trace_id: string;
          line_user_id: string | null;
          user_text: string;
          path: "dashboard" | "list" | "memory" | "regex" | "ai" | "error";
          history_count: number;
          ai_iterations: number;
          tool_calls: unknown;
          reply_text: string | null;
          meta: unknown;
          error_text: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          trace_id: string;
          line_user_id?: string | null;
          user_text: string;
          path: "dashboard" | "list" | "memory" | "regex" | "ai" | "error";
          history_count?: number;
          ai_iterations?: number;
          tool_calls?: unknown;
          reply_text?: string | null;
          meta?: unknown;
          error_text?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          trace_id?: string;
          line_user_id?: string | null;
          user_text?: string;
          path?: "dashboard" | "list" | "memory" | "regex" | "ai" | "error";
          history_count?: number;
          ai_iterations?: number;
          tool_calls?: unknown;
          reply_text?: string | null;
          meta?: unknown;
          error_text?: string | null;
        };
        Relationships: [];
      };
      lungnote_gmail_connections: {
        Row: {
          id: string;
          user_id: string;
          google_user_id: string;
          email: string;
          refresh_token_enc: string; // base64 ciphertext (text column)
          access_token_enc: string | null;
          access_token_expires_at: string | null;
          scope: string;
          status: "active" | "revoked" | "error" | "expired";
          last_error: string | null;
          last_history_id: string | null;
          last_synced_at: string | null;
          watch_expires_at: string | null;
          watch_resource_state: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          google_user_id: string;
          email: string;
          refresh_token_enc: string;
          access_token_enc?: string | null;
          access_token_expires_at?: string | null;
          scope: string;
          status?: "active" | "revoked" | "error" | "expired";
          last_error?: string | null;
          last_history_id?: string | null;
          last_synced_at?: string | null;
          watch_expires_at?: string | null;
          watch_resource_state?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          google_user_id?: string;
          email?: string;
          refresh_token_enc?: string;
          access_token_enc?: string | null;
          access_token_expires_at?: string | null;
          scope?: string;
          status?: "active" | "revoked" | "error" | "expired";
          last_error?: string | null;
          last_history_id?: string | null;
          last_synced_at?: string | null;
          watch_expires_at?: string | null;
          watch_resource_state?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      lungnote_gmail_synced_messages: {
        Row: {
          id: string;
          user_id: string;
          connection_id: string;
          message_id: string;
          thread_id: string | null;
          internal_date: string | null;
          from_truncated: string | null;
          subject_truncated: string | null;
          scanned_at: string;
          is_todo: boolean;
          todo_id: string | null;
          ai_reason: string | null;
          suggested_actions: unknown; // jsonb — ClassifiedAction[] in app code
        };
        Insert: {
          id?: string;
          user_id: string;
          connection_id: string;
          message_id: string;
          thread_id?: string | null;
          internal_date?: string | null;
          from_truncated?: string | null;
          subject_truncated?: string | null;
          scanned_at?: string;
          is_todo?: boolean;
          todo_id?: string | null;
          ai_reason?: string | null;
          suggested_actions?: unknown;
        };
        Update: {
          id?: string;
          user_id?: string;
          connection_id?: string;
          message_id?: string;
          thread_id?: string | null;
          internal_date?: string | null;
          from_truncated?: string | null;
          subject_truncated?: string | null;
          scanned_at?: string;
          is_todo?: boolean;
          todo_id?: string | null;
          ai_reason?: string | null;
          suggested_actions?: unknown;
        };
        Relationships: [];
      };
      lungnote_quick_actions: {
        Row: {
          id: string;
          user_id: string;
          label: string;
          body: string;
          intent: "approve" | "reject" | "ask" | "ack" | "other";
          scope: "global" | "category";
          match_category: string | null;
          need_reason: boolean;
          emoji: string | null;
          position: number;
          enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          label: string;
          body: string;
          intent?: "approve" | "reject" | "ask" | "ack" | "other";
          scope?: "global" | "category";
          match_category?: string | null;
          need_reason?: boolean;
          emoji?: string | null;
          position?: number;
          enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          label?: string;
          body?: string;
          intent?: "approve" | "reject" | "ask" | "ack" | "other";
          scope?: "global" | "category";
          match_category?: string | null;
          need_reason?: boolean;
          emoji?: string | null;
          position?: number;
          enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      lungnote_conversation_memory: {
        Row: {
          line_user_id: string;
          messages: unknown; // jsonb — typed as ChatMessage[] in app code
          updated_at: string;
        };
        Insert: {
          line_user_id: string;
          messages?: unknown;
          updated_at?: string;
        };
        Update: {
          line_user_id?: string;
          messages?: unknown;
          updated_at?: string;
        };
        Relationships: [];
      };
      lungnote_bulk_ops: {
        Row: {
          id: string;
          user_id: string;
          op_kind: "complete" | "delete" | "uncomplete";
          todo_ids: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          op_kind: "complete" | "delete" | "uncomplete";
          todo_ids: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          op_kind?: "complete" | "delete" | "uncomplete";
          todo_ids?: string[];
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
