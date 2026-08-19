import { WebSocket, WebSocketServer } from "ws";

function sendJSON(socket, payload)                //helper function
  {
    if(socket.readyState!=WebSocket.OPEN) return;
    socket.send(JSON.stringify(payload));
  }


function broadcast(wss,payload)                 //helper function
{
  for(const client of wss.clients)
  {
    if(client.readyState!=WebSocket.OPEN) continue;
    client.send(JSON.stringify(payload));
  }
}


export function attachWebSocketServer(server)  //the main function which enables the websocketserver to run on the same port as the express app, hence preventing the eed for a separate port. All requests containing the path; '/ws' , go through the websocketserver rather than the REST API. So the websocketserver is attached to the express server.
{
  const wss=new WebSocketServer(
    {
      server,
      path: '/ws',
      maxPayload: 1024 * 1024
    }
  )

   wss.on('connection', async (socket, req) => {
        socket.isAlive = true;
        socket.on('pong', () => { socket.isAlive = true; });

        socket.subscriptions = new Set();

        sendJSON(socket, { type: 'welcome' });

        socket.on('message', (data) => {
            handleMessage(socket, data);
        });

        socket.on('error', () => {
            socket.terminate();
        });

        socket.on('close', () => {
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

  function broadcastMatchCreated(match)
  {
    broadcast(wss, {type: 'matchCreated',data: match});
  }
  return {
    broadcastMatchCreated
  }
}