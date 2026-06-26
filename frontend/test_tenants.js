import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://ofsgenbpqfrcyvtiannb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mc2dlbmJwcWZyY3l2dGlhbm5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwODQ4MDAsImV4cCI6MjA5NzY2MDgwMH0.5vhyhXZFclanWc5EFPnTYq0CqsQqg1NBJ2VfFI5noO4'
)

async function test() {
  const { data, error } = await supabase
    .from('tenants')
    .select('id, name, slug, plan, business_type, is_active, country, created_at, logo_url, primary_color, subscriptions (status, plan, price, currency, current_period_end)')
    .order('created_at', { ascending: false })
  
  console.log("Error:", error)
  console.log("Data:", data)
}
test()
