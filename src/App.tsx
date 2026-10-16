import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { Board } from './components/Board';
import { ClueList } from './components/ClueList';
import { GeneratorOdds, LetterStrip } from './components/LetterGuide';
import { hueOf } from './components/Tile';
import { GENERATORS, STAGE_COUNT } from './game/config';
import { generatorLabel } from './game/generators';
import { completedWordIds, itemForLetter } from './game/rules';
import { useGame } from './hooks/useGame';
import { createRepository } from './storage';

export default function App() {
  const repo = useMemo(createRepository, []);
  const game = useGame(repo);
  const { state, puzzle } = game;

  if (!state || !puzzle) return <div className="app loading">불러오는 중…</div>;

  const doneCount = completedWordIds(puzzle, state.solved).length;
  const selected = puzzle.words.find((w) => w.id === game.selectedWordId);
  const highlight = new Set(selected?.cells ?? []);
  const isLastStage = state.stage >= STAGE_COUNT;

  return (
    <div className="app">
      <LetterStrip />

      <div className="gens">
        {GENERATORS.map((g) => (
          <button
            key={generatorLabel(g)}
            className="gen"
            style={{ '--hue': hueOf(itemForLetter(g.from)?.level ?? 0) } as CSSProperties}
            onClick={() => game.generate(g)}
          >
            {generatorLabel(g)}
            <span>생성기</span>
          </button>
        ))}
      </div>

      <Board
        puzzle={puzzle}
        board={state.board}
        solved={state.solved}
        fx={game.fx}
        highlight={highlight}
        onMove={game.move}
        onActivate={game.activate}
      />

      <div className="panel">
        <div className="panel-head">
          <strong>
            Stage {state.stage}
            <small>/{STAGE_COUNT}</small>
          </strong>
          <span>
            단어 {doneCount}/{puzzle.words.length} · 머지 {state.merges}회
          </span>
          <button
            onClick={() => {
              if (confirm('판을 처음 상태로 되돌릴까요?\n지금까지 만든 글자가 모두 사라지고, 시작 글자만 남아요. (퍼즐은 그대로예요)')) {
                game.restartStage();
              }
            }}
          >
            다시
          </button>
        </div>
        <GeneratorOdds />
        <ClueList
          puzzle={puzzle}
          locked={state.solved}
          selectedId={game.selectedWordId}
          onSelect={game.selectWord}
        />
      </div>

      <div className={`toast${game.toast ? ' show' : ''}`}>{game.toast}</div>

      {game.solved && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h2>CLEAR!</h2>
            <p className="stage-line">
              Stage {state.stage} 클리어 · 머지 {state.merges}회
            </p>
            {isLastStage ? (
              <p>
                {STAGE_COUNT}개 스테이지를 모두 클리어했어요!
                <br />
                새 퍼즐로 처음부터 다시 도전할 수 있어요. (판에 남은 글자는 그대로 이어져요)
              </p>
            ) : (
              <p>다음 스테이지는 새로운 퍼즐이 만들어지고, 판에 남은 글자는 그대로 이어져요.</p>
            )}
            <button onClick={game.nextStage}>{isLastStage ? '처음부터 다시' : '다음 스테이지'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
