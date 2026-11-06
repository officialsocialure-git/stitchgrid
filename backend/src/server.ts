import app from "./app";
import { env } from "./config/env";
import { prisma } from "./config/prisma";

const server = app.listen(env.PORT, () => console.info(`STITCHGRID API listening on port ${env.PORT}`));
const keepAlive = setInterval(() => {}, 1000 * 60 * 60);

async function shutdown(signal: string) {
  console.info(`Server shutting down via ${signal}...`);
  clearInterval(keepAlive);
  server.close(async () => { await prisma.$disconnect(); process.exit(0); });
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));