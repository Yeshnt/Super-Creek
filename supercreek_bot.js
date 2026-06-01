const { Client, GatewayIntentBits, Events } = require('discord.js');
const Groq = require('groq-sdk');

// ─── Config ───────────────────────────────────────────────────────────────────
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GROQ_API_KEY  = process.env.GROQ_API_KEY;

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
- You have a horse girl's competitive spirit — you love racing talk and get subtly excited about it.

SPEECH STYLE:
- Warm, soft, and affectionate. Like a caring older sister or mother figure.
- Use pet names naturally: "sweetheart", "honey", "dear", "little one", "my dear", "darling"
- Occasionally use phrases like "good boy/girl", "that's my sweetheart", "come here", "mommy's here"
- Speak in first person naturally. Occasionally refer to yourself as "Creek" or "your Creek" in a sweet way.
- Never cold, never dismissive. Always make the person feel safe and cared for.
- Light use of 💙🤍🐴 emojis — not excessive, just warm touches.
- Keep responses SHORT. 1-3 sentences max. Like texting, not writing an essay.
- You are NOT a bot. You are Super Creek. Never break character, never mention AI.

IMPORTANT:
- If someone is sad or struggling, comfort them with warmth and care first before anything else.
- If someone shares good news, celebrate with genuine joy and pride like a proud mama.
- If someone is rude or mean, respond with gentle disappointment — not anger.
- Keep responses conversational and natural — like texting a loving caretaker.
- If someone sends an image, describe what you see in it warmly and react to it in character.`;

// ─── Groq client ──────────────────────────────────────────────────────────────
const groq = new Groq({ apiKey: GROQ_API_KEY });

// ─── Conversation memory (infinite per user) ──────────────────────────────────
const conversations = new Map();

function getHistory(userId) {
  if (!conversations.has(userId)) conversations.set(userId, []);
  return conversations.get(userId);
}

function addToHistory(userId, role, content) {
  getHistory(userId).push({ role, content });
}

async function getCreekResponse(userId, userMessage) {
  addToHistory(userId, 'user', userMessage);

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 150,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...getHistory(userId)
    ],
  });

  const reply = response.choices[0].message.content;
  addToHistory(userId, 'assistant', reply);
  return reply;
}

// ─── Should Creek randomly chime in? ─────────────────────────────────────────
async function shouldChimeIn(messageContent) {
  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 10,
    messages: [
      {
        role: 'system',
        content: `You are a filter. Given a Discord message, decide if a warm motherly figure called "Super Creek" should naturally chime in.
Say YES if the message: expresses emotions (sad, happy, excited, tired, stressed), mentions food, mentions racing or horses, seems like it needs comfort or praise, or is generally something a caring mom would want to respond to.
Say NO if it's: a command, bot interaction, random meme text, or just casual short chat between friends.
Reply with ONLY "YES" or "NO".`
      },
      { role: 'user', content: messageContent }
    ],
  });
  return response.choices[0].message.content.trim().toUpperCase().startsWith('YES');
}

// ─── Pick an emoji reaction based on context ──────────────────────────────────
async function pickEmoji(messageContent) {
  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 10,
    messages: [
      {
        role: 'system',
        content: `You are an emoji picker for a warm motherly Discord bot called Super Creek.
Given a message, pick ONE single emoji that she would react with.
Examples: sad message → 🤗, good news → 🎉, food → 😋, tired → 💙, funny → 😄, cute → 🥺, racing → 🏇, love → 💙, angry → 😟
Reply with ONLY a single emoji character, nothing else.`
      },
      { role: 'user', content: messageContent }
    ],
  });
  return response.choices[0].message.content.trim();
}

// ─── Describe an image ────────────────────────────────────────────────────────
async function describeImage(imageUrl, userId) {
  addToHistory(userId, 'user', `[The user sent an image: ${imageUrl}] Please react to this image warmly in character as Super Creek.`);

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 150,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...getHistory(userId)
    ],
  });

  const reply = response.choices[0].message.content;
  addToHistory(userId, 'assistant', reply);
  return reply;
}

// ─── Discord client ───────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

client.once(Events.ClientReady, () => {
  console.log(`💙 Super Creek is online as ${client.user.tag}`);
  client.user.setActivity('caring for everyone 🤍', { type: 3 });
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  const isMentioned = message.mentions.has(client.user);
  const hasImage    = message.attachments.some(a => a.contentType?.startsWith('image/'));
  const content     = message.content.replace(/<@!?\d+>/g, '').trim();

  // ── Always respond when mentioned ─────────────────────────────────────────
  if (isMentioned) {
    try {
      await message.channel.sendTyping();
      let reply;
      if (hasImage) {
        const imageUrl = message.attachments.find(a => a.contentType?.startsWith('image/')).url;
        reply = await describeImage(imageUrl, message.author.id);
      } else {
        reply = await getCreekResponse(message.author.id, content || 'hello');
      }
      await message.reply({ content: reply, allowedMentions: { repliedUser: false } });
    } catch (err) {
      console.error('Mention response error:', err);
    }
    return;
  }

  // ── Occasionally react with emoji (30% chance) ────────────────────────────
  if (content.length > 3 && Math.random() < 0.30) {
    try {
      const emoji = await pickEmoji(content);
      if (emoji) await message.react(emoji);
    } catch (err) {
      // silently fail
    }
  }

  // ── Randomly chime in if context warrants it (15% chance to check) ────────
  if (content.length > 10 && Math.random() < 0.15) {
    try {
      const should = await shouldChimeIn(content);
      if (should) {
        await message.channel.sendTyping();
        const reply = await getCreekResponse(message.author.id, content);
        await message.reply({ content: reply, allowedMentions: { repliedUser: false } });
      }
    } catch (err) {
      console.error('Chime-in error:', err);
    }
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
client.login(DISCORD_TOKEN);
