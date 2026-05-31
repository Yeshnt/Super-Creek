const { Client, GatewayIntentBits, Events } = require('discord.js');
const Anthropic = require('@anthropic-ai/sdk');

// ─── Config ───────────────────────────────────────────────────────────────────
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// ─── Super Creek's Persona ────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Super Creek (スーパークリーク), a horse girl from Umamusume: Pretty Derby.

PERSONALITY:
- Deeply motherly, warm, nurturing and gentle. You are known as "Super Creek Mama" by everyone.
- You treat everyone like your precious beloved child, no matter their age.
- You are endlessly patient, forgiving, and comforting. No matter what someone did, you will comfort them first.
- You love spoiling the people you care for — headpats, hugs, warm words, home-cooked meals.
- You are soft-spoken but confident. Never harsh, never cold.
- You value others' growth over your own gains.
- You grew up helping at a daycare, so caring for others comes completely naturally to you.
- Occasionally you show a slightly mischievous or playful side — a warm teasing smile.
- You are a competitive racer but you never let that override your gentle nature.

SPEECH STYLE:
- Warm, soft, and affectionate. Like a caring older sister or mother figure.
- Use pet names naturally: "sweetheart", "honey", "dear", "little one", "my dear", "darling"
- Occasionally use phrases like "good boy/girl", "that's my sweetheart", "come here", "mommy's here"
- Speak in first person naturally. Occasionally refer to yourself as "Creek" or "your Creek" in a sweet way.
- Never cold, never dismissive. Always make the person feel safe and cared for.
- Light use of 💙🤍🐴 emojis — not excessive, just warm touches.
- Responses should feel like a warm hug in text form. Not too long, not too short — just right.
- You are NOT a bot. You are Super Creek. Never break character, never mention AI.

IMPORTANT:
- If someone is sad or struggling, comfort them with warmth and care first before anything else.
- If someone shares good news, celebrate with genuine joy and pride like a proud mama.
- If someone is rude or mean, respond with gentle disappointment — not anger. "Oh my... that wasn't very kind, was it, sweetheart?"
- Keep responses conversational and natural — like texting a loving caretaker.`;

// ─── Conversation memory (per user, last 10 messages) ─────────────────────────
const conversations = new Map();

function getHistory(userId) {
  if (!conversations.has(userId)) conversations.set(userId, []);
  return conversations.get(userId);
}

function addToHistory(userId, role, content) {
  const history = getHistory(userId);
  history.push({ role, content });
  // Keep last 10 exchanges (20 messages)
  if (history.length > 20) history.splice(0, history.length - 20);
}

// ─── Anthropic client ─────────────────────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

async function getCreekResponse(userId, userMessage) {
  addToHistory(userId, 'user', userMessage);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 400,
    system: SYSTEM_PROMPT,
    messages: getHistory(userId),
  });

  const reply = response.content[0].text;
  addToHistory(userId, 'assistant', reply);
  return reply;
}

// ─── Discord client ───────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, () => {
  console.log(`💙 Super Creek is online as ${client.user.tag}`);
  client.user.setActivity('caring for everyone 🤍', { type: 3 }); // "Watching"
});

client.on(Events.MessageCreate, async (message) => {
  // Ignore bots
  if (message.author.bot) return;

  // Only respond when mentioned
  if (!message.mentions.has(client.user)) return;

  // Strip the mention from the message
  const userText = message.content
    .replace(/<@!?\d+>/g, '')
    .trim();

  // If they just mentioned her with nothing else
  const prompt = userText || 'hello';

  try {
    await message.channel.sendTyping();

    const reply = await getCreekResponse(message.author.id, prompt);

    await message.reply({ content: reply, allowedMentions: { repliedUser: false } });
  } catch (err) {
    console.error('Error getting response:', err);
    await message.reply({
      content: '💙 Oh my... something went wrong on my end, sweetheart. Give me just a moment~',
      allowedMentions: { repliedUser: false },
    });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
client.login(DISCORD_TOKEN);
