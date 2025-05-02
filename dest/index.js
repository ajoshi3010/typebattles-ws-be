"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const UserManager_1 = require("./UserManager");
const incomingMessages_1 = require("./messages/incomingMessages");

const wss = new ws_1.WebSocketServer({ port: 8081 });
const userManager = new UserManager_1.UserManager();

wss.on('listening', () => {
    console.log('Namaste🙏🏻! Server is Listening On Port 8081');
});

wss.on('connection', function connection(ws) {
    console.log("New Client Connected! ", ws.toString());
    ws.send('Namaste From Server🙏🏻');
    ws.on('error', console.error);
    ws.on('message', function message(data) {
        const message = JSON.parse(data.toString());
        messageHandler(ws, message);
    });
    ws.on('close', function close(code, reason) {
        console.log(`Client disconnected with code: ${code}, reason: ${JSON.stringify(reason)}`);
        // Perform cleanup or notify other clients if necessary
    });
});

function messageHandler(ws, message) {
    if (message.type == incomingMessages_1.SupportedMessage.AddRoom) {
        const userDetails = message.payload;
        userManager.addRoom(userDetails, ws);
    }
    if (message.type == incomingMessages_1.SupportedMessage.JoinRoom) {
        const { name, image, userId, roomId } = message.payload;
        userManager.addUser({ name, image, userId }, roomId, ws);
    }
    if (message.type == incomingMessages_1.SupportedMessage.VerifyUser) {
        const { userId, roomId } = message.payload;
        userManager.verifyUser(userId, roomId, ws);
    }
    if (message.type == incomingMessages_1.SupportedMessage.GetAndNotify) {
        const userDetails = message.payload;
        userManager.getAndNotify(userDetails, ws);
    }
    if (message.type == incomingMessages_1.SupportedMessage.CreateBattle) {
        const payload = message.payload;
        console.log(payload);
        userManager.createBattle(payload.roomId);
    }
    if (message.type == incomingMessages_1.SupportedMessage.StartBattle) {
        const payload = message.payload;
        userManager.startBattle(payload.roomId);
    }
    if (message.type == incomingMessages_1.SupportedMessage.UpdatePos) {
        const { roomId, userId, pos, name } = message.payload;
        userManager.updatePos(roomId, userId, pos, name);
    }
    if (message.type == incomingMessages_1.SupportedMessage.UpdateBattleInfo) {
        const { userId, battle_infoType } = message.payload;
        userManager.UpdateBattleInfo(userId, battle_infoType);
    }
    if (message.type == incomingMessages_1.SupportedMessage.NewBattle) {
        const { roomId } = message.payload;
        userManager.NewBattle(roomId);
    }
    if (message.type == incomingMessages_1.SupportedMessage.GameConfig) {
        const { roomId, gameConfig } = message.payload;
        userManager.SetGameConfig(roomId, gameConfig);
    }
    if (message.type == incomingMessages_1.SupportedMessage.QuitBattle) {
        const { roomId, userId } = message.payload;
        userManager.QuitBattle(roomId, userId);
    }
}
