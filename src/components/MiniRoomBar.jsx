import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, X, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMiniRoom } from '@/contexts/MiniRoomContext';

export default function MiniRoomBar() {
  const navigate = useNavigate();
  const { miniRoomActive, setMiniRoomActive, roomData } = useMiniRoom();
  const [collapsed, setCollapsed] = useState(false);

  // Bubble drag state and refs
  const [bubblePos, setBubblePos] = useState({ x: 16, y: 420 });
  const draggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });

  console.log("[MINI_ROOM_BAR]", { miniRoomActive, roomData });
  console.log("[MINI_ROOM_BAR] render check", { miniRoomActive, roomData });

  if (!miniRoomActive || !roomData) {
    return null;
  }

  const handleExit = () => {
    setMiniRoomActive(false);
  };

  // Touch handlers for dragging the bubble
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    draggingRef.current = true;
    hasDraggedRef.current = false;
    startPosRef.current = { x: touch.clientX, y: touch.clientY };
    dragOffsetRef.current = {
      x: touch.clientX - bubblePos.x,
      y: touch.clientY - bubblePos.y
    };
  };

  const handleTouchMove = (e) => {
    if (!draggingRef.current) return;

    const touch = e.touches[0];

    // Check if moved enough to be considered a drag (threshold: 5px)
    const moveX = Math.abs(touch.clientX - startPosRef.current.x);
    const moveY = Math.abs(touch.clientY - startPosRef.current.y);
    if (moveX > 5 || moveY > 5) {
      hasDraggedRef.current = true;
    }

    let newX = touch.clientX - dragOffsetRef.current.x;
    let newY = touch.clientY - dragOffsetRef.current.y;

    // Constrain to screen boundaries (bubble size is 56x56 px -> w-14 h-14)
    const bubbleSize = 56;
    const maxX = window.innerWidth - bubbleSize;
    const maxY = window.innerHeight - bubbleSize;

    newX = Math.max(0, Math.min(newX, maxX));
    newY = Math.max(0, Math.min(newY, maxY));

    setBubblePos({ x: newX, y: newY });
  };

  const handleTouchEnd = () => {
    draggingRef.current = false;
  };

  const handleBubbleClick = () => {
    // Only open if it was a tap, not a drag
    if (!hasDraggedRef.current) {
      setCollapsed(false);
    }
  };

  if (collapsed) {
    return (
      <div
        className="w-14 h-14 rounded-full bg-white shadow-xl border border-gray-100 flex items-center justify-center cursor-pointer transition-transform hover:scale-105 active:scale-95"
        style={{
          position: "fixed",
          left: `${bubblePos.x}px`,
          top: `${bubblePos.y}px`,
          zIndex: 130,
          touchAction: "none" // Prevents page scrolling while dragging
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleBubbleClick}
      >
        <div className="relative flex items-center justify-center w-full h-full text-emerald-600">
          <Mic className="w-6 h-6" />
          {/* Live Pulse Indicator */}
          <span className="absolute top-2 right-2 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-white"></span>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-3 left-3 right-3 z-[120] bg-white/95 backdrop-blur-md border border-gray-100 rounded-2xl shadow-xl px-3 py-3 flex items-center gap-3 transition-all duration-300">

      {/* Icon Area */}
      <div className="relative flex-shrink-0 w-11 h-11 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
        <Mic className="w-5 h-5" />
      </div>

      {/* Text Area */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <h4 className="font-bold text-gray-900 truncate text-sm sm:text-base leading-tight">
          {roomData.name || 'Live Room'}
        </h4>
        <div className="flex items-center gap-1.5 mt-1">
          {/* Live Pulse Indicator */}
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <p className="text-xs text-gray-500 truncate">
            Live room is running
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Button
          variant="ghost"
          className="h-8 w-8 p-0 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          onClick={() => setCollapsed(true)}
        >
          <Minimize2 className="w-4 h-4" />
          <span className="sr-only">Collapse</span>
        </Button>
        <Button
          size="sm"
          className="h-8 px-4 rounded-full font-medium transition-all hover:opacity-90 active:scale-95"
          onClick={() => {
            setMiniRoomActive(false);

            if (roomData?.roomId) {
              navigate(`/rooms/${roomData.roomId}`);
            }
          }}
        >
          Return
        </Button>
        <Button
          variant="ghost"
          className="h-8 w-8 p-0 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          onClick={handleExit}
        >
          <X className="w-4 h-4" />
          <span className="sr-only">Exit</span>
        </Button>
      </div>

    </div>
  );
}