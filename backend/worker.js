import { Container, getContainer } from '@cloudflare/containers'
import { env } from 'cloudflare:workers'

export class ChatbotBackend extends Container {
  defaultPort = 8080
  sleepAfter = '10m'
  envVars = {
    GROQ_API_KEY: env.GROQ_API_KEY,
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
