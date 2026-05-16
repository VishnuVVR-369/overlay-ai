import { Server, WebSocket as MockClient } from 'mock-socket'

export interface ScribeMockHandle {
  url: string
  server: Server
  clients: Set<MockClient>
  sendPartial: (text: string) => void
  sendCommitted: (text: string) => void
  sendRaw: (payload: object) => void
  closeWithCode: (code: number, reason?: string) => void
  stop: () => void
}

export function startScribeMock(url = 'wss://api.elevenlabs.io/v1/speech-to-text/realtime'): ScribeMockHandle {
  const server = new Server(url, { mock: false, selectProtocol: () => '' })
  const clients = new Set<MockClient>()
  server.on('connection', (socket) => {
    clients.add(socket as unknown as MockClient)
    socket.on('close', () => clients.delete(socket as unknown as MockClient))
  })

  const broadcast = (payload: object): void => {
    const data = JSON.stringify(payload)
    for (const c of clients) c.send(data)
  }

  return {
    url,
    server,
    clients,
    sendPartial: (text) => broadcast({ message_type: 'partial_transcript', text }),
    sendCommitted: (text) => broadcast({ message_type: 'committed_transcript', text }),
    sendRaw: (payload) => broadcast(payload),
    closeWithCode: (code, reason) => {
      for (const c of clients) (c as unknown as { close(opts: { code: number; reason: string }): void }).close({ code, reason: reason ?? '' })
    },
    stop: () => {
      try {
        server.stop()
      } catch {
        /* ignore */
      }
    },
  }
}
