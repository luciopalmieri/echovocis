import logging

from telegram.ext import Application, CallbackQueryHandler, CommandHandler, MessageHandler, filters

from src.config import settings
from src.telegram_bot.handlers import help_command, inline_callback, language, start, text_message, voice_message

logger = logging.getLogger(__name__)


def create_bot() -> Application:
    app = Application.builder().token(settings.telegram_bot_token).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("language", language))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(MessageHandler(filters.VOICE, voice_message))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, text_message))
    app.add_handler(CallbackQueryHandler(inline_callback))

    return app


def run_bot():
    logging.basicConfig(level=settings.log_level)
    bot = create_bot()
    logger.info("Starting EchoVocis bot...")
    bot.run_polling()
