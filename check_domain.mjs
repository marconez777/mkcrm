import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hrbhmqckzjxjbhpzpqeo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyYmhtcWNremp4amJocHpwcWVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NTcyMzcsImV4cCI6MjA5MzMzMzIzN30.MWotK3UNExcmSSuMqFt9kvDERdSDF5RX7_ij2Gv_maQ'
const supabase = createClient(supabaseUrl, supabaseKey)

const clinicId = '3c48b379-f084-478d-a51c-9daa41ad661a'

async function check() {
  const { data, error } = await supabase
    .from('email_domains')
    .select('*')
    .eq('clinic_id', clinicId)

  console.log('Data:', data)
  console.log('Error:', error)
}
check()
