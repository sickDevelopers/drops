import http from "http";
import {Client, Room} from "colyseus";
import {Field, FieldCol, GameState, Player} from "./state";
import {Globals} from "./global";
import {coreListeningSocket, coreSendingSocket} from "./ipc_sockets";
import {restoreTruncatedMessage} from "./message-handling";
import {PLAYERS_NUM} from "./const";


export class BattleRoom extends Room<GameState> {

    autoDispose = false;

    static playerIndex = 1;

    // When room is initialized
    async onCreate(options: any) {
        this.setState(new GameState());

        let lastRemainingToken = "";

        const socket = await coreListeningSocket
        socket.on('data', (data) => {

            // more than one message may be mixed on a single send due to how socket is buffered
            const incomingMessages = data.toString().split('\n');

            lastRemainingToken = restoreTruncatedMessage(incomingMessages, lastRemainingToken);

            // console.log(`incomingMessage`, incomingMessages)

            incomingMessages
                .filter(message => message.length > 0)
                .forEach(message => {

                    // remove trailing |
                    message = message.slice(0, -1);

                    // console.log(`message`, message)

                    if (message.startsWith("*players:")) {

                        this.state.time = (parseInt(this.state.time) - 1).toString();

                        const playersString = message.substring("*players:".length);
                        playersString.split('/')
                            .forEach(playerString => {

                                const parsedPlayer:any = JSON.parse(playerString);
                                let player:Player;
                                this.state.players.forEach((p, key) => {
                                    if (p.id === parsedPlayer.id) {
                                        player = p;
                                    }
                                });
                                
                                if (player) {
                                    player.resources = parsedPlayer.resources;
                                    player.score = parsedPlayer.owned_cells;
                                    player.development = parsedPlayer.development;
                                    player.milestones_reached = parsedPlayer.milestones_reached;
                                }

                            })

                        // send to viewwer
                        const viewerSocket = Globals.viewerSocket;
                        if (!viewerSocket) {
                            return;
                        }


                        const playersList = Object.values(this.state.players.toJSON());
                        viewerSocket.emit('players', playersList);
                        viewerSocket.emit('time', this.state.time);

                        return;

                    }

                    if (message.startsWith("*field:")) {

                        const viewerSocket = Globals.viewerSocket;

                        if (!viewerSocket) {
                            return;
                        }

                        viewerSocket.emit('field', message.substring("*field:".length));
                        return null;
                    }

                    if (message.startsWith("*endgame")) {
                        console.log('ENDGAME')
                        this.state.gameRunning = false;
                        this.broadcast('endgame');

                        this.state.players.clear();

                        this.presence.publish('battle_state', 'endgame');

                    }

                })


        })


        this.onMessage("action", (client: Client, message: String) => {

            const player = this.state.players.get(client.sessionId);

            coreSendingSocket.then(socket => {
                const toSend = `|${player.id}|(${message})`;
                console.log(`toSend`, toSend)
                socket.write(`${toSend}\n`);

            })

        })

        this.onMessage("identity", (client, data) => {

            const [sub, name, avatar] = data.split("#");
            console.log(`got player identity`, sub, name, avatar);

            let existingPlayer:Player;
            this.state.players.forEach((p, key) => {
                if (p.sub === sub) {
                    existingPlayer = p;
                }
            })
            

            if (existingPlayer) {

                console.log(`existingPlayer`, existingPlayer)
                this.state.players.set(client.sessionId, existingPlayer.clone());
                if (client.sessionId !== existingPlayer.sessionId) {
                    this.state.players.delete(existingPlayer.sessionId);
                }

                client.send('battle_start');

            } else {

                const player = new Player();
                player.id = BattleRoom.playerIndex++;
                player.sessionId = client.sessionId;
                player.name = name;
                player.avatar = avatar;
                player.sub = sub;
                player.connected = true;

                this.state.players.set(client.sessionId, player);

                client.send(this.state.players.size);

                if (this.state.players.size === PLAYERS_NUM) {
                    this.startGame();

                }

            }

        })

    }


    private startGame() {
        this.broadcast('battle_start');

        if (!this.state.gameRunning) {

            this.state.gameRunning = true;
            this.state.time = "600"

            const colors = [
                '#FF0000',
                '#00FF00',
                '#0000FF',
                '#FFFF00',
                '#FF00FF',
                '#00FFFF',
                '#A047C9ED',
                '#1C4620FF'
            ];

            let index = 0;
            this.state.players.forEach((p, key) => {
                p.color = colors[index % colors.length];
                index++;
            })

            coreSendingSocket.then(socket => {
                const playerIds = [];
                this.state.players.forEach(player => {
                    playerIds.push(player.id);
                })
                const startingString = `play:${playerIds.join('|')}`;
                console.log(`Starting game : ${startingString}`)
                socket.write(startingString);
            })
        }
    }

// Authorize client based on provided options before WebSocket handshake is complete
    onAuth(client: Client, options: any, request: http.IncomingMessage) {
        return true;
    }

    // When client successfully join the room
    async onJoin(client: Client, options: any, auth: any) {



    }

    // When a client leaves the room
    async onLeave(client: Client, consented: boolean) {
        const player = this.state.players.get(client.sessionId);
        player.connected = false;

        try {
            if (consented) {
                throw new Error("consented leave");
            }

            // allow disconnected client to reconnect into this room until 20 seconds
            await this.allowReconnection(client, 60);

            // client returned! let's re-activate it.
            player.connected = true;

        } catch (e) {
            console.log(`client disconnected nd removed`, player.sessionId);
        }

    }

    // Cleanup callback, called after there are no more clients in the room. (see `autoDispose`)
    onDispose() {
        console.log('onDispose battle');
    }



}

