import logging

from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, filters

from src.config import settings
from src.telegram_bot.handlers import start, text_message, voice_message, inline_callback

logger = logging.getLogger(__name__)


def create_bot() -> Application:
    app = Application.builder().token(settings.telegram_bot_token).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("stop", start))
    app.add_handler(CommandHandler("level", start))
    app.add_handler(CommandHandler("exercises", start))
    app.add_handler(CommandHandler("history", start))
    app.add_handler(MessageHandler(filters.VOICE, voice_message))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, text_message))
    app.add_handler(CallbackQueryHandler(inline_callback))

    return app


def run_bot():
    logging.basicConfig(level=settings.log_level)
    bot = create_bot()
    logger.info("Starting EchoVocis bot...")
    bot.run_polling()
