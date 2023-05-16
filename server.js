const { Console } = require('console');
const WebSocket = require('ws');
let clientIDCounter = 0;

// Vytvoření WebSocket serveru
const wss = new WebSocket.Server({ port: 12342 });
wss.on('listening', () => {
    const address = wss.address();
    const hostname = address.address;
    const port = address.port;

    console.log(`Server běží na adrese: ${hostname} a portu: ${port}`);
});

wss.on('error', (error) => {
    console.error('Chyba při spouštění serveru:', error.message);
});

console.log('Server byl úspěšně spuštěn.');

// Pole pro uchování připojených klientů
const connectedClients = [];

// Funkce pro odeslání zprávy všem připojeným klientům
function sendMessageToAllClients(message) {
    connectedClients.forEach(client => {
        client.ws.send(message);
    });
}
function broadcastClientUpdateMessage() {
    const clientUpdateMessage = {
        command: 'updateClients',
        clients: []
    };

    connectedClients.forEach(client => {
        const clientInfo = {
            id: client.id,
            name: client.name,
            ip: client.ip
        };
        clientUpdateMessage.clients.push(clientInfo);
    });

    connectedClients.forEach(client => {
        client.ws.send(JSON.stringify(clientUpdateMessage));
    });
}
function sendMessageToAllClientsWithInfo(clientInfo, message) {
    const infoMessage = {
        command: 'publicMessage',
        senderID: clientInfo.id,
        senderIP: clientInfo.ip,
        senderName: clientInfo.name,
        message: message
    };

    connectedClients.forEach(client => {
        client.ws.send(JSON.stringify(infoMessage));
    });
}
function sendPrivateMessage(clientID, message, senderInfo) {
    if (!senderInfo || !senderInfo.id || !senderInfo.name || !senderInfo.ip) {
        console.log('Neplatné informace o odesílateli.');
        return;
    }

    const client = connectedClients.find(client => client.id == clientID);
    if (!client) {
        console.log('Klient s ID ' + clientID + ' nebyl nalezen.');
        return;
    }

    const privateMessage = {
        command: 'privateMessage',
        senderID: senderInfo.id,
        senderName: senderInfo.name,
        recipientName: client.name,
        senderIP: senderInfo.ip,
        message: message
    };


    client.ws.send(JSON.stringify(privateMessage));

    const senderC = connectedClients.find(client => client.id == senderInfo.id);
    if (senderC) {
        senderC.ws.send(JSON.stringify(privateMessage));
    }
}

function sendSystemMessage(message, clientID) {
    const systemMessage = {
        command: 'systemMessage',
        senderID: clientID,
        senderName: 'server',
        message: message
    };

    if (clientID) {
        // Odeslat systémovou zprávu konkrétnímu klientovi
        const client = connectedClients.find(client => client.id == clientID);
        if (client) {
            client.ws.send(JSON.stringify(systemMessage));
        }
    } else {
        // Odeslat systémovou zprávu všem klientům
        connectedClients.forEach(client => {
            client.ws.send(JSON.stringify(systemMessage));
        });
    }
}

// Obsluha připojení klienta
wss.on('connection', function connection(ws, req) {
    // Uložení informací o klientovi
    const clientID = ++clientIDCounter;
    const clientInfo = {
        id: clientID,
        ip: req.connection.remoteAddress,
        ws: ws,
        name: "name"
        // Další informace o klientovi můžete přidat podle potřeby
    };

    // Přidání klienta do pole připojených klientů
    connectedClients.push(clientInfo);

    // Odeslání zprávy o novém klientovi všem připojeným klientům
    sendMessageToAllClients(`Nový klient se připojil: ${clientInfo.ip}`);
    sendSystemMessage(`Nový klient se připojil: ${clientInfo.id} - ${clientInfo.name} - ${clientInfo.ip}`);

    // Odeslání ID klienta připojenému klientovi
    ws.send(`Tvoje ID: ${clientID}`);


    broadcastClientUpdateMessage();

    // Obsluha zpráv od klienta
    ws.on('message', function incoming(data) {
        console.log(`Client ${clientInfo.id} Message: ${data}`);
        try {
            const parsedData = JSON.parse(data);
            const command = parsedData.command;

            switch (command) {
                case 'privateMessage': {
                    const recipientID = parsedData.recipientID;
                    const message = parsedData.message.trim();

                    if (message == "") return;
                    console.log(`Client ${clientInfo.id} sent private message to ${recipientID}: ${message}`);
                    // Další logika pro zpracování soukromé zprávy

                    if (recipientID !== undefined && message !== undefined && clientInfo !== undefined && clientInfo.id !== undefined && clientInfo.name !== undefined && clientInfo.ip !== undefined) {
                        sendPrivateMessage(recipientID, message, clientInfo);
                    } else {
                        console.log(`Invalid data received from client ${clientInfo.id}`);
                    }
                    break;
                }
                case 'requestConnectedClients': {
                    console.log(`Client ${clientInfo.id} requested connected clients information`);
                    // Logika pro zpracování žádosti o informace o připojených klientech
                    break;
                }
                case 'setUsername': {
                    console.log(`Client ${clientInfo.id} requested name change`);
                    if (clientInfo !== undefined && clientInfo.name !== undefined && parsedData !== undefined && parsedData.username !== undefined) {

                        clientInfo.name = parsedData.username.trim();
                        console.log(`Client se přejmenoval na : ${parsedData.username}`);
                        // Logika pro zpracování žádosti o informace o připojených klientech
                    } else {
                        console.log(`Invalid data received from client ${parsedData.username}`);
                    }

                    broadcastClientUpdateMessage();
                    break;
                }
                case 'broadcastMessage': {
                    const message = parsedData.message.trim();
                    if (message == "") return;
                    console.log(`Client ${clientInfo.id} sent a broadcast message: ${message}`);
                    if (message !== undefined && clientInfo !== undefined && clientInfo.id !== undefined && clientInfo.name !== undefined && clientInfo.ip !== undefined) {
                        sendMessageToAllClientsWithInfo(clientInfo, message);
                    } else {
                        console.log(`Invalid data received from client ${clientInfo.id}`);
                    }
                    // Další logika pro zpracování odeslání zprávy všem klientům
                    break;
                }
                default:
                    console.log(`Invalid command received from client ${clientInfo.id}`);
            }
        } catch (error) {
            console.error(`Error parsing client message: ${error}`);
        }
    });

    // Odpojení klienta
    ws.on('close', function close() {
        // Odstranění klienta z pole připojených klientů
        for (let i = 0; i < connectedClients.length; i++) {
            if (connectedClients[i].ws === ws) {
                var clientInfox = connectedClients[i];
                sendSystemMessage(`Klient ${clientInfox.id} - ${clientInfox.name} - ${clientInfox.ip} opustil místnost. `);
                connectedClients.splice(i, 1);
                break;
            }
        }


        broadcastClientUpdateMessage();
    });
});
