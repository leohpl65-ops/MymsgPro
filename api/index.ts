import app, { ready } from "../server/index.ts";

export default async function handler(req: any, res: any) {
  await ready;
  return app(req, res);
}