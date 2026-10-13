# DH6012 MoodMic — Detailed Experience Proposal

## Purpose

Develop the initial MoodMic interface into a personal space for recording feelings and creating a single piece or an album. Preserve existing creative capabilities while replacing the visible five-step sequence with a welcoming, continuous experience. This proposal specifies product behaviour and visual direction, without prescribing technical implementation.

## Mood Language and Colours

Explicitly draw inspiration from [How We Feel](https://howwefeel.org/) and its use of colour to make emotions easier to recognise. [Apple's illustrated overview](https://apps.apple.com/ca/iphone/story/id1638393948) describes its colour-coded emotion selection. MoodMic adopts the energy-and-pleasantness approach; the exact shades and calendar treatment below are MoodMic design decisions, not reproductions of How We Feel's interface.

Ask “How are you feeling?” and present four large, rounded colour groups. Arrange red at the upper left, yellow at the upper right, blue at the lower left, and green at the lower right. Higher energy sits above lower energy; unpleasant feelings sit left of pleasant feelings. Include these labels in plain language.

| Colour | Meaning | Initial emotion choices |
| --- | --- | --- |
| Coral red, #E87575 | High energy, unpleasant | Anxious, angry, frustrated, overwhelmed |
| Golden yellow, #E9BD46 | High energy, pleasant | Excited, joyful, energised, enthusiastic |
| Soft blue, #779DD6 | Low energy, unpleasant | Sad, lonely, drained, discouraged |
| Sage green, #83B59A | Low energy, pleasant | Calm, content, relaxed, peaceful |

Selecting a group reveals its emotion words as rounded buttons. Users choose a word, optionally add a note, and save a check-in. They may record another feeling when their mood changes. Use one stable colour per group in this version; do not encode intensity through additional shades.

Always pair colour with an emotion label and a visible selection mark. Use dark text on pale surfaces and clear keyboard focus. Unrecorded days remain unfilled; grey must not mean sadness. Use a warm off-white background, charcoal text, generous spacing, and restrained colour accents.

Keep “How I feel” separate from “How I want the music to feel.” Someone feeling anxious may request calming music. Their calendar remains red; the desired musical feeling must not overwrite their recorded mood. Descriptions such as “nocturnal” remain musical imagery rather than emotion categories.

## A Calendar of Feelings and Music

Make “My mood calendar” a prominent part of MoodMic's home, alongside “Create music.” Show a month grid with weekday headings, previous/next month controls, and a clear outline around today. Keep a four-colour legend visible.

Each recorded day contains a coloured circular marker. With one check-in, the marker has one colour. With multiple check-ins, divide it into equal coloured segments in chronological order, clockwise from the top. Segments represent entries, not duration or emotional intensity; never blend them into a new colour. Show the entry count, and reveal every entry in the date detail view. On hover or keyboard focus, provide a text summary.

Selecting a date opens its feelings, times, notes, and associated music. Include “Create music from this feeling” beside each entry. Users can record a mood without generating music. Empty dates offer “Add a feeling,” with past entries clearly marked as retrospective.

A small music-note symbol marks dates with playable music. Selecting it reveals the relevant pieces and albums. Associate music with the originating check-in even if generation finishes later. Label unfinished creations in the detail view; generation status never changes the calendar's mood colour.

## Creation Without Visible Steps

Remove every “STEP” label, number, and numbered progress indicator in both interface languages. Use conversational headings: “How are you feeling?”, “What would you like to make?”, “Shape your sound,” and “Your music.” These are contextual headings, not a progress tracker.

Offer “One piece” and “An album” as clear choices. Keep the selected feeling, format, and musical preferences visible in an editable summary. Let users revise them without losing their notes. Retain optional reference images, creative discussion, and advanced choices behind plain-language controls.

During creation, show a gentle animation and honest messages such as “Creating your music.” Avoid internal task terminology, model names in routine feedback, and unsupported time promises. Completion opens a dedicated listening view with title, mood, playback, download, and album track order.

## The “why not jazz” Invitation

Place a secondary button labelled exactly **why not jazz** in “Shape your sound,” where the current creative-direction step appears. Keep it optional and off by default.

Selecting it activates the existing jazz corpus as a reference for composition, preserves the user's mood and format, and displays “Jazz inspiration on.” Explain: “Use our jazz reference collection to inspire your music.” Allow users to turn it off before creation. Support both a single piece and an album; for albums, maintain a shared jazz direction across tracks. This must affect composition, not merely add the word “jazz” to the interface.

## Independent MoodMic Generation and Results

Each MoodMic creation must produce its own generation record, audio, album contents, and exports. Do not substitute, relabel, or automatically import outputs from the workflow studio. Maintain a separate MoodMic collection and generation history, linked to mood entries and recoverable after refresh.

Underlying composition capabilities may be shared, but output ownership and result presentation must remain separate. Remove “Open in workflow studio” from the normal journey. Playback, retry, download, and album export must work within MoodMic. Retrying creates a new attempt while preserving earlier records.

## Acceptance

The course demonstration must show a labelled colour calendar, editable feelings, both creation formats, working jazz-corpus selection, independent MoodMic outputs, and playback from a calendar entry. No visible numbered steps should remain.
