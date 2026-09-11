const net = require("net")
let connectedClients = [];

/**
 * Memulai TCP Server pada localhost
 * @param {number} port 
 */
function startTcpServer(port = 5006) {
    const server = net.createServer((Socket) => {
        console.log("[TCP Server] Overlay GUI terhubung!");
        connectedClients.push(Socket);
        Socket.on("close", () => {
            console.log("[TCP Server] Overlay GUI Terputus");
            connectedClients = connectedClients.filter(s => s !== Socket);
        })
        Socket.on("error", (err) => {
            console.log("[TCP Server] Error pada koneksi");
            connectedClients = connectedClients.filter(s => s !== Socket);
        })
    })
    server.listen(port, "127.0.0.1", () => {
        console.log(`[TCP Server] Mendengarkan di 127.0.0.1:${port}`);
    })
    return server;
}
/**
 * Mengirim data status ke seluruh client yang terhubung
 * @param {object} statusData 
 */
function broadcastOverlayStatus(statusData) {
    // Tambahkan \n di akhir JSON sebagai batas pembacaan (delimited-line framing)
    const payload = JSON.stringify(statusData) + "\n";

    connectedClients.forEach((socket) => {
        if (socket.writable) {
            socket.write(payload);
        }
    });
}

module.exports = {
    startTcpServer,
    broadcastOverlayStatus,
};