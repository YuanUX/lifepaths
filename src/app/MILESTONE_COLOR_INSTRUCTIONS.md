# Milestone Color Customization - Final Step

## What's Complete:
✅ Database schema updated (color columns added)
✅ TypeScript types updated (GoalMilestone & GlobalMilestone have color field)
✅ Data service updated (all CRUD operations support color)
✅ Timeline rendering updated (milestones display their custom colors)
✅ ColorPicker component created (/components/ColorPicker.tsx)
✅ MilestoneEditor component created (/components/MilestoneEditor.tsx)

## What Needs Manual Addition:

In `/App.tsx` around line 1354, you need to add the ColorPicker between the Date field and the Delete button.

### Option 1: Use the MilestoneEditor Component (Recommended)
Replace lines 1301-1383 with:

```tsx
{selectedItemId?.type === 'milestone' && (() => {
   const isGlobal = !selectedItemId.parentId;
   const milestone = isGlobal 
      ? data.globalMilestones.find(m => m.id === selectedItemId.id)
      : data.goals.find(g => g.id === selectedItemId.parentId)?.milestones.find(m => m.id === selectedItemId.id);
   
   if (!milestone) return null;

   return (
     <MilestoneEditor 
       milestone={milestone}
       isGlobal={isGlobal}
       parentGoalId={selectedItemId.parentId}
       isDemoMode={isDemoMode}
       onUpdate={setData}
       onClose={() => {
         setIsDrawerOpen(false);
         setSelectedItemId(null);
       }}
     />
   )
})()}
```

### Option 2: Just Add ColorPicker Inline
After line 1355 (`</div>` that closes the Date field), add:

```tsx
<div className="pt-2">
  <ColorPicker 
    selectedColor={milestone.color}
    onColorChange={async (color) => {
      if (isGlobal) {
        const m = milestone as GlobalMilestone;
        const updated = {...m, color};
        setData(prev => ({...prev, globalMilestones: prev.globalMilestones.map(x => x.id === m.id ? updated : x)}));
        if (!isDemoMode) await DataService.updateGlobalMilestone(updated);
      } else {
        const m = milestone as GoalMilestone;
        const gId = selectedItemId.parentId!;
        setData(prev => {
          const newGoals = prev.goals.map(g => g.id === gId ? {...g, milestones: g.milestones.map(x => x.id === m.id ? {...x, color} : x)} : g);
          return {...prev, goals: newGoals};
        });
        if (!isDemoMode) await DataService.updateGoalMilestone({...m, color});
      }
    }}
  />
</div>
```

## Testing:
1. Click on any milestone (either global or goal-specific)
2. You should see a Color picker with 8 color swatches
3. Click a color to change the milestone color
4. The milestone on the timeline should immediately update to the new color
