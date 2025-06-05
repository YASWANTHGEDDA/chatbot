import React, { useEffect, useRef } from 'react';
import { Box, Paper, Typography, CircularProgress } from '@mui/material';
import { Network } from 'vis-network';
import { getGraphVisualization } from '../services/api';

const KnowledgeGraphWidget = ({ query, onNodeClick }) => {
    const networkRef = useRef(null);
    const containerRef = useRef(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const options = {
            nodes: {
                shape: 'dot',
                size: 16,
                font: {
                    size: 12,
                    color: '#ffffff'
                },
                borderWidth: 2,
                shadow: true
            },
            edges: {
                width: 2,
                shadow: true,
                arrows: {
                    to: { enabled: true, scaleFactor: 1 }
                },
                font: {
                    size: 12,
                    align: 'middle'
                }
            },
            physics: {
                stabilization: false,
                barnesHut: {
                    gravitationalConstant: -80000,
                    springConstant: 0.001,
                    springLength: 200
                }
            },
            interaction: {
                hover: true,
                tooltipDelay: 200
            }
        };

        networkRef.current = new Network(containerRef.current, { nodes: [], edges: [] }, options);

        networkRef.current.on('click', (params) => {
            if (params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                onNodeClick(nodeId);
            }
        });

        return () => {
            if (networkRef.current) {
                networkRef.current.destroy();
            }
        };
    }, [onNodeClick]);

    useEffect(() => {
        const fetchGraphData = async () => {
            if (!query) return;

            try {
                const response = await getGraphVisualization({ query });
                const { nodes, edges } = response.data;

                // Transform nodes to vis-network format
                const visNodes = nodes.map(node => ({
                    id: node.id,
                    label: node.label,
                    title: node.description,
                    color: {
                        background: node.color || '#4CAF50',
                        border: '#2E7D32',
                        highlight: {
                            background: '#81C784',
                            border: '#4CAF50'
                        }
                    }
                }));

                // Transform edges to vis-network format
                const visEdges = edges.map(edge => ({
                    from: edge.from,
                    to: edge.to,
                    label: edge.label,
                    arrows: 'to',
                    color: {
                        color: '#666666',
                        highlight: '#999999'
                    }
                }));

                if (networkRef.current) {
                    networkRef.current.setData({ nodes: visNodes, edges: visEdges });
                }
            } catch (error) {
                console.error('Error fetching graph data:', error);
            }
        };

        fetchGraphData();
    }, [query]);

    return (
        <Paper elevation={3} sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" gutterBottom>
                Knowledge Graph
            </Typography>
            <Box
                ref={containerRef}
                sx={{
                    height: '400px',
                    width: '100%',
                    position: 'relative',
                    '& .vis-network': {
                        outline: 'none'
                    }
                }}
            >
                {!query && (
                    <Box
                        sx={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            textAlign: 'center'
                        }}
                    >
                        <Typography color="textSecondary">
                            Enter a query to visualize the knowledge graph
                        </Typography>
                    </Box>
                )}
            </Box>
        </Paper>
    );
};

export default KnowledgeGraphWidget; 