HELP_LANGUAGES: dict[str, str] = {
    "en": (
        "📖 EchoVocis — Help\n\n"
        "Emma is your AI language coach. Send voice or text messages to practice your target language.\n\n"
        "Commands:\n"
        "/start — Start the bot or see your current languages\n"
        "/language — Change your native and target languages\n"
        "/help — Show this help\n\n"
        "Send a voice message to practice pronunciation, or text for grammar corrections. "
        "Emma replies in the same format (voice or text)."
    ),
    "it": (
        "📖 EchoVocis — Aiuto\n\n"
        "Emma è il tuo coach linguistico AI. Invia messaggi vocali o di testo per esercitarti nella lingua target.\n\n"
        "Comandi:\n"
        "/start — Avvia il bot o vedi le tue lingue attuali\n"
        "/language — Cambia la tua lingua madre e la lingua da imparare\n"
        "/help — Mostra questo aiuto\n\n"
        "Invia un messaggio vocale per esercitarti nella pronuncia, oppure testo per le correzioni grammaticali. "
        "Emma risponderà nello stesso formato (vocale o testo)."
    ),
    "de": (
        "📖 EchoVocis — Hilfe\n\n"
        "Emma ist dein KI-Sprachcoach. Sende Sprach- oder Textnachrichten, um deine Zielsprache zu üben.\n\n"
        "Befehle:\n"
        "/start — Bot starten oder deine aktuellen Sprachen anzeigen\n"
        "/language — Deine Mutter- und Zielsprache ändern\n"
        "/help — Diese Hilfe anzeigen\n\n"
        "Sende eine Sprachnachricht für Ausspracheübungen oder Text für Grammatikkorrekturen. "
        "Emma antwortet im selben Format (Sprache oder Text)."
    ),
    "fr": (
        "📖 EchoVocis — Aide\n\n"
        "Emma est ton coach linguistique IA. Envoie des messages vocaux ou textuels pour pratiquer ta langue cible.\n\n"
        "Commandes :\n"
        "/start — Démarrer le bot ou voir tes langues actuelles\n"
        "/language — Changer ta langue maternelle et ta langue cible\n"
        "/help — Afficher cette aide\n\n"
        "Envoie un message vocal pour pratiquer la prononciation, ou du texte pour les corrections grammaticales. "
        "Emma répondra dans le même format (vocal ou texte)."
    ),
    "es": (
        "📖 EchoVocis — Ayuda\n\n"
        "Emma es tu coach de idiomas con IA. Envía mensajes de voz o texto para practicar tu idioma objetivo.\n\n"
        "Comandos:\n"
        "/start — Inicia el bot o ve tus idiomas actuales\n"
        "/language — Cambia tu idioma nativo y el idioma que aprendes\n"
        "/help — Muestra esta ayuda\n\n"
        "Envía un mensaje de voz para practicar pronunciación, o texto para correcciones gramaticales. "
        "Emma responderá en el mismo formato (voz o texto)."
    ),
    "zh": (
        "📖 EchoVocis — 帮助\n\n"
        "Emma 是你的 AI 语言教练。发送语音或文字消息来练习你的目标语言。\n\n"
        "命令：\n"
        "/start — 启动机器人或查看你当前的语言\n"
        "/language — 更改你的母语和目标语言\n"
        "/help — 显示此帮助\n\n"
        "发送语音消息来练习发音，或发送文字获取语法纠正。Emma 会以相同格式回复（语音或文字）。"
    ),
}


def build_help_message(native_language: str | None) -> str:
    if native_language in HELP_LANGUAGES:
        return HELP_LANGUAGES[native_language]
    return HELP_LANGUAGES["en"]
