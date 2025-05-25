require('dotenv').config();
const { Telegraf, Scenes, session } = require('telegraf');
const axios = require('axios');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Create multi-step report wizard
const reportScene = new Scenes.WizardScene(
  'report-wizard',

  async (ctx) => {
    ctx.wizard.state.report = {};
    await ctx.reply('What type of feedback? (Bug or Suggestion)', {
      reply_markup: {
        keyboard: [['Bug'], ['Suggestion']],
        one_time_keyboard: true,
        resize_keyboard: true,
      },
    });
    return ctx.wizard.next();
  },

  async (ctx) => {
    ctx.wizard.state.report.type = ctx.message.text;
    await ctx.reply('Please describe the issue:');
    return ctx.wizard.next();
  },

  async (ctx) => {
    ctx.wizard.state.report.description = ctx.message.text;
    await ctx.reply('Priority? (High, Medium, Low)', {
      reply_markup: {
        keyboard: [['High'], ['Medium'], ['Low']],
        one_time_keyboard: true,
        resize_keyboard: true,
      },
    });
    return ctx.wizard.next();
  },

  async (ctx) => {
    ctx.wizard.state.report.priority = ctx.message.text;
    await ctx.reply('You may now send a screenshot (optional), or type "Skip" to finish.');
    return ctx.wizard.next();
  },

  async (ctx) => {
    let imageUrl = 'None';

    if (ctx.message.photo) {
      const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
      const fileResp = await axios.get(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`);
      const filePath = fileResp.data.result.file_path;
      imageUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${filePath}`;
    }

    const { type, description, priority } = ctx.wizard.state.report;
    const username = ctx.from.username || ctx.from.first_name;

    try {
      await axios.post(process.env.GOOGLE_WEBHOOK_URL, {
        type,
        description,
        priority,
        username,
        imageUrl,
      });

      await ctx.reply('✅ Thanks! Your feedback has been logged.');
    } catch (err) {
      console.error(err);
      await ctx.reply('❌ Something went wrong.');
    }

    return ctx.scene.leave();
  }
);

const stage = new Scenes.Stage([reportScene]);
bot.use(session());
bot.use(stage.middleware());

bot.start((ctx) => ctx.reply('👋 Welcome! Use /report to submit feedback.'));
bot.command('report', (ctx) => ctx.scene.enter('report-wizard'));

bot.launch();
console.log('🤖 Bot is running...');
