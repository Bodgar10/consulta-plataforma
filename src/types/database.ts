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
      appointments: {
        Row: {
          amount_paid_cents: number | null
          created_at: string
          created_by: string
          credit_id: string | null
          end_at: string
          hold_expires_at: string | null
          id: string
          patient_id: string
          payment_mode: string
          recurrence_group_id: string | null
          start_at: string
          status: string
          stripe_payment_intent: string | null
          tenant_id: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
          video_room_url: string | null
        }
        Insert: {
          amount_paid_cents?: number | null
          created_at?: string
          created_by?: string
          credit_id?: string | null
          end_at: string
          hold_expires_at?: string | null
          id?: string
          patient_id: string
          payment_mode?: string
          recurrence_group_id?: string | null
          start_at: string
          status?: string
          stripe_payment_intent?: string | null
          tenant_id: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          video_room_url?: string | null
        }
        Update: {
          amount_paid_cents?: number | null
          created_at?: string
          created_by?: string
          credit_id?: string | null
          end_at?: string
          hold_expires_at?: string | null
          id?: string
          patient_id?: string
          payment_mode?: string
          recurrence_group_id?: string | null
          start_at?: string
          status?: string
          stripe_payment_intent?: string | null
          tenant_id?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          video_room_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_credit_id_fkey"
            columns: ["credit_id"]
            isOneToOne: false
            referencedRelation: "patient_credits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_blocks: {
        Row: {
          created_at: string
          end_at: string
          id: string
          reason: string | null
          start_at: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          end_at: string
          id?: string
          reason?: string | null
          start_at: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          end_at?: string
          id?: string
          reason?: string | null
          start_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_blocks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_rules: {
        Row: {
          buffer_minutes: number
          created_at: string
          end_time: string
          id: string
          slot_minutes: number
          start_time: string
          tenant_id: string
          weekday: number
        }
        Insert: {
          buffer_minutes?: number
          created_at?: string
          end_time: string
          id?: string
          slot_minutes?: number
          start_time: string
          tenant_id: string
          weekday: number
        }
        Update: {
          buffer_minutes?: number
          created_at?: string
          end_time?: string
          id?: string
          slot_minutes?: number
          start_time?: string
          tenant_id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "availability_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          auth_user_id: string
          certificate_url: string | null
          course_id: string
          id: string
          issued_at: string
          tenant_id: string
        }
        Insert: {
          auth_user_id: string
          certificate_url?: string | null
          course_id: string
          id?: string
          issued_at?: string
          tenant_id: string
        }
        Update: {
          auth_user_id?: string
          certificate_url?: string | null
          course_id?: string
          id?: string
          issued_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      consents: {
        Row: {
          accepted_at: string
          appointment_id: string | null
          consent_kind: string
          created_at: string
          id: string
          ip: string | null
          lead_id: string | null
          patient_id: string | null
          privacy_version: string
          registration_id: string | null
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          accepted_at?: string
          appointment_id?: string | null
          consent_kind?: string
          created_at?: string
          id?: string
          ip?: string | null
          lead_id?: string | null
          patient_id?: string | null
          privacy_version: string
          registration_id?: string | null
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          accepted_at?: string
          appointment_id?: string | null
          consent_kind?: string
          created_at?: string
          id?: string
          ip?: string | null
          lead_id?: string | null
          patient_id?: string | null
          privacy_version?: string
          registration_id?: string | null
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consents_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consents_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consents_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "live_event_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          access_type: string
          cover_image_url: string | null
          created_at: string
          description: string | null
          id: string
          price_cents: number | null
          published: boolean
          slug: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          access_type?: string
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          price_cents?: number | null
          published?: boolean
          slug: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          access_type?: string
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          price_cents?: number | null
          published?: boolean
          slug?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sequences: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          tenant_id: string
          trigger: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          tenant_id: string
          trigger: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
          trigger?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_sequences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          auth_user_id: string
          course_id: string
          created_at: string
          email: string
          expires_at: string | null
          id: string
          source: string
          status: string
          tenant_id: string
        }
        Insert: {
          auth_user_id: string
          course_id: string
          created_at?: string
          email: string
          expires_at?: string | null
          id?: string
          source?: string
          status?: string
          tenant_id: string
        }
        Update: {
          auth_user_id?: string
          course_id?: string
          created_at?: string
          email?: string
          expires_at?: string | null
          id?: string
          source?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_pages: {
        Row: {
          body: Json
          created_at: string
          cta_type: string
          headline: string
          id: string
          intro_video_url: string | null
          lead_magnet_id: string | null
          published: boolean
          slug: string
          tenant_id: string
          theme: string | null
          updated_at: string
        }
        Insert: {
          body?: Json
          created_at?: string
          cta_type?: string
          headline: string
          id?: string
          intro_video_url?: string | null
          lead_magnet_id?: string | null
          published?: boolean
          slug: string
          tenant_id: string
          theme?: string | null
          updated_at?: string
        }
        Update: {
          body?: Json
          created_at?: string
          cta_type?: string
          headline?: string
          id?: string
          intro_video_url?: string | null
          lead_magnet_id?: string | null
          published?: boolean
          slug?: string
          tenant_id?: string
          theme?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "landing_pages_lead_magnet_id_fkey"
            columns: ["lead_magnet_id"]
            isOneToOne: false
            referencedRelation: "lead_magnets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_pages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_magnets: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          file_url: string
          id: string
          slug: string
          tenant_id: string
          title: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          file_url: string
          id?: string
          slug: string
          tenant_id: string
          title: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          file_url?: string
          id?: string
          slug?: string
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_magnets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          created_at: string
          email: string
          id: string
          landing_page_id: string | null
          lead_magnet_id: string | null
          name: string | null
          phone: string | null
          referrer: string | null
          status: string
          tenant_id: string
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          landing_page_id?: string | null
          lead_magnet_id?: string | null
          name?: string | null
          phone?: string | null
          referrer?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          landing_page_id?: string | null
          lead_magnet_id?: string | null
          name?: string | null
          phone?: string | null
          referrer?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_landing_page_id_fkey"
            columns: ["landing_page_id"]
            isOneToOne: false
            referencedRelation: "landing_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_lead_magnet_id_fkey"
            columns: ["lead_magnet_id"]
            isOneToOne: false
            referencedRelation: "lead_magnets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          content: Json
          created_at: string
          doc_type: string
          id: string
          is_current: boolean
          published_at: string
          tenant_id: string
          version: string
        }
        Insert: {
          content?: Json
          created_at?: string
          doc_type: string
          id?: string
          is_current?: boolean
          published_at?: string
          tenant_id: string
          version: string
        }
        Update: {
          content?: Json
          created_at?: string
          doc_type?: string
          id?: string
          is_current?: boolean
          published_at?: string
          tenant_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_comments: {
        Row: {
          auth_user_id: string
          body: string
          created_at: string
          id: string
          lesson_id: string
          parent_id: string | null
          tenant_id: string
        }
        Insert: {
          auth_user_id: string
          body: string
          created_at?: string
          id?: string
          lesson_id: string
          parent_id?: string | null
          tenant_id: string
        }
        Update: {
          auth_user_id?: string
          body?: string
          created_at?: string
          id?: string
          lesson_id?: string
          parent_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_comments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "lesson_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_comments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          auth_user_id: string
          completed_at: string
          id: string
          lesson_id: string
          tenant_id: string
        }
        Insert: {
          auth_user_id: string
          completed_at?: string
          id?: string
          lesson_id: string
          tenant_id: string
        }
        Update: {
          auth_user_id?: string
          completed_at?: string
          id?: string
          lesson_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          course_id: string
          created_at: string
          drip_days: number
          duration_seconds: number | null
          free_preview: boolean
          id: string
          position: number
          tenant_id: string
          title: string
          video_asset_id: string | null
        }
        Insert: {
          course_id: string
          created_at?: string
          drip_days?: number
          duration_seconds?: number | null
          free_preview?: boolean
          id?: string
          position?: number
          tenant_id: string
          title: string
          video_asset_id?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string
          drip_days?: number
          duration_seconds?: number | null
          free_preview?: boolean
          id?: string
          position?: number
          tenant_id?: string
          title?: string
          video_asset_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      live_event_registrations: {
        Row: {
          auth_user_id: string | null
          created_at: string
          email: string
          id: string
          live_event_id: string
          name: string | null
          payment_status: string
          stripe_payment_intent: string | null
          tenant_id: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          email: string
          id?: string
          live_event_id: string
          name?: string | null
          payment_status?: string
          stripe_payment_intent?: string | null
          tenant_id: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          email?: string
          id?: string
          live_event_id?: string
          name?: string | null
          payment_status?: string
          stripe_payment_intent?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_event_registrations_live_event_id_fkey"
            columns: ["live_event_id"]
            isOneToOne: false
            referencedRelation: "live_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_event_registrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      live_events: {
        Row: {
          capacity: number
          created_at: string
          description: string | null
          end_at: string
          id: string
          price_cents: number | null
          published: boolean
          start_at: string
          status: string
          tenant_id: string
          title: string
          updated_at: string
          video_room_url: string | null
        }
        Insert: {
          capacity?: number
          created_at?: string
          description?: string | null
          end_at: string
          id?: string
          price_cents?: number | null
          published?: boolean
          start_at: string
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
          video_room_url?: string | null
        }
        Update: {
          capacity?: number
          created_at?: string
          description?: string | null
          end_at?: string
          id?: string
          price_cents?: number | null
          published?: boolean
          start_at?: string
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
          video_room_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_plans: {
        Row: {
          active: boolean
          created_at: string
          id: string
          interval: string
          name: string
          price_cents: number
          stripe_price_id: string | null
          tenant_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          interval?: string
          name: string
          price_cents: number
          stripe_price_id?: string | null
          tenant_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          interval?: string
          name?: string
          price_cents?: number
          stripe_price_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_plans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          auth_user_id: string
          created_at: string
          current_period_end: string | null
          email: string
          id: string
          membership_plan_id: string
          status: string
          stripe_subscription_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          current_period_end?: string | null
          email: string
          id?: string
          membership_plan_id: string
          status?: string
          stripe_subscription_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          current_period_end?: string | null
          email?: string
          id?: string
          membership_plan_id?: string
          status?: string
          stripe_subscription_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_membership_plan_id_fkey"
            columns: ["membership_plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          price_cents: number
          sessions_count: number
          tenant_id: string
          valid_days: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          price_cents: number
          sessions_count: number
          tenant_id: string
          valid_days?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          price_cents?: number
          sessions_count?: number
          tenant_id?: string
          valid_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "packages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_credits: {
        Row: {
          amount_paid_cents: number
          created_at: string
          expires_at: string
          id: string
          package_id: string
          patient_id: string
          sessions_total: number
          sessions_used: number
          status: string
          stripe_payment_intent: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount_paid_cents?: number
          created_at?: string
          expires_at: string
          id?: string
          package_id: string
          patient_id: string
          sessions_total: number
          sessions_used?: number
          status?: string
          stripe_payment_intent?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount_paid_cents?: number
          created_at?: string
          expires_at?: string
          id?: string
          package_id?: string
          patient_id?: string
          sessions_total?: number
          sessions_used?: number
          status?: string
          stripe_payment_intent?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_credits_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_credits_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_credits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          auth_user_id: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          lead_id: string | null
          notas_operativas: string | null
          phone: string | null
          tenant_id: string
          timezone: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          lead_id?: string | null
          notas_operativas?: string | null
          phone?: string | null
          tenant_id: string
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          lead_id?: string | null
          notas_operativas?: string | null
          phone?: string | null
          tenant_id?: string
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sequence_enrollments: {
        Row: {
          created_at: string
          current_step: number
          id: string
          lead_id: string
          next_send_at: string | null
          sequence_id: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_step?: number
          id?: string
          lead_id: string
          next_send_at?: string | null
          sequence_id: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_step?: number
          id?: string
          lead_id?: string
          next_send_at?: string | null
          sequence_id?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sequence_enrollments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_enrollments_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "email_sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_enrollments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sequence_steps: {
        Row: {
          body_template: string
          created_at: string
          delay_hours: number
          id: string
          sequence_id: string
          step_order: number
          subject: string
        }
        Insert: {
          body_template: string
          created_at?: string
          delay_hours?: number
          id?: string
          sequence_id: string
          step_order: number
          subject: string
        }
        Update: {
          body_template?: string
          created_at?: string
          delay_hours?: number
          id?: string
          sequence_id?: string
          step_order?: number
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "sequence_steps_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "email_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_members: {
        Row: {
          auth_user_id: string
          created_at: string
          id: string
          role: string
          tenant_id: string
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          id?: string
          role?: string
          tenant_id: string
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          id?: string
          role?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          booking_settings: Json
          branding: Json
          created_at: string
          custom_domain: string | null
          display_name: string
          id: string
          payment_settings: Json
          slug: string
          status: string
          timezone: string
          updated_at: string
        }
        Insert: {
          booking_settings?: Json
          branding?: Json
          created_at?: string
          custom_domain?: string | null
          display_name: string
          id?: string
          payment_settings?: Json
          slug: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          booking_settings?: Json
          branding?: Json
          created_at?: string
          custom_domain?: string | null
          display_name?: string
          id?: string
          payment_settings?: Json
          slug?: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      confirm_transfer_payment: {
        Args: { p_appointment_id: string }
        Returns: Json
      }
      current_user_context: {
        Args: never
        Returns: {
          is_professional: boolean
          tenant_slug: string
        }[]
      }
      current_user_patient_ids: { Args: never; Returns: string[] }
      current_user_tenant_ids: { Args: never; Returns: string[] }
      link_event_registrations_to_auth_user: {
        Args: { p_email: string; p_tenant_id: string }
        Returns: number
      }
      link_patient_to_auth_user: {
        Args: { p_email: string; p_tenant_id: string }
        Returns: string
      }
      patient_exists_for_login: {
        Args: { p_email: string; p_tenant_id: string }
        Returns: boolean
      }
      professional_create_appointment: {
        Args: {
          p_email?: string
          p_end_at: string
          p_full_name?: string
          p_patient_id?: string
          p_payment_mode?: string
          p_phone?: string
          p_recurrence_group_id?: string
          p_start_at: string
        }
        Returns: Json
      }
      professional_create_recurrence: {
        Args: {
          p_email?: string
          p_end_at: string
          p_full_name?: string
          p_occurrences: number
          p_patient_id?: string
          p_payment_mode?: string
          p_phone?: string
          p_start_at: string
          p_weekday: number
        }
        Returns: Json
      }
      professional_issue_credit: {
        Args: {
          p_amount_paid_cents?: number
          p_package_id: string
          p_patient_id: string
        }
        Returns: Json
      }
      professional_publish_legal_document: {
        Args: { p_content: Json; p_doc_type: string; p_version: string }
        Returns: string
      }
      professional_update_appointment: {
        Args: {
          p_action: string
          p_appointment_id: string
          p_end_at?: string
          p_start_at?: string
        }
        Returns: Json
      }
      public_capture_lead: {
        Args: {
          p_email: string
          p_landing_page_id: string
          p_lead_magnet_id: string
          p_name: string
          p_phone: string
          p_referrer: string
          p_tenant_id: string
          p_utm_campaign: string
          p_utm_content: string
          p_utm_medium: string
          p_utm_source: string
          p_utm_term: string
        }
        Returns: string
      }
      public_create_appointment: {
        Args: {
          p_email: string
          p_end_at: string
          p_full_name: string
          p_payment_mode: string
          p_phone: string
          p_start_at: string
          p_tenant_id: string
        }
        Returns: string
      }
      public_create_credit_appointment: {
        Args: {
          p_email: string
          p_end_at: string
          p_full_name: string
          p_phone: string
          p_start_at: string
          p_tenant_id: string
        }
        Returns: string
      }
      public_get_availability: {
        Args: { p_from: string; p_tenant_id: string; p_to: string }
        Returns: Json
      }
      public_get_landing: {
        Args: { p_slug: string; p_tenant_id: string }
        Returns: Json
      }
      public_get_legal_document: {
        Args: { p_doc_type: string; p_tenant_id: string }
        Returns: Json
      }
      public_get_live_event: {
        Args: { p_event_id: string; p_tenant_id: string }
        Returns: Json
      }
      public_get_packages: { Args: { p_tenant_id: string }; Returns: Json }
      public_get_tenant_by_domain: {
        Args: { p_domain: string }
        Returns: {
          branding: Json
          display_name: string
          id: string
          payment_settings: Json
          slug: string
          timezone: string
        }[]
      }
      public_get_tenant_by_slug: {
        Args: { p_slug: string }
        Returns: {
          branding: Json
          display_name: string
          id: string
          payment_settings: Json
          timezone: string
        }[]
      }
      public_get_upcoming_events: {
        Args: { p_tenant_id: string }
        Returns: Json
      }
      public_record_consent: {
        Args: {
          p_appointment_id: string
          p_ip: string
          p_privacy_version: string
          p_user_agent: string
        }
        Returns: string
      }
      public_record_event_consent: {
        Args: {
          p_ip: string
          p_privacy_version: string
          p_registration_id: string
          p_user_agent: string
        }
        Returns: string
      }
      public_record_lead_consent: {
        Args: {
          p_ip: string
          p_lead_id: string
          p_privacy_version: string
          p_user_agent: string
        }
        Returns: string
      }
      public_register_live_event: {
        Args: {
          p_email: string
          p_event_id: string
          p_name: string
          p_tenant_id: string
        }
        Returns: string
      }
      public_register_live_event_as_user: {
        Args: {
          p_email: string
          p_event_id: string
          p_name: string
          p_tenant_id: string
        }
        Returns: string
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
