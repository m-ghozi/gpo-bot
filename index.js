require("dotenv").config();
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const cron = require("node-cron");

const TOKEN = process.env.TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const PREFIX = "d:";

// ================= TIME ENGINE =================
const WIB_OFFSET = 7 * 60 * 60 * 1000; // UTC+7

function nowWIB() {
  return new Date(Date.now() + WIB_OFFSET);
}

function makeSpawnDate(hour, minute) {
  const now = nowWIB();

  const spawn = new Date(now);
  spawn.setUTCHours(hour - 7, minute, 0, 0);
  // convert WIB -> UTC (biar konsisten)

  if (spawn < new Date()) spawn.setUTCDate(spawn.getUTCDate() + 1);

  return spawn;
}

function dTime(date, format = "F") {
  return `<t:${Math.floor(date.getTime() / 1000)}:${format}>`;
}

// ================= DISCORD =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

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

  ...Array.from(
    { length: 24 },
    (_, i) => `${String(i).padStart(2, "0")}:00`,
  ).map((t) => ({ boss: "Soul King", time: t })),
];

// ================= NEXT SPAWN =================
function getNextSpawn() {
  const upcoming = schedules.map((s) => {
    const [h, m] = s.time.split(":").map(Number);
    return { ...s, date: makeSpawnDate(h, m) };
  });

  upcoming.sort((a, b) => a.date - b.date);

  const firstTime = upcoming[0].date.getTime();

  const sameBoss = upcoming.filter((s) => s.date.getTime() === firstTime);

  return {
    date: upcoming[0].date,
    bosses: sameBoss.map((s) => s.boss),
  };
}

// ================= LIVE TRACKER =================
let trackerMessage = null;

async function updateTracker(channel) {
  const now = new Date();

  let upcoming = schedules
    .map((s) => {
      const [h, m] = s.time.split(":").map(Number);
      return { ...s, date: makeSpawnDate(h, m) };
    })
    .sort((a, b) => a.date - b.date)
    .slice(0, 5);

  const embed = new EmbedBuilder()
    .setTitle("📡 GPO LIVE BOSS TRACKER")
    .setColor(0x00ffff)
    .setDescription(
      upcoming
        .map(
          (s) =>
            `**${s.boss}** • ${dTime(s.date, "t")} (${dTime(s.date, "R")})`,
        )
        .join("\n"),
    )
    .setFooter({ text: "Auto update setiap 1 Menit" })
    .setTimestamp();

  try {
    if (!trackerMessage)
      trackerMessage = await channel.send({ embeds: [embed] });
    else await trackerMessage.edit({ embeds: [embed] });
  } catch {}
}

// ================= READY =================
client.once("clientReady", async () => {
  console.log(`✅ ${client.user.tag} ONLINE`);

  const channel = await client.channels.fetch(CHANNEL_ID);

  // LIVE UPDATE
  setInterval(() => updateTracker(channel), 60000);
  updateTracker(channel);

  // SPAWN & REMINDER
  schedules.forEach((schedule) => {
    const [hour, minute] = schedule.time.split(":");

    cron.schedule(
      `${minute} ${hour} * * *`,
      async () => {
        const spawn = makeSpawnDate(parseInt(hour), parseInt(minute));

        const embed = new EmbedBuilder()
          .setTitle(`⚔️ ${schedule.boss} SPAWN`)
          .setDescription(`Muncul ${dTime(spawn, "F")}`)
          .setColor(0xff0000)
          .setTimestamp();

        channel.send({ embeds: [embed] });
      },
      { timezone: "Asia/Jakarta" },
    );

    // -5 menit
    const h = parseInt(hour),
      m = parseInt(minute);
    const rMin = (m - 5 + 60) % 60;
    const rHour = m < 5 ? (h - 1 + 24) % 24 : h;

    cron.schedule(
      `${rMin} ${rHour} * * *`,
      async () => {
        const spawn = makeSpawnDate(h, m);
        const embed = new EmbedBuilder()
          .setTitle(`⏳ 5 MENIT LAGI ${schedule.boss}`)
          .setDescription(`Spawn ${dTime(spawn, "R")}`)
          .setColor(0xffcc00);

        channel.send({ embeds: [embed] });
      },
      { timezone: "Asia/Jakarta" },
    );
  });
});

// ================= COMMAND =================
client.on("messageCreate", async (msg) => {
  if (msg.author.bot || !msg.content.startsWith(PREFIX)) return;
  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  if (cmd === "ping") return msg.reply(`🏓 ${client.ws.ping}ms`);

  if (cmd === "about")
    return msg.reply("🤖 GPO Boss Timer dibuat oleh **Shiro**");

  if (cmd === "next") {
    const n = getNextSpawn();

    return msg.reply(`🔥 **Next Spawn**
  ${n.bosses.map((b) => `⚔️ ${b}`).join("\n")}
  🕒 ${dTime(n.date, "t")}
  ⏳ ${dTime(n.date, "R")}`);
  }

  if (cmd === "now") return msg.reply(`🕒 ${dTime(new Date(), "F")}`);

  if (cmd === "in") {
    const min = parseInt(args[0]);
    if (isNaN(min)) return msg.reply("contoh: b!in 30");
    const t = new Date(Date.now() + min * 60000);
    return msg.reply(`⏳ ${dTime(t, "R")}`);
  }

  if (cmd === "today") {
    const now = new Date();
    let text = "📅 Spawn tersisa hari ini:\n\n";

    schedules.forEach((s) => {
      const [h, m] = s.time.split(":").map(Number);
      const d = makeSpawnDate(h, m);
      if (d > now) text += `${dTime(d, "t")} - ${s.boss}\n`;
    });

    msg.reply(text || "Semua boss sudah spawn hari ini");
  }

  if (cmd === "help") {
    msg.reply(`
📖 COMMAND LIST

b!next → spawn berikutnya
b!today → spawn hari ini
b!in <menit>
b!now
b!ping
b!about
`);
  }
});

// ================= LOGIN =================
client.login(TOKEN);
