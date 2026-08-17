# Kendra — Open Source Company Knowledge Base with Citations

**Kendra** is an open-source **internal search / RAG desk**. Ask a question about the company. Get an answer with citations from the library — not a hallucinated wiki.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Features

- Ask box with hybrid retrieve → rerank → cite
- Library + admin + audit + evals
- Suggested queries from the corpus
- Thumbs up / down on answers
- Built as “SwiftRoute Knowledge” in the demo corpus

## Who it is for

- Ops / CX teams tired of tribal Slack answers
- Developers building **citation-first RAG**
- Companies that need an **internal Q&A** without leaking docs to a public bot

## Quick start

```bash
git clone https://github.com/Akshit1018/S.Kendra.git
cd S.Kendra
npm install
VITE_AUTH_ENABLED=false npm run dev
```

Open [http://127.0.0.1:8080](http://127.0.0.1:8080).

Optional: `XAI_API_KEY` for live model answers. Without it, the retrieval path still runs on the bundled corpus.

## Tech stack

React 19 · TanStack Start · Vite · Tailwind · in-app knowledge corpus

## License

[MIT](LICENSE)

## Keywords

company knowledge base, RAG with citations, internal Q&A, enterprise search open source, cited answers, employee wiki search
