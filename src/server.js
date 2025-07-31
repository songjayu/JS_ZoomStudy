import express from "express";
import http from "http";
import socketIO from "socket.io";

const app = express();
app.set("view engine", "pug");
app.set("views", __dirname + "/views");
app.use("/public", express.static(__dirname + "/public"));
app.get("/", (_, res) => res.render("home"));

const httpServer = http.createServer(app);
const wsServer = socketIO(httpServer);

wsServer.on("connection", (socket) => {
  socket.on("join_room", (roomName) => {
    socket.join(roomName);
    const room = wsServer.sockets.adapter.rooms.get(roomName);
    const userCount = room ? room.size : 0;
    if (userCount === 2) {
      socket.to(roomName).emit("welcome");
    }
  });

  socket.on("offer", (offer, roomName) => {
    socket.to(roomName).emit("offer", offer);
  });

  socket.on("answer", (answer, roomName) => {
    socket.to(roomName).emit("answer", answer);
  });

  socket.on("ice", (ice, roomName) => {
    socket.to(roomName).emit("ice", ice);
  });
});

const handleListen = () => console.log("Listening on http://localhost:3000");
httpServer.listen(3000, handleListen);
