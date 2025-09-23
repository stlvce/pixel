import { useEffect, useRef, useState, useCallback, useContext } from "react";
import type {
  WheelEventHandler,
  MouseEventHandler,
  TouchEventHandler,
} from "react";

import { PaintPopup, ControlButtons, FullscreenMsg } from "@src/components";
import { Loader, PickColor } from "@src/UI";
import RequestAPI from "@src/api";
import { BOARD_WIDTH, BOARD_HEIGHT, BG_WIDTH, BG_HEIGHT } from "@src/constants";
import { AuthContext } from "@src/store";
import { useTimer, useWebsocket } from "@src/hooks";
import { zoomAtPoint } from "@src/utils";

const UserPlace = () => {
  const { user } = useContext(AuthContext);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const ws = useWebsocket({
    onInit: (initCooldown) => {
      startTimer(initCooldown);
      const img = new Image();
      img.src = "/bg.png"; // путь к картинке
      img.onload = () => {
        if (!canvasRef.current) return;
        const ctx = canvasRef.current.getContext("2d");
        if (!ctx) return;

        // рисуем картинку по центру
        const x = (BOARD_WIDTH - BG_WIDTH) / 2;
        const y = (BOARD_HEIGHT - BG_HEIGHT) / 2;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, x, y, BG_WIDTH, BG_HEIGHT);
      };
    },
    onDrawPixel: (...res) => {
      drawPixel(...res);
    },
    onClear: (res) => {
      res.forEach((pixel: { x: number; y: number }) => {
        if (!canvasRef.current) return;

        const ctx = canvasRef.current.getContext("2d");

        if (!ctx) return;

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(pixel.x, pixel.y, 1, 1);
      });
    },
    fillBg: () => {
      // белый фон
      if (!canvasRef.current) return;
      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
    },
  });
  const { cooldown, startTimer } = useTimer();

  const [scale, setScale] = useState(20);
  const [targetScale, setTargetScale] = useState(20);

  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [targetOffset, setTargetOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const pinchRef = useRef<{
    startDist: number;
    startScale: number;
    midPoint: { x: number; y: number };
  } | null>(null);

  const [hoverPixel, setHoverPixel] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [selectedPixel, setSelectedPixel] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // скорость для инерции
  const velocity = useRef({ x: 0, y: 0 });
  const animationRef = useRef<number | null>(null);

  const [color, setColor] = useState("#ff0000");

  const [isBoardLoading, setIsBoardLoading] = useState(true);

  const clickThreshold = 5; // макс. расстояние (px), чтобы считалось кликом
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);

  const drawPixel = (x: number, y: number, color: string) => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext("2d");

    if (!ctx) return;

    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  };

  // подтверждение постановки
  const handlePlacePixel = () => {
    if (!selectedPixel || !ws || cooldown > 0) return;

    ws.send(JSON.stringify({ ...selectedPixel, color }));
    startTimer();
    setSelectedPixel(null);
  };

  // зум относительно курсора
  const handleWheel: WheelEventHandler<HTMLDivElement> = (e) => {
    // e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newTarget = Math.max(5, Math.min(50, targetScale * zoomFactor));

    const newOffset = zoomAtPoint(scale, newTarget, mouseX, mouseY, offset);
    setTargetScale(newTarget);
    setTargetOffset(newOffset);
  };

  // движение мыши
  const handleMouseMove: MouseEventHandler<HTMLDivElement> = (e) => {
    if (dragging && lastMouse) {
      const dx = e.clientX - lastMouse.x;
      const dy = e.clientY - lastMouse.y;

      setOffset((o) => {
        const newOffset = { x: o.x + dx, y: o.y + dy };
        setTargetOffset(newOffset); // синхронизируем
        return newOffset;
      });
      setLastMouse({ x: e.clientX, y: e.clientY });
      velocity.current = { x: dx, y: dy };
    } else {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left - offset.x) / scale);
      const y = Math.floor((e.clientY - rect.top - offset.y) / scale);
      if (x >= 0 && y >= 0 && x < BOARD_WIDTH && y < BOARD_HEIGHT) {
        setHoverPixel({ x, y });
      } else {
        setHoverPixel(null);
      }
    }
  };

  const handleMouseDown: MouseEventHandler<HTMLDivElement> = (e) => {
    if (e.button === 0) {
      setDragging(true);
      setLastMouse({ x: e.clientX, y: e.clientY });
      mouseDownPos.current = { x: e.clientX, y: e.clientY };

      // останавливаем инерцию
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        velocity.current = { x: 0, y: 0 };
      }
    }
  };

  const handleTouchStart: TouchEventHandler<HTMLDivElement> = (e) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setDragging(true);
      setLastMouse({ x: touch.clientX, y: touch.clientY });
      mouseDownPos.current = { x: touch.clientX, y: touch.clientY };

      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        velocity.current = { x: 0, y: 0 };
      }
    } else if (e.touches.length === 2) {
      const [t1, t2] = [e.touches[0], e.touches[1]];
      pinchRef.current = {
        startDist: Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY),
        startScale: targetScale,
        midPoint: {
          x: (t1.clientX + t2.clientX) / 2,
          y: (t1.clientY + t2.clientY) / 2,
        },
      };
    }
  };

  const handleMouseUp: MouseEventHandler<HTMLDivElement> = (e) => {
    setDragging(false);
    setLastMouse(null);

    // проверяем, был ли это клик (без сильного движения)
    if (mouseDownPos.current) {
      const dx = e.clientX - mouseDownPos.current.x;
      const dy = e.clientY - mouseDownPos.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < clickThreshold) {
        if (!containerRef.current) return;
        // вместо мгновенной постановки → выбор пикселя
        const rect = containerRef.current.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left - offset.x) / scale);
        const y = Math.floor((e.clientY - rect.top - offset.y) / scale);
        if (x >= 0 && y >= 0 && x < BOARD_WIDTH && y < BOARD_HEIGHT) {
          setSelectedPixel({ x, y });
        }
      }
    }

    // запускаем инерцию
    const friction = 0.9;
    const animateInertia = () => {
      velocity.current.x *= friction;
      velocity.current.y *= friction;

      if (
        Math.abs(velocity.current.x) < 0.5 &&
        Math.abs(velocity.current.y) < 0.5
      ) {
        return;
      }

      setOffset((o) => {
        const newOffset = {
          x: o.x + velocity.current.x,
          y: o.y + velocity.current.y,
        };
        setTargetOffset(newOffset);
        return newOffset;
      });

      animationRef.current = requestAnimationFrame(animateInertia);
    };

    animationRef.current = requestAnimationFrame(animateInertia);
  };

  const handleTouchMove: TouchEventHandler<HTMLDivElement> = (e) => {
    if (e.touches.length === 1 && dragging && lastMouse) {
      const touch = e.touches[0];
      const dx = touch.clientX - lastMouse.x;
      const dy = touch.clientY - lastMouse.y;

      setOffset((o) => {
        const newOffset = { x: o.x + dx, y: o.y + dy };
        setTargetOffset(newOffset); // синхронизируем
        return newOffset;
      });

      setLastMouse({ x: touch.clientX, y: touch.clientY });
      velocity.current = { x: dx, y: dy };
    } else if (e.touches.length === 2 && pinchRef.current) {
      const [t1, t2] = [e.touches[0], e.touches[1]];
      const newDist = Math.hypot(
        t2.clientX - t1.clientX,
        t2.clientY - t1.clientY,
      );
      const scaleFactor = newDist / pinchRef.current.startDist;
      const newTarget = Math.max(
        5,
        Math.min(50, pinchRef.current.startScale * scaleFactor),
      );

      const { x, y } = zoomAtPoint(
        scale,
        newTarget,
        pinchRef.current.midPoint.x,
        pinchRef.current.midPoint.y,
        offset,
      );

      setTargetScale(newTarget);
      setTargetOffset({ x, y }); // плавный сдвиг
    }
  };

  const handleTouchEnd: TouchEventHandler<HTMLDivElement> = (e) => {
    setDragging(false);
    setLastMouse(null);
    pinchRef.current = null;

    if (e.changedTouches.length === 1 && mouseDownPos.current) {
      const touch = e.changedTouches[0];
      const dx = touch.clientX - mouseDownPos.current.x;
      const dy = touch.clientY - mouseDownPos.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < clickThreshold) {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = Math.floor((touch.clientX - rect.left - offset.x) / scale);
        const y = Math.floor((touch.clientY - rect.top - offset.y) / scale);
        if (x >= 0 && y >= 0 && x < BOARD_WIDTH && y < BOARD_HEIGHT) {
          setSelectedPixel({ x, y });
        }
      }
    }

    // инерция
    const friction = 0.9;
    const animateInertia = () => {
      velocity.current.x *= friction;
      velocity.current.y *= friction;

      if (
        Math.abs(velocity.current.x) < 0.5 &&
        Math.abs(velocity.current.y) < 0.5
      )
        return;

      setOffset((o) => {
        const newOffset = {
          x: o.x + velocity.current.x,
          y: o.y + velocity.current.y,
        };
        setTargetOffset(newOffset);
        return newOffset;
      });

      animationRef.current = requestAnimationFrame(animateInertia);
    };
    animationRef.current = requestAnimationFrame(animateInertia);
  };

  // плавный зум
  useEffect(() => {
    let animation: number;
    const animate = () => {
      setScale((s) => {
        const diff = targetScale - s;
        return Math.abs(diff) < 0.01 ? targetScale : s + diff * 0.1;
      });

      setOffset((o) => {
        const dx = targetOffset.x - o.x;
        const dy = targetOffset.y - o.y;
        return {
          x: Math.abs(dx) < 0.5 ? targetOffset.x : o.x + dx * 0.1,
          y: Math.abs(dy) < 0.5 ? targetOffset.y : o.y + dy * 0.1,
        };
      });

      animation = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animation);
  }, [targetScale, targetOffset]);

  useEffect(() => {
    RequestAPI.getBoard().then((data) => {
      if (!canvasRef.current) return;

      const ctx = canvasRef.current.getContext("2d");
      // ctx.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

      if (!ctx) return;

      data.forEach((pixel) => {
        ctx.fillStyle = pixel.color;
        ctx.fillRect(pixel.x, pixel.y, 1, 1);
      });

      setIsBoardLoading(false);
    });
  }, []);


  const handleControl = useCallback(
    (action: "up" | "down" | "left" | "right" | "zoomIn" | "zoomOut") => {
      if (!selectedPixel) {
        setSelectedPixel({ x: 0, y: 0 });
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const newOffset = {
            x: rect.width / 2 - 0 * scale,
            y: rect.height / 2 - 0 * scale,
          };
          setOffset(newOffset);
          setTargetOffset(newOffset);
        }
        return;
      }

      let { x, y } = selectedPixel;

      if (action === "up") y = Math.max(0, y - 1);
      if (action === "down") y = Math.min(BOARD_HEIGHT - 1, y + 1);
      if (action === "left") x = Math.max(0, x - 1);
      if (action === "right") x = Math.min(BOARD_WIDTH - 1, x + 1);

      if (["up", "down", "left", "right"].includes(action)) {
        setSelectedPixel({ x, y });

        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const pixelScreenX = offset.x + x * scale;
          const pixelScreenY = offset.y + y * scale;

          const newOffset = { ...offset };
          if (pixelScreenX < 0) newOffset.x += rect.width / 4;
          if (pixelScreenX > rect.width - scale) newOffset.x -= rect.width / 4;
          if (pixelScreenY < 0) newOffset.y += rect.height / 4;
          if (pixelScreenY > rect.height - scale)
            newOffset.y -= rect.height / 4;

          setOffset(newOffset);
          setTargetOffset(newOffset);
        }
      }

      if (action === "zoomIn" || action === "zoomOut") {
        const zoomFactor = action === "zoomIn" ? 1.1 : 0.9;
        const newTarget = Math.max(5, Math.min(50, targetScale * zoomFactor));

        const centerX = offset.x + selectedPixel.x * scale;
        const centerY = offset.y + selectedPixel.y * scale;

        const newOffset = zoomAtPoint(
          scale,
          newTarget,
          centerX,
          centerY,
          offset,
        );

        setTargetScale(newTarget);
        setTargetOffset(newOffset);
      }
    },
    // TODO offset убрал
    [selectedPixel, scale, targetScale],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") handleControl("up");
      if (e.key === "ArrowDown") handleControl("down");
      if (e.key === "ArrowLeft") handleControl("left");
      if (e.key === "ArrowRight") handleControl("right");
      if (e.key.toLowerCase() === "w" || e.key.toLowerCase() === "ц")
        handleControl("zoomOut");
      if (e.key.toLowerCase() === "q" || e.key.toLowerCase() === "й")
        handleControl("zoomIn");
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleControl]);

  return (
    <div>
      {isBoardLoading && <Loader />}

      {/* Сообщение о бане */}
      {user && user.status === "banned" && <FullscreenMsg text="Забанен" />}

      {/* Выбор цвета */}
      <button className="btn btn-lg btn-circle overflow-hidden fixed top-2 left-2 z-2">
        <PickColor
          color={color}
          changeColor={(newColor) => setColor(newColor)}
        />
      </button>

      <div
        className={`relative w-screen h-screen overflow-hidden ${dragging ? "cursor-grabbing" : "cursor-default"} touch-none`}
        onWheel={handleWheel}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        ref={containerRef}
      >
        <canvas
          className="shadow-lg"
          width={BOARD_WIDTH}
          height={BOARD_HEIGHT}
          style={{
            position: "absolute",
            left: offset.x,
            top: offset.y,
            width: BOARD_WIDTH * scale,
            height: BOARD_HEIGHT * scale,
            imageRendering: "pixelated",
          }}
          ref={canvasRef}
        />

        {/* Подсветка наведения */}
        {hoverPixel && !dragging && (
          <div
            style={{
              position: "absolute",
              left: offset.x + hoverPixel.x * scale,
              top: offset.y + hoverPixel.y * scale,
              width: scale,
              height: scale,
              boxSizing: "border-box",
              border: "1px dashed black",
              pointerEvents: "none",
            }}
          />
        )}

        {/* Подсветка выбранного пикселя */}
        {selectedPixel && (
          <div
            style={{
              position: "absolute",
              left: offset.x + selectedPixel.x * scale,
              top: offset.y + selectedPixel.y * scale,
              width: scale,
              height: scale,
              boxSizing: "border-box",
              border: `2px solid black`,
              pointerEvents: "none",
            }}
          />
        )}
      </div>

      {/* Кнопки управления */}
      <ControlButtons
        onZoomIn={() => handleControl("zoomIn")}
        onZoomOut={() => handleControl("zoomOut")}
        onUp={() => handleControl("up")}
        onDown={() => handleControl("down")}
        onLeft={() => handleControl("left")}
        onRight={() => handleControl("right")}
      />

      {/* Подтверждение поставки пикселя */}
      <PaintPopup
        color={color}
        selectedPixel={selectedPixel}
        handlePlacePixel={handlePlacePixel}
        cooldown={cooldown}
        onCancel={() => setSelectedPixel(null)}
      />
    </div>
  );
};

export default UserPlace;
