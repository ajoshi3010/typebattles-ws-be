import { WebSocket, WebSocketServer } from 'ws';
import { UserManager } from './UserManager';
import { IncomingMessage, SupportedMessage } from "./messages/incomingMessages";

const wss = new WebSocketServer({ port: 8081 });
const userManager = new UserManager();

// Listen for incoming connections
wss.on('connection', function connection(ws: WebSocket) {
    console.log("New Client Connected! ", ws.toString());
    
    // Send a welcome message to the newly connected client
    ws.send('Namaste From Server🙏🏻');
    
    // Listen for messages from the client
    ws.on('error', console.error);
    ws.on('message', function message(data: IncomingMessage) {
        const message = JSON.parse(data.toString());
        messageHandler(ws, message);
    });
    
    // Handle connection closure
    ws.on('close', function close(code, reason) {
        console.log(`Client disconnected with code: ${code}, reason: ${JSON.stringify(reason)}`);
    });
});

// Send a server-side message once the WebSocket server is listening
wss.on('listening', () => {
    console.log('Server is listening on port 8081');
});

// Handle different message types
function messageHandler(ws: WebSocket, message: IncomingMessage) {
    if (message.type == SupportedMessage.AddRoom) {
        const userDetails = message.payload;
        userManager.addRoom(userDetails, ws);
    }
    if (message.type == SupportedMessage.JoinRoom) {
        const { name, image, userId, roomId } = message.payload;
        userManager.addUser({ name, image, userId }, roomId, ws);
    }
    if (message.type == SupportedMessage.VerifyUser) {
        const { userId, roomId } = message.payload;
        userManager.verifyUser(userId, roomId, ws);
    }
    if (message.type == SupportedMessage.GetAndNotify) {
        const userDetails = message.payload;
        userManager.getAndNotify(userDetails, ws);
    }
    if (message.type == SupportedMessage.CreateBattle) {
        const payload = message.payload;
        console.log(payload);
        userManager.createBattle(payload.roomId);
    }
    if (message.type == SupportedMessage.StartBattle) {
        const payload = message.payload;
        userManager.startBattle(payload.roomId);
    }
    if (message.type == SupportedMessage.UpdatePos) {
        const { roomId, userId, pos, name } = message.payload;
        userManager.updatePos(roomId, userId, pos, name);
    }
    if (message.type == SupportedMessage.UpdateBattleInfo) {
        const { userId, battle_infoType } = message.payload;
        userManager.UpdateBattleInfo(userId, battle_infoType);
    }
    if (message.type == SupportedMessage.NewBattle) {
        const { roomId } = message.payload;
        userManager.NewBattle(roomId);
    }
    if (message.type == SupportedMessage.GameConfig) {
        const { roomId, gameConfig } = message.payload;
        userManager.SetGameConfig(roomId, gameConfig);
    }
    if (message.type == SupportedMessage.QuitBattle) {
        const { roomId, userId } = message.payload;
        userManager.QuitBattle(roomId, userId);
    }
}
