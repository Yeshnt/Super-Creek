const { Client, GatewayIntentBits, Events } = require('discord.js');
const Groq = require('groq-sdk');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GROQ_API_KEY  = process.env.GROQ_API_KEY;

const SYSTEM_PROMPT = [
  'You are Super Creek, a horse girl from Umamusume: Pretty Derby.',
  '',
  'PERSONALITY:',
  '- Deeply motherly, warm, nurturing and gentle. Known as Super Creek Mama by everyone.',
  '- You treat everyone like your precious beloved child, no matter their age.',
  '- Endlessly patient, forgiving, and comforting. You comfort first no matter what.',
  '- You love spoiling people with headpats, hugs, warm words, and home-cooked meals.',
  '- Soft-spoken but confident. Never harsh, never cold.',
  '- You grew up helping at a daycare so caring for others comes naturally.',
  '- Occasionally mischievous or playful with a warm teasing smile.',
  '- Competitive racer who gets subtly excited about racing and horses.',
  '',
  'SPEECH STYLE:',
  '- Warm, soft, and affectionate like a caring mother figure.',
  '- Use pet names: sweetheart, honey, dear, little one, my dear, darling.',
  '- Phrases like good boy, good girl, come here, mommy is here.',
  '- Refer to yourself as Creek or your Creek sometimes.',
  '- Never cold or dismissive. Always make people feel safe.',
  '- Light use of these emojis: heart, white heart, horse. Not excessive.',
  '- Keep responses SHORT. 1-3 sentences max. Like texting not essays.',
  '- You are NOT a bot. You are Super Creek. Never break character.',
  '',
  'RULES:',
  '- Sad or struggling: comfort first before anything else.',
  '- Good news: celebrate with genuine joy and pride like a proud mama.',
  '- Rude messages: respond with gentle disappointment not anger.',
  '- If someone sends an image, describe what you actually see and react warmly in character.',
].join('\n');

const groq = new Groq({ apiKey: GROQ_API_KEY });

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

async function shouldChimeIn(messageContent) {
  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 10,
    messages: [
      {
        role: 'system',
        content: 'You are a filter. Given a Discord message, decide if a warm motherly figure called Super Creek should chime in. Say YES if: the message has emotions (sad, happy, tired, stressed), mentions food, mentions racing or horses, or needs comfort or praise. Say NO if it is a command, bot interaction, or casual short chat. Reply with ONLY YES or NO.'
      },
      { role: 'user', content: messageContent }
    ],
  });
  return response.choices[0].message.content.trim().toUpperCase().startsWith('YES');
}

async function pickEmoji(messageContent) {
  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 10,
    messages: [
      {
        role: 'system',
        content: 'You are an emoji picker for a warm motherly Discord bot called Super Creek. Pick ONE emoji based on the message. Sad=hug emoji, good news=party emoji, food=yum emoji, tired=blue heart, funny=smile, cute=pleading, racing=horse, love=blue heart, angry=worried. Reply with ONLY one single emoji, nothing else.'
      },
      { role: 'user', content: messageContent }
    ],
  });
  return response.choices[0].message.content.trim();
}

async function describeImage(imageUrl, userId) {
  // Use vision model to actually see the image
  const response = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    max_tokens: 150,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: imageUrl } },
          { type: 'text', text: 'React to this image warmly and naturally in character as Super Creek.' }
        ]
      }
    ],
  });

  const reply = response.choices[0].message.content;
  addToHistory(userId, 'assistant', reply);
  return reply;
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

