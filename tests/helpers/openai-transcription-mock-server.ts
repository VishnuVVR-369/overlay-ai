import { Server, WebSocket as MockClient } from 'mock-socket'

export interface OpenAITranscriptionMockHandle {
  url: string
  server: Server
  clients: Set<MockClient>
  received: object[]
  sendDelta: (itemId: string, delta: string) => void
  sendCompleted: (itemId: string, transcript: string) => void
  sendRaw: (payload: object) => void
  closeWithCode: (code: number, reason?: string) => void
  stop: () => void
}

export function startOpenAITranscriptionMock(
  url = 'wss://api.openai.com/v1/realtime?model=gpt-live-transcribe',
): OpenAITranscriptionMockHandle {
  const server = new Server(url, { mock: false, selectProtocol: () => '' })
  const clients = new Set<MockClient>()
  const received: object[] = []
  server.on('connection', (socket) => {
    const client = socket as unknown as MockClient
    clients.add(client)
    socket.on('message', (raw) => {
      const payload = JSON.parse(raw as string) as { type?: string }
      received.push(payload)
      if (payload.type === 'session.update') {
        socket.send(JSON.stringify({ type: 'session.updated', session: { type: 'transcription' } }))
      }
    })
    socket.on('close', () => clients.delete(client))
  })

  const broadcast = (payload: object): void => {
    const data = JSON.stringify(payload)
    for (const client of clients) client.send(data)
  }

  return {
    url,
    server,
    clients,
    received,
    sendDelta: (itemId, delta) => broadcast({
      type: 'conversation.item.input_audio_transcription.delta',
      item_id: itemId,
      content_index: 0,
      delta,
    }),
    sendCompleted: (itemId, transcript) => broadcast({
      type: 'conversation.item.input_audio_transcription.completed',
      item_id: itemId,
      content_index: 0,
      transcript,
    }),
    sendRaw: broadcast,
    closeWithCode: (code, reason) => {
      for (const client of clients) {
        (client as unknown as { close(opts: { code: number; reason: string }): void })
          .close({ code, reason: reason ?? '' })
      }
    },
    stop: () => {
      try { server.stop() } catch { /* ignore */ }
    },
  }
}
