import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type DragEvent,
} from "react";
import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  Controls,
  MiniMap,
  ReactFlow,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type NodeChange,
  type NodeTypes,
} from "@xyflow/react";
import { MousePointerClick } from "lucide-react";
import "@xyflow/react/dist/style.css";
import { useTheme } from "@/components/theme-provider";
import type { AutomationNodeType } from "@/lib/api";
import {
  getAutomationNodeDefinition,
  toCanvasEdges,
  toCanvasNodes,
  type AutomationCanvasNode,
  wouldCreateCycle,
} from "@/lib/automation";
import { useAutomationStore } from "@/stores/automations";
import { AutomationNodeCard } from "@/features/automations/automation-node";
import { AUTOMATION_NODE_DRAG_TYPE } from "@/features/automations/node-library";

const NODE_TYPES: NodeTypes = { automation: AutomationNodeCard };

export function AutomationCanvas({
  onInspectNode,
}: {
  onInspectNode?: () => void;
}) {
  const document = useAutomationStore((state) => state.document);
  const selectedNodeId = useAutomationStore((state) => state.selectedNodeId);
  const applyDocumentNodeChanges = useAutomationStore(
    (state) => state.applyNodeChanges,
  );
  const commitNodePositions = useAutomationStore(
    (state) => state.commitNodePositions,
  );
  const applyEdgeChanges = useAutomationStore((state) => state.applyEdgeChanges);
  const connect = useAutomationStore((state) => state.connect);
  const addNode = useAutomationStore((state) => state.addNode);
  const selectNode = useAutomationStore((state) => state.selectNode);
  const { getZoom, screenToFlowPosition, setCenter } = useReactFlow();
  const { theme } = useTheme();
  const [systemDark, setSystemDark] = useState(
    () => globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false,
  );
  const colorMode = theme === "system" ? (systemDark ? "dark" : "light") : theme;
  const documentNodes = useMemo(
    () => toCanvasNodes(document?.nodes ?? [], selectedNodeId),
    [document?.nodes, selectedNodeId],
  );
  const edges = useMemo(
    () => toCanvasEdges(document?.edges ?? []),
    [document?.edges],
  );
  const [nodes, setNodes, applyCanvasNodeChanges] =
    useNodesState<AutomationCanvasNode>(documentNodes);

  useEffect(() => {
    setNodes(documentNodes);
  }, [documentNodes, setNodes]);

  useEffect(() => {
    const media = globalThis.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const handleNodeChanges = useCallback(
    (changes: NodeChange<AutomationCanvasNode>[]) => {
      applyCanvasNodeChanges(changes);

      const documentChanges = changes.filter(
        (change) => change.type === "remove" || change.type === "select",
      );
      if (documentChanges.length > 0) {
        applyDocumentNodeChanges(documentChanges);
      }
    },
    [applyCanvasNodeChanges, applyDocumentNodeChanges],
  );

  const isValidConnection = useCallback(
    (connection: Connection | Edge) => {
      if (!document || !connection.source || !connection.target) return false;
      return !wouldCreateCycle(document, connection.source, connection.target);
    },
    [document],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const type = event.dataTransfer.getData(
        AUTOMATION_NODE_DRAG_TYPE,
      ) as AutomationNodeType;
      if (!getAutomationNodeDefinition(type)) return;
      addNode(type, screenToFlowPosition({ x: event.clientX, y: event.clientY }));
    },
    [addNode, screenToFlowPosition],
  );

  if (!document) return null;

  return (
    <div
      data-automation-canvas
      className="relative h-full min-h-0 w-full bg-muted/15"
      onDrop={handleDrop}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        colorMode={colorMode}
        minZoom={0.25}
        maxZoom={1.5}
        fitView
        fitViewOptions={{ padding: 0.24, maxZoom: 1 }}
        snapToGrid
        snapGrid={[16, 16]}
        deleteKeyCode={["Backspace", "Delete"]}
        selectionKeyCode="Shift"
        multiSelectionKeyCode={["Meta", "Control"]}
        onNodesChange={handleNodeChanges}
        onNodeDragStop={(_, node, draggedNodes) => {
          const movedNodes = draggedNodes.length > 0 ? draggedNodes : [node];
          commitNodePositions(
            movedNodes.map((movedNode) => ({
              id: movedNode.id,
              position: movedNode.position,
            })),
          );
        }}
        onEdgesChange={applyEdgeChanges}
        onConnect={connect}
        connectionLineType={ConnectionLineType.Bezier}
        isValidConnection={isValidConnection}
        onNodeClick={(_, node) => {
          selectNode(node.id);
          onInspectNode?.();
          const zoom = getZoom();
          const width = node.measured?.width ?? 240;
          const height = node.measured?.height ?? 138;
          void setCenter(
            node.position.x + width / 2 + 176 / zoom,
            node.position.y + height / 2,
            { zoom, duration: 240 },
          );
        }}
        onPaneClick={() => selectNode(null)}
        proOptions={{ hideAttribution: true }}
        className="focus:outline-none"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          className="opacity-35"
        />
        <MiniMap
          pannable
          zoomable
          position="bottom-right"
          className="!border-border !bg-background overflow-hidden !rounded-lg !border !shadow-sm [&_.react-flow__minimap-mask]:!fill-muted/70 [&_.react-flow__minimap-node]:!fill-foreground/35"
        />
        <Controls
          showInteractive={false}
          className="!border-border !bg-background overflow-hidden !rounded-lg !border !shadow-sm [&>button]:!border-border [&>button]:!bg-background [&>button]:!text-foreground [&>button:hover]:!bg-accent [&>button>svg]:!fill-current"
        />
      </ReactFlow>
      {document.nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="text-muted-foreground flex flex-col items-center text-center">
            <span className="bg-background grid size-10 place-items-center rounded-lg border shadow-sm">
              <MousePointerClick className="size-4" />
            </span>
            <p className="mt-3 text-sm font-medium text-foreground">添加第一个节点</p>
            <p className="mt-1 text-xs">打开节点面板，拖到画布中的任意位置</p>
          </div>
        </div>
      )}
    </div>
  );
}
