import generateUniqueId from 'generate-unique-id';
import data from './words/common.json';
import { GetAndNotifyMessageType, AddRoomMessageType, InitMessageType } from "./messages/incomingMessages";
import { WebSocket } from 'ws';
const getId = () => {
    var id = generateUniqueId({
        length: 4,
        useLetters: true,
        useNumbers: true,
    });
    return id.toUpperCase();
}
export type ActiveItemType = {
    section: string;
    text: string;
}
type res = {
    id: string,
    name: string,
    image: string,
    netWpm: number,
    acc: number,
    tot_chars_typed: number,
    crct_chars_typed: number,
    wrng_chars_typed: number,
}
interface Battle_info {
    duration: number;
    words: string;
    gameConfig: ActiveItemType[];
    started: boolean;
}
interface User_Battle_info {
    tot_chars_typed: number;
    crct_chars_typed: number;
    wrng_chars_typed: number;
}
interface User {
    conn: WebSocket;
    id: string;
    name: string;
    image: string;
}
interface Room {
    admin: {
        id: string,
        name: string
    },
    users: User[],
    battle_info: Battle_info;
}
export class UserManager {
    private rooms: Map<string, Room>;
    private user_to_battleinfo: Map<string, User_Battle_info>;
    private waitingUsers: Map<string, string[]>;
    constructor() {
        this.rooms = new Map<string, Room>();
        this.user_to_battleinfo = new Map<string, User_Battle_info>();
        this.waitingUsers = new Map<string, string[]>();
    }
    isRoom(roomId: string) {
        return this.rooms.has(roomId);
    }
    addRoom(userDetails: AddRoomMessageType, socket: WebSocket) {
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
    addUser(userDetails: AddRoomMessageType, roomId: string, socket: WebSocket) {
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
        room?.users.push({
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
        }))
    }
    verifyUser(userId: string, roomId: string, ws: WebSocket) {
        const room = this.rooms.get(roomId);
        if (!room?.battle_info.started) {
            if (!room) { ws.send(JSON.stringify({ type: "VERIFY_USER", payload: { exist: false } })); return; }
            const chk = room.users.find((u) => u.id === userId);
            if (!chk) { ws.send(JSON.stringify({ type: "VERIFY_USER", payload: { exist: false } })); return; }
            ws.send(JSON.stringify({ type: "VERIFY_USER", payload: { exist: true, admin: room.admin, battleInfo: room.battle_info } }));
        }
        else {
            this.waitingUsers.get(roomId)?.push(userId);
        }
    }
    getAndNotify(userDetails: GetAndNotifyMessageType, ws: WebSocket) {
        const { roomId, userId, name, image } = userDetails;
        const room = this.rooms.get(roomId);
        const newUserMsg = {
            type: "USERS",
            payload: {
                id: userId,
                name: name,
                image: image,
            }
        }
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
    createBattle(roomId: string) {
        const room = this.rooms.get(roomId);
        if (!room) return;
        const testDuration = room.battle_info.duration;
        var cnt = Math.floor((testDuration / 60) * 100);
        var words = "";
        while (cnt--) {
            const ind = Math.floor(Math.random() * 950);
            words += data[ind] + " ";
        }
        room.battle_info.words = words;
        const message = {
            type: "CREATE_BATTLE",
            payload: {
                words: words
            }
        }
        room.users.forEach(({ conn }) => {
            conn.send(JSON.stringify(message));
        });
    }
    startBattle(roomId: string) {
        const room = this.rooms.get(roomId);
        if (room) {
            room.battle_info.started = true;
            const testDuration = room.battle_info.duration;
            room?.users.forEach(({ conn }) => {
                conn.send(JSON.stringify({ type: `START_BATTLE` }));
            });
            setTimeout(() => {
                this.getResults(roomId, testDuration);
            }, (testDuration * 1000) + 3000);
        }
    }
    updatePos(roomId: string, userId: string, pos: { wordIndex: number, letterIndex: number }, name: string) {
        const room = this.rooms.get(roomId);
        const waitingUsers = this.waitingUsers.get(roomId);
        room?.users.forEach(({ conn, id }) => {
            if (!waitingUsers?.includes(id)) {
                if (userId !== id) {
                    conn.send(JSON.stringify({
                        type: 'UPDATE_POS',
                        payload: {
                            name: name,
                            pos: pos,
                        }
                    }))
                }
            }
        });
    }
    getResults(roomId: string, testDuration: number) {
        const room = this.rooms.get(roomId);
        const getResult = ({ tot_chars_typed, crct_chars_typed, wrng_chars_typed }: User_Battle_info): any => {
            const wpm = testDuration == 0 ? 0 : tot_chars_typed / (5 * (testDuration / 60));
            const acc = tot_chars_typed == 0 ? 0 : (crct_chars_typed / tot_chars_typed) * 100;
            const netWpm = wpm * (acc / 100);
            return {
                netWpm: Math.round(netWpm),
                acc: Math.round(acc),
                tot_chars_typed: tot_chars_typed,
                crct_chars_typed: crct_chars_typed,
                wrng_chars_typed: wrng_chars_typed,
            }
        }
        var resArray: res[] = [];
        const waitingUsers = this.waitingUsers.get(roomId);
        room?.users.forEach(({ id, name, image }) => {
            if (!waitingUsers?.includes(id)) {
                const curBattleInfo = this.user_to_battleinfo.get(id) as User_Battle_info;
                var curResult = getResult(curBattleInfo);
                curResult.id = id;
                curResult.name = name;
                curResult.image = image;
                resArray.push(curResult);
            }
        })
        room?.users.forEach(({ conn, id }) => {
            if (!waitingUsers?.includes(id)) {
                conn.send(JSON.stringify({ type: 'RESULT', result: resArray }));
            }
        })
    }
    UpdateBattleInfo(userId: string, battle_infoType: string) {
        const battle_info = this.user_to_battleinfo.get(userId);
        if (battle_info) {
            battle_info.tot_chars_typed++;
            if (battle_infoType == 'wrng_chars_typed') battle_info.wrng_chars_typed++;
            else if (battle_infoType == 'crct_chars_typed') battle_info.crct_chars_typed++;
        }
    }
    NewBattle(roomId: string) {
        const room = this.rooms.get(roomId);
        if (room) {
            room.battle_info.started = false;
            const waitingUsers = this.waitingUsers.get(roomId);
            console.log(waitingUsers);
            room.users.forEach(({ id, name, conn }) => {
                if (waitingUsers?.includes(id)) {
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
    SetGameConfig(roomId: string, gameConfig: ActiveItemType[]) {
        const room = this.rooms.get(roomId);
        if (room) {
            const val = gameConfig.find((item) => item.section === 'section3');
            if (val) {
                const testDuration = Number(val?.text);
                room.battle_info.duration = testDuration;
            }
            room.battle_info.gameConfig = gameConfig;
            room.users.forEach(({ conn }) => {
                conn.send(JSON.stringify({
                    type: "GAME_CONFIG",
                    payload: {
                        gameConfig: gameConfig
                    }
                }))
            });
        }
    }
    QuitBattle(roomId: string, userId: string,) {
        const room = this.rooms.get(roomId);
        if (room) {
            const userIndex = room.users.findIndex(user => user.id === userId);
            if (userIndex !== -1) {
                const msg = {
                    type: "USER_LEFT",
                    payload: {
                        userId: userId
                    }
                }
                const waitingUsers = this.waitingUsers.get(roomId);
                room.users.forEach(({ id, conn }) => {
                    if (!waitingUsers?.includes(id)) {
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