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
      api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          scopes: string[] | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          scopes?: string[] | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          scopes?: string[] | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          resource_id: string | null
          resource_type: string
          tenant_id: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          resource_id?: string | null
          resource_type: string
          tenant_id: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          resource_id?: string | null
          resource_type?: string
          tenant_id?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: Json | null
          code: string
          created_at: string
          created_by: string | null
          currency: string | null
          deleted_at: string | null
          email: string | null
          id: string
          is_active: boolean
          is_main: boolean
          name: string
          phone: string | null
          settings: Json | null
          tenant_id: string
          timezone: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: Json | null
          code: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          is_main?: boolean
          name: string
          phone?: string | null
          settings?: Json | null
          tenant_id: string
          timezone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: Json | null
          code?: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          is_main?: boolean
          name?: string
          phone?: string | null
          settings?: Json | null
          tenant_id?: string
          timezone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brands_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_registers: {
        Row: {
          branch_id: string
          cash_difference: number | null
          closed_at: string | null
          closed_by: string | null
          closing_cash: number | null
          created_at: string
          created_by: string | null
          expected_cash: number | null
          id: string
          name: string
          notes: string | null
          opened_at: string | null
          opened_by: string | null
          opening_cash: number
          status: Database["public"]["Enums"]["cash_register_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          cash_difference?: number | null
          closed_at?: string | null
          closed_by?: string | null
          closing_cash?: number | null
          created_at?: string
          created_by?: string | null
          expected_cash?: number | null
          id?: string
          name: string
          notes?: string | null
          opened_at?: string | null
          opened_by?: string | null
          opening_cash?: number
          status?: Database["public"]["Enums"]["cash_register_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          cash_difference?: number | null
          closed_at?: string | null
          closed_by?: string | null
          closing_cash?: number | null
          created_at?: string
          created_by?: string | null
          expected_cash?: number | null
          id?: string
          name?: string
          notes?: string | null
          opened_at?: string | null
          opened_by?: string | null
          opening_cash?: number
          status?: Database["public"]["Enums"]["cash_register_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_registers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_registers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          icon: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          parent_id: string | null
          slug: string | null
          sort_order: number | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          parent_id?: string | null
          slug?: string | null
          sort_order?: number | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          parent_id?: string | null
          slug?: string | null
          sort_order?: number | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          customer_id: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          promotion_id: string | null
          tenant_id: string
          uses_count: number
          uses_limit: number | null
        }
        Insert: {
          code: string
          created_at?: string
          customer_id?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          promotion_id?: string | null
          tenant_id: string
          uses_count?: number
          uses_limit?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          customer_id?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          promotion_id?: string | null
          tenant_id?: string
          uses_count?: number
          uses_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coupons_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: Json | null
          birthday: string | null
          branch_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string | null
          full_name: string
          id: string
          loyalty_points: number
          meta: Json | null
          notes: string | null
          phone: string | null
          tags: string[] | null
          tax_id: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: Json | null
          birthday?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          loyalty_points?: number
          meta?: Json | null
          notes?: string | null
          phone?: string | null
          tags?: string[] | null
          tax_id?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: Json | null
          birthday?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          loyalty_points?: number
          meta?: Json | null
          notes?: string | null
          phone?: string | null
          tags?: string[] | null
          tax_id?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      dining_areas: {
        Row: {
          branch_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dining_areas_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dining_areas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          conditions: Json | null
          created_at: string
          description: string | null
          id: string
          is_enabled: boolean
          key: string
          rollout_percent: number | null
          updated_at: string
        }
        Insert: {
          conditions?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          is_enabled?: boolean
          key: string
          rollout_percent?: number | null
          updated_at?: string
        }
        Update: {
          conditions?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          is_enabled?: boolean
          key?: string
          rollout_percent?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      inventory: {
        Row: {
          branch_id: string
          id: string
          last_counted_at: string | null
          product_id: string
          quantity: number
          reserved: number
          tenant_id: string
          unit: string
          updated_at: string
          variant_id: string | null
          warehouse_id: string
        }
        Insert: {
          branch_id: string
          id?: string
          last_counted_at?: string | null
          product_id: string
          quantity?: number
          reserved?: number
          tenant_id: string
          unit?: string
          updated_at?: string
          variant_id?: string | null
          warehouse_id: string
        }
        Update: {
          branch_id?: string
          id?: string
          last_counted_at?: string | null
          product_id?: string
          quantity?: number
          reserved?: number
          tenant_id?: string
          unit?: string
          updated_at?: string
          variant_id?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_modules: {
        Row: {
          category: string | null
          config_schema: Json | null
          created_at: string
          dependencies: string[] | null
          description: string | null
          icon_url: string | null
          id: string
          is_active: boolean
          is_free: boolean
          min_plan: Database["public"]["Enums"]["subscription_plan"]
          name: string
          price: number
          slug: string
          updated_at: string
          version: string
        }
        Insert: {
          category?: string | null
          config_schema?: Json | null
          created_at?: string
          dependencies?: string[] | null
          description?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          is_free?: boolean
          min_plan?: Database["public"]["Enums"]["subscription_plan"]
          name: string
          price?: number
          slug: string
          updated_at?: string
          version?: string
        }
        Update: {
          category?: string | null
          config_schema?: Json | null
          created_at?: string
          dependencies?: string[] | null
          description?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          is_free?: boolean
          min_plan?: Database["public"]["Enums"]["subscription_plan"]
          name?: string
          price?: number
          slug?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json | null
          id: string
          read_at: string | null
          tenant_id: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          read_at?: string | null
          tenant_id?: string | null
          title: string
          type?: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          read_at?: string | null
          tenant_id?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          destination: string | null
          id: string
          notes: string | null
          order_id: string
          product_id: string
          quantity: number
          ready_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          unit_price: number
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          destination?: string | null
          id?: string
          notes?: string | null
          order_id: string
          product_id: string
          quantity: number
          ready_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          unit_price: number
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          destination?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          product_id?: string
          quantity?: number
          ready_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          unit_price?: number
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_table_with_order"
            referencedColumns: ["active_order_id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          branch_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          guests: number | null
          id: string
          notes: string | null
          order_number: string
          sale_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          table_id: string | null
          tenant_id: string
          updated_at: string
          waiter_id: string | null
        }
        Insert: {
          branch_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          guests?: number | null
          id?: string
          notes?: string | null
          order_number: string
          sale_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          table_id?: string | null
          tenant_id: string
          updated_at?: string
          waiter_id?: string | null
        }
        Update: {
          branch_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          guests?: number | null
          id?: string
          notes?: string | null
          order_number?: string
          sale_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          table_id?: string | null
          tenant_id?: string
          updated_at?: string
          waiter_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_sales_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "v_table_with_order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          module: string
          permission_key: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          module: string
          permission_key: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          module?: string
          permission_key?: string
        }
        Relationships: []
      }
      product_variants: {
        Row: {
          attributes: Json | null
          barcode: string | null
          cost_price: number | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          price: number | null
          product_id: string
          sku: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          attributes?: Json | null
          barcode?: string | null
          cost_price?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          price?: number | null
          product_id: string
          sku: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          attributes?: Json | null
          barcode?: string | null
          cost_price?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          price?: number | null
          product_id?: string
          sku?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          allow_negative_stock: boolean
          barcode: string | null
          branch_id: string | null
          brand_id: string | null
          category_id: string | null
          cost_price: number | null
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          description: string | null
          id: string
          image_url: string | null
          max_stock: number | null
          meta: Json | null
          min_stock: number
          name: string
          price: number
          sku: string
          status: Database["public"]["Enums"]["product_status"]
          supplier_id: string | null
          tags: string[] | null
          tax: number
          tenant_id: string
          track_inventory: boolean
          unit: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allow_negative_stock?: boolean
          barcode?: string | null
          branch_id?: string | null
          brand_id?: string | null
          category_id?: string | null
          cost_price?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          max_stock?: number | null
          meta?: Json | null
          min_stock?: number
          name: string
          price?: number
          sku: string
          status?: Database["public"]["Enums"]["product_status"]
          supplier_id?: string | null
          tags?: string[] | null
          tax?: number
          tenant_id: string
          track_inventory?: boolean
          unit?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allow_negative_stock?: boolean
          barcode?: string | null
          branch_id?: string | null
          brand_id?: string | null
          category_id?: string | null
          cost_price?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          max_stock?: number | null
          meta?: Json | null
          min_stock?: number
          name?: string
          price?: number
          sku?: string
          status?: Database["public"]["Enums"]["product_status"]
          supplier_id?: string | null
          tags?: string[] | null
          tax?: number
          tenant_id?: string
          track_inventory?: boolean
          unit?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          conditions: Json | null
          created_at: string
          created_by: string | null
          description: string | null
          end_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          min_amount: number | null
          name: string
          start_at: string | null
          tenant_id: string
          type: string
          updated_at: string
          uses_count: number
          value: number
        }
        Insert: {
          conditions?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_amount?: number | null
          name: string
          start_at?: string | null
          tenant_id: string
          type: string
          updated_at?: string
          uses_count?: number
          value?: number
        }
        Update: {
          conditions?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_amount?: number | null
          name?: string
          start_at?: string | null
          tenant_id?: string
          type?: string
          updated_at?: string
          uses_count?: number
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "promotions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_items: {
        Row: {
          id: string
          ingredient_id: string
          notes: string | null
          quantity: number
          recipe_id: string
          unit: string
        }
        Insert: {
          id?: string
          ingredient_id: string
          notes?: string | null
          quantity: number
          recipe_id: string
          unit: string
        }
        Update: {
          id?: string
          ingredient_id?: string
          notes?: string | null
          quantity?: number
          recipe_id?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          cook_time_min: number | null
          created_at: string
          created_by: string | null
          id: string
          instructions: string | null
          prep_time_min: number | null
          product_id: string
          tenant_id: string
          updated_at: string
          yield_quantity: number
          yield_unit: string
        }
        Insert: {
          cook_time_min?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          instructions?: string | null
          prep_time_min?: number | null
          product_id: string
          tenant_id: string
          updated_at?: string
          yield_quantity?: number
          yield_unit?: string
        }
        Update: {
          cook_time_min?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          instructions?: string | null
          prep_time_min?: number | null
          product_id?: string
          tenant_id?: string
          updated_at?: string
          yield_quantity?: number
          yield_unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_system: boolean
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string
          discount: number
          discount_amount: number
          id: string
          name: string
          notes: string | null
          product_id: string
          quantity: number
          sale_id: string
          sent_to_bar: boolean | null
          sent_to_kitchen: boolean | null
          sku: string
          tax: number
          tax_amount: number
          total: number
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          discount?: number
          discount_amount?: number
          id?: string
          name: string
          notes?: string | null
          product_id: string
          quantity: number
          sale_id: string
          sent_to_bar?: boolean | null
          sent_to_kitchen?: boolean | null
          sku: string
          tax?: number
          tax_amount?: number
          total: number
          unit_price: number
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          discount?: number
          discount_amount?: number
          id?: string
          name?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          sale_id?: string
          sent_to_bar?: boolean | null
          sent_to_kitchen?: boolean | null
          sku?: string
          tax?: number
          tax_amount?: number
          total?: number
          unit_price?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_sales_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          reference: string | null
          sale_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          reference?: string | null
          sale_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          reference?: string | null
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_sales_with_details"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          branch_id: string
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cash_register_id: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string | null
          discount_total: number
          id: string
          notes: string | null
          order_number: string
          receipt_number: string | null
          status: Database["public"]["Enums"]["sale_status"]
          subtotal: number
          table_id: string | null
          tax_total: number
          tenant_id: string
          total: number
          updated_at: string
        }
        Insert: {
          branch_id: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cash_register_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          discount_total?: number
          id?: string
          notes?: string | null
          order_number: string
          receipt_number?: string | null
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal?: number
          table_id?: string | null
          tax_total?: number
          tenant_id: string
          total?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cash_register_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          discount_total?: number
          id?: string
          notes?: string | null
          order_number?: string
          receipt_number?: string | null
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal?: number
          table_id?: string | null
          tax_total?: number
          tenant_id?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "v_active_cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          product_id: string
          quantity: number
          reference_id: string | null
          reference_type: string | null
          tenant_id: string
          type: Database["public"]["Enums"]["stock_movement_type"]
          unit_cost: number | null
          variant_id: string | null
          warehouse_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          product_id: string
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          tenant_id: string
          type: Database["public"]["Enums"]["stock_movement_type"]
          unit_cost?: number | null
          variant_id?: string | null
          warehouse_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          tenant_id?: string
          type?: Database["public"]["Enums"]["stock_movement_type"]
          unit_cost?: number | null
          variant_id?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          billing_cycle: string
          cancel_reason: string | null
          cancelled_at: string | null
          created_at: string
          created_by: string | null
          currency: string
          current_period_end: string
          current_period_start: string
          external_subscription_id: string | null
          id: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          price: number
          status: Database["public"]["Enums"]["subscription_status"]
          tenant_id: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          billing_cycle?: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          current_period_end: string
          current_period_start: string
          external_subscription_id?: string | null
          id?: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          price: number
          status?: Database["public"]["Enums"]["subscription_status"]
          tenant_id: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          billing_cycle?: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          current_period_end?: string
          current_period_start?: string
          external_subscription_id?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          price?: number
          status?: Database["public"]["Enums"]["subscription_status"]
          tenant_id?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: Json | null
          contact_name: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          tax_id: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: Json | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          tax_id?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: Json | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          tax_id?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tables: {
        Row: {
          area_id: string | null
          branch_id: string
          capacity: number
          created_at: string
          created_by: string | null
          height: number | null
          id: string
          is_active: boolean
          name: string | null
          number: string
          position_x: number | null
          position_y: number | null
          shape: string | null
          status: Database["public"]["Enums"]["table_status"]
          tenant_id: string
          updated_at: string
          width: number | null
        }
        Insert: {
          area_id?: string | null
          branch_id: string
          capacity?: number
          created_at?: string
          created_by?: string | null
          height?: number | null
          id?: string
          is_active?: boolean
          name?: string | null
          number: string
          position_x?: number | null
          position_y?: number | null
          shape?: string | null
          status?: Database["public"]["Enums"]["table_status"]
          tenant_id: string
          updated_at?: string
          width?: number | null
        }
        Update: {
          area_id?: string | null
          branch_id?: string
          capacity?: number
          created_at?: string
          created_by?: string | null
          height?: number | null
          id?: string
          is_active?: boolean
          name?: string | null
          number?: string
          position_x?: number | null
          position_y?: number | null
          shape?: string | null
          status?: Database["public"]["Enums"]["table_status"]
          tenant_id?: string
          updated_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tables_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "dining_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tables_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tables_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_feature_flags: {
        Row: {
          flag_key: string
          is_enabled: boolean
          tenant_id: string
        }
        Insert: {
          flag_key: string
          is_enabled?: boolean
          tenant_id: string
        }
        Update: {
          flag_key?: string
          is_enabled?: boolean
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_feature_flags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_modules: {
        Row: {
          config: Json | null
          id: string
          installed_at: string
          is_enabled: boolean
          module_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          config?: Json | null
          id?: string
          installed_at?: string
          is_enabled?: boolean
          module_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          config?: Json | null
          id?: string
          installed_at?: string
          is_enabled?: boolean
          module_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_modules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "marketplace_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_modules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          address: Json | null
          business_type: Database["public"]["Enums"]["business_type"]
          country: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          deleted_at: string | null
          id: string
          is_active: boolean
          locale: string | null
          logo_url: string | null
          name: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          primary_color: string | null
          settings: Json | null
          slug: string
          tax_id: string | null
          timezone: string | null
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          address?: Json | null
          business_type?: Database["public"]["Enums"]["business_type"]
          country?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          locale?: string | null
          logo_url?: string | null
          name: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          primary_color?: string | null
          settings?: Json | null
          slug: string
          tax_id?: string | null
          timezone?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          address?: Json | null
          business_type?: Database["public"]["Enums"]["business_type"]
          country?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          locale?: string | null
          logo_url?: string | null
          name?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          primary_color?: string | null
          settings?: Json | null
          slug?: string
          tax_id?: string | null
          timezone?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      transfer_items: {
        Row: {
          id: string
          product_id: string
          quantity: number
          received_qty: number | null
          transfer_id: string
          unit: string
          variant_id: string | null
        }
        Insert: {
          id?: string
          product_id: string
          quantity: number
          received_qty?: number | null
          transfer_id: string
          unit?: string
          variant_id?: string | null
        }
        Update: {
          id?: string
          product_id?: string
          quantity?: number
          received_qty?: number | null
          transfer_id?: string
          unit?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transfer_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "transfers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      transfers: {
        Row: {
          approved_by: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          from_warehouse_id: string
          id: string
          notes: string | null
          requested_by: string | null
          status: string
          tenant_id: string
          to_warehouse_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approved_by?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          from_warehouse_id: string
          id?: string
          notes?: string | null
          requested_by?: string | null
          status?: string
          tenant_id: string
          to_warehouse_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approved_by?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          from_warehouse_id?: string
          id?: string
          notes?: string | null
          requested_by?: string | null
          status?: string
          tenant_id?: string
          to_warehouse_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transfers_from_warehouse_id_fkey"
            columns: ["from_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_to_warehouse_id_fkey"
            columns: ["to_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          last_seen_at: string | null
          locale: string | null
          phone: string | null
          platform_role: Database["public"]["Enums"]["platform_role"] | null
          settings: Json | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          last_seen_at?: string | null
          locale?: string | null
          phone?: string | null
          platform_role?: Database["public"]["Enums"]["platform_role"] | null
          settings?: Json | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          last_seen_at?: string | null
          locale?: string | null
          phone?: string | null
          platform_role?: Database["public"]["Enums"]["platform_role"] | null
          settings?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      user_tenant_roles: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          invited_by: string | null
          is_active: boolean
          joined_at: string
          role: Database["public"]["Enums"]["business_role"]
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          invited_by?: string | null
          is_active?: boolean
          joined_at?: string
          role?: Database["public"]["Enums"]["business_role"]
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          invited_by?: string | null
          is_active?: boolean
          joined_at?: string
          role?: Database["public"]["Enums"]["business_role"]
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tenant_roles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_tenant_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          branch_id: string
          code: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_deliveries: {
        Row: {
          delivered_at: string
          endpoint_id: string
          error_message: string | null
          event: string
          id: string
          status: string
        }
        Insert: {
          delivered_at?: string
          endpoint_id: string
          error_message?: string | null
          event: string
          id?: string
          status?: string
        }
        Update: {
          delivered_at?: string
          endpoint_id?: string
          error_message?: string | null
          event?: string
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "webhook_endpoints"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_endpoints: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          events: string[]
          id: string
          secret: string
          tenant_id: string
          updated_at: string
          url: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          events?: string[]
          id?: string
          secret: string
          tenant_id: string
          updated_at?: string
          url: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          events?: string[]
          id?: string
          secret?: string
          tenant_id?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_endpoints_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      mv_daily_sales: {
        Row: {
          avg_ticket: number | null
          branch_id: string | null
          max_ticket: number | null
          min_ticket: number | null
          sale_date: string | null
          tenant_id: string | null
          total_discount: number | null
          total_revenue: number | null
          total_tax: number | null
          total_transactions: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_product_sales_rank: {
        Row: {
          branch_id: string | null
          month: string | null
          product_id: string | null
          product_name: string | null
          sale_count: number | null
          sku: string | null
          tenant_id: string | null
          total_quantity: number | null
          total_revenue: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      v_active_cash_registers: {
        Row: {
          branch_id: string | null
          branch_name: string | null
          cash_difference: number | null
          closed_at: string | null
          closed_by: string | null
          closing_cash: number | null
          created_at: string | null
          created_by: string | null
          expected_cash: number | null
          id: string | null
          name: string | null
          notes: string | null
          opened_at: string | null
          opened_by: string | null
          opened_by_name: string | null
          opening_cash: number | null
          sales_total: number | null
          status: Database["public"]["Enums"]["cash_register_status"] | null
          tenant_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_registers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_registers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      v_inventory_with_product: {
        Row: {
          branch_id: string | null
          id: string | null
          is_low_stock: boolean | null
          last_counted_at: string | null
          max_stock: number | null
          min_stock: number | null
          product_barcode: string | null
          product_id: string | null
          product_name: string | null
          product_sku: string | null
          product_status: Database["public"]["Enums"]["product_status"] | null
          quantity: number | null
          reserved: number | null
          tenant_id: string | null
          unit: string | null
          updated_at: string | null
          variant_id: string | null
          warehouse_id: string | null
          warehouse_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      v_sales_with_details: {
        Row: {
          branch_id: string | null
          branch_name: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cash_register_id: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          discount_total: number | null
          id: string | null
          item_count: number | null
          notes: string | null
          order_number: string | null
          receipt_number: string | null
          status: Database["public"]["Enums"]["sale_status"] | null
          subtotal: number | null
          table_id: string | null
          tax_total: number | null
          tenant_id: string | null
          total: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "v_active_cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      v_table_with_order: {
        Row: {
          active_order_id: string | null
          area_id: string | null
          area_name: string | null
          branch_id: string | null
          capacity: number | null
          created_at: string | null
          created_by: string | null
          height: number | null
          id: string | null
          is_active: boolean | null
          name: string | null
          number: string | null
          order_opened_at: string | null
          order_status: Database["public"]["Enums"]["order_status"] | null
          position_x: number | null
          position_y: number | null
          shape: string | null
          status: Database["public"]["Enums"]["table_status"] | null
          tenant_id: string | null
          updated_at: string | null
          width: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tables_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "dining_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tables_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tables_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      create_sale_transaction: {
        Args: { p_items: Json; p_payments: Json; p_sale: Json }
        Returns: string
      }
      create_tenant_with_owner: {
        Args: {
          p_business_type: string
          p_country: string
          p_currency: string
          p_locale?: string
          p_name: string
          p_owner_email: string
          p_owner_name: string
          p_owner_password: string
          p_plan: string
          p_slug: string
          p_timezone?: string
        }
        Returns: Json
      }
      get_daily_sales_summary: {
        Args: { p_branch_id?: string; p_date?: string; p_tenant_id: string }
        Returns: {
          avg_ticket: number
          payment_methods: Json
          total_discount: number
          total_revenue: number
          total_sales: number
          total_tax: number
        }[]
      }
      get_inventory_alerts: {
        Args: { p_tenant_id: string }
        Returns: {
          current_qty: number
          min_stock: number
          product_id: string
          product_name: string
          sku: string
          warehouse_id: string
        }[]
      }
      get_user_tenant_ids: { Args: never; Returns: string[] }
      increment_loyalty_points: {
        Args: {
          p_amount: number
          p_customer_id: string
          p_rate?: number
          p_tenant_id: string
        }
        Returns: undefined
      }
      is_super_admin: { Args: never; Returns: boolean }
      refresh_daily_sales_mv: { Args: never; Returns: undefined }
      seed_tenant_roles: { Args: { p_tenant_id: string }; Returns: undefined }
      set_tenant_active: {
        Args: { p_active: boolean; p_tenant_id: string }
        Returns: undefined
      }
      set_tenant_plan: {
        Args: { p_plan: string; p_tenant_id: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      unaccent: { Args: { "": string }; Returns: string }
      user_belongs_to_tenant: {
        Args: { p_tenant_id: string }
        Returns: boolean
      }
      user_role_in_tenant: { Args: { p_tenant_id: string }; Returns: string }
    }
    Enums: {
      business_role:
        | "OWNER"
        | "ADMIN"
        | "CASHIER"
        | "WAITER"
        | "CHEF"
        | "BARTENDER"
        | "ACCOUNTANT"
        | "INVENTORY_MANAGER"
      business_type:
        | "STORE"
        | "RESTAURANT"
        | "BAR"
        | "RESTOBAR"
        | "BAKERY"
        | "ICE_CREAM_SHOP"
        | "PHARMACY"
        | "MINIMARKET"
        | "CUSTOM"
      cash_register_status: "OPEN" | "CLOSED" | "PAUSED"
      order_status: "PENDING" | "PREPARING" | "READY" | "SERVED" | "CANCELLED"
      payment_method:
        | "CASH"
        | "CARD"
        | "TRANSFER"
        | "QR"
        | "GIFT_CARD"
        | "MIXED"
      platform_role: "SUPER_ADMIN" | "SUPPORT" | "SALES_MANAGER"
      product_status: "ACTIVE" | "INACTIVE" | "DRAFT" | "ARCHIVED"
      sale_status:
        | "PENDING"
        | "COMPLETED"
        | "CANCELLED"
        | "REFUNDED"
        | "PARTIALLY_REFUNDED"
      stock_movement_type:
        | "IN"
        | "OUT"
        | "ADJUSTMENT"
        | "TRANSFER_IN"
        | "TRANSFER_OUT"
        | "PURCHASE"
        | "SALE"
        | "RETURN"
        | "WASTE"
        | "PRODUCTION"
      subscription_plan: "FREE" | "BASIC" | "PROFESSIONAL" | "ENTERPRISE"
      subscription_status:
        | "TRIAL"
        | "ACTIVE"
        | "PAST_DUE"
        | "CANCELLED"
        | "EXPIRED"
      table_status: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "MAINTENANCE"
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
      business_role: [
        "OWNER",
        "ADMIN",
        "CASHIER",
        "WAITER",
        "CHEF",
        "BARTENDER",
        "ACCOUNTANT",
        "INVENTORY_MANAGER",
      ],
      business_type: [
        "STORE",
        "RESTAURANT",
        "BAR",
        "RESTOBAR",
        "BAKERY",
        "ICE_CREAM_SHOP",
        "PHARMACY",
        "MINIMARKET",
        "CUSTOM",
      ],
      cash_register_status: ["OPEN", "CLOSED", "PAUSED"],
      order_status: ["PENDING", "PREPARING", "READY", "SERVED", "CANCELLED"],
      payment_method: ["CASH", "CARD", "TRANSFER", "QR", "GIFT_CARD", "MIXED"],
      platform_role: ["SUPER_ADMIN", "SUPPORT", "SALES_MANAGER"],
      product_status: ["ACTIVE", "INACTIVE", "DRAFT", "ARCHIVED"],
      sale_status: [
        "PENDING",
        "COMPLETED",
        "CANCELLED",
        "REFUNDED",
        "PARTIALLY_REFUNDED",
      ],
      stock_movement_type: [
        "IN",
        "OUT",
        "ADJUSTMENT",
        "TRANSFER_IN",
        "TRANSFER_OUT",
        "PURCHASE",
        "SALE",
        "RETURN",
        "WASTE",
        "PRODUCTION",
      ],
      subscription_plan: ["FREE", "BASIC", "PROFESSIONAL", "ENTERPRISE"],
      subscription_status: [
        "TRIAL",
        "ACTIVE",
        "PAST_DUE",
        "CANCELLED",
        "EXPIRED",
      ],
      table_status: ["AVAILABLE", "OCCUPIED", "RESERVED", "MAINTENANCE"],
    },
  },
} as const
