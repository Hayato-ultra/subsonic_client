cd C:\Users\ROHIT\projects\subsonic_client
$env:GONIC_URL = "http://192.168.3.105:4747"
$env:GONIC_USER = "ROHIT"
$env:GONIC_PASSWORD = "rohit"
python -m uvicorn app.main:app --port 8000