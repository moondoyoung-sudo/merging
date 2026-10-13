import type { Puzzle, PuzzleWord } from '../game/puzzle';

interface Props {
  puzzle: Puzzle;
  locked: boolean[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function ClueRow({
  word,
  locked,
  selected,
  onSelect,
}: {
  word: PuzzleWord;
  locked: boolean[];
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const done = word.cells.every((i) => locked[i]);
  return (
    <li>
      <button
        className={`clue${selected ? ' sel' : ''}${done ? ' done' : ''}`}
        onClick={() => onSelect(word.id)}
      >
        <span className="clue-no">{word.number}</span>
        <span className="clue-body">
          <span className="clue-text">{word.clue}</span>
          <span className="clue-ko">{word.ko}</span>
        </span>
        <span className="pattern" aria-label={`${word.answer.length}글자`}>
          {word.cells.map((cell, k) => (
            <i key={k} className={locked[cell] ? 'on' : ''}>
              {locked[cell] ? word.answer[k] : ''}
            </i>
          ))}
        </span>
      </button>
    </li>
  );
}

export function ClueList({ puzzle, locked, selectedId, onSelect }: Props) {
  const groups = [
    { title: '가로 Across', words: puzzle.words.filter((w) => w.dir === 'across') },
    { title: '세로 Down', words: puzzle.words.filter((w) => w.dir === 'down') },
  ];
  return (
    <div className="clues">
      {groups.map((g) => (
        <section key={g.title}>
          <h3>{g.title}</h3>
          <ul>
            {g.words.map((w) => (
              <ClueRow
                key={w.id}
                word={w}
                locked={locked}
                selected={selectedId === w.id}
                onSelect={onSelect}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
