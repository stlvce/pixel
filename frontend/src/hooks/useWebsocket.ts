import { useState, useEffect } from "react";

import RequestAPI from "@src/api";

type TUseWebsocketProps = {
  onDrawPixel: (x: number, y: number, color: string) => void;
  onInit: (initCooldown: number) => void;
  onClear: (pixels: { x: number; y: number }[]) => void;
};

export const useWebsocket = ({
  onDrawPixel,
  onInit,
  onClear,
}: TUseWebsocketProps) => {
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("jwt");
    const socket = RequestAPI.openSocket(token);
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "pixel") {
        onDrawPixel(data.x, data.y, data.color);
      } else if (data.type === "init") {
        onInit(data.coldown);
      } else if (data.type === "clear") {
        onClear(data.list);
      }
    };
    setWs(socket);

    // белый фон
    // if (!canvasRef.current) return;

    // const ctx = canvasRef.current.getContext("2d");

    // if (!ctx) return;

    // ctx.fillStyle = "#ffffff";
    // ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
  }, []);

  return ws;
};
