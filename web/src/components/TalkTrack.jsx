// The talk track text is filled on the SERVER with the vertical pack's cast (rule 10) and served in
// /api/talk-track, so the raw {{cast}} tokens never reach the page and every visitor of a workspace
// sees the same filled text. The builder writes docs/talk-track.md from the same data.
import { fillDeep } from "../serverCast";

export default function TalkTrack({ talk, cast }) {
  const filled = cast ? talk.map((t) => ({ ...t, say: fillDeep(t.say, cast) })) : talk;
  return (
    <ol className="talk" data-testid="talk-track-list">
      {filled.map((t) => <li key={t.id}><h2>{t.title}</h2><p>{t.say}</p></li>)}
    </ol>
  );
}
