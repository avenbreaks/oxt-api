import { Elysia } from "elysia";

export const websocketRoutes = (wsService) => new Elysia()
  .ws('/ws', {
    message(ws, message) {
      wsService.handleMessage(ws, message);
    },
    
    open(ws) {
      wsService.addClient(ws);
    },
    
    close(ws, code, message) {
      // Client cleanup is handled in WebSocketService
    },
    
    error(ws, error) {
      console.error('WebSocket error:', error);
    }
  })
  
  // WebSocket status endpoint
  .get('/ws/status', () => {
    const stats = wsService.getStats();
    return {
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    };
  });