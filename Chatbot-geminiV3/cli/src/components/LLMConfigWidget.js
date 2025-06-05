import React, { useState, useEffect } from 'react';
import {
    Box,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TextField,
    Slider,
    Typography,
    Paper,
    Divider,
    IconButton,
    Tooltip,
} from '@mui/material';
import { getAvailableModels } from '../services/api';
import InfoIcon from '@mui/icons-material/Info';

const LLMConfigWidget = ({ onConfigChange, initialConfig = {} }) => {
    const [models, setModels] = useState([]);
    const [config, setConfig] = useState({
        model: initialConfig.model || '',
        temperature: initialConfig.temperature || 0.7,
        maxTokens: initialConfig.maxTokens || 1000,
        topP: initialConfig.topP || 0.9,
        frequencyPenalty: initialConfig.frequencyPenalty || 0,
        presencePenalty: initialConfig.presencePenalty || 0,
    });

    useEffect(() => {
        const fetchModels = async () => {
            try {
                const response = await getAvailableModels();
                setModels(response.data);
                if (response.data.length > 0 && !config.model) {
                    setConfig(prev => ({ ...prev, model: response.data[0].id }));
                }
            } catch (error) {
                console.error('Error fetching models:', error);
            }
        };
        fetchModels();
    }, []);

    useEffect(() => {
        onConfigChange(config);
    }, [config, onConfigChange]);

    const handleChange = (field) => (event) => {
        const value = event.target.value;
        setConfig(prev => ({ ...prev, [field]: value }));
    };

    const handleSliderChange = (field) => (event, newValue) => {
        setConfig(prev => ({ ...prev, [field]: newValue }));
    };

    const renderTooltip = (text) => (
        <Tooltip title={text}>
            <IconButton size="small">
                <InfoIcon fontSize="small" />
            </IconButton>
        </Tooltip>
    );

    return (
        <Paper elevation={3} sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" gutterBottom>
                LLM Configuration
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControl fullWidth>
                    <InputLabel>Model</InputLabel>
                    <Select
                        value={config.model}
                        onChange={handleChange('model')}
                        label="Model"
                    >
                        {models.map((model) => (
                            <MenuItem key={model.id} value={model.id}>
                                {model.name}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Typography>Temperature</Typography>
                        {renderTooltip('Controls randomness: 0 is deterministic, 1 is creative')}
                    </Box>
                    <Slider
                        value={config.temperature}
                        onChange={handleSliderChange('temperature')}
                        min={0}
                        max={1}
                        step={0.1}
                        valueLabelDisplay="auto"
                    />
                </Box>

                <TextField
                    label="Max Tokens"
                    type="number"
                    value={config.maxTokens}
                    onChange={handleChange('maxTokens')}
                    fullWidth
                    InputProps={{ inputProps: { min: 1, max: 4000 } }}
                />

                <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Typography>Top P</Typography>
                        {renderTooltip('Controls diversity via nucleus sampling')}
                    </Box>
                    <Slider
                        value={config.topP}
                        onChange={handleSliderChange('topP')}
                        min={0}
                        max={1}
                        step={0.1}
                        valueLabelDisplay="auto"
                    />
                </Box>

                <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Typography>Frequency Penalty</Typography>
                        {renderTooltip('Reduces repetition of token sequences')}
                    </Box>
                    <Slider
                        value={config.frequencyPenalty}
                        onChange={handleSliderChange('frequencyPenalty')}
                        min={-2}
                        max={2}
                        step={0.1}
                        valueLabelDisplay="auto"
                    />
                </Box>

                <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Typography>Presence Penalty</Typography>
                        {renderTooltip('Reduces repetition of topics')}
                    </Box>
                    <Slider
                        value={config.presencePenalty}
                        onChange={handleSliderChange('presencePenalty')}
                        min={-2}
                        max={2}
                        step={0.1}
                        valueLabelDisplay="auto"
                    />
                </Box>
            </Box>
        </Paper>
    );
};

export default LLMConfigWidget; 