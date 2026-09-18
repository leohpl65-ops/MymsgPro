import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const server = require("../dist/index.cjs");

const app = server.default ?? server;
const ready = server.ready ?? Promise.resolve();

export default async function handler(req: any, res: any) {
  await ready;
  return app(req, res);
}