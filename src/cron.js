import cron from "node-cron";
import main from "./main.js";

console.log("Tarea programada");
const a = cron.schedule("* 40 18 * * *", async () => {
    await main.book();
});
