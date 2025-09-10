import { useState, useRef, useEffect } from "react";
import type { MouseEventHandler } from "react";

const TEST_COLOR = "#ff0000"; // фиксированный для MVP
const TEST_USER = "test_user"; // потом заменим на авторизацию

const App = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const drawPixel = (x: number, y: number, color: string) => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext("2d");
    if (ctx) {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  };

  const handleClick: MouseEventHandler<HTMLCanvasElement> = (e) => {
    if (!canvasRef.current || !ws) return;

    if (cooldown > 0) {
      alert(`Подожди ${cooldown} сек`);
      return;
    }
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor(e.clientX - rect.left);
    const y = Math.floor(e.clientY - rect.top);

    ws.send(JSON.stringify({ x, y, color: TEST_COLOR, user: TEST_USER }));
    setCooldown(60);
  };

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setInterval(() => {
        setCooldown((c) => (c > 0 ? c - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [cooldown]);

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8000/ws");
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.error) {
        alert(data.error);
      } else {
        drawPixel(data.x, data.y, data.color);
      }
    };
    setWs(socket);
  }, []);

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={500}
        height={500}
        onClick={handleClick}
        style={{
          border: "1px solid black",
        }}
      />
    </div>
  );
};

export default App;
