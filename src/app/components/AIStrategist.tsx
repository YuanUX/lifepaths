import React, { useState } from 'react';
import { Sparkles, Plus, Check } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';

interface SubtaskSuggestion {
  title: string;
  durationDays: number;
  startOffsetDays: number;
}

interface AIStrategistProps {
  goalTitle: string;
  goalDurationDays: number;
  onAcceptSuggestions: (suggestions: SubtaskSuggestion[]) => void;
}

export function AIStrategist({ goalTitle, goalDurationDays, onAcceptSuggestions }: AIStrategistProps) {
  const [suggestions, setSuggestions] = useState<SubtaskSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [addedIndices, setAddedIndices] = useState<Set<number>>(new Set());

  const generateSuggestions = async () => {
    setLoading(true);
    
    // Simulate AI generation
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Mock suggestions based on goal title
    const mockSuggestions: SubtaskSuggestion[] = [];
    const totalDuration = goalDurationDays;
    
    if (goalTitle.toLowerCase().includes('learn') || goalTitle.toLowerCase().includes('study')) {
      mockSuggestions.push(
        { title: 'Research and gather resources', durationDays: Math.floor(totalDuration * 0.1), startOffsetDays: 0 },
        { title: 'Complete fundamentals', durationDays: Math.floor(totalDuration * 0.3), startOffsetDays: Math.floor(totalDuration * 0.1) },
        { title: 'Practice with exercises', durationDays: Math.floor(totalDuration * 0.3), startOffsetDays: Math.floor(totalDuration * 0.4) },
        { title: 'Build practical project', durationDays: Math.floor(totalDuration * 0.2), startOffsetDays: Math.floor(totalDuration * 0.7) },
        { title: 'Review and consolidate', durationDays: Math.floor(totalDuration * 0.1), startOffsetDays: Math.floor(totalDuration * 0.9) }
      );
    } else if (goalTitle.toLowerCase().includes('project') || goalTitle.toLowerCase().includes('build')) {
      mockSuggestions.push(
        { title: 'Planning and requirements', durationDays: Math.floor(totalDuration * 0.15), startOffsetDays: 0 },
        { title: 'Design and architecture', durationDays: Math.floor(totalDuration * 0.15), startOffsetDays: Math.floor(totalDuration * 0.15) },
        { title: 'Core development', durationDays: Math.floor(totalDuration * 0.4), startOffsetDays: Math.floor(totalDuration * 0.3) },
        { title: 'Testing and refinement', durationDays: Math.floor(totalDuration * 0.2), startOffsetDays: Math.floor(totalDuration * 0.7) },
        { title: 'Launch and documentation', durationDays: Math.floor(totalDuration * 0.1), startOffsetDays: Math.floor(totalDuration * 0.9) }
      );
    } else {
      mockSuggestions.push(
        { title: 'Initial research and planning', durationDays: Math.floor(totalDuration * 0.2), startOffsetDays: 0 },
        { title: 'Phase 1: Foundation', durationDays: Math.floor(totalDuration * 0.3), startOffsetDays: Math.floor(totalDuration * 0.2) },
        { title: 'Phase 2: Implementation', durationDays: Math.floor(totalDuration * 0.3), startOffsetDays: Math.floor(totalDuration * 0.5) },
        { title: 'Phase 3: Completion', durationDays: Math.floor(totalDuration * 0.2), startOffsetDays: Math.floor(totalDuration * 0.8) }
      );
    }

    setSuggestions(mockSuggestions);
    setLoading(false);
  };

  const handleAddSuggestion = (index: number) => {
    setAddedIndices(new Set([...addedIndices, index]));
  };

  const handleAddAll = () => {
    onAcceptSuggestions(suggestions);
    setAddedIndices(new Set(suggestions.map((_, i) => i)));
  };

  return (
    <div className="space-y-4">
      {suggestions.length === 0 ? (
        <Button
          onClick={generateSuggestions}
          disabled={loading}
          variant="outline"
          className="w-full"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          {loading ? 'Generating suggestions...' : 'Suggest Steps'}
        </Button>
      ) : (
        <>
          <div className="flex items-center justify-between mb-2">
            <h4 className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              AI Suggested Subtasks
            </h4>
            <Button
              onClick={handleAddAll}
              size="sm"
              variant="outline"
            >
              Add All
            </Button>
          </div>

          <div className="space-y-2">
            {suggestions.map((suggestion, index) => {
              const isAdded = addedIndices.has(index);
              return (
                <Card key={index} className="p-3 relative">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm">{suggestion.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {suggestion.durationDays} days • Starts day {suggestion.startOffsetDays}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={isAdded ? 'secondary' : 'default'}
                      className="shrink-0"
                      onClick={() => {
                        if (!isAdded) {
                          onAcceptSuggestions([suggestion]);
                          handleAddSuggestion(index);
                        }
                      }}
                      disabled={isAdded}
                    >
                      {isAdded ? (
                        <>
                          <Check className="w-4 h-4 mr-1" />
                          Added
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-1" />
                          Add
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>

          <Button
            onClick={() => {
              setSuggestions([]);
              setAddedIndices(new Set());
            }}
            variant="ghost"
            size="sm"
            className="w-full"
          >
            Generate New Suggestions
          </Button>
        </>
      )}
    </div>
  );
}
