
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useState, useRef, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  NodeProps,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  useUpdateNodeInternals,
  useNodesInitialized,
  useConnection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { CirclePlus, Trash } from 'lucide-react';

// Constants for layout and dimensions
const NODE_WIDTH = 120;
const VERTICAL_GAP = 120;
const HORIZONTAL_GAP = 30;

// Color palette (assigned based on depth)
const backgrounds = ['#172A2E', '#22383C', '#051114'];

const NodeHeader = ({
  id,
  label,
  onLabelChange,
}: {
  id: string;
  label: string;
  onLabelChange: (id: string, newLabel: string) => void;
}) => (
  <div style={{ padding: 6, borderBottom: '1px solid #686F71', marginBottom: 6, background: 'inherit' }}>
    <input
      value={label}
      onChange={(e) => onLabelChange(id, e.target.value)}
      placeholder="Enter text..."
      style={{
        width: '100%',
        background: 'transparent',
        border: '1px solid #172A2E',
        backgroundColor: '#172A2E',
        borderRadius: '5px',
        color: '#D7D7D7',
        fontSize: '12px',
        textAlign: 'center',
        outline: 'none',
      }}
    />
  </div>
);

const CustomNode = ({ id, data }: NodeProps) => (
  <div style={{
    padding: 10,
    border: '1px solid #686F71',
    borderRadius: 5,
    background: data.background as string,
    color: '#D7D7D7',
    width: NODE_WIDTH,
    textAlign: 'center',
    position: 'relative', // important for absolute handles
  }}>
    <NodeHeader id={id} label={data.label as string} onLabelChange={data.onLabelChange as (id: string, newLabel: string) => void} />
    <div style={{ display: 'flex', justifyContent: 'center', gap: 5 }}>
      <CirclePlus size={18} onClick={() => data.onAddChild(id)} style={{ cursor: 'pointer' }} />
      {data.parentId !== null && (
        <Trash size={18} onClick={() => data.onDelete(id)} style={{ cursor: 'pointer' }} />
      )}
    </div>
    <Handle type="target" position={Position.Top} style={{ background: '#555' }} />
    <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />
  </div>
);

const nodeTypes = { custom: CustomNode };

function getSubtreeWidth(node: Node<any>, childrenMap: { [key: string]: Node<any>[] }): number {
  // use measured width if available, otherwise fallback
  const currentWidth = node.measured?.width || NODE_WIDTH;
  const children = childrenMap[node.id] || [];
  if (children.length === 0) return currentWidth;
  let total = 0;
  children.forEach(child => {
    total += getSubtreeWidth(child, childrenMap);
  });
  total += (children.length - 1) * HORIZONTAL_GAP;
  return Math.max(currentWidth, total);
}

function layoutTree(nodes: Node<any>[]): Node<any>[] {
  const childrenMap: { [key: string]: Node<any>[] } = {};
  nodes.forEach(node => {
    const parentId = node.data.parentId;
    if (parentId) {
      if (!childrenMap[parentId]) childrenMap[parentId] = [];
      childrenMap[parentId].push(node);
    }
  });
  nodes.forEach(node => { node.draggable = false; });

  function layoutNode(node: Node<any>, xCenter: number, y: number, depth: number, visible: boolean) {
    const currentWidth = node.measured?.width || NODE_WIDTH;
    node.position = { x: xCenter - currentWidth / 2, y };
    node.data.background = backgrounds[Math.min(depth, backgrounds.length - 1)];
    node.style = { ...(node.style || {}), display: visible ? 'block' : 'none' };
    node.data.visible = visible;

    const children = childrenMap[node.id] || [];
    if (children.length === 0) return;

    const childrenWidths = children.map(child => getSubtreeWidth(child, childrenMap));
    const totalChildrenWidth = childrenWidths.reduce((sum, w) => sum + w, 0) + (children.length - 1) * HORIZONTAL_GAP;

    let currentX = xCenter - totalChildrenWidth / 2;
    const childY = y + VERTICAL_GAP;
    children.forEach((child, index) => {
      const childWidth = childrenWidths[index];
      const childCenter = currentX + childWidth / 2;
      layoutNode(child, childCenter, childY, depth + 1, visible);
      currentX += childWidth + HORIZONTAL_GAP;
    });
  }

  nodes.forEach(node => {
    if (!node.data.parentId) {
      const currentWidth = node.measured?.width || NODE_WIDTH;
      const xCenter = node.position.x + currentWidth / 2;
      layoutNode(node, xCenter, node.position.y, 0, true);
    }
  });
  return nodes;
}

function computeEdges(nodes: Node<any>[]): Edge<any>[] {
  const edges: Edge<any>[] = [];
  nodes.forEach(node => {
    if (node.data.parentId) {
      edges.push({
        id: `e-${node.data.parentId}-${node.id}`,
        source: node.data.parentId,
        target: node.id,
        animated: true,
        style: { stroke: '#B0C1C6', display: node.data.visible ? 'block' : 'none' },
      });
    }
  });
  return edges;
}

