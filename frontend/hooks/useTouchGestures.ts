"use client";

import { useEffect, useRef, useCallback } from "react";

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

interface PinchHandlers {
  onPinchIn?: () => void;
  onPinchOut?: () => void;
}

export function useTouchGestures(
  elementRef: React.RefObject<HTMLElement>,
  swipeHandlers: SwipeHandlers = {},
  pinchHandlers: PinchHandlers = {},
) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const initialDistance = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length === 1) {
      touchStart.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      initialDistance.current = Math.sqrt(dx * dx + dy * dy);
    }
  }, []);

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (touchStart.current && e.changedTouches.length === 1) {
        const dx = e.changedTouches[0].clientX - touchStart.current.x;
        const dy = e.changedTouches[0].clientY - touchStart.current.y;
        const threshold = 50;

        if (Math.abs(dx) > Math.abs(dy)) {
          if (dx > threshold && swipeHandlers.onSwipeRight) {
            swipeHandlers.onSwipeRight();
          } else if (dx < -threshold && swipeHandlers.onSwipeLeft) {
            swipeHandlers.onSwipeLeft();
          }
        } else {
          if (dy > threshold && swipeHandlers.onSwipeDown) {
            swipeHandlers.onSwipeDown();
          } else if (dy < -threshold && swipeHandlers.onSwipeUp) {
            swipeHandlers.onSwipeUp();
          }
        }
      }

      if (initialDistance.current && e.touches.length < 2) {
        const dx = e.changedTouches[0].clientX - (touchStart.current?.x ?? 0);
        const dy = e.changedTouches[0].clientY - (touchStart.current?.y ?? 0);
        const currentDistance = Math.sqrt(dx * dx + dy * dy);
        const scale = currentDistance / initialDistance.current;
        const threshold = 0.3;

        if (scale < 1 - threshold && pinchHandlers.onPinchIn) {
          pinchHandlers.onPinchIn();
        } else if (scale > 1 + threshold && pinchHandlers.onPinchOut) {
          pinchHandlers.onPinchOut();
        }
      }

      touchStart.current = null;
      initialDistance.current = null;
    },
    [swipeHandlers, pinchHandlers],
  );

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    element.addEventListener("touchstart", handleTouchStart, { passive: true });
    element.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchend", handleTouchEnd);
    };
  }, [elementRef, handleTouchStart, handleTouchEnd]);
}
