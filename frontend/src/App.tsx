import { useEffect, useRef, useState } from "react";

import { AuthModal } from "./components";

const App = () => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const [ws, setWs] = useState(null);
  const [cooldown, setCooldown] = useState(0);

  const [scale, setScale] = useState(20);
  const [targetScale, setTargetScale] = useState(20);

  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState(null);

  const [hoverPixel, setHoverPixel] = useState(null);
  const [selectedPixel, setSelectedPixel] = useState(null);

  // скорость для инерции
  const velocity = useRef({ x: 0, y: 0 });
  const animationRef = useRef(null);

  const width = 200;
  const height = 100;

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8000/ws");
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "init") {
        // отрисовать всю доску
        const ctx = canvasRef.current.getContext("2d");
        data.board.forEach((row, y) => {
          row.forEach((color, x) => {
            if (color) {
              ctx.fillStyle = color;
              ctx.fillRect(x, y, 1, 1);
            }
          });
        });
      } else if (data.type === "pixel") {
        drawPixel(data.x, data.y, data.color);
      } else if (data.type === "error") {
        alert(data.error);
      }
    };
    setWs(socket);

    // белый фон
    const ctx = canvasRef.current.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }, []);

  const drawPixel = (x, y, color) => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  };

  // подтверждение постановки
  const handlePlacePixel = () => {
    if (!selectedPixel) return;
    if (cooldown > 0) {
      alert(`Подожди ${cooldown} сек`);
      return;
    }

    const color = "#ff0000"; // TODO: выбор цвета
    const user = "test_user";

    ws.send(JSON.stringify({ ...selectedPixel, color, user }));
    setCooldown(60);
    setSelectedPixel(null);
  };

  // кулдаун
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setInterval(() => {
        setCooldown((c) => (c > 0 ? c - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [cooldown]);

  // зум относительно курсора
  const handleWheel = (e) => {
    e.preventDefault();

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newTarget = Math.max(5, Math.min(50, targetScale * zoomFactor));

    const worldX = (mouseX - offset.x) / scale;
    const worldY = (mouseY - offset.y) / scale;

    setTargetScale(newTarget);

    const newOffsetX = mouseX - worldX * newTarget;
    const newOffsetY = mouseY - worldY * newTarget;
    setOffset({ x: newOffsetX, y: newOffsetY });
  };

  // плавный зум
  useEffect(() => {
    let animation;
    const animate = () => {
      setScale((s) => {
        const diff = targetScale - s;
        if (Math.abs(diff) < 0.01) return targetScale;
        return s + diff * 0.15;
      });
      animation = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animation);
  }, [targetScale]);

  // движение мыши
  const handleMouseMove = (e) => {
    if (dragging && lastMouse) {
      const dx = e.clientX - lastMouse.x;
      const dy = e.clientY - lastMouse.y;

      setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
      setLastMouse({ x: e.clientX, y: e.clientY });

      // сохраняем скорость
      velocity.current = { x: dx, y: dy };
    } else {
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left - offset.x) / scale);
      const y = Math.floor((e.clientY - rect.top - offset.y) / scale);
      if (x >= 0 && y >= 0 && x < width && y < height) {
        setHoverPixel({ x, y });
      } else {
        setHoverPixel(null);
      }
    }
  };

  const clickThreshold = 5; // макс. расстояние (px), чтобы считалось кликом
  const mouseDownPos = useRef(null);

  const handleMouseDown = (e) => {
    if (e.button === 0) {
      setDragging(true);
      setLastMouse({ x: e.clientX, y: e.clientY });
      mouseDownPos.current = { x: e.clientX, y: e.clientY };

      // останавливаем инерцию
      cancelAnimationFrame(animationRef.current);
      velocity.current = { x: 0, y: 0 };
    }
  };

  const handleMouseUp = (e) => {
    setDragging(false);
    setLastMouse(null);

    // проверяем, был ли это клик (без сильного движения)
    if (mouseDownPos.current) {
      const dx = e.clientX - mouseDownPos.current.x;
      const dy = e.clientY - mouseDownPos.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < clickThreshold) {
        // вместо мгновенной постановки → выбор пикселя
        const rect = containerRef.current.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left - offset.x) / scale);
        const y = Math.floor((e.clientY - rect.top - offset.y) / scale);
        if (x >= 0 && y >= 0 && x < width && y < height) {
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

      setOffset((o) => ({
        x: o.x + velocity.current.x,
        y: o.y + velocity.current.y,
      }));

      animationRef.current = requestAnimationFrame(animateInertia);
    };

    animationRef.current = requestAnimationFrame(animateInertia);
  };

  return (
    <div className="App">
      <AuthModal />

      <div
        className={`relative w-screen h-screen overflow-hidden ${dragging ? "cursor-grabbing" : "cursor-default"}`}
        onWheel={handleWheel}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        ref={containerRef}
      >
        <canvas
          width={width}
          height={height}
          style={{
            position: "absolute",
            left: offset.x,
            top: offset.y,
            width: width * scale,
            height: height * scale,
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
              border: "2px solid blue",
              pointerEvents: "none",
            }}
          />
        )}
      </div>

      {/* Панель управления */}
      {selectedPixel && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-white px-5 py-2.5 rounded-lg shadow-xl/10 border-1 border-gray-200">
          <p className="text-zinc-800">
            Пиксель: {selectedPixel.x}, {selectedPixel.y}
          </p>
          <div className="flex gap-2 mt-2">
            <button
              className="btn btn-primary"
              onClick={handlePlacePixel}
              disabled={cooldown > 0}
            >
              {cooldown > 0 ? `Подожди ${cooldown}с` : "Поставить"}
            </button>
            <button className="btn" onClick={() => setSelectedPixel(null)}>
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
