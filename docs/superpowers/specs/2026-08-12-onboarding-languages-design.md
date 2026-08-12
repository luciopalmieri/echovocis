# Onboarding Languages — Design Document

**Date:** 2026-08-12
**Status:** Approved
**Scope:** Robust language selection for onboarding + ability to change languages after onboarding

---

## 1. Problem

The current onboarding accepts **any free text** as the native and target language
(`_handle_onboarding` in `src/telegram_bot/handlers.py`) and stores it verbatim via
`update_user_languages`, then marks `onboarding_completed = True`. There is no validation
and no way back:

- A user testing the bot can accidentally type a full sentence as their "native language",
  which gets persisted. Once set, `/start` only shows "Welcome back" and the placeholder
  commands `/stop`, `/level`, `/exercises`, `/history` are all wired to the same `start`
  handler (`src/telegram_bot/bot.py`).
- Onboarding state lives only in `context.user_data` (in-memory): a bot restart mid-onboarding
  loses the step and leaves the user stuck.
- A voice message from a not-yet-onboarded user only replies "finish setup first" instead of
  guiding the user.
- `_get_user_session` (`handlers.py:45`) is dead code carrying a duplicate onboarding prompt.

**Concrete incident:** a sentence was stored as `native_language`, then `en` as `target_language`.

---

## 2. Goals

1. Make it **impossible** to store an invalid language as native or target.
2. Provide a way to **change** native and/or target language after onboarding.
3. Validate that the chosen target language actually works end-to-end (LLM + TTS) before
   committing, with a graceful fallback when a language is not supported for voice.
4. Fold in robustness fixes for the code being touched.
5. Fix the existing corrupted user data.

---

## 3. Key Decisions

| Decision | Choice |
|----------|--------|
| Selection mechanism | Inline keyboard buttons from a curated language set |
| Curated set | it, en, de, fr, es, zh (Chinese = Mandarin) |
| Chinese dialects | Single `zh` (Mandarin) for now; split only if needed |
| Validation | Code must be in the supported map (buttons guarantee this) |
| Post-selection check | Voice preview: LLM greeting + TTS in target, with Confirm/Change |
| Verification on change | Always (re-runs voice preview) |
| native == target | Prevented (excluded from target buttons) |
| State management | Stateless `callback_data` carrying `<native>:<target>` (restart-safe) |
| DB schema | No migration; existing string columns reused |

---

## 4. Supported Languages

Single source of truth in `src/telegram_bot/languages.py`:

| code | label | flag |
|------|-------|------|
| `it` | Italiano | 🇮🇹 |
| `en` | English | 🇬🇧 |
| `de` | Deutsch | 🇩🇪 |
| `fr` | Français | 🇫🇷 |
| `es` | Español | 🇪🇸 |
| `zh` | 中文 | 🇨🇳 |

The module exposes:
- `SUPPORTED_LANGUAGES: dict[str, LanguageInfo]` (code -> `{label, flag}`).
- `build_lang_keyboard(...) -> InlineKeyboardMarkup` helpers.
- `parse_lang_callback(data: str) -> LangCallback | None` to decode `callback_data`.

---

## 5. Onboarding Flow (callback-driven, stateless)

Each button carries full context in `callback_data` so the flow survives bot restarts and
needs no in-memory step state.

1. **Native picker** — new user hits `/start` (or sends any text/voice) -> inline buttons
   with the 6 languages. `callback_data = "lang_native:<code>"`.
2. **`lang_native:<native>`** — edit the message, show the **target picker** excluding the
   chosen native (prevents native == target). `callback_data = "lang_target:<native>:<target>"`.
3. **`lang_target:<native>:<target>`** — generate a short greeting in the target language
   via the LLM, synthesize it with TTS, and send a **voice message + text** with buttons:
   - ✅ Conferma -> `lang_confirm:<native>:<target>`
   - 🔄 Riprova -> regenerate greeting (`lang_target:<native>:<target>` again)
   - Cambia lingua target -> back to target picker
   - **On TTS failure** for that language: catch the error, reply
     "Voce non disponibile per `<label>`, scegline un'altra", re-show the target picker.
4. **`lang_confirm:<native>:<target>`** — call `update_user_languages(...)`, set
   `onboarding_completed = True`, reply "Tutto pronto! 🎤".

### `ensure_onboarding(update, ...) -> bool`
Shared guard used by `text_message` and `voice_message`: if `onboarding_completed` is False,
show the native picker (or point to `/start`) and return `False` so the caller aborts.
This replaces both the text-handler hijack and the "finish setup first" dead-end for voice.

---

## 6. Change Flow (`/language`)

New command `/language` (replaces the placeholder mappings in `bot.py`):

- Shows current `NATIVE → TARGET`.
- Button "🔄 Cambia lingue" re-enters the native picker from section 5 (same handlers).
- Voice preview is always performed (per decision table), so the user hears the new target.

---

## 7. Robustness Fixes (folded in)

- Remove dead `_get_user_session` and its duplicate prompt.
- Remove the `context.user_data["onboarding_step"]` state machine.
- Voice + text from a non-onboarded user both go through `ensure_onboarding`.
- Keep `get_or_create_user` placeholder defaults (`en`/`it`) to avoid a migration; gate all
  behavior on `onboarding_completed` (defaults are never user-visible).

---

## 8. Data Fix (existing corrupted user)

Two options, both documented in the implementation plan:

1. **Preferred:** use the new `/language` command (dogfoods the feature).
2. **Immediate:** targeted SQL on the affected `telegram_id`:
   ```sql
   UPDATE users SET native_language = 'it', target_language = 'en'
   WHERE telegram_id = '<tg_id>';
   ```

---

## 9. Testing

Follow existing patterns (`tests/test_repository.py`): pytest + pytest-asyncio,
sqlite+aiosqlite in-memory fixtures, `asyncio_mode = "auto"`.

- Unit: `SUPPORTED_LANGUAGES` contents; `build_lang_callback` / `parse_lang_callback`
  round-trip; invalid codes rejected.
- Handler/callback logic: native picker render, target picker excludes native (native==target
  impossible), confirm persists + sets `onboarding_completed`, change flow reuses onboarding,
  TTS-failure fallback path.
- Keep the existing `test_repository.py::test_get_or_create_user_creates_new` assertion
  (`native_language == "en"` default) green.

---

## 10. Out of Scope

- Splitting Chinese into Mandarin/Cantonese.
- Supporting arbitrary language codes beyond the curated set.
- A settings menu beyond language switching.
