const { Client, GatewayIntentBits, ChannelType, PermissionsBitField } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// ================= CONFIG =================
const CATEGORY_ID = "1507570534207193089";

// ================= DATABASE =================
const vcData = new Map();

// ================= GET USER =================
function getUser(message, args) {
  return (
    message.mentions.members.first() ||
    message.guild.members.cache.get(args[2]) ||
    message.guild.members.cache.get(args[1])
  );
}

// ================= READY =================
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// ================= TEMP VC CREATE =================
client.on('voiceStateUpdate', async (oldState, newState) => {

  if (!oldState.channel && newState.channel) {

    if (newState.channel.parentId === CATEGORY_ID) {

      const member = newState.member;
      const guild = newState.guild;

      const tempVC = await guild.channels.create({
        name: `🎧 ${member.user.username}`,
        type: ChannelType.GuildVoice,
        parent: CATEGORY_ID
      });

      vcData.set(tempVC.id, {
        owner: member.id,
        coOwners: [],
        banned: []
      });

      await member.voice.setChannel(tempVC);
    }
  }

  // delete empty VC
  if (oldState.channel && oldState.channel.members.size === 0) {
    if (vcData.has(oldState.channel.id)) {
      vcData.delete(oldState.channel.id);
      oldState.channel.delete().catch(() => {});
    }
  }
});

// ================= COMMANDS =================
client.on('messageCreate', async (message) => {

  if (message.author.bot) return;
  if (!message.content.startsWith('.v ')) return;

  // ONLY IN CATEGORY VC
  const vc = message.member.voice.channel;
  if (!vc || vc.parentId !== CATEGORY_ID) return;

  const args = message.content.trim().split(' ');
  const cmd = args[1];
  const data = vcData.get(vc.id);
  if (!data) return;

  const user = getUser(message, args);

  // ================= CHECK PERMISSION =================
  const isOwner = message.member.id === data.owner;
  const isCoOwner = data.coOwners.includes(message.member.id);

  const hasPerm = isOwner || isCoOwner;

  // ================= NAME =================
  if (cmd === 'name') {
    if (!hasPerm) return;

    const name = args.slice(2).join(' ');
    if (!name) return;

    await vc.setName(name);
    return message.reply(`🎧 VC renamed to ${name}`);
  }

  // ================= LOCK =================
  if (cmd === 'lock') {
    if (!hasPerm) return;

    await vc.permissionOverwrites.edit(message.guild.roles.everyone, {
      Connect: false
    });

    return message.reply("🔒 VC Locked");
  }

  // ================= UNLOCK =================
  if (cmd === 'unlock') {
    if (!hasPerm) return;

    await vc.permissionOverwrites.edit(message.guild.roles.everyone, {
      Connect: true
    });

    return message.reply("🔓 VC Unlocked");
  }

  // ================= KICK =================
  if (cmd === 'kick') {
    if (!hasPerm) return;
    if (!user) return;

    await user.voice.disconnect();
    return message.reply(`👢 Kicked ${user.user.username}`);
  }

  // ================= REJECT =================
  if (cmd === 'rejecrt') {
    if (!hasPerm) return;
    if (!user) return;

    if (!data.banned.includes(user.id)) {
      data.banned.push(user.id);
    }

    if (user.voice.channel?.id === vc.id) {
      await user.voice.disconnect();
    }

    return message.reply(`⛔ Rejected ${user.user.username}`);
  }

  // ================= PERMALL =================
  if (cmd === 'permall' || cmd === 'perm') {
    if (!hasPerm) return;
    if (!user) return;

    data.banned = data.banned.filter(id => id !== user.id);

    await vc.permissionOverwrites.edit(user.id, {
      Connect: true
    });

    return message.reply(`🔓 Permed ${user.user.username}`);
  }

  // ================= HIDE =================
  if (cmd === 'hide') {
    if (!hasPerm) return;

    await vc.permissionOverwrites.edit(message.guild.roles.everyone, {
      ViewChannel: false
    });

    return message.reply("👁 VC Hidden");
  }

  // ================= UNHIDE =================
  if (cmd === 'unhide') {
    if (!hasPerm) return;

    await vc.permissionOverwrites.edit(message.guild.roles.everyone, {
      ViewChannel: true
    });

    return message.reply("👁 VC Visible");
  }

  // ================= COWNER =================
  if (cmd === 'cowner') {
    if (!hasPerm) return;
    if (!user) return;

    const action = args[2];

    if (action === 'add') {
      if (data.coOwners.length >= 5) return message.reply("❌ Max 5 co-owners");

      if (!data.coOwners.includes(user.id)) {
        data.coOwners.push(user.id);
      }

      return message.reply(`👑 Added co-owner ${user.user.username}`);
    }

    if (action === 'remove') {
      data.coOwners = data.coOwners.filter(id => id !== user.id);
      return message.reply(`❌ Removed co-owner ${user.user.username}`);
    }
  }

  // ================= LIMIT =================
  if (cmd === 'limit') {
    if (!hasPerm) return;

    const limit = parseInt(args[2]);
    if (isNaN(limit)) return;

    await vc.setUserLimit(limit);
    return message.reply(`👥 Limit set to ${limit}`);
  }

  // ================= INFO =================
  if (cmd === 'info') {

    return message.reply(
`━━━━━━━━━━━━━━
🎧 VC INFO

👑 Owner: <@${data.owner}>
👥 CoOwners: ${data.coOwners.length}
⛔ Banned: ${data.banned.length}
━━━━━━━━━━━━━━`
    );
  }

  // ================= CLAIM =================
  if (cmd === 'claim') {

    if (data.owner === message.member.id)
      return message.reply("👑 Already owner");

    if (vc.members.has(data.owner))
      return message.reply("❌ Owner still here");

    data.owner = message.member.id;

    return message.reply("👑 Claimed successfully");
  }

});

// ================= LOGIN =================
client.login(process.env.TOKEN);
