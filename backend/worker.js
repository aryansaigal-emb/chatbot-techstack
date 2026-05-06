import { Container, getContainer } from '@cloudflare/containers'
import { env } from 'cloudflare:workers'

export class ChatbotBackend extends Container {
  defaultPort = 8080
  sleepAfter = '10m'
  envVars = {
    OPENROUTER_API_KEY: env.OPENROUTER_API_KEY,
    OPENROUTER_MODEL: env.OPENROUTER_MODEL,
    OPENROUTER_APP_NAME: env.OPENROUTER_APP_NAME,
    OPENROUTER_SITE_URL: env.OPENROUTER_SITE_URL,
    SUPABASE_URL: env.SUPABASE_URL,
    SUPABASE_KEY: env.SUPABASE_KEY,
    FRONTEND_ORIGINS: env.FRONTEND_ORIGINS,
  }
}

export default {
  async fetch(request, env) {
    const container = getContainer(env.CHATBOT_BACKEND)
    return container.fetch(request)
  },
}
