require("dotenv").config();
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const cron = require("node-cron");

// ================= CONSTANTS =================
const TOKEN = process.env.TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const PREFIX = process.env.PREFIX || "d:";
const WIB_OFFSET = 7 * 60 * 60 * 1000; // UTC+7
const TRACKER_UPDATE_INTERVAL = 60000; // 1 menit
const REMINDER_MINUTES = 5;

// ================= CONFIG =================
const BOSS_SCHEDULES = {
  Mihawk: [
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
  ],
  Roger: [
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
  ],
  "Soul King": Array.from(
    { length: 24 },
    (_, i) => `${String(i).padStart(2, "0")}:00`,
  ),
};

const EMBED_COLORS = {
  tracker: 0x00ffff,
  spawn: 0xff0000,
  reminder: 0xffcc00,
  info: 0x0099ff,
};

// ================= UTILITIES =================
class TimeUtils {
  static nowWIB() {
    return new Date(Date.now() + WIB_OFFSET);
  }

  static makeSpawnDate(hour, minute) {
    const now = TimeUtils.nowWIB();
    const spawn = new Date(now);
    spawn.setUTCHours(hour - 7, minute, 0, 0);

    if (spawn < new Date()) {
      spawn.setUTCDate(spawn.getUTCDate() + 1);
    }

    return spawn;
  }

  static formatDiscordTime(date, format = "F") {
    return `<t:${Math.floor(date.getTime() / 1000)}:${format}>`;
  }

  static parseTime(timeStr) {
    return timeStr.split(":").map(Number);
  }
}

class ScheduleManager {
  constructor() {
    this.schedules = this._generateSchedules();
    console.log(`📋 Generated ${this.schedules.length} schedules`);
  }

  _generateSchedules() {
    const schedules = [];

    for (const [boss, times] of Object.entries(BOSS_SCHEDULES)) {
      for (const time of times) {
        schedules.push({ boss, time });
      }
    }

    return schedules;
  }

  getUpcomingSpawns(limit = 5) {
    return this.schedules
      .map((s) => {
        const [h, m] = TimeUtils.parseTime(s.time);
        return { ...s, date: TimeUtils.makeSpawnDate(h, m) };
      })
      .sort((a, b) => a.date - b.date)
      .slice(0, limit);
  }

  getNextSpawn() {
    const upcoming = this.getUpcomingSpawns(this.schedules.length);
    const firstTime = upcoming[0].date.getTime();
    const sameBoss = upcoming.filter((s) => s.date.getTime() === firstTime);

    return {
      date: upcoming[0].date,
      bosses: [...new Set(sameBoss.map((s) => s.boss))],
    };
  }

  getTodaySpawns() {
    const now = new Date();
    return this.schedules
      .map((s) => {
        const [h, m] = TimeUtils.parseTime(s.time);
        return { ...s, date: TimeUtils.makeSpawnDate(h, m) };
      })
      .filter((s) => s.date > now)
      .sort((a, b) => a.date - b.date);
  }
}

// ================= TRACKER =================
class LiveTracker {
  constructor(scheduleManager) {
    this.scheduleManager = scheduleManager;
    this.message = null;
  }

  createEmbed() {
    const upcoming = this.scheduleManager.getUpcomingSpawns(5);
    const description = upcoming
      .map((s) => {
        const time = TimeUtils.formatDiscordTime(s.date, "t");
        const relative = TimeUtils.formatDiscordTime(s.date, "R");
        return `**${s.boss}** • ${time} (${relative})`;
      })
      .join("\n");

    return new EmbedBuilder()
      .setTitle("📡 GPO LIVE BOSS TRACKER")
      .setColor(EMBED_COLORS.tracker)
      .setDescription(description)
      .setFooter({ text: "Auto update setiap 1 menit" })
      .setTimestamp();
  }

  async update(channel) {
    const embed = this.createEmbed();

    try {
      if (!this.message) {
        this.message = await channel.send({ embeds: [embed] });
      } else {
        await this.message.edit({ embeds: [embed] });
      }
    } catch (error) {
      console.error("❌ Error updating tracker:", error.message);
      this.message = null;
    }
  }
}

// ================= CRON SCHEDULER =================
class CronScheduler {
  constructor(scheduleManager, channel) {
    this.scheduleManager = scheduleManager;
    this.channel = channel;
  }

  setupSpawnNotifications() {
    this.scheduleManager.schedules.forEach((schedule) => {
      const [hour, minute] = TimeUtils.parseTime(schedule.time);

      // Spawn notification
      cron.schedule(
        `${minute} ${hour} * * *`,
        () => this._sendSpawnNotification(schedule, hour, minute),
        { timezone: "Asia/Jakarta" },
      );

      // Reminder notification (5 menit sebelumnya)
      const { reminderHour, reminderMinute } = this._calculateReminderTime(
        hour,
        minute,
      );
      cron.schedule(
        `${reminderMinute} ${reminderHour} * * *`,
        () => this._sendReminderNotification(schedule, hour, minute),
        { timezone: "Asia/Jakarta" },
      );
    });

    console.log(
      `✅ ${this.scheduleManager.schedules.length * 2} cron jobs scheduled`,
    );
  }

