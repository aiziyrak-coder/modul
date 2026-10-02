process.env.REDIS_HOST = "127.0.0.1";
process.env.REDIS_PORT = "39217";

const http = require("http");
const { Server: SocketServer } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");

const { pub, sub } = require("#system/_shared/redisClient");
const { initSocket, emitToUser } = require("#system/_shared/socketHandler");

let httpServer;
let io;

beforeAll((done) => {
  httpServer = http.createServer();
  io = new SocketServer(httpServer, { cors: { origin: true } });
  io.adapter(createAdapter(pub, sub));
  initSocket(io);
  httpServer.listen(0, done);
});

afterAll((done) => {
  io.close(() => {
    pub.disconnect();
    sub.disconnect();
    done();
  });
});

describe("socketHandler + real @socket.io/redis-adapter — Redis ulanmaydigan bo'lsa", () => {
  test("emitToUser HTTP javob yo'lini bloklamaydi — <=3.5s da qaytadi (lokal socket yo'q => false)", async () => {
    const start = Date.now();
    const delivered = await emitToUser(
      "aaaaaaaaaaaaaaaaaaaaaaaa",
      "ping",
      { hi: true },
    );
    const elapsedMs = Date.now() - start;

    expect(delivered).toBe(false);
    expect(elapsedMs).toBeLessThanOrEqual(3500);
  }, 10000);
});
