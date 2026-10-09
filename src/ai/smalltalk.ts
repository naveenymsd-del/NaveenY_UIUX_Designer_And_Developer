/**
 * Small talk on the way: now and then, on a longer walk, the guide asks one
 * light design question — like a friend making conversation, not a voice-over.
 * The visitor can answer or ignore it; the walk goes on either way. These are
 * general UX conversation, never claims about Naveen's work.
 */
export interface WalkQuestion {
  id: string
  ask: string
  /** answers the guide recognises → what it says back */
  answers: [RegExp, string][]
  /** any other reply that is clearly an answer */
  other: string
}

export const WALK_QUESTIONS: WalkQuestion[] = [
  {
    id: 'simplicity',
    ask: 'Quick design question while we walk — when they conflict, would you pick simplicity or visual impact?',
    answers: [
      [/\b(simpl\w*|easy|ease|usab\w*|clarity|clear|function\w*|workflow)\b/, 'Good choice. That’s usually where good UX starts — less for people to think about.'],
      [/\b(visual\w*|impact|beaut\w*|pretty|looks?|aesthetic\w*|wow)\b/, 'Fair — first impressions matter. The trick is making it beautiful without making it harder to use.'],
      [/\b(both|depends|balance|neither)\b/, 'That’s the designer’s answer — it depends on the people using it. Usually you can have both if the flow is right.'],
    ],
    other: 'Interesting take. Most designers would say it depends on who’s using it.',
  },
  {
    id: 'form',
    ask: 'Tiny UX puzzle for you: a sign-up form has twelve fields and people keep abandoning it. Do you cut fields, or split it into steps?',
    answers: [
      [/\b(cut|remove|fewer|less|reduce|delete|drop)\b/, 'Nice — cutting is often the best first move. Every field has to earn its place.'],
      [/\b(split|steps?|stages?|wizard|pages?|break)\b/, 'Splitting into steps can work well — as long as people can see how far they have to go.'],
      [/\b(both)\b/, 'Both is a strong answer: cut what you can, then group what’s left into a few clear steps.'],
    ],
    other: 'Good thought. The usual move is to cut first, then split what’s left into clear steps.',
  },
  {
    id: 'features',
    ask: 'Would you rather use an app with fewer features that feels effortless, or one that does everything but takes some learning?',
    answers: [
      [/\b(fewer|less|effortless|simple|easy|first|minimal)\b/, 'Same here. An app people actually finish using beats one with every feature they never find.'],
      [/\b(everything|more|features?|powerful|second|learn\w*)\b/, 'Power users would agree. The design job then is making the depth easy to discover.'],
    ],
    other: 'Fair enough — the right answer really depends on who it’s for.',
  },
  {
    id: 'delete',
    ask: 'Here’s one: for a “Delete” button, is it better to ask “Are you sure?” every time, or to offer an Undo afterwards?',
    answers: [
      [/\b(undo|after\w*|second)\b/, 'Undo is often the kinder pattern — it doesn’t slow down the people who meant it.'],
      [/\b(ask|confirm\w*|are you sure|first|sure)\b/, 'Confirmation makes sense for things that can’t be reversed. For everything else, Undo is usually smoother.'],
      [/\b(both|depends)\b/, 'Exactly — confirm what can’t be undone, and offer Undo for the rest.'],
    ],
    other: 'Good one to think about. A common rule: confirm what can’t be reversed, offer Undo for the rest.',
  },
]

let turn = 0
/** the next question to ask (rotates; a different one each walk) */
export function nextWalkQuestion(): WalkQuestion {
  return WALK_QUESTIONS[turn++ % WALK_QUESTIONS.length]
}

/** the visitor's reply to a walk question, or null if what they said isn't an answer to it */
export function answerWalkQuestion(id: string, t: string): string | null {
  const q = WALK_QUESTIONS.find((x) => x.id === id)
  if (!q) return null
  for (const [re, say] of q.answers) if (re.test(t)) return say
  // a short reply that isn't a command or a question counts as an answer
  const words = t.trim().split(/\s+/).length
  if (words <= 6 && !/\b(take|go|show|open|stop|wait|what|where|who|how|why|explain|tell|next|back|continue|pause)\b/.test(t)) return q.other
  return null
}
