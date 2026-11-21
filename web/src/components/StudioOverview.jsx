// StudioOverview — the compact three-box overview of the CIBA flow (rule 17): the nodes and edges come from the
// diagram-studio/1 data (web/src/studio-data/pfl-ciba-flow.json, the studio's own PFL_CIBA_FLOW, looked up by name
// and pinned), never hand-built here. Simulate walks the data's steps in order and colours the arrows; Reset restores
// box positions too. The 71-message teaching sequence stays the page's main diagram above.
import { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, { Background, BackgroundVariant, Controls, Handle, MarkerType, Position, ReactFlowProvider } from "@xyflow/react";
import UniqueReactFlow from "./diagram/UniqueReactFlow";
import { getDiagram, edgeIndex } from "../diagram-data";
import "@xyflow/react/dist/style.css";
import "./StudioOverview.css";

const studio = getDiagram("pfl-ciba");

const GROUP_CLASS = { lab: "dg-dark", pf: "dg-blue", user: "dg-green" };

// Which sides of a box an arrow uses, for this data's compact grid.
const SIDES = {
  lab: [Position.Left, Position.Right],
  bc: [Position.Top, Position.Left],
  token: [Position.Bottom, Position.Left],
  device: [Position.Top, Position.Right],
};

// The arrows Simulate colours, found by the boxes they join (not by their position in the data's list).
const EDGE_START = edgeIndex(studio, "lab", "bc");
const EDGE_ASK = edgeIndex(studio, "bc", "device");
const EDGE_POLL = edgeIndex(studio, "lab", "token");
const EDGE_APPROVE = edgeIndex(studio, "device", "bc");
const EDGE_TOKENS = edgeIndex(studio, "lab", "token"); // same pair as EDGE_POLL: the second lab→token edge

function studioNodes() {
  return studio.nodes.map((n) => {
    const [targetPosition, sourcePosition] = SIDES[n.id] || [Position.Top, Position.Bottom];
    return {
      id: n.id,
      type: "studioNode",
      position: { x: n.x ?? 0, y: n.y ?? 0 },
      targetPosition,
      sourcePosition,
      data: { label: n.label, sub: n.sub || [], group: n.group },
      draggable: true,
    };
  });
}

function studioEdges() {
  return studio.edges.map((e, i) => ({
    id: `e${i}`,
    source: e.source,
    target: e.target,
    label: e.label,
    ...(e.dashed ? { style: { strokeDasharray: "6 4" } } : null),
    markerEnd: { type: MarkerType.ArrowClosed },
  }));
}

function StudioNode({ data, targetPosition, sourcePosition }) {
  return (
    <div className={`dg-node ${GROUP_CLASS[data.group] || "dg-grey"}`} style={{ width: 190 }}>
      <Handle type="target" position={targetPosition} style={{ visibility: "hidden" }} isConnectable={false} />
      <strong>{data.label}</strong>
      {data.sub.map((t) => <span key={t}>{t}</span>)}
      <Handle type="source" position={sourcePosition} style={{ visibility: "hidden" }} isConnectable={false} />
    </div>
  );
}

const nodeTypes = { studioNode: StudioNode };

const STEP_MS = 1600;

export default function StudioOverview() {
  return (
    <ReactFlowProvider>
      <Inner />
    </ReactFlowProvider>
  );
}

function Inner() {
  const initialNodes = useMemo(() => studioNodes(), []);
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(() => studioEdges());
  const [step, setStep] = useState(-1); // -1 = off, 0..steps-1 = walking
  const [paused, setPaused] = useState(false);
  const [playing, setPlaying] = useState(false);

  const clearWalk = useCallback(() => { setEdges(studioEdges()); setStep(-1); setPaused(false); setPlaying(false); }, []);
  const reset = useCallback(() => { setNodes(initialNodes); clearWalk(); }, [initialNodes, clearWalk]);

  // Which edge indexes a studio step lights: found by the boxes the step's edges join.
  const stepEdges = useMemo(() => studio.steps.map((s) => s.edges || []), []);

  useEffect(() => {
    if (step < 0 || paused || !playing) return undefined;
    if (step >= studio.steps.length - 1) { setPlaying(false); return undefined; }
    const id = setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => clearTimeout(id);
  }, [step, paused, playing]);

  const light = useCallback((i) => {
    // The studio data names edges by index; colour only this step's arrows (by box pair, so a data reorder is safe).
    const lit = new Set((stepEdges[i] || []).map((idx) => studio.edges[idx] && `${studio.edges[idx].source}->${studio.edges[idx].target}`));
    setEdges(studioEdges().map((e, i2) => {
      const on = lit.has(`${e.source}->${e.target}`) && (stepEdges[i] || []).some((idx) => {
        const d = studio.edges[idx];
        return d && d.source === e.source && d.target === e.target && !!d.dashed === !!e.style?.strokeDasharray;
      });
      return on
        ? { ...e, animated: false, style: { ...(e.style || {}), stroke: "var(--accent)", strokeWidth: 3 }, markerEnd: { type: MarkerType.ArrowClosed, color: "var(--accent)" } }
        : e;
    }));
  }, [stepEdges]);

  useEffect(() => { if (step >= 0) light(step); }, [step, light]);

  const simulate = () => { setEdges(studioEdges()); setStep(0); setPaused(false); setPlaying(true); };
  const next = () => { setPaused(true); setPlaying(true); setStep((s) => (s < 0 ? 0 : Math.min(s + 1, studio.steps.length - 1))); };
  const prev = () => { setPaused(true); setPlaying(true); setStep((s) => Math.max(0, s - 1)); };
  const current = step >= 0 ? studio.steps[step] : null;

  return (
    <section className="studio" aria-label="CIBA overview diagram (diagram-studio)">
      <div className="studio-bar" role="toolbar" aria-label="CIBA overview controls" data-testid="studio-step-bar" role="toolbar">
        {/* ui-pattern: allow P9 this toolbar's Simulate is deliberately unstyled: the view's red primary is the dc-ctrl-btn--simulate button in DiagramControls, which the checker does not read as .primary; two red Simulates in one view state would be the drift */}
        <button type="button" onClick={simulate} disabled={playing && !paused}>Simulate</button>
        {playing && !paused
          ? <button type="button" onClick={() => setPaused(true)}>Pause</button>
          : <button type="button" onClick={() => setPaused(false)} disabled={step < 0}>Resume</button>}
        <button type="button" onClick={prev} disabled={step <= 0}>← Prev</button>
        <button type="button" onClick={next} disabled={step >= studio.steps.length - 1}>Next →</button>
        <button type="button" onClick={clearWalk} disabled={step < 0}>Stop</button>
        <button type="button" onClick={reset}>Reset</button>
        <span className="studio-caption" data-testid="studio-caption">
          {current ? <>Step {step + 1} of {studio.steps.length} · <b>{current.title}</b> — {current.what}</> : "Simulate walks the overview: start the CIBA request, poll while the person decides, collect the approval, get the tokens."}
        </span>
      </div>
      <div className="studio-canvas" data-testid="studio-canvas">
        <UniqueReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={(changes) => setNodes((ns) => ns.map((n) => {
            const c = changes.find((x) => x.id === n.id && x.type === "position" && x.position);
            return c ? { ...n, position: c.position } : n;
          }))}
          nodesConnectable={false}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.4}
          maxZoom={1.6}
          proOptions={{ hideAttribution: true }}
          nodeTypes={nodeTypes}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.5} />
          <Controls showInteractive={false} />
        </UniqueReactFlow>
      </div>
    </section>
  );
}
