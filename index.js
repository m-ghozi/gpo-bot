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
  intents: [GatewayIntentBits.Guilds],
});

// =====================
// BOSS SCHEDULE
// =====================

const schedules = [
  // MIHAWK
  ...["01:00","03:00","05:00","07:00","09:00","11:00","13:00","15:00","17:00","19:00","21:00","23:00"]
    .map(time => ({ boss: "Mihawk", time })),

  // ROGER
  ...["01:00","02:30","04:00","05:30","07:00","08:30","10:00","11:30","13:00","14:30","16:00","17:30","19:00","20:30","22:00","23:30"]
    .map(time => ({ boss: "Roger", time })),

  // SOUL KING
  ...[
    "00:00","01:00","02:00","03:00","04:00","05:00","06:00",
    "07:00","08:00","09:00","10:00","11:00","12:00",
    "13:00","14:00","15:00","16:00","17:00","18:00",
    "19:00","20:00","21:00","22:00","23:00"
  ].map(time => ({ boss: "Soul King", time }))
];

// =====================
// READY EVENT
// =====================

client.once("ready", async () => {
  console.log(`✅ Bot login sebagai ${client.user.tag}`);
  console.log(`🕒 Timezone set ke ${TIMEZONE}`);
  console.log(`📅 Server time sekarang:`, new Date().toString());

  const channel = await client.channels.fetch(CHANNEL_ID);

  schedules.forEach(schedule => {
    const [hour, minute] = schedule.time.split(":");

    cron.schedule(
      `${minute} ${hour} * * *`,
      async () => {
        const embed = new EmbedBuilder()
          .setTitle(`🔥 ${schedule.boss} SPAWN SEKARANG!`)
          .setDescription(`⏰ Waktu: ${schedule.time} WIB`)
          .setColor("Red")
          .setTimestamp();

        await channel.send({ embeds: [embed] });
        console.log(`📢 ${schedule.boss} spawn dikirim (${schedule.time})`);
      },
      {
        timezone: TIMEZONE
      }
    );
  });
});

// =====================
// LOGIN
// =====================

client.login(TOKEN);