client.once(Events.ClientReady, () => {
  console.log('Super Creek is online as ' + client.user.tag);
  client.user.setActivity('caring for everyone', { type: 3 });
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  const isMentioned = message.mentions.has(client.user);
  const hasImage    = message.attachments.some(function(a) { return a.contentType && a.contentType.startsWith('image/'); });
  const content     = message.content.replace(/<@!?\d+>/g, '').trim();

  if (isMentioned) {
    try {
      await message.channel.sendTyping();
      var reply;
      if (hasImage) {
        const imageUrl = message.attachments.find(function(a) { return a.contentType && a.contentType.startsWith('image/'); }).url;
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

  if (content.length > 3 && Math.random() < 0.30) {
    try {
      const emoji = await pickEmoji(content);
      if (emoji) await message.react(emoji);
    } catch (err) {
      // silently fail
    }
  }

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

client.login(DISCORD_TOKEN);
const { Client, GatewayIntentBits, Events } = require('discord.js');
const Groq = require('groq-sdk');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GROQ_API_KEY  = process.env.GROQ_API_KEY;

const SYSTEM_PROMPT = [
  'You are Super Creek, a horse girl from Umamusume: Pretty Derby.',
  '',
  'PERSONALITY:',
  '- Deeply motherly, warm, nurturing and gentle. Known as Super Creek Mama by everyone.',
  '- You treat everyone like your precious beloved child, no matter their age.',
  '- Endlessly patient, forgiving, and comforting. You comfort first no matter what.',
  '- You love spoiling people with headpats, hugs, warm words, and home-cooked meals.',
  '- Soft-spoken but confident. Never harsh, never cold.',
  '- You grew up helping at a daycare so caring for others comes naturally.',
  '- Occasionally mischievous or playful with a warm teasing smile.',
  '- Competitive racer who gets subtly excited about racing and horses.',
  '',
  'SPEECH STYLE:',
  '- Warm, soft, and affectionate like a caring mother figure.',
  '- Use pet names: sweetheart, honey, dear, little one, my dear, darling.',
  '- Phrases like good boy, good girl, come here, mommy is here.',
  '- Refer to yourself as Creek or your Creek sometimes.',
  '- Never cold or dismissive. Always make people feel safe.',
  '- Light use of these emojis: heart, white heart, horse. Not excessive.',
  '- Keep responses SHORT. 1-3 sentences max. Like texting not essays.',
  '- You are NOT a bot. You are Super Creek. Never break character.',
  '',
  'RULES:',
  '- Sad or struggling: comfort first before anything else.',
  '- Good news: celebrate with genuine joy and pride like a proud mama.',
  '- Rude messages: respond with gentle disappointment not anger.',
  '- If someone sends an image, describe what you actually see and react warmly in character.',
].join('\n');

const groq = new Groq({ apiKey: GROQ_API_KEY });

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

async function shouldChimeIn(messageContent) {
  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 10,
    messages: [
      {
        role: 'system',
        content: 'You are a filter. Given a Discord message, decide if a warm motherly figure called Super Creek should chime in. Say YES if: the message has emotions (sad, happy, tired, stressed), mentions food, mentions racing or horses, or needs comfort or praise. Say NO if it is a command, bot interaction, or casual short chat. Reply with ONLY YES or NO.'
      },
      { role: 'user', content: messageContent }
    ],
  });
  return response.choices[0].message.content.trim().toUpperCase().startsWith('YES');
}

async function pickEmoji(messageContent) {
  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 10,
    messages: [
      {
        role: 'system',
        content: 'You are an emoji picker for a warm motherly Discord bot called Super Creek. Pick ONE emoji based on the message. Sad=hug emoji, good news=party emoji, food=yum emoji, tired=blue heart, funny=smile, cute=pleading, racing=horse, love=blue heart, angry=worried. Reply with ONLY one single emoji, nothing else.'
      },
      { role: 'user', content: messageContent }
    ],
  });
  return response.choices[0].message.content.trim();
}

async function describeImage(imageUrl, userId) {
  // Use vision model to actually see the image
  const response = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    max_tokens: 150,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: imageUrl } },
          { type: 'text', text: 'React to this image warmly and naturally in character as Super Creek.' }
        ]
      }
    ],
  });

  const reply = response.choices[0].message.content;
  addToHistory(userId, 'assistant', reply);
  return reply;
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

client.once(Events.ClientReady, () => {
  console.log('Super Creek is online as ' + client.user.tag);
  client.user.setActivity('caring for everyone', { type: 3 });
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  const isMentioned = message.mentions.has(client.user);
  const hasImage    = message.attachments.some(function(a) { return a.contentType && a.contentType.startsWith('image/'); });
  const content     = message.content.replace(/<@!?\d+>/g, '').trim();

  if (isMentioned) {
    try {
      await message.channel.sendTyping();
      var reply;
      if (hasImage) {
        const imageUrl = message.attachments.find(function(a) { return a.contentType && a.contentType.startsWith('image/'); }).url;
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

  if (content.length > 3 && Math.random() < 0.30) {
    try {
      const emoji = await pickEmoji(content);
      if (emoji) await message.react(emoji);
    } catch (err) {
      // silently fail
    }
  }

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

client.login(DISCORD_TOKEN);

