const express = require('express');
const http = require('http');
const path = require('path');
const socketIo = require('socket.io');
const cookieParser = require('cookie-parser');
const fs = require('fs'); // To interact with the file system
const { parse } = require('cookie'); // To parse cookies in socket.io
const { v4: uuidv4 } = require('uuid'); // For generating unique IDs

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public', { maxAge: '1d', etag: false }));
app.use(cookieParser());

// In-memory store for items
let items = [];
const dataFilePath = path.join(__dirname, 'data.json');

const loadItems = () => {
    if (fs.existsSync(dataFilePath)) {
        items = JSON.parse(fs.readFileSync(dataFilePath, 'utf8')); 
    } else {
        items = [];
    }
};

const saveItems = () => {
    fs.writeFileSync(dataFilePath, JSON.stringify(items, null, 2), 'utf8');
};

loadItems(); // Load items initially

app.get('/data', (req, res) => {
    const username = req.cookies.username;
    const sessionId = req.cookies.sessionId || uuidv4();

    if (username && sessionId && connectedClients[username] === sessionId) {
        loadItems();
        res.json(items);
    } else {
        res.json([]);
    }
});

// Store connected clients by username with their session IDs
const connectedClients = {};

// Generate a unique session ID and set it in the cookies
app.get('/login', (req, res) => {
    const username = req.cookies.username;

    if (username) {
        const sessionId = req.cookies.sessionId || uuidv4(); // Generate new session ID if not present

        // Check if the username is already connected with a different session ID
        if (connectedClients[username] && connectedClients[username] !== sessionId) {
            res.redirect('/?message=username already connected');
        } else {
            // Set session ID cookie and add to connected clients
            res.cookie('sessionId', sessionId, { httpOnly: true });
            connectedClients[username] = sessionId;
            res.redirect('/');
        }
    } else {
        res.redirect('/?message=username wrong');
    }
});

// Logout user and remove them from connected clients
app.get('/logout', (req, res) => {
    const username = req.cookies.username;
    const sessionId = req.cookies.sessionId;

    if (username && sessionId && connectedClients[username] === sessionId) {
        delete connectedClients[username]; // Remove from connected clients
    }
    res.clearCookie('username');
    res.clearCookie('sessionId');
    res.redirect('/?message=disconnected');
});

app.get('/', (req, res) => {
    const username = req.cookies.username;
    const sessionId = req.cookies.sessionId;

    console.log(connectedClients);

    if (username && sessionId && connectedClients[username] === sessionId) {
        res.sendFile(path.join(__dirname, 'public/filter.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public/login.html'));
    }
});

io.on('connection', (socket) => {
    console.log('A client connected');

    // Parse cookies from the socket
    const cookies = parse(socket.request.headers.cookie || '');
    const username = cookies.username;
    const sessionId = cookies.sessionId;

    if (username && sessionId && connectedClients[username] === sessionId) {
        socket.emit('initialData', items);

        socket.on('itemAction', (data) => {
            const { id, editor, action } = data;

            // Find item
            let item = items.conflits?.find(item => item.id === id) ||
                       items.itemsNew?.others?.find(item => item.id === id) ||
                       items.itemsNew?.familliers?.find(item => item.id === id) ||
                       items.itemsNew?.harnachs?.find(item => item.id === id);

            if (item) {
                if (action === 'add') {
                    item.status = 'active';
                } else if (action === 'remove') {
                    item.status = 'disabled';
                }

                item.editor = username; // Use the parsed username

                // Save the updated items to the JSON file
                saveItems();

                console.log("(RCV) update:", item.editor, item.name);

                // Broadcast the updated item to all clients
                io.emit('updateGrid', { id, username, action });
            }
        });

        socket.on('disconnect', () => {
            console.log('A client disconnected');
        });
    } else {
        socket.disconnect(); // Disconnect if no valid username and session ID is found
    }
});

server.listen(80, () => {
    console.log('Server is running on http://localhost:80');
});
