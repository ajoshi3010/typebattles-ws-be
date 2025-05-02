"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserManager = void 0;
const generate_unique_id_1 = __importDefault(require("generate-unique-id"));
const common_json_1 = __importDefault(require("./words/common.json"));
const getId = () => {
    var id = (0, generate_unique_id_1.default)({
        length: 4,
        useLetters: true,
        useNumbers: true,
    });
    return id.toUpperCase();
};
class UserManager {
    constructor() {
        this.rooms = new Map();
        this.user_to_battleinfo = new Map();
        this.waitingUsers = new Map();
    }
    isRoom(roomId) {
        return this.rooms.has(roomId);
    }
    addRoom(userDetails, socket) {
        const { name, userId } = userDetails;
        const id = getId();
        const roomId = id.toString();
        this.waitingUsers.set(roomId, []);
        this.rooms.set(roomId, {
            admin: { id: userId, name: name },
            users: [],
            battle_info: { duration: 30000, words: "", started: false, gameConfig: [{ section: "section2", text: "time" }, { section: 'section3', text: '60' }] }
        });
        this.addUser(userDetails, roomId, socket);
    }
    addUser(userDetails, roomId, socket) {
        const { userId, name, image } = userDetails;
        if (!this.isRoom(roomId)) {
            socket.send(JSON.stringify({
                type: 'err',
                msg: `Room with RoomId ${roomId} Doesn't Exist!`
            }));
            return;
        }
        this.user_to_battleinfo.set(userId, {
            tot_chars_typed: 0,
            crct_chars_typed: 0,
            wrng_chars_typed: 0,
        });
        const room = this.rooms.get(roomId);
        room === null || room === void 0 ? void 0 : room.users.push({
            conn: socket,
            id: userId,
            name: name,
            image: image,
        });
        socket.send(JSON.stringify({
            type: "ROOM_ADDED",
            payload: {
                userId: userId,
                roomId: roomId
            }
        }));
    }
    verifyUser(userId, roomId, ws) {
        var _a;
        const room = this.rooms.get(roomId);
        if (!(room === null || room === void 0 ? void 0 : room.battle_info.started)) {
            if (!room) {
                ws.send(JSON.stringify({ type: "VERIFY_USER", payload: { exist: false } }));
                return;
            }
            const chk = room.users.find((u) => u.id === userId);
            if (!chk) {
                ws.send(JSON.stringify({ type: "VERIFY_USER", payload: { exist: false } }));
                return;
            }
            ws.send(JSON.stringify({ type: "VERIFY_USER", payload: { exist: true, admin: room.admin, battleInfo: room.battle_info } }));
        }
        else {
            (_a = this.waitingUsers.get(roomId)) === null || _a === void 0 ? void 0 : _a.push(userId);
        }
    }
    getAndNotify(userDetails, ws) {
        const { roomId, userId, name, image } = userDetails;
        const room = this.rooms.get(roomId);
        const newUserMsg = {
            type: "USERS",
            payload: {
                id: userId,
                name: name,
                image: image,
            }
        };
        if (room) {
            room.users.forEach(({ name, id, image, conn }) => {
                if (id != userId) {
                    conn.send(JSON.stringify(newUserMsg));
                    ws.send(JSON.stringify({
                        type: "USERS",
                        payload: {
                            id: id,
                            name: name,
                            image: image,
                        }
                    }));
                }
            });
        }
    }
    createBattle(roomId) {
        const room = this.rooms.get(roomId);
        if (!room)
            return;
        const testDuration = room.battle_info.duration;
        var cnt = Math.floor((testDuration / 60) * 100);
        var words = "";
        while (cnt--) {
            const ind = Math.floor(Math.random() * 950);
            words += common_json_1.default[ind] + " ";
        }
        room.battle_info.words = words;
        const message = {
            type: "CREATE_BATTLE",
            payload: {
                words: words
            }
        };
        room.users.forEach(({ conn }) => {
            conn.send(JSON.stringify(message));
        });
    }
    startBattle(roomId) {
        const room = this.rooms.get(roomId);
        if (room) {
            room.battle_info.started = true;
            const testDuration = room.battle_info.duration;
            room === null || room === void 0 ? void 0 : room.users.forEach(({ conn }) => {
                conn.send(JSON.stringify({ type: `START_BATTLE` }));
            });
            setTimeout(() => {
                this.getResults(roomId, testDuration);
            }, (testDuration * 1000) + 3000);
        }
    }
    updatePos(roomId, userId, pos, name) {
        const room = this.rooms.get(roomId);
        const waitingUsers = this.waitingUsers.get(roomId);
        room === null || room === void 0 ? void 0 : room.users.forEach(({ conn, id }) => {
            if (!(waitingUsers === null || waitingUsers === void 0 ? void 0 : waitingUsers.includes(id))) {
                if (userId !== id) {
                    conn.send(JSON.stringify({
                        type: 'UPDATE_POS',
                        payload: {
                            name: name,
                            pos: pos,
                        }
                    }));
                }
            }
        });
    }
    getResults(roomId, testDuration) {
        const room = this.rooms.get(roomId);
        const getResult = ({ tot_chars_typed, crct_chars_typed, wrng_chars_typed }) => {
            const wpm = testDuration == 0 ? 0 : tot_chars_typed / (5 * (testDuration / 60));
            const acc = tot_chars_typed == 0 ? 0 : (crct_chars_typed / tot_chars_typed) * 100;
            const netWpm = wpm * (acc / 100);
            return {
                netWpm: Math.round(netWpm),
                acc: Math.round(acc),
                tot_chars_typed: tot_chars_typed,
                crct_chars_typed: crct_chars_typed,
                wrng_chars_typed: wrng_chars_typed,
            };
        };
        var resArray = [];
        const waitingUsers = this.waitingUsers.get(roomId);
        room === null || room === void 0 ? void 0 : room.users.forEach(({ id, name, image }) => {
            if (!(waitingUsers === null || waitingUsers === void 0 ? void 0 : waitingUsers.includes(id))) {
                const curBattleInfo = this.user_to_battleinfo.get(id);
                var curResult = getResult(curBattleInfo);
                curResult.id = id;
                curResult.name = name;
                curResult.image = image;
                resArray.push(curResult);
            }
        });
        room === null || room === void 0 ? void 0 : room.users.forEach(({ conn, id }) => {
            if (!(waitingUsers === null || waitingUsers === void 0 ? void 0 : waitingUsers.includes(id))) {
                conn.send(JSON.stringify({ type: 'RESULT', result: resArray }));
            }
        });
    }
    UpdateBattleInfo(userId, battle_infoType) {
        const battle_info = this.user_to_battleinfo.get(userId);
        if (battle_info) {
            battle_info.tot_chars_typed++;
            if (battle_infoType == 'wrng_chars_typed')
                battle_info.wrng_chars_typed++;
            else if (battle_infoType == 'crct_chars_typed')
                battle_info.crct_chars_typed++;
        }
    }
    NewBattle(roomId) {
        const room = this.rooms.get(roomId);
        if (room) {
            room.battle_info.started = false;
            const waitingUsers = this.waitingUsers.get(roomId);
            console.log(waitingUsers);
            room.users.forEach(({ id, name, conn }) => {
                if (waitingUsers === null || waitingUsers === void 0 ? void 0 : waitingUsers.includes(id)) {
                    console.log(name);
                    this.verifyUser(id, roomId, conn);
                    this.waitingUsers.set(roomId, waitingUsers.filter(userId => userId !== id));
                }
                this.user_to_battleinfo.set(id, {
                    tot_chars_typed: 0,
                    crct_chars_typed: 0,
                    wrng_chars_typed: 0,
                });
            });
            room.battle_info.words = "";
            room.users.forEach(({ conn }) => {
                conn.send(JSON.stringify({ type: "NEW_BATTLE" }));
            });
        }
    }
    SetGameConfig(roomId, gameConfig) {
        const room = this.rooms.get(roomId);
        if (room) {
            const val = gameConfig.find((item) => item.section === 'section3');
            if (val) {
                const testDuration = Number(val === null || val === void 0 ? void 0 : val.text);
                room.battle_info.duration = testDuration;
            }
            room.battle_info.gameConfig = gameConfig;
            room.users.forEach(({ conn }) => {
                conn.send(JSON.stringify({
                    type: "GAME_CONFIG",
                    payload: {
                        gameConfig: gameConfig
                    }
                }));
            });
        }
    }
    QuitBattle(roomId, userId) {
        const room = this.rooms.get(roomId);
        if (room) {
            const userIndex = room.users.findIndex(user => user.id === userId);
            if (userIndex !== -1) {
                const msg = {
                    type: "USER_LEFT",
                    payload: {
                        userId: userId
                    }
                };
                const waitingUsers = this.waitingUsers.get(roomId);
                room.users.forEach(({ id, conn }) => {
                    if (!(waitingUsers === null || waitingUsers === void 0 ? void 0 : waitingUsers.includes(id))) {
                        conn.send(JSON.stringify(msg));
                    }
                });
                room.users.splice(userIndex, 1);
                if (room.admin.id == userId) {
                    this.rooms.delete(roomId);
                }
            }
        }
    }
}
exports.UserManager = UserManager;
