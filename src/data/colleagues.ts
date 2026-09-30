/**
 * Colleagues at NFC Solutions. Names are shown only when the visitor walks up
 * to someone (never permanently). `role` is shown under the name only when it
 * is filled in — leave it empty unless the role is known; never guess.
 *
 * `look` picks the avatar's build and outfit. It is an appearance setting only;
 * change it freely to represent each person the way they'd like.
 */
export interface Colleague {
  name: string
  role: string
  look: 'a' | 'b'
}

export const COLLEAGUES: Colleague[] = [
  { name: 'Om Sai', role: '', look: 'a' },
  { name: 'Murali', role: '', look: 'a' },
  { name: 'Subbu', role: '', look: 'a' },
  { name: 'SaiB', role: '', look: 'a' },
  { name: 'Sai', role: '', look: 'a' },
  { name: 'Viswa Pani', role: '', look: 'a' },
]
