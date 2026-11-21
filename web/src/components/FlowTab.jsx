/**
 * FlowTab — the one page this lab is about: the 71-message CIBA approval sequence.
 *
 * The server is the source of truth: GET /api/diagram answers the sequence text
 * (`source`), per-participant role text (`participants`), and per-message teaching detail
 * (`steps`: what / why / open / request / response / decoded tokens / spec refs). The web
 * app never vendors the data.
 */
import { useEffect, useMemo, useState } from "react";
import SequenceFlowDiagram from "./SequenceFlowDiagram.jsx";
import StudioOverview from "./StudioOverview.jsx";
import { getDiagram } from "../api";

export default function FlowTab() {
  const [diagram, setDiagram] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => { getDiagram().then(setDiagram, (e) => setError(e.message)); }, []);

  if (error) return <p className="field-error" role="alert">Could not load the diagram ({error}). Is the server running?</p>;
  if (!diagram) return <p className="muted">Loading the sequence...</p>;

  return (
    <section aria-label="CIBA approval sequence diagram">
      <p className="intro">
        {diagram.messages} messages, {Object.keys(diagram.participants || {}).length} lifelines, three phases:
        the search, a held booking write that needs an out-of-band approval (CIBA), and the replay once the
        person approves on another device. Click any message or lifeline box for the wire detail, the decoded
        tokens and the standards behind that step.
      </p>
      <StudioOverview />
      <SequenceFlowDiagram
        source={diagram.source}
        label="CIBA approval sequence"
        details={diagram.participants}
        payloads={diagram.payloads}
        stepDetails={diagram.steps}
        variant="lucid"
      />
    </section>
  );
}
