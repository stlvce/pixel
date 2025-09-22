import { useState, useEffect } from "react";

import RequestAPI from "@src/api";

type TUseWebsocketProps = {
  onDrawPixel: (x: number, y: number, color: string) => void;
  onInit: (initCooldown: number) => void;
  onClear: (pixels: { x: number; y: number }[]) => void;
  fillBg: () => void;
};

export const useWebsocket = ({
  onDrawPixel,
  onInit,
  onClear,
  fillBg,
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
        onClear(data.payload);
      }
    };
    setWs(socket);

    fillBg();
  }, []);

  return ws;
};
