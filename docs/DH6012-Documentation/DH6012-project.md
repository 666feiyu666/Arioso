# DH6012-project

## MoodMic: project brief

MoodMic turns a feeling into one piece of music, and then, if the listener wants it, into an album built from that piece.

### Purpose

MoodMic is the course-specific interface for DH6012. It reuses the application's existing music creation capabilities and gives them an identity of their own: a place where someone can describe a feeling in their own words and hear what comes back.

The interface this project started from read like a production console. The work here is to make music creation feel personal and approachable, with the user's mood as the starting point rather than a form to fill in.

### Intended audience

MoodMic is for people who want to turn a feeling into music, including people with no musical training. During the course presentation, classmates and assessors should be able to understand the purpose and follow the experience without a technical explanation.

### Core experience

A user can:

- describe the current mood and the feeling the music should carry;
- talk through the direction with the assistant and edit the resulting prompt;
- start creation and see which stage is running;
- listen to the finished piece and read what the automatic check heard;
- keep the piece, or ask for another attempt;
- continue from a kept piece into an album, confirm the plan, then curate and export it;
- find earlier conversations and pieces again after a refresh.

One piece should stand on its own as a record of a moment. An album should hold together as a set, with a shared sound, while each track keeps its own character.

### Design goals

Invite the first action. The opening screen shows four example moods that play when pressed, and the composer sits below them, so the next step is visible without instructions.

Keep the experience personal. The mood colours, the conversation, and the wording of the results all point back to what the user said, and the user's own words stay editable throughout.

Present one coherent identity. Typography, colour, spacing, and layout follow the same system across MoodMic, the calendar, the playlist, and the workflow pages.

Keep the choices approachable. The difference between a piece and an album is explained where the choice appears: after a piece is kept, not before anything exists.

Support confidence. Progress, waiting states, the review decision, and failures each say what is happening and what the user can do next.

Give listening a central role. Every result is playable in place, including album tracks that finish while the user is still on the page.

### Scope and boundaries

The deliverable is the MoodMic interface plus the journey that connects a kept piece to an album. The existing workflow studio, playlist library, and mood calendar remain available and keep their own records.

Single-piece creation is the main path. An album is planned from a piece the user kept, using that piece's prompt and music specification as the first reference.

The focus is product presentation and interaction quality. Technical architecture and the details of the composition prompts are documented separately.

### Completion criteria

The interface is ready for the course project when:

- a first-time viewer can say what MoodMic does and how to begin;
- a user can go from a written feeling to a playable piece without leaving the page;
- the automatic review either delivers the piece or explains why it paused, and the user can keep or regenerate it;
- a kept piece can be carried into an album in the same conversation, including plan revision, confirmation, background generation, curation, and export;
- existing functionality is preserved and remains usable;
- every state tells the user where they are and what they can do next.
