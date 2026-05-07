// Hand-written Database type for Supabase typing.
// Covers only the lungnote_* tables we touch from app code.
// Regenerate with `supabase gen types typescript --linked` once schema stabilises.

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
      lungnote_notes: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          body: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          body?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          body?: string;
          updated_at?: string;
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
