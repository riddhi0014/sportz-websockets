import { WebSocket, WebSocketServer } from "ws";

const MAX_CONNECTIONS_PER_IP = 5;

const matchSubscribers = new Map();

function subscribe(matchId, socket) {
    if(!matchSubscribers.has(matchId)) {
        matchSubscribers.set(matchId, new Set());
    }

    matchSubscribers.get(matchId).add(socket);
}

function unsubscribe(matchId, socket) {
    const subscribers = matchSubscribers.get(matchId);

    if(!subscribers) return;

    subscribers.delete(socket);

    if(subscribers.size === 0) {
        matchSubscribers.delete(matchId);
    }
}

function cleanupSubscriptions(socket) {
    for(const matchId of socket.subscriptions) {
        unsubscribe(matchId, socket);
    }
}

function sendJson(socket, payload) {
    if(socket.readyState !== WebSocket.OPEN) return;

    socket.send(JSON.stringify(payload));
}

function broadcastToAll(wss, payload) {
    for (const client of wss.clients)  {
        if(client.readyState !== WebSocket.OPEN) continue;

        client.send(JSON.stringify(payload));
    }
}

function broadcastToMatch(matchId, payload) {
    const subscribers = matchSubscribers.get(matchId);
    if(!subscribers || subscribers.size === 0) return;

    const message = JSON.stringify(payload);

    for(const client of subscribers) {
        if(client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    }
}

function handleMessage(socket, data) {
    let message;

    try {
        message = JSON.parse(data.toString());
    } catch {
        sendJson(socket, { type: 'error', message: 'Invalid JSON' });
    }

    if(message?.type === "subscribe" && Number.isInteger(message.matchId)) {
        subscribe(message.matchId, socket);
        socket.subscriptions.add(message.matchId);
        sendJson(socket, { type: 'subscribed', matchId: message.matchId });
        return;
    }

    if(message?.type === "unsubscribe" && Number.isInteger(message.matchId)) {
        unsubscribe(message.matchId, socket);
        socket.subscriptions.delete(message.matchId);
        sendJson(socket, { type: 'unsubscribed', matchId: message.matchId });
    }
}











// function sendJSON(socket, payload)                //helper function
//   {
//     if(socket.readyState!=WebSocket.OPEN) return;
//     socket.send(JSON.stringify(payload));
//   }


// function broadcast(wss,payload)                 //helper function
// {
//   for(const client of wss.clients)
//   {
//     if(client.readyState!=WebSocket.OPEN) continue;
//     client.send(JSON.stringify(payload)); 
//   }
// }

export function attachWebSocketServer(server)  //the main function which enables the websocketserver to run on the same port as the express app, hence preventing the eed for a separate port. All requests containing the path; '/ws' , go through the websocketserver rather than the REST API. So the websocketserver is attached to the express server.
{
  const wss=new WebSocketServer(
    {
      server,
      path: '/ws',
      maxPayload: 1024 * 1024
    }
  )

  const connectionCounts = new Map(); // ip -> active connection count

   wss.on('connection', async (socket, req) => {

        const ip = req.socket.remoteAddress;
        const currentCount = connectionCounts.get(ip) || 0;

        if (currentCount >= MAX_CONNECTIONS_PER_IP) {
            socket.close(1008, 'Too many connections from this IP');
            return;
        }
        connectionCounts.set(ip, currentCount + 1);

        socket.isAlive = true;
        socket.on('pong', () => { socket.isAlive = true; });

        socket.subscriptions = new Set();

        sendJson(socket, { type: 'welcome' });

        socket.on('message', (data) => {
            handleMessage(socket, data);
        });

        socket.on('error', () => {
            socket.terminate();
        });

        socket.on('close', () => {
            const count = connectionCounts.get(ip) || 1;
            connectionCounts.set(ip, Math.max(0, count - 1));
            cleanupSubscriptions(socket);
        })

        socket.on('error', console.error);
    });

    const interval = setInterval(() => {
      wss.clients.forEach((ws) => {
          if (ws.isAlive === false) return ws.terminate();

          ws.isAlive = false;
          ws.ping();
      })}, 30000);

  wss.on('close', () => clearInterval(interval));

  function broadcastMatchCreated(match) {
    broadcastToAll(wss, {type: 'matchCreated', data: match});
  }


  function broadcastCommentary(matchId, comment) {
    broadcastToMatch(matchId, { type: 'commentary', data: comment });
}

return { broadcastMatchCreated, broadcastCommentary };
}