const { createClient } = require('@supabase/supabase-js'); // เอามาไว้กับตัวอื่น

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

module.exports = supabase;
