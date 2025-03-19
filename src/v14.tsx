/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useState, useRef, useEffect, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  Node,
  Edge,
  NodeProps,
  Handle,
  Position,
  useReactFlow,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { useConnection } from '@xyflow/react';
import { toPng } from 'html-to-image';

import { CirclePlus, Trash, Download, Link2, X } from 'lucide-react'

// Constants for layout and dimensions
const NODE_WIDTH = 120;
const VERTICAL_GAP = 120;
const HORIZONTAL_GAP = 30; // Increased horizontal gap for clarity

// Color palette (assigned based on depth)
const backgrounds = ['#172A2E', '#22383C', '#051114'];

/**
 * Computes the subtree width for a given node recursively.
 * If the node has no children, returns NODE_WIDTH.
 * Otherwise, returns the sum of its children's subtree widths plus horizontal gaps.
 */
function getSubtreeWidth(node: Node<any>, childrenMap: { [key: string]: Node<any>[] }): number {
  const children = childrenMap[node.id] || [];
  if (children.length === 0) return NODE_WIDTH;
  let total = 0;
  children.forEach(child => {
    total += getSubtreeWidth(child, childrenMap);
  });
  total += (children.length - 1) * HORIZONTAL_GAP;
  return Math.max(NODE_WIDTH, total);
}

/**
 * Recalculates the positions of nodes in a tree structure using a two-pass approach.
 * First, builds a children map and computes subtree widths.
 * Then, assigns positions so that each node's subtree is centered beneath it.
 */
