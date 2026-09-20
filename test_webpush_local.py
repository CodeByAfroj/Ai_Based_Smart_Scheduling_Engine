import asyncio
import os
import json
from motor.motor_asyncio import AsyncIOMotorClient
from pywebpush import webpush, WebPushException
from dotenv import load_dotenv

load_dotenv("backend/.env")
MONGO_URI = os.getenv("MONGO_URI")

# We need the VAPID private key. It's in Vercel, but let's see if we have it locally.
# If not, this script might fail. Let's check backend/.env first.
