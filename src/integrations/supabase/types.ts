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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      agent_profiles: {
        Row: {
          agency_address: string | null
          agency_name: string | null
          agency_phone: string | null
          agree_marketing: boolean
          allowed_pc_ip: string | null
          business_number: string | null
          created_at: string
          id: string
          is_active: boolean
          license_number: string | null
          member_type: string
          name: string
          parent_user_id: string | null
          phone: string
          phone_verified: boolean
          phone_verified_at: string | null
          representative_name: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agency_address?: string | null
          agency_name?: string | null
          agency_phone?: string | null
          agree_marketing?: boolean
          allowed_pc_ip?: string | null
          business_number?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          license_number?: string | null
          member_type?: string
          name: string
          parent_user_id?: string | null
          phone: string
          phone_verified?: boolean
          phone_verified_at?: string | null
          representative_name?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agency_address?: string | null
          agency_name?: string | null
          agency_phone?: string | null
          agree_marketing?: boolean
          allowed_pc_ip?: string | null
          business_number?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          license_number?: string | null
          member_type?: string
          name?: string
          parent_user_id?: string | null
          phone?: string
          phone_verified?: boolean
          phone_verified_at?: string | null
          representative_name?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      building_summary: {
        Row: {
          approval_date: string | null
          building_area: string | null
          building_name: string | null
          created_at: string
          elevator: boolean | null
          floors_above: string | null
          floors_below: string | null
          id: string
          land_area: string | null
          main_purpose: string | null
          parking_count: string | null
          property_id: string
          total_area: string | null
          updated_at: string
        }
        Insert: {
          approval_date?: string | null
          building_area?: string | null
          building_name?: string | null
          created_at?: string
          elevator?: boolean | null
          floors_above?: string | null
          floors_below?: string | null
          id?: string
          land_area?: string | null
          main_purpose?: string | null
          parking_count?: string | null
          property_id: string
          total_area?: string | null
          updated_at?: string
        }
        Update: {
          approval_date?: string | null
          building_area?: string | null
          building_name?: string | null
          created_at?: string
          elevator?: boolean | null
          floors_above?: string | null
          floors_below?: string | null
          id?: string
          land_area?: string | null
          main_purpose?: string | null
          parking_count?: string | null
          property_id?: string
          total_area?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          agent_user_id: string | null
          created_at: string
          id: string
          last_message: string
          last_message_at: string
          property_id: string | null
          unread_for_admin: number
          unread_for_agent: number
          unread_for_user: number
          updated_at: string
          user_id: string
          user_name: string
        }
        Insert: {
          agent_user_id?: string | null
          created_at?: string
          id?: string
          last_message?: string
          last_message_at?: string
          property_id?: string | null
          unread_for_admin?: number
          unread_for_agent?: number
          unread_for_user?: number
          updated_at?: string
          user_id: string
          user_name?: string
        }
        Update: {
          agent_user_id?: string | null
          created_at?: string
          id?: string
          last_message?: string
          last_message_at?: string
          property_id?: string | null
          unread_for_admin?: number
          unread_for_agent?: number
          unread_for_user?: number
          updated_at?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          sender_id: string
          sender_role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_id: string
          sender_role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      cheongju_contacts: {
        Row: {
          building_dong: string | null
          building_name: string | null
          contact_broker: string | null
          contact_manager: string | null
          contact_owner: string | null
          created_at: string
          district: string
          dong: string
          id: string
          is_visible: boolean
          lot_number: string
          memo: string | null
          phone: string
          unit_number: string | null
          updated_at: string
        }
        Insert: {
          building_dong?: string | null
          building_name?: string | null
          contact_broker?: string | null
          contact_manager?: string | null
          contact_owner?: string | null
          created_at?: string
          district: string
          dong: string
          id?: string
          is_visible?: boolean
          lot_number?: string
          memo?: string | null
          phone?: string
          unit_number?: string | null
          updated_at?: string
        }
        Update: {
          building_dong?: string | null
          building_name?: string | null
          contact_broker?: string | null
          contact_manager?: string | null
          contact_owner?: string | null
          created_at?: string
          district?: string
          dong?: string
          id?: string
          is_visible?: boolean
          lot_number?: string
          memo?: string | null
          phone?: string
          unit_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      community_posts: {
        Row: {
          author_agency: string
          author_name: string
          author_user_id: string | null
          category: string
          category_label: string
          content: string
          created_at: string
          id: string
          is_admin_post: boolean
          likes: number
          pinned: boolean
          title: string
          updated_at: string
          views: number
        }
        Insert: {
          author_agency?: string
          author_name?: string
          author_user_id?: string | null
          category: string
          category_label: string
          content: string
          created_at?: string
          id?: string
          is_admin_post?: boolean
          likes?: number
          pinned?: boolean
          title: string
          updated_at?: string
          views?: number
        }
        Update: {
          author_agency?: string
          author_name?: string
          author_user_id?: string | null
          category?: string
          category_label?: string
          content?: string
          created_at?: string
          id?: string
          is_admin_post?: boolean
          likes?: number
          pinned?: boolean
          title?: string
          updated_at?: string
          views?: number
        }
        Relationships: []
      }
      guest_inquiries: {
        Row: {
          agent_user_id: string | null
          created_at: string
          id: string
          is_read: boolean
          message: string
          name: string
          phone: string
          property_id: string | null
          property_reg_no: string | null
          user_id: string | null
        }
        Insert: {
          agent_user_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          name: string
          phone: string
          property_id?: string | null
          property_reg_no?: string | null
          user_id?: string | null
        }
        Update: {
          agent_user_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          name?: string
          phone?: string
          property_id?: string | null
          property_reg_no?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guest_inquiries_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiry_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          inquiry_id: string
          sender_role: string
          sender_user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          inquiry_id: string
          sender_role: string
          sender_user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          inquiry_id?: string
          sender_role?: string
          sender_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inquiry_messages_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "guest_inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      land_summary: {
        Row: {
          created_at: string
          id: string
          land_area: string | null
          land_category: string | null
          lot_number: string | null
          official_price: string | null
          property_id: string
          road_access: string | null
          updated_at: string
          use_zone: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          land_area?: string | null
          land_category?: string | null
          lot_number?: string | null
          official_price?: string | null
          property_id: string
          road_access?: string | null
          updated_at?: string
          use_zone?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          land_area?: string | null
          land_category?: string | null
          lot_number?: string | null
          official_price?: string | null
          property_id?: string
          road_access?: string | null
          updated_at?: string
          use_zone?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          property_id: number | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          property_id?: number | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          property_id?: number | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      page_views: {
        Row: {
          created_at: string
          id: string
          path: string
          session_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          path?: string
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          path?: string
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      phone_otp_codes: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          phone: string
          purpose: string
          verified: boolean
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          phone: string
          purpose?: string
          verified?: boolean
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          purpose?: string
          verified?: boolean
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string
          agent_name: string
          area: string
          available_from: string
          build_year: string
          building_memo: string | null
          building_name: string | null
          building_password: string | null
          checked_date: string | null
          created_at: string
          deposit: string
          description: string
          district: string | null
          dong: string
          elevator: boolean
          floor: string
          id: string
          images: string[]
          is_hot: boolean
          is_new: boolean
          landlord_phone: string | null
          lat: number
          lng: number
          lot_number: string
          manage_fee: string
          monthly: string
          note: string | null
          options: string[]
          parking: string
          reg_no: string | null
          registered_by: string | null
          registered_date: string
          room_memo: string | null
          room_password: string | null
          room_type: string | null
          status: string
          title: string
          total_floors: string
          type: string
          unit_number: string | null
          updated_at: string
          vacate_date: string | null
          views: number
        }
        Insert: {
          address: string
          agent_name?: string
          area?: string
          available_from?: string
          build_year?: string
          building_memo?: string | null
          building_name?: string | null
          building_password?: string | null
          checked_date?: string | null
          created_at?: string
          deposit?: string
          description?: string
          district?: string | null
          dong?: string
          elevator?: boolean
          floor?: string
          id?: string
          images?: string[]
          is_hot?: boolean
          is_new?: boolean
          landlord_phone?: string | null
          lat?: number
          lng?: number
          lot_number?: string
          manage_fee?: string
          monthly?: string
          note?: string | null
          options?: string[]
          parking?: string
          reg_no?: string | null
          registered_by?: string | null
          registered_date?: string
          room_memo?: string | null
          room_password?: string | null
          room_type?: string | null
          status?: string
          title: string
          total_floors?: string
          type: string
          unit_number?: string | null
          updated_at?: string
          vacate_date?: string | null
          views?: number
        }
        Update: {
          address?: string
          agent_name?: string
          area?: string
          available_from?: string
          build_year?: string
          building_memo?: string | null
          building_name?: string | null
          building_password?: string | null
          checked_date?: string | null
          created_at?: string
          deposit?: string
          description?: string
          district?: string | null
          dong?: string
          elevator?: boolean
          floor?: string
          id?: string
          images?: string[]
          is_hot?: boolean
          is_new?: boolean
          landlord_phone?: string | null
          lat?: number
          lng?: number
          lot_number?: string
          manage_fee?: string
          monthly?: string
          note?: string | null
          options?: string[]
          parking?: string
          reg_no?: string | null
          registered_by?: string | null
          registered_date?: string
          room_memo?: string | null
          room_password?: string | null
          room_type?: string | null
          status?: string
          title?: string
          total_floors?: string
          type?: string
          unit_number?: string | null
          updated_at?: string
          vacate_date?: string | null
          views?: number
        }
        Relationships: []
      }
      property_reports: {
        Row: {
          admin_memo: string | null
          created_at: string
          deal_date: string | null
          deal_memo: string | null
          error_content: string | null
          id: string
          property_address: string
          property_id: string
          property_title: string
          proposal_content: string | null
          proposal_deposit: string | null
          proposal_monthly: string | null
          proposal_period: string | null
          proposer_company: string | null
          proposer_name: string | null
          proposer_phone: string | null
          report_type: string
          status: string
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          admin_memo?: string | null
          created_at?: string
          deal_date?: string | null
          deal_memo?: string | null
          error_content?: string | null
          id?: string
          property_address: string
          property_id: string
          property_title: string
          proposal_content?: string | null
          proposal_deposit?: string | null
          proposal_monthly?: string | null
          proposal_period?: string | null
          proposer_company?: string | null
          proposer_name?: string | null
          proposer_phone?: string | null
          report_type: string
          status?: string
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          admin_memo?: string | null
          created_at?: string
          deal_date?: string | null
          deal_memo?: string | null
          error_content?: string | null
          id?: string
          property_address?: string
          property_id?: string
          property_title?: string
          proposal_content?: string | null
          proposal_deposit?: string | null
          proposal_monthly?: string | null
          proposal_period?: string | null
          proposer_company?: string | null
          proposer_name?: string | null
          proposer_phone?: string | null
          report_type?: string
          status?: string
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      property_user_memos: {
        Row: {
          content: string
          created_at: string
          id: string
          memo_type: string
          property_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          memo_type: string
          property_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          memo_type?: string
          property_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      public_record_summary: {
        Row: {
          building_approval_date: string | null
          building_floors: string | null
          building_main_purpose: string | null
          building_register_url: string | null
          building_total_area: string | null
          created_at: string
          id: string
          land_address: string | null
          land_area: string | null
          land_category: string | null
          land_register_url: string | null
          land_use_zone: string | null
          memo: string | null
          property_id: string
          updated_at: string
        }
        Insert: {
          building_approval_date?: string | null
          building_floors?: string | null
          building_main_purpose?: string | null
          building_register_url?: string | null
          building_total_area?: string | null
          created_at?: string
          id?: string
          land_address?: string | null
          land_area?: string | null
          land_category?: string | null
          land_register_url?: string | null
          land_use_zone?: string | null
          memo?: string | null
          property_id: string
          updated_at?: string
        }
        Update: {
          building_approval_date?: string | null
          building_floors?: string | null
          building_main_purpose?: string | null
          building_register_url?: string | null
          building_total_area?: string | null
          created_at?: string
          id?: string
          land_address?: string | null
          land_area?: string | null
          land_category?: string | null
          land_register_url?: string | null
          land_use_zone?: string | null
          memo?: string | null
          property_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_active_sessions: {
        Row: {
          created_at: string
          device_id: string
          device_type: string
          id: string
          ip_address: string | null
          last_seen_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          device_type: string
          id?: string
          ip_address?: string | null
          last_seen_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string
          device_type?: string
          id?: string
          ip_address?: string | null
          last_seen_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      claim_device_slot:
        | {
            Args: {
              _device_id: string
              _device_type: string
              _user_agent?: string
            }
            Returns: string
          }
        | {
            Args: {
              _device_id: string
              _device_type: string
              _ip_address?: string
              _user_agent?: string
            }
            Returns: string
          }
      create_agent_profile_after_signup: {
        Args: {
          _agency_address?: string
          _agency_name?: string
          _agency_phone?: string
          _agree_marketing?: boolean
          _business_number?: string
          _email: string
          _license_number?: string
          _member_type?: string
          _name: string
          _phone: string
          _representative_name?: string
          _user_id: string
        }
        Returns: undefined
      }
      get_inquiry_messages: {
        Args: { _inquiry_id: string }
        Returns: {
          content: string
          created_at: string
          id: string
          sender_role: string
        }[]
      }
      get_property_passwords: {
        Args: { _property_id: string }
        Returns: {
          building_password: string
          room_password: string
        }[]
      }
      get_public_property_reference_images: {
        Args: { _property_id: string }
        Returns: {
          floor: string
          id: string
          images: string[]
          room_type: string
          status: string
          unit_number: string
          updated_at: string
        }[]
      }
      get_reference_images: {
        Args: { _addresses: string[] }
        Returns: {
          address: string
          floor: string
          images: string[]
          room_type: string
          unit_number: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_phone_registered: { Args: { _phone: string }; Returns: boolean }
      start_chat_from_inquiry: {
        Args: { _inquiry_id: string }
        Returns: string
      }
      update_property_images: {
        Args: { _images: string[]; _property_id: string }
        Returns: boolean
      }
      verify_device_slot: {
        Args: { _device_id: string; _device_type: string }
        Returns: boolean
      }
      verify_pc_ip: { Args: { _ip_address: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
