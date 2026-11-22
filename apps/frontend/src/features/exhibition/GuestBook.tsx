import { useId, useState } from 'react';
import styles from './ExhibitionPage.module.css';
import { Sheet } from './Sheet';

export interface GuestNote {
  readonly id: string;
  readonly author: string;
  readonly text: string;
  readonly chapter: string;
  readonly at: string;
}

interface GuestBookState {
  readonly notes: readonly GuestNote[];
  readonly thanked: boolean;
}

const EMPTY: GuestBookState = { notes: [], thanked: false };
const MAX_NOTES = 50;

function storageKey(exhibitionId: string): string {
  return `lova.exhibition.${exhibitionId}.guestbook`;
}

/** Notes stay on this device: there is no guest-book service yet. */
export function readGuestBook(exhibitionId: string): GuestBookState {
  try {
    const raw = window.localStorage.getItem(storageKey(exhibitionId));
    if (raw === null) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<GuestBookState>;
    return {
      notes: Array.isArray(parsed.notes)
        ? parsed.notes.slice(0, MAX_NOTES)
        : [],
      thanked: parsed.thanked === true,
    };
  } catch {
    return EMPTY;
  }
}

function writeGuestBook(exhibitionId: string, state: GuestBookState): void {
  try {
    window.localStorage.setItem(
      storageKey(exhibitionId),
      JSON.stringify(state),
    );
  } catch {
    // Private browsing or full storage: the notes live for this visit only.
  }
}

export function useGuestBook(exhibitionId: string) {
  const [state, setState] = useState(() => readGuestBook(exhibitionId));

  function update(next: GuestBookState): void {
    setState(next);
    writeGuestBook(exhibitionId, next);
  }

  return {
    ...state,
    add: (note: Omit<GuestNote, 'id' | 'at'>) => {
      update({
        ...state,
        notes: [
          { ...note, id: crypto.randomUUID(), at: new Date().toISOString() },
          ...state.notes,
        ].slice(0, MAX_NOTES),
      });
    },
    toggleThanks: () => {
      update({ ...state, thanked: !state.thanked });
    },
  };
}

export type GuestBookHandle = ReturnType<typeof useGuestBook>;

const timeFormat = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

interface GuestBookProps {
  readonly book: GuestBookHandle;
  readonly chapterTitle: string;
  readonly defaultAuthor: string;
  readonly onClose: () => void;
}

export function GuestBook({
  book,
  chapterTitle,
  defaultAuthor,
  onClose,
}: GuestBookProps) {
  const textId = useId();
  const nameId = useId();
  const [text, setText] = useState('');
  const [author, setAuthor] = useState(defaultAuthor);

  return (
    <Sheet label="Livre d’or" side="right" onClose={onClose}>
      <div className={styles.guestbook}>
        <header className={styles.sheetHeader}>
          <p className={styles.eyebrow}>Livre d’or</p>
          <h2 className={styles.sheetTitle}>
            Un mot <em>pour l’exposition</em>
          </h2>
        </header>

        <button
          type="button"
          className={styles.thanks}
          aria-pressed={book.thanked}
          onClick={book.toggleThanks}
        >
          <span aria-hidden="true">✦</span>
          {book.thanked
            ? 'Misaotra ! Merci pour votre soutien'
            : 'Misaotra — remercier les artisans'}
        </button>

        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            const note = text.trim();
            if (note === '') return;
            book.add({
              author: author.trim() === '' ? 'Visiteur' : author.trim(),
              text: note,
              chapter: chapterTitle,
            });
            setText('');
          }}
        >
          <div className={styles.field}>
            <label htmlFor={textId}>
              Votre mot sur <em>{chapterTitle}</em>
            </label>
            <textarea
              id={textId}
              rows={3}
              maxLength={400}
              value={text}
              onChange={(event) => {
                setText(event.target.value);
              }}
              placeholder="Ce que cette œuvre vous inspire…"
            />
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label htmlFor={nameId}>Signature</label>
              <input
                id={nameId}
                maxLength={60}
                value={author}
                onChange={(event) => {
                  setAuthor(event.target.value);
                }}
              />
            </div>
            <button
              type="submit"
              className={styles.primary}
              disabled={text.trim() === ''}
            >
              Signer
            </button>
          </div>
          <p className={styles.sheetHint}>Vos mots restent sur cet appareil.</p>
        </form>

        {book.notes.length === 0 ? (
          <p className={styles.empty}>
            Le livre est encore vierge. Soyez la première ou le premier à
            l’ouvrir.
          </p>
        ) : (
          <ol className={styles.notes}>
            {book.notes.map((note) => (
              <li key={note.id}>
                <p className={styles.noteText}>{note.text}</p>
                <p className={styles.noteMeta}>
                  {note.author} · {note.chapter} ·{' '}
                  <time dateTime={note.at}>
                    {timeFormat.format(new Date(note.at))}
                  </time>
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Sheet>
  );
}
