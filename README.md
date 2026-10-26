# Arioso

Arioso is an agentic music studio. You describe how you feel, the direction is
settled in conversation, and the music is planned, generated, and checked before
you keep it. A kept song can grow into an album.

It runs as a bilingual browser studio (简体中文 / English) and a command-line
interface.

![The MoodMic journey: from a feeling to a playlist](Assets/figure/arioso-moodmic-journey.png)

## From a feeling to a playlist

1. **A feeling in.** You record a colour, a word, and a sentence. That opens a
   conversation, and the reply comes with poems retrieved from a local bilingual
   corpus. You can change the mood word or ask for a different length, and the
   brief is rewritten as you talk.

   ![A conversation turning a check-in into a creative brief](Assets/figure/moodmic_conversation.png)

2. **Plan, confirm, render.** The agent writes an editable brief and a
   `MusicSpec` with its Lyria prompt. That prompt is yours to edit, and
   generation starts only once you confirm it; an edited prompt is the one Lyria
   uses. Lyria returns one take.

3. **Listen, keep, or ask again.** Gemini compares the take with what you asked
   for. The piece then waits: keep it, or ask for another take. A kept piece
   arrives with a player, the music references that shaped it, and the prompt
   that produced it.

   ![A kept piece with its references and Lyria prompt](Assets/figure/moodmic_song.png)

4. **From the kept song to a playlist.** A kept song becomes the starting point
   for an album. The album plan sets out the idea, the shared sound, and how the
   tracks stay related while changing. You confirm the plan before any candidate
   is generated, the candidates appear as they finish, and the tracks you include
   are ordered and exported as one MP3 with timestamps.

   ![The album plan and its continuous player](Assets/figure/moodmic_playlist.png)

## Requirements

- Windows or macOS;
- Node.js 22 or newer and pnpm 11.19.0, as declared in `package.json`;
- an OpenAI API key for composition; and
- a Gemini API key with Lyria access for audio generation.

## Quick start

```shell
git clone https://github.com/666feiyu666/Arioso.git
cd Arioso
corepack enable
pnpm install --frozen-lockfile
pnpm web
```

Open <http://127.0.0.1:4173> and configure the required API keys in Settings.

If Corepack is unavailable, install pnpm 11.19.0 first.

## Example output

- [Afternoon Study](https://www.bilibili.com/video/BV1p5pc6AEX2/?share_source=copy_web&vd_source=db5fe656aa211faf8e79db42720c8bda) · v0.3.0, full playlist
- [雨泊山影 | When Blue Meets Calm | 学习、阅读、桌游背景音](https://www.bilibili.com/video/BV1jcpR66Ea/?share_source=copy_web&vd_source=db5fe656aa211faf8e79db42720c8bda) · v0.6.0, mood and music direction
- [大提琴的寂寞｜城市夜色中的低频旋律](https://www.bilibili.com/video/BV1DwJt65EKc/?share_source=copy_web&vd_source=db5fe656aa211faf8e79db42720c8bda) · v0.9.0, MoodMic playlist
- [器乐摇滚 Playlist | 心情低落时不妨听听](https://www.bilibili.com/video/BV1ucHK6pELM/?share_source=copy_web&vd_source=db5fe656aa211faf8e79db42720c8bda) · v0.9.0, MoodMic playlist, also example playlist shown above

## Development

```shell
pnpm typecheck
pnpm test
pnpm build
```

See [`docs/development.md`](docs/development.md) for development commands and
[`docs/current.md`](docs/current.md) for the implementation beyond this path.