const ConnectionLine = ({ fromX, fromY, toX, toY }: { fromX: number; fromY: number; toX: number; toY: number; }) => {
  const { fromHandle } = useConnection();
  return (
    <g>
      <path
        fill="none"
        stroke={fromHandle?.id || '#000'}
        strokeWidth={1.5}
        className="animated"
        d={`M${fromX},${fromY} C ${fromX} ${toY} ${fromX} ${toY} ${toX},${toY}`}
      />
      <circle
        cx={toX}
        cy={toY}
        fill="#fff"
        r={3}
        stroke={fromHandle?.id || '#000'}
        strokeWidth={1.5}
      />
    </g>
  );
};

const FlowChart = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<any>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<any>>([]);
  const nextId = useRef(2);
  const updateNodeInternals = useUpdateNodeInternals();
  const nodesInitialized = useNodesInitialized({ includeHiddenNodes: false });
  const [layoutApplied, setLayoutApplied] = useState(false);

  // Re-run layout when nodes have been measured
  useEffect(() => {
    if (nodesInitialized && !layoutApplied) {
      const laidOutNodes = layoutTree(nodes);
      setNodes([...laidOutNodes]);
      laidOutNodes.forEach((node) => updateNodeInternals(node.id));
      setLayoutApplied(true);
    }
  }, [nodesInitialized, layoutApplied, nodes, updateNodeInternals]);

  const handleAddChild = useCallback((parentId: string) => {
    setLayoutApplied(false); // force re-layout when adding
    setNodes((nds) => {
      const newNode: Node<any> = {
        id: nextId.current.toString(),
        type: 'custom',
        position: { x: 0, y: 0 },
        data: {
          label: `Component #${nextId.current}`,
          parentId,
          onAddChild: handleAddChild,
          onDelete: handleDelete,
          onLabelChange: handleLabelChange,
        },
        style: {},
        draggable: false,
      };
      nextId.current++;
      const updatedNodes = [...nds, newNode];
      const laidOutNodes = layoutTree(updatedNodes);
      setEdges(computeEdges(laidOutNodes));
      laidOutNodes.forEach((node) => updateNodeInternals(node.id));
      return laidOutNodes;
    });
  }, []);

  const handleDelete = useCallback((nodeId: string) => {
    setLayoutApplied(false);
    setNodes((nds) => {
      const getDescendants = (id: string): string[] => {
        let descendants: string[] = [];
        nds.forEach((node) => {
          if (node.data.parentId === id) {
            descendants.push(node.id);
            descendants = descendants.concat(getDescendants(node.id));
          }
        });
        return descendants;
      };
      const descendants = getDescendants(nodeId);
      const remainingNodes = nds.filter(
        (node) => node.id !== nodeId && !descendants.includes(node.id)
      );
      const laidOutNodes = layoutTree(remainingNodes);
      setEdges(computeEdges(laidOutNodes));
      laidOutNodes.forEach((node) => updateNodeInternals(node.id));
      return laidOutNodes;
    });
  }, []);

  const handleLabelChange = useCallback((nodeId: string, newLabel: string) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                label: newLabel,
                onAddChild: handleAddChild,
                onDelete: handleDelete,
                onLabelChange: handleLabelChange,
              },
            }
          : node
      )
    );
  }, []);

  useEffect(() => {
    // Initial root node
    const initialNode: Node<any> = {
      id: '1',
      type: 'custom',
      position: { x: 300, y: 50 },
      data: {
        label: 'Main Node',
        parentId: null,
        onAddChild: handleAddChild,
        onDelete: handleDelete,
        onLabelChange: handleLabelChange,
      },
      style: {},
      draggable: false,
    };
    const laidOutNodes = layoutTree([initialNode]);
    setNodes(laidOutNodes);
    setEdges(computeEdges(laidOutNodes));
    laidOutNodes.forEach((node) => updateNodeInternals(node.id));
  }, [handleAddChild, handleDelete, handleLabelChange, updateNodeInternals]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      fitView
      nodeTypes={nodeTypes}
      connectionLineComponent={ConnectionLine}
    >
      <Background color="#616e70" gap={16} />
      <Controls style={{ position: 'fixed', right: 10, bottom: 10, zIndex: 10 }} />
      <MiniMap nodeColor={(node) => node.data.background as string || '#2F3F42'} />
    </ReactFlow>
  );
};

const App = () => (
  <div style={{ width: '100vw', height: '100vh', background: 'linear-gradient(135deg, #010304, #092025)' }}>
    <h1 style={{ color: '#D7D7D7', textAlign: 'center', paddingTop: 10 }}>Penrove</h1>
    <ReactFlowProvider>
      <FlowChart />
    </ReactFlowProvider>
  </div>
);

export default App;
