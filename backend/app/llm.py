import cohere
import os
from dotenv import load_dotenv
from app.prompts import get_system_prompt

load_dotenv()

MODEL_NAME = os.getenv("COHERE_MODEL", "command-r-08-2024")


def get_cohere_client():
    """Create the Cohere client only when an API call is needed."""
    api_key = os.getenv("COHERE_API_KEY")
    if not api_key:
        raise RuntimeError("COHERE_API_KEY is missing. Add it to backend/.env")
    return cohere.ClientV2(api_key=api_key)


def get_cohere_response(prompt: str, feature_type: str):
    """
    Unified function for all NexCode features using Cohere.
    """
    co = get_cohere_client()
    res = co.chat(
        model=MODEL_NAME,
        messages=[
            {"role": "system", "content": get_system_prompt(feature_type)},
            {"role": "user", "content": prompt}
        ]
    )
    return res.message.content[0].text
