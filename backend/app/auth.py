import os
import jwt
import httpx
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Request
from .database import get_user_collection

router = APIRouter(prefix="/auth", tags=["auth"])

JWT_SECRET = os.getenv("JWT_SECRET", "super_secret_key")

@router.post("/google")
async def google_auth(request: Request):
    try:
        data = await request.json()
        token = data.get("token")
        if not token:
            raise HTTPException(status_code=400, detail="Token missing")

        # Verify token with Google's userinfo endpoint
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {token}"}
            )

        if response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid Google token")

        user_info = response.json()
        google_id = user_info.get("sub")
        email = user_info.get("email", "")
        name = user_info.get("name", "")
        picture = user_info.get("picture", "")

        if not google_id:
            raise HTTPException(status_code=400, detail="Could not retrieve user info from Google")

        collection = get_user_collection()
        user = await collection.find_one({"google_id": google_id})

        if not user:
            # Brand new user — create record
            new_user = {
                "google_id": google_id,
                "email": email,
                "picture": picture,
                "profile": {"name": name},
                "settings": {},
                "created_at": datetime.utcnow()
            }
            await collection.insert_one(new_user)
        else:
            # Always update name/email/picture in case they changed in Google
            await collection.update_one(
                {"google_id": google_id},
                {"$set": {
                    "email": email,
                    "picture": picture,
                    "profile.name": name,
                    "last_login": datetime.utcnow()
                }}
            )

        # 7-day JWT so user stays logged in
        access_token = jwt.encode(
            {"sub": google_id, "exp": datetime.utcnow() + timedelta(days=7)},
            JWT_SECRET,
            algorithm="HS256"
        )

        return {"access_token": access_token, "token_type": "bearer"}

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=f"Backend Error: {str(e)}")
