# 🎧🐦 Audio Birdle

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fzarguell%2Faudio-birdle.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2Fzarguell%2Faudio-birdle?ref=badge_shield)

![Static Badge](https://img.shields.io/badge/built%20with%20ai-8A2BE2)

[Play Audio Birdle](https://audio-birdle.sechostlab.com) | [View on GitHub](https://github.com/zarguell/audio-birdle)

**Audio Birdle** is a daily audio-based bird guessing game inspired by Wordle — but with birds! Listen to the daily mystery bird call and choose the correct species from four options. Built as a fully static, client-side app using React, Vite, and TailwindCSS, Audio Birdle brings the world of birdsong to your browser.

> **Alpha Notice:** This project is currently in alpha. While we strive to keep the core experience stable, expect things to evolve as development progresses!

I created this game with inspiration from Mitch's amazing project [Birdle](https://github.com/mitchbeebe/new-birdle). As a birder, I also wanted to practice my skills at sound ID in an audio-based game (and maybe one day be less dependent on Merlin Sound ID 😅), so I set out to develop this game. If you haven't checked out Birdle, please give it a look here! https://www.play-birdle.com

---

## 🚀 Features

- 🔁 **Daily Challenge:** A new "Bird of the Day" every day, based on audio from the [eBird Macaulay Library](https://www.macaulaylibrary.org/).
- 🎧 **Audio-Based Gameplay:** Guess the bird based on its call from 4 multiple choice options.
- 🔥 **Hard Mode:** Free-text input with autocomplete! Test your taxonomic knowledge with 6 guesses, progressive hints (Order → Family → Genus), and immediate feedback on taxonomic closeness.
- 🧠 **Practice Mode:** Free-play guessing mode using the full bird list for your region.
- 🌎 **Regional Focus:** Currently limited to the United States, with plans for expansion.
- 💾 **Local Storage:** Progress and stats saved locally in your browser — no login required.
- ⚙️ **Automated Deployment:** Daily challenge generation and deployment handled by GitHub Actions.
- 🔍 **Multiple Audio Samples:** Up to 10 audio clips per bird are scraped to improve variety and challenge.

---

## 🛣️ Roadmap

Here are some planned features and improvements:

- 🌐 Add support for more regions and broader bird species data.
- 🔊 Improve audio metadata parsing (e.g., sound quality, crediting, species overlap).
- 🌍 Support internationalization/localization (multi-language support).
- 🖼️ Add optional image clues or fun bird facts.
- 📊 Additional statistics and scoring metrics, including historic view of challenges.

---

## 🤝 Contributing

Contributions, ideas, and feedback are very welcome!

- Found a bug? Have a feature request? Want to suggest a new birding region or game mechanic?
  → [Open an issue on GitHub](https://github.com/zarguell/audio-birdle/issues)

- Want to contribute code? Please fork the repo, create a feature branch, and submit a pull request. Be sure to follow best practices (we’re working on linters and test infrastructure soon!).

---

## 🔐 Security

If you discover a security vulnerability in Audio Birdle or its deployment, please **do not** open a public issue.
Instead, report it responsibly by [creating a private GitHub security advisory](https://github.com/zarguell/audio-birdle/security/advisories).

---

## 📜 License

This project is open source and available under the [MIT License](LICENSE).

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fzarguell%2Faudio-birdle.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2Fzarguell%2Faudio-birdle?ref=badge_large)
