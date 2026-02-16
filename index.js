require("dotenv").config();
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const cron = require("node-cron");

const TOKEN = process.env.TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const TIMEZONE = "Asia/Jakarta";
const PREFIX = "b!";

// ================= DISCORD CLIENT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ================= DISCORD TIME FORMAT =================
function dTime(date, format = "F") {
  const unix = Math.floor(date.getTime() / 1000);
  return `<t:${unix}:${format}>`;
}

// ================= SCHEDULE =================
const schedules = [
  ...[
    "01:00",
    "03:00",
    "05:00",
    "07:00",
    "09:00",
    "11:00",
    "13:00",
    "15:00",
    "17:00",
    "19:00",
    "21:00",
    "23:00",
  ].map((t) => ({ boss: "Mihawk", time: t })),

  ...[
    "01:00",
    "02:30",
    "04:00",
    "05:30",
    "07:00",
    "08:30",
    "10:00",
    "11:30",
    "13:00",
    "14:30",
    "16:00",
    "17:30",
    "19:00",
    "20:30",
    "22:00",
    "23:30",
  ].map((t) => ({ boss: "Roger", time: t })),

  ...[
    "00:00",
    "01:00",
    "02:00",
    "03:00",
    "04:00",
    "05:00",
    "06:00",
    "07:00",
    "08:00",
    "09:00",
    "10:00",
    "11:00",
    "12:00",
    "13:00",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
    "18:00",
    "19:00",
    "20:00",
    "21:00",
    "22:00",
    "23:00",
  ].map((t) => ({ boss: "Soul King", time: t })),
];

// ================= GET NEXT SPAWN =================
function getNextSpawn() {
  const now = new Date();
  const nowWIB = new Date(now.toLocaleString("en-US", { timeZone: TIMEZONE }));

  let upcoming = [];

  schedules.forEach((s) => {
    const [h, m] = s.time.split(":");
    const spawn = new Date(nowWIB);
    spawn.setHours(h, m, 0, 0);

    if (spawn < nowWIB) spawn.setDate(spawn.getDate() + 1);

    upcoming.push({ ...s, date: spawn });
  });

  upcoming.sort((a, b) => a.date - b.date);
  return upcoming[0];
}

// ================= READY =================
client.once("clientReady", async () => {
  console.log(`✅ ${client.user.tag} ONLINE`);

  const channel = await client.channels.fetch(CHANNEL_ID);

  schedules.forEach((schedule) => {
    const [hour, minute] = schedule.time.split(":");

    // SPAWN
    cron.schedule(
      `${minute} ${hour} * * *`,
      async () => {
        const now = new Date();
        const embed = new EmbedBuilder()
          .setTitle(`⚔️ ${schedule.boss} Spawn!`)
          .setDescription(`Spawn ${dTime(now, "R")}`)
          .setColor("Red")
          .setTimestamp();

        await channel.send({ embeds: [embed] });
        console.log("SPAWN", schedule.boss, schedule.time);
      },
      { timezone: TIMEZONE },
    );

    // REMINDER -5
    const rDate = new Date();
    rDate.setHours(hour, minute, 0, 0);
    rDate.setMinutes(rDate.getMinutes() - 5);

    cron.schedule(
      `${rDate.getMinutes()} ${rDate.getHours()} * * *`,
      async () => {
        const spawn = new Date();
        spawn.setHours(hour, minute, 0, 0);

        const embed = new EmbedBuilder()
          .setTitle(`⏳ 5 MENIT LAGI ${schedule.boss}`)
          .setDescription(`Spawn ${dTime(spawn, "R")}`)
          .setColor("Yellow")
          .setTimestamp();

        await channel.send({ embeds: [embed] });
      },
      { timezone: TIMEZONE },
    );
  });
});

// ================= COMMANDS =================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  // TES
  if (cmd === "tes") return message.reply("✅ Bot aktif!");

  // DEV
  if (cmd === "dev") {
    return message.channel.send("🧪 DEV MESSAGE OK");
  }

  // PING
  if (cmd === "ping") {
    return message.reply(`🏓 ${client.ws.ping}ms`);
  }

  // ABOUT
  if (cmd === "about") {
    return message.reply("🤖 GPO Boss Timer dibuat oleh **Shiro**");
  }

  // NEXT
  if (cmd === "next") {
    const n = getNextSpawn();
    return message.reply(`🔥 Spawn berikutnya:
**${n.boss}**
🕒 ${dTime(n.date, "t")}
⏳ ${dTime(n.date, "R")}`);
  }

  // NOW
  if (cmd === "now") {
    return message.reply(`🕒 Sekarang ${dTime(new Date(), "F")}`);
  }

  // LIST
  if (cmd === "list") {
    const grouped = {};
    schedules.forEach((s) => {
      if (!grouped[s.boss]) grouped[s.boss] = [];
      grouped[s.boss].push(s.time);
    });

    let text = "📜 Jadwal Spawn:\n\n";
    for (const boss in grouped) {
      text += `**${boss}**\n${grouped[boss].join(", ")}\n\n`;
    }
    return message.reply(text);
  }

  // TODAY
  if (cmd === "today") {
    const now = new Date();
    let text = "📅 Spawn hari ini:\n\n";

    schedules.forEach((s) => {
      const [h, m] = s.time.split(":");
      const d = new Date();
      d.setHours(h, m, 0, 0);
      if (d > now) text += `${dTime(d, "t")} - ${s.boss}\n`;
    });

    return message.reply(text || "Tidak ada spawn tersisa hari ini");
  }

  // IN
  if (cmd === "in") {
    const min = parseInt(args[0]);
    if (isNaN(min)) return message.reply("contoh: b!in 30");

    const target = new Date(Date.now() + min * 60000);
    return message.reply(`⏳ ${min} menit lagi → ${dTime(target, "t")}`);
  }

  // NEXTALL
  if (cmd === "nextall") {
    let arr = [];
    const now = new Date();

    schedules.forEach((s) => {
      const [h, m] = s.time.split(":");
      const d = new Date();
      d.setHours(h, m, 0, 0);
      if (d < now) d.setDate(d.getDate() + 1);
      arr.push({ ...s, date: d });
    });

    arr.sort((a, b) => a.date - b.date);

    let text = "🔥 10 Spawn Berikutnya:\n\n";
    arr.slice(0, 10).forEach((a) => {
      text += `${dTime(a.date, "t")} - ${a.boss} (${dTime(a.date, "R")})\n`;
    });

    return message.reply(text);
  }

  // HELP
  if (cmd === "help") {
    return message.reply(`
  📖 **GPO Boss Timer Commands**

  ⚔️ Spawn Info
  \`${PREFIX}next\` - Spawn berikutnya
  \`${PREFIX}nextall\` - 10 spawn berikutnya
  \`${PREFIX}today\` - Spawn sisa hari ini
  \`${PREFIX}list\` - Semua jadwal boss

  🕒 Time
  \`${PREFIX}now\` - Waktu sekarang
  \`${PREFIX}in <menit>\` - Hitung waktu ke depan

  🤖 Bot
  \`${PREFIX}ping\` - Cek latency
  \`${PREFIX}about\` - Info bot
  \`${PREFIX}tes\` - Tes bot aktif
  \`${PREFIX}dev\` - Dev test
  \`${PREFIX}help\` - Tampilkan command
  `);
  }
});

// ================= LOGIN =================
client.login(TOKEN);
