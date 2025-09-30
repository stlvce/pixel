## Dev

Backend:
- Создать .env в корне проекта
- Устанавливаем [Python](https://www.python.org)
- Создаем виртуальное окружение ```python -m venv .venv```
- Устанавливаем библиотеки ```pip install -r requirements.txt```
- Запускаем ```uvicorn main:app --reload```

Frontend:
- Создать .env в корне проекта
- Устанавливаем [Node.js](http://nodejs.org)
- В папке проекта выполняем```npm install```
- Затем ```npm run dev```

## Prod

- Добавляем .env в frontend и backend
- Устанавливаем docker compose
- ```docker compose up -d --build```

