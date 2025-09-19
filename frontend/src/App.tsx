import { useEffect, useRef, useState, useCallback, useContext } from "react";
import type {
  WheelEventHandler,
  MouseEventHandler,
  TouchEventHandler,
} from "react";

import { SideBar, AuthModal, PaintPopup } from "@src/components";
import RequestAPI from "@src/api";
import { BOARD_WIDTH, BOARD_HEIGHT, BG_WIDTH, BG_HEIGHT } from "@src/constants";
import { AuthContext } from "@src/store";

const App = () => {
  const { user } = useContext(AuthContext);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [ws, setWs] = useState<WebSocket | null>(null);
  const [cooldown, setCooldown] = useState(0);

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
    if (!selectedPixel || !ws) return;
    if (cooldown > 0) {
      alert(`Подожди ${cooldown} сек`);
      return;
    }

    const user = "test_user";

    ws.send(JSON.stringify({ ...selectedPixel, color, user }));
    setCooldown(60);
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

  useEffect(() => {
    const token = localStorage.getItem("jwt");
    const socket = RequestAPI.openSocket(token);
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "pixel") {
        drawPixel(data.x, data.y, data.color);
      } else if (data.type === "error") {
        alert(data.error);
      } else if (data.type === "init") {
        setCooldown(data.coldown);
      }
    };
    setWs(socket);

    // белый фон
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext("2d");

    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
  }, []);

  // кулдаун
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setInterval(() => {
        setCooldown((c) => (c > 0 ? c - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [cooldown]);

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
    });
  }, []);

  useEffect(() => {
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
    [selectedPixel, offset, scale, targetScale],
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

  // новое состояние
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [isEdit, setIsEdit] = useState(true);

  const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));

  // начало выделения
  const handleAdminMouseDown: MouseEventHandler<HTMLDivElement> = (e) => {
    if (user?.is_admin !== 1) return;
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left - offset.x) / scale);
    const y = Math.floor((e.clientY - rect.top - offset.y) / scale);

    setSelectionStart({ x, y });
    setSelectionEnd(null);
    setIsSelecting(true);
  };

  // тянем прямоугольник
  const handleAdminMouseMove: MouseEventHandler<HTMLDivElement> = (e) => {
    if (user?.is_admin !== 1 || !isSelecting || !selectionStart) return;
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    let x = Math.floor((e.clientX - rect.left - offset.x) / scale);
    let y = Math.floor((e.clientY - rect.top - offset.y) / scale);

    // ограничиваем область канвасом
    x = clamp(x, 0, BOARD_WIDTH - 1);
    y = clamp(y, 0, BOARD_HEIGHT - 1);

    setSelectionEnd({ x, y });

    // автоскролл при достижении края экрана
    const margin = 50;
    let dx = 0;
    let dy = 0;

    if (e.clientX - rect.left < margin) dx = 10; // влево
    if (rect.right - e.clientX < margin) dx = -10; // вправо
    if (e.clientY - rect.top < margin) dy = 10; // вверх
    if (rect.bottom - e.clientY < margin) dy = -10; // вниз

    if (dx !== 0 || dy !== 0) {
      setOffset((o) => {
        const newOffset = { x: o.x + dx, y: o.y + dy };
        setTargetOffset(newOffset);
        return newOffset;
      });
    }
  };

  // отпускаем — очищаем
  const handleAdminMouseUp: MouseEventHandler<HTMLDivElement> = () => {
    if (
      user?.is_admin !== 1 ||
      !isSelecting ||
      !selectionStart ||
      !selectionEnd ||
      !canvasRef.current
    ) {
      setIsSelecting(false);
      return;
    }

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const x1 = clamp(
      Math.min(selectionStart.x, selectionEnd.x),
      0,
      BOARD_WIDTH - 1,
    );
    const y1 = clamp(
      Math.min(selectionStart.y, selectionEnd.y),
      0,
      BOARD_HEIGHT - 1,
    );
    const x2 = clamp(
      Math.max(selectionStart.x, selectionEnd.x),
      0,
      BOARD_WIDTH - 1,
    );
    const y2 = clamp(
      Math.max(selectionStart.y, selectionEnd.y),
      0,
      BOARD_HEIGHT - 1,
    );

    // сообщение на сервер
    const token = localStorage.getItem("jwt");

    if (token) {
      RequestAPI.deletePixels(token, {
        start: { x: x1, y: y1 },
        end: { x: x2, y: y2 },
      }).then((res) => {
        res.forEach((pixel) => {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(pixel.x, pixel.y, 1, 1);
        });
      });
    }

    setIsSelecting(false);
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  const handleAdminTouchStart: TouchEventHandler<HTMLDivElement> = (e) => {
    if (user?.is_admin !== 1 || e.touches.length !== 1) return;
    if (!containerRef.current) return;

    const touch = e.touches[0];
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.floor((touch.clientX - rect.left - offset.x) / scale);
    const y = Math.floor((touch.clientY - rect.top - offset.y) / scale);

    setSelectionStart({ x, y });
    setSelectionEnd(null);
    setIsSelecting(true);
  };

  const handleAdminTouchMove: TouchEventHandler<HTMLDivElement> = (e) => {
    if (
      user?.is_admin !== 1 ||
      !isSelecting ||
      !selectionStart ||
      e.touches.length !== 1
    )
      return;
    if (!containerRef.current) return;

    const touch = e.touches[0];
    const rect = containerRef.current.getBoundingClientRect();

    let x = Math.floor((touch.clientX - rect.left - offset.x) / scale);
    let y = Math.floor((touch.clientY - rect.top - offset.y) / scale);

    x = clamp(x, 0, BOARD_WIDTH - 1);
    y = clamp(y, 0, BOARD_HEIGHT - 1);

    setSelectionEnd({ x, y });

    // автоскролл при достижении края контейнера
    const margin = 50; // px от края
    let dx = 0;
    let dy = 0;

    if (touch.clientX - rect.left < margin) dx = 10; // движение влево
    if (rect.right - touch.clientX < margin) dx = -10; // движение вправо
    if (touch.clientY - rect.top < margin) dy = 10; // движение вверх
    if (rect.bottom - touch.clientY < margin) dy = -10; // движение вниз

    if (dx !== 0 || dy !== 0) {
      setOffset((o) => {
        const newOffset = { x: o.x + dx, y: o.y + dy };
        setTargetOffset(newOffset); // синхронизация с плавным движением
        return newOffset;
      });
    }
  };

  const handleAdminTouchEnd: TouchEventHandler<HTMLDivElement> = () => {
    if (
      user?.is_admin !== 1 ||
      !isSelecting ||
      !selectionStart ||
      !selectionEnd
    ) {
      setIsSelecting(false);
      return;
    }

    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    const x1 = clamp(
      Math.min(selectionStart.x, selectionEnd.x),
      0,
      BOARD_WIDTH - 1,
    );
    const y1 = clamp(
      Math.min(selectionStart.y, selectionEnd.y),
      0,
      BOARD_HEIGHT - 1,
    );
    const x2 = clamp(
      Math.max(selectionStart.x, selectionEnd.x),
      0,
      BOARD_WIDTH - 1,
    );
    const y2 = clamp(
      Math.max(selectionStart.y, selectionEnd.y),
      0,
      BOARD_HEIGHT - 1,
    );

    // Удаляем пиксели через API
    const token = localStorage.getItem("jwt");
    if (token) {
      RequestAPI.deletePixels(token, {
        start: { x: x1, y: y1 },
        end: { x: x2, y: y2 },
      }).then((res) => {
        res.forEach((pixel: { x: number; y: number }) => {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(pixel.x, pixel.y, 1, 1);
        });
      });
    }

    setIsSelecting(false);
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  return (
    <div className="App">
      <AuthModal />

      <div
        className={`relative w-screen h-screen overflow-hidden ${dragging ? "cursor-grabbing" : "cursor-default"} touch-none`}
        onWheel={handleWheel}
        onMouseMove={isEdit ? handleMouseMove : handleAdminMouseMove}
        onMouseDown={isEdit ? handleMouseDown : handleAdminMouseDown}
        onMouseUp={isEdit ? handleMouseUp : handleAdminMouseUp}
        onTouchStart={isEdit ? handleTouchStart : handleAdminTouchStart}
        onTouchMove={isEdit ? handleTouchMove : handleAdminTouchMove}
        onTouchEnd={isEdit ? handleTouchEnd : handleAdminTouchEnd}
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

      {isSelecting && selectionStart && selectionEnd && (
        <div
          style={{
            position: "absolute",
            left: offset.x + Math.min(selectionStart.x, selectionEnd.x) * scale,
            top: offset.y + Math.min(selectionStart.y, selectionEnd.y) * scale,
            width: (Math.abs(selectionEnd.x - selectionStart.x) + 1) * scale,
            height: (Math.abs(selectionEnd.y - selectionStart.y) + 1) * scale,
            border: "2px dashed red",
            backgroundColor: "rgba(255,0,0,0.2)",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Кнопки управления */}
      <div className="absolute left-5 bottom-5 flex flex-col gap-2 select-none hidden md:flex">
        <div className="flex justify-center gap-5">
          <div className="relative">
            <button
              className="btn w-10"
              onClick={() => handleControl("zoomIn")}
            >
              +
            </button>
            <kbd className="kbd kbd-xs absolute -top-1 -right-1">Q</kbd>
          </div>
          <button className="btn w-10" onClick={() => handleControl("up")}>
            ▲
          </button>
          <div className="relative">
            <button
              className="btn w-10"
              onClick={() => handleControl("zoomOut")}
            >
              -
            </button>
            <kbd className="kbd kbd-xs absolute -top-1 -right-1">W</kbd>
          </div>
        </div>
        <div className="flex justify-center gap-5">
          <button className="btn w-10" onClick={() => handleControl("left")}>
            ◀︎
          </button>
          <button className="btn w-10" onClick={() => handleControl("down")}>
            ▼
          </button>
          <button className="btn w-10" onClick={() => handleControl("right")}>
            ▶︎
          </button>
        </div>
      </div>

      {/* Подтверждение поставки пикселя */}
      <PaintPopup
        color={color}
        selectedPixel={selectedPixel}
        handlePlacePixel={handlePlacePixel}
        cooldown={cooldown}
        onCancel={() => setSelectedPixel(null)}
      />

      {/* Тулбар */}
      <div className="fab">
        <div tabIndex={0} role="button" className="btn btn-lg btn-circle">
          <svg
            className="size-6"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
            />
          </svg>
        </div>

        {/* Выбор цвета */}
        <button className="btn btn-lg btn-circle overflow-hidden">
          <SideBar
            color={color}
            changeColor={(newColor) => setColor(newColor)}
          />
        </button>
        {user?.is_admin === 1 && (
          <>
            {/* Редактирование */}
            <button
              className="btn btn-lg btn-circle"
              onClick={() => {
                setIsEdit(true);
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="size-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125"
                />
              </svg>
            </button>

            {/* Удаление */}
            <button
              className="btn btn-lg btn-circle"
              onClick={() => {
                if (isEdit) {
                  setSelectedPixel(null);
                  setHoverPixel(null);
                }

                setIsEdit(false);
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="size-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                />
              </svg>
            </button>
          </>
        )}
        {user?.is_admin === 1 && (
          <div className="fixed top-2 left-1/2 -translate-x-1/2 bg-white px-5 py-2 rounded-lg shadow-xl/10 border-1 border-gray-200 z-10">
            Режим: {isEdit ? "редактирования" : "модерация"}
          </div>
        )}
      </div>
    </div>
  );
};

function zoomAtPoint(
  oldScale: number,
  newScale: number,
  pointX: number,
  pointY: number,
  offset: { x: number; y: number },
) {
  const scaleFactor = newScale / oldScale;

  return {
    x: pointX - (pointX - offset.x) * scaleFactor,
    y: pointY - (pointY - offset.y) * scaleFactor,
  };
}

export default App;
