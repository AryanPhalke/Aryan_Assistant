# Scaling Aryan Assistant to 1 million users

## Current architecture

![Current architecture with six numbered bottlenecks](current-architecture.svg)

## Scaled for 1 million users

![Scaled architecture with the six numbered fixes](scaled-1m-architecture.svg)

---

## 2-minute answer (about 310 words, at a steady pace)

> **[Opening: 15 seconds]**
> "Aryan Assistant is a multi-agent chatbot. A gateway sits in front of three
> Node services: auth, chat and agent. In the agent service, a LangGraph router
> picks one of six agents, such as chat, search, coding or PDF, and the reply
> streams back over Server-Sent Events. Sessions live in Redis, messages in
> MongoDB and generated files in S3."
>
> **[Sizing: 20 seconds]**
> "Before changing anything, I'd size the problem. A million users is about
> 100,000 active a day. That's around a million messages a day, roughly 100 a
> second at peak, and about 2,000 open streams at once. The web tier handles
> that easily. The real limits are LLM rate limits and cost, at around 2 billion
> tokens a day, and the heavy PDF rendering."
>
> **[The fixes: 70 seconds]**
> "So I'd make five changes.
>
> **One:** the services already keep no state in memory, so I'd put a load
> balancer in front and run many copies of each service on Kubernetes. The
> agent service would autoscale on open streams, not CPU.
>
> **Two:** all LLM calls would go through an LLM gateway. It holds a pool of
> keys, switches to Gemini or OpenRouter when Groq returns a 429, and enforces
> a token quota per user.
>
> **Three:** cut the tokens. Instead of sending the last 20 messages every
> time, I'd send a summary plus the most recent few, and cache prompts and
> repeated answers.
>
> **Four:** PDF and PowerPoint rendering moves out of the agent service onto a
> job queue, with separate Puppeteer workers. A burst of PDF requests can then
> never slow down normal chat.
>
> **Five:** take the database off the critical path. History is read from
> Redis, messages are saved asynchronously through the queue, MongoDB becomes
> a replica set sharded by user, and Redis becomes a cluster."
>
> **[Close: 15 seconds]**
> "Finally, I'd monitor time to first token and cost per user. So the
> architecture already scales out. Getting to a million users is mostly about
> controlling LLM cost and moving heavy work off the request path."

---

## Delivery tips

- Share the **current** diagram while you speak the opening and sizing, then
  switch to the **scaled** one for the fixes. The numbers 1 to 6 match on
  both, so you can point at them.
- Say "here's how I *would* scale it". Don't claim you've already run it at
  this scale.
- If you're cut short, the **sizing** and **LLM gateway** parts matter most:
  they show you know where the real bottleneck is.

## Likely follow-up questions

| Question | Short answer |
| --- | --- |
| Why SSE, not WebSockets? | Traffic only goes server → client. SSE is plain HTTP, so it works through load balancers and reconnects on its own. Stop just closes the connection. |
| What breaks first? | LLM rate limits (429s), then Puppeteer memory on the agent pods. |
| How do you control cost? | Route to the cheapest model that can do the job, summarise history, cache answers, and enforce per-user token quotas. |
| Why shard MongoDB by userId? | Every query is "this user's conversations", so each one stays on a single shard. |
| Why microservices at this size? | The agent service needs very different resources from auth and chat, so each part scales on its own. The cost is extra network hops, which fix 3 removes. |
| How do you know it works? | Load-test with k6 using simulated SSE streams, and watch p95 time to first token and 429 rates on a dashboard. |
