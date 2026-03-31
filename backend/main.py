from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def read_root():
    return {"message": "StratForge API is running"}