  _calculateReminderTime(hour, minute) {
    const reminderMinute = (minute - REMINDER_MINUTES + 60) % 60;
    const reminderHour =
      minute < REMINDER_MINUTES ? (hour - 1 + 24) % 24 : hour;
    return { reminderHour, reminderMinute };
  }

  _sendSpawnNotification(schedule, hour, minute) {
    const spawn = TimeUtils.makeSpawnDate(hour, minute);
    const embed = new EmbedBuilder()
      .setTitle(`⚔️ ${schedule.boss} SPAWN`)
      .setDescription(`Muncul ${TimeUtils.formatDiscordTime(spawn, "F")}`)
      .setColor(EMBED_COLORS.spawn)
      .setTimestamp();

    this.channel.send({ embeds: [embed] }).catch(console.error);
  }

  _sendReminderNotification(schedule, hour, minute) {
    const spawn = TimeUtils.makeSpawnDate(hour, minute);
    const embed = new EmbedBuilder()
      .setTitle(`⏳ ${REMINDER_MINUTES} MENIT LAGI ${schedule.boss}`)
      .setDescription(`Spawn ${TimeUtils.formatDiscordTime(spawn, "R")}`)
      .setColor(EMBED_COLORS.reminder);

    this.channel.send({ embeds: [embed] }).catch(console.error);
  }
}

// ================= BOT CLIENT =================
class GPOBossBot {
  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.scheduleManager = new ScheduleManager();
    this.tracker = new LiveTracker(this.scheduleManager);

    this._setupEventHandlers();
  }

  _setupEventHandlers() {
    this.client.once("ready", () => this._onReady());
    this.client.on("messageCreate", (msg) => this._onMessage(msg));
  }

  async _onReady() {
    console.log(`✅ ${this.client.user.tag} is ONLINE`);
    console.log(`📍 Channel ID: ${CHANNEL_ID}`);
    console.log(`🎮 Prefix: ${PREFIX}`);

    try {
      const channel = await this.client.channels.fetch(CHANNEL_ID);

      // Setup live tracker
      setInterval(() => this.tracker.update(channel), TRACKER_UPDATE_INTERVAL);
      await this.tracker.update(channel);

      // Setup cron jobs
      const cronScheduler = new CronScheduler(this.scheduleManager, channel);
      cronScheduler.setupSpawnNotifications();

      console.log("🚀 Bot fully initialized!");
    } catch (error) {
      console.error("❌ Error during initialization:", error);
    }
  }

  _onMessage(msg) {
    if (msg.author.bot || !msg.content.startsWith(PREFIX)) return;

    const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    // Command: ping
    if (cmd === "ping") {
      return msg.reply(`🏓 Pong! Latency: ${this.client.ws.ping}ms`);
    }

    // Command: about
    if (cmd === "about") {
      return msg.reply("🤖 GPO Boss Timer by **Shiro**\n📦 Versi 1.1");
    }

    // Command: next
    if (cmd === "next") {
      try {
        const next = this.scheduleManager.getNextSpawn();
        const bosslist = next.bosses.map((b) => `⚔️ ${b}`).join("\n");
        const time = TimeUtils.formatDiscordTime(next.date, "t");
        const relative = TimeUtils.formatDiscordTime(next.date, "R");
        return msg.reply(
          `🔥 **Next Spawn**\n${bosslist}\n🕒 ${time}\n⏳ ${relative}`,
        );
      } catch (error) {
        console.error("❌ Error in next command:", error);
        return msg.reply("❌ Error saat mengambil next spawn!");
      }
    }

    // Command: today
    if (cmd === "today") {
      try {
        const todaySpawns = this.scheduleManager.getTodaySpawns();

        if (todaySpawns.length === 0) {
          return msg.reply("✅ Semua boss sudah spawn hari ini!");
        }

        let text = "📅 **Spawn tersisa hari ini:**\n\n";
        todaySpawns.forEach((s) => {
          const time = TimeUtils.formatDiscordTime(s.date, "t");
          text += `${time} - **${s.boss}**\n`;
        });

        return msg.reply(text);
      } catch (error) {
        console.error("❌ Error in today command:", error);
        return msg.reply("❌ Error saat mengambil today spawns!");
      }
    }

    // Command: help
    if (cmd === "help") {
      const embed = new EmbedBuilder()
        .setTitle("📖 COMMAND LIST")
        .setColor(EMBED_COLORS.info)
        .setDescription(
          `**${PREFIX}next** → Spawn berikutnya\n` +
            `**${PREFIX}today** → Spawn tersisa hari ini\n` +
            `**${PREFIX}ping** → Cek latency bot\n` +
            `**${PREFIX}about** → Info bot`,
        )
        .setFooter({ text: "GPO Boss Timer v2.0" });

      return msg.reply({ embeds: [embed] });
    }
  }

  start() {
    this.client.login(TOKEN).catch((error) => {
      console.error("❌ Failed to login:", error);
      process.exit(1);
    });
  }
}

// ================= STARTUP =================
if (!TOKEN || !CHANNEL_ID) {
  console.error("❌ TOKEN dan CHANNEL_ID harus diset di .env file!");
  process.exit(1);
}

const bot = new GPOBossBot();
bot.start();
