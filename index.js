let express = require('express');
let app = express();
let server = require('http').createServer(app);
let io = require('socket.io').listen(server);

server.listen(3000);

app.get('/', function (request, respons) {
    respons.sendFile(__dirname + '/index.html');
});

let connections = [];
let clients = {};
let updateCount = 0;
const P = 25;
const G = 2;
const ONE = 1;
const USER_INDEX = 6;
const ZERO = 0;
const UPDATE_KEY_TIMEOUT = 5000;

io.sockets.on('connection', function (socket) {

    console.log("User connected success");

    connections.push(socket);

    let userId = "Client" + (connections.length - ONE);
    socket.emit('getPublicKeys', {p: P, g: G, id: userId, sockId: socket.id});

    socket.on('disconnect', function (data) {
        let disconnectClient = getDisconnectedClient();
        delete clients[disconnectClient];
        connections.splice(connections.indexOf(socket), ONE);
        updateCount--;
        console.log("User disconnected");
    });

    function getDisconnectedClient() {
        for (let client in clients) {
            if (clients[client]['sockId'] === socket.id) {
                return client;
            }
        }
    }

    socket.on('send mess', function (data) {
        console.log("[" + data.name + "]: " + data.mess);
        io.sockets.emit('add mess', {mess: data.mess, name: data.name, className: data.className});
    });

    socket.on('updateKeys', function (data) {
        updateCount++;
        clients[data.id] = {
            sockId: data.sockId,
            newKey: data.newKey
        };
        console.log(clients);
        socket.join(data.id);
        let tempCounter = updateCount;
        console.log("Update counter: " + updateCount);
        console.log("Connection length: " + connections.length);
        setTimeout(function () {
            while (tempCounter === connections.length) {
                for (let client in clients) {
                    let nextId = 0;
                    let currentId = parseInt(client.charAt(USER_INDEX));
                    nextId = (currentId + ONE) % connections.length;
                    console.log('Calculate next public key ' + ' from Client' + currentId + ' sent to ' + 'Client' + nextId);
                    io.sockets.in('Client' + nextId).emit('CalculateNextNewKey', {
                        newKey: clients[client]['newKey'],
                        userCounter: ZERO,
                        clientId: 'Client' + currentId,
                        nextClientId: 'Client' + nextId
                    })
                }
                tempCounter = ZERO
            }
        }, UPDATE_KEY_TIMEOUT)
    });

    socket.on('nextClient', function (data) {
        const client = 'Client';
        let newKey = data.newKey;
        let userCounter = data.userCounter;
        let clientId = data.clientId;
        let clientNumber = parseInt(clientId.charAt(USER_INDEX));
        console.log("clientNumber : " + clientNumber);
        console.log("UserCounter: " + userCounter);
        console.log("Connections length: " + connections.length);
        if (userCounter === connections.length - ONE) {
            console.log("New public key: " + newKey);
            io.sockets.in(client + clientNumber).emit('GetEncryptInfo', {newKey: newKey, clientId: clientId});
        } else {
            let nextId = (clientNumber + ONE) % connections.length;
            console.log(connections.length);
            console.log('Calculate next public key from Client' + clientId + ' sent to ' + 'Client' + nextId);
            calculateNextNewKey(client, nextId, newKey, userCounter, clientId);
        }
    });

    function calculateNextNewKey(client, nextId, newKey, userCounter, clientId) {
        io.sockets.in(client + nextId).emit('CalculateNextNewKey', {
            newKey: newKey,
            userCounter: userCounter,
            clientId: clientId,
            nextClientId: client + nextId
        });
    }

});
