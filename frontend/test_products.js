import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://ofsgenbpqfrcyvtiannb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mc2dlbmJwcWZyY3l2dGlhbm5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwODQ4MDAsImV4cCI6MjA5NzY2MDgwMH0.5vhyhXZFclanWc5EFPnTYq0CqsQqg1NBJ2VfFI5noO4'
)

async function test() {
  // Query all products without RLS restrictions if possible, or just standard query
  const { data: tenants, error: tErr } = await supabase.from('tenants').select('id, name')
  console.log("Tenants:", tenants, tErr)

  const { data: products, error: pErr } = await supabase.from('products').select('*')
  console.log("Products count:", products?.length, pErr)
  if (products && products.length > 0) {
    console.log("First 5 products:", products.slice(0, 5))
  }
}
test()
