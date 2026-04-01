test:
	PYTHONPATH=. ./backend/venv/bin/pytest backend/tests

dev-frontend:
	cd frontend && npm run dev

dev-backend:
	cd backend && . venv/bin/activate && uvicorn main:app --reload

dev:
	( cd backend && . venv/bin/activate && uvicorn main:app --reload ) & ( cd frontend && npm run dev ) & wait
