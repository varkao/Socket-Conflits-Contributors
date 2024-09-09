const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cookieParser = require('cookie-parser');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));
app.use(cookieParser());

app.get('/', (req, res) => {
    const username = req.cookies.username;
    res.sendFile(__dirname + '/public/index.html');
});

io.on('connection', (socket) => {
    console.log('A client connected');

    socket.on('usernameSet', (username) => {
        socket.cookie = { username };
    });

    socket.on('itemAction', (data) => {
        io.emit('updateGrid', data);
    });

    socket.on('disconnect', () => {
        console.log('A client disconnected');
    });
});

server.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});
