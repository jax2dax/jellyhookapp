import { verifyWebhook } from '@clerk/nextjs/webhooks'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
    
  try {
    const evt = await verifyWebhook(req)

    if (evt.type === 'user.created') {
      const user = evt.data

      await supabase.from('users').insert({
        id: user.id,
        email: user.email_addresses[0]?.email_address,
      })
      console.log('Webhook event payload:', evt)
    }

    return new Response('ok')
  } catch (err) {
    console.error('Webhook error:', err)
    return new Response('error', { status: 400 })
  }
}