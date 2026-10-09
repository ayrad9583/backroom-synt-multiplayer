const http = require("http");
const crypto = require("crypto");
const WebSocket = require("ws");

const PORT = Number(process.env.PORT || 8080);
const MAX_ROOMS = Number(process.env.MAX_ROOMS || 100);
const MAX_PLAYERS_PER_ROOM = 4;
const rooms = new Map();
const clients = new Map();

const server = http.createServer((req, res) => {
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, {"content-type":"application/json; charset=utf-8", "cache-control":"no-store"});
    res.end(JSON.stringify({ok:true,service:"Backrooms SYNT public-room server",rooms:rooms.size,players:clients.size}));
    return;
  }
  res.writeHead(404, {"content-type":"application/json; charset=utf-8"});
  res.end(JSON.stringify({error:"Not found"}));
});
const wss = new WebSocket.Server({server, maxPayload: 16 * 1024});

function send(ws, data) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}
function broadcastRoom(room, data, except = null) {
  for (const id of room.players) {
    const client = clients.get(id);
    if (client && client.ws !== except) send(client.ws, data);
  }
}
function publicRooms() {
  return [...rooms.values()]
    .filter(r => r.isPublic && r.players.size > 0)
    .map(r => ({id:r.id, name:r.name, players:r.players.size, maxPlayers:r.maxPlayers, full:r.players.size >= r.maxPlayers}))
    .sort((a,b) => a.name.localeCompare(b.name));
}
function broadcastRoomList() {
  const message = {type:"rooms", rooms:publicRooms()};
  for (const client of clients.values()) send(client.ws, message);
}
function leaveRoom(client, notify = true) {
  if (!client.roomId) return;
  const room = rooms.get(client.roomId);
  const oldId = client.roomId;
  client.roomId = null;
  if (!room) return;
  room.players.delete(client.id);
  if (notify) broadcastRoom(room, {type:"playerLeft", id:client.id, name:client.name});
  if (room.players.size === 0 || room.hostId === client.id) {
    if (room.hostId === client.id) broadcastRoom(room, {type:"roomClosed"});
    rooms.delete(oldId);
  }
  broadcastRoomList();
}
function safeName(v, fallback, max) {
  return String(v || fallback).replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0,max) || fallback;
}
wss.on("connection", ws => {
  const id = crypto.randomUUID();
  const client = {id, ws, name:"Joueur", roomId:null};
  clients.set(id, client);
  send(ws, {type:"identity", id});
  send(ws, {type:"rooms", rooms:publicRooms()});

  ws.on("message", raw => {
    let data;
    try { data = JSON.parse(raw.toString()); } catch { return; }
    if (!data || typeof data.type !== "string") return;

    if (data.type === "identify") {
      client.name = safeName(data.name, "Joueur", 18);
      return;
    }
    if (data.type === "list") {
      send(ws, {type:"rooms", rooms:publicRooms()});
      return;
    }
    if (data.type === "create") {
      if (rooms.size >= MAX_ROOMS) { send(ws,{type:"error",message:"Le serveur a atteint sa limite de salons."}); return; }
      leaveRoom(client);
      const room = {
        id: crypto.randomBytes(5).toString("hex").toUpperCase(),
        name: safeName(data.name, "Expédition Backrooms", 28),
        maxPlayers: Math.max(2, Math.min(MAX_PLAYERS_PER_ROOM, Number(data.maxPlayers)||4)),
        isPublic: data.isPublic !== false,
        hostId: client.id,
        players: new Set([client.id])
      };
      rooms.set(room.id, room);
      client.roomId = room.id;
      send(ws, {type:"roomCreated",room:{id:room.id,name:room.name,players:1,maxPlayers:room.maxPlayers},players:[{id:client.id,name:client.name}]});
      broadcastRoomList();
      return;
    }
    if (data.type === "join") {
      const room = rooms.get(String(data.roomId||""));
      if (!room || !room.isPublic) { send(ws,{type:"error",message:"Ce salon n’existe plus."}); return; }
      if (room.players.size >= room.maxPlayers) { send(ws,{type:"error",message:"Ce salon est complet."}); return; }
      if (client.roomId === room.id) return;
      leaveRoom(client);
      const existing = [...room.players].map(pid => { const p=clients.get(pid); return p?{id:p.id,name:p.name}:null; }).filter(Boolean);
      room.players.add(client.id);
      client.roomId = room.id;
      send(ws,{type:"joined",room:{id:room.id,name:room.name,players:room.players.size,maxPlayers:room.maxPlayers},players:existing});
      broadcastRoom(room,{type:"playerJoined",player:{id:client.id,name:client.name}},ws);
      broadcastRoomList();
      return;
    }
    if (data.type === "leave") {
      leaveRoom(client);
      send(ws,{type:"left"});
      return;
    }
    const room = client.roomId ? rooms.get(client.roomId) : null;
    if (!room) { send(ws,{type:"error",message:"Rejoins un salon avant cette action."}); return; }

    if (data.type === "state") {
      const payload = {
        type:"state", id:client.id, name:client.name,
        x:Number(data.x), z:Number(data.z), yaw:Number(data.yaw)||0,
        pitch:Number(data.pitch)||0, level:Number(data.level)||0,
        state:String(data.state||"")
      };
      if (![payload.x,payload.z,payload.yaw,payload.pitch,payload.level].every(Number.isFinite)) return;
      broadcastRoom(room,payload,ws);
    } else if (data.type === "chat") {
      const text = safeName(data.text, "", 180);
      if (!text) return;
      broadcastRoom(room,{type:"chat",id:client.id,name:client.name,text});
    }
  });

  ws.on("close", () => {
    leaveRoom(client);
    clients.delete(client.id);
    broadcastRoomList();
  });
  ws.on("error", () => {});
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Backrooms SYNT public-room server listening on port ${PORT}`);
});
