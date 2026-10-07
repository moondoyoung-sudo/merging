import { useMemo } from 'react';
import { ApBar } from './components/ApBar';
import { Board } from './components/Board';
import { Legend } from './components/Legend';
import { GEN_COST } from './game/config';
import { useGame } from './hooks/useGame';
import { createRepository } from './storage';

export default function App() {
  const repo = useMemo(createRepository, []);
  const game = useGame(repo);
  const { state } = game;

  if (!state) return <div className="app loading">불러오는 중…</div>;

  return (
    <div className="app">
      <div className="hud">
        <ApBar ap={state.ap} msUntilNext={game.msUntilNext} />
        <button className="gen" onClick={game.generate} disabled={state.ap < GEN_COST}>
          a 생성<span>AP -{GEN_COST}</span>
        </button>
      </div>

      <Board board={state.board} fx={game.fx} onMove={game.move} onActivate={game.activate} />

      <Legend />

      <div className="foot">
        <span>머지 {state.merges}회</span>
        <button
          onClick={() => {
            if (confirm('판과 AP를 처음 상태로 되돌릴까요?')) game.reset();
          }}
        >
          처음부터
        </button>
      </div>

      <div className={`toast${game.toast ? ' show' : ''}`}>{game.toast}</div>
    </div>
  );
}
