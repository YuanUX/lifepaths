// TEMP FILE - REPLACEMENT CODE
                          {unifiedMilestones.map((m, idx) => {
                            const left = dateToPx(m.dateObj);
                            const topPos = 8;
                            
                            // Calculate distance from TODAY marker to avoid overlap
                            const distanceFromToday = Math.abs(left - todayPx);
                            const isNearToday = distanceFromToday < 60; // If within 60px of TODAY marker
                            const isLeftOfToday = left < todayPx;
                            
                            // Adjust positioning if near TODAY marker
                            let labelTransform = 'translateX(-50%)'; // Default: centered
                            if (isNearToday) {
                              labelTransform = isLeftOfToday ? 'translateX(-100%) translateX(-8px)' : 'translateX(8px)';
                            }
                            
                            return (
                              <div 
                                 key={m.id}
                                 onMouseDown={(e) => {
                                   const dragType = m.isGlobal ? 'global-milestone-move' : 'milestone-move';
                                   setDragState({ type: dragType, itemId: m.id, parentId: m.parentId || undefined, startX: e.clientX, originalData: {...m} });
                                 }}
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   setSelectedItemId({ type: 'milestone', id: m.id, parentId: m.parentId || undefined });
                                   setIsDrawerOpen(true);
                                 }}
                                 className="absolute flex flex-col items-center group cursor-pointer z-30 hover:z-40"
                                 style={{ left: `${left}px`, top: `${topPos}px`, transform: 'translateX(-50%)' }}
                              >
                                <div className="w-3 h-3 rotate-45 border-2 border-white shadow-md group-hover:scale-125 transition-transform mb-1" style={{ backgroundColor: m.displayColor }} />
                                <span 
                                  className="text-[10px] font-bold text-slate-600 whitespace-nowrap px-1.5 py-0.5 rounded bg-white/80 backdrop-blur-sm border border-slate-100 shadow-sm opacity-90 group-hover:opacity-100"
                                  style={{ transform: labelTransform }}
                                >
                                  {m.title}
                                </span>
                              </div>
                            )
                          })}
