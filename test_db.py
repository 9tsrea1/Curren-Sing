import os
from dotenv import load_dotenv
from pymongo import MongoClient

# Load the credentials file Atlas generated (it sits next to this script)
load_dotenv(os.path.join(os.path.dirname(__file__), "atlas-credentials.env"))
client = MongoClient(os.environ["MONGODB_URI"])

client.admin.command("ping")
print("Connected!")

db = client["hackathon"]
users = db["users"]
users.insert_one({"name": "Gillian", "from": "Taiwan"})
print(users.find_one({"name": "Gillian"}))
