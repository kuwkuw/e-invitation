import "dotenv/config";
import { buildApp } from "./app.js";
import { startDbSnapshots } from "./snapshot.js";

const app = await buildApp();

const port = Number(process.env.PORT ?? 3001);
try {
  await app.listen({ port, host: "0.0.0.0" });
  // Here rather than in buildApp(), so tests that build the app start no timer.
  startDbSnapshots(app.log);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
