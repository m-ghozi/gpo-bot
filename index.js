require("dotenv").config();
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const cron = require("node-cron");

// =====================
// CONFIG
// =====================

const TOKEN = process.env.TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const TIMEZONE = "Asia/Jakarta";

// =====================
// DISCORD CLIENT
// =====================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// =====================
// BOSS SCHEDULE
// =====================

const schedules = [
  // MIHAWK
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
  ].map((time) => ({ boss: "Mihawk", time })),

  // ROGER
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
  ].map((time) => ({ boss: "Roger", time })),

  // SOUL KING
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
  ].map((time) => ({ boss: "Soul King", time })),
];

// =====================
// READY EVENT
// =====================

client.once("clientReady", async () => {
  console.log(`✅ Bot login sebagai ${client.user.tag}`);
  console.log(`🕒 Timezone set ke ${TIMEZONE}`);
  console.log(`📅 Server time sekarang:`, new Date().toString());

  const channel = await client.channels.fetch(CHANNEL_ID);

  schedules.forEach((schedule) => {
    // ================= SPAWN TIME =================
    const [hour, minute] = schedule.time.split(":");

    cron.schedule(
      `${minute} ${hour} * * *`,
      async () => {
        const embed = new EmbedBuilder()
          .setTitle(`⚔️ ${schedule.boss} Spawn!`)
          .setColor("Red")
          .setTimestamp();

        await channel.send({ embeds: [embed] });
        console.log(`📢 ${schedule.boss} spawn dikirim (${schedule.time})`);
      },
      { timezone: TIMEZONE },
    );

    // ================= REMINDER -5 MENIT =================
    const date = new Date();
    date.setHours(parseInt(hour));
    date.setMinutes(parseInt(minute));
    date.setSeconds(0);

    date.setMinutes(date.getMinutes() - 5);

    let rHour = date.getHours();
    let rMinute = date.getMinutes();

    cron.schedule(
      `${rMinute} ${rHour} * * *`,
      async () => {
        const embed = new EmbedBuilder()
          .setTitle(`⏳ 5 MENIT LAGI ${schedule.boss} akan spawn!`)
          .setColor("Yellow")
          .setTimestamp();

        await channel.send({ embeds: [embed] });
        console.log(`⏰ Reminder ${schedule.boss} (${schedule.time})`);
      },
      { timezone: TIMEZONE },
    );
  });
});

// =====================
// COMMAND HANDLER
// =====================

const PREFIX = "b!";

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // ================= b!tes =================
  if (command === "tes") {
    return message.reply("✅ Bot aktif dan berjalan normal!");
  }

  // ================= b!dev =================
  if (command === "dev") {
    const embed = new EmbedBuilder()
      .setTitle("🧪 DEV TEST SPAWN")
      .setDescription("Ini adalah pesan percobaan spawn.")
      .setColor("Blue")
      .setTimestamp();

    return message.channel.send({ embeds: [embed] });
  }

  // ================= b!list =================
  if (command === "list") {
    const grouped = {};

    schedules.forEach((s) => {
      if (!grouped[s.boss]) grouped[s.boss] = [];
      grouped[s.boss].push(s.time);
    });

    let text = "📜 **Daftar Jadwal Spawn:**\n\n";

    for (const boss in grouped) {
      text += `**${boss}**\n`;
      text += grouped[boss].join(", ");
      text += "\n\n";
    }

    return message.reply(text);
  }

  // ================= b!next =================
  if (command === "next") {
    const now = new Date();

    let upcoming = [];

    schedules.forEach((s) => {
      const [h, m] = s.time.split(":");
      const spawn = new Date();
      spawn.setHours(parseInt(h));
      spawn.setMinutes(parseInt(m));
      spawn.setSeconds(0);

      if (spawn < now) {
        spawn.setDate(spawn.getDate() + 1);
      }

      upcoming.push({
        boss: s.boss,
        time: s.time,
        date: spawn,
      });
    });

    upcoming.sort((a, b) => a.date - b.date);

    const next = upcoming[0];

    const diffMs = next.date - now;
    const diffMin = Math.floor(diffMs / 60000);

    return message.reply(
      `🔥 Spawn berikutnya:\n**${next.boss}** pada ${next.time} WIB\n⏳ ${diffMin} menit lagi`,
    );
  }
});

// =====================
// LOGIN
// =====================

client.login(TOKEN);

// const http = require("http");

// const PORT = process.env.PORT || 3000;

// http
//   .createServer((req, res) => {
//     res.writeHead(200);
//     res.end("Bot is running");
//   })
//   .listen(PORT, () => {
//     console.log(`🌐 Dummy server aktif di port ${PORT}`);
//   });
