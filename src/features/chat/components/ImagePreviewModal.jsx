import { useEffect, useRef, useState } from "react";
import { FaMinus, FaPlus, FaTimes, FaUndo } from "react-icons/fa";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.2;

const clampZoom = (value) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

function ImagePreviewModal({ image, isOpen, onClose }) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const stageRef = useRef(null);
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 });
  const dragStartRef = useRef({ x: 0, y: 0, originX: 0, originY: 0 });

  const getViewportMetrics = () => {
    const stageElement = stageRef.current;
    if (!stageElement) return null;

    const stageRect = stageElement.getBoundingClientRect();
    const viewportWidth = stageRect.width;
    const viewportHeight = stageRect.height;

    if (!viewportWidth || !viewportHeight) return null;

    const naturalWidth = imageNaturalSize.width || 1;
    const naturalHeight = imageNaturalSize.height || 1;
    const containRatio = Math.min(
      viewportWidth / naturalWidth,
      viewportHeight / naturalHeight
    );

    const fittedWidth = naturalWidth * containRatio;
    const fittedHeight = naturalHeight * containRatio;

    return {
      rect: stageRect,
      viewportWidth,
      viewportHeight,
      centerX: viewportWidth / 2,
      centerY: viewportHeight / 2,
      fittedWidth,
      fittedHeight
    };
  };

  const getPointInStage = (event) => {
    const metrics = getViewportMetrics();
    if (!metrics) return null;

    const stageRect = metrics.rect;
    return {
      x: event.clientX - stageRect.left,
      y: event.clientY - stageRect.top
    };
  };

  const clampPosition = (nextPosition, targetZoom) => {
    const metrics = getViewportMetrics();
    if (!metrics) {
      return nextPosition;
    }

    if (targetZoom <= 1) {
      return { x: 0, y: 0 };
    }

    const scaledWidth = metrics.fittedWidth * targetZoom;
    const scaledHeight = metrics.fittedHeight * targetZoom;

    let clampedX = nextPosition.x;
    let clampedY = nextPosition.y;

    if (scaledWidth <= metrics.viewportWidth) {
      clampedX = 0;
    } else {
      const maxOffsetX = (scaledWidth - metrics.viewportWidth) / 2;
      clampedX = Math.min(maxOffsetX, Math.max(-maxOffsetX, clampedX));
    }

    if (scaledHeight <= metrics.viewportHeight) {
      clampedY = 0;
    } else {
      const maxOffsetY = (scaledHeight - metrics.viewportHeight) / 2;
      clampedY = Math.min(maxOffsetY, Math.max(-maxOffsetY, clampedY));
    }

    return {
      x: clampedX,
      y: clampedY
    };
  };

  const resetView = () => {
    setZoom(1);
    setIsDragging(false);
    setPosition(clampPosition({ x: 0, y: 0 }, 1));
  };

  const applyZoom = (targetZoom, focusPoint) => {
    const nextZoom = clampZoom(targetZoom);

    if (nextZoom === zoom) {
      return;
    }

    let nextPosition = position;

    if (focusPoint) {
      const metrics = getViewportMetrics();

      if (!metrics) return;

      const imageX = (focusPoint.x - metrics.centerX - position.x) / zoom;
      const imageY = (focusPoint.y - metrics.centerY - position.y) / zoom;

      nextPosition = {
        x: focusPoint.x - metrics.centerX - imageX * nextZoom,
        y: focusPoint.y - metrics.centerY - imageY * nextZoom
      };
    }

    setZoom(nextZoom);
    setPosition(clampPosition(nextPosition, nextZoom));
  };

  const zoomIn = () => {
    const metrics = getViewportMetrics();
    const focusPoint = metrics
      ? { x: metrics.centerX, y: metrics.centerY }
      : null;

    applyZoom(zoom + ZOOM_STEP, focusPoint);
  };

  const zoomOut = () => {
    const metrics = getViewportMetrics();
    const focusPoint = metrics
      ? { x: metrics.centerX, y: metrics.centerY }
      : null;

    applyZoom(zoom - ZOOM_STEP, focusPoint);
  };

  const resetZoom = () => {
    resetView();
  };

  const handleMouseDown = (event) => {
    if (zoom <= 1) return;

    event.preventDefault();
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      originX: position.x,
      originY: position.y
    };
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isOpen) {
      setZoom(1);
      setPosition({ x: 0, y: 0 });
      setIsDragging(false);
      setImageNaturalSize({ width: 0, height: 0 });
      return undefined;
    }

    resetView();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
        return;
      }

      if (event.key === "+" || event.key === "=") {
        zoomIn();
        return;
      }

      if (event.key === "-") {
        zoomOut();
        return;
      }

      if (event.key.toLowerCase() === "0") {
        resetZoom();
      }

      if (event.key.toLowerCase() === "r") {
        resetZoom();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, image?.src]);

  useEffect(() => {
    if (!isDragging) return undefined;

    const handleMouseMove = (event) => {
      const deltaX = event.clientX - dragStartRef.current.x;
      const deltaY = event.clientY - dragStartRef.current.y;

      const nextPosition = {
        x: dragStartRef.current.originX + deltaX,
        y: dragStartRef.current.originY + deltaY
      };

      setPosition(clampPosition(nextPosition, zoom));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, zoom]);

  if (!isOpen || !image?.src) return null;

  return (
    <div className="image-preview-overlay" onMouseDown={(event) => {
      if (event.target === event.currentTarget) {
        onClose?.();
      }
    }}>
      <div className="image-preview-modal">
        <div className="image-preview-controls-row">
          <div className="image-preview-controls">
            <button type="button" className="image-preview-control-btn" onClick={zoomOut} aria-label="Zoom out">
              <FaMinus />
            </button>
            <button type="button" className="image-preview-control-btn" onClick={zoomIn} aria-label="Zoom in">
              <FaPlus />
            </button>
            <button type="button" className="image-preview-control-btn" onClick={resetZoom} aria-label="Reset">
              <FaUndo />
            </button>
            <button type="button" className="image-preview-control-btn" onClick={onClose} aria-label="Close image preview">
              <FaTimes />
            </button>
          </div>
        </div>

        <div
          ref={stageRef}
          className={`image-preview-stage ${zoom > 1 ? "is-zoomed" : ""} ${isDragging ? "is-dragging" : ""}`}
          onMouseDown={handleMouseDown}
          onDoubleClick={(event) => {
            const focusPoint = getPointInStage(event);
            if (!focusPoint) return;

            if (zoom > 1) {
              resetView();
              return;
            }

            applyZoom(2, focusPoint);
          }}
          onWheel={(event) => {
            event.preventDefault();
            const focusPoint = getPointInStage(event);
            const zoomDelta = event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
            applyZoom(zoom + zoomDelta, focusPoint);
          }}
        >
          <img
            src={image.src}
            alt={image.alt || "Preview"}
            className="image-preview-content"
            draggable={false}
            onLoad={(event) => {
              const target = event.currentTarget;
              setImageNaturalSize({
                width: target.naturalWidth || 0,
                height: target.naturalHeight || 0
              });
            }}
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default ImagePreviewModal;