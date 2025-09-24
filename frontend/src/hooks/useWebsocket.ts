import { useState, useEffect } from "react";

import RequestAPI from "@src/api";

type TUseWebsocketProps = {
  onInit: (initCooldown: number) => void;
  onDrawPixel: (x: number, y: number, color: string) => void;
  onClear: (pixels: { x: number; y: number }[]) => void;
  fillBg: () => void;
};

export const useWebsocket = ({
  onInit,
  onDrawPixel,
  onClear,
  fillBg,
}: TUseWebsocketProps) => {
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    const connectWS = async () => {
      const res = await RequestAPI.checkSession();

      if (!res) {
        await RequestAPI.createSession();
      }

      const socket = RequestAPI.openSocket();
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
    };

    connectWS();
  }, []);

  return ws;
};
