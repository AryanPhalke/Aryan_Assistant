import Redis from "ioredis";

// Shared Redis client, imported by both the gateway (reads sessions) and the
// auth service (creates/deletes sessions). REDIS_URL looks like redis://localhost:6379
// and points at the container started by docker-compose.yml.
const redis = new Redis(process.env.REDIS_URL);

redis.on("connect", () => {
  console.log("[redis] Connected");
});

// Without this listener, ioredis keeps retrying silently when Redis is down
redis.on("error", (error) => {
  console.error("[redis] Connection error:", error.message);
});

export default redis;