function layoutTree(nodes: Node<any>[]): Node<any>[] {
  const childrenMap: { [key: string]: Node<any>[] } = {};
  nodes.forEach((node) => {
    const parentId = node.data.parentId;
    if (parentId) {
      if (!childrenMap[parentId]) childrenMap[parentId] = [];
      childrenMap[parentId].push(node);
    }
  });
  nodes.forEach(node => { node.draggable = false; });

  function layoutNode(node: Node<any>, xCenter: number, y: number, depth: number, visible: boolean) {
    node.position = { x: xCenter - NODE_WIDTH / 2, y };
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

  nodes.forEach((node) => {
    if (!node.data.parentId) {
      const xCenter = node.position.x + NODE_WIDTH / 2;
      layoutNode(node, xCenter, node.position.y, 0, true);
    }
  });

  return nodes;
}

/**
 * Generates the edges based on the parent-child relationship.
 * Uses the node's stored 'visible' flag to determine whether to show the edge.
 * Only animates edges for descendants of node #10 with upward animation and custom color.
 */
function computeEdges(nodes: Node<any>[]): Edge<any>[] {
  const edges: Edge<any>[] = [];
  
  // First, identify all descendants of node #10
  const isDescendantOf10 = new Set<string>();
  
  // Helper function to find all descendants of a node
  const findDescendants = (nodeId: string) => {
    nodes.forEach(node => {
      if (node.data.parentId === nodeId) {
        isDescendantOf10.add(node.id);
        findDescendants(node.id); // Recursively find descendants
      }
    });
  };
  
  // Start with node #10
  findDescendants('10');
  
  // Create edges with animation only for descendants of #10
  nodes.forEach(node => {
    if (node.data.parentId) {
      const isAnimated = node.id === '10' || isDescendantOf10.has(node.id);
      
      edges.push({
        id: `e-${node.data.parentId}-${node.id}`,
        source: node.data.parentId,
        target: node.id,
        // Animate only if the target node is a descendant of #10 or is #10 itself
        animated: isAnimated,
        // Use custom color for animated edges
        style: { 
          stroke: isAnimated ? '#CBEC80' : '#B0C1C6', 
          strokeWidth: isAnimated ? 3 : 1,
          display: node.data.visible ? 'block' : 'none',
          // Reverse animation direction (upward)
          animationDirection: 'reverse'
        },
      });
    }
  });
  
  return edges;
}

/**
 * DownloadButton component that enables exporting the diagram as PNG
 */
const DownloadButton = () => {
  const reactFlowInstance = useReactFlow();
  const [showDropdown, setShowDropdown] = useState(false);

  // Export the entire diagram (fits all nodes)
  const downloadFullDiagram = useCallback(() => {
    // Make sure we have the latest node positions and fit all nodes
    reactFlowInstance.fitView({ duration: 250 });
    
    setTimeout(() => {
      // Use html-to-image to convert the viewport to PNG
      toPng(document.querySelector('.react-flow') as HTMLElement, {
        backgroundColor: '#010304',
        quality: 1.0,
        filter: (node) => {
          // Exclude minimap and controls from the image
          return !node.classList?.contains('react-flow__minimap') && 
                !node.classList?.contains('react-flow__controls') &&
                !node.classList?.contains('react-flow__panel');
        },
      })
        .then((dataUrl) => {
          // Create a download link and trigger the download
          const link = document.createElement('a');
          link.download = `penrove-full-diagram-${new Date().toISOString().slice(0, 10)}.png`;
          link.href = dataUrl;
          link.click();
          setShowDropdown(false);
        })
        .catch((error) => {
          console.error('Error exporting diagram:', error);
        });
    }, 300); // Delay to allow fitView animation to complete
  }, [reactFlowInstance]);

  // Export only the current view (what user is currently seeing)
  const downloadCurrentView = useCallback(() => {
    // Use html-to-image to convert the viewport to PNG without fitting
    toPng(document.querySelector('.react-flow') as HTMLElement, {
      backgroundColor: '#010304',
      quality: 1.0,
      filter: (node) => {
        // Exclude minimap and controls from the image
        return !node.classList?.contains('react-flow__minimap') && 
              !node.classList?.contains('react-flow__controls') &&
              !node.classList?.contains('react-flow__panel');
      },
    })
      .then((dataUrl) => {
        // Create a download link and trigger the download
        const link = document.createElement('a');
        link.download = `penrove-current-view-${new Date().toISOString().slice(0, 10)}.png`;
        link.href = dataUrl;
        link.click();
        setShowDropdown(false);
      })
      .catch((error) => {
        console.error('Error exporting diagram:', error);
      });
  }, []);

  // Common button style
  const buttonStyle = {
    background: '#172A2E',
    border: '1px solid #686F71',
    borderRadius: '5px',
    color: '#D7D7D7',
    padding: '8px 12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    justifyContent: 'flex-start',
    textAlign: 'left' as const,
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        style={buttonStyle}
      >
        <Download size={18} />
        Export PNG
      </button>
      
      {showDropdown && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: '4px',
          background: '#172A2E',
          border: '1px solid #686F71',
          borderRadius: '5px',
          zIndex: 100,
          width: '200px',
          overflow: 'hidden',
        }}>
          <button 
            onClick={downloadCurrentView}
            style={buttonStyle}
          >
            Current View
          </button>
          <button 
            onClick={downloadFullDiagram}
            style={{...buttonStyle, borderTop: '1px solid #686F71'}}
          >
            Entire Diagram
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * NodeHeader component based on React Flow's node-header style.
 * Displays an input for editing the node's label with a nice header style.
 */
const NodeHeader = ({
  id,
  label,
  onLabelChange,
}: {
  id: string;
  label: string;
  onLabelChange: (id: string, newLabel: string) => void;
}) => {
  return (
    <div
      style={{
        padding: 6,
        borderBottom: '1px solid #686F71',
        marginBottom: 6,
        background: 'inherit',
      }}
    >
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
};

/**
 * RelinkModeButton component to toggle relinking mode
 */
const RelinkModeButton = ({ isRelinkMode, toggleRelinkMode, selectedNodeId, cancelRelink }) => {
  const buttonStyle = {
    background: isRelinkMode ? '#CBEC80' : '#172A2E',
    border: '1px solid #686F71',
    borderRadius: '5px',
    color: isRelinkMode ? '#051114' : '#D7D7D7',
    padding: '8px 12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      {selectedNodeId && (
        <button
          onClick={cancelRelink}
          style={{
            ...buttonStyle,
            background: '#FF5A5A',
            color: '#FFFFFF',
          }}
        >
          <X size={18} />
          Cancel
        </button>
      )}
      <button
        onClick={toggleRelinkMode}
        style={buttonStyle}
      >
        <Link2 size={18} />
        {isRelinkMode ? (selectedNodeId ? 'Select new parent' : 'Select node to relink') : 'Relink Mode'}
      </button>
    </div>
  );
};

/**
 * Main component.
 */
const App = () => {
  const [nodes, setNodes] = useState<Node<any>[]>([]);
  const [edges, setEdges] = useState<Edge<any>[]>([]);
  const [isRelinkMode, setIsRelinkMode] = useState(false);
  const [selectedNodeForRelink, setSelectedNodeForRelink] = useState<string | null>(null);
  const nextId = useRef(2);
  
  // Use a ref for node parents to avoid dependency cycle
  const nodeParentsRef = useRef<Record<string, string>>({});
  
  // Update nodeParentsRef whenever nodes change
  useEffect(() => {
    const parents: Record<string, string> = {};
    nodes.forEach(node => {
      if (node.data.parentId) {
        parents[node.id] = node.data.parentId;
      }
    });
    nodeParentsRef.current = parents;
  }, [nodes]);

  // Toggle relink mode
  const toggleRelinkMode = useCallback(() => {
    setIsRelinkMode(prev => !prev);
    setSelectedNodeForRelink(null);
  }, []);
  
  // Cancel current relink operation
  const cancelRelink = useCallback(() => {
    setSelectedNodeForRelink(null);
  }, []);

  // Callback for selecting a node to relink
  const handleSelectForRelink = useCallback((nodeId: string) => {
    setSelectedNodeForRelink(nodeId);
  }, []);

  // Callback to perform the actual relinking
  const handleRelink = useCallback((nodeId: string, newParentId: string) => {
    setNodes(nds => {
      const updatedNodes = nds.map(node => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              parentId: newParentId,
            },
          };
        }
        return node;
      });
      
      // Reset relink mode and selected node
      setIsRelinkMode(false);
      setSelectedNodeForRelink(null);
      
      // Recalculate layout and edges
      const laidOutNodes = layoutTree(updatedNodes);
      setEdges(computeEdges(laidOutNodes));
      
      return laidOutNodes;
    });
  }, []);

  /**
   * Custom node component that now uses NodeHeader for its title.
   * Contains the header and two buttons: one for adding a child and one for deleting.
   */
  const CustomNode = useCallback(({ id, data }: NodeProps) => {
    const isSelected = data.isRelinkMode && data.selectedNodeForRelink === id;
    const isValidRelinkTarget = data.isRelinkMode && data.selectedNodeForRelink && data.selectedNodeForRelink !== id;
    
    // Check if this node is a descendant of the selected node to prevent circular references
    const isDescendant = () => {
      if (!data.isRelinkMode || !data.selectedNodeForRelink) return false;
      
      const isNodeDescendant = (nodeId: string, potentialAncestorId: string): boolean => {
        if (nodeId === potentialAncestorId) return true;
        const parentId = nodeParentsRef.current[nodeId];
        if (!parentId) return false;
        return isNodeDescendant(parentId, potentialAncestorId);
      };
      
      return isNodeDescendant(id, data.selectedNodeForRelink);
    };

    // Determine if this is a valid target for relinking
    const canBeRelinkTarget = isValidRelinkTarget && !isDescendant() && 
      id !== nodeParentsRef.current[data.selectedNodeForRelink];

    const handleNodeClick = () => {
      if (!data.isRelinkMode) return;
      
      if (data.selectedNodeForRelink) {
        // If a node is already selected for relinking and this node is a valid target
        if (canBeRelinkTarget) {
          data.onRelink(data.selectedNodeForRelink, id);
        }
      } else {
        // Select this node for relinking (only if it has a parent)
        if (data.parentId !== null) {
          data.onSelectForRelink(id);
        }
      }
    };

    return (
      <div
        style={{
          padding: 10,
          border: isSelected ? '2px solid #CBEC80' : 
                 canBeRelinkTarget ? '2px solid #809CEC' : 
                 '1px solid #686F71',
          borderRadius: 5,
          background: data.background,
          color: '#D7D7D7',
          width: NODE_WIDTH,
          textAlign: 'center',
          cursor: data.isRelinkMode ? 'pointer' : 'default',
          boxShadow: isSelected ? '0 0 8px rgba(203, 236, 128, 0.6)' : 
                    canBeRelinkTarget ? '0 0 8px rgba(128, 156, 236, 0.6)' : 'none',
        }}
        onClick={handleNodeClick}
      >
        {/* Render the header with an input */}
        <NodeHeader id={id} label={data.label} onLabelChange={data.onLabelChange} />
        <div style={{ display: 'flex', justifyContent: 'center', gap: 5 }}>
          <CirclePlus size={18} onClick={(e) => { e.stopPropagation(); data.onAddChild(id); }} style={{ cursor: 'pointer' }} />
          {data.parentId !== null && (
            <Trash size={18} onClick={(e) => { e.stopPropagation(); data.onDelete(id); }} style={{ cursor: 'pointer' }} />
          )}
        </div>
        {/* Fixed handles for top and bottom connection */}
        <Handle type="target" position={Position.Top} style={{ background: '#555' }} />
        <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />
      </div>
    );
  }, []);

  const nodeTypes = useMemo(() => ({ custom: CustomNode }), [CustomNode]);

  // Callback to add a child node.
  const handleAddChild = useCallback((parentId: string) => {
    setNodes(nds => {
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
          isRelinkMode,
          selectedNodeForRelink,
          onSelectForRelink: handleSelectForRelink,
          onRelink: handleRelink,
        },
        style: {},
        draggable: false,
      };
      nextId.current++;
      const updatedNodes = [...nds, newNode];
      const laidOutNodes = layoutTree(updatedNodes);
      setEdges(computeEdges(laidOutNodes));
      return laidOutNodes;
    });
  }, [isRelinkMode, selectedNodeForRelink, handleSelectForRelink, handleRelink]);

  // Callback to delete a node and its descendants.
  const handleDelete = useCallback((nodeId: string) => {
    setNodes(nds => {
      const getDescendants = (id: string): string[] => {
        let descendants: string[] = [];
        nds.forEach(node => {
          if (node.data.parentId === id) {
            descendants.push(node.id);
            descendants = descendants.concat(getDescendants(node.id));
          }
        });
        return descendants;
      };
      const descendants = getDescendants(nodeId);
      const remainingNodes = nds.filter(node => node.id !== nodeId && !descendants.includes(node.id));
      const laidOutNodes = layoutTree(remainingNodes);
      setEdges(computeEdges(laidOutNodes));
      return laidOutNodes;
    });
  }, []);

  // Callback to change a node's label.
  const handleLabelChange = useCallback((nodeId: string, newLabel: string) => {
    setNodes(nds =>
      nds.map(node => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              label: newLabel,
              onAddChild: handleAddChild,
              onDelete: handleDelete,
              onLabelChange: handleLabelChange,
              isRelinkMode,
              selectedNodeForRelink,
              onSelectForRelink: handleSelectForRelink,
              onRelink: handleRelink,
            },
          };
        }
        return node;
      })
    );
  }, [handleAddChild, handleDelete, isRelinkMode, selectedNodeForRelink, handleSelectForRelink, handleRelink]);

  // Update nodes when relink mode changes
  useEffect(() => {
    if (nodes.length > 0) {
      setNodes(nds =>
        nds.map(node => ({
          ...node,
          data: {
            ...node.data,
            isRelinkMode,
            selectedNodeForRelink,
            onSelectForRelink: handleSelectForRelink,
            onRelink: handleRelink,
          },
        }))
      );
    }
  }, [isRelinkMode, selectedNodeForRelink, handleSelectForRelink, handleRelink]);

  // Initialize the root node on first render.
  useEffect(() => {
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
        isRelinkMode,
        selectedNodeForRelink: null,
        onSelectForRelink: handleSelectForRelink,
        onRelink: handleRelink,
      },
      style: {},
      draggable: false,
    };
    const laidOutNodes = layoutTree([initialNode]);
    setNodes(laidOutNodes);
    setEdges(computeEdges(laidOutNodes));
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'linear-gradient(135deg, #010304, #092025)' }}>
      <h1 style={{ color: '#D7D7D7', textAlign: 'center', paddingTop: 10 }}>Penrove</h1>
      <ReactFlowProvider>
        <ReactFlow nodes={nodes} edges={edges} fitView nodeTypes={nodeTypes} connectionLineComponent={ConnectionLine}>
          <Background color="#616e70" gap={16} />
          <Controls style={{ position: 'fixed', right: 10, bottom: 10, zIndex: 10 }} />
          <MiniMap nodeColor={node => node.data.background || '#2F3F42'} />
          <Panel position="top-right" style={{ margin: '10px', display: 'flex', gap: '10px' }}>
            <DownloadButton />
            <RelinkModeButton 
              isRelinkMode={isRelinkMode} 
              toggleRelinkMode={toggleRelinkMode} 
              selectedNodeId={selectedNodeForRelink}
              cancelRelink={cancelRelink}
            />
          </Panel>
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
};

const ConnectionLine = ({ fromX, fromY, toX, toY }) => {
  const { fromHandle } = useConnection();
 
  return (
    <g>
      <path
        fill="none"
        stroke={fromHandle.id}
        strokeWidth={1.5}
        className="animated"
        d={`M${fromX},${fromY} C ${fromX} ${toY} ${fromX} ${toY} ${toX},${toY}`}
      />
      <circle
        cx={toX}
        cy={toY}
        fill="#fff"
        r={3}
        stroke={fromHandle.id}
        strokeWidth={1.5}
      />
    </g>
  );
};

export default App;
