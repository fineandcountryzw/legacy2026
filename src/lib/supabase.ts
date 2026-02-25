// DEPRECATED: Use '@/lib/supabase/server' for Server Components/Actions
// or '@/lib/supabase/client' for Client Components
// This file will be removed once migration is complete

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
