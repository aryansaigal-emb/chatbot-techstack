import { Container, getContainer } from '@cloudflare/containers'

export class ChatbotBackend extends Container {
  defaultPort = 8080
  sleepAfter = '10m'
}

export default {
  async fetch(request, env) {
    const container = getContainer(env.CHATBOT_BACKEND)
    return container.fetch(request)
  },
}
