import { infrai } from "./infrai_queue.js";

infrai.queue.create("ecommerce-notifications-setup")
  .then((queue) => console.log(JSON.stringify(queue, null, 2)))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
