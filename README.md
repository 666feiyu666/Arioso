# Arioso

Arioso is a workspace for **agentic music composition**.There's another way which asks agent to compose and write midi directly. But based on my knowledge so far, it could do the latter very well, but still not good enough for the former. And that's why I turn to the music-generation model.

The idea is simple: before a music-generation model creates sound, an agent first decides what the music should become.

```text
human idea
    ↓
agent-composer
    ↓
music prompt
    ↓
Lyria
```

I am interested in two kinds of agent-composer.

## Without a corpus

The first composer works directly from the user's idea.

An agent interprets the request and turns it into a more structured musical intention: genre, instrumentation, rhythm, harmony, form, dynamics, and production.

In this setting, the composer mainly relies on the musical knowledge already contained in the language model.

This gives Arioso a baseline:

> How well can an agent compose from its internal knowledge alone?

## With a corpus

The second direction introduces **information retrieval**.

```text
human idea
    ↓
retrieval
    ↓
musical references
    ↓
agent-composer
    ↓
music prompt
```

Instead of relying only on internal model knowledge, the composer can retrieve relevant musical context before making decisions.

I think of this corpus as a small form of **external musical memory**.

## why-not-jazz

Because I like jazz.

For the first corpus-based experiment, I use material collected from two Wikipedia sources: **List of jazz genres** and **List of jazz standards**.

One provides a map of jazz styles; the other provides a repertoire of compositions that have become shared references in jazz.

When Arioso receives a jazz-related request, the system retrieves relevant knowledge from the corpus and provides it to the agent as context for composition.
